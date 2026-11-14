import "server-only";
import { COMPANY_PILOT_CONFIG } from "@/lib/founders/company-inventory";
import type { WebhookEventPayload } from "@/lib/founders/types";
import { getDefaultFoundersRulesEngine, getFoundersStore, withFoundersAccountLock } from "@/lib/founders-engine";

/**
 * Adapter between a signature-verified Stripe subscription and the account-bound Founders rules engine.
 *
 * Identity: the engine needs an account id. It is NEVER read from the event; the caller passes the account that
 * our own authenticated checkout bound to this subscription (checkout_bindings).
 *
 * Price: the engine's allow-list holds a canonical key per company. The real Stripe price id is deployment
 * configuration (STRIPE_FOUNDERS_PRICE_ID); this adapter verifies the event's price id, amount, currency and
 * interval against that configuration and only then hands the engine its canonical key.
 */
export const FOUNDERS_COMPANY = "rreal" as const;
export const FOUNDERS_UNIT_AMOUNT = 499;
export const FOUNDERS_CURRENCY = "usd";
export const FOUNDERS_INTERVAL = "month";

/** Statuses the engine models. Anything else (incomplete, incomplete_expired, paused) grants nothing. */
const ENGINE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "canceled"]);

export function configuredFoundersPriceId(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const id = env.STRIPE_FOUNDERS_PRICE_ID || "";
  return /^price_[A-Za-z0-9_]+$/.test(id) ? id : null;
}

export interface FoundersSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string } | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  items?: { data?: Array<{ price?: { id?: string; unit_amount?: number | null; currency?: string; recurring?: { interval?: string } | null } | null }> } | null;
}

export function subscriptionPriceIds(sub: FoundersSubscriptionLike): string[] {
  return (sub.items?.data ?? []).map((i) => i.price?.id).filter((x): x is string => typeof x === "string");
}

export function isFoundersPriced(sub: FoundersSubscriptionLike, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const founders = configuredFoundersPriceId(env);
  return !!founders && subscriptionPriceIds(sub).includes(founders);
}

/** Throws unless the subscription is exactly one Founders item at the approved amount, currency and interval. */
export function assertFoundersTerms(sub: FoundersSubscriptionLike, env: Readonly<Record<string, string | undefined>> = process.env): void {
  const founders = configuredFoundersPriceId(env);
  if (!founders) throw new Error("Founders price is not configured");
  const items = sub.items?.data ?? [];
  if (items.length !== 1) throw new Error("Founders subscription must have exactly one item");
  const price = items[0].price;
  if (!price || price.id !== founders) throw new Error("Founders subscription price mismatch");
  if (price.unit_amount !== FOUNDERS_UNIT_AMOUNT) throw new Error("Founders subscription amount mismatch");
  if ((price.currency || "").toLowerCase() !== FOUNDERS_CURRENCY) throw new Error("Founders subscription currency mismatch");
  if (price.recurring?.interval !== FOUNDERS_INTERVAL) throw new Error("Founders subscription interval mismatch");
}

export interface FoundersApplyResult {
  /** Engine outcome label, or a skip reason. */
  outcome: string;
  /** True when the membership mirror may be written for this subscription. */
  mirror: boolean;
}

/**
 * Runs the rules engine for one verified subscription state. Idempotent per event id (the engine claims the id
 * inside its own transaction), so a provider retry after a crash converges.
 *
 * The mirror decision follows durable engine state, not the engine's return label: the membership mirror may be
 * written only when the account's Founders enrollment is this exact subscription.
 */
export async function applyFoundersSubscription(input: {
  eventId: string;
  eventType: "customer.subscription.created" | "customer.subscription.updated" | "customer.subscription.deleted";
  eventCreated: number;
  livemode: boolean;
  accountId: string;
  sub: FoundersSubscriptionLike;
}): Promise<FoundersApplyResult> {
  const { sub } = input;
  if (!input.eventCreated || input.eventCreated <= 0) throw new Error("Founders event has no valid timestamp");
  if (!ENGINE_STATUSES.has(sub.status)) return { outcome: `status_${sub.status}_grants_nothing`, mirror: false };

  assertFoundersTerms(sub);

  const canonicalPrice = COMPANY_PILOT_CONFIG[FOUNDERS_COMPANY].foundersPriceId;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const payload: WebhookEventPayload = {
    id: input.eventId,
    type: input.eventType,
    livemode: input.livemode,
    created: input.eventCreated,
    data: {
      object: {
        id: sub.id,
        customer: customer ?? undefined,
        status: sub.status,
        current_period_end: sub.current_period_end ?? undefined,
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        items: { data: [{ price: { id: canonicalPrice, unit_amount: FOUNDERS_UNIT_AMOUNT, currency: FOUNDERS_CURRENCY, recurring: { interval: FOUNDERS_INTERVAL } } }] },
        client_reference_id: input.accountId,
        metadata: { company_id: FOUNDERS_COMPANY },
      },
    },
  };

  // Events for one account are serialized across all processes (see withFoundersAccountLock).
  return withFoundersAccountLock(FOUNDERS_COMPANY, input.accountId, async () => {
    const result = await getDefaultFoundersRulesEngine().processSubscriptionWebhook(FOUNDERS_COMPANY, payload);
    const enrollment = await getFoundersStore().getEnrollment(FOUNDERS_COMPANY, input.accountId);
    return { outcome: result.status, mirror: !!enrollment && enrollment.providerSubscriptionId === sub.id };
  });
}
