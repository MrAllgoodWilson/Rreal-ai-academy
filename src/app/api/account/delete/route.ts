import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { durableLimit, edgeAddress } from "@/lib/durable-limit";
import { closeFoundersAccount } from "@/lib/founders-closure";

/**
 * Permanently deletes the signed-in member's account and learning data (profile, progress, certificates, credits, private courses).
 * Safeguards:
 *  - the member must type DELETE;
 *  - an active membership must be cancelled first, otherwise Stripe would keep billing a deleted account;
 *  - courses the member published for everyone are handed to the academy admin so other learners don't lose them or their progress.
 */
export async function POST(req: Request) {
  const lim1 = await durableLimit("acct-del", edgeAddress(req), 5, 60 * 60_000);
  if (lim1 !== "ok") return lim1 === "limited" ? NextResponse.json({ error: "Please try again later." }, { status: 429 }) : NextResponse.json({ error: "Temporarily unavailable. Please try again shortly." }, { status: 503 });
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
  const { data: live, error: subErr } = await sb.from("subscriptions").select("status").eq("user_id", user.id).in("status", ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]).limit(1).maybeSingle();
  if (subErr) return unavailable();
  if (live) return NextResponse.json({ error: "Please cancel your membership first (Settings → Plan & billing), or email support@rrealaiacademy.app and we'll cancel and delete for you.", code: "cancel_first" }, { status: 409 });

  // Funded feature history must be reconciled before profile deletion. Disabled
  // deployments must not query a migration that has not been released yet.
  if (process.env.PROJECT_WALLET_ENABLED === "true") {
    const { data: closure, error: closureError } = await admin.rpc("project_wallet_account_closure_status", { p_user: user.id });
    if (closureError || !closure || typeof closure.blocked !== "boolean") return unavailable();
    if (closure.blocked) return NextResponse.json({ error: "Your feature allowances or usage history need account-closure reconciliation. Please contact support@rrealaiacademy.app before deleting. Nothing was deleted.", code: "feature_history_requires_reconciliation" }, { status: 409 });
  }

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

  // Founders policy: closing the original account permanently forfeits the Founders rate. Record that (forfeiture,
  // canceled enrollment, audit entry, hashed e-mail tombstone) BEFORE anything is destroyed. If Founders storage is
  // configured but unavailable, delete nothing.
  let closure: "closed" | "not_configured";
  try {
    closure = await closeFoundersAccount(user.id, user.email);
  } catch (e) {
    console.error("Account closure record failed", e instanceof Error ? e.name : "unknown");
    return unavailable();
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    // The closure record above is permanent by policy; say so rather than claiming nothing changed.
    const note = closure === "closed" ? " Any Founders rate on this account has already been closed and can't be restored." : "";
    return NextResponse.json({ error: `Couldn't delete your account. Your learning data is intact.${note} Please try again or email support@rrealaiacademy.app.` }, { status: 500 });
  }
  await sb.auth.signOut().catch(() => null);
  return NextResponse.json({ ok: true });
}
