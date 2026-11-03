import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { emailLayout, sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Forgot-username: emails the username to the address on file.
 * Always returns the same response so it can't be used to discover which emails have accounts.
 */
export async function POST(req: Request) {
  const generic = NextResponse.json({ ok: true, message: "If an account exists for that email, we've sent your username to it." });
  if (!rateLimit(`fu:${clientIp(req)}`, 5, 15 * 60_000).ok) return generic;
  const parsed = z.object({ email: z.string().email().max(254) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return generic;
  const email = parsed.data.email.trim().toLowerCase();
  if (!rateLimit(`fu-email:${email}`, 3, 60 * 60_000).ok) return generic;

  const admin = getSupabaseAdmin();
  if (!admin) return generic;
  const { data: username } = await admin.rpc("username_for_email", { p_email: email });
  if (username) {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    await sendEmail(
      email,
      "Your Rreal AI Academy username",
      emailLayout("Here's your username", `<p>Your username is:</p><p style="font-size:22px;font-weight:bold;color:#22d3ee">@${String(username).replace(/[<>&"]/g, "")}</p><p>You can also sign in with this email address.</p><p><a href="${site}/login" style="display:inline-block;background:#22d3ee;color:#070912;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Sign in</a></p>`),
    );
  }
  return generic;
}
