import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the webhook's control flow. The admin client here is a fake with an EXPLICIT contract for every SQL
 * function the route calls (migration 0011) - there is no table-level fallback for the route to lean on.
 * The SQL functions themselves are proven against real Postgres in tests/sql/founders-0011-checks.sh and tests/*.pgint.ts.
 */
type DbError = { code?: string; message?: string };
const USER = "11111111-1111-4111-8111-111111111111";
const state = {
  calls: [] as { name: string; args: Record<string, unknown> }[],
  errors: {} as Record<string, DbError>,
  results: {} as Record<string, unknown>,
};
let event: unknown;

const defaults: Record<string, (args: Record<string, unknown>) => unknown> = {
  claim_webhook_event: () => "new",
  complete_webhook_event: () => true,
  fail_webhook_event: () => true,
  grant_credits: () => null,
  bind_checkout_subscription: () => ({ bound: false, reason: "unknown_session" }),
  resolve_subscription_account: () => null,
  upsert_subscription_ordered: () => ({ updated: true }),
};

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { retrieve: async (id: string) => ({ id, status: "active", customer: "cus_1", items: { data: [{ price: { id: "price_1UXevHK68Pw0CGHvMMNt6NeD" } }] } }) },
  }),
  verifyWebhook: async () => event,
  MONTHLY_PRICE_ID: "price_1UXevHK68Pw0CGHvMMNt6NeD",
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    // Any table access from the webhook would be a regression to a non-atomic path.
    from: (table: string) => { throw new Error(`unexpected table access: ${table}`); },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.calls.push({ name, args });
      if (state.errors[name]) return { data: null, error: state.errors[name] };
      if (!(name in defaults)) return { data: null, error: { code: "PGRST202", message: `function ${name} not found` } };
      return { data: name in state.results ? state.results[name] : defaults[name](args), error: null };
    },
  }),
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");
const call = () => POST(new Request("http://x/api/webhooks/stripe", { method: "POST", body: "{}", headers: { "stripe-signature": "t" } }));
const names = () => state.calls.map((c) => c.name);
const packSession = (over: Record<string, unknown> = {}) => ({ id: "evt_1", type: "checkout.session.completed", livemode: true, created: 1000, data: { object: { id: "cs_1", mode: "payment", payment_status: "paid", client_reference_id: "user-1", metadata: { credit_kind: "video", credit_qty: "5" }, ...over } } });
const subSession = (type = "checkout.session.completed") => ({ id: "evt_2", type, livemode: true, created: 2000, data: { object: { id: "cs_2", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: USER, payment_status: "paid" } } });

