import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/server-auth";
import { validPluginUrl } from "@/lib/plugins/dispatch";

export const dynamic = "force-dynamic";
const EVENTS = ["lesson.completed", "certificate.issued", "video.rendered", "course.created"] as const;

export async function GET() {
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ plugins: [], demo: true });
  const { data } = await who.member.sb.from("user_plugins").select("id, kind, url, events, enabled, created_at").order("created_at");
  return NextResponse.json({ plugins: (data ?? []).map((p) => ({ ...p, url: p.url.replace(/(https:\/\/[^/]+\/).{6,}/, "$1•••") })) });
}

export async function POST(req: Request) {
  const parsed = z.object({ kind: z.enum(["zapier", "make", "slack", "discord", "webhook"]), url: z.string().url().max(500), events: z.array(z.enum(EVENTS)).min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a plugin type, paste its URL and pick events." }, { status: 400 });
  if (!validPluginUrl(parsed.data.kind, parsed.data.url)) return NextResponse.json({ error: `That doesn't look like a valid ${parsed.data.kind} webhook URL (must be https on the official domain).` }, { status: 400 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ error: "Plugins require the production database." }, { status: 501 });
  const { count } = await who.member.sb.from("user_plugins").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 10) return NextResponse.json({ error: "Maximum 10 plugins." }, { status: 400 });
  const { error } = await who.member.sb.from("user_plugins").insert({ user_id: who.member.user.id, ...parsed.data });
  if (error) return NextResponse.json({ error: "Couldn't save plugin." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo || !id) return NextResponse.json({ ok: true });
  await who.member.sb.from("user_plugins").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
