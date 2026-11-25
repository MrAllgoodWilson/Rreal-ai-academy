import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = Pick<SupabaseClient, "from" | "rpc">;
const idOf = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ProofError extends Error {
  constructor(readonly reason: string, readonly excluded = false) { super(reason); }
}

/** Called only AFTER webhook signature validation; never by an untrusted browser payment-success page. */
export async function processReferralPaymentEvent(event: Stripe.Event, admin: Admin, stripe: Stripe | null) {
  if (process.env.REFERRALS_ENABLED !== "true") return;
  const supported = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "invoice.paid", "charge.refunded", "charge.dispute.created"];
  if (!supported.includes(event.type)) return;
  const object = event.data.object as { id: string; mode?: string };
  if (event.type.startsWith("checkout.") && object.mode !== "subscription") return;
  const record = async (state: "pending" | "excluded" | "completed", reason: string) => {
    const { error } = await admin.from("referral_reconciliation").upsert({ event_id: event.id, event_type: event.type, source_id: object.id, state, reason, updated_at: new Date().toISOString() }, { onConflict: "event_id" });
    if (error) throw new Error("Referral reconciliation persistence failed");
  };
  try {
    const account = process.env.REFERRAL_STRIPE_ACCOUNT_ID;
    const mode = process.env.REFERRAL_STRIPE_LIVEMODE;
    const prices = (process.env.REFERRAL_MEMBERSHIP_PRICE_IDS || "").split(",").map((p) => p.trim()).filter(Boolean);
    if (!stripe || !account || !["true", "false"].includes(mode || "") || !prices.length) throw new ProofError("verification_configuration_missing");
    if (event.livemode !== (mode === "true") || (event.account && event.account !== account)) throw new ProofError("event_account_or_mode_mismatch", true);
    const currentAccount = await stripe.accounts.retrieve();
    if (currentAccount.id !== account) throw new ProofError("api_account_mismatch", true);

    let session: Stripe.Checkout.Session;
    let reversal: "refunded" | "disputed" | undefined;
    if (event.type.startsWith("checkout.")) {
      session = await stripe.checkout.sessions.retrieve(object.id);
    } else {
      let invoice: Stripe.Invoice;
      if (event.type === "invoice.paid") invoice = await stripe.invoices.retrieve(object.id);
      else {
        reversal = event.type === "charge.refunded" ? "refunded" : "disputed";
        const chargeId = event.type === "charge.refunded" ? object.id : idOf((await stripe.disputes.retrieve(object.id)).charge);
        if (!chargeId) throw new ProofError("charge_mapping_missing");
        const charge = await stripe.charges.retrieve(chargeId);
        if (charge.livemode !== event.livemode || (reversal === "refunded" && !charge.amount_refunded)) throw new ProofError("charge_reversal_unverified", true);
        const invoiceId = idOf(charge.invoice);
        if (!invoiceId) throw new ProofError("invoice_mapping_missing");
        invoice = await stripe.invoices.retrieve(invoiceId);
        if (idOf(invoice.customer) !== idOf(charge.customer)) throw new ProofError("charge_customer_mismatch", true);
      }
      // Only the initial, paid subscription receipt qualifies. Renewals cannot manufacture new referees.
      if (invoice.billing_reason !== "subscription_create") throw new ProofError("renewal_or_non_initial_invoice", true);
      if (!reversal && (!invoice.paid || invoice.amount_paid !== 100 || invoice.currency !== "usd")) throw new ProofError("invoice_not_qualifying_paid_dollar", true);
      const subscriptionId = idOf(invoice.subscription);
      if (!subscriptionId) throw new ProofError("invoice_subscription_missing");
      const sessions = await stripe.checkout.sessions.list({ subscription: subscriptionId, limit: 2 });
      const candidates = sessions.data.filter((s) => idOf(s.invoice) === invoice.id && idOf(s.customer) === idOf(invoice.customer));
      if (candidates.length !== 1) throw new ProofError("initial_session_mapping_ambiguous");
      session = await stripe.checkout.sessions.retrieve(candidates[0].id);
    }
    if (session.livemode !== event.livemode || session.mode !== "subscription" || session.payment_status !== "paid" || session.amount_total !== 100 || session.currency !== "usd") throw new ProofError("session_not_qualifying_paid_dollar", true);
    const subscriptionId = idOf(session.subscription);
    const customerId = idOf(session.customer);
    if (!subscriptionId || !customerId || !session.client_reference_id || !uuid.test(session.client_reference_id)) throw new ProofError("session_owner_or_subscription_missing");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.livemode !== event.livemode || idOf(subscription.customer) !== customerId) throw new ProofError("subscription_customer_mismatch", true);
    // user_id/app are set by our authenticated Checkout creation, never derived from Payment Link query text.
    if (subscription.metadata.app !== "rreal-ai-academy" || subscription.metadata.user_id !== session.client_reference_id) throw new ProofError("trusted_owner_binding_missing");
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
    const monthlyItems = subscription.items.data;
    if (items.has_more || items.data.length !== 1 || items.data[0].quantity !== 1 || !prices.includes(items.data[0].price?.id || "") || monthlyItems.length !== 1 || monthlyItems[0].quantity !== 1 || !prices.includes(monthlyItems[0].price.id) || monthlyItems[0].price.id !== items.data[0].price?.id || monthlyItems[0].price.recurring?.interval !== "month" || monthlyItems[0].price.unit_amount !== 100 || monthlyItems[0].price.currency !== "usd") throw new ProofError("membership_price_not_allowlisted", true);
    if (!session.invoice) throw new ProofError("initial_invoice_missing");
    const initial = await stripe.invoices.retrieve(idOf(session.invoice)!);
    if (initial.billing_reason !== "subscription_create" || initial.amount_paid !== 100 || initial.currency !== "usd" || !initial.paid || idOf(initial.subscription) !== subscription.id || idOf(initial.customer) !== customerId) throw new ProofError("initial_receipt_unverified", true);
    const paidChargeId = idOf(initial.charge);
    if (!paidChargeId) throw new ProofError("settled_charge_mapping_missing");
    const paidCharge = await stripe.charges.retrieve(paidChargeId);
    if (paidCharge.livemode !== event.livemode || !paidCharge.paid || paidCharge.amount !== 100 || paidCharge.currency !== "usd" || idOf(paidCharge.customer) !== customerId) throw new ProofError("settled_charge_unverified", true);
    // Stripe paid=true can mean authorization only, not a captured payment.
    if (!paidCharge.captured || paidCharge.amount_captured !== 100) throw new ProofError("payment_not_fully_captured");
    if (!reversal && (paidCharge.amount_refunded > 0 || paidCharge.disputed)) throw new ProofError("initial_payment_already_reversed", true);
    if (reversal) {
      const { error } = await admin.rpc("referral_reverse_payment", { p_session: session.id, p_status: reversal });
      if (error) throw new Error("Referral reversal persistence failed");
    } else {
      const paidAt = initial.status_transitions.paid_at;
      if (!paidAt) throw new ProofError("settlement_timestamp_missing");
      const { error } = await admin.rpc("referral_record_first_payment", { p_user: session.client_reference_id, p_session: session.id, p_customer: customerId, p_amount: 100, p_currency: "usd", p_paid_at: new Date(paidAt * 1000).toISOString() });
      if (error) throw new Error("Referral payment persistence failed");
    }
    await record("completed", reversal ? "verified_reversal" : "verified_first_payment");
  } catch (error) {
    if (error instanceof ProofError) { await record(error.excluded ? "excluded" : "pending", error.reason); return; }
    await record("pending", "provider_or_persistence_verification_failed");
    // Provider failures must retry; do not silently classify network/auth/read-scope failures as a rejected reward.
    throw error;
  }
}
