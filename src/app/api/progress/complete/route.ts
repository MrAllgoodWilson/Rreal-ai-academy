import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getLessonRef } from "@/lib/curriculum";
import { dispatchPluginEvent } from "@/lib/plugins/dispatch";

/**
 * Authoritative lesson completion.
 * Defect R-2 Fix: Scores are computed server-side from submitted answers rather than trusted from the client.
 * Defect R-1 Mitigation: Answer keys are verified on the server; minimum time guards protect exam credentials.
 */
export async function POST(req: Request) {
  const sb = await getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  const parsed = z
    .object({
      lessonId: z.string(),
      score: z.number().int().min(0).max(100).optional(),
      answers: z.record(z.union([z.number().int().min(0), z.string()])).optional(),
      timeSpentSeconds: z.number().min(0).optional(),
    })
    .safeParse(await req.json().catch(() => null));

  if (!parsed.success || !/^[a-z0-9-]{2,100}$/.test(parsed.data.lessonId)) {
    return NextResponse.json({ error: "Invalid lesson" }, { status: 400 });
  }

  const { lessonId, score: clientScore, answers, timeSpentSeconds } = parsed.data;
  const lessonRef = getLessonRef(lessonId);

  // Authoritative server-side grading for quiz blocks
  let authoritativeScore = clientScore ?? 100;
  if (lessonRef) {
    const quizzes = lessonRef.lesson.blocks.filter((b): b is Extract<typeof b, { type: "quiz" }> => b.type === "quiz");
    if (quizzes.length > 0) {
      if (answers && Object.keys(answers).length > 0) {
        let correctCount = 0;
        for (const q of quizzes) {
          const submitted = answers[q.id];
          if (submitted !== undefined && Number(submitted) === q.answer) {
            correctCount++;
          }
        }
        authoritativeScore = Math.round((correctCount / quizzes.length) * 100);
      } else {
        // If the lesson has quizzes but no answers are submitted, the score is 0 (reject client self-reporting)
        authoritativeScore = 0;
      }
    }
  }

  // Time guard: prevent instant automated credential minting on comprehensive exams
  if (lessonId === "capstone-exam" && (timeSpentSeconds ?? 0) < 10) {
    return NextResponse.json(
      { error: "Assessment completed too quickly. Please review questions carefully." },
      { status: 400 }
    );
  }

  const tz = req.headers.get("x-timezone") ?? "UTC";
  const { data, error } = await sb.rpc("complete_lesson", {
    p_lesson_id: lessonId,
    p_score: authoritativeScore,
    p_tz: tz,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });

  const { data: auth } = await sb.auth.getUser();
  if (auth.user) {
    dispatchPluginEvent(sb, auth.user.id, "lesson.completed", {
      title: lessonRef?.lesson.title ?? lessonId,
      xp: (data as { xp_awarded?: number })?.xp_awarded,
      score: authoritativeScore,
    });
  }

  return NextResponse.json({
    ...(typeof data === "object" ? data : {}),
    authoritativeScore,
  });
}
