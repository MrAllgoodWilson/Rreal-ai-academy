import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { callClaude } from "@/lib/claude";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMember, takeQuota } from "@/lib/server-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({ key: z.string().max(200), lang: z.enum(["es"]), content: z.unknown() });

/** Keys whose values must never be translated (ids, enums, urls, answers). */
const KEEP = new Set(["id", "type", "url", "answer", "pricing", "required", "minScore", "xp", "minutes", "level", "kind", "category", "emoji", "gradient", "number"]);

/** Re-impose the original structure: only string leaves (outside KEEP keys) may change. */
function merge(orig: unknown, tr: unknown, key?: string): unknown {
  if (typeof orig === "string") return key && KEEP.has(key) ? orig : typeof tr === "string" && tr.trim() ? tr : orig;
  if (Array.isArray(orig)) return orig.map((v, i) => merge(v, Array.isArray(tr) ? tr[i] : undefined, key));
  if (orig && typeof orig === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(orig)) out[k] = merge(v, tr && typeof tr === "object" ? (tr as Record<string, unknown>)[k] : undefined, k);
    return out;
  }
  return orig;
}

export async function POST(req: Request) {
  if (!rateLimit(`tr:${clientIp(req)}`, 60, 60_000).ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });
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
  if (!who.demo) {
    const limited = await takeQuota(who.member, "translate");
    if (limited) return limited;
  }

  const out = await callClaude({
    system: "You are a professional English→Latin American Spanish translator for an AI education app. Translate every human-readable string value in the JSON you receive. Keep JSON keys, structure, ids, URLs, numbers, code and product names (ChatGPT, Claude, Canva, etc.) unchanged. Keep prompts natural in Spanish. Return ONLY the translated JSON, no commentary.",
    messages: [{ role: "user", content: json }],
    maxTokens: Math.min(8000, Math.ceil(json.length / 2) + 500),
  }).catch(() => null);
  if (!out) return NextResponse.json({ error: "Translation unavailable" }, { status: 503 });

  let translated: unknown;
  try {
    translated = JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 502 });
  }
  const safe = merge(content, translated);
  if (admin) await admin.from("content_translations").upsert({ key: hash, lang, content: safe });
  return NextResponse.json({ content: safe });
}
