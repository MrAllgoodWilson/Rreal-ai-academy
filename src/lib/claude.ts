import "server-only";
import { cfText, cfTextWithDetails } from "@/lib/cf-ai";
import type { Byok } from "@/lib/byok-server";
import {
  CostMeteringManager,
  dispatchWithCostMetering,
  MemoryFoundersCostStore,
  CompanyId,
} from "@/lib/founders";

let defaultManager: CostMeteringManager | null = null;

function createDefaultStore() {
  const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("Durable PostgresFoundersCostStore requires DATABASE_URL or TEST_DATABASE_URL. In-memory fallback is prohibited.");
  }
  try {
    const { Pool } = require("pg");
    const { PostgresFoundersCostStore } = require("./founders");
    return new PostgresFoundersCostStore(new Pool({ connectionString: dbUrl }));
  } catch (err) {
    throw new Error("Failed to initialize durable PostgresFoundersCostStore: " + (err as Error).message);
  }
}

export function getDefaultCostMeteringManager(): CostMeteringManager {
  if (!defaultManager) {
    defaultManager = new CostMeteringManager(createDefaultStore());
  }
  return defaultManager;
}

export function setDefaultCostMeteringManager(manager: CostMeteringManager | null): void {
  defaultManager = manager;
}

export interface ClaudeCallOptions {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  byok?: Byok;
  metering?: {
    accountId: string;
    companyId?: CompanyId;
    modelKey?: string;
    meterManager?: CostMeteringManager;
  };
}

export interface ProviderCallDetails {
  result: string | null;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  modelUsed: string;
}

/** Internal provider execution logic with actual usage extraction */
export async function executeProviderCallWithDetails(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  byok?: Byok;
}): Promise<ProviderCallDetails> {
  if (opts.byok?.openai && !opts.byok.anthropic) {
    return callOpenAIWithDetails(opts.byok.openai, opts);
  }

  const key = opts.byok?.anthropic || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const cf = await cfTextWithDetails(opts);
    return {
      result: cf.text,
      actualInputTokens: cf.usage?.promptTokens,
      actualOutputTokens: cf.usage?.completionTokens,
      modelUsed: cf.modelUsed,
    };
  }

  const own = Boolean(opts.byok?.anthropic);
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 700,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    console.error("Claude API error", res.status);
    if (own) return { result: null, modelUsed: model };
    const cf = await cfTextWithDetails(opts);
    return {
      result: cf.text,
      actualInputTokens: cf.usage?.promptTokens,
      actualOutputTokens: cf.usage?.completionTokens,
      modelUsed: cf.modelUsed,
    };
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = json.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim() || null;
  return {
    result: text,
    actualInputTokens: json.usage?.input_tokens,
    actualOutputTokens: json.usage?.output_tokens,
    modelUsed: model,
  };
}

/** Legacy wrapper maintaining string | null contract */
export async function executeProviderCall(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  byok?: Byok;
}): Promise<string | null> {
  const details = await executeProviderCallWithDetails(opts);
  return details.result;
}

/** OpenAI Chat Completions with member's own key */
async function callOpenAIWithDetails(
  key: string,
  opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number }
): Promise<ProviderCallDetails> {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 700,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    }),
  });

  if (!res.ok) {
    console.error("OpenAI API error", res.status);
    return { result: null, modelUsed: model };
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = json.choices?.[0]?.message?.content?.trim() || null;
  return {
    result: text,
    actualInputTokens: json.usage?.prompt_tokens,
    actualOutputTokens: json.usage?.completion_tokens,
    modelUsed: model,
  };
}

/**
 * Text generation with integrated Directive P2 cost metering & spending envelope enforcement.
 * When metering is requested, guarantees that denied reservations make ZERO provider calls,
 * and that provider timeouts strictly retain reservations to prevent double-spending in-flight compute.
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<string | null> {
  if (!opts.metering && !opts.byok) {
    throw new Error("callClaude requires mandatory metering context for all managed provider calls");
  }

  if (opts.metering) {
    const manager = opts.metering.meterManager ?? getDefaultCostMeteringManager();
    const promptLen = opts.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) + (opts.system?.length || 0);
    const estimatedPromptTokens = Math.max(1, Math.ceil(promptLen / 4));
    const estimatedCompletionTokens = opts.maxTokens ?? 700;
    const companyId = opts.metering.companyId || "rreal";

    // Align billed model with actual execution path:
    // BYOK users pay their own provider; managed Founders Beta uses llama-3.2-3b
    const modelKey = opts.metering.modelKey || "llama-3.2-3b";

    return await dispatchWithCostMetering(
      manager,
      companyId,
      opts.metering.accountId,
      modelKey,
      estimatedPromptTokens,
      estimatedCompletionTokens,
      1,
      async () => {
        const details = await executeProviderCallWithDetails(opts);
        const outLen = details.result?.length || 0;
        return {
          result: details.result,
          actualInputTokens: details.actualInputTokens ?? estimatedPromptTokens,
          actualOutputTokens: details.actualOutputTokens ?? Math.max(1, Math.ceil(outLen / 4)),
        };
      },
    );
  }

  throw new Error("callClaude requires mandatory metering context for all provider calls");
}
