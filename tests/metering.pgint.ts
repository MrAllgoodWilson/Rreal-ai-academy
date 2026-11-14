/**
 * C-series: the managed-AI wrapper (callClaude) on the durable Postgres ledger with the real Founders entitlement check.
 * REAL: Postgres 17, Founders library stores, the wrapper, reservation/settlement/hold/reconciliation.
 * SIMULATED: the model provider (a counting stub replaces the single Workers AI dispatch; no inference is bought).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { Pool } from "pg";
import { assertDisposableTarget, createUser, need, rid } from "./pgint-helpers";

const provider = {
  calls: [] as { model: string; maxTokens: number }[],
  next: null as null | (() => Promise<{ text: string | null; usage?: { promptTokens?: number; completionTokens?: number } }>),
};
vi.mock("@/lib/cf-ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/cf-ai")>();
  return {
    ...real,
    cfManagedText: async (model: string, opts: { maxTokens: number }) => {
      provider.calls.push({ model, maxTokens: opts.maxTokens });
      return provider.next ? provider.next() : { text: "ok", usage: { promptTokens: 40, completionTokens: 20 } };
    },
  };
});

let admin: Pool;
let callClaude: typeof import("@/lib/claude").callClaude;
let metering: typeof import("@/lib/founders-metering");
let wiring: typeof import("@/lib/founders-engine");
let member: string;
let outsider: string;

const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await admin.query(sql, args)).rows as T[];
const reservations = (acct: string) => q<{ id: string; status: string }>("select id, status from founders.founders_cost_reservations where immutable_account_id = $1 order by created_at", [acct]);
const ledger = async (acct: string) => (await q<{ settled: string; reserved: string; units: number; units_reserved: number; conc: number }>(
  "select total_settled_cost_usd settled, total_reserved_cost_usd reserved, total_units_consumed units, total_units_reserved units_reserved, active_concurrency conc from founders.founders_cost_ledger where immutable_account_id = $1", [acct]))[0];
const ask = (accountId: string, over: Partial<{ system: string; content: string; maxTokens: number }> = {}) =>
  callClaude({ system: over.system ?? "You are a tutor.", messages: [{ role: "user", content: over.content ?? "Explain prompts briefly." }], maxTokens: over.maxTokens ?? 300, funding: { kind: "managed", accountId } });

async function enroll(accountId: string) {
  const engine = wiring.getDefaultFoundersRulesEngine();
  await engine.qualifyAccount("rreal", { accountId, registeredAt: new Date().toISOString(), authVerified: true });
  const r = await engine.processSubscriptionWebhook("rreal", {
    id: rid("evt"), type: "customer.subscription.created", livemode: true, created: Math.floor(Date.now() / 1000),
    data: { object: { id: rid("sub"), customer: rid("cus"), status: "active", client_reference_id: accountId, cancel_at_period_end: false,
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, metadata: { company_id: "rreal" },
      items: { data: [{ price: { id: "price_rreal_founders_499_monthly", unit_amount: 499, currency: "usd", recurring: { interval: "month" } } }] } } },
  });
  expect(r.status).toBe("enrollment_saved");
}

beforeAll(async () => {
  admin = new Pool({ connectionString: need("HW_PG_ADMIN_URL"), max: 3 });
  await assertDisposableTarget(admin);
  await admin.query("truncate founders.founders_audit_trail, founders.founders_processed_events, founders.founders_identity_signals, founders.founders_cost_reservations, founders.founders_cost_ledger, founders.founders_enrollments, founders.founders_eligibilities, founders.founders_offers cascade");
  await admin.query("update founders.founders_pilot_counter set total_ever_admitted = 0 where id = 'portfolio_cap'");
  await admin.query("insert into founders.founders_offers (id, company_id, merchant_context, deliverables, beta_terms_version, terms_hash) values ('offer_rreal_c','rreal','rreal-founders-beta','[]'::jsonb,'c-v1',$1)", [crypto.createHash("sha256").update("c").digest("hex")]);
  for (const k of ["STRIPE_CHECKOUT_MODE", "DATABASE_URL", "WORKERS_AI_MODEL", "AI_GATEWAY_MODEL", "AI_GATEWAY_ID", "ANTHROPIC_API_KEY"]) delete process.env[k];
  wiring = await import("@/lib/founders-engine");
  callClaude = (await import("@/lib/claude")).callClaude;
  metering = await import("@/lib/founders-metering");
  member = (await createUser(admin, "c-member")).id;
  outsider = (await createUser(admin, "c-out")).id;
  await enroll(member);
});
beforeEach(() => { provider.calls.length = 0; provider.next = null; delete process.env.WORKERS_AI_MODEL; delete process.env.AI_GATEWAY_MODEL; });
afterAll(async () => { await wiring.resetFoundersWiringForTests(); await admin?.end(); });

describe("C: managed AI wrapper on the durable ledger (provider simulated)", () => {
  it("C1 no Founders entitlement: no reservation and ZERO provider calls", async () => {
    expect(await ask(outsider)).toBeNull();
    expect(provider.calls).toHaveLength(0);
    expect(await reservations(outsider)).toHaveLength(0);
  });

  it("C2 entitled: one dispatch of the approved model, bounded output, settled from provider-reported usage", async () => {
    provider.next = async () => ({ text: "hello", usage: { promptTokens: 123, completionTokens: 45 } });
    expect(await ask(member, { maxTokens: 5000 })).toBe("hello");
    expect(provider.calls).toEqual([{ model: "@cf/meta/llama-3.2-3b-instruct", maxTokens: 1000 }]);
    const r = await reservations(member);
    expect(r.map((x) => x.status)).toEqual(["settled"]);
    const l = await ledger(member);
    expect(Number(l.settled)).toBeCloseTo((123 * 0.051 + 45 * 0.335) / 1e6, 6);
    expect(Number(l.reserved)).toBe(0);
    expect(l).toMatchObject({ units: 1, units_reserved: 0, conc: 0 });
  });

  it("C3 provider omits usage: nothing is settled as an estimate; the hold blocks further spend until reconciled with evidence", async () => {
    const before = await ledger(member);
    provider.next = async () => ({ text: "text without usage" });
    expect(await ask(member)).toBeNull();
    expect(provider.calls).toHaveLength(1);
    const held = await metering.listHeldReservations(member);
    expect(held).toHaveLength(1);
    const mid = await ledger(member);
    expect(Number(mid.settled)).toBe(Number(before.settled)); // missing usage did not become zero-cost or estimate
    expect(Number(mid.reserved)).toBeGreaterThan(0);
    expect(mid.conc).toBe(1);

    // concurrency slot is still held: the next request is refused before any dispatch
    provider.calls.length = 0; provider.next = null;
    expect(await ask(member)).toBeNull();
    expect(provider.calls).toHaveLength(0);

    await expect(metering.reconcileReservation(held[0].id, { kind: "provider_usage", inputTokens: 60, outputTokens: 30, source: "" })).rejects.toThrow();
    expect(await metering.reconcileReservation(held[0].id, { kind: "provider_usage", inputTokens: 60, outputTokens: 30, source: "provider usage export (simulated)" })).toBe("settled");
    await expect(metering.reconcileReservation(held[0].id, { kind: "verified_not_executed", source: "double reconcile" })).rejects.toThrow();
    const after = await ledger(member);
    expect(Number(after.settled)).toBeCloseTo(Number(before.settled) + (60 * 0.051 + 30 * 0.335) / 1e6, 6);
    expect(after.conc).toBe(0);
    expect(await ask(member)).toBe("ok");
  });

  it("C4 provider error/timeout after dispatch: reservation held; released only on verified non-execution", async () => {
    provider.next = async () => { throw new Error("timeout"); };
    expect(await ask(member)).toBeNull();
    const held = await metering.listHeldReservations(member);
    expect(held).toHaveLength(1);
    expect((await ledger(member)).conc).toBe(1);
    expect(await metering.reconcileReservation(held[0].id, { kind: "verified_not_executed", source: "provider log shows no request (simulated)" })).toBe("released");
    const l = await ledger(member);
    expect(l.conc).toBe(0);
    expect(Number(l.reserved)).toBe(0);
  });

  it("C5 request over the hard limits is refused before dispatch (prompt bound is bytes, not chars/4)", async () => {
    const n = (await reservations(member)).length;
    expect(await ask(member, { content: "x".repeat(2100) })).toBeNull();
    expect(await ask(member, { content: "é".repeat(1100) })).toBeNull(); // 2200 bytes
    expect(provider.calls).toHaveLength(0);
    expect(await reservations(member)).toHaveLength(n);
  });

  it("C6 unauthorized model override or gateway model: refused before dispatch", async () => {
    process.env.WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    expect(await ask(member)).toBeNull();
    delete process.env.WORKERS_AI_MODEL;
    process.env.AI_GATEWAY_MODEL = "anthropic/claude-sonnet";
    expect(await ask(member)).toBeNull();
    expect(provider.calls).toHaveLength(0);
  });

  it("C7 monthly unit quota exhausted: refused with ZERO provider calls; state survives a fresh wiring (restart)", async () => {
    await admin.query("update founders.founders_cost_ledger set total_units_consumed = 200 where immutable_account_id = $1", [member]);
    await wiring.resetFoundersWiringForTests();
    (await import("@/lib/claude")).setDefaultCostMeteringManager(null);
    expect(await ask(member)).toBeNull();
    expect(provider.calls).toHaveLength(0);
  });

  it("C8 cancellation ends managed funding: after the subscription is canceled no call is dispatched", async () => {
    const u = (await createUser(admin, "c-cancel")).id;
    await enroll(u);
    expect(await ask(u)).toBe("ok");
    const sub = (await q<{ id: string }>("select provider_subscription_id id from founders.founders_enrollments where immutable_account_id = $1", [u]))[0].id;
    await wiring.getDefaultFoundersRulesEngine().processSubscriptionWebhook("rreal", {
      id: rid("evt"), type: "customer.subscription.deleted", livemode: true, created: Math.floor(Date.now() / 1000) + 10,
      data: { object: { id: sub, status: "canceled", client_reference_id: u, metadata: { company_id: "rreal" }, items: { data: [{ price: { id: "price_rreal_founders_499_monthly", unit_amount: 499, currency: "usd" } }] } } },
    });
    provider.calls.length = 0;
    expect(await ask(u)).toBeNull();
    expect(provider.calls).toHaveLength(0);
  });

  it("C9 member-key (BYOK) funding never touches the Academy meter or the managed model, even when it fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
    const n = (await reservations(member)).length;
    const out = await callClaude({ system: "s", messages: [{ role: "user", content: "hi" }], funding: { kind: "byok", byok: { anthropic: "sk-ant-" + "a".repeat(30) } } });
    expect(out).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(provider.calls).toHaveLength(0);
    expect(await reservations(member)).toHaveLength(n);
    fetchSpy.mockRestore();
    // no funding mode -> programmer error, not a silent managed call
    await expect(callClaude({ system: "s", messages: [] } as never)).rejects.toThrow();
  });
});
