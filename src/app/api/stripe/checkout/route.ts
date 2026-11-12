import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { resolveCheckoutPrice } from "@/lib/stripe-sandbox-guard";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Starts the $1/month membership checkout.
 * - With STRIPE_SECRET_KEY: creates a Checkout Session (best experience).
 * - Otherwise: falls back to the Stripe Payment Link (NEXT_PUBLIC_STRIPE_PAYMENT_LINK) tagged with the user id.
 * - Demo mode (no Supabase): 501 → the client activates a local demo membership.
 */
export async function POST(req: Request) {
  const checkout = resolveCheckoutPrice(process.env);
  if (!checkout) return NextResponse.json({ error: "Stripe sandbox checkout is not configured safely." }, { status: 503 });
  const sb = await getSupabaseServer();
  if (!sb) return checkout.sandbox
    ? NextResponse.json({ error: "Sandbox requires working account storage." }, { status: 503 })
    : NextResponse.json({ demo: true }, { status: 501 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = getStripe();
  if (stripe) {
    // Sandbox customer IDs are separate from live Stripe customer IDs.
    const existing = checkout.sandbox ? null : (await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).not("stripe_customer_id", "is", null).limit(1).maybeSingle()).data;
    const clientId = checkout.sandbox
      ? (auth.user.id.startsWith("sandbox_") || auth.user.id.startsWith("test_") ? auth.user.id : `sandbox_${auth.user.id}`)
      : auth.user.id;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: checkout.priceId, quantity: 1 }],
      client_reference_id: clientId,
      customer: existing?.stripe_customer_id ?? undefined,
      customer_email: existing?.stripe_customer_id ? undefined : auth.user.email,
      subscription_data: {
        metadata: {
          user_id: clientId,
          plan: "monthly",
          app: "rreal-ai-academy",
          ...(checkout.sandbox ? { environment: "sandbox" } : {}),
        },
      },
      metadata: {
        app: "rreal-ai-academy",
        ...(checkout.sandbox ? { environment: "sandbox" } : {}),
      },
      allow_promotion_codes: !checkout.sandbox,
      success_url: `${site}/subscribe?checkout=success`,
      cancel_url: `${site}/subscribe?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  }

  // Sandbox must never redirect visitors to the existing live Payment Link.
  if (checkout.sandbox) return NextResponse.json({ error: "Stripe test checkout requires a configured test API client." }, { status: 503 });
  const link = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;
  if (link) {
    const u = new URL(link);
    u.searchParams.set("client_reference_id", auth.user.id);
    if (auth.user.email) u.searchParams.set("prefilled_email", auth.user.email);
    return NextResponse.json({ url: u.toString() });
  }
  return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
}
