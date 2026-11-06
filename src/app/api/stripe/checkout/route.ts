import { NextResponse } from "next/server";
import { getStripe, MONTHLY_PRICE_ID } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Starts the $1/month membership checkout.
 * - With STRIPE_SECRET_KEY: creates a Checkout Session (best experience).
 * - Otherwise: falls back to the Stripe Payment Link (NEXT_PUBLIC_STRIPE_PAYMENT_LINK) tagged with the user id.
 * - Demo mode (no Supabase): 501 → the client activates a local demo membership.
 */
export async function POST(req: Request) {
  const sb = await getSupabaseServer();
  if (!sb) return NextResponse.json({ demo: true }, { status: 501 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = getStripe();
  if (stripe) {
    const { data: existing } = await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).not("stripe_customer_id", "is", null).limit(1).maybeSingle();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: MONTHLY_PRICE_ID, quantity: 1 }],
      client_reference_id: auth.user.id,
      customer: existing?.stripe_customer_id ?? undefined,
      customer_email: existing?.stripe_customer_id ? undefined : auth.user.email,
      subscription_data: { metadata: { user_id: auth.user.id, plan: "monthly", app: "rreal-ai-academy" } },
      allow_promotion_codes: true,
      success_url: `${site}/subscribe?checkout=success`,
      cancel_url: `${site}/subscribe?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  }

  const link = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;
  if (link) {
    const u = new URL(link);
    u.searchParams.set("client_reference_id", auth.user.id);
    if (auth.user.email) u.searchParams.set("prefilled_email", auth.user.email);
    return NextResponse.json({ url: u.toString() });
  }
  return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
}
