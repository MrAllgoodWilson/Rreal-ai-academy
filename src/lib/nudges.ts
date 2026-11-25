import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_LESSONS, getLessonRef } from "@/lib/curriculum";
import { emailLayout, sendEmail } from "@/lib/email";

const secret = () => process.env.NUDGE_SECRET || process.env.CERT_SIGNING_SECRET || "";

/** Signed token for one-click unsubscribe links (no login needed). */
export function unsubscribeToken(userId: string) {
  return createHmac("sha256", secret()).update(`nudge-unsub:${userId}`).digest("base64url").slice(0, 32);
}
export function verifyUnsubscribe(userId: string, token: string) {
  if (!secret()) return false;
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The lesson that comes after `lastId` (same course, or next program lesson), if any. */
export function nextAfter(lastId: string | null) {
  const ref = lastId ? getLessonRef(lastId) : undefined;
  if (!ref) return undefined;
  const siblings = ref.track.kind === "program" ? ALL_LESSONS.filter((r) => r.track.kind === "program") : ALL_LESSONS.filter((r) => r.track.id === ref.track.id);
  const i = siblings.findIndex((r) => r.lesson.id === lastId);
  return siblings[i + 1];
}

export function nudgeEmail(name: string, lastId: string | null, site: string, userId: string) {
  const next = nextAfter(lastId);
  const last = lastId ? getLessonRef(lastId) : undefined;
  const href = next ? `${site}/lesson/${next.lesson.id}` : `${site}/dashboard`;
  const unsub = `${site}/api/nudges/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
  const first = esc(name.split(" ")[0] || "there");
  const subject = next ? `Your next lesson is ready: ${next.lesson.title}` : "Your Rreal AI Academy dashboard misses you";
  const body = `<p>Hi ${first},</p>
<p>${last ? `Last time you finished <strong>${esc(last.lesson.title)}</strong> in ${esc(last.track.name)}. Nice work!` : "Your learning path is waiting for you."}
${next ? ` Next up is <strong>${esc(next.lesson.title)}</strong>. It takes about ${next.lesson.minutes} minutes.` : ""}</p>
<p>No rush. Small steps add up, and your progress is saved right where you left it.</p>
<p><a href="${href}" style="display:inline-block;background:#22d3ee;color:#070912;font-weight:bold;padding:12px 20px;border-radius:12px;text-decoration:none">${next ? "Continue my lesson" : "Open my dashboard"}</a></p>
<p style="color:#9aa4c7">¿Prefieres español? Cambia el idioma con el botón ES dentro de la app.</p>
<p style="font-size:13px;color:#7f8ab3">Need help? Just reply to this email. Don't want reminders? <a href="${unsub}" style="color:#7f8ab3">Turn them off in one click</a>.</p>`;
  return { subject, html: emailLayout(next ? "Ready when you are" : "We saved your spot", body) };
}

/** Sends one nudge to each eligible member. Returns counts; never throws. */
export async function runNudges(admin: SupabaseClient, site: string, limit = 200) {
  const { data, error } = await admin.rpc("nudge_candidates", { p_limit: limit });
  if (error) return { candidates: 0, sent: 0, error: error.message };
  const rows = (data ?? []) as { user_id: string; email: string; display_name: string; last_lesson_id: string | null }[];
  const sentIds: string[] = [];
  for (const r of rows) {
    const { subject, html } = nudgeEmail(r.display_name, r.last_lesson_id, site, r.user_id);
    if (await sendEmail(r.email, subject, html).catch(() => false)) sentIds.push(r.user_id);
  }
  if (sentIds.length) await admin.rpc("mark_nudged", { p_ids: sentIds });
  return { candidates: rows.length, sent: sentIds.length };
}
