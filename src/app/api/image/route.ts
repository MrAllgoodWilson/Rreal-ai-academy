import { NextResponse } from "next/server";
import { z } from "zod";
import { cfImage } from "@/lib/cf-ai";
import { getMember, takeQuota } from "@/lib/server-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const STYLES: Record<string, string> = {
  flyer: "eye-catching event flyer background artwork, bold composition, space at the top for a headline, no text",
  thumbnail: "vibrant YouTube/TikTok thumbnail scene, high contrast, expressive, cinematic lighting, no text",
  logo: "simple modern flat vector logo mark on a plain background, centered, no text",
  product: "professional product photo, studio lighting, clean background",
  poster: "cinematic movie poster artwork, dramatic lighting, no text",
};

/** AI image generation on Cloudflare Workers AI (included with membership, daily fair-use limit). */
export async function POST(req: Request) {
  if (!rateLimit(`img:${clientIp(req)}`, 6, 60_000).ok) return NextResponse.json({ error: "Please wait a moment." }, { status: 429 });
  const parsed = z.object({ prompt: z.string().trim().min(5).max(800), style: z.enum(["flyer", "thumbnail", "logo", "product", "poster"]).default("flyer") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Describe the image (at least a few words)." }, { status: 400 });
  const who = await getMember({ requireSubscription: true });
  if ("error" in who) return who.error;
  if (!who.demo) {
    const limited = await takeQuota(who.member, "image");
    if (limited) return limited;
  }
  const image = await cfImage(`${parsed.data.prompt}. Style: ${STYLES[parsed.data.style]}.`);
  if (!image) return NextResponse.json({ error: "Image generation isn't available right now. Please try again." }, { status: 503 });
  return NextResponse.json({ image: `data:image/jpeg;base64,${image}` });
}
