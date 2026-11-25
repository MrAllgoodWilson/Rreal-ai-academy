import { NextResponse } from "next/server";
import { getMember } from "@/lib/server-auth";
import { dispatchPluginEvent } from "@/lib/plugins/dispatch";

/** Sends a test "lesson.completed" event to the learner's plugins. */
export async function POST() {
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ ok: true, demo: true });
  await dispatchPluginEvent(who.member.sb, who.member.user.id, "lesson.completed", { title: "Test event from Rreal AI Academy 🎉" });
  return NextResponse.json({ ok: true });
}
