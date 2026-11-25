import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { emailLayout, sendEmail } from "@/lib/email";

const Body = z.object({
  company: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  tier: z.enum(["community", "course", "title", "tool-partner"]),
  message: z.string().trim().max(2000).optional(),
  hp: z.string().max(0).optional(), // honeypot: bots fill it, people never see it
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Public sponsor inquiry intake. Stored with the service role; the owner is emailed. */
export async function POST(req: Request) {
  if (!rateLimit(`sponsor:${clientIp(req)}`, 3, 60 * 60_000).ok) return NextResponse.json({ error: "Thanks! We already have your note. We'll be in touch soon." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please fill in company, name, a valid email and a sponsorship type." }, { status: 400 });
  const d = parsed.data;
  if (d.hp) return NextResponse.json({ ok: true });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Sponsorship requests aren't available right now. Email support@rrealaiacademy.app." }, { status: 503 });
  const { error } = await admin.from("sponsor_inquiries").insert({ company: d.company, contact: d.contact, email: d.email, website: d.website || null, tier: d.tier, message: d.message || null });
  if (error) return NextResponse.json({ error: "Couldn't send your request. Please try again." }, { status: 500 });
  const owners = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const to of owners)
    await sendEmail(to, `New sponsor inquiry: ${d.company} (${d.tier})`, emailLayout("New sponsor inquiry", `<p><strong>${esc(d.company)}</strong> · ${esc(d.contact)} · ${esc(d.email)}</p><p>Type: ${d.tier}${d.website ? ` · ${esc(d.website)}` : ""}</p><p>${esc(d.message || "")}</p>`)).catch(() => false);
  return NextResponse.json({ ok: true });
}
