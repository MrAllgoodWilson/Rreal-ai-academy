import { NextResponse } from "next/server";
import { serverFlags } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, demo: !process.env.NEXT_PUBLIC_SUPABASE_URL, integrations: serverFlags(), time: new Date().toISOString() });
}
