import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Published community courses + the signed-in learner's own AI-generated courses. */
export async function GET() {
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ demo: true, courses: [] });
  const { data: auth } = await sb.auth.getUser();
  let q = sb.from("custom_courses").select("id, status, owner_id, content").order("created_at", { ascending: false }).limit(200);
  q = auth.user ? q.or(`status.eq.published,owner_id.eq.${auth.user.id}`) : q.eq("status", "published");
  const { data } = await q;
  return NextResponse.json({
    courses: (data ?? []).map((c) => ({ ...(c.content as object), kind: "custom", status: c.status, mine: c.owner_id === auth.user?.id })),
  });
}
