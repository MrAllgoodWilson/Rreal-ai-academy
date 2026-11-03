import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}

/** $1/month membership price (live). Override with STRIPE_PRICE_MONTHLY. */
export const MONTHLY_PRICE_ID = process.env.STRIPE_PRICE_MONTHLY || "price_1UXevHK68Pw0CGHvMMNt6NeD";

/** Webhook signature verification only needs the webhook secret; the API key may be absent. */
export const webhookVerifier = () => getStripe() ?? new Stripe("sk_unused_for_webhook_verification");
