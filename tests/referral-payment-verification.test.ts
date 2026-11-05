import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processReferralPaymentEvent } from "@/lib/referrals-server";
const user = "11111111-1111-4111-8111-111111111111";
let session: Record<string, unknown>;
let sub: Record<string, unknown>;
let invoice: Record<string, unknown>;
let charge: Record<string, unknown>;
const records: Record<string, unknown>[] = [];
const rpc = vi.fn();
const stripe = {
  accounts: { retrieve: vi.fn() }, checkout: { sessions: { retrieve: vi.fn(), listLineItems: vi.fn(), list: vi.fn() } },
  subscriptions: { retrieve: vi.fn() }, invoices: { retrieve: vi.fn() }, charges: { retrieve: vi.fn() }, disputes: { retrieve: vi.fn() },
};
const admin = { from: () => ({ upsert: async (row: Record<string, unknown>) => { records.push(row); return { error: null }; } }), rpc } as unknown as SupabaseClient;
const event = (type = "checkout.session.completed", object: Record<string, unknown> = { id: "cs_first", mode: "subscription" }) => ({ id: "evt_first", type, livemode: false, data: { object } }) as unknown as Stripe.Event;
const run = (e = event(), client: Stripe | null = stripe as unknown as Stripe) => processReferralPaymentEvent(e, admin, client);
beforeEach(() => {
  vi.resetAllMocks(); records.length = 0;
  vi.stubEnv("REFERRALS_ENABLED", "true"); vi.stubEnv("REFERRAL_STRIPE_ACCOUNT_ID", "acct_verified");
  vi.stubEnv("REFERRAL_STRIPE_LIVEMODE", "false"); vi.stubEnv("REFERRAL_MEMBERSHIP_PRICE_IDS", "price_monthly");
  session = { id: "cs_first", mode: "subscription", payment_status: "paid", amount_total: 100, currency: "usd", livemode: false, client_reference_id: user, subscription: "sub_first", customer: "cus_first", invoice: "in_first" };
  sub = { id: "sub_first", customer: "cus_first", livemode: false, metadata: { user_id: user, app: "rreal-ai-academy" }, items: { data: [{ quantity: 1, price: { id: "price_monthly", unit_amount: 100, currency: "usd", recurring: { interval: "month" } } }] } };
  invoice = { id: "in_first", subscription: "sub_first", customer: "cus_first", charge: "ch_first", billing_reason: "subscription_create", paid: true, amount_paid: 100, currency: "usd", status_transitions: { paid_at: 1_700_000_000 } };
  charge = { id: "ch_first", invoice: "in_first", customer: "cus_first", amount: 100, currency: "usd", livemode: false, paid: true, amount_refunded: 0, disputed: false };
  stripe.accounts.retrieve.mockResolvedValue({ id: "acct_verified" });
  stripe.checkout.sessions.retrieve.mockImplementation(async () => session);
  stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{ quantity: 1, price: { id: "price_monthly" } }], has_more: false });
  stripe.checkout.sessions.list.mockImplementation(async () => ({ data: [session], has_more: false }));
  stripe.subscriptions.retrieve.mockImplementation(async () => sub);
  stripe.invoices.retrieve.mockImplementation(async () => invoice);
  stripe.charges.retrieve.mockImplementation(async () => charge);
  stripe.disputes.retrieve.mockResolvedValue({ charge: "ch_first" });
  rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("server-authoritative referral qualification", () => {
  it("does nothing while the feature is disabled", async () => {
    vi.stubEnv("REFERRALS_ENABLED", "false"); await run(); expect(rpc).not.toHaveBeenCalled(); expect(records).toHaveLength(0);
  });
  it("persists reconciliation rather than granting without Stripe API proof", async () => {
    await run(event(), null); expect(rpc).not.toHaveBeenCalled(); expect(records[0]).toMatchObject({ state: "pending", reason: "verification_configuration_missing" });
  });
  it("binds exact paid monthly price, verified account and trusted owner before qualifying", async () => {
    await run(); expect(rpc).toHaveBeenCalledWith("referral_record_first_payment", { p_user: user, p_session: "cs_first", p_customer: "cus_first", p_amount: 100, p_currency: "usd", p_paid_at: "2023-11-14T22:13:20.000Z" });
    expect(records[0]).toMatchObject({ state: "completed" });
  });
  it("does not trust a Payment Link client_reference_id without server-owned subscription metadata", async () => {
    sub.metadata = {}; await run(); expect(rpc).not.toHaveBeenCalled(); expect(records[0]).toMatchObject({ state: "pending", reason: "trusted_owner_binding_missing" });
  });
  it("excludes unpaid, discounted, different-currency and wrong-account/mode receipts", async () => {
    session.amount_total = 99; await run(); expect(rpc).not.toHaveBeenCalled(); expect(records[0].state).toBe("excluded");
    session.amount_total = 100; session.currency = "eur"; await run(); expect(rpc).not.toHaveBeenCalled();
    session.currency = "usd"; session.payment_status = "unpaid"; await run(); expect(rpc).not.toHaveBeenCalled();
    const wrongMode = { ...event(), livemode: true } as Stripe.Event; await run(wrongMode); expect(rpc).not.toHaveBeenCalled();
    stripe.accounts.retrieve.mockResolvedValue({ id: "acct_other" }); await run(); expect(rpc).not.toHaveBeenCalled();
  });
  it("refuses a price outside the allowlist or a substituted customer", async () => {
    stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{ quantity: 1, price: { id: "price_other" } }], has_more: false });
    await run(); expect(rpc).not.toHaveBeenCalled();
    stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{ quantity: 1, price: { id: "price_monthly" } }], has_more: false });
    sub.customer = "cus_other"; await run(); expect(rpc).not.toHaveBeenCalled();
  });
  it("does not count renewal invoices even if their amount is $1", async () => {
    invoice.billing_reason = "subscription_cycle"; await run(event("invoice.paid", { id: "in_renewal" }));
    expect(rpc).not.toHaveBeenCalled(); expect(records[0]).toMatchObject({ reason: "renewal_or_non_initial_invoice", state: "excluded" });
  });
  it("handles a delayed first payment and an initial paid invoice using the same session idempotency key", async () => {
    await run(event("checkout.session.async_payment_succeeded", { id: "cs_first", mode: "subscription" }));
    await run(event("invoice.paid", { id: "in_first" }));
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map((call) => call[1].p_session)).toEqual(["cs_first", "cs_first"]);
  });
  it("handles refunds and disputes only after charge→initial invoice→session proof", async () => {
    charge.amount_refunded = 100; await run(event("charge.refunded", { id: "ch_first" }));
    expect(rpc).toHaveBeenLastCalledWith("referral_reverse_payment", { p_session: "cs_first", p_status: "refunded" });
    await run(event("charge.dispute.created", { id: "dp_first" }));
    expect(rpc).toHaveBeenLastCalledWith("referral_reverse_payment", { p_session: "cs_first", p_status: "disputed" });
  });
  it("never qualifies a late-paid event after the initial charge has already been refunded/disputed", async () => {
    charge.amount_refunded = 100; await run(); expect(rpc).not.toHaveBeenCalled();
    expect(records[0]).toMatchObject({ state: "excluded", reason: "initial_payment_already_reversed" });
  });
  it("persists a pending reason and retries provider or qualification-store failures", async () => {
    stripe.accounts.retrieve.mockRejectedValueOnce(new Error("fixture scope failure"));
    await expect(run()).rejects.toThrow("fixture scope failure"); expect(records[0]).toMatchObject({ state: "pending" });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "fixture" } });
    await expect(run()).rejects.toThrow("Referral payment persistence failed");
  });
});
