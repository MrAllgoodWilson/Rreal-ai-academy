import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Aggregate visit count only. A visit is not a signup, payment, human-identity proof or reward. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (process.env.REFERRALS_ENABLED !== "true") return NextResponse.json({ error: "Referral launch is being prepared." }, { status: 503 });
  const { code } = await params;
  if (!/^[a-f0-9]{32}$/.test(code)) return NextResponse.json({ error: "Referral link not found." }, { status: 404 });
  if (!rateLimit(`ref-visit:${clientIp(req)}`, 20, 60_000).ok) return NextResponse.json({ error: "Please retry later." }, { status: 429 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Referral links are temporarily unavailable." }, { status: 503 });
  const { data, error } = await admin.rpc("referral_track_visit", { p_code: code });
  if (error) return NextResponse.json({ error: "Referral links are temporarily unavailable." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Referral link not found." }, { status: 404 });
  const url = new URL("/signup", process.env.NEXT_PUBLIC_SITE_URL || "https://rrealaiacademy.app");
  url.searchParams.set("ref", code);
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, no-store", "referrer-policy": "same-origin" } });
}
