import { unfundedExecution } from "@/lib/execution-policy";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/server-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;


/** Paid image execution is paused until wallet reservations and cost caps exist. */
export async function POST(req: Request) {
  if (!rateLimit(`img:${clientIp(req)}`, 6, 60_000).ok) return NextResponse.json({ error: "Please wait a moment." }, { status: 429 });
  const parsed = z.object({ prompt: z.string().trim().min(5).max(800), style: z.enum(["flyer", "thumbnail", "logo", "product", "poster"]).default("flyer") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Describe the image (at least a few words)." }, { status: 400 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  return unfundedExecution("image");
}
