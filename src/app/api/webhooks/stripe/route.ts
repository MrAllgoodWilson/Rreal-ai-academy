import { sandboxStorageSafe } from "@/lib/stripe-sandbox-guard";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import * as StripeLib from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { processReferralPaymentEvent } from "@/lib/referrals-server";
import { CREDIT_PACKS, packByPaymentLink } from "@/lib/credits";
import {
  applyFoundersSubscription,
  configuredFoundersPriceId,
  isFoundersPriced,
  type FoundersSubscriptionLike,
} from "@/lib/founders-webhook";

const getStripe = StripeLib.getStripe;
const verifyWebhook = StripeLib.verifyWebhook;

/** Statuses the membership mirror stores (the table's check constraint is the authority). */
const MIRRORED = new Set(["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Price allow-list: only prices this deployment is configured to sell. */
function getAllowedPriceIds(): Set<string> {
  return new Set(
    [
      process.env.STRIPE_PRICE_MONTHLY,
      (StripeLib as { MONTHLY_PRICE_ID?: string }).MONTHLY_PRICE_ID,
      process.env.STRIPE_TEST_PRICE_MONTHLY,
      configuredFoundersPriceId(),
      "price_1UXevHK68Pw0CGHvMMNt6NeD",
    ].filter(Boolean) as string[],
  );
}

interface DbError { code?: string; message?: string }
interface AccountResolution { user_id: string; kind: string; price_id?: string; company?: string; livemode?: boolean; source: string }

/**
 * Stripe webhook.
 *
 * Durability contract (migration 0011):
 *  - The event is claimed as 'processing' and only marked 'processed' after every effect has been applied. Any error or
 *    crash leaves it 'processing', the handler answers 500, and the provider retry re-runs the effects, which are all
 *    idempotent (ordered mirror upsert, per-session credit grant, per-event Founders engine claim).
 *  - The membership mirror is written by ONE atomic SQL statement (upsert_subscription_ordered). There is no
 *    read-then-write path: a missing function, an error, or an unexpected result all fail closed.
 *  - The account for a subscription comes from server-persisted state only (checkout binding or an existing mirror
 *    row), never from event metadata or e-mail.
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
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await verifyWebhook(raw, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Reject live events in sandbox mode, and test events in production mode.
  if (typeof event.livemode !== "boolean") return NextResponse.json({ error: "Invalid livemode" }, { status: 400 });
  if (isSandbox === event.livemode) {
    console.warn("Stripe webhook: livemode mismatch");
    return NextResponse.json({ error: "Livemode mismatch" }, { status: 400 });
  }
  if (typeof event.id !== "string" || !event.id) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  /** Calls a SQL function; any transport/database error throws (fail closed, retryable). */
  const rpc = async <T>(fn: string, args: Record<string, unknown>, what: string, tolerate?: (e: DbError) => boolean): Promise<T | null> => {
    const { data, error } = (await admin.rpc(fn, args)) as { data: T | null; error: DbError | null };
    if (error) {
      if (tolerate?.(error)) return null;
      throw new Error(`${what} failed: ${error.message ?? error.code ?? "unknown"}`);
    }
    return data;
  };

  // 1. Claim. 'duplicate' = already fully processed. Anything other than new/retry is an invalid result.
  let claim: string | null;
  try {
    claim = await rpc<string>("claim_webhook_event", { p_id: event.id, p_type: event.type }, "event claim");
  } catch (e) {
    console.error("Stripe webhook failed", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true });
  if (claim !== "new" && claim !== "retry") {
    console.error("Stripe webhook failed: invalid claim result");
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  const customerId = (c: string | { id: string } | null | undefined) => (typeof c === "string" ? c : c?.id ?? null);
  /** A foreign-key error (23503 = the learner no longer exists) can never succeed on retry: log and acknowledge. */
  const unknownLearner = (what: string) => (e: DbError) => {
    if (e.code !== "23503") return false;
    console.error(`Stripe webhook: ${what} skipped, unknown learner`, event.id);
    return true;
  };

  /** The ONLY writer of the membership mirror. */
  const mirror = async (userId: string, sub: FoundersSubscriptionLike & { current_period_end?: number | null }, status: string) => {
    if (!event.created || event.created <= 0) throw new Error("event has no valid timestamp");
    const result = await rpc<{ updated?: unknown; reason?: string }>(
      "upsert_subscription_ordered",
      {
        p_sub_id: sub.id,
        p_user_id: userId,
        p_customer_id: customerId(sub.customer),
        p_status: status,
        p_plan: "monthly",
        p_current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        p_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        p_event_created: event.created,
      },
      "membership save",
      unknownLearner("membership save"),
    );
    if (result === null) return; // tolerated unknown learner
    if (typeof result !== "object" || typeof result.updated !== "boolean") {
      throw new Error("membership save failed: invalid result from upsert_subscription_ordered");
    }
    if (!result.updated) {
      if (result.reason === "binding_mismatch") throw new Error("membership save failed: subscription is bound to a different account");
      console.warn("Stripe webhook: ignored out-of-order subscription state", sub.id);
    }
  };

  /** One-time credit pack paid → wallet credit, once per Checkout Session (grant_credits is idempotent on the session id). */
  const fulfillPack = async (s: Stripe.Checkout.Session) => {
    if (s.mode !== "payment" || !s.client_reference_id || s.payment_status !== "paid") return;
    const link = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
    const pack = packByPaymentLink(link) ?? CREDIT_PACKS.find((p) => p.kind === s.metadata?.credit_kind && String(p.qty) === s.metadata?.credit_qty);
    if (!pack) return; // a payment that isn't one of our packs
    await rpc("grant_credits", { p_user: s.client_reference_id, p_kind: pack.kind, p_qty: pack.qty, p_reason: "purchase", p_ref: s.id }, "credit grant", unknownLearner("credit grant"));
  };

  const fulfillSubscription = async (s: Stripe.Checkout.Session) => {
    if (s.mode !== "subscription" || !s.subscription) return;

    // Payment links never grant subscriptions: their client_reference_id is caller-controlled.
    const link = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
    if (link) return;

    // Brand & product check (guard against cross-tenant subscription leakage on a shared Stripe account).
    if (s.metadata?.business && s.metadata.business !== "rreal") return;
    if (s.metadata?.app && s.metadata.app !== "rreal-ai-academy") return;
    if (s.metadata?.product && !s.metadata.product.includes("rreal") && !s.metadata.product.includes("academy")) return;
    if (!isSandbox && (s.metadata?.environment === "sandbox" || s.metadata?.sandbox === "true")) {
      console.warn("Stripe webhook: rejected sandbox checkout in production webhook");
      return;
    }

    const userId = s.client_reference_id;
    if (!userId || !UUID_RE.test(userId)) return;

    const stripe = getStripe();
    if (!stripe) {
      // Without an API client the subscription cannot be verified, so nothing is granted.
      console.warn("Stripe webhook: skipped unverified subscription checkout without API client");
      return;
    }

    const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
    const sub = (await stripe.subscriptions.retrieve(subId)) as unknown as FoundersSubscriptionLike & { current_period_end?: number | null };
    const allowed = getAllowedPriceIds();
    if (!sub.items?.data?.some((item) => item.price?.id && allowed.has(item.price.id))) {
      console.warn("Stripe webhook: rejected subscription checkout outside price allow-list", subId);
      return;
    }

    // Bind this subscription to the account that opened the session (recorded by our authenticated checkout route).
    const binding = await rpc<{ bound?: boolean; kind?: string; price_id?: string; reason?: string }>(
      "bind_checkout_subscription",
      { p_session_id: s.id, p_user_id: userId, p_sub_id: sub.id, p_customer_id: customerId(sub.customer), p_livemode: event.livemode },
      "checkout binding",
    );
    if (!binding || typeof binding.bound !== "boolean") throw new Error("checkout binding failed: invalid result");

    if (isFoundersPriced(sub)) {
      // Founders: the session MUST be one we created for this account as a Founders checkout.
      if (!binding.bound || binding.kind !== "founders" || binding.price_id !== configuredFoundersPriceId()) {
        console.warn("Stripe webhook: Founders checkout without a matching server-side binding; nothing granted", subId);
        return;
      }
      const applied = await applyFoundersSubscription({
        eventId: event.id, eventType: "customer.subscription.updated", eventCreated: event.created,
        livemode: event.livemode, accountId: userId, sub,
      });
      if (!applied.mirror) {
        console.warn("Stripe webhook: Founders checkout not enrolled; nothing granted", subId, applied.outcome);
        return;
      }
    } else if (binding.bound ? binding.kind !== "legacy_monthly" : binding.reason !== "unknown_session") {
      // A recorded session that doesn't match (other account / mode / plan) grants nothing.
      // A session we never recorded (created before bindings existed) keeps the prior behaviour for the standard plan.
      console.warn("Stripe webhook: checkout binding mismatch; nothing granted", subId);
      return;
    }

    if (!MIRRORED.has(sub.status)) return;
    await mirror(userId, sub, sub.status);
  };

  const handleSubscriptionEvent = async (type: "customer.subscription.created" | "customer.subscription.updated" | "customer.subscription.deleted", sub: Stripe.Subscription) => {
    if (sub.metadata?.business && sub.metadata.business !== "rreal") return;
    if (sub.metadata?.app && sub.metadata.app !== "rreal-ai-academy") return;
    if (!isSandbox && (sub.metadata?.environment === "sandbox" || sub.metadata?.sandbox === "true")) {
      console.warn("Stripe webhook: rejected sandbox subscription in production webhook");
      return;
    }

    const view = sub as unknown as FoundersSubscriptionLike & { current_period_end?: number | null };
    const allowed = getAllowedPriceIds();
    const items = view.items?.data ?? [];
    if (items.length > 0 && !items.some((item) => item.price?.id && allowed.has(item.price.id))) {
      console.warn("Stripe webhook: rejected subscription outside price allow-list", sub.id);
      return;
    }

    const account = await rpc<AccountResolution>("resolve_subscription_account", { p_sub_id: sub.id }, "account resolution");
    if (!account) {
      // Not (yet) one of ours: no server-side binding exists. checkout.session.completed binds and catches up.
      console.warn("Stripe webhook: subscription has no server-side account binding; ignored", sub.id);
      return;
    }
    if (typeof account.user_id !== "string" || !UUID_RE.test(account.user_id)) throw new Error("account resolution failed: invalid result");

    if (isFoundersPriced(view)) {
      if (account.source !== "checkout_binding" || account.kind !== "founders" || account.livemode !== event.livemode
        || account.price_id !== configuredFoundersPriceId()) {
        console.warn("Stripe webhook: Founders-priced subscription without a Founders binding; nothing granted", sub.id);
        return;
      }
      const applied = await applyFoundersSubscription({
        eventId: event.id, eventType: type, eventCreated: event.created, livemode: event.livemode,
        accountId: account.user_id, sub: view,
      });
      if (!applied.mirror) {
        console.warn("Stripe webhook: Founders event produced no enrollment for this subscription", sub.id, applied.outcome);
        return;
      }
    } else if (account.kind === "founders") {
      // A Founders-bound subscription that is no longer on the Founders price is not a state we grant from.
      console.warn("Stripe webhook: Founders-bound subscription on a different price; ignored", sub.id);
      return;
    }

    if (!MIRRORED.has(sub.status)) return;
    await mirror(account.user_id, view, sub.status);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "payment") await fulfillPack(s);
        else if (s.mode === "subscription") await fulfillSubscription(s);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.type, event.data.object as Stripe.Subscription);
        break;
    }

    await processReferralPaymentEvent(event, admin, getStripe());

    // 3. Only now is the event complete.
    const done = await rpc<boolean>("complete_webhook_event", { p_id: event.id }, "event completion");
    if (done !== true) throw new Error("event completion failed: invalid result");
  } catch (e) {
    console.error("Stripe webhook failed", e);
    // Best effort note for operators; the event stays 'processing' so the provider retry re-runs it.
    try {
      await admin.rpc("fail_webhook_event", { p_id: event.id, p_error: e instanceof Error ? e.message : "unknown" });
    } catch { /* the 500 below is the signal */ }
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
