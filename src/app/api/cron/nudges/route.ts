import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { runNudges } from "@/lib/nudges";

export const dynamic = "force-dynamic";

/** Called once a day by the Worker's Cron Trigger (worker.ts). Protected by CRON_SECRET. */
export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET || "";
  const got = req.headers.get("x-cron-secret") || "";
  if (!expected || expected.length !== got.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(got))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const result = await runNudges(admin, site);
  console.info("[nudges]", JSON.stringify(result));
  return NextResponse.json(result);
}
