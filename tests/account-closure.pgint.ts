/**
 * D-series: account deletion -> Founders forfeiture + tombstone BEFORE the destructive delete, through the real
 * deletion, checkout and webhook routes on a disposable Postgres 17.
 * SIMULATED: the auth provider's admin delete (a stub removes the auth.users row, which cascades exactly like the
 * real one), sign-in, and Stripe.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { assertDisposableTarget, createUser, fakeStripe, need, rid, signedEvent, signJwt, startRestProxy, subFixture, userClient } from "./pgint-helpers";

const stripe = fakeStripe();
const ctl = { user: null as null | { id: string; email: string }, restUrl: "", failDelete: false, deleteCalls: 0 };
let adminPool: Pool;

vi.mock("@/lib/stripe", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/stripe")>()), getStripe: () => stripe.client }));
vi.mock("@/lib/supabase/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/supabase/server")>();
  return {
    ...real,
    getSupabaseServer: async () => {
      if (!ctl.user) return null;
      const c = userClient(ctl.restUrl, ctl.user);
      (c.auth as unknown as { signOut: unknown }).signOut = async () => ({ error: null });
      return c;
    },
    getSupabaseAdmin: () => {
      const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      (c.auth as unknown as { admin: unknown }).admin = {
        deleteUser: async (id: string) => {
          ctl.deleteCalls++;
          if (ctl.failDelete) return { error: { message: "auth provider unavailable" } };
          await adminPool.query("delete from auth.users where id = $1", [id]);
          return { error: null };
        },
        listUsers: async () => ({ data: { users: [] }, error: null }),
      };
      return c;
    },
  };
});

const FOUNDERS = "price_HWLOCALFOUNDERS499";
const WHSEC = `whsec_${crypto.randomBytes(24).toString("hex")}`;
const TERMS = crypto.createHash("sha256").update("d-terms").digest("hex");
const consent = { affirmativeConsent: true, termsHash: TERMS, termsVersion: "d-v1" };
let proxy: { url: string; close: () => Promise<void> };
let closure: typeof import("@/lib/founders-closure");
let wiring: typeof import("@/lib/founders-engine");

const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await adminPool.query(sql, args)).rows as T[];
const elig = async (id: string) => (await q<{ eligibility_status: string }>("select eligibility_status from founders.founders_eligibilities where immutable_account_id = $1", [id]))[0]?.eligibility_status;
const enrollment = async (id: string) => (await q<{ subscription_status: string }>("select subscription_status from founders.founders_enrollments where immutable_account_id = $1", [id]))[0]?.subscription_status;
const closedAudits = async (id: string) => Number((await q<{ n: string }>("select count(*) n from founders.founders_audit_trail where immutable_account_id = $1 and event_type = 'account_closed'", [id]))[0].n);
const exists = async (id: string) => (await q("select 1 from auth.users where id = $1", [id])).length === 1;

async function post(path: "account/delete" | "stripe/checkout" | "webhooks/stripe", user: { id: string; email: string } | null, body: unknown, request?: Request) {
  ctl.user = user;
  const mod = path === "account/delete" ? await import("@/app/api/account/delete/route") : path === "stripe/checkout" ? await import("@/app/api/stripe/checkout/route") : await import("@/app/api/webhooks/stripe/route");
  const res = await mod.POST(request ?? new Request(`http://127.0.0.1/api/${path}`, { method: "POST", headers: { "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) }));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}
const deliver = (type: string, object: unknown, created: number) => post("webhooks/stripe", null, null, signedEvent(WHSEC, type, object, { created }).request);

/** Operator-qualified, enrolled via the real checkout + webhook routes. */
async function enrolledFounder(tag: string) {
  const u = await createUser(adminPool, tag);
  await closure.qualifyFoundersAccount({ id: u.id, email: u.email, registeredAt: new Date().toISOString() });
  expect((await post("stripe/checkout", u, { plan: "founders", consent })).status).toBe(200);
  const session = (await q<{ session_id: string }>("select session_id from public.checkout_bindings where user_id = $1", [u.id]))[0].session_id;
  const sub = subFixture(FOUNDERS); stripe.subs.set(sub.id, sub);
  const t = 10_000 + Math.floor(Math.random() * 1000);
  expect((await deliver("checkout.session.completed", { id: session, object: "checkout.session", mode: "subscription", subscription: sub.id, client_reference_id: u.id, payment_status: "paid", metadata: { app: "rreal-ai-academy" } }, t)).status).toBe(200);
  expect(await enrollment(u.id)).toBe("active");
  return { u, sub, t };
}

