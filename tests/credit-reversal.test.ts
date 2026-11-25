import { beforeEach, describe, expect, it, vi } from "vitest";

// Webhook: full refund / new dispute on a credit-pack payment reverses the grant; everything else is left alone.
const st = { rpc: [] as { name: string; args: unknown }[], rpcError: null as null | { code?: string; message?: string }, deleted: [] as string[], stripe: true, sessions: [] as Record<string, unknown>[], retrieved: [] as string[] };
let event: unknown;

vi.mock("@/lib/stripe", () => ({
  MONTHLY_PRICE_ID: "price_test_monthly",
  verifyWebhook: async () => event,
  getStripe: () => !st.stripe ? null : {
    charges: { retrieve: async (id: string) => (st.retrieved.push(id), { id, refunded: true, payment_intent: "pi_1" }) },
    checkout: { sessions: { list: async () => ({ data: st.sessions }) } },
  },
}));
vi.mock("@/lib/referrals-server", () => ({ processReferralPaymentEvent: async () => undefined }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: (t: string) => ({
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async (_c: string, id: string) => (st.deleted.push(`${t}:${id}`), { error: null }) }),
    }),
    rpc: async (name: string, args: unknown) => (st.rpc.push({ name, args }), { data: { reversed: 5, shortfall: 0 }, error: st.rpcError }),
  }),
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");
const call = () => POST(new Request("http://x/api/webhooks/stripe", { method: "POST", body: "{}", headers: { "stripe-signature": "t" } }));
const packSession = (over: Record<string, unknown> = {}) => ({ id: "cs_pack", mode: "payment", metadata: { credit_kind: "video", credit_qty: "5" }, ...over });
const refund = (over: Record<string, unknown> = {}) => ({ id: "evt_r", type: "charge.refunded", data: { object: { id: "ch_1", refunded: true, payment_intent: "pi_1", ...over } } });
const dispute = { id: "evt_d", type: "charge.dispute.created", data: { object: { id: "dp_1", charge: "ch_1" } } };

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  Object.assign(st, { rpc: [], rpcError: null, deleted: [], stripe: true, sessions: [packSession()], retrieved: [] });
  event = refund();
});

describe("credit pack reversal", () => {
  it("reverses the grant once for a fully refunded pack payment", async () => {
    expect((await call()).status).toBe(200);
    expect(st.rpc).toEqual([{ name: "reverse_credits", args: { p_ref: "cs_pack" } }]);
  });
  it("reverses on a new dispute (looks the charge up first)", async () => {
    event = dispute;
    expect((await call()).status).toBe(200);
    expect(st.retrieved).toEqual(["ch_1"]);
    expect(st.rpc).toEqual([{ name: "reverse_credits", args: { p_ref: "cs_pack" } }]);
  });
  it("ignores a partial refund", async () => {
    event = refund({ refunded: false });
    expect((await call()).status).toBe(200);
    expect(st.rpc).toHaveLength(0);
  });
  it("ignores a refunded subscription charge (not a credit pack)", async () => {
    st.sessions = [packSession({ mode: "subscription" })];
    expect((await call()).status).toBe(200);
    expect(st.rpc).toHaveLength(0);
  });
  it("ignores a one-time payment that is not one of our packs", async () => {
    st.sessions = [packSession({ metadata: {} })];
    expect((await call()).status).toBe(200);
    expect(st.rpc).toHaveLength(0);
  });
  it("ignores a charge with no payment intent or no checkout session", async () => {
    event = refund({ payment_intent: null });
    expect((await call()).status).toBe(200);
    st.sessions = [];
    event = refund();
    expect((await call()).status).toBe(200);
    expect(st.rpc).toHaveLength(0);
  });
  it("does nothing without a Stripe API client (cannot look the session up)", async () => {
    st.stripe = false;
    expect((await call()).status).toBe(200);
    expect(st.rpc).toHaveLength(0);
  });
  it("returns 500 and un-reserves the event when the reversal fails, so Stripe retries", async () => {
    st.rpcError = { code: "XX000", message: "db down" };
    expect((await call()).status).toBe(500);
    expect(st.deleted).toContain("webhook_events:evt_r");
  });
});
