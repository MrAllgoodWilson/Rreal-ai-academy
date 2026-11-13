// Independent QA (Claude): $4.99 Founders adversarial BASELINE against the CURRENT Rreal billing code (7a1fb58; no Founders implementation exists yet).
// Copy into <export>/tests/. Stateful in-memory stand-ins for Stripe + Supabase; no network/keys. Each test states the Founders rule (E#) it protects.
import { describe, it, expect, vi, beforeEach } from "vitest";
const store: any = { subs: new Map<string, any>(), events: new Set<string>(), users: new Map<string, string>(), sessions: [] as any[], failUpsert: 0, stripeSub: null as any, hasStripe: true, subRows: [] as any[] };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({
  MONTHLY_PRICE_ID: "price_LIVE1",
  getStripe: () => store.hasStripe ? ({ checkout: { sessions: { create: async (a: any) => { store.sessions.push(a); return { url: "https://c.test/x" }; } } }, subscriptions: { retrieve: async (id: string) => store.stripeSub ?? { id, status: "active", customer: "cus_1", metadata: { app: "rreal-ai-academy" }, items: { data: [{ price: { id: "price_LIVE1" } }] }, current_period_end: 1900000000 } } }) : null,
  verifyWebhook: async (raw: string) => JSON.parse(raw),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", email: "a@member.test" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ not: () => ({ limit: () => ({ maybeSingle: async () => ({ data: store.subRows[0] ?? null }) }) }), in: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }),
  getSupabaseAdmin: () => ({
    from: (t: string) => ({
      insert: async (r: any) => { if (t === "webhook_events") { if (store.events.has(r.id)) return { error: { code: "23505" } }; store.events.add(r.id); } return { error: null }; },
      upsert: async (r: any) => { if (store.failUpsert > 0) { store.failUpsert--; return { error: { code: "XX000", message: "db down" } }; } if (t === "subscriptions") store.subs.set(r.stripe_subscription_id, { ...r }); return { error: null }; },
      delete: () => ({ eq: async (_c: string, id: string) => { store.events.delete(id); return {}; } }),
      select: () => ({ eq: (_c: string, v: string) => ({ limit: () => ({ maybeSingle: async () => ({ data: t === "users" && store.users.has(v) ? { id: store.users.get(v) } : null }) }) }), or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    }), rpc: async () => ({ error: null }) }),
}));
vi.mock("@/lib/referrals-server", () => ({ processReferralPaymentEvent: async () => {} }));
const ENV0 = { ...process.env };
beforeEach(() => { store.subs.clear(); store.events.clear(); store.users.clear(); store.sessions.length = 0; store.failUpsert = 0; store.stripeSub = null; store.hasStripe = true; store.subRows = []; process.env = { ...ENV0, STRIPE_WEBHOOK_SECRET: "whsec_l", STRIPE_SECRET_KEY: "sk_live_abc", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }; delete process.env.STRIPE_CHECKOUT_MODE; });
const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222";
const subEv = (id: string, status: string, over: any = {}) => JSON.stringify({ id, type: "customer.subscription.updated", livemode: true, created: over.created ?? 100, data: { object: { id: "sub_A", status, customer: "cus_1", metadata: { app: "rreal-ai-academy", user_id: U1, ...(over.metadata ?? {}) }, items: { data: [{ price: { id: over.price ?? "price_LIVE1" } }] }, current_period_end: 1900000000 } } });
const coEv = (id: string, over: any = {}) => JSON.stringify({ id, type: "checkout.session.completed", livemode: true, created: 100, data: { object: { mode: "subscription", subscription: "sub_A", client_reference_id: U1, metadata: { app: "rreal-ai-academy" }, customer: "cus_1", payment_status: "paid", ...over } } });
const post = async (body: string) => { const { POST } = await import("../src/app/api/webhooks/stripe/route"); return POST(new Request("https://x.test/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": "s" } })); };
const status = (id = "sub_A") => store.subs.get(id)?.status;

