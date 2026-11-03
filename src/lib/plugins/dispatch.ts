import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PluginEvent = "lesson.completed" | "certificate.issued" | "video.rendered" | "course.created";

/** Only well-known automation hosts (plus explicit custom https webhooks) — prevents SSRF to internal addresses. */
const HOSTS: Record<string, RegExp> = {
  zapier: /^hooks\.zapier\.com$/,
  make: /^hook\.[a-z0-9-]+\.make\.com$/,
  slack: /^hooks\.slack\.com$/,
  discord: /^(discord|discordapp)\.com$/,
  webhook: /^(?!localhost$)(?!.*\.(local|internal)$)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9.-]+\.[a-z]{2,}$/i,
};

export function validPluginUrl(kind: string, raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
    const re = HOSTS[kind];
    return !!re && re.test(u.hostname);
  } catch {
    return false;
  }
}

function format(kind: string, event: PluginEvent, data: Record<string, unknown>) {
  const text = `Rreal AI Academy · ${event}: ${data.title ?? ""}`.trim();
  if (kind === "slack") return { text };
  if (kind === "discord") return { content: text };
  return { event, data, sent_at: new Date().toISOString() };
}

/** Fire-and-forget delivery to the learner's enabled plugins. Never throws. */
export async function dispatchPluginEvent(sb: SupabaseClient, userId: string, event: PluginEvent, data: Record<string, unknown>) {
  try {
    const { data: rows } = await sb.from("user_plugins").select("kind, url, events").eq("user_id", userId).eq("enabled", true);
    await Promise.allSettled(
      (rows ?? [])
        .filter((r) => (r.events as string[]).includes(event) && validPluginUrl(r.kind, r.url))
        .map((r) => fetch(r.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(format(r.kind, event, data)), signal: AbortSignal.timeout(5000), redirect: "error" })),
    );
  } catch {
    /* plugins must never break the main flow */
  }
}
