import { z } from "zod";
import type { Category, Track, TrackLevel } from "@/lib/curriculum/types";

/** Shape we ask the AI to return. Everything is validated before it reaches learners or the database. */
const str = (max: number) => z.string().trim().min(1).max(max);
const BlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), heading: str(120).optional(), body: str(1500) }),
  z.object({ type: z.literal("keypoints"), heading: str(120).optional(), items: z.array(str(300)).min(2).max(8) }),
  z.object({ type: z.literal("tip"), body: str(400) }),
  z.object({ type: z.literal("example"), label: str(120), bad: str(800).optional(), good: str(1500) }),
  z.object({ type: z.literal("quiz"), question: str(300), options: z.array(str(200)).min(2).max(5), answer: z.number().int().min(0).max(4), explanation: str(400) }),
  z.object({ type: z.literal("prompt-lab"), goal: str(400), minScore: z.number().int().min(30).max(90).default(65) }),
  z.object({ type: z.literal("reflect"), prompt: str(300) }),
]);

export const GeneratedCourseSchema = z.object({
  name: str(100),
  tagline: str(200),
  outcome: str(300),
  emoji: z.string().max(8).default("📚"),
  tools: z.array(z.object({ name: str(80), why: str(200), pricing: z.enum(["free", "freemium", "paid"]).default("freemium"), url: z.string().url().max(200).optional() })).max(10).default([]),
  lessons: z
    .array(z.object({ title: str(120), summary: str(240), minutes: z.number().int().min(3).max(30).default(8), blocks: z.array(BlockSchema).min(2).max(10) }))
    .min(3)
    .max(10),
});
export type GeneratedCourse = z.infer<typeof GeneratedCourseSchema>;

export const CATEGORIES: Category[] = ["foundations", "creative", "video", "design", "web", "business", "automation", "developer", "career"];

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "course";

/** Convert validated AI output into a catalog Track with collision-free ids. */
export function toTrack(g: GeneratedCourse, opts: { level: TrackLevel; category: Category; language: "en" | "es"; suffix: string }): Track {
  const id = `u-${slug(g.name)}-${opts.suffix}`.replace(/-+/g, "-");
  const stages = ["", "Dummy", "Beginner", "Intermediate", "Advanced", "Expert"];
  let q = 0;
  return {
    id,
    kind: "custom",
    category: opts.category,
    language: opts.language,
    level: opts.level,
    stage: stages[opts.level],
    name: g.name,
    tagline: g.tagline,
    outcome: g.outcome,
    gradient: "from-fuchsia-400 to-cyan-400",
    emoji: g.emoji || "📚",
    certificateTitle: `Rreal Certified: ${g.name}`,
    weeks: [
      {
        number: 1,
        title: "Self-paced",
        modules: [
          {
            id: `${id}-m1`,
            title: g.name,
            description: g.tagline,
            lessons: g.lessons.map((l, i) => ({
              id: `${id}-l${i + 1}`,
              title: l.title,
              summary: l.summary,
              minutes: l.minutes,
              xp: Math.min(150, 40 + opts.level * 15),
              blocks: [
                ...(i === 0 && g.tools.length
                  ? [{ type: "keypoints" as const, heading: opts.language === "es" ? "Herramientas que necesitarás" : "Tools you'll need", items: g.tools.map((t) => `${t.name} (${t.pricing}) — ${t.why}${t.url ? ` · ${t.url}` : ""}`) }]
                  : []),
                ...l.blocks.map((b) => {
                  if (b.type !== "quiz") return b;
                  q++;
                  return { ...b, id: `${id}-q${q}`, answer: Math.min(b.answer, b.options.length - 1) };
                }),
              ],
            })),
          },
        ],
      },
    ],
  };
}

export const COURSE_SYSTEM_PROMPT = `You are the curriculum designer for Rreal AI Academy, an interactive AI school.
Design a practical, accurate, engaging course for the learner's request. Teach step by step, with real tools (name the specific apps/services and whether they are free, freemium or paid — never invent prices).
Return ONLY a JSON object with this exact shape (no markdown):
{
  "name": string (≤ 70 chars),
  "tagline": string,
  "outcome": string (what the learner can do after),
  "emoji": single emoji,
  "tools": [{ "name": string, "why": string, "pricing": "free"|"freemium"|"paid", "url": "https://..." }],
  "lessons": [ 4 to 7 lessons, each {
     "title": string, "summary": string, "minutes": 5-15,
     "blocks": [ 3 to 6 blocks using ONLY these types:
        {"type":"text","heading":string,"body":string},
        {"type":"keypoints","heading":string,"items":[string,...]},
        {"type":"tip","body":string},
        {"type":"example","label":string,"bad":string (optional),"good":string},
        {"type":"quiz","question":string,"options":[3-4 strings],"answer":index of correct option,"explanation":string},
        {"type":"prompt-lab","goal":string (a hands-on prompt the learner writes),"minScore":60-75},
        {"type":"reflect","prompt":string}
     ] (every lesson must include at least one quiz; include step-by-step instructions where relevant)
  }]
}
Rules: be factually careful; flag ethics/legal issues (copyright, consent, platform AI-disclosure rules) when relevant; no dangerous, hateful or adult content — if the request is inappropriate, design a safe, related course instead.`;
