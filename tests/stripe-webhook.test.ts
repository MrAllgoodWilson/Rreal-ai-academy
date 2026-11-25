import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { rpcError: null as null | { code?: string; message?: string }, upsertError: null as null | { code?: string; message?: string }, deleted: [] as string[], rpcCalls: [] as unknown[] };
let event: unknown;

vi.mock("@/lib/stripe", () => ({ getStripe: () => null, verifyWebhook: async () => event }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async (_c: string, id: string) => (state.deleted.push(`${table}:${id}`), { error: null }) }),
      upsert: async () => ({ error: state.upsertError }),
      select: () => ({ or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    }),
    rpc: async (name: string, args: unknown) => (state.rpcCalls.push({ name, args }), { error: state.rpcError }),
  }),
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");
const call = () => POST(new Request("http://x/api/webhooks/stripe", { method: "POST", body: "{}", headers: { "stripe-signature": "t" } }));
const packSession = (over: Record<string, unknown> = {}) => ({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", mode: "payment", payment_status: "paid", client_reference_id: "user-1", payment_link: "plink_1UXs2tK68Pw0CGHvQjKXPZCA", metadata: {}, ...over } } });

describe("stripe webhook fulfilment", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    Object.assign(state, { rpcError: null, upsertError: null, deleted: [], rpcCalls: [] });
  });

  it("grants credits once for a paid pack session", async () => {
    event = packSession();
    const res = await call();
    expect(res.status).toBe(200);
    expect(state.rpcCalls).toEqual([{ name: "grant_credits", args: { p_user: "user-1", p_kind: "video", p_qty: 5, p_reason: "purchase", p_ref: "cs_1" } }]);
  });
  it("does not grant for an unpaid session", async () => {
    event = packSession({ payment_status: "unpaid" });
    expect((await call()).status).toBe(200);
    expect(state.rpcCalls).toHaveLength(0);
  });
  it("grants when a delayed payment later succeeds", async () => {
    event = { ...packSession(), type: "checkout.session.async_payment_succeeded" };
    expect((await call()).status).toBe(200);
    expect(state.rpcCalls).toHaveLength(1);
  });
  it("returns 500 and un-reserves the event when the grant fails, so Stripe retries", async () => {
    state.rpcError = { code: "XX000", message: "db down" };
    event = packSession();
    expect((await call()).status).toBe(500);
    expect(state.deleted).toContain("webhook_events:evt_1");
  });
  it("acknowledges a grant for a learner that doesn't exist (can never succeed)", async () => {
    state.rpcError = { code: "23503", message: "fk" };
    event = packSession();
    expect((await call()).status).toBe(200);
  });
  it("returns 500 when saving a membership fails", async () => {
    state.upsertError = { code: "XX000", message: "db down" };
    event = { id: "evt_2", type: "checkout.session.completed", data: { object: { id: "cs_2", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "user-1", payment_status: "paid" } } };
    expect((await call()).status).toBe(500);
    expect(state.deleted).toContain("webhook_events:evt_2");
  });
});
