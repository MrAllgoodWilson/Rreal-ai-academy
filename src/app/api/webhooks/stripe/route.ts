import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Stripe webhook: verifies the signature, then idempotently mirrors subscription state into Postgres.
 * Configure in Stripe: checkout.session.completed, customer.subscription.created|updated|deleted
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !secret) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: skip events we've already processed (Stripe retries).
  const { error: dup } = await admin.from("webhook_events").insert({ id: event.id, type: event.type });
  if (dup?.code === "23505") return NextResponse.json({ received: true, duplicate: true });

  const upsertSub = async (sub: Stripe.Subscription, userIdHint?: string | null) => {
    const userId = (sub.metadata?.user_id as string) || userIdHint;
    if (!userId) return;
    const item = sub.items.data[0];
    const plan = (sub.metadata?.plan as string) || (item?.price.recurring?.interval === "year" ? "annual" : "monthly");
    await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        plan,
        trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) await upsertSub(await stripe.subscriptions.retrieve(String(s.subscription)), s.client_reference_id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await upsertSub(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (e) {
    // Remove the idempotency marker so Stripe's retry can reprocess
    await admin.from("webhook_events").delete().eq("id", event.id);
    console.error("Stripe webhook failed", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
