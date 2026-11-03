import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Proxies text-to-speech to ElevenLabs when configured. 204 = use the browser voice. */
export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  if (!key) return new NextResponse(null, { status: 204 });
  if (!rateLimit(`tts:${clientIp(req)}`, 30, 60_000).ok) return new NextResponse(null, { status: 204 });
  const parsed = z.object({ text: z.string().min(1).max(1500) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: parsed.data.text, model_id: "eleven_turbo_v2_5" }),
  });
  if (!res.ok || !res.body) return new NextResponse(null, { status: 204 });
  return new NextResponse(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
