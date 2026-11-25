import { beforeEach, describe, expect, it, vi } from "vitest";

// Route-level QA for the $1/month paid signup. No network, no real Stripe or Supabase: both are mocked.
const calls = { sessions: [] as Record<string, unknown>[], inserted: [] as string[], upserts: [] as Record<string, unknown>[] };
const st = { liveSub: false, subPrice: "price_test_monthly", user: null as null | { id: string; email: string }, existingCustomer: null as null | string, supabase: true, dup: false, verifyThrows: false, event: {} as unknown };

vi.mock("@/lib/stripe", () => ({
  MONTHLY_PRICE_ID: "price_test_monthly",
  getStripe: () => ({
    checkout: { sessions: { create: async (a: Record<string, unknown>) => (calls.sessions.push(a), { url: "https://checkout.stripe.test/s" }) } },
    subscriptions: { retrieve: async () => ({ items: { data: [{ price: { id: st.subPrice } }] }, id: "sub_1", customer: "cus_1", status: "active", current_period_end: 1900000000, cancel_at_period_end: false }) },
  }),
  verifyWebhook: async () => { if (st.verifyThrows) throw new Error("bad sig"); return st.event; },
}));
vi.mock("@/lib/referrals-server", () => ({ processReferralPaymentEvent: async () => undefined }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => !st.supabase ? null : {
    auth: { getUser: async () => ({ data: { user: st.user } }) },
    from: () => ({ select: () => ({ eq: () => ({
      in: () => ({ limit: () => ({ maybeSingle: async () => ({ data: st.liveSub ? { status: "active" } : null }) }) }),
      not: () => ({ limit: () => ({ maybeSingle: async () => ({ data: st.existingCustomer ? { stripe_customer_id: st.existingCustomer } : null }) }) }),
    }) }) }),
  },
  getSupabaseAdmin: () => ({
    from: (t: string) => ({
      insert: async (r: { id: string }) => (calls.inserted.push(`${t}:${r.id}`), { error: st.dup ? { code: "23505" } : null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      upsert: async (r: Record<string, unknown>) => (calls.upserts.push(r), { error: null }),
      select: () => ({ or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    }),
    rpc: async () => ({ error: null }),
  }),
}));

const checkout = (await import("@/app/api/stripe/checkout/route")).POST;
const webhook = (await import("@/app/api/webhooks/stripe/route")).POST;
const postCheckout = () => checkout(new Request("https://rreal.test/api/stripe/checkout", { method: "POST" }));
const postHook = (sig = "t") => webhook(new Request("https://rreal.test/api/webhooks/stripe", { method: "POST", body: "{}", headers: { "stripe-signature": sig } }));
const subEvent = (id = "evt_a") => ({ id, type: "checkout.session.completed", data: { object: { id: "cs_x", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "user-1", payment_status: "paid" } } });

beforeEach(() => {
  Object.assign(calls, { sessions: [], inserted: [], upserts: [] });
  Object.assign(st, { liveSub: false, subPrice: "price_test_monthly", user: { id: "user-1", email: "a@example.com" }, existingCustomer: null, supabase: true, dup: false, verifyThrows: false, event: subEvent() });
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("checkout route", () => {
  it("requires sign-in (401) and creates no session", async () => {
    st.user = null;
    expect((await postCheckout()).status).toBe(401);
    expect(calls.sessions).toHaveLength(0);
  });
  it("demo mode answers 501 so the client falls back to a local trial", async () => {
    st.supabase = false;
    expect((await postCheckout()).status).toBe(501);
  });
  it("creates exactly one subscription session for the configured monthly price, quantity 1", async () => {
    const res = await postCheckout();
    expect(res.status).toBe(200);
    const s = calls.sessions[0] as { mode: string; line_items: { price: string; quantity: number }[]; client_reference_id: string; success_url: string; cancel_url: string };
    expect(s.mode).toBe("subscription");
    expect(s.line_items).toEqual([{ price: "price_test_monthly", quantity: 1 }]);
    expect(s.client_reference_id).toBe("user-1");
  });
  it("sends the learner back only to this site's /subscribe page (no open redirect)", async () => {
    await postCheckout();
    const s = calls.sessions[0] as { success_url: string; cancel_url: string };
    for (const u of [s.success_url, s.cancel_url]) expect(new URL(u).origin + new URL(u).pathname).toBe("https://rreal.test/subscribe");
  });
  it("reuses the existing Stripe customer instead of creating a second one", async () => {
    st.existingCustomer = "cus_old";
    await postCheckout();
    const s = calls.sessions[0] as { customer?: string; customer_email?: string };
    expect(s.customer).toBe("cus_old");
    expect(s.customer_email).toBeUndefined();
  });
  it("refuses a second checkout (409) for a learner who already has a live membership, and creates no session", async () => {
    st.liveSub = true;
    const res = await postCheckout();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "already_subscribed" });
    expect(calls.sessions).toHaveLength(0);
  });
});

describe("webhook route negatives", () => {
  it("rejects a forged or missing signature with 400 and writes nothing", async () => {
    st.verifyThrows = true;
    expect((await postHook("forged")).status).toBe(400);
    expect(calls.upserts).toHaveLength(0);
    expect(calls.inserted).toHaveLength(0);
  });
  it("answers 501 when the webhook secret is not configured (never trusts an unsigned body)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await postHook()).status).toBe(501);
    expect(calls.upserts).toHaveLength(0);
  });
  it("a replayed event id is acknowledged as duplicate and does not touch membership again", async () => {
    st.dup = true;
    const res = await postHook();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(calls.upserts).toHaveLength(0);
  });
  it("a valid first delivery activates membership for the signed client_reference_id only", async () => {
    expect((await postHook()).status).toBe(200);
    expect(calls.upserts).toHaveLength(1);
    expect(calls.upserts[0]).toMatchObject({ user_id: "user-1", status: "active", plan: "monthly", stripe_subscription_id: "sub_1" });
  });
  it("a subscription session with no client_reference_id grants nothing", async () => {
    st.event = { ...subEvent("evt_b"), data: { object: { id: "cs_y", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: null } } };
    expect((await postHook()).status).toBe(200);
    expect(calls.upserts).toHaveLength(0);
  });
  it("ignores a subscription on a different price (no membership granted, still acknowledged)", async () => {
    st.subPrice = "price_other_product";
    expect((await postHook()).status).toBe(200);
    expect(calls.upserts).toHaveLength(0);
  });
  it("ignores a customer.subscription.updated event for a different price", async () => {
    st.event = { id: "evt_c", type: "customer.subscription.updated", data: { object: { id: "sub_9", customer: "cus_9", status: "active", metadata: { user_id: "user-1" }, items: { data: [{ price: { id: "price_other_product" } }] } } } };
    expect((await postHook()).status).toBe(200);
    expect(calls.upserts).toHaveLength(0);
  });
  it("still activates a customer.subscription.updated event for the monthly price", async () => {
    st.event = { id: "evt_d", type: "customer.subscription.updated", data: { object: { id: "sub_9", customer: "cus_9", status: "active", metadata: { user_id: "user-1" }, items: { data: [{ price: { id: "price_test_monthly" } }] } } } };
    expect((await postHook()).status).toBe(200);
    expect(calls.upserts[0]).toMatchObject({ user_id: "user-1", stripe_subscription_id: "sub_9", status: "active" });
  });
});
