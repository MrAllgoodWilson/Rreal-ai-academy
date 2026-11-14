import { sameOriginRequest } from "@/lib/same-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/server-auth";
import { quoteProject } from "@/lib/project-wallet";
import { durableLimit, edgeAddress } from "@/lib/durable-limit";
const Body = z.object({ feature: z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,79}$/) }).strict();
export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
  const lim1 = await durableLimit("project-quote", edgeAddress(req), 10, 60_000);
  if (lim1 !== "ok") return lim1 === "limited" ? NextResponse.json({ error: "Please wait before requesting another quote." }, { status: 429 }) : NextResponse.json({ error: "Temporarily unavailable. Please try again shortly." }, { status: 503 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ error: "Project quotes are unavailable in demo mode." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a listed project offer; prices are set by the server." }, { status: 400 });
  try {
    return NextResponse.json(await quoteProject(who.member.user.id, parsed.data.feature), { headers: { "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "This project has no approved, costed offer available yet.", code: "unavailable" }, { status: 503 });
  }
}
