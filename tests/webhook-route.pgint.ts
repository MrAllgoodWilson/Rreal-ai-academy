/**
 * R-series: the REAL checkout + webhook route handlers against a disposable Postgres 17 through PostgREST.
 * Simulated: Stripe (locally built + signed events, fixture API client) and auth (locally signed JWT).
 * See tests/pgint-helpers.ts for the exact real/simulated boundary.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { Pool } from "pg";
import {
  assertDisposableTarget, createUser, fakeStripe, need, rid, signedEvent, signJwt, startRestProxy, subFixture, userClient,
} from "./pgint-helpers";

const stripe = fakeStripe();
const current: { user: { id: string; email: string } | null; restUrl: string } = { user: null, restUrl: "" };

vi.mock("@/lib/stripe", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/stripe")>();
  return { ...real, getStripe: () => stripe.client };
});
vi.mock("@/lib/supabase/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/supabase/server")>();
  return { ...real, getSupabaseServer: async () => (current.user ? userClient(current.restUrl, current.user) : null) };
});

const LEGACY = "price_1UXevHK68Pw0CGHvMMNt6NeD";
const FOUNDERS = "price_HWLOCALFOUNDERS499";
const WHSEC = `whsec_${crypto.randomBytes(24).toString("hex")}`;
const TERMS_HASH = crypto.createHash("sha256").update("pgint-terms-v1").digest("hex");

let admin: Pool;
let proxy: { url: string; close: () => Promise<void> };
let webhook: (req: Request) => Promise<Response>;
let checkout: (req: Request) => Promise<Response>;
let engine: import("@/lib/founders/rules-engine").AccountBoundRulesEngine;

const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await admin.query(sql, args)).rows as T[];
const mirrorOf = async (subId: string) => (await q<{ user_id: string; status: string; last_event_created: string }>("select user_id, status, last_event_created from public.subscriptions where stripe_subscription_id = $1", [subId]))[0];
const eventRow = async (id: string) => (await q<{ status: string; attempts: number }>("select status, attempts from public.webhook_events where id = $1", [id]))[0];
const deliver = async (type: string, object: unknown, opts: { id?: string; created?: number } = {}) => {
  const e = signedEvent(WHSEC, type, object, opts);
  const res = await webhook(e.request);
  return { id: e.id, status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const startCheckout = async (user: { id: string; email: string }, body?: unknown) => {
  current.user = user;
  const before = new Set((await q<{ session_id: string }>("select session_id from public.checkout_bindings where user_id = $1", [user.id])).map((r) => r.session_id));
  const res = await checkout(new Request("http://127.0.0.1/api/stripe/checkout", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }));
  const after = await q<{ session_id: string; kind: string }>("select session_id, kind from public.checkout_bindings where user_id = $1", [user.id]);
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, binding: after.find((r) => !before.has(r.session_id)) };
};
const session = (id: string, userId: string, subId: string, over: Record<string, unknown> = {}) => ({
  id, object: "checkout.session", mode: "subscription", subscription: subId, client_reference_id: userId,
  payment_status: "paid", metadata: { app: "rreal-ai-academy" }, ...over,
});
const consent = { affirmativeConsent: true, termsHash: TERMS_HASH, termsVersion: "pgint-v1" };

beforeAll(async () => {
  admin = new Pool({ connectionString: need("HW_PG_ADMIN_URL"), max: 4 });
  await assertDisposableTarget(admin);
  // Harness-owned database: start the Founders pilot from a known empty state (cap is "5 ever").
  await admin.query("truncate founders.founders_audit_trail, founders.founders_processed_events, founders.founders_identity_signals, founders.founders_cost_reservations, founders.founders_cost_ledger, founders.founders_enrollments, founders.founders_eligibilities, founders.founders_offers cascade");
  await admin.query("update founders.founders_pilot_counter set total_ever_admitted = 0 where id = 'portfolio_cap'");
  await admin.query(
    "insert into founders.founders_offers (id, company_id, merchant_context, deliverables, beta_terms_version, terms_hash) values ($1,'rreal','rreal-founders-beta','[]'::jsonb,'pgint-v1',$2)",
    ["offer_rreal_pgint", TERMS_HASH],
  );

  proxy = await startRestProxy(need("HW_REST_URL"));
  current.restUrl = proxy.url;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: proxy.url,
    SUPABASE_SERVICE_ROLE_KEY: signJwt({ role: "service_role" }, need("HW_JWT_SECRET")),
    STRIPE_WEBHOOK_SECRET: WHSEC,
    STRIPE_FOUNDERS_PRICE_ID: FOUNDERS,
    REFERRALS_ENABLED: "false",
  });
  for (const k of ["STRIPE_CHECKOUT_MODE", "STRIPE_SECRET_KEY", "STRIPE_PRICE_MONTHLY", "DATABASE_URL"]) delete process.env[k];

  webhook = (await import("@/app/api/webhooks/stripe/route")).POST;
  checkout = (await import("@/app/api/stripe/checkout/route")).POST;
  engine = (await import("@/lib/founders-engine")).getDefaultFoundersRulesEngine();
});

afterAll(async () => {
  await (await import("@/lib/founders-engine")).resetFoundersWiringForTests();
  await proxy?.close();
  await admin?.end();
});

describe("R: real route handlers on disposable Postgres 17 (Stripe + auth simulated)", () => {
  it("R1 standard plan: checkout records a binding; webhook mirrors; cancel is terminal against replays", async () => {
    const u = await createUser(admin, "r1");
    const co = await startCheckout(u);
    expect(co.status).toBe(200);
    expect(co.binding?.kind).toBe("legacy_monthly");

    const sub = subFixture(LEGACY, { amount: 100 });
    stripe.subs.set(sub.id, sub);
    const done = await deliver("checkout.session.completed", session(co.binding!.session_id, u.id, sub.id), { created: 1000 });
    expect(done.status).toBe(200);
    expect(await mirrorOf(sub.id)).toMatchObject({ user_id: u.id, status: "active" });
    expect((await eventRow(done.id)).status).toBe("processed");

    expect((await deliver("customer.subscription.updated", { ...sub, status: "past_due" }, { created: 2000 })).status).toBe(200);
    expect((await mirrorOf(sub.id)).status).toBe("past_due");
    expect((await deliver("customer.subscription.deleted", { ...sub, status: "canceled" }, { created: 3000 })).status).toBe(200);
    expect((await mirrorOf(sub.id)).status).toBe("canceled");
    // delayed older event AND a newer "active" both fail to resurrect
    await deliver("customer.subscription.updated", { ...sub, status: "active" }, { created: 2500 });
    await deliver("customer.subscription.updated", { ...sub, status: "active" }, { created: 4000 });
    expect((await mirrorOf(sub.id)).status).toBe("canceled");

    // exact duplicate delivery is acknowledged without reprocessing
    const dup = await deliver("customer.subscription.deleted", { ...sub, status: "canceled" }, { id: done.id, created: 1000 });
    expect(dup.body.duplicate).toBe(true);
    // a canceled standard member may subscribe again (legacy behaviour preserved)
    expect((await startCheckout(u)).status).toBe(200);
  });

  it("R2 Founders lifecycle: no self-qualification, consent required, enroll, cancel request forfeits, paid-through, re-enrol refused", async () => {
    const u = await createUser(admin, "r2");
    expect((await startCheckout(u, { plan: "founders", consent })).status).toBe(403); // not qualified; route never qualifies
    expect(await q("select 1 from founders.founders_eligibilities where immutable_account_id = $1", [u.id])).toHaveLength(0);

    await engine.qualifyAccount("rreal", { accountId: u.id, registeredAt: new Date().toISOString(), authVerified: true }); // operator action
    expect((await startCheckout(u, { plan: "founders" })).status).toBe(400); // no consent
    expect((await startCheckout(u, { plan: "founders", consent: { ...consent, termsHash: "0".repeat(64) } })).status).toBe(400);
    const co = await startCheckout(u, { plan: "founders", consent });
    expect(co.status).toBe(200);
    expect(co.binding?.kind).toBe("founders");

    const sub = subFixture(FOUNDERS);
    stripe.subs.set(sub.id, sub);
    // subscription.created can arrive BEFORE checkout.session.completed: no binding yet -> nothing granted, acknowledged
    const early = await deliver("customer.subscription.created", sub, { created: 5000 });
    expect(early.status).toBe(200);
    expect(await mirrorOf(sub.id)).toBeUndefined();

    expect((await deliver("checkout.session.completed", session(co.binding!.session_id, u.id, sub.id), { created: 5001 })).status).toBe(200);
    expect(await mirrorOf(sub.id)).toMatchObject({ user_id: u.id, status: "active" });
    const enr = await q<{ subscription_status: string; provider_subscription_id: string }>("select subscription_status, provider_subscription_id from founders.founders_enrollments where immutable_account_id = $1", [u.id]);
    expect(enr).toEqual([{ subscription_status: "active", provider_subscription_id: sub.id }]);
    expect((await startCheckout(u, { plan: "founders", consent })).status).toBe(409); // no double checkout

    // cancellation requested: rate forfeited now, access stays until the period ends
    expect((await deliver("customer.subscription.updated", { ...sub, cancel_at_period_end: true }, { created: 6000 })).status).toBe(200);
    expect((await q<{ eligibility_status: string }>("select eligibility_status from founders.founders_eligibilities where immutable_account_id = $1", [u.id]))[0].eligibility_status).toBe("forfeited");
    expect((await mirrorOf(sub.id)).status).toBe("active");
    // "un-cancel" must not restore the rate
    await deliver("customer.subscription.updated", { ...sub, cancel_at_period_end: false }, { created: 6500 });
    expect((await q<{ eligibility_status: string }>("select eligibility_status from founders.founders_eligibilities where immutable_account_id = $1", [u.id]))[0].eligibility_status).toBe("forfeited");

    expect((await deliver("customer.subscription.deleted", { ...sub, status: "canceled" }, { created: 7000 })).status).toBe(200);
    expect((await mirrorOf(sub.id)).status).toBe("canceled");
    expect((await startCheckout(u, { plan: "founders", consent })).status).toBe(403); // permanently forfeited
  });

  it("R3 no impersonation: metadata, client_reference_id and foreign sessions cannot attach a subscription to an account", async () => {
    const victim = await createUser(admin, "r3v");
    const attacker = await createUser(admin, "r3a");

    // (a) subscription event naming the victim in metadata, no server-side binding
    const s1 = subFixture(FOUNDERS, { metadata: { app: "rreal-ai-academy", user_id: victim.id, account_id: victim.id } });
    expect((await deliver("customer.subscription.created", s1, { created: 100 })).status).toBe(200);
    // (b) checkout.session.completed for a session we never created, Founders price, victim as client_reference_id
    const s2 = subFixture(FOUNDERS); stripe.subs.set(s2.id, s2);
    expect((await deliver("checkout.session.completed", session(rid("cs_live"), victim.id, s2.id), { created: 101 })).status).toBe(200);
    // (c) the attacker's own recorded session, replayed with the victim as client_reference_id
    const co = await startCheckout(attacker);
    const s3 = subFixture(LEGACY, { amount: 100 }); stripe.subs.set(s3.id, s3);
    expect((await deliver("checkout.session.completed", session(co.binding!.session_id, victim.id, s3.id), { created: 102 })).status).toBe(200);
    // (d) payment-link session
    const s4 = subFixture(LEGACY, { amount: 100 }); stripe.subs.set(s4.id, s4);
    await deliver("checkout.session.completed", session(rid("cs_live"), victim.id, s4.id, { payment_link: "plink_x" }), { created: 103 });

    expect(await q("select 1 from public.subscriptions where user_id = $1", [victim.id])).toHaveLength(0);
    expect(await q("select 1 from founders.founders_enrollments where immutable_account_id = $1", [victim.id])).toHaveLength(0);
    expect(await q("select 1 from founders.founders_eligibilities where immutable_account_id = $1", [victim.id])).toHaveLength(0);
  });

  it("R4 fail closed + retry: a missing SQL function answers 500, leaves the event retryable, and the retry converges once", async () => {
    const u = await createUser(admin, "r4");
    const co = await startCheckout(u);
    const sub = subFixture(LEGACY, { amount: 100 }); stripe.subs.set(sub.id, sub);
    const evt = rid("evt");
    const obj = session(co.binding!.session_id, u.id, sub.id);

    await admin.query("alter function public.upsert_subscription_ordered(text, uuid, text, text, text, timestamptz, boolean, bigint) rename to upsert_subscription_ordered_gone");
    await admin.query("notify pgrst, 'reload schema'");
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const failed = await deliver("checkout.session.completed", obj, { id: evt, created: 200 });
      expect(failed.status).toBe(500);
      expect(await mirrorOf(sub.id)).toBeUndefined();
      expect((await eventRow(evt)).status).toBe("processing");
    } finally {
      await admin.query("alter function public.upsert_subscription_ordered_gone(text, uuid, text, text, text, timestamptz, boolean, bigint) rename to upsert_subscription_ordered");
      await admin.query("notify pgrst, 'reload schema'");
      await new Promise((r) => setTimeout(r, 1500));
    }
    const retried = await deliver("checkout.session.completed", obj, { id: evt, created: 200 });
    expect(retried.status).toBe(200);
    expect(retried.body.duplicate).toBeUndefined();
    expect(await mirrorOf(sub.id)).toMatchObject({ user_id: u.id, status: "active" });
    expect(await eventRow(evt)).toMatchObject({ status: "processed", attempts: 2 });
    expect((await deliver("checkout.session.completed", obj, { id: evt, created: 200 })).body.duplicate).toBe(true);
    expect(await q("select 1 from public.subscriptions where stripe_subscription_id = $1", [sub.id])).toHaveLength(1);
  });

  it("R5 Founders terms are bound: wrong amount on the Founders price id grants nothing and is not acknowledged", async () => {
    const u = await createUser(admin, "r5");
    await engine.qualifyAccount("rreal", { accountId: u.id, registeredAt: new Date().toISOString(), authVerified: true });
    const co = await startCheckout(u, { plan: "founders", consent });
    const sub = subFixture(FOUNDERS, { amount: 1 }); stripe.subs.set(sub.id, sub);
    const r = await deliver("checkout.session.completed", session(co.binding!.session_id, u.id, sub.id), { created: 300 });
    expect(r.status).toBe(500);
    expect(await mirrorOf(sub.id)).toBeUndefined();
    expect(await q("select 1 from founders.founders_enrollments where immutable_account_id = $1", [u.id])).toHaveLength(0);
  });

  it("R6 double checkout: any live row blocks, regardless of row order", async () => {
    const u = await createUser(admin, "r6");
    await admin.query("insert into public.subscriptions(user_id, stripe_customer_id, stripe_subscription_id, status, plan) values ($1,'cus_a',$2,'canceled','monthly'), ($1,'cus_a',$3,'active','monthly')", [u.id, rid("sub"), rid("sub")]);
    const before = stripe.calls.create;
    expect((await startCheckout(u)).status).toBe(409);
    expect(stripe.calls.create).toBe(before);
  });

  it("R7 bad signature and malformed timestamps write nothing", async () => {
    const u = await createUser(admin, "r7");
    const co = await startCheckout(u);
    const sub = subFixture(LEGACY, { amount: 100 }); stripe.subs.set(sub.id, sub);
    const forged = signedEvent(`whsec_${"0".repeat(48)}`, "checkout.session.completed", session(co.binding!.session_id, u.id, sub.id));
    expect((await webhook(forged.request)).status).toBe(400);
    expect(await eventRow(forged.id)).toBeUndefined();

    const zero = await deliver("checkout.session.completed", session(co.binding!.session_id, u.id, sub.id), { created: 0 });
    expect(zero.status).toBe(500);
    expect(await mirrorOf(sub.id)).toBeUndefined();
  });

  it("R8 the API roles cannot reach the new functions or tables directly", async () => {
    const u = await createUser(admin, "r8");
    const c = userClient(current.restUrl, u);
    const up = await c.rpc("upsert_subscription_ordered", { p_sub_id: "sub_x", p_user_id: u.id, p_customer_id: null, p_status: "active", p_plan: "monthly", p_current_period_end: null, p_cancel_at_period_end: false, p_event_created: 1 });
    expect(up.error).toBeTruthy();
    expect((await c.rpc("claim_webhook_event", { p_id: "evt_x", p_type: "t" })).error).toBeTruthy();
    expect((await c.from("checkout_bindings").select("session_id")).data ?? []).toHaveLength(0);
    expect((await c.from("checkout_bindings").insert({ session_id: "cs_x", user_id: u.id, kind: "founders", price_id: FOUNDERS, livemode: true })).error).toBeTruthy();
    expect(await q("select 1 from public.subscriptions where user_id = $1", [u.id])).toHaveLength(0);
  });
});
