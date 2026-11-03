import { NextResponse } from "next/server";
import { getMember } from "@/lib/server-auth";
import { getVideo } from "@/lib/video";
import { dispatchPluginEvent } from "@/lib/plugins/dispatch";

export const dynamic = "force-dynamic";

/** Polls a render; updates the stored status and returns the video URL when ready. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ error: "Not available in demo mode" }, { status: 501 });
  const { sb, user } = who.member;
  const { data: row } = await sb.from("video_renders").select("*").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "succeeded" || row.status === "failed") return NextResponse.json(row);

  const r = await getVideo(row.provider_job_id);
  const patch = { status: r.status, output_url: r.url ?? null, error: r.error ?? null, updated_at: new Date().toISOString() };
  await sb.from("video_renders").update(patch).eq("id", row.id);
  if (r.status === "succeeded") dispatchPluginEvent(sb, user.id, "video.rendered", { title: row.prompt.slice(0, 80), url: r.url });
  return NextResponse.json({ ...row, ...patch });
}
