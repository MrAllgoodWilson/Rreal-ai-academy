import "server-only";
import { cfText } from "@/lib/cf-ai";
import type { Byok } from "@/lib/byok-server";
import {
  CostMeteringManager,
  dispatchWithCostMetering,
  MemoryFoundersCostStore,
  CompanyId,
} from "@/lib/founders";

let defaultManager: CostMeteringManager | null = null;
export function getDefaultCostMeteringManager(): CostMeteringManager {
  if (!defaultManager) {
    defaultManager = new CostMeteringManager(new MemoryFoundersCostStore());
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

/** Internal provider execution logic */
export async function executeProviderCall(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  byok?: Byok;
}): Promise<string | null> {
  if (opts.byok?.openai && !opts.byok.anthropic) return callOpenAI(opts.byok.openai, opts);
  const key = opts.byok?.anthropic || process.env.ANTHROPIC_API_KEY;
  if (!key) return cfText(opts);
  const own = Boolean(opts.byok?.anthropic);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: opts.maxTokens ?? 700,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    console.error("Claude API error", res.status);
    return own ? null : cfText(opts);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return json.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim() || null;
}

/** OpenAI Chat Completions with a member's own key. */
async function callOpenAI(key: string, opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number }): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", max_tokens: opts.maxTokens ?? 700, messages: [{ role: "system", content: opts.system }, ...opts.messages] }),
  });
  if (!res.ok) {
    console.error("OpenAI API error", res.status);
    return null;
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * Text generation with integrated Directive P2 cost metering & spending envelope enforcement.
 * When metering is requested, guarantees that denied reservations make ZERO provider calls,
 * and that provider timeouts strictly retain reservations to prevent double-spending in-flight compute.
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<string | null> {
  if (opts.metering) {
    const manager = opts.metering.meterManager ?? getDefaultCostMeteringManager();
    const promptLen = opts.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) + (opts.system?.length || 0);
    const estimatedPromptTokens = Math.max(1, Math.ceil(promptLen / 4));
    const estimatedCompletionTokens = opts.maxTokens ?? 700;
    const companyId = opts.metering.companyId || "rreal";
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
        const result = await executeProviderCall(opts);
        const outLen = result?.length || 0;
        return {
          result,
          actualInputTokens: estimatedPromptTokens,
          actualOutputTokens: Math.max(1, Math.ceil(outLen / 4)),
        };
      },
    );
  }

  return await executeProviderCall(opts);
}
