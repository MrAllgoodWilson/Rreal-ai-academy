import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMember, takeQuota } from "@/lib/server-auth";
import { PLATFORMS, publish, socialConfigured } from "@/lib/social";

const Body = z.object({
  post: z.string().trim().min(1).max(2200),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  mediaUrl: z.string().url().startsWith("https://").optional(),
  scheduleDate: z.string().datetime().optional(),
});

/** Publishes (or schedules) a post to the learner's connected social accounts. */
export async function POST(req: Request) {
  if (!socialConfigured()) return NextResponse.json({ error: "Social posting isn't configured yet." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write your post and pick at least one platform." }, { status: 400 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  const admin = getSupabaseAdmin();
  if (who.demo || !admin) return NextResponse.json({ error: "Requires the production database." }, { status: 501 });
  const limited = await takeQuota(who.member, "social");
  if (limited) return limited;
  const { data } = await admin.from("social_connections").select("profile_key").eq("user_id", who.member.user.id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Connect your social accounts first." }, { status: 400 });
  try {
    const r = await publish(data.profile_key, { post: parsed.data.post, platforms: parsed.data.platforms, mediaUrls: parsed.data.mediaUrl ? [parsed.data.mediaUrl] : undefined, scheduleDate: parsed.data.scheduleDate });
    await admin.from("social_posts").insert({ user_id: who.member.user.id, platforms: parsed.data.platforms, body: parsed.data.post, media_url: parsed.data.mediaUrl ?? null, scheduled_at: parsed.data.scheduleDate ?? null, provider_id: r.id ?? null, status: r.status ?? "submitted" });
    return NextResponse.json({ ok: true, status: r.status ?? "submitted" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
