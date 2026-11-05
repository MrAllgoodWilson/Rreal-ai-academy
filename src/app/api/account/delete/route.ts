import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Permanently deletes the signed-in member's account and learning data (profile, progress, certificates, credits, private courses).
 * Safeguards:
 *  - the member must type DELETE;
 *  - an active membership must be cancelled first, otherwise Stripe would keep billing a deleted account;
 *  - courses the member published for everyone are handed to the academy admin so other learners don't lose them or their progress.
 */
export async function POST(req: Request) {
  if (!rateLimit(`acct-del:${clientIp(req)}`, 5, 60 * 60_000).ok) return NextResponse.json({ error: "Please try again later." }, { status: 429 });
  const parsed = z.object({ confirm: z.literal("DELETE") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ error: "Demo mode keeps data in this browser only. Use Reset progress." }, { status: 501 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Account deletion isn't available right now. Email support@rrealaiacademy.app." }, { status: 503 });
  const { sb, user } = who.member;

  // Fail closed: if a safety lookup errors, delete nothing (otherwise a DB/RLS hiccup could bypass the billing or course safeguards).
  const unavailable = () => NextResponse.json({ error: "We couldn't verify your account just now, so nothing was deleted. Please try again in a minute or email support@rrealaiacademy.app." }, { status: 503 });
  const { data: live, error: subErr } = await sb.from("subscriptions").select("status").eq("user_id", user.id).in("status", ["active", "trialing", "past_due"]).limit(1).maybeSingle();
  if (subErr) return unavailable();
  if (live) return NextResponse.json({ error: "Please cancel your membership first (Settings → Plan & billing), or email support@rrealaiacademy.app and we'll cancel and delete for you.", code: "cancel_first" }, { status: 409 });

  const { data: published, error: pubErr } = await admin.from("custom_courses").select("id").eq("owner_id", user.id).eq("status", "published");
  if (pubErr) return unavailable();
  if (published?.length) {
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) return unavailable();
    const owner = list?.users.find((u) => u.id !== user.id && u.email && adminEmails.includes(u.email.toLowerCase()));
    if (!owner) return NextResponse.json({ error: "You've published courses for everyone. Please email support@rrealaiacademy.app so we can hand them over before deleting.", code: "contact_support" }, { status: 409 });
    const ids = published.map((c) => c.id);
    const [a, b] = await Promise.all([admin.from("custom_courses").update({ owner_id: owner.id }).in("id", ids), admin.from("tracks").update({ owner_id: owner.id }).in("id", ids)]);
    if (a.error || b.error) return NextResponse.json({ error: "Couldn't hand over your published courses. Nothing was deleted. Email support@rrealaiacademy.app." }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Couldn't delete your account. Nothing was lost. Please try again or email support@rrealaiacademy.app." }, { status: 500 });
  await sb.auth.signOut().catch(() => null);
  return NextResponse.json({ ok: true });
}
