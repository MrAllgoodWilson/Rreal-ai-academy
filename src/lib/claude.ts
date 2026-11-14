import "server-only";
import { cfManagedText } from "@/lib/cf-ai";
import type { Byok } from "@/lib/byok-server";
import { COMPANY_COST_BUDGETS, CostMeteringManager, dispatchWithCostMetering, HARD_REQUEST_LIMITS } from "@/lib/founders/cost-metering";
import { getDefaultFoundersRulesEngine, getFoundersCostStore } from "@/lib/founders-engine";

/**
 * Text generation with two strictly separate funding modes:
 *
 *  - "byok": the member's own provider key pays. The Academy meter is not involved and an owner-funded failure
 *    NEVER falls back to an Academy-funded model.
 *  - "managed": the Academy pays, so every call is (1) restricted to the one approved model below, (2) allowed only
 *    for an account with an active Founders entitlement, (3) reserved in the durable SQL ledger for its MAXIMUM
 *    possible cost before dispatch, and (4) settled from provider-reported usage. If the provider omits usage, or the
 *    call fails/times out after dispatch, the reservation stays held (money, unit and concurrency) for reconciliation.
 *
 * There is no third mode and no exported way to reach a provider without choosing one.
 */
export const MANAGED_COMPANY = "rreal" as const;

/** The ONE binding of executed model -> price key -> provider. Changing the model means changing the price here. */
export const MANAGED_TEXT_MODEL = {
  provider: "cloudflare-workers-ai",
  workersAiModel: "@cf/meta/llama-3.2-3b-instruct",
  priceKey: "llama-3.2-3b",
} as const;

export type AiFunding = { kind: "byok"; byok: Byok } | { kind: "managed"; accountId: string };

export interface ClaudeCallOptions {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  funding: AiFunding;
}

export class ManagedAiDeniedError extends Error {
  constructor(public readonly reason: string) {
    super(`managed AI denied: ${reason}`);
    this.name = "ManagedAiDeniedError";
  }
}
/** Thrown AFTER dispatch when the provider gave no usable usage report. The reservation is deliberately left held. */
export class ManagedUsageMissingError extends Error {
  constructor() {
    super("provider response omitted token usage; reservation held for reconciliation");
    this.name = "ManagedUsageMissingError";
  }
}

let manager: CostMeteringManager | null = null;
export function getDefaultCostMeteringManager(): CostMeteringManager {
  // Durable Postgres ledger only; getFoundersCostStore() throws when storage isn't configured.
  if (!manager) manager = new CostMeteringManager(getFoundersCostStore());
  return manager;
}
/** Test seam: inject a manager built on a harness database. Never used by app code. */
export function setDefaultCostMeteringManager(next: CostMeteringManager | null): void {
  manager = next;
}

const bytes = (s: string | undefined) => Buffer.byteLength(s ?? "", "utf8");

/**
 * Upper bound on prompt tokens without a tokenizer: a token never spans less than one byte, plus a fixed allowance for
 * the chat template around each message. Deliberately conservative: this is a bound, not an estimate.
 */
export function promptTokenUpperBound(system: string, messages: { content: string }[]): number {
  return bytes(system) + 16 + messages.reduce((n, m) => n + bytes(m.content) + 16, 0) + 32;
}

/** Resolves the approved managed model, rejecting any override or price-table drift BEFORE anything is dispatched. */
export function resolveManagedModel(env: Readonly<Record<string, string | undefined>> = process.env) {
  const override = env.WORKERS_AI_MODEL;
  if (override && override !== MANAGED_TEXT_MODEL.workersAiModel) {
    throw new ManagedAiDeniedError("WORKERS_AI_MODEL is not the approved managed model");
  }
  if (env.AI_GATEWAY_MODEL) {
    // A gateway model would execute (and bill) something other than the priced model.
    throw new ManagedAiDeniedError("AI_GATEWAY_MODEL is not permitted for managed execution");
  }
  const price = COMPANY_COST_BUDGETS[MANAGED_COMPANY].supportedModels[MANAGED_TEXT_MODEL.priceKey];
  if (!price || price.provider !== MANAGED_TEXT_MODEL.provider || !MANAGED_TEXT_MODEL.workersAiModel.endsWith(`/${price.model}`)) {
    throw new ManagedAiDeniedError("managed model has no matching price entry");
  }
  return MANAGED_TEXT_MODEL;
}