describe("Founders baseline vs current Rreal billing code", () => {
  it("F1 [E9/E3] out-of-order delivery: a stale 'active' event delivered AFTER 'canceled' must not resurrect the entitlement", async () => {
    await post(subEv("evt_1", "active", { created: 100 })); await post(subEv("evt_3", "canceled", { created: 300 })); await post(subEv("evt_2", "active", { created: 200 }));
    expect(status()).toBe("canceled");
  });
  it("F2 [E9] exact replay of the same event id is acknowledged as duplicate and changes nothing", async () => {
    await post(subEv("evt_1", "active")); store.subs.clear(); const r = await post(subEv("evt_1", "active")); expect((await r.json()).duplicate).toBe(true); expect(store.subs.size).toBe(0);
  });
  it("F3 [E9] partial failure then Stripe retry of the same event: first 500 (event un-reserved), retry succeeds, exactly one row", async () => {
    store.failUpsert = 1; const a = await post(subEv("evt_9", "active")); expect(a.status).toBe(500); expect(store.events.has("evt_9")).toBe(false);
    const b = await post(subEv("evt_9", "active")); expect(b.status).toBe(200); expect(store.subs.size).toBe(1);
  });
  it("F4 [E9] four concurrent deliveries of the same event: processed once, the rest duplicate", async () => {
    const rs = await Promise.all([1, 2, 3, 4].map(() => post(subEv("evt_c", "active")))); const dup = (await Promise.all(rs.map((r) => r.json()))).filter((j: any) => j.duplicate).length; expect(dup).toBe(3); expect(store.subs.size).toBe(1);
  });
  it("F5 [E4/E7] a member who already has an active membership cannot start a SECOND checkout (double billing)", async () => {
    store.subRows = [{ stripe_customer_id: "cus_1", status: "active" }]; const { POST } = await import("../src/app/api/stripe/checkout/route");
    const r = await POST(new Request("https://x.test/api/stripe/checkout", { method: "POST" })); expect(store.sessions.length, "second Checkout Session created for an already-subscribed account").toBe(0); void r;
  });
  it("F6 [E8/E9] price allow-list: a subscription carrying an UNKNOWN price id (e.g. a founders or foreign price) with metadata.app=rreal must be ignored", async () => {
    await post(subEv("evt_p", "active", { price: "price_UNKNOWN_FOUNDERS" })); expect(store.subs.size, "entitlement granted for a price outside the Rreal allow-list").toBe(0);
  });
  it("F7 [E5/E6] INFO ONLY (retracted as a defect): the webhook has an email->account fallback reading a 'users' relation; NO public.users exists in the migrations, so in production the lookup returns nothing (dead code). My stand-in created that table, so this only shows what would happen if such a relation/view were ever added: email must never be an identity key — delete the fallback.", async () => {
    store.users.set("new@person.test", U2); await post(coEv("evt_e", { client_reference_id: null, customer_email: "new@person.test" })); console.log("INFO F7 attached by email (only because the stand-in table exists):", store.subs.size === 1); expect(true).toBe(true);
  });
  it("F8b [E5/E11] even WITH a Stripe API key, a Payment-Link-style session whose client_reference_id is any UUID is granted (the account id is whatever the URL says)", async () => {
    await post(coEv("evt_l2", { client_reference_id: U2, payment_link: "plink_ABC" })); expect(store.subs.size, "granted for URL-supplied client_reference_id despite API key").toBe(0);
  });
  it("F8 [E5/E11] a public Payment Link purchase with an arbitrary client_reference_id (no API key path) must not grant any account", async () => {
    store.hasStripe = false; delete process.env.STRIPE_SECRET_KEY; await post(coEv("evt_l", { client_reference_id: U2 })); expect(store.subs.size, "membership granted from a URL-supplied client_reference_id").toBe(0);
  });
  it("F9 [E7] declined payment: past_due/unpaid events are recorded (not ignored) so entitlement can be suspended", async () => {
    await post(subEv("evt_d1", "past_due")); expect(status()).toBe("past_due"); await post(subEv("evt_d2", "unpaid", { created: 200 })); expect(status()).toBe("unpaid");
  });
  it("F10 [E2/E10] legacy $1 subscriber control: a normal live $1 subscription is recorded unchanged", async () => {
    await post(subEv("evt_l1", "active")); expect(store.subs.get("sub_A")).toMatchObject({ user_id: U1, status: "active", plan: "monthly" });
  });
  it("F11 [E8] mode isolation controls: test-mode event in live config and sandbox-marked subscription are refused", async () => {
    const t = JSON.parse(subEv("evt_t", "active")); t.livemode = false; const r = await post(JSON.stringify(t)); expect(r.status).toBe(400);
    await post(subEv("evt_s", "active", { metadata: { environment: "sandbox" } })); expect(store.subs.size).toBe(0);
  });
  it("F12 [E9] cross-brand: subscription metadata for another brand is ignored", async () => {
    await post(subEv("evt_b", "active", { metadata: { app: "inboxedge" } })); expect(store.subs.size).toBe(0);
  });
});
