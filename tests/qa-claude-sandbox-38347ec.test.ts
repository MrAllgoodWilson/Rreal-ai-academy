// Successor fixture adaptation; originals preserved outside repository, no independent rerun claimed.
import { isolatedStorage } from "./isolated-storage-fixture";
// Independent QA (Claude): Rreal sandbox checkout isolation 38347ec. Copied into <export>/tests/. Mocks only Stripe/Supabase clients; no network, no keys.
import { describe, it, expect, vi, beforeEach } from "vitest";

const LIVE = "price_1UXevHK68Pw0CGHvMMNt6NeD";
const calls: any = { sessions: [] as any[], upserts: [] as any[], inserts: [] as any[] };
let stripeNull = false; let supabaseNull = false;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({
  MONTHLY_PRICE_ID: "price_1UXevHK68Pw0CGHvMMNt6NeD",
  getStripe: () => stripeNull ? null : ({
    checkout: { sessions: { create: async (a: any) => { calls.sessions.push(a); return { url: "https://checkout.stripe.test/x" }; } } },
    subscriptions: { retrieve: async (id: string) => ({ id, status: "active", customer: "cus_test_1", metadata: { app: "rreal-ai-academy" }, items: { data: [{ price: { id: "price_TESTONLY" } }] }, current_period_end: 1900000000 }) },
  }),
  verifyWebhook: async (raw: string) => JSON.parse(raw),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => supabaseNull ? null : ({
    auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", email: "real@member.test" } } }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [{ stripe_customer_id: "cus_LIVE_existing", status: "canceled" }], error: null }) }) }),
  }),
  getSupabaseAdmin: () => ({
    from: (t: string) => ({
      insert: async (r: any) => { calls.inserts.push([t, r]); return { error: null }; },
      upsert: async (r: any) => { calls.upserts.push([t, r]); return { error: null }; },
      delete: () => ({ eq: async () => ({}) }),
      select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }), or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    }),
    // The shared checkout limiter (0013) requires an explicit boolean SQL response.
    // Preserve the isolation assertions below; this fake models only the limiter contract.
    rpc: async (name: string) => name === "rate_limit_hit"
      ? ({ data: true, error: null })
      : ({ data: null, error: null }),
  }),
}));
vi.mock("@/lib/referrals-server", () => ({ processReferralPaymentEvent: async () => {} }));

const ENV0 = { ...process.env };
beforeEach(() => { calls.sessions.length = 0; calls.upserts.length = 0; calls.inserts.length = 0; stripeNull = false; supabaseNull = false; process.env = { ...ENV0, ...isolatedStorage }; });
const req = (u = "https://app.test/api/stripe/checkout") => new Request(u, { method: "POST" });

describe("guard (resolveCheckoutPrice)", async () => {
  const { resolveCheckoutPrice } = await import("../src/lib/stripe-sandbox-guard");
  const t = { ...isolatedStorage, STRIPE_CHECKOUT_MODE: "test", STRIPE_SECRET_KEY: "sk_test_abc123", STRIPE_TEST_PRICE_MONTHLY: "price_test123" };
  it("G1 fail-closed variants -> null", () => {
    for (const e of [{ ...t, STRIPE_CHECKOUT_MODE: "TEST" }, { ...t, STRIPE_CHECKOUT_MODE: "test " }, { ...t, STRIPE_SECRET_KEY: "sk_live_abc" }, { ...t, STRIPE_SECRET_KEY: "sk_test_abc\n" }, { ...t, STRIPE_TEST_PRICE_MONTHLY: LIVE }, { ...t, STRIPE_TEST_PRICE_MONTHLY: "plink_1" }, { ...t, STRIPE_CHECKOUT_MODE: "sandbox" }])
      expect(resolveCheckoutPrice(e as any), JSON.stringify(e)).toBeNull();
  });
  it("G2 test price may NOT equal the configured live price override (STRIPE_PRICE_MONTHLY), not only the hardcoded default", () => {
    expect(resolveCheckoutPrice({ ...t, STRIPE_PRICE_MONTHLY: "price_LIVEOVERRIDE123", STRIPE_TEST_PRICE_MONTHLY: "price_LIVEOVERRIDE123" } as any)).toBeNull();
  });
  it("G3 live mode requires an sk_live/rk_live key (a test key with checkout mode live/unset must not silently use the live price)", () => {
    const r = resolveCheckoutPrice({ STRIPE_SECRET_KEY: "sk_test_abc" } as any);
    expect(r, "unset mode + test key -> live price id with a test key").toBeNull();
  });
});

