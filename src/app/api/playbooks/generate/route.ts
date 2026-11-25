import { unfundedExecution } from "@/lib/execution-policy";
import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude } from "@/lib/claude";
import { PLAYBOOK_SYSTEM_PROMPT, PlaybookSchema } from "@/lib/playbook-schema";
import { getMember } from "@/lib/server-auth";
import { readByok, ownsTextAi } from "@/lib/byok-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 90;

/** Builds a custom step-by-step playbook for anything the learner wants to create. */
export async function POST(req: Request) {
  if (!rateLimit(`pb:${clientIp(req)}`, 6, 60_000).ok) return NextResponse.json({ error: "Please wait a moment." }, { status: 429 });
  const parsed = z.object({ request: z.string().trim().min(5).max(600), language: z.enum(["en", "es"]).default("en") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Describe what you want to create." }, { status: 400 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  const byok = readByok(req);
  if (who.demo || !ownsTextAi(byok)) return unfundedExecution("playbook");

  const raw = await callClaude({
    system: PLAYBOOK_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `I want to create: """${parsed.data.request}"""\nWrite it in ${parsed.data.language === "es" ? "Latin American Spanish" : "English"}.` }],
    maxTokens: 4000,
    byok,
  }).catch(() => null);
  if (!raw) return NextResponse.json({ error: "Couldn't build that playbook right now. Try again." }, { status: 502 });
  try {
    const pb = PlaybookSchema.parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
    return NextResponse.json({ playbook: { ...pb, id: `custom-${Date.now().toString(36)}` } });
  } catch {
    return NextResponse.json({ error: "The playbook didn't pass quality checks. Please rephrase and try again." }, { status: 502 });
  }
}
