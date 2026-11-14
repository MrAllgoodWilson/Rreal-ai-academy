import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { edgeAddress } from "@/lib/durable-limit";

/**
 * Sign in with EMAIL or USERNAME. Username → email resolution happens server-side
 * with the service role so emails are never exposed to the browser.
 *
 * Throttling is shared and durable (migration 0013), so it holds across instances and restarts:
 *   - per network address: every attempt counts (10 / 5 min);
 *   - per account FROM one address: failed attempts only (5 / 15 min) - a guesser is stopped without locking the
 *     real owner out from their own address;
 *   - per account from anywhere: failed attempts only, deliberately high (50 / 15 min) - slows a distributed guess;
 *     reaching it needs sustained effort and it clears itself, so it is a brake rather than a cheap lockout.
 * The address is the one the platform edge reports (cf-connecting-ip). X-Forwarded-For is caller-supplied and ignored.
 * If the limiter itself is unavailable the route refuses (503) instead of running unthrottled.
 */
const IP_LIMIT = { limit: 10, window: 5 * 60 };
const PAIR_FAIL_LIMIT = { limit: 5, window: 15 * 60 };
const ACCOUNT_FAIL_LIMIT = { limit: 50, window: 15 * 60 };

const hashKey = (...parts: string[]) => createHash("sha256").update(parts.join("\u0000")).digest("hex");

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  const sb = await getSupabaseServer();
  if (!admin || !sb) return NextResponse.json({ error: "Auth backend not configured." }, { status: 501 });

  const unavailable = NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 503 });
  const tooMany = NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  const call = async (fn: "rate_limit_hit" | "rate_limit_ok", key: string, l: { limit: number; window: number }): Promise<boolean | null> => {
    const { data, error } = await admin.rpc(fn, { p_key: key, p_limit: l.limit, p_window_seconds: l.window });
    return error || typeof data !== "boolean" ? null : data;
  };

  const ip = edgeAddress(req);
  const ipOk = await call("rate_limit_hit", hashKey("login:ip", ip), IP_LIMIT);
  if (ipOk === null) return unavailable;
  if (!ipOk) return tooMany;

  const body = await req.json().catch(() => null);
  const parsed = z
    .object({
      identifier: z.string().min(1).max(254),
      password: z.string().min(1).max(200),
    })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your username/email and password." }, { status: 400 });
  }

  const normalizedId = parsed.data.identifier.trim().toLowerCase();
  const pairKey = hashKey("login:fail:pair", normalizedId, ip);
  const accountKey = hashKey("login:fail:account", normalizedId);
  const [pairOk, accountOk] = await Promise.all([call("rate_limit_ok", pairKey, PAIR_FAIL_LIMIT), call("rate_limit_ok", accountKey, ACCOUNT_FAIL_LIMIT)]);
  if (pairOk === null || accountOk === null) return unavailable;
  if (!pairOk || !accountOk) return tooMany;

  const generic = NextResponse.json({ error: "That username/email and password don't match." }, { status: 401 });
  const failed = async () => {
    await Promise.all([call("rate_limit_hit", pairKey, PAIR_FAIL_LIMIT), call("rate_limit_hit", accountKey, ACCOUNT_FAIL_LIMIT)]);
    return generic;
  };

  let email = normalizedId;
  if (!email.includes("@")) {
    const { data } = await admin.rpc("email_for_username", { p_username: email });
    if (!data) return failed();
    email = data as string;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) {
    if (/confirm/i.test(error.message)) return NextResponse.json({ error: "Please confirm your email first — check your inbox." }, { status: 403 });
    return failed();
  }
  return NextResponse.json({ ok: true });
}