async function callManaged(opts: ClaudeCallOptions, accountId: string): Promise<string | null> {
  const model = resolveManagedModel();
  const maxOutput = Math.min(Math.max(1, Math.floor(opts.maxTokens ?? 700)), HARD_REQUEST_LIMITS.maxCompletionTokens);
  const maxInput = promptTokenUpperBound(opts.system, opts.messages);
  if (opts.messages.length > HARD_REQUEST_LIMITS.maxTurns * 2) throw new ManagedAiDeniedError("too many turns");

  // Entitlement first: no reservation and no dispatch for an account without an active Founders entitlement.
  const entitlement = await getDefaultFoundersRulesEngine().checkEntitlement(MANAGED_COMPANY, accountId);
  if (!entitlement.hasActiveEntitlement) throw new ManagedAiDeniedError("no active Founders entitlement");

  // Reserve the maximum this single dispatch can cost (one call, no retry, no fan-out), then dispatch exactly once.
  return dispatchWithCostMetering(
    getDefaultCostMeteringManager(), MANAGED_COMPANY, accountId, model.priceKey, maxInput, maxOutput, 1,
    async () => {
      const out = await cfManagedText(model.workersAiModel, { system: opts.system, messages: opts.messages, maxTokens: maxOutput });
      const input = out.usage?.promptTokens;
      const output = out.usage?.completionTokens;
      if (!Number.isInteger(input) || !Number.isInteger(output) || (input as number) < 0 || (output as number) < 0) {
        throw new ManagedUsageMissingError();
      }
      return { result: out.text, actualInputTokens: input as number, actualOutputTokens: output as number };
    },
  );
}

/** Member-funded call. Returns null on any provider failure; never touches an Academy-funded model. */
async function callOwnerFunded(opts: ClaudeCallOptions, byok: Byok): Promise<string | null> {
  const body = { max_tokens: opts.maxTokens ?? 700 };
  if (byok.anthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": byok.anthropic, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ ...body, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", system: opts.system, messages: opts.messages }),
    });
    if (!res.ok) { console.error("Claude API error", res.status); return null; }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    return json.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim() || null;
  }
  if (byok.openai) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${byok.openai}`, "content-type": "application/json" },
      body: JSON.stringify({ ...body, model: process.env.OPENAI_MODEL || "gpt-4.1-mini", messages: [{ role: "system", content: opts.system }, ...opts.messages] }),
    });
    if (!res.ok) { console.error("OpenAI API error", res.status); return null; }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || null;
  }
  return null;
}

/**
 * The only entry point for text generation. Returns null when no text is available so callers can degrade to their
 * offline engine. A managed denial makes zero provider calls; a managed failure after dispatch leaves the
 * reservation held and is logged by class name only.
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<string | null> {
  const funding = opts.funding;
  if (!funding || (funding.kind !== "byok" && funding.kind !== "managed")) {
    throw new Error("callClaude requires an explicit funding mode");
  }
  if (funding.kind === "byok") {
    if (!funding.byok?.anthropic && !funding.byok?.openai) throw new Error("callClaude: byok funding without a member key");
    return callOwnerFunded(opts, funding.byok);
  }
  if (typeof funding.accountId !== "string" || !funding.accountId) throw new Error("callClaude: managed funding without an account");
  try {
    return await callManaged(opts, funding.accountId);
  } catch (e) {
    console.error("Managed AI call not completed:", e instanceof Error ? e.name : "unknown");
    return null;
  }
}
