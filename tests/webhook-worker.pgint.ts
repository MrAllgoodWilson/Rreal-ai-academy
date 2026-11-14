/**
 * X-series worker: ONE OS process performing one action against the real route handlers / Founders engine.
 * Driven by tests/pgint-multiproc.mjs, which spawns several of these at once. Skipped unless HW_WORKER_ACTION is set.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { fakeStripe, need, signedEvent, signJwt, startRestProxy, type SubFixture } from "./pgint-helpers";

const stripe = fakeStripe();
vi.mock("@/lib/stripe", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/stripe")>();
  return { ...real, getStripe: () => stripe.client };
});

const action = process.env.HW_WORKER_ACTION;

describe.skipIf(!action)("X worker", () => {
  it(`performs ${action}`, async () => {
    const params = JSON.parse(need("HW_WORKER_PARAMS")) as {
      type?: string; object?: unknown; id?: string; created?: number; subs?: SubFixture[]; accountId?: string;
    };
    const out = need("HW_WORKER_OUT");
    const proxy = await startRestProxy(need("HW_REST_URL"));
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: proxy.url,
      SUPABASE_SERVICE_ROLE_KEY: signJwt({ role: "service_role" }, need("HW_JWT_SECRET")),
      STRIPE_WEBHOOK_SECRET: need("HW_WHSEC"),
      STRIPE_FOUNDERS_PRICE_ID: "price_HWLOCALFOUNDERS499",
      REFERRALS_ENABLED: "false",
    });
    for (const k of ["STRIPE_CHECKOUT_MODE", "STRIPE_SECRET_KEY", "STRIPE_PRICE_MONTHLY", "DATABASE_URL"]) delete process.env[k];
    for (const s of params.subs ?? []) stripe.subs.set(s.id, s);

    const wiring = await import("@/lib/founders-engine");
    const webhook = action === "deliver" ? (await import("@/app/api/webhooks/stripe/route")).POST : null;
    const engine = action === "qualify" ? wiring.getDefaultFoundersRulesEngine() : null;
    const request = action === "deliver"
      ? signedEvent(need("HW_WHSEC"), params.type!, params.object, { id: params.id, created: params.created }).request
      : null;

    // Everything is loaded; mark ready, then wait for the shared start barrier so the processes truly overlap.
    fs.writeFileSync(`${out}.ready`, String(process.pid));
    const startAt = Number(need("HW_START_AT"));
    while (Date.now() < startAt) await new Promise((r) => setTimeout(r, 2));

    const t0 = Date.now();
    let result: Record<string, unknown>;
    try {
      if (webhook && request) {
        const res = await webhook(request);
        result = { status: res.status, body: await res.json() };
      } else if (engine) {
        await engine.qualifyAccount("rreal", { accountId: params.accountId!, registeredAt: new Date().toISOString(), authVerified: true });
        result = { ok: true };
      } else {
        throw new Error(`unknown action ${action}`);
      }
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "unknown" };
    }
    fs.writeFileSync(out, JSON.stringify({ pid: process.pid, t0, t1: Date.now(), ...result }));
    await wiring.resetFoundersWiringForTests();
    await proxy.close();
    expect(true).toBe(true);
  });
});
