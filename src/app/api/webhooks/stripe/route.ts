import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, verifyWebhook } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { processReferralPaymentEvent } from "@/lib/referrals-server";
import { CREDIT_PACKS, packByPaymentLink } from "@/lib/credits";


const ACTIVE = new Set(["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]);

/**
 * Stripe webhook: verifies the signature, then idempotently mirrors membership state into Postgres.
 * Works for Checkout Sessions (API key) and Payment Links (client_reference_id = user id).
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.created|updated|deleted
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

  const upsert = async (row: Record<string, unknown>) => {
    const { error } = await admin.from("subscriptions").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" });
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
          await upsert({ user_id: s.client_reference_id, stripe_customer_id: customerId(sub.customer), stripe_subscription_id: sub.id, status: sub.status, plan: "monthly", current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null, cancel_at_period_end: sub.cancel_at_period_end });
        } else {
          // Payment Link without API key: payment completed ⇒ membership active.
          await upsert({ user_id: s.client_reference_id, stripe_customer_id: customerId(s.customer), stripe_subscription_id: subId, status: s.payment_status === "paid" ? "active" : "incomplete", plan: "monthly" });
        }
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
