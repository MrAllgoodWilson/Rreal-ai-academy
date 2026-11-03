import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Weekly league leaderboard (opt-in profiles only; see leaderboard_weekly() in the migration). */
export async function GET() {
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ demo: true, rows: [] });
  const { data, error } = await sb.rpc("leaderboard_weekly", { p_limit: 50 });
  if (error) return NextResponse.json({ rows: [] });
  return NextResponse.json({ rows: data });
}
