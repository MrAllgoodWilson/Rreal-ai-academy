import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Creates a Stripe Checkout session with a 7-day free trial. 501 in demo mode (client starts a local trial). */
export async function POST(req: Request) {
  const stripe = getStripe();
  const sb = getSupabaseServer();
  if (!stripe || !sb) return NextResponse.json({ demo: true }, { status: 501 });
  const parsed = z.object({ plan: z.enum(["monthly", "annual"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  const price = PRICE_IDS[parsed.data.plan];
  if (!price) return NextResponse.json({ error: "Price not configured" }, { status: 500 });

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data: existing } = await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).not("stripe_customer_id", "is", null).limit(1).maybeSingle();

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: auth.user.id,
    customer: existing?.stripe_customer_id ?? undefined,
    customer_email: existing?.stripe_customer_id ? undefined : auth.user.email,
    subscription_data: { trial_period_days: 7, metadata: { user_id: auth.user.id, plan: parsed.data.plan } },
    allow_promotion_codes: true,
    success_url: `${site}/dashboard?checkout=success`,
    cancel_url: `${site}/pricing?checkout=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