describe("stripe webhook fulfilment", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    delete process.env.STRIPE_CHECKOUT_MODE;
    delete process.env.STRIPE_SECRET_KEY;
    Object.assign(state, { calls: [], errors: {}, results: {} });
  });

  it("grants credits once for a paid pack session, and completes the event only after the grant", async () => {
    event = packSession();
    expect((await call()).status).toBe(200);
    expect(names()).toEqual(["claim_webhook_event", "grant_credits", "complete_webhook_event"]);
    expect(state.calls[1].args).toEqual({ p_user: "user-1", p_kind: "video", p_qty: 5, p_reason: "purchase", p_ref: "cs_1" });
  });
  it("does not grant for an unpaid session", async () => {
    event = packSession({ payment_status: "unpaid" });
    expect((await call()).status).toBe(200);
    expect(names()).not.toContain("grant_credits");
  });
  it("grants when a delayed payment later succeeds", async () => {
    event = { ...packSession(), type: "checkout.session.async_payment_succeeded" };
    expect((await call()).status).toBe(200);
    expect(names().filter((n) => n === "grant_credits")).toHaveLength(1);
  });
  it("returns 500 and leaves the event retryable (never completed) when the grant fails", async () => {
    state.errors.grant_credits = { code: "XX000", message: "db down" };
    event = packSession();
    expect((await call()).status).toBe(500);
    expect(names()).not.toContain("complete_webhook_event");
    expect(names()).toContain("fail_webhook_event");
  });
  it("acknowledges a grant for a learner that doesn't exist (can never succeed)", async () => {
    state.errors.grant_credits = { code: "23503", message: "fk" };
    event = packSession();
    expect((await call()).status).toBe(200);
    expect(names()).toContain("complete_webhook_event");
  });
  it("an already-processed event is acknowledged as a duplicate with no effects", async () => {
    state.results.claim_webhook_event = "duplicate";
    event = packSession();
    const res = await call();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { duplicate?: boolean }).duplicate).toBe(true);
    expect(names()).toEqual(["claim_webhook_event"]);
  });
  it("fails closed when the claim function is missing or returns something unexpected", async () => {
    event = packSession();
    state.errors.claim_webhook_event = { code: "PGRST202", message: "not found" };
    expect((await call()).status).toBe(500);
    state.errors = {}; state.results.claim_webhook_event = null;
    expect((await call()).status).toBe(500);
    expect(names()).not.toContain("grant_credits");
  });

  it("activates a subscription through the atomic SQL function for both checkout events", async () => {
    for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"]) {
      state.calls = [];
      event = subSession(type);
      expect((await call()).status).toBe(200);
      expect(names()).toEqual(["claim_webhook_event", "bind_checkout_subscription", "upsert_subscription_ordered", "complete_webhook_event"]);
      expect(state.calls[2].args).toMatchObject({ p_sub_id: "sub_1", p_user_id: USER, p_status: "active", p_event_created: 2000 });
    }
  });
  it("returns 500 when saving a membership fails, when the function is missing, or when it returns no result", async () => {
    event = subSession();
    state.errors.upsert_subscription_ordered = { code: "XX000", message: "db down" };
    expect((await call()).status).toBe(500);
    state.errors.upsert_subscription_ordered = { code: "PGRST202", message: "not found" };
    expect((await call()).status).toBe(500);
    state.errors = {}; state.results.upsert_subscription_ordered = null;
    expect((await call()).status).toBe(500);
    state.results.upsert_subscription_ordered = {};
    expect((await call()).status).toBe(500);
    expect(names()).not.toContain("complete_webhook_event");
  });
  it("a recorded session that belongs to someone else grants nothing", async () => {
    state.results.bind_checkout_subscription = { bound: false, reason: "mismatch" };
    event = subSession();
    expect((await call()).status).toBe(200);
    expect(names()).not.toContain("upsert_subscription_ordered");
  });
  it("a non-UUID or payment-link client_reference_id grants nothing", async () => {
    const base = subSession();
    event = { ...base, data: { object: { ...base.data.object, client_reference_id: "user-1" } } };
    expect((await call()).status).toBe(200);
    event = { ...base, data: { object: { ...base.data.object, payment_link: "plink_1" } } };
    expect((await call()).status).toBe(200);
    expect(names()).not.toContain("upsert_subscription_ordered");
  });
  it("ignores a foreign product subscription (e.g. InboxEdge basic on the shared account)", async () => {
    event = { id: "evt_3", type: "customer.subscription.updated", livemode: true, created: 3000, data: { object: { id: "sub_x", status: "active", customer: "cus_9", metadata: { app: "inboxedge" }, items: { data: [{ price: { id: "price_other" } }] } } } };
    expect((await call()).status).toBe(200);
    expect(names()).toEqual(["claim_webhook_event", "complete_webhook_event"]);
  });
  it("subscription events resolve the account from server-side state only; unknown subscriptions and metadata.user_id grant nothing", async () => {
    const sub = { id: "sub_1", status: "past_due", customer: "cus_1", metadata: { app: "rreal-ai-academy", user_id: USER }, items: { data: [{ price: { id: "price_1UXevHK68Pw0CGHvMMNt6NeD" } }] } };
    event = { id: "evt_4", type: "customer.subscription.updated", livemode: true, created: 4000, data: { object: sub } };
    expect((await call()).status).toBe(200);
    expect(names()).not.toContain("upsert_subscription_ordered");

    state.calls = [];
    state.results.resolve_subscription_account = { user_id: USER, kind: "legacy_monthly", source: "subscription_row" };
    expect((await call()).status).toBe(200);
    expect(state.calls.find((c) => c.name === "upsert_subscription_ordered")?.args).toMatchObject({ p_user_id: USER, p_status: "past_due", p_event_created: 4000 });
  });
  it("a subscription bound to a different account is not acknowledged", async () => {
    state.results.resolve_subscription_account = { user_id: USER, kind: "legacy_monthly", source: "subscription_row" };
    state.results.upsert_subscription_ordered = { updated: false, reason: "binding_mismatch" };
    event = { id: "evt_5", type: "customer.subscription.updated", livemode: true, created: 5000, data: { object: { id: "sub_1", status: "active", customer: "cus_1", items: { data: [{ price: { id: "price_1UXevHK68Pw0CGHvMMNt6NeD" } }] } } } };
    expect((await call()).status).toBe(500);
  });
});
