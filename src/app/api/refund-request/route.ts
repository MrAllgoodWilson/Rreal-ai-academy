import { NextResponse } from "next/server";
import { getMember } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { REFUND_KINDS, REFUND_POLICY, validateRefundRequest } from "@/lib/refund-policy";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A learner asks for a refund. This route NEVER issues a refund: it validates the request, rate-limits it and emails it to a person
 * (support), who reviews it against the published policy. Refunds themselves are issued by hand from the payment dashboard.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });

  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ demo: true, error: "Refund requests are available once you have a real account." }, { status: 501 });

  const { user } = who.member;
  if (!rateLimit(`refund:${user.id}`, 3, 60 * 60 * 1000).ok) return NextResponse.json({ error: "Too many requests. Please try again in an hour." }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Send a JSON body." }, { status: 400 }); }
  const v = validateRefundRequest(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const kindLabel = REFUND_KINDS.find((k) => k.value === v.value.kind)!.label;
  const html = `<p><strong>Refund request</strong></p>
<p>Account: ${esc(user.email ?? "(no email)")} (id ${esc(user.id)})</p>
<p>About: ${esc(kindLabel)}</p>
<p>Purchase date given: ${esc(v.value.purchasedOn ?? "not given")}</p>
<p>Details:</p><pre style="white-space:pre-wrap">${esc(v.value.details)}</pre>
<p>Answer within ${REFUND_POLICY.replyBusinessDays} business days. Check the policy at /refunds before deciding. Issue any refund from the payment dashboard by hand.</p>`;
  const sent = await sendEmail(process.env.SUPPORT_EMAIL || REFUND_POLICY.supportEmail, `Refund request: ${kindLabel}`, html);
  if (!sent) return NextResponse.json({ error: `We could not send your request. Please email ${REFUND_POLICY.supportEmail} directly.` }, { status: 503 });
  return NextResponse.json({ ok: true, message: `Thanks. A person will reply within ${REFUND_POLICY.replyBusinessDays} business days.` }, { status: 202 });
}
