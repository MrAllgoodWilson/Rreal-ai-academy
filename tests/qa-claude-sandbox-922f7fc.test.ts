// Successor fixture adaptation; originals preserved outside repository, no independent rerun claimed.
import { isolatedStorage } from "./isolated-storage-fixture";
// Independent QA (Claude): extra probes for Rreal 922f7fc (copy into <export>/tests/). Same mock style as qa-claude-sandbox-38347ec.test.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";
const calls: any = { upserts: [] as any[] };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({ MONTHLY_PRICE_ID: "price_1UXevHK68Pw0CGHvMMNt6NeD", getStripe: () => null, verifyWebhook: async (raw: string) => JSON.parse(raw) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: () => ({ from: (t: string) => ({ insert: async () => ({ error: null }), upsert: async (r: any) => { calls.upserts.push([t, r]); return { error: null }; }, delete: () => ({ eq: async () => ({}) }), select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }), or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }), rpc: async () => ({ error: null }) }) }));
vi.mock("@/lib/referrals-server", () => ({ processReferralPaymentEvent: async () => {} }));
const ENV0 = { ...process.env }; beforeEach(() => { calls.upserts.length = 0; process.env = { ...ENV0, ...isolatedStorage }; });
const UUID = "11111111-1111-4111-8111-111111111111";
const ev = (over: any, sub: any = {}) => JSON.stringify({ id: "evt_" + Math.random(), type: "checkout.session.completed", ...over, data: { object: { mode: "subscription", subscription: "sub_1", client_reference_id: UUID, metadata: { app: "rreal-ai-academy" }, customer: "cus_1", payment_status: "paid", ...sub } } });
const post = async (body: string) => { const { POST } = await import("../src/app/api/webhooks/stripe/route"); return POST(new Request("https://x.test/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": "s" } })); };
const subsRows = () => calls.upserts.filter((u: any) => u[0] === "subscriptions").map((u: any) => u[1]);
describe("922f7fc extra probes", () => {
  it("X1 production webhook fails CLOSED when the event has no livemode field (gate must not be skippable)", async () => {
    Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: "whsec_a", STRIPE_SECRET_KEY: "sk_live_abc" });
    for (const livemode of [undefined, null, "true", "false", 0, 1]) {
      const r = await post(ev({ livemode })); expect(r.status).toBe(400); expect(subsRows().length).toBe(0);
    }
  });
  it("X2 sandbox webhook writes a database-compatible UUID user_id (subscriptions.user_id is uuid FK to profiles)", async () => {
    Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: "whsec_a", STRIPE_TEST_WEBHOOK_SECRET: "whsec_t", STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_CHECKOUT_MODE: "test" });
    await post(ev({ livemode: false }, { metadata: { app: "rreal-ai-academy", environment: "sandbox" } }));
    const r = subsRows(); expect(r.length).toBe(1); expect(String(r[0].user_id)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
  it("X3 production-mode webhook: a sandbox-marked subscription event is ignored (control, expected to pass)", async () => {
    Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: "whsec_a", STRIPE_SECRET_KEY: "sk_live_abc" });
    await post(JSON.stringify({ id: "evt_x", type: "customer.subscription.updated", livemode: true, data: { object: { id: "sub_9", status: "canceled", customer: "cus_9", metadata: { app: "rreal-ai-academy", user_id: UUID, environment: "sandbox" } } } }));
    expect(subsRows().length).toBe(0);
  });
  it("X4 sandbox mode with ONLY the live webhook secret configured refuses to process (no fallback)", async () => {
    Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: "whsec_live", STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_CHECKOUT_MODE: "test" });
    const r = await post(ev({ livemode: false })); expect(r.status).toBe(501);
  });
});

it("sandbox missing project isolation refuses before any writes", async () => {
 Object.assign(process.env, {STRIPE_TEST_WEBHOOK_SECRET:"whsec_test",STRIPE_SECRET_KEY:"sk_test_fixture",STRIPE_CHECKOUT_MODE:"test",SUPABASE_TEST_PROJECT_REF:""});
 expect((await post(ev({livemode:false}))).status).toBe(503); expect(calls.upserts.length).toBe(0);
});
it("sandbox cannot reuse the production signing secret", async () => {
 Object.assign(process.env, {STRIPE_WEBHOOK_SECRET:"whsec_same",STRIPE_TEST_WEBHOOK_SECRET:"whsec_same",STRIPE_SECRET_KEY:"sk_test_fixture",STRIPE_CHECKOUT_MODE:"test"});
 expect((await post(ev({livemode:false}))).status).toBe(503); expect(calls.upserts.length).toBe(0);
});
