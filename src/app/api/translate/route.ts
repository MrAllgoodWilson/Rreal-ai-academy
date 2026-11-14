import { unfundedExecution } from "@/lib/execution-policy";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMember } from "@/lib/server-auth";
import { durableLimit, edgeAddress } from "@/lib/durable-limit";

const Body = z.object({ key: z.string().max(200), lang: z.enum(["es"]), content: z.unknown() });

export async function POST(req: Request) {
  const lim1 = await durableLimit("tr", edgeAddress(req), 60, 60_000);
  if (lim1 !== "ok") return lim1 === "limited" ? NextResponse.json({ error: "Slow down" }, { status: 429 }) : NextResponse.json({ error: "Temporarily unavailable. Please try again shortly." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { key, lang, content } = parsed.data;
  const json = JSON.stringify(content);
  if (json.length > 30_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const hash = createHash("sha256").update(`${lang}:${key}:${json}`).digest("hex");

  const admin = getSupabaseAdmin();
  if (admin) {
    const { data } = await admin.from("content_translations").select("content").eq("key", hash).maybeSingle();
    if (data) return NextResponse.json({ content: data.content, cached: true });
  }

  const who = await getMember();
  if ("error" in who) return who.error;
  return unfundedExecution("translation");
}
