import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { callClaude } from "@/lib/claude";
import { COURSE_SYSTEM_PROMPT, CATEGORIES, GeneratedCourseSchema, toTrack } from "@/lib/course-schema";
import { getMember, takeQuota, spendCredit, refundCredit } from "@/lib/server-auth";
import { readByok, ownsTextAi } from "@/lib/byok-server";
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
  // Members who connect their own Claude/ChatGPT account build courses free; otherwise a $9.99 course credit is used.
  const byok = readByok(req);
  let charged = false;
  const spendRef = `course:${randomBytes(8).toString("hex")}`;
  if (!who.demo) {
    const limited = await takeQuota(who.member, "course");
    if (limited) return limited;
    if (!ownsTextAi(byok)) {
      charged = await spendCredit(who.member, "course", spendRef);
      if (!charged) return NextResponse.json({ error: "Creating your own course costs $9.99. Buy a course credit to continue.", code: "credits_required", kind: "course" }, { status: 402 });
    }
  }
  const refund = async () => {
    if (!who.demo && charged) await refundCredit(who.member.user.id, "course", spendRef);
  };

  const levelName = ["", "absolute beginner (dummy)", "beginner", "intermediate", "advanced", "expert"][level];
  const raw = await callClaude({
    system: COURSE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Learner request: """${request}"""\nLevel: ${levelName}\nWrite the entire course in ${language === "es" ? "Latin American Spanish" : "English"}.` }],
    maxTokens: 8000,
    byok,
  }).catch(() => null);
  if (!raw) {
    await refund();
    return NextResponse.json({ error: "The AI couldn't build that course right now. Your credit was returned — please try again." }, { status: 502 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    await refund();
    return NextResponse.json({ error: "The AI returned an unreadable course. Your credit was returned — please try again." }, { status: 502 });
  }
  const course = GeneratedCourseSchema.safeParse(json);
  if (!course.success) {
    await refund();
    return NextResponse.json({ error: "The AI course didn't pass quality checks. Your credit was returned — please try again or rephrase." }, { status: 502 });
  }

  const category = parsed.data.category ?? "foundations";
  const track = toTrack(course.data, { level: level as TrackLevel, category, language, suffix: randomBytes(3).toString("hex") });

  if (!who.demo) {
    const { error } = await who.member.sb.rpc("create_custom_course", { p_course: track, p_request: request });
    if (error) {
      await refund();
      return NextResponse.json({ error: "Couldn't save your course. Your credit was returned — please try again." }, { status: 500 });
    }
    dispatchPluginEvent(who.member.sb, who.member.user.id, "course.created", { title: track.name, id: track.id });
  }
  return NextResponse.json({ track });
}
