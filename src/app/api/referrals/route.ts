import { sameOriginRequest } from "@/lib/same-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { getMember } from "@/lib/server-auth";
import { referralUrl, type ReferralDashboard } from "@/lib/referrals";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET() {
  if (process.env.REFERRALS_ENABLED !== "true") return NextResponse.json({ error: "Referral launch is being prepared." }, { status: 503 });
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ error: "Referral payments require a real membership." }, { status: 503 });
  const { error: redemptionError } = await who.member.sb.rpc("referral_credit_own_rewards");
  if (redemptionError) return NextResponse.json({ error: "Referral reward reconciliation is temporarily unavailable." }, { status: 503 });
  const { data, error } = await who.member.sb.rpc("referral_dashboard");
  if (error) return NextResponse.json({ error: "Referral status could not be loaded." }, { status: 503 });
  const dashboard = data as ReferralDashboard;
  if (!dashboard.eligible || !dashboard.code) return NextResponse.json(dashboard, { headers: { "cache-control": "private, no-store" } });
  const url = referralUrl(process.env.NEXT_PUBLIC_SITE_URL || "https://rrealaiacademy.app", dashboard.code);
  // Generated locally; no tracking/QR vendor receives the link or member identity.
  const qr = await QRCode.toDataURL(url, { width: 240, margin: 2 });
  return NextResponse.json({ ...dashboard, url, qr }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
  if (process.env.REFERRALS_ENABLED !== "true") return NextResponse.json({ error: "Referral launch is being prepared." }, { status: 503 });
  if (!rateLimit(`referral:${clientIp(req)}`, 10, 60_000).ok) return NextResponse.json({ error: "Try again later." }, { status: 429 });
  const parsed = z.discriminatedUnion("action", [
    z.object({ action: z.literal("attribute"), code: z.string().regex(/^[a-f0-9]{32}$/) }),
    z.object({ action: z.literal("acknowledge"), rewardId: z.string().uuid() }),
  ]).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid referral request." }, { status: 400 });
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ error: "Referral payments require a real membership." }, { status: 503 });
  const { data, error } = parsed.data.action === "attribute"
    ? await who.member.sb.rpc("referral_attribute", { p_code: parsed.data.code })
    : await who.member.sb.rpc("referral_acknowledge", { p_reward: parsed.data.rewardId });
  if (error) return NextResponse.json({ error: "Referral update failed. Please retry." }, { status: 503 });
  return NextResponse.json({ ok: data === true });
}
