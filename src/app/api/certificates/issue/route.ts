import { NextResponse } from "next/server";
import { z } from "zod";
import { TRACKS, getTrack, lessonsForTrack } from "@/lib/curriculum";
import { credentialCode, credentialTitle, fingerprint, signCertificate } from "@/lib/certificates/server";
import { accreditationFor } from "@/lib/certificates/accreditation";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { dispatchPluginEvent } from "@/lib/plugins/dispatch";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  trackId: z.string().max(100),
  name: z.string().trim().min(2).max(80),
  completedLessonIds: z.array(z.string()).max(2000),
  score: z.number().min(0).max(100).default(100),
});

const EXAM_TRACKS = new Set(["architect", "master"]);

export async function POST(req: Request) {
  if (!rateLimit(`cert:${clientIp(req)}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let { name, completedLessonIds, score } = parsed.data;
  const { trackId } = parsed.data;

  const sb = await getSupabaseServer();
  let userId: string | undefined;
  let required: { id: string; minutes: number; title: string }[];
  let title: string;

  if (trackId === "master") {
    required = TRACKS.flatMap((t) => lessonsForTrack(t.id)).map((r) => ({ id: r.lesson.id, minutes: r.lesson.minutes, title: r.lesson.title }));
    title = credentialTitle("master");
  } else if (getTrack(trackId)) {
    required = lessonsForTrack(trackId).map((r) => ({ id: r.lesson.id, minutes: r.lesson.minutes, title: r.lesson.title }));
    title = credentialTitle(trackId);
  } else if (sb && /^u-[a-z0-9-]+$/.test(trackId)) {
    // AI-generated course: requirements come from the database
    const [{ data: lessons }, { data: track }] = await Promise.all([
      sb.from("lessons").select("id, minutes, title").eq("track_id", trackId),
      sb.from("tracks").select("certificate_title").eq("id", trackId).maybeSingle(),
    ]);
    if (!lessons?.length || !track) return NextResponse.json({ error: "Unknown course." }, { status: 400 });
    required = lessons as { id: string; minutes: number; title: string }[];
    title = track.certificate_title;
  } else {
    return NextResponse.json({ error: "Unknown course." }, { status: 400 });
  }

  if (sb) {
    // Production: completion + membership are verified from the database, never trusted from the client.
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    userId = auth.user.id;
    const [{ data: rows }, { data: profile }, { data: sub }] = await Promise.all([
      sb.from("lesson_progress").select("lesson_id, score").eq("user_id", userId),
      sb.from("profiles").select("display_name").eq("id", userId).single(),
      sb.from("subscriptions").select("status").eq("user_id", userId).in("status", ["active", "trialing"]).limit(1).maybeSingle(),
    ]);
    if (!sub) return NextResponse.json({ error: "Certificates require an active membership." }, { status: 402 });
    completedLessonIds = (rows ?? []).map((r) => r.lesson_id);
    name = profile?.display_name ?? name;
    const scores = (rows ?? []).filter((r) => required.some((q) => q.id === r.lesson_id)).map((r) => r.score);
    score = EXAM_TRACKS.has(trackId) ? (rows ?? []).find((r) => r.lesson_id === "capstone-exam")?.score ?? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
  }

  const done = new Set(completedLessonIds);
  const missing = required.filter((r) => !done.has(r.id));
  if (missing.length) return NextResponse.json({ error: `Complete ${missing.length} more lesson(s) first: ${missing.slice(0, 3).map((m) => m.title).join(", ")}…` }, { status: 403 });
  if (EXAM_TRACKS.has(trackId) && score < 80) return NextResponse.json({ error: "Pass the capstone exam with 80%+ to certify." }, { status: 403 });

  const minutes = required.reduce((a, r) => a + r.minutes, 0);
  const acc = accreditationFor(trackId, minutes);

  let signed: ReturnType<typeof signCertificate>;
  try {
    signed = signCertificate({ n: name, t: trackId, s: Math.round(score), u: userId, ti: title, a: acc ? { p: acc.partner, b: acc.body, id: acc.providerId, ceu: acc.ceu } : undefined });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Certificate signing isn't configured on this server yet (CERT_SIGNING_SECRET). Please contact support." }, { status: 503 });
  }
  const { token, payload } = signed;
  const certificate = { token, code: credentialCode(payload), title, trackId, name, issuedAt: payload.i, score: payload.s, accredited: !!acc };

  const admin = getSupabaseAdmin();
  if (admin && userId) {
    await admin.from("certificates").upsert(
      { user_id: userId, track_id: trackId, credential_code: certificate.code, token, token_hash: fingerprint(token), recipient_name: name, title, score: payload.s, issued_at: payload.i, credential_type: acc ? "accredited" : "rreal", accreditation: acc },
      { onConflict: "user_id,track_id" },
    );
  }
  if (sb && userId) dispatchPluginEvent(sb, userId, "certificate.issued", { title, code: certificate.code });
  return NextResponse.json({ certificate });
}
