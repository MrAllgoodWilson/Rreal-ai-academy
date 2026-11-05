import { NextResponse } from "next/server";
import { getMember } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { processReferralPaymentEvent } from "@/lib/referrals-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Deliberate admin retry after missing verification prerequisites are fixed; no browser payment success data is trusted. */
export async function POST(req: Request) {
  if (process.env.REFERRALS_ENABLED !== "true") return NextResponse.json({ error: "Referrals are disabled." }, { status: 503 });
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://rrealaiacademy.app").origin;
  if (req.headers.get("origin") !== site) return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
  const who = await getMember();
  if ("error" in who) return who.error;
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (who.demo || !who.member.user.email || !allowed.includes(who.member.user.email.toLowerCase())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!rateLimit(`ref-reconcile:${clientIp(req)}`, 2, 60_000).ok) return NextResponse.json({ error: "Please retry later." }, { status: 429 });
  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  if (!stripe || !admin) return NextResponse.json({ error: "Verified provider access is not configured." }, { status: 503 });
  const { data, error } = await admin.from("referral_reconciliation").select("event_id").eq("state", "pending").order("updated_at", { ascending: true }).limit(20);
  if (error) return NextResponse.json({ error: "Reconciliation queue could not be read." }, { status: 503 });
  let attempted = 0;
  let failures = 0;
  for (const row of data || []) {
    try {
      const event = await stripe.events.retrieve(row.event_id);
      await processReferralPaymentEvent(event, admin, stripe);
      attempted++;
    } catch { failures++; }
  }
  // Attempted does NOT mean qualified/credited. A corrected receipt may still be excluded or pending proof.
  return NextResponse.json({ attempted, failures, note: "Check the private reconciliation state and reward ledger for actual outcomes." }, { headers: { "cache-control": "private, no-store" } });
}
