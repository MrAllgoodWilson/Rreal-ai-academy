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

  // Parse rows and sanitize weekly_xp (supporting bigint as number or string)
  const rawRows = (Array.isArray(data) ? data : []).map((r) => {
    const rawXp = r?.weekly_xp;
    const weekly_xp =
      typeof rawXp === "number" && Number.isFinite(rawXp) && rawXp >= 0
        ? rawXp
        : typeof rawXp === "string" && !Number.isNaN(Number(rawXp)) && Number(rawXp) >= 0
        ? Number(rawXp)
        : 0;

    return {
      display_name: typeof r?.display_name === "string" ? r.display_name : "Learner",
      avatar: typeof r?.avatar === "string" ? r.avatar : "👤",
      weekly_xp,
      is_self: Boolean(currentUserId && r?.user_id === currentUserId),
    };
  });

  // Assign ranks with shared rank for ties (1224 policy)
  let currentRank = 1;
  const rows = rawRows.map((r, i) => {
    if (i > 0 && r.weekly_xp < rawRows[i - 1].weekly_xp) {
      currentRank = i + 1;
    }
    return {
      rank: currentRank,
      ...r,
    };
  });

  return NextResponse.json({ demo: false, rows });
}
