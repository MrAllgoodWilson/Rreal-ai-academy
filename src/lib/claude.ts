import "server-only";
import { cfText } from "@/lib/cf-ai";

/**
 * Text generation (server-only). Order: Claude API (ANTHROPIC_API_KEY) → Cloudflare Workers AI binding → null (offline fallback).
 */
export async function callClaude(opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number }): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return cfText(opts);
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
    console.error("Claude API error", res.status, await res.text().catch(() => ""));
    return cfText(opts);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return json.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim() || null;
}
