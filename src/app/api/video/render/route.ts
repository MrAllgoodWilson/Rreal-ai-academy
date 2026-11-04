import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember, tryQuota, spendCredit, refundCredit } from "@/lib/server-auth";
import { randomBytes } from "node:crypto";
import { startVideo, videoConfigured } from "@/lib/video";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Starts a real AI video render for a scene prompt. Poll GET /api/video/[id] for the result. */
export async function POST(req: Request) {
  if (!rateLimit(`vid:${clientIp(req)}`, 5, 60_000).ok) return NextResponse.json({ error: "Please wait a minute." }, { status: 429 });
  const parsed = z.object({ prompt: z.string().trim().min(10).max(1500) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Describe the scene (at least a sentence)." }, { status: 400 });
  if (!videoConfigured()) return NextResponse.json({ error: "AI video rendering isn't configured yet (missing REPLICATE_API_TOKEN)." }, { status: 503 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ error: "AI video rendering requires the production database." }, { status: 501 });
  // 1 free render per month is included; after that each render uses a video credit.
  const spendRef = `video:${randomBytes(8).toString("hex")}`;
  let usedCredit = false;
  if (!(await tryQuota(who.member, "video"))) {
    usedCredit = await spendCredit(who.member, "video", spendRef);
    if (!usedCredit) return NextResponse.json({ error: "You've used your free AI video this month. Grab a credit pack to keep rendering.", code: "credits_required", kind: "video" }, { status: 402 });
  }

  const job = await startVideo(parsed.data.prompt);
  if ("error" in job) {
    if (usedCredit) await refundCredit(who.member.user.id, "video", spendRef);
    return NextResponse.json({ error: job.error }, { status: 502 });
  }
  const { data, error } = await who.member.sb.from("video_renders").insert({ user_id: who.member.user.id, provider: "replicate", provider_job_id: job.id, prompt: parsed.data.prompt, status: "queued" }).select("id").single();
  if (error) return NextResponse.json({ error: "Couldn't save the render." }, { status: 500 });
  return NextResponse.json({ id: data.id, status: "queued" });
}

/** Learner's recent renders. */
export async function GET() {
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ renders: [] });
  const { data } = await who.member.sb.from("video_renders").select("id, prompt, status, output_url, error, created_at").order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ renders: data ?? [] });
}
