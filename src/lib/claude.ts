import "server-only";
import { cfText } from "@/lib/cf-ai";
import type { Byok } from "@/lib/byok-server";

/**
 * Text generation (server-only). Order: the member's own Claude/OpenAI key (BYOK) → Claude API (ANTHROPIC_API_KEY)
 * → Cloudflare Workers AI binding → null (offline fallback).
 */
export async function callClaude(opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number; byok?: Byok }): Promise<string | null> {
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
