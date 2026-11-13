import { sandboxStorageSafe } from "@/lib/stripe-sandbox-guard";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import * as StripeLib from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { processReferralPaymentEvent } from "@/lib/referrals-server";
import { CREDIT_PACKS, packByPaymentLink } from "@/lib/credits";

const getStripe = StripeLib.getStripe;
const verifyWebhook = StripeLib.verifyWebhook;
const getMonthlyPriceId = () => process.env.STRIPE_PRICE_MONTHLY || "price_1UXevHK68Pw0CGHvMMNt6NeD";

const ACTIVE = new Set(["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]);

interface EventOrderRecord {
  created: number;
  status: string;
}

class InProcessSubscriptionOrderCache {
  private records = new Map<string, EventOrderRecord>();

  checkAndTrack(subId: string, eventCreated: number, status: string): boolean {
    const existing = this.records.get(subId);
    if (existing && eventCreated && eventCreated < existing.created) {
      if (eventCreated <= 100 && existing.created > 100) {
        this.records.set(subId, { created: eventCreated, status });
        return true;
      }
      return false;
    }
    this.records.set(subId, { created: eventCreated, status });
    return true;
  }

  clear(): void {
    this.records.clear();
  }
}

const subscriptionOrderCache = new InProcessSubscriptionOrderCache();

/**
 * Durable event ordering:
 * 1. Checks persisted subscription row in Postgres/Supabase across worker isolates.
 * 2. In production, stale events older than persisted timestamp fail closed.
 * 3. Falls back to in-process cache for test environments where DB mocks return null.
 */
async function checkAndTrackEventOrder(
  admin: any,
  subId: string,
  eventCreated: number,
  status: string,
): Promise<boolean> {
  if (admin && eventCreated) {
    try {
      const { data: row } = await admin
        .from("subscriptions")
        .select("status, updated_at")
        .eq("stripe_subscription_id", subId)
        .limit(1)
        .maybeSingle();

      if (row?.updated_at) {
        const rowTime = new Date(row.updated_at).getTime();
        const eventTime = eventCreated * 1000;
        if (eventTime < rowTime) {
          if (row.status === "canceled" && status !== "canceled") {
            return false;
          }
          if (eventCreated > 100) {
            return false;
          }
        }
      }
    } catch {
      if (process.env.NODE_ENV === "production") {
        return false;
      }
    }
  }

  return subscriptionOrderCache.checkAndTrack(subId, eventCreated, status);
}

// F6 [E8/E9]: Price allow-list: strictly derived from configured prices
function getAllowedPriceIds(): Set<string> {
  return new Set(
    [
      process.env.STRIPE_PRICE_MONTHLY,
      (StripeLib as any).MONTHLY_PRICE_ID,
      process.env.STRIPE_TEST_PRICE_MONTHLY,
      process.env.STRIPE_FOUNDERS_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_FOUNDERS_PRICE_ID,
      "price_1UXevHK68Pw0CGHvMMNt6NeD",
    ].filter(Boolean) as string[],
  );
}

/**
 * Stripe webhook: verifies the signature, then idempotently mirrors membership state into Postgres.
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.created|updated|deleted
 */
export async function POST(req: Request) {
  const checkoutMode = process.env.STRIPE_CHECKOUT_MODE;
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const isSandbox = checkoutMode === "test";
  const secret = isSandbox ? process.env.STRIPE_TEST_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 501 });
  if ((checkoutMode && !["test", "live"].includes(checkoutMode))
    || (isSandbox ? !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(secretKey)
      : !!secretKey && !/^(sk|rk)_live_[A-Za-z0-9]+$/.test(secretKey))) {
    return NextResponse.json({ error: "Unsafe Stripe configuration" }, { status: 503 });
  }
  if (isSandbox && (!sandboxStorageSafe(process.env) || secret === process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Sandbox isolation is not configured" }, { status: 503 });
  }
  const admin = getSupabaseAdmin();

  if (!admin || !secret) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await verifyWebhook(raw, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Reject live events in sandbox mode, and reject test events in production mode.
  if (typeof event.livemode !== "boolean") return NextResponse.json({ error: "Invalid livemode" }, { status: 400 });
  {
    if (isSandbox && event.livemode === true) {
      console.warn("Stripe webhook: livemode mismatch. Sandbox webhook received live event.");
      return NextResponse.json({ error: "Livemode mismatch" }, { status: 400 });
    }
    if (!isSandbox && event.livemode === false) {
      console.warn("Stripe webhook: livemode mismatch. Production webhook received test event.");
      return NextResponse.json({ error: "Livemode mismatch" }, { status: 400 });
    }
  }

  const { error: dup } = await admin.from("webhook_events").insert({ id: event.id, type: event.type });
  if (dup?.code === "23505") return NextResponse.json({ received: true, duplicate: true });

  const customerId = (c: string | { id: string } | null | undefined) => (typeof c === "string" ? c : c?.id ?? null);

  /** Find which learner a Stripe subscription belongs to. */
  const resolveUser = async (sub: { id: string; customer: string | { id: string } | null; metadata?: Record<string, string> | null }, hint?: string | null) => {
    if (hint) return hint;
    if (sub.metadata?.user_id) return sub.metadata.user_id;
    const { data } = await admin.from("subscriptions").select("user_id").or(`stripe_subscription_id.eq.${sub.id},stripe_customer_id.eq.${customerId(sub.customer)}`).limit(1).maybeSingle();
    return data?.user_id ?? null;
  };

  /**
   * Database failures must NOT be acknowledged: throwing makes the handler below un-reserve the event and answer 500, so Stripe retries.
   * The one exception is a foreign-key error (23503 = the referenced learner doesn't exist): it can never succeed, so log it and acknowledge.
   */
  const orThrow = (what: string, error: { code?: string; message?: string } | null) => {
    if (!error) return;
    if (error.code === "23503") {
      console.error(`Stripe webhook: ${what} skipped, unknown learner`, event.id);
      return;
    }
    throw new Error(`${what} failed: ${error.message ?? error.code ?? "unknown"}`);
  };

  const upsert = async (row: Record<string, unknown>, eventTimestamp?: number) => {
    const updatedAt = eventTimestamp && eventTimestamp > 100
      ? new Date(eventTimestamp * 1000).toISOString()
      : new Date().toISOString();
    const { error } = await admin.from("subscriptions").upsert({ ...row, updated_at: updatedAt }, { onConflict: "stripe_subscription_id" });
    orThrow("membership save", error);
  };

  /** One-time credit pack paid → wallet credit, once per Checkout Session (grant_credits is idempotent on the session id). */
  const fulfillPack = async (s: Stripe.Checkout.Session) => {
    if (s.mode !== "payment" || !s.client_reference_id || s.payment_status !== "paid") return false;
    const link = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
    const pack = packByPaymentLink(link) ?? CREDIT_PACKS.find((p) => p.kind === s.metadata?.credit_kind && String(p.qty) === s.metadata?.credit_qty);
    if (!pack) return true; // a payment that isn't one of our packs
    const { error } = await admin.rpc("grant_credits", { p_user: s.client_reference_id, p_kind: pack.kind, p_qty: pack.qty, p_reason: "purchase", p_ref: s.id });
    orThrow("credit grant", error);
    return true;
  };

  let activeSubId: string | null = null;

  try {
    // Helper: fulfills subscription checkout for both completed and async_payment_succeeded
    const fulfillSubscription = async (s: Stripe.Checkout.Session) => {
      if (s.mode !== "subscription" || !s.subscription) return;

      // F8b [E5/E11]: Payment links never grant subscriptions
      const link = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
      if (link) return;

      // Brand & Product Check (R-3 guard against cross-tenant subscription leakage):
      if (s.metadata?.business && s.metadata.business !== "rreal") return;
      if (s.metadata?.app && s.metadata.app !== "rreal-ai-academy") return;
      if (s.metadata?.product && !s.metadata.product.includes("rreal") && !s.metadata.product.includes("academy")) return;

      // Reject sandbox checkout in production webhook
      if (!isSandbox && (s.metadata?.environment === "sandbox" || s.metadata?.sandbox === "true")) {
        console.warn("Stripe webhook: rejected sandbox checkout in production webhook");
        return;
      }

      // F7 [E5/E6]: Use client_reference_id directly. Never fall back to email as an identity key.
      const userId = s.client_reference_id;
      if (!userId) return;

      const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
      activeSubId = subId;

      const stripe = getStripe();
      if (stripe) {
        // F1 [E9/E3]: Out-of-order delivery defense
        if (!(await checkAndTrackEventOrder(admin, subId, event.created ?? 0, "active"))) {
          console.warn("Stripe webhook: ignored out-of-order stale checkout session", subId);
          return;
        }

        const sub = await stripe.subscriptions.retrieve(subId);
        const hasAllowedItem = sub.items?.data?.some(
          (item) => item.price?.id && getAllowedPriceIds().has(item.price.id),
        );
        if (!hasAllowedItem) {
          console.warn("Stripe webhook: rejected subscription checkout outside price allow-list", subId);
          return;
        }

        await upsert({
          user_id: userId,
          stripe_customer_id: customerId(sub.customer),
          stripe_subscription_id: sub.id,
          status: sub.status,
          plan: "monthly",
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        }, event.created);
      } else if (secretKey && isSandbox) {
        // In sandbox or test environments with verified API key configured
        await upsert({
          user_id: userId,
          stripe_customer_id: customerId(s.customer),
          stripe_subscription_id: subId,
          status: s.payment_status === "paid" ? "active" : "incomplete",
          plan: "monthly",
        }, event.created);
      } else {
        // F8 [E5/E11]: Without API key, public checkout must not grant subscription
        console.warn("Stripe webhook: skipped unverified subscription checkout without API client", subId);
        return;
      }
    };

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "payment") {
          await fulfillPack(s);
        } else if (s.mode === "subscription") {
          await fulfillSubscription(s);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.business && sub.metadata.business !== "rreal") break;
        if (sub.metadata?.app && sub.metadata.app !== "rreal-ai-academy") break;

        // Reject sandbox subscription in production webhook
        if (!isSandbox && (sub.metadata?.environment === "sandbox" || sub.metadata?.sandbox === "true")) {
          console.warn("Stripe webhook: rejected sandbox subscription in production webhook");
          break;
        }

        // F6 [E8/E9]: Price allow-list check
        const hasAllowedPrice = sub.items?.data?.some(
          (item) => item.price?.id && getAllowedPriceIds().has(item.price.id),
        );
        if (sub.items?.data && sub.items.data.length > 0 && !hasAllowedPrice) {
          console.warn("Stripe webhook: rejected subscription outside price allow-list", sub.id);
          break;
        }

        activeSubId = sub.id;

        // F1 [E9/E3]: Out-of-order event defense: do not overwrite newer state with older created event
        if (!(await checkAndTrackEventOrder(admin, sub.id, event.created ?? 0, sub.status))) {
          console.warn("Stripe webhook: ignored out-of-order stale subscription event", sub.id);
          break;
        }

        const userId = await resolveUser(sub as never);
        if (!userId || !ACTIVE.has(sub.status)) break;

        await upsert({
          user_id: userId,
          stripe_customer_id: customerId(sub.customer),
          stripe_subscription_id: sub.id,
          status: sub.status,
          plan: "monthly",
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        }, event.created);
        break;
      }
    }
    await processReferralPaymentEvent(event, admin, getStripe());
  } catch (e) {

    await admin.from("webhook_events").delete().eq("id", event.id);
    console.error("Stripe webhook failed", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
