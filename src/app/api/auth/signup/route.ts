import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Server-side sign-up: creates an already-confirmed account (no confirmation email, so it isn't limited by
 * Supabase's built-in mailer or its redirect settings), then signs the learner in. Payment is still required
 * before any lesson unlocks, which is what protects the platform from throwaway accounts.
 */
const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/),
  password: z.string().min(10).max(200).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
  displayName: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 5, 10 * 60_000).ok) return NextResponse.json({ error: "Too many sign-ups from this network. Try again in a few minutes." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your details: username 3–20 letters/numbers/underscores; password 10+ characters with upper and lower case and a number." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const sb = await getSupabaseServer();
  if (!admin || !sb) return NextResponse.json({ fallback: true }, { status: 501 });
  const { email, username, password, displayName } = parsed.data;

  const { data: available } = await admin.rpc("username_available", { p_username: username });
  if (!available) return NextResponse.json({ error: "That username is taken. Try another." }, { status: 409 });

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: displayName } });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return NextResponse.json({ error: taken ? "An account with that email already exists. Try signing in." : "Couldn't create your account. Please try again." }, { status: taken ? 409 : 500 });
  }
  const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
  if (signInError) return NextResponse.json({ ok: true, signedIn: false });
  return NextResponse.json({ ok: true, signedIn: true });
}
