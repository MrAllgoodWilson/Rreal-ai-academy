import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Weekly league leaderboard (opt-in profiles only; see leaderboard_weekly() in the migration). */
export async function GET() {
  const sb = await getSupabaseServer();
  if (!sb) return NextResponse.json({ demo: true, rows: [] });
  const { data, error } = await sb.rpc("leaderboard_weekly", { p_limit: 50 });
  if (error) return NextResponse.json({ demo: true, rows: [] });

  let currentUserId: string | null = null;
  try {
    const { data: authData } = await sb.auth.getUser();
    currentUserId = authData?.user?.id ?? null;
  } catch {
    currentUserId = null;
  }

  // Minimize public ranking fields: strip raw user_id and username to prevent identifier exposure
  const rows = (Array.isArray(data) ? data : []).map((r, i) => ({
    rank: i + 1,
    display_name: typeof r?.display_name === "string" ? r.display_name : "Learner",
    avatar: typeof r?.avatar === "string" ? r.avatar : "👤",
    weekly_xp: typeof r?.weekly_xp === "number" ? Number(r.weekly_xp) : 0,
    is_self: Boolean(currentUserId && r?.user_id === currentUserId),
  }));

  return NextResponse.json({ demo: false, rows });
}
