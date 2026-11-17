import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Rreal AI Academy is FREE for every signed-in learner (founder decision 2026-11-17). These tests pin the entitlement behaviour,
// including the kill switch, and prove that free mode can never create a Stripe checkout or a live charge.
// Disposable fixtures only; no network, no production credentials.

const load = async (freeAccess: "true" | "false" | undefined) => {
  vi.resetModules();
  if (freeAccess === undefined) vi.stubEnv("NEXT_PUBLIC_FREE_ACCESS", ""); else vi.stubEnv("NEXT_PUBLIC_FREE_ACCESS", freeAccess);
  return import("@/lib/entitlement");
};
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks(); });

describe("entitlement (client + server share one flag)", () => {
  it("defaults to FREE: any learner is entitled, whatever the subscription status", async () => {
    const e = await load(undefined);
    expect(e.FREE_ACCESS).toBe(true);
    for (const s of [undefined, null, "none", "canceled", "past_due", "incomplete", "active", "trialing"]) expect(e.hasAccess(s)).toBe(true);
  });
  it("kill switch off restores the old rule exactly: only active/trialing subscribers", async () => {
    const e = await load("false");
    expect(e.FREE_ACCESS).toBe(false);
    expect(e.hasAccess("active")).toBe(true);
    expect(e.hasAccess("trialing")).toBe(true);
    for (const s of [undefined, null, "none", "canceled", "past_due", "unpaid", "incomplete"]) expect(e.hasAccess(s)).toBe(false);
  });
  it("only the exact string 'false' turns it off (a typo cannot silently re-enable a paywall)", async () => {
    for (const v of ["FALSE", "0", "no", " false"]) expect((await load(v as "true")).FREE_ACCESS).toBe(true);
  });
  it("the lesson lock no longer returns 'subscription' for an entitled learner", async () => {
    const { lockReason, nextLesson } = await import("@/lib/curriculum");
    const { hasAccess } = await load(undefined);
    const first = nextLesson({})!.lesson.id;
    expect(lockReason(first, {}, { subscribed: hasAccess("none") })).toBeNull();
    expect(lockReason(first, {}, { subscribed: false })).toBe("subscription"); // the lock itself is intact for the kill-switch state
  });
});

describe("server membership gate (getMember)", () => {
  const state = vi.hoisted(() => ({ subQueries: 0, sub: null as null | { status: string }, user: { id: "fixture-user" } as null | { id: string } }));
  const build = async (flag: "true" | "false") => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_FREE_ACCESS", flag);
    vi.doMock("@/lib/supabase/server", () => ({
      getSupabaseServer: async () => ({
        auth: { getUser: async () => ({ data: { user: state.user } }) },
        from: () => ({ select: () => ({ eq: () => ({ in: () => ({ limit: () => ({ maybeSingle: async () => { state.subQueries++; return { data: state.sub }; } }) }) }) }) }),
        rpc: async () => ({ data: true, error: null }),
      }),
    }));
    return import("@/lib/server-auth");
  };
  beforeEach(() => { state.subQueries = 0; state.sub = null; state.user = { id: "fixture-user" }; });

  it("FREE: a learner with NO subscription passes a requireSubscription route, with no subscription lookup at all", async () => {
    const { getMember } = await build("true");
    const r = await getMember({ requireSubscription: true });
    expect("error" in r).toBe(false);
    expect(state.subQueries).toBe(0);
  });
  it("FREE: still requires sign-in (free is not anonymous)", async () => {
    state.user = null;
    const { getMember } = await build("true");
    const r = await getMember({ requireSubscription: true });
    expect("error" in r && r.error.status).toBe(401);
  });
  it("KILL SWITCH: without a subscription the route answers 402 subscription_required, exactly as before", async () => {
    const { getMember } = await build("false");
    const r = await getMember({ requireSubscription: true });
    expect("error" in r && r.error.status).toBe(402);
    expect("error" in r && (await r.error.json()).code).toBe("subscription_required");
  });
  it("KILL SWITCH: an existing paying member is still let in", async () => {
    state.sub = { status: "active" };
    const { getMember } = await build("false");
    const r = await getMember({ requireSubscription: true });
    expect("error" in r).toBe(false);
  });
  it("fair use still applies to a free learner: quotas are unchanged", async () => {
    const { QUOTAS } = await build("true");
    expect(QUOTAS.coach.limit).toBeGreaterThan(0);
    expect(QUOTAS.video.limit).toBeLessThanOrEqual(1);
    expect(Object.values(QUOTAS).every((q) => Number.isFinite(q.limit) && q.limit > 0)).toBe(true);
  });
});

describe("Stripe checkout is closed while the Academy is free", () => {
  const calls = vi.hoisted(() => ({ stripe: 0, supabase: 0 }));
  const route = async (flag: "true" | "false") => {
    vi.resetModules();
    calls.stripe = 0; calls.supabase = 0;
    vi.stubEnv("NEXT_PUBLIC_FREE_ACCESS", flag);
    vi.doMock("@/lib/stripe", () => ({ getStripe: () => { calls.stripe++; return null; }, MONTHLY_PRICE_ID: "price_fixture" }));
    vi.doMock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => { calls.supabase++; return null; } }));
    return import("@/app/api/stripe/checkout/route");
  };
  const post = (m: { POST: (r: Request) => Promise<Response> }) => m.POST(new Request("https://example.test/api/stripe/checkout", { method: "POST", body: "{}" }));

  it("FREE: answers 410 free_access and touches neither Stripe nor the database (no session, customer or charge can be created)", async () => {
    const r = await post(await route("true"));
    expect(r.status).toBe(410);
    expect((await r.json()).code).toBe("free_access");
    expect(calls.stripe).toBe(0);
    expect(calls.supabase).toBe(0);
  });
  it("KILL SWITCH: the original checkout path is reachable again (demo mode answers 501 here)", async () => {
    const r = await post(await route("false"));
    expect(r.status).toBe(501);
    expect(calls.supabase).toBe(1);
  });
});
