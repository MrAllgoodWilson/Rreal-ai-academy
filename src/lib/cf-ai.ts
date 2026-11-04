import "server-only";

/**
 * Cloudflare Workers AI fallback (no third-party API key needed).
 * Uses the `AI` binding declared in wrangler.jsonc; usage is billed to the Cloudflare account.
 * Every function returns null when the binding is unavailable (local `next dev`, tests), so callers degrade gracefully.
 */

type AiBinding = { run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown> };

export const CF_TEXT_MODEL = () => process.env.WORKERS_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const CF_TTS_MODEL = "@cf/myshell-ai/melotts";

export async function getAi(): Promise<AiBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as unknown as { AI?: AiBinding }).AI;
    return ai && typeof ai.run === "function" ? ai : null;
  } catch {
    return null;
  }
}

/** Pulls the text out of the different response shapes Workers AI / AI Gateway models return. */
export function extractText(out: unknown): string | null {
  if (!out) return null;
  if (typeof out === "string") return out.trim() || null;
  const o = out as Record<string, unknown>;
  if (typeof o.response === "string") return o.response.trim() || null;
  if (o.response && typeof o.response === "object") return JSON.stringify(o.response);
  const choice = (o.choices as { message?: { content?: unknown } }[] | undefined)?.[0]?.message?.content;
  if (typeof choice === "string") return choice.trim() || null;
  const content = o.content as { type?: string; text?: string }[] | undefined;
  if (Array.isArray(content)) return content.filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n").trim() || null;
  return null;
}

type Msg = { role: "user" | "assistant"; content: string };

export async function cfText(opts: { system: string; messages: Msg[]; maxTokens?: number }): Promise<string | null> {
  const ai = await getAi();
  if (!ai) return null;
  const maxTokens = opts.maxTokens ?? 700;

  // Optional: real Claude through AI Gateway Unified Billing (credits loaded in the Cloudflare dashboard, no Anthropic key).
  const gateway = process.env.AI_GATEWAY_ID;
  const gatewayModel = process.env.AI_GATEWAY_MODEL;
  if (gateway && gatewayModel) {
    try {
      const out = await ai.run(gatewayModel, { system: opts.system, messages: opts.messages, max_tokens: maxTokens }, { gateway: { id: gateway } });
      const text = extractText(out);
      if (text) return text;
    } catch (e) {
      console.error("AI Gateway model failed, falling back to Workers AI", gatewayModel, e);
    }
  }

  try {
    const out = await ai.run(CF_TEXT_MODEL(), { messages: [{ role: "system", content: opts.system }, ...opts.messages], max_tokens: maxTokens });
    return extractText(out);
  } catch (e) {
    console.error("Workers AI text error", e);
    return null;
  }
}

/** MeloTTS speech (English + Spanish). Returns audio bytes (WAV or MP3, sniff the header) or null. */
export async function cfSpeech(text: string, lang: "en" | "es"): Promise<Uint8Array | null> {
  const ai = await getAi();
  if (!ai) return null;
  try {
    const out = await ai.run(CF_TTS_MODEL, { prompt: text, lang });
    if (out instanceof Uint8Array) return out;
    if (out instanceof ArrayBuffer) return new Uint8Array(out);
    if (out instanceof ReadableStream) return new Uint8Array(await new Response(out).arrayBuffer());
    const audio = (out as { audio?: string } | null)?.audio;
    if (typeof audio === "string") return Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
    return null;
  } catch (e) {
    console.error("Workers AI speech error", e);
    return null;
  }
}

/** True when the Workers AI binding is present in this runtime. */
export async function cfAiAvailable() {
  return Boolean(await getAi());
}

export const CF_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** Flux image generation (flyers, thumbnails, logos). Returns base64 JPEG or null. */
export async function cfImage(prompt: string): Promise<string | null> {
  const ai = await getAi();
  if (!ai) return null;
  try {
    const out = (await ai.run(CF_IMAGE_MODEL, { prompt, steps: 6 })) as { image?: string } | null;
    return typeof out?.image === "string" ? out.image : null;
  } catch (e) {
    console.error("Workers AI image error", e);
    return null;
  }
}
