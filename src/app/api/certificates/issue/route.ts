import { NextResponse } from "next/server";
import { z } from "zod";
import { TRACKS, lessonsForTrack } from "@/lib/curriculum";
import { credentialCode, credentialTitle, fingerprint, signCertificate } from "@/lib/certificates/server";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  trackId: z.string(),
  name: z.string().trim().min(2).max(80),
  completedLessonIds: z.array(z.string()).max(500),
  score: z.number().min(0).max(100).default(100),
});

export async function POST(req: Request) {
  if (!rateLimit(`cert:${clientIp(req)}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let { trackId, name, completedLessonIds, score } = parsed.data;

  if (trackId !== "master" && !TRACKS.some((t) => t.id === trackId)) return NextResponse.json({ error: "Unknown track." }, { status: 400 });
  const required = trackId === "master" ? TRACKS.flatMap((t) => lessonsForTrack(t.id)) : lessonsForTrack(trackId);

  const sb = getSupabaseServer();
  let userId: string | undefined;
  if (sb) {
    // Production: completion + subscription are verified server-side from the database, never trusted from the client.
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    userId = auth.user.id;
    const [{ data: rows }, { data: profile }, { data: sub }] = await Promise.all([
      sb.from("lesson_progress").select("lesson_id, score").eq("user_id", userId),
      sb.from("profiles").select("display_name").eq("id", userId).single(),
      sb.from("subscriptions").select("status").eq("user_id", userId).in("status", ["active", "trialing"]).maybeSingle(),
    ]);
    if (!sub) return NextResponse.json({ error: "Certificates require an active plan." }, { status: 402 });
    completedLessonIds = (rows ?? []).map((r) => r.lesson_id);
    name = profile?.display_name ?? name;
    const examRow = (rows ?? []).find((r) => r.lesson_id === "capstone-exam");
    if (trackId === "architect" || trackId === "master") score = examRow?.score ?? 0;
  }

  const done = new Set(completedLessonIds);
  const missing = required.filter((r) => !done.has(r.lesson.id));
  if (missing.length) return NextResponse.json({ error: `Complete ${missing.length} more lesson(s) first: ${missing.slice(0, 3).map((m) => m.lesson.title).join(", ")}…` }, { status: 403 });
  if ((trackId === "architect" || trackId === "master") && score < 80) return NextResponse.json({ error: "Pass the capstone exam with 80%+ to certify." }, { status: 403 });

  let signed: ReturnType<typeof signCertificate>;
  try {
    signed = signCertificate({ n: name, t: trackId, s: Math.round(score), u: userId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Certificate signing isn't configured on this server yet (CERT_SIGNING_SECRET). Please contact support." }, { status: 503 });
  }
  const { token, payload } = signed;
  const certificate = { token, code: credentialCode(payload), title: credentialTitle(trackId), trackId, name, issuedAt: payload.i, score: payload.s };

  // Learners cannot write certificates (RLS); the issuer records them with the service role.
  const admin = getSupabaseAdmin();
  if (admin && userId) {
    await admin.from("certificates").upsert({ user_id: userId, track_id: trackId, credential_code: certificate.code, token, token_hash: fingerprint(token), recipient_name: name, title: certificate.title, score: payload.s, issued_at: payload.i }, { onConflict: "user_id,track_id" });
  }
  return NextResponse.json({ certificate });
}