beforeAll(async () => {
  adminPool = new Pool({ connectionString: need("HW_PG_ADMIN_URL"), max: 4 });
  await assertDisposableTarget(adminPool);
  await adminPool.query("truncate founders.founders_audit_trail, founders.founders_processed_events, founders.founders_identity_signals, founders.founders_cost_reservations, founders.founders_cost_ledger, founders.founders_enrollments, founders.founders_eligibilities, founders.founders_offers cascade");
  await adminPool.query("update founders.founders_pilot_counter set total_ever_admitted = 0 where id = 'portfolio_cap'");
  await adminPool.query("insert into founders.founders_offers (id, company_id, merchant_context, deliverables, beta_terms_version, terms_hash) values ('offer_rreal_d','rreal','rreal-founders-beta','[]'::jsonb,'d-v1',$1)", [TERMS]);
  proxy = await startRestProxy(need("HW_REST_URL"));
  ctl.restUrl = proxy.url;
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: proxy.url, SUPABASE_SERVICE_ROLE_KEY: signJwt({ role: "service_role" }, need("HW_JWT_SECRET")), STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_FOUNDERS_PRICE_ID: FOUNDERS, REFERRALS_ENABLED: "false", PROJECT_WALLET_ENABLED: "false", FOUNDERS_IDENTITY_HMAC_KEY: need("HW_JWT_SECRET") });
  for (const k of ["STRIPE_CHECKOUT_MODE", "STRIPE_SECRET_KEY", "STRIPE_PRICE_MONTHLY", "DATABASE_URL"]) delete process.env[k];
  closure = await import("@/lib/founders-closure");
  wiring = await import("@/lib/founders-engine");
});
afterAll(async () => { await wiring.resetFoundersWiringForTests(); await proxy?.close(); await adminPool?.end(); });

