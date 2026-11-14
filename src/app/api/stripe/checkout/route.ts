import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { durableLimit } from "@/lib/durable-limit";
import { resolveCheckoutPrice } from "@/lib/stripe-sandbox-guard";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import {
  AlreadySubscribedException,
  DuplicateAccountIneligibleException,
  IneligibleAccountException,
  MissingAffirmativeConsentException,
  RateForfeitedException,
} from "@/lib/founders/rules-engine";
import { getDefaultFoundersRulesEngine } from "@/lib/founders-engine";
import { configuredFoundersPriceId, FOUNDERS_COMPANY } from "@/lib/founders-webhook";

/** Mirror statuses that mean "this account already has a subscription Stripe is still billing or collecting". */
const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

interface CheckoutBody {
  plan?: unknown;
  consent?: { affirmativeConsent?: unknown; termsHash?: unknown; termsVersion?: unknown };
}

/**
 * Starts a membership Checkout Session for the signed-in account.
 *
 *  - The session is always created server-side with our API key (no Payment Link fallback: without a key → 503).
 *  - The session id is recorded in checkout_bindings BEFORE the URL is returned. The webhook grants a Founders
 *    subscription only through that binding, so the paying account is fixed by this authenticated request.
 *  - `{"plan":"founders"}` requires an existing, non-forfeited Founders eligibility and affirmative consent to the
 *    current terms. This route never qualifies an account: qualification is an operator action.
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
  const userId = auth.user.id;
  const limited = await durableLimit("checkout", userId, 10, 10 * 60_000);
  if (limited !== "ok") {
    return limited === "limited"
      ? NextResponse.json({ error: "Too many checkout attempts. Please wait a few minutes." }, { status: 429 })
      : NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  let body: CheckoutBody = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.plan !== undefined && body.plan !== "monthly" && body.plan !== "founders") {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const founders = body.plan === "founders";

  // Double-billing defence: look at EVERY mirror row for this account, not an arbitrary first one.
  const { data: rows, error: rowsError } = await sb
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", userId);
  if (rowsError) return NextResponse.json({ error: "Couldn't check your membership. Please try again." }, { status: 503 });
  const mine = (rows ?? []) as { stripe_customer_id: string | null; status: string }[];
  if (mine.some((r) => LIVE_STATUSES.includes(r.status))) {
    return NextResponse.json({ error: "This account already has a subscription." }, { status: 409 });
  }
  const knownCustomer = mine.find((r) => r.stripe_customer_id)?.stripe_customer_id ?? null;

  let priceId = checkout.priceId;
  if (founders) {
    const foundersPrice = configuredFoundersPriceId();
    if (!foundersPrice || foundersPrice === checkout.priceId) {
      return NextResponse.json({ error: "Founders checkout isn't available." }, { status: 503 });
    }
    const consent = body.consent ?? {};
    if (consent.affirmativeConsent !== true || typeof consent.termsHash !== "string" || typeof consent.termsVersion !== "string") {
      return NextResponse.json({ error: "Please review and accept the Founders terms first." }, { status: 400 });
    }
    try {
      await getDefaultFoundersRulesEngine().createCheckoutSession(FOUNDERS_COMPANY, userId, {
        affirmativeConsent: true,
        termsHash: consent.termsHash,
        termsVersion: consent.termsVersion,
        consentTimestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof RateForfeitedException) return NextResponse.json({ error: "The Founders rate is no longer available for this account." }, { status: 403 });
      if (err instanceof AlreadySubscribedException) return NextResponse.json({ error: "This account already has a subscription." }, { status: 409 });
      if (err instanceof IneligibleAccountException || err instanceof DuplicateAccountIneligibleException) {
        return NextResponse.json({ error: "This account isn't part of the Founders pilot." }, { status: 403 });
      }
      if (err instanceof MissingAffirmativeConsentException || (err instanceof Error && err.message.startsWith("Terms hash mismatch"))) {
        return NextResponse.json({ error: "Please review and accept the current Founders terms." }, { status: 400 });
      }
      // Storage/configuration failure: fail closed, never fall through to a checkout.
      console.error("Founders checkout unavailable", err instanceof Error ? err.message : "unknown");
      return NextResponse.json({ error: "Founders checkout isn't available right now." }, { status: 503 });
    }
    priceId = foundersPrice;
  }

  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  // Fail closed without an API client or binding storage: a customer must never pay for something we can't grant.
  if (!stripe || !admin) return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const tags = { app: "rreal-ai-academy", ...(checkout.sandbox ? { environment: "sandbox" } : {}) };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    // In sandbox, customer ids are separate from live Stripe customer ids.
    customer: checkout.sandbox ? undefined : (knownCustomer ?? undefined),
    customer_email: !checkout.sandbox && knownCustomer ? undefined : auth.user.email,
    subscription_data: { metadata: { ...tags, user_id: userId, plan: founders ? "founders" : "monthly" } },
    metadata: tags,
    allow_promotion_codes: !checkout.sandbox && !founders,
    success_url: `${site}/subscribe?checkout=success`,
    cancel_url: `${site}/subscribe?checkout=cancelled`,
  });

  const { error: bindError } = await admin.from("checkout_bindings").insert({
    session_id: session.id,
    user_id: userId,
    company: FOUNDERS_COMPANY,
    kind: founders ? "founders" : "legacy_monthly",
    price_id: priceId,
    livemode: !checkout.sandbox,
  });
  if (bindError) {
    // The session can't be honoured without its binding: withhold the URL and expire it (best effort).
    console.error("Checkout binding failed", bindError.code ?? "unknown");
    try { await stripe.checkout.sessions.expire(session.id); } catch { /* it expires on its own */ }
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 503 });
  }
  return NextResponse.json({ url: session.url });
}
