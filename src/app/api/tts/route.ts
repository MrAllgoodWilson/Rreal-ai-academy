import { unfundedExecution } from "@/lib/execution-policy";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DEFAULT_PREMIUM_VOICE, cloudVoiceById, isPremiumVoice } from "@/lib/voices";
import { getMember } from "@/lib/server-auth";
import { readByok } from "@/lib/byok-server";

/** Member-funded ElevenLabs speech only until prepaid cloud reservations exist.
 * Selected cloud voices fail visibly; never silently substitute another speaker.
 */
export async function POST(req: Request) {
  const own = readByok(req).elevenlabs;
  const key = own || process.env.ELEVENLABS_API_KEY;
  if (!rateLimit(`tts:${clientIp(req)}`, 30, 60_000).ok) return new NextResponse(null, { status: 204 });
  const parsed = z.object({ text: z.string().min(1).max(1500), voiceId: z.string().max(64).optional(), lang: z.enum(["en", "es"]).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return new NextResponse(null, { status: 204 });
  const requestedCloud = cloudVoiceById(parsed.data.voiceId);
  // A member's own ElevenLabs account is billed to them, so only that path skips our fair-use limit.
  const billedToMember = Boolean(own) && !requestedCloud;
  if (who.demo || !billedToMember || !key) return unfundedExecution("speech");

  const custom = process.env.ELEVENLABS_VOICE_ID;
  const requested = parsed.data.voiceId;
  const voice = requested && (isPremiumVoice(requested) || requested === custom) ? requested : custom || DEFAULT_PREMIUM_VOICE;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: parsed.data.text, model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2" }),
  });
  if (!res.ok || !res.body) return new NextResponse(null, { status: 204 });
  return new NextResponse(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
