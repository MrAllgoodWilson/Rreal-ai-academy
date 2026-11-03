import "server-only";

/** Sends transactional email through Resend. Returns false when not configured. */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:disabled] to=${to} subject="${subject}"`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Rreal AI Academy <onboarding@resend.dev>", to, subject, html }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text().catch(() => ""));
  return res.ok;
}

export const emailLayout = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#070912;font-family:Arial,sans-serif;color:#f4f6ff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0e1222;border:1px solid #2c365c;border-radius:16px">
<tr><td style="padding:32px"><p style="margin:0 0 8px;color:#22d3ee;font-weight:bold;letter-spacing:2px;font-size:12px">RREAL AI ACADEMY</p>
<h1 style="margin:0 0 16px;font-size:24px">${title}</h1><div style="font-size:16px;line-height:1.6;color:#d6dcf5">${body}</div></td></tr></table>
<p style="color:#7f8ab3;font-size:12px;margin-top:16px">If you didn't request this, you can safely ignore this email.</p></td></tr></table></body></html>`;
