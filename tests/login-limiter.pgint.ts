/**
 * L-series: the real sign-in route with the durable SQL limiter (migration 0013) through PostgREST.
 * SIMULATED: the auth provider's password check (a stub decides success/failure).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { Pool } from "pg";
import { assertDisposableTarget, need, signJwt, startRestProxy } from "./pgint-helpers";

const auth = { goodPassword: "correct-horse", calls: 0 };
vi.mock("@/lib/supabase/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/supabase/server")>();
  return {
    ...real,
    getSupabaseServer: async () => ({
      auth: { signInWithPassword: async ({ password }: { password: string }) => { auth.calls++; return { error: password === auth.goodPassword ? null : { message: "Invalid login credentials" } }; } },
    }),
  };
});

let admin: Pool;
let proxy: { url: string; close: () => Promise<void> };
const tag = crypto.randomBytes(6).toString("hex");
const ip = (n: number) => `203.0.113.${n}`;

async function login(identifier: string, password: string, headers: Record<string, string>) {
  const { POST } = await import("@/app/api/auth/login/route");
  const res = await POST(new Request("http://127.0.0.1/api/auth/login", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ identifier, password }) }));
  return res.status;
}

beforeAll(async () => {
  admin = new Pool({ connectionString: need("HW_PG_ADMIN_URL"), max: 2 });
  await assertDisposableTarget(admin);
  await admin.query("truncate public.rate_limits");
  proxy = await startRestProxy(need("HW_REST_URL"));
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: proxy.url, SUPABASE_SERVICE_ROLE_KEY: signJwt({ role: "service_role" }, need("HW_JWT_SECRET")) });
  delete process.env.STRIPE_CHECKOUT_MODE;
});
afterAll(async () => { await proxy?.close(); await admin?.end(); });

describe("L: durable sign-in throttling (auth provider simulated)", () => {
  it("L1 rotating X-Forwarded-For does not reset the per-address limit", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push(await login(`l1-${tag}-${i}@x.test`, "wrong", { "cf-connecting-ip": ip(1), "x-forwarded-for": `198.51.100.${i}` }));
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it("L2 a guesser is stopped for that account from their address, while the owner still signs in from another", async () => {
    const victim = `l2-${tag}@x.test`;
    const before = auth.calls;
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push(await login(victim, "wrong", { "cf-connecting-ip": ip(2) }));
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
    expect(auth.calls - before).toBe(5); // refused attempts never reach the password check
    expect(await login(victim, auth.goodPassword, { "cf-connecting-ip": ip(3) })).toBe(200);
  });

  it("L3 the counters are in the database: a fresh module instance (restart / other worker) is still throttled", async () => {
    vi.resetModules();
    expect(await login(`l2-${tag}@x.test`, auth.goodPassword, { "cf-connecting-ip": ip(2) })).toBe(429);
    const rows = await admin.query("select key from public.rate_limits");
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => /^[0-9a-f]{64}$/.test(r.key))).toBe(true); // hashed keys only, no identifiers or addresses
  });

  it("L4 successful sign-ins are not counted as failures", async () => {
    const me = `l4-${tag}@x.test`;
    for (let i = 0; i < 8; i++) expect(await login(me, auth.goodPassword, { "cf-connecting-ip": ip(4) })).toBe(200);
  });

  it("L5 distributed guessing against one account hits the account-wide brake at 50 failures", async () => {
    const victim = `l5-${tag}@x.test`;
    let last = 0;
    for (let i = 0; i < 51; i++) last = await login(victim, "wrong", { "cf-connecting-ip": ip(10 + i) });
    expect(last).toBe(429);
  });

  it("L6 limiter unavailable -> 503, never an unthrottled attempt", async () => {
    await admin.query("alter function public.rate_limit_hit(text, integer, integer) rename to rate_limit_hit_gone");
    await admin.query("notify pgrst, 'reload schema'");
    await new Promise((r) => setTimeout(r, 1500));
    const before = auth.calls;
    try {
      expect(await login(`l6-${tag}@x.test`, auth.goodPassword, { "cf-connecting-ip": ip(200) })).toBe(503);
      expect(auth.calls).toBe(before);
    } finally {
      await admin.query("alter function public.rate_limit_hit_gone(text, integer, integer) rename to rate_limit_hit");
      await admin.query("notify pgrst, 'reload schema'");
      await new Promise((r) => setTimeout(r, 1500));
    }
  });
});
