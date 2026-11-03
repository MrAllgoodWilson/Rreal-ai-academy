import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: full learner state (account, progress, subscription) from Supabase. PUT: save non-authoritative UI state. */
export async function GET() {
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Not configured" }, { status: 501 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = auth.user.id;

  const [profile, lessons, badges, certs, xp, sub, state] = await Promise.all([
    sb.from("profiles").select("*").eq("id", uid).single(),
    sb.from("lesson_progress").select("lesson_id, score, perfect, completed_at").eq("user_id", uid),
    sb.from("user_badges").select("badge_id, earned_at").eq("user_id", uid),
    sb.from("certificates").select("*").eq("user_id", uid).is("revoked_at", null),
    sb.from("xp_events").select("amount, created_at").eq("user_id", uid).gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
    sb.from("subscriptions").select("status, plan, trial_ends_at").eq("user_id", uid).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("user_state").select("state").eq("user_id", uid).maybeSingle(),
  ]);
  const p = profile.data;
  if (!p) return NextResponse.json({ error: "Profile missing" }, { status: 404 });

  const xpByDay: Record<string, number> = {};
  for (const e of xp.data ?? []) {
    const k = String(e.created_at).slice(0, 10);
    xpByDay[k] = (xpByDay[k] ?? 0) + e.amount;
  }
  const extra = (state.data?.state ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    account: { id: uid, email: auth.user.email, username: p.username, displayName: p.display_name, avatar: p.avatar, createdAt: p.created_at },
    subscription: sub.data ? { status: sub.data.status, plan: sub.data.plan, trialEndsAt: sub.data.trial_ends_at } : { status: "none" },
    progress: {
      ...extra,
      xp: p.xp,
      streak: { current: p.streak_current, longest: p.streak_longest, lastActive: p.last_active_date, freezes: p.streak_freezes },
      completed: Object.fromEntries((lessons.data ?? []).map((l) => [l.lesson_id, { at: l.completed_at, score: l.score, perfect: l.perfect }])),
      badges: { ...((extra.badges as Record<string, string>) ?? {}), ...Object.fromEntries((badges.data ?? []).map((b) => [b.badge_id, b.earned_at])) },
      certificates: (certs.data ?? []).map((c) => ({ token: c.token, code: c.credential_code, title: c.title ?? c.credential_code, trackId: c.track_id, name: c.recipient_name, issuedAt: c.issued_at, score: c.score })),
      xpByDay,
    },
  });
}

const Put = z.object({ state: z.record(z.unknown()) });

export async function PUT(req: Request) {
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Not configured" }, { status: 501 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Put.safeParse(await req.json().catch(() => null));
  if (!parsed.success || JSON.stringify(parsed.data.state).length > 200_000) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { xp, completed, streak, certificates, xpByDay, ...safe } = parsed.data.state; // never accept authoritative fields from the client
  void xp; void completed; void streak; void certificates; void xpByDay;
  await sb.from("user_state").upsert({ user_id: auth.user.id, state: safe, updated_at: new Date().toISOString() });
  // Badges are re-derivable from authoritative stats; persist the earned set for display
  const badges = (safe.badges ?? {}) as Record<string, string>;
  const rows = Object.entries(badges).map(([badge_id, earned_at]) => ({ user_id: auth.user!.id, badge_id, earned_at }));
  if (rows.length) await sb.from("user_badges").upsert(rows, { onConflict: "user_id,badge_id", ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}
