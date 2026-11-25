"use client";

/**
 * Bring-your-own-account keys. Members can plug in their own Claude, ChatGPT, ElevenLabs and Replicate accounts.
 * Keys live ONLY in this browser (localStorage) and are sent per request over HTTPS; the server never stores them.
 */
export type ByokProvider = "anthropic" | "openai" | "elevenlabs" | "replicate";
export const BYOK_PROVIDERS: { id: ByokProvider; name: string; url: string; hint: string; unlocks: string }[] = [
  { id: "anthropic", name: "Claude (Anthropic)", url: "https://console.anthropic.com/settings/keys", hint: "sk-ant-…", unlocks: "Claude-powered Coach, Sandbox, course and playbook builder (no course credit needed)" },
  { id: "openai", name: "ChatGPT (OpenAI)", url: "https://platform.openai.com/api-keys", hint: "sk-…", unlocks: "GPT-powered Coach, Sandbox, course and playbook builder (no course credit needed)" },
  { id: "elevenlabs", name: "ElevenLabs", url: "https://elevenlabs.io/app/settings/api-keys", hint: "sk_…", unlocks: "All 12 premium coach voices" },
  { id: "replicate", name: "Replicate", url: "https://replicate.com/account/api-tokens", hint: "r8_…", unlocks: "Unlimited AI video renders billed to your account (no video credits needed)" },
];

const KEY = "rreal.byok.v1";

export function getByok(): Partial<Record<ByokProvider, string>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function setByok(provider: ByokProvider, value: string) {
  try {
    const all = getByok();
    if (value.trim()) all[provider] = value.trim();
    else delete all[provider];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

/** JSON headers plus any keys the member has connected. */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", ...extra };
  if (typeof window === "undefined") return h;
  for (const [p, v] of Object.entries(getByok())) if (v) h[`x-byok-${p}`] = v;
  return h;
}
