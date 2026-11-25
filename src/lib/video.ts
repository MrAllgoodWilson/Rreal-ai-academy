import "server-only";

/**
 * AI video generation via Replicate (one API key, many state-of-the-art video models).
 * Choose the model with REPLICATE_VIDEO_MODEL (owner/name), e.g. "minimax/video-01", "kwaivgi/kling-v2.1",
 * "google/veo-3", "luma/ray". Extra model inputs (aspect ratio, duration…) go in REPLICATE_VIDEO_INPUT (JSON).
 */
const API = "https://api.replicate.com/v1";
export const videoConfigured = (token?: string) => Boolean(token || process.env.REPLICATE_API_TOKEN);
const model = () => process.env.REPLICATE_VIDEO_MODEL || "minimax/video-01";

function headers(token?: string) {
  return { authorization: `Bearer ${token || process.env.REPLICATE_API_TOKEN}`, "content-type": "application/json" };
}

export async function startVideo(prompt: string, token?: string): Promise<{ id: string } | { error: string }> {
  let extra: Record<string, unknown> = {};
  try {
    extra = JSON.parse(process.env.REPLICATE_VIDEO_INPUT || "{}");
  } catch {}
  const res = await fetch(`${API}/models/${model()}/predictions`, { method: "POST", headers: headers(token), body: JSON.stringify({ input: { prompt, ...extra } }) });
  const json = (await res.json().catch(() => ({}))) as { id?: string; detail?: string };
  if (!res.ok || !json.id) return { error: json.detail || `Video provider error (${res.status})` };
  return { id: json.id };
}

export async function getVideo(id: string, token?: string): Promise<{ status: "queued" | "processing" | "succeeded" | "failed"; url?: string; error?: string }> {
  const res = await fetch(`${API}/predictions/${encodeURIComponent(id)}`, { headers: headers(token), cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { status?: string; output?: unknown; error?: string };
  const output = Array.isArray(json.output) ? json.output.find((x) => typeof x === "string") : typeof json.output === "string" ? json.output : undefined;
  switch (json.status) {
    case "succeeded":
      return output ? { status: "succeeded", url: output as string } : { status: "failed", error: "No video returned" };
    case "failed":
    case "canceled":
      return { status: "failed", error: json.error || "Generation failed" };
    case "processing":
      return { status: "processing" };
    default:
      return { status: "queued" };
  }
}
