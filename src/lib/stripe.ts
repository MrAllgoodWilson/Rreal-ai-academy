import "server-only";
import Stripe from "stripe";

/** Fetch-based client + Web Crypto so Stripe works on Cloudflare Workers as well as Node. */
const opts = { httpClient: Stripe.createFetchHttpClient() };

let client: Stripe | null = null;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key, opts);
  return client;
}

/** $1/month membership price (live). Override with STRIPE_PRICE_MONTHLY. */
export const MONTHLY_PRICE_ID = process.env.STRIPE_PRICE_MONTHLY || "price_1UXevHK68Pw0CGHvMMNt6NeD";

/** Verifies a webhook signature with Web Crypto (works without an API key). */
export function verifyWebhook(raw: string, signature: string, secret: string) {
  const s = getStripe() ?? new Stripe("sk_unused_for_webhook_verification", opts);
  return s.webhooks.constructEventAsync(raw, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
}
