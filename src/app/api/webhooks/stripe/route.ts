import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, verifyWebhook } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";


const ACTIVE = new Set(["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]);

/**
 * Stripe webhook: verifies the signature, then idempotently mirrors membership state into Postgres.
 * Works for Checkout Sessions (API key) and Payment Links (client_reference_id = user id).
 * Events: checkout.session.completed, customer.subscription.created|updated|deleted, invoice.paid
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

  const upsert = async (row: Record<string, unknown>) => {
    await admin.from("subscriptions").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" });
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
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
  } catch (e) {
    await admin.from("webhook_events").delete().eq("id", event.id);
    console.error("Stripe webhook failed", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