describe("D: account deletion and the Founders rate (auth provider + Stripe simulated)", () => {
  it("D1 a live subscription blocks deletion and nothing is forfeited", async () => {
    const { u } = await enrolledFounder("d1");
    const r = await post("account/delete", u, { confirm: "DELETE" });
    expect(r.status).toBe(409);
    expect(await elig(u.id)).toBe("enrolled");
    expect(await exists(u.id)).toBe(true);
    expect(await closedAudits(u.id)).toBe(0);
  });

  it("D2 after cancellation, deletion records forfeiture + audit + hashed e-mail tombstone, then removes the account; late webhooks grant nothing", async () => {
    const { u, sub, t } = await enrolledFounder("d2");
    expect((await deliver("customer.subscription.deleted", { ...sub, status: "canceled" }, t + 10)).status).toBe(200);
    const r = await post("account/delete", u, { confirm: "DELETE" });
    expect(r.status).toBe(200);
    expect(await exists(u.id)).toBe(false);
    expect(await q("select 1 from public.subscriptions where user_id = $1", [u.id])).toHaveLength(0); // access gone with the profile
    // tombstone survives the deletion
    expect(await elig(u.id)).toBe("forfeited");
    expect(await enrollment(u.id)).toBe("canceled");
    expect(await closedAudits(u.id)).toBe(1);
    const sig = await q<{ signal_hash: string }>("select signal_hash from founders.founders_identity_signals where immutable_account_id = $1", [u.id]);
    expect(sig.map((s) => s.signal_hash)).toEqual([closure.emailHash(u.email)]);
    expect(JSON.stringify(await q("select * from founders.founders_identity_signals where immutable_account_id = $1", [u.id]))).not.toContain(u.email);
    // a delayed provider event for the dead subscription is acknowledged and changes nothing
    expect((await deliver("customer.subscription.updated", { ...sub, status: "active" }, t + 500)).status).toBe(200);
    expect(await enrollment(u.id)).toBe("canceled");
    expect(await q("select 1 from public.subscriptions where stripe_subscription_id = $1", [sub.id])).toHaveLength(0);
  });

  it("D3 crash/failure between the closure record and the delete: forfeiture stands, the retry converges, no duplicate state", async () => {
    const { u, sub, t } = await enrolledFounder("d3");
    await deliver("customer.subscription.deleted", { ...sub, status: "canceled" }, t + 10);
    ctl.failDelete = true;
    const failed = await post("account/delete", u, { confirm: "DELETE" });
    ctl.failDelete = false;
    expect(failed.status).toBe(500);
    expect(String(failed.body.error)).toMatch(/Founders rate.*can't be restored/); // truthful, not "nothing was lost"
    expect(await exists(u.id)).toBe(true);
    expect(await elig(u.id)).toBe("forfeited");
    expect((await post("stripe/checkout", u, { plan: "founders", consent })).status).toBe(403); // no way back in the window
    const retried = await post("account/delete", u, { confirm: "DELETE" });
    expect(retried.status).toBe(200);
    expect(await exists(u.id)).toBe(false);
    expect(await elig(u.id)).toBe("forfeited");
    expect(await q("select 1 from founders.founders_eligibilities where immutable_account_id = $1", [u.id])).toHaveLength(1);
    expect(await q("select 1 from founders.founders_identity_signals where immutable_account_id = $1", [u.id])).toHaveLength(1);
  });

  it("D4 Founders storage configured but unavailable: nothing is deleted", async () => {
    const u = await createUser(adminPool, "d4");
    const good = process.env.FOUNDERS_DATABASE_URL!;
    await wiring.resetFoundersWiringForTests();
    process.env.FOUNDERS_DATABASE_URL = "postgres://founders_app:wrong@127.0.0.1:1/none";
    const before = ctl.deleteCalls;
    try {
      const r = await post("account/delete", u, { confirm: "DELETE" });
      expect(r.status).toBe(503);
      expect(ctl.deleteCalls).toBe(before);
      expect(await exists(u.id)).toBe(true);
    } finally {
      await wiring.resetFoundersWiringForTests();
      process.env.FOUNDERS_DATABASE_URL = good;
    }
  });

  it("D5 delete then re-register with the same e-mail: the new account cannot be admitted or check out at the Founders rate", async () => {
    const { u, sub, t } = await enrolledFounder("d5");
    await deliver("customer.subscription.deleted", { ...sub, status: "canceled" }, t + 10);
    expect((await post("account/delete", u, { confirm: "DELETE" })).status).toBe(200);
    const again = (await q<{ id: string }>("insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id", [u.email, { username: `again${rid("u").slice(2, 12)}` }]))[0].id;
    expect(again).not.toBe(u.id);
    const admittedBefore = Number((await q<{ n: number }>("select total_ever_admitted n from founders.founders_pilot_counter where id = 'portfolio_cap'"))[0].n);
    await expect(closure.qualifyFoundersAccount({ id: again, email: u.email.toUpperCase(), registeredAt: new Date().toISOString() })).rejects.toThrow();
    expect(await elig(again)).toBeUndefined();
    expect(Number((await q<{ n: number }>("select total_ever_admitted n from founders.founders_pilot_counter where id = 'portfolio_cap'"))[0].n)).toBe(admittedBefore);
    expect((await post("stripe/checkout", { id: again, email: u.email }, { plan: "founders", consent })).status).toBe(403);
  });

  it("D6 closure racing a renewal webhook for the same account: the account ends forfeited and canceled, whichever lands first", async () => {
    const { u, sub, t } = await enrolledFounder("d6");
    const [, hook] = await Promise.all([
      closure.closeFoundersAccount(u.id, u.email),
      deliver("customer.subscription.updated", { ...sub, status: "active" }, t + 50),
    ]);
    expect([200, 500]).toContain(hook.status); // a renewal that loses the race is either ignored or refused for retry
    await deliver("customer.subscription.updated", { ...sub, status: "active" }, t + 60); // provider retry / next renewal
    expect(await elig(u.id)).toBe("forfeited");
    expect(await enrollment(u.id)).toBe("canceled");
  });

  it("D7 an account that never had anything to do with Founders can still be deleted (one audit entry, no eligibility invented)", async () => {
    const u = await createUser(adminPool, "d7");
    expect((await post("account/delete", u, { confirm: "DELETE" })).status).toBe(200);
    expect(await exists(u.id)).toBe(false);
    expect(await elig(u.id)).toBeUndefined();
    expect(await closedAudits(u.id)).toBe(1);
  });
  it("D8 missing identity key refuses deletion and rolls back the closure record", async () => {
    const u = await createUser(adminPool, "d8");
    const key = process.env.FOUNDERS_IDENTITY_HMAC_KEY;
    const before = ctl.deleteCalls;
    delete process.env.FOUNDERS_IDENTITY_HMAC_KEY;
    try {
      const response = await post("account/delete", u, { confirm: "DELETE" });
      expect(response.status).toBe(503);
      expect(ctl.deleteCalls).toBe(before);
      expect(await exists(u.id)).toBe(true);
      expect(await closedAudits(u.id)).toBe(0);
    } finally {
      process.env.FOUNDERS_IDENTITY_HMAC_KEY = key;
    }
  });

});
