import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMember } from "@/lib/server-auth";
import { linkedAccounts, socialConfigured } from "@/lib/social";

export const dynamic = "force-dynamic";

/** Which social accounts the learner has connected. */
export async function GET() {
  if (!socialConfigured()) return NextResponse.json({ configured: false, platforms: [] });
  const who = await getMember();
  if ("error" in who) return who.error;
  const admin = getSupabaseAdmin();
  if (who.demo || !admin) return NextResponse.json({ configured: false, platforms: [] });
  const { data } = await admin.from("social_connections").select("profile_key").eq("user_id", who.member.user.id).maybeSingle();
  if (!data) return NextResponse.json({ configured: true, platforms: [] });
  const platforms = await linkedAccounts(data.profile_key).catch(() => []);
  await admin.from("social_connections").update({ linked_platforms: platforms, updated_at: new Date().toISOString() }).eq("user_id", who.member.user.id);
  return NextResponse.json({ configured: true, platforms });
}
