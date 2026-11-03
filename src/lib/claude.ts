import "server-only";

/** Minimal Claude Messages API client (server-only). Returns null when no key is configured. */
export async function callClaude(opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number }): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
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
    return null;
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return json.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim() || null;
}
