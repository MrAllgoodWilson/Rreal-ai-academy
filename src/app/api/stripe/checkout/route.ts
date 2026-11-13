import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { resolveCheckoutPrice } from "@/lib/stripe-sandbox-guard";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getDefaultFoundersRulesEngine, RateForfeitedException } from "@/lib/founders";

/**
 * Starts the membership checkout session.
 * - With STRIPE_SECRET_KEY: creates an authenticated Checkout Session.
 * - Without STRIPE_SECRET_KEY: fails closed (503) to prevent ungranted payments.
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

  // F5 [E4/E7] & Probe D: Double billing defense & forfeiture enforcement
  const existing = (
    await sb
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("user_id", auth.user.id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle()
  ).data;

  const NON_CHECKOUT_STATUSES = new Set(["active", "trialing", "canceled", "past_due", "paused", "unpaid"]);
  if (existing?.status && NON_CHECKOUT_STATUSES.has(existing.status)) {
    return NextResponse.json(
      { error: "Account already has an active or forfeited subscription. Cannot start a second checkout." },
      { status: 400 },
    );
  }

  // Founders Beta qualification check via rules engine
  const isFounders = [
    process.env.STRIPE_FOUNDERS_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_FOUNDERS_PRICE_ID,
  ].filter(Boolean).includes(checkout.priceId);

  if (isFounders) {
    try {
      const engine = getDefaultFoundersRulesEngine();
      await engine.qualifyAccount(
        "rreal",
        {
          accountId: auth.user.id,
          registeredAt: auth.user.created_at || new Date().toISOString(),
          authVerified: true,
        },
      );
    } catch (err) {
      if (err instanceof RateForfeitedException) {
        return NextResponse.json({ error: "Founders rate permanently forfeited." }, { status: 403 });
      }
      return NextResponse.json({ error: (err as Error).message || "Founders qualification failed." }, { status: 400 });
    }
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = getStripe();
  if (stripe) {
    const clientId = auth.user.id;

    // In sandbox, customer IDs are separate from live Stripe customer IDs
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: checkout.priceId, quantity: 1 }],
      client_reference_id: clientId,
      customer: checkout.sandbox ? undefined : (existing?.stripe_customer_id ?? undefined),
      customer_email: (checkout.sandbox ? false : existing?.stripe_customer_id) ? undefined : auth.user.email,
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

  // Probe C: Fail closed without Stripe API client to prevent charging customers without entitlement
  return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
}
