import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Opens the Stripe Customer Portal (update card, cancel, switch plan, invoices). */
export async function POST(req: Request) {
  const stripe = getStripe();
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ demo: true }, { status: 501 });
  // Without an API key, use Stripe's no-code customer portal login link.
  if (!stripe) {
    const url = process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL;
    return url ? NextResponse.json({ url }) : NextResponse.json({ error: "Billing portal isn't configured yet." }, { status: 503 });
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).not("stripe_customer_id", "is", null).limit(1).maybeSingle();
  if (!data?.stripe_customer_id) return NextResponse.json({ error: "No billing account yet." }, { status: 404 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session = await stripe.billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${site}/settings` });
  return NextResponse.json({ url: session.url });
}
