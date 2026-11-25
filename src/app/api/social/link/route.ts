import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMember } from "@/lib/server-auth";
import { createProfile, linkUrl, socialConfigured } from "@/lib/social";

/** Returns a one-time secure URL where the learner connects their social accounts. */
export async function POST(req: Request) {
  if (!socialConfigured()) return NextResponse.json({ error: "Social connections aren't configured yet (Ayrshare keys missing)." }, { status: 503 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  const admin = getSupabaseAdmin();
  if (who.demo || !admin) return NextResponse.json({ error: "Requires the production database." }, { status: 501 });
  const uid = who.member.user.id;
  let { data } = await admin.from("social_connections").select("profile_key").eq("user_id", uid).maybeSingle();
  try {
    if (!data) {
      const p = await createProfile(`rreal-${uid}`);
      await admin.from("social_connections").insert({ user_id: uid, profile_key: p.profileKey });
      data = { profile_key: p.profileKey };
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const { url } = await linkUrl(data.profile_key, `${site}/connections?linked=1`);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
