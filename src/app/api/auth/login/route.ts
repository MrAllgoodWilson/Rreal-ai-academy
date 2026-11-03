import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Sign in with EMAIL or USERNAME. Username → email resolution happens server-side
 * with the service role so emails are never exposed to the browser.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, 10, 5 * 60_000).ok) return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  const parsed = z.object({ identifier: z.string().min(1).max(254), password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username/email and password." }, { status: 400 });

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Auth backend not configured." }, { status: 501 });
  const generic = NextResponse.json({ error: "That username/email and password don't match." }, { status: 401 });

  let email = parsed.data.identifier.trim().toLowerCase();
  if (!email.includes("@")) {
    const admin = getSupabaseAdmin();
    if (!admin) return generic;
    const { data } = await admin.rpc("email_for_username", { p_username: email });
    if (!data) return generic;
    email = data as string;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) return /confirm/i.test(error.message) ? NextResponse.json({ error: "Please confirm your email first — check your inbox." }, { status: 403 }) : generic;
  return NextResponse.json({ ok: true });
}
