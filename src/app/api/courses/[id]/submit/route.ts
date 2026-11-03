import { NextResponse } from "next/server";
import { getMember } from "@/lib/server-auth";

/** Owner submits their AI-generated course for review so it can be offered to all learners. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ ok: true, demo: true });
  const { error } = await who.member.sb.rpc("submit_custom_course", { p_id: (await params).id });
  if (error) return NextResponse.json({ error: "Couldn't submit this course." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
