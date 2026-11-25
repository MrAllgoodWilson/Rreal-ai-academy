import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, verifyWebhook, MONTHLY_PRICE_ID } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { processReferralPaymentEvent } from "@/lib/referrals-server";
import { CREDIT_PACKS, packByPaymentLink } from "@/lib/credits";


const ACTIVE = new Set(["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]);

/**
 * Stripe webhook: verifies the signature, then idempotently mirrors membership state into Postgres.
 * Works for Checkout Sessions (API key) and Payment Links (client_reference_id = user id).
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.created|updated|deleted, charge.refunded, charge.dispute.created, charge.dispute.closed
 */
export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!admin || !secret) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await verifyWebhook(raw, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
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

  /** A subscription counts as membership only if it is for the monthly membership price. Subscriptions without item data (Payment Link path) can't be checked and pass. */
  const isMembershipPrice = (sub: { items?: { data?: { price?: { id?: string } }[] } }) => {
    const ids = (sub.items?.data ?? []).map((i) => i.price?.id).filter(Boolean);
    return ids.length === 0 || ids.includes(MONTHLY_PRICE_ID);
  };

  const upsert = async (row: Record<string, unknown>) => {
    const { error } = await admin.from("subscriptions").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" });
    orThrow("membership save", error);
  };

  /** Which credit pack a one-time Checkout Session bought, if any. */
  const packOf = (s: Stripe.Checkout.Session) => {
    const link = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
    return packByPaymentLink(link) ?? CREDIT_PACKS.find((p) => p.kind === s.metadata?.credit_kind && String(p.qty) === s.metadata?.credit_qty);
  };

  /** The credit-pack Checkout Session a charge paid for, or null (subscription charges, other payments, no Stripe client). */
  const packSessionForCharge = async (charge: Stripe.Charge) => {
    const stripe = getStripe();
    if (!stripe) return null;
    const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!pi) return null;
    const sessions = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
    const s = sessions.data[0];
    return s && s.mode === "payment" && packOf(s) ? s : null;
  };

  const chargeOfDispute = async (d: Stripe.Dispute) => {
    const chargeId = typeof d.charge === "string" ? d.charge : d.charge?.id;
    const stripe = getStripe();
    return chargeId && stripe ? stripe.charges.retrieve(chargeId) : null;
  };

  /**
   * A fully refunded charge or a new dispute on a credit-pack payment takes the credits back (idempotent per session).
   * Partial refunds are ignored on purpose (no way to know how many credits they stand for). Subscription charges are not credit packs and are skipped.
   */
  const reverseCreditPack = async (ev: Stripe.Event) => {
    let charge: Stripe.Charge | null;
    if (ev.type === "charge.refunded") {
      charge = ev.data.object as Stripe.Charge;
      if (!charge.refunded) return;
    } else {
      charge = await chargeOfDispute(ev.data.object as Stripe.Dispute);
    }
    const s = charge ? await packSessionForCharge(charge) : null;
    if (!s) return;
    const { data, error } = await admin.rpc("reverse_credits", { p_ref: s.id });
    orThrow("credit reversal", error);
    if (data && (data as { shortfall?: number }).shortfall) console.error("Stripe webhook: credits already spent, partial reversal", event.id, data);
  };

  /** A dispute we won gives back exactly what the earlier reversal took (idempotent; credits that were never taken back are not touched). */
  const restoreCreditPack = async (d: Stripe.Dispute) => {
    if (d.status !== "won") return;
    const charge = await chargeOfDispute(d);
    const s = charge ? await packSessionForCharge(charge) : null;
    if (!s) return;
    const { error } = await admin.rpc("restore_credits", { p_ref: s.id });
    orThrow("credit restore", error);
  };

  /** One-time credit pack paid → wallet credit, once per Checkout Session (grant_credits is idempotent on the session id). */
  const fulfillPack = async (s: Stripe.Checkout.Session) => {
    if (s.mode !== "payment" || !s.client_reference_id || s.payment_status !== "paid") return false;
    const pack = packOf(s);
    if (!pack) return true; // a payment that isn't one of our packs
    const { error } = await admin.rpc("grant_credits", { p_user: s.client_reference_id, p_kind: pack.kind, p_qty: pack.qty, p_reason: "purchase", p_ref: s.id });
    orThrow("credit grant", error);
    return true;
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        // One-time credit pack purchase → add credits to the learner's wallet (idempotent per session).
        if (s.mode === "payment") {
          await fulfillPack(s);
          break;
        }
        if (s.mode !== "subscription" || !s.subscription || !s.client_reference_id) break;
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
        const stripe = getStripe();
        if (stripe) {
          const sub = await stripe.subscriptions.retrieve(subId);
          if (!isMembershipPrice(sub)) { console.error("Stripe webhook: subscription is not the membership price, ignored", event.id); break; }
          await upsert({ user_id: s.client_reference_id, stripe_customer_id: customerId(sub.customer), stripe_subscription_id: sub.id, status: sub.status, plan: "monthly", current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null, cancel_at_period_end: sub.cancel_at_period_end });
        } else {
          // Payment Link without API key: payment completed ⇒ membership active.
          await upsert({ user_id: s.client_reference_id, stripe_customer_id: customerId(s.customer), stripe_subscription_id: subId, status: s.payment_status === "paid" ? "active" : "incomplete", plan: "monthly" });
        }
        break;
      }
      case "charge.refunded":
      case "charge.dispute.created": {
        await reverseCreditPack(event);
        break;
      }
      case "charge.dispute.closed": {
        await restoreCreditPack(event.data.object as Stripe.Dispute);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        // Delayed payment methods: the session completes unpaid, then succeeds later. Needs this event enabled on the Stripe webhook endpoint.
        await fulfillPack(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUser(sub as never);
        if (!userId || !ACTIVE.has(sub.status)) break;
        if (!isMembershipPrice(sub)) { console.error("Stripe webhook: subscription is not the membership price, ignored", event.id); break; }
        await upsert({ user_id: userId, stripe_customer_id: customerId(sub.customer), stripe_subscription_id: sub.id, status: sub.status, plan: "monthly", current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null, cancel_at_period_end: sub.cancel_at_period_end });
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
