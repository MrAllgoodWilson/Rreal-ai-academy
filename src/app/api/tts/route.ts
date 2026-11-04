import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DEFAULT_PREMIUM_VOICE, isPremiumVoice } from "@/lib/voices";
import { getMember, takeQuota } from "@/lib/server-auth";
import { cfAiAvailable, cfSpeech } from "@/lib/cf-ai";
import { readByok } from "@/lib/byok-server";

/**
 * Premium text-to-speech: ElevenLabs (multilingual, selectable voices) when ELEVENLABS_API_KEY is set,
 * otherwise Cloudflare Workers AI MeloTTS (English + Spanish, no key needed).
 * 204 = no premium voice available → the client uses the device voice.
 */
export async function POST(req: Request) {
  const own = readByok(req).elevenlabs;
  const key = own || process.env.ELEVENLABS_API_KEY;
  if (!key && !(await cfAiAvailable())) return new NextResponse(null, { status: 204 });
  if (!rateLimit(`tts:${clientIp(req)}`, 30, 60_000).ok) return new NextResponse(null, { status: 204 });
  const parsed = z.object({ text: z.string().min(1).max(1500), voiceId: z.string().max(64).optional(), lang: z.enum(["en", "es"]).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return new NextResponse(null, { status: 204 });
  if (!who.demo && !own && (await takeQuota(who.member, "tts"))) return new NextResponse(null, { status: 204 });

  if (!key) {
    const audio = await cfSpeech(parsed.data.text, parsed.data.lang ?? "en");
    if (!audio) return new NextResponse(null, { status: 204 });
    const wav = audio[0] === 0x52 && audio[1] === 0x49 && audio[2] === 0x46 && audio[3] === 0x46; // "RIFF"
    return new NextResponse(audio as BodyInit, { headers: { "content-type": wav ? "audio/wav" : "audio/mpeg", "cache-control": "no-store" } });
  }

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
