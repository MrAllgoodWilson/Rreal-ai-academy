import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMember } from "@/lib/server-auth";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function guard() {
  const who = await getMember();
  if ("error" in who) return { error: who.error };
  if (who.demo || !isAdmin(who.member.user)) return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  const admin = getSupabaseAdmin();
  if (!admin) return { error: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 503 }) };
  return { admin };
}

/** Review queue: courses learners submitted for publication. */
export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const { data } = await g.admin.from("custom_courses").select("id, title, level, language, status, request, created_at, content").in("status", ["submitted", "published", "rejected"]).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ courses: data ?? [] });
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const parsed = z.object({ id: z.string().regex(/^u-[a-z0-9-]+$/), status: z.enum(["published", "rejected", "private"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { error } = await g.admin.rpc("admin_set_course_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
