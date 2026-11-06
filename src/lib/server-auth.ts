import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Per-feature monthly/daily allowances. At $1/month every paid AI call must be capped,
 * otherwise a single heavy user costs more than they pay. Tune with env vars.
 */
export const QUOTAS = {
  coach: { limit: Number(process.env.QUOTA_COACH_PER_DAY ?? 40), period: "day" },
  sandbox: { limit: Number(process.env.QUOTA_SANDBOX_PER_DAY ?? 25), period: "day" },
  course: { limit: Number(process.env.QUOTA_COURSES_PER_DAY ?? 5), period: "day" }, // abuse guard; each course also costs a $9.99 credit unless the member brings their own AI account
  playbook: { limit: Number(process.env.QUOTA_PLAYBOOKS_PER_MONTH ?? 5), period: "month" },
  video: { limit: Number(process.env.QUOTA_VIDEOS_PER_MONTH ?? 1), period: "month" },
  tts: { limit: Number(process.env.QUOTA_TTS_PER_DAY ?? 60), period: "day" },
  translate: { limit: Number(process.env.QUOTA_TRANSLATE_PER_DAY ?? 200), period: "day" },
  image: { limit: Number(process.env.QUOTA_IMAGES_PER_DAY ?? 10), period: "day" },
  social: { limit: Number(process.env.QUOTA_SOCIAL_POSTS_PER_DAY ?? 10), period: "day" },
} as const;
export type QuotaKind = keyof typeof QUOTAS;

export type Member = { sb: SupabaseClient; user: User; subscribed: boolean };

/**
 * Resolves the signed-in learner. In Demo mode (no Supabase) returns { demo: true }.
 * Returns a NextResponse to send back when the caller isn't allowed.
 */
export async function getMember(opts: { requireSubscription?: boolean } = {}): Promise<{ demo: true } | { demo: false; member: Member } | { error: NextResponse }> {
  const sb = await getSupabaseServer();
  if (!sb) return { demo: true };
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  const { data: sub } = await sb.from("subscriptions").select("status").eq("user_id", data.user.id).in("status", ["active", "trialing"]).limit(1).maybeSingle();
  const subscribed = !!sub;
  if (opts.requireSubscription && !subscribed) return { error: NextResponse.json({ error: "An active membership ($1/month) is required.", code: "subscription_required" }, { status: 402 }) };
  return { demo: false, member: { sb, user: data.user, subscribed } };
}

/** Like takeQuota but returns true/false instead of a response. */
export async function tryQuota(m: Member, kind: QuotaKind): Promise<boolean> {
  const q = QUOTAS[kind];
  const { data, error } = await m.sb.rpc("consume_quota", { p_kind: kind, p_limit: q.limit, p_period: q.period });
  return !error && !!data;
}

/** Spends one credit from the learner's wallet. */
export async function spendCredit(m: Member, kind: "video" | "course", ref: string): Promise<boolean> {
  const { data, error } = await m.sb.rpc("spend_credit", { p_kind: kind, p_ref: ref });
  return !error && !!data;
}

/** Gives a credit back after a failed generation (service role). */
export async function refundCredit(userId: string, kind: "video" | "course", ref: string) {
  const { getSupabaseAdmin } = await import("@/lib/supabase/server");
  await getSupabaseAdmin()?.rpc("grant_credits", { p_user: userId, p_kind: kind, p_qty: 1, p_reason: "refund", p_ref: `refund:${ref}` });
}

/** Consumes one unit of the learner's quota. Returns an error response when exhausted. */
export async function takeQuota(m: Member, kind: QuotaKind): Promise<NextResponse | null> {
  const q = QUOTAS[kind];
  const { data, error } = await m.sb.rpc("consume_quota", { p_kind: kind, p_limit: q.limit, p_period: q.period });
  if (error) return NextResponse.json({ error: "Usage check failed. Try again." }, { status: 500 });
  if (!data) return NextResponse.json({ error: `You've reached your ${q.period === "day" ? "daily" : "monthly"} limit for this feature (${q.limit}). It resets ${q.period === "day" ? "tomorrow" : "next month"}.`, code: "quota" }, { status: 429 });
  return null;
}
