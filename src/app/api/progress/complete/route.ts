import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getLessonRef } from "@/lib/curriculum";
import { dispatchPluginEvent } from "@/lib/plugins/dispatch";

/** Authoritative lesson completion. XP, streak and gating are computed in Postgres (complete_lesson RPC). */
export async function POST(req: Request) {
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Not configured" }, { status: 501 });
  const parsed = z.object({ lessonId: z.string(), score: z.number().int().min(0).max(100) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || !/^[a-z0-9-]{2,100}$/.test(parsed.data.lessonId)) return NextResponse.json({ error: "Invalid lesson" }, { status: 400 });
  const tz = req.headers.get("x-timezone") ?? "UTC";
  const { data, error } = await sb.rpc("complete_lesson", { p_lesson_id: parsed.data.lessonId, p_score: parsed.data.score, p_tz: tz });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  const { data: auth } = await sb.auth.getUser();
  if (auth.user) dispatchPluginEvent(sb, auth.user.id, "lesson.completed", { title: getLessonRef(parsed.data.lessonId)?.lesson.title ?? parsed.data.lessonId, xp: (data as { xp_awarded?: number })?.xp_awarded });
  return NextResponse.json(data);
}
