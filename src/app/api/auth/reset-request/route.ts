import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { emailLayout, sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Password reset that doesn't depend on Supabase's mailer or redirect allow-list:
 * generates a one-time recovery token and emails OUR link (/reset-password?token_hash=…) via Resend.
 * Responds identically whether or not the email exists. 501 → client falls back to Supabase's built-in email.
 */
export async function POST(req: Request) {
  const generic = NextResponse.json({ ok: true, message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour." });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ fallback: true }, { status: 501 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ fallback: true }, { status: 501 });
  if (!rateLimit(`reset:${clientIp(req)}`, 5, 15 * 60_000).ok) return generic;
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return generic;
  if (!rateLimit(`reset-email:${parsed.data.email}`, 3, 60 * 60_000).ok) return generic;

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: parsed.data.email });
  if (error || !data?.properties?.hashed_token) return generic; // unknown email → same response
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const link = `${site}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
  await sendEmail(
    parsed.data.email,
    "Reset your Rreal AI Academy password",
    emailLayout("Reset your password", `<p>Click the button below to choose a new password. This link expires in 1 hour and can be used once.</p><p><a href="${link}" style="display:inline-block;background:#22d3ee;color:#070912;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Choose a new password</a></p>`),
  );
  return generic;
}