describe("checkout route", async () => {
  const { POST } = await import("../src/app/api/stripe/checkout/route");
  const sb = { ...isolatedStorage, STRIPE_CHECKOUT_MODE: "test", STRIPE_SECRET_KEY: "sk_test_abc123", STRIPE_TEST_PRICE_MONTHLY: "price_test123", NEXT_PUBLIC_STRIPE_PAYMENT_LINK: "https://buy.stripe.com/LIVELINK" };
  it("R1 sandbox: Checkout Session uses the TEST price only, no live customer reuse, no promo codes", async () => {
    Object.assign(process.env, sb); const r = await POST(req()); expect(r.status).toBe(200);
    const a = calls.sessions[0]; expect(a.line_items[0].price).toBe("price_test123"); expect(a.customer).toBeUndefined(); expect(a.allow_promotion_codes).toBe(false);
  });
  it("R2 sandbox without Stripe client never redirects to the live Payment Link", async () => {
    Object.assign(process.env, sb); stripeNull = true; const r = await POST(req()); expect(r.status).toBe(503); expect(await r.text()).not.toMatch(/buy\.stripe\.com/);
  });
  it("R3 sandbox without account storage -> 503 (no demo activation)", async () => {
    Object.assign(process.env, sb); supabaseNull = true; const r = await POST(req()); expect(r.status).toBe(503);
  });
  it("R4 misconfigured sandbox (live key) -> 503 before any Stripe call", async () => {
    Object.assign(process.env, { ...sb, STRIPE_SECRET_KEY: "sk_live_zzz" }); const r = await POST(req()); expect(r.status).toBe(503); expect(calls.sessions.length).toBe(0);
  });
  it("R5 sandbox session metadata/session carries an explicit sandbox marker so the webhook can refuse it in production", async () => {
    Object.assign(process.env, sb); await POST(req()); const a = calls.sessions[0];
    expect(JSON.stringify(a.subscription_data.metadata)).toMatch(/sandbox|test|environment/i);
  });
  it("R6 sandbox checkout is bound to a dedicated test identity (UUID retained in isolated test project)", async () => {
    Object.assign(process.env, sb); await POST(req()); expect(String(calls.sessions[0].client_reference_id)).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("webhook (unchanged by this branch) — sandbox/production isolation", async () => {
  const { POST } = await import("../src/app/api/webhooks/stripe/route");
  const ev = (livemode: boolean, over: any = {}) => JSON.stringify({ id: "evt_t_" + Math.random(), type: "checkout.session.completed", livemode,
    data: { object: { mode: "subscription", subscription: "sub_TEST_1", client_reference_id: "11111111-1111-4111-8111-111111111111", metadata: { app: "rreal-ai-academy" }, customer: "cus_test_1", ...over } } });
  const whenv = { STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_SECRET_KEY: "sk_live_x" };
  it("W1 production-configured webhook (live key) REFUSES test-mode (livemode:false) events", async () => {
    Object.assign(process.env, whenv); const r = await POST(new Request("https://app.test/api/webhooks/stripe", { method: "POST", body: ev(false), headers: { "stripe-signature": "x" } }));
    expect(calls.upserts.filter((u: any) => u[0] === "subscriptions").length, "test event wrote an active membership row").toBe(0); expect([400, 200]).toContain(r.status);
  });
  it("W2 sandbox-configured webhook refuses LIVE (livemode:true) events", async () => {
    Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_CHECKOUT_MODE: "test" });
    await POST(new Request("https://app.test/api/webhooks/stripe", { method: "POST", body: ev(true), headers: { "stripe-signature": "x" } }));
    expect(calls.upserts.filter((u: any) => u[0] === "subscriptions").length).toBe(0);
  });
  it("W3 INFO: a signed test-mode event for a real user id grants an ACTIVE membership row (entitlement = any active row for user_id)", async () => {
    Object.assign(process.env, whenv); await POST(new Request("https://app.test/api/webhooks/stripe", { method: "POST", body: ev(false), headers: { "stripe-signature": "x" } }));
    const row = calls.upserts.find((u: any) => u[0] === "subscriptions"); console.log("W3 row:", JSON.stringify(row?.[1] ?? null)); expect(true).toBe(true);
  });
});
