import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { callClaude } from "@/lib/claude";
import { COURSE_SYSTEM_PROMPT, CATEGORIES, GeneratedCourseSchema, toTrack } from "@/lib/course-schema";
import { getMember, takeQuota } from "@/lib/server-auth";
import { dispatchPluginEvent } from "@/lib/plugins/dispatch";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { Category, TrackLevel } from "@/lib/curriculum/types";

export const maxDuration = 120;

const Body = z.object({
  request: z.string().trim().min(8).max(1000),
  level: z.number().int().min(1).max(5),
  language: z.enum(["en", "es"]).default("en"),
  category: z.enum(CATEGORIES as [Category, ...Category[]]).optional(),
});

/** Generates a custom course with AI, validates it, and saves it to the learner's library. */
export async function POST(req: Request) {
  if (!rateLimit(`gen:${clientIp(req)}`, 5, 60_000).ok) return NextResponse.json({ error: "Please wait a minute before generating another course." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Describe the course you want (at least a sentence)." }, { status: 400 });
  const { request, level, language } = parsed.data;

  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The AI course builder isn't configured yet (missing ANTHROPIC_API_KEY)." }, { status: 503 });
  if (!who.demo) {
    const limited = await takeQuota(who.member, "course");
    if (limited) return limited;
  }

  const levelName = ["", "absolute beginner (dummy)", "beginner", "intermediate", "advanced", "expert"][level];
  const raw = await callClaude({
    system: COURSE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Learner request: """${request}"""\nLevel: ${levelName}\nWrite the entire course in ${language === "es" ? "Latin American Spanish" : "English"}.` }],
    maxTokens: 8000,
  }).catch(() => null);
  if (!raw) return NextResponse.json({ error: "The AI couldn't build that course right now. Please try again." }, { status: 502 });

  let json: unknown;
  try {
    json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    return NextResponse.json({ error: "The AI returned an unreadable course. Please try again." }, { status: 502 });
  }
  const course = GeneratedCourseSchema.safeParse(json);
  if (!course.success) return NextResponse.json({ error: "The AI course didn't pass quality checks. Please try again or rephrase." }, { status: 502 });

  const category = parsed.data.category ?? "foundations";
  const track = toTrack(course.data, { level: level as TrackLevel, category, language, suffix: randomBytes(3).toString("hex") });

  if (!who.demo) {
    const { error } = await who.member.sb.rpc("create_custom_course", { p_course: track, p_request: request });
    if (error) return NextResponse.json({ error: "Couldn't save your course. Please try again." }, { status: 500 });
    dispatchPluginEvent(who.member.sb, who.member.user.id, "course.created", { title: track.name, id: track.id });
  }
  return NextResponse.json({ track });
}
