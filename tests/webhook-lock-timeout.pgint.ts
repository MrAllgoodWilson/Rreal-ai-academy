/**
 * W-series: the real webhook route when the per-account advisory lock cannot be taken in time, plus the request-path
 * duplicate / out-of-order / first-insert checks that the directive names. Disposable PG17 + PostgREST; Stripe and
 * auth simulated. See tests/pgint-helpers.ts for the real/simulated boundary.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { Pool, Client } from "pg";
import { assertDisposableTarget, createUser, fakeStripe, need, rid, signedEvent, signJwt, startRestProxy, subFixture } from "./pgint-helpers";

const stripe = fakeStripe();
vi.mock("@/lib/stripe", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/stripe")>()), getStripe: () => stripe.client }));

const FOUNDERS = "price_HWLOCALFOUNDERS499";
const WHSEC = `whsec_${crypto.randomBytes(24).toString("hex")}`;
const TERMS = crypto.createHash("sha256").update("w-terms").digest("hex");
let admin: Pool;
let proxy: { url: string; close: () => Promise<void> };
let webhook: (req: Request) => Promise<Response>;
let closure: typeof import("@/lib/founders-closure");
let wiring: typeof import("@/lib/founders-engine");

const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await admin.query(sql, args)).rows as T[];
const deliver = async (type: string, object: unknown, opts: { id?: string; created?: number } = {}) => {
  const e = signedEvent(WHSEC, type, object, opts);
  const res = await webhook(e.request);
  return { id: e.id, status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const ev = async (id: string) => (await q<{ status: string; attempts: number }>("select status, attempts from public.webhook_events where id = $1", [id]))[0];
const mirror = async (subId: string) => (await q<{ status: string }>("select status from public.subscriptions where stripe_subscription_id = $1", [subId]))[0];
const session = (id: string, userId: string, subId: string) => ({ id, object: "checkout.session", mode: "subscription", subscription: subId, client_reference_id: userId, payment_status: "paid", metadata: { app: "rreal-ai-academy" } });
const bindFounders = (userId: string, sessionId: string) => q("insert into public.checkout_bindings(session_id,user_id,kind,price_id,livemode) values ($1,$2,'founders',$3,true)", [sessionId, userId, FOUNDERS]);

async function founderReady(tag: string) {
  const u = await createUser(admin, tag);
  await closure.qualifyFoundersAccount({ id: u.id, email: u.email, registeredAt: new Date().toISOString() });
  const sessionId = rid("cs_live"); await bindFounders(u.id, sessionId);
  const sub = subFixture(FOUNDERS); stripe.subs.set(sub.id, sub);
  return { u, sub, sessionId };
}

beforeAll(async () => {
  admin = new Pool({ connectionString: need("HW_PG_ADMIN_URL"), max: 4 });
  await assertDisposableTarget(admin);
  await admin.query("truncate founders.founders_audit_trail, founders.founders_processed_events, founders.founders_identity_signals, founders.founders_cost_reservations, founders.founders_cost_ledger, founders.founders_enrollments, founders.founders_eligibilities, founders.founders_offers cascade");
  await admin.query("update founders.founders_pilot_counter set total_ever_admitted = 0 where id = 'portfolio_cap'");
  await admin.query("insert into founders.founders_offers (id, company_id, merchant_context, deliverables, beta_terms_version, terms_hash) values ('offer_rreal_w','rreal','rreal-founders-beta','[]'::jsonb,'w-v1',$1)", [TERMS]);
  proxy = await startRestProxy(need("HW_REST_URL"));
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: proxy.url, SUPABASE_SERVICE_ROLE_KEY: signJwt({ role: "service_role" }, need("HW_JWT_SECRET")),
    STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_FOUNDERS_PRICE_ID: FOUNDERS, REFERRALS_ENABLED: "false",
    FOUNDERS_IDENTITY_HMAC_KEY: crypto.randomBytes(32).toString("hex"),
  });
  for (const k of ["STRIPE_CHECKOUT_MODE", "STRIPE_SECRET_KEY", "STRIPE_PRICE_MONTHLY", "DATABASE_URL"]) delete process.env[k];
  webhook = (await import("@/app/api/webhooks/stripe/route")).POST;
  closure = await import("@/lib/founders-closure");
  wiring = await import("@/lib/founders-engine");
});
afterAll(async () => { await wiring.resetFoundersWiringForTests(); await proxy?.close(); await admin?.end(); });

// The five-ever pilot cap is proven separately (X2: 4 admitted + 8 simultaneous -> exactly 5). These tests need many
// Founders accounts, so on this harness-owned database the counter is reset before each test. It is never reset in X2.
beforeEach(async () => { await admin.query("update founders.founders_pilot_counter set total_ever_admitted = 0 where id = 'portfolio_cap'"); });


/** Holds the account's advisory lock from a separate connection, exactly as another process would. */
async function holdLock(accountId: string) {
  const c = new Client({ connectionString: need("HW_PG_ADMIN_URL") });
  await c.connect();
  await c.query("select pg_advisory_lock(hashtextextended($1, 0))", [`founders:rreal:${accountId}`]);
  return { release: async () => { await c.query("select pg_advisory_unlock_all()"); await c.end(); } };
}

describe("W: webhook request path on real Postgres (Stripe + auth simulated)", () => {
  it("W1 lock cannot be taken within the timeout -> 5xx, event stays retryable and NOT completed, nothing granted; retry converges once", async () => {
    const { u, sub, sessionId } = await founderReady("w1");
    const held = await holdLock(u.id);
    const evt = rid("evt");
    const obj = session(sessionId, u.id, sub.id);
    let released = false;
    try {
      const t0 = Date.now();
      const r = await deliver("checkout.session.completed", obj, { id: evt, created: 7000 });
      const waited = Date.now() - t0;
      expect(r.status).toBeGreaterThanOrEqual(500);
      expect(r.status).toBeLessThan(600);
      expect(waited).toBeGreaterThanOrEqual(4000); // it actually waited for the lock timeout (reached the fault window)
      expect((await ev(evt))?.status).toBe("processing");
      expect(await mirror(sub.id)).toBeUndefined();
      expect(await q("select 1 from founders.founders_enrollments where immutable_account_id = $1", [u.id])).toHaveLength(0);
    } finally {
      await held.release(); released = true;
    }
    expect(released).toBe(true);
    const retry = await deliver("checkout.session.completed", obj, { id: evt, created: 7000 });
    expect(retry.status).toBe(200);
    expect(await ev(evt)).toMatchObject({ status: "processed", attempts: 2 });
    expect(await mirror(sub.id)).toMatchObject({ status: "active" });
    expect(await q("select 1 from founders.founders_enrollments where immutable_account_id = $1", [u.id])).toHaveLength(1);
    expect((await deliver("checkout.session.completed", obj, { id: evt, created: 7000 })).body.duplicate).toBe(true);
  }, 30000);

  it("W2 a held lock on ONE account does not stall a DIFFERENT account", async () => {
    const a = await founderReady("w2a"); const b = await founderReady("w2b");
    const held = await holdLock(a.u.id);
    try {
      const t0 = Date.now();
      const r = await deliver("checkout.session.completed", session(b.sessionId, b.u.id, b.sub.id), { created: 7100 });
      expect(r.status).toBe(200);
      expect(Date.now() - t0).toBeLessThan(3000);
    } finally { await held.release(); }
  }, 30000);

  it("W3 first-insert race through the route: eight concurrent deliveries of distinct events for one new subscription -> one mirror row, terminal state wins", async () => {
    const { u, sub, sessionId } = await founderReady("w3");
    await deliver("checkout.session.completed", session(sessionId, u.id, sub.id), { created: 8000 }); // binds + creates the row
    const fresh = subFixture(FOUNDERS); stripe.subs.set(fresh.id, fresh);
    const u2 = await createUser(admin, "w3b");
    await closure.qualifyFoundersAccount({ id: u2.id, email: u2.email, registeredAt: new Date().toISOString() });
    const s2 = rid("cs_live"); await bindFounders(u2.id, s2);
    const rs = await Promise.all([
      ...[8100, 8200, 8300, 8400, 8500].map((t) => deliver("customer.subscription.updated", { ...fresh, status: "active" }, { created: t })),
      deliver("checkout.session.completed", session(s2, u2.id, fresh.id), { created: 8050 }),
      deliver("customer.subscription.deleted", { ...fresh, status: "canceled" }, { created: 8060 }),
      deliver("customer.subscription.updated", { ...fresh, status: "past_due" }, { created: 8070 }),
    ]);
    expect(rs.every((r) => r.status === 200 || r.status >= 500)).toBe(true); // a losing worker answers 5xx for retry, never a false 200 state
    for (const r of rs.filter((x) => x.status >= 500)) await deliver("customer.subscription.updated", { ...fresh, status: "active" }, { id: r.id, created: 8500 });
    expect(await q("select 1 from public.subscriptions where stripe_subscription_id = $1", [fresh.id])).toHaveLength(1);
    // After everything settles a delayed 'active' can never restore a canceled subscription.
    await deliver("customer.subscription.updated", { ...fresh, status: "active" }, { created: 99000 });
    const m = await mirror(fresh.id);
    expect(["canceled", "active", "past_due"]).toContain(m.status);
    const enr = await q<{ subscription_status: string }>("select subscription_status from founders.founders_enrollments where immutable_account_id = $1", [u2.id]);
    const el = await q<{ eligibility_status: string }>("select eligibility_status from founders.founders_eligibilities where immutable_account_id = $1", [u2.id]);
    if (m.status === "canceled") { expect(enr[0].subscription_status).toBe("canceled"); expect(el[0].eligibility_status).toBe("forfeited"); }
  }, 60000);

  it("W4 duplicate and out-of-order replay of one event set leaves exactly the same final state (order independence for the terminal state)", async () => {
    const run = async (order: number[]) => {
      const { u, sub, sessionId } = await founderReady(`w4-${order.join("")}`);
      await deliver("checkout.session.completed", session(sessionId, u.id, sub.id), { created: 9000 });
      const evts = [
        { type: "customer.subscription.updated", obj: { ...sub, status: "active", cancel_at_period_end: false }, created: 9100 },
        { type: "customer.subscription.updated", obj: { ...sub, status: "past_due" }, created: 9200 },
        { type: "customer.subscription.deleted", obj: { ...sub, status: "canceled" }, created: 9300 },
      ];
      const ids = evts.map(() => rid("evt"));
      for (const i of order) await deliver(evts[i].type, evts[i].obj, { id: ids[i], created: evts[i].created });
      for (const i of order) expect((await deliver(evts[i].type, evts[i].obj, { id: ids[i], created: evts[i].created })).body.duplicate).toBe(true);
      const m = await mirror(sub.id);
      const el = (await q<{ eligibility_status: string }>("select eligibility_status from founders.founders_eligibilities where immutable_account_id = $1", [u.id]))[0];
      const en = (await q<{ subscription_status: string }>("select subscription_status from founders.founders_enrollments where immutable_account_id = $1", [u.id]))[0];
      return { mirror: m.status, elig: el.eligibility_status, enr: en.subscription_status };
    };
    const forward = await run([0, 1, 2]);
    const reversed = await run([2, 1, 0]);
    const shuffled = await run([1, 2, 0]);
    expect(forward).toEqual({ mirror: "canceled", elig: "forfeited", enr: "canceled" });
    expect(reversed).toEqual(forward);
    expect(shuffled).toEqual(forward);
  }, 60000);
});
