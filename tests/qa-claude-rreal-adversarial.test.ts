// Independent QA (Claude): adversarial probes for Rreal application integration 930a0a7 — tries to defeat the IMPLEMENTATION (not the test fixtures). Copy into <export>/tests/.
// Stateful in-memory Stripe/Supabase stand-ins; no network/keys. Each probe states what a correct implementation must do.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const store: any = { subs: new Map<string, any>(), events: new Set<string>(), sessions: [] as any[], subRows: [] as any[], hasStripe: true };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({ MONTHLY_PRICE_ID: "price_1UXevHK68Pw0CGHvMMNt6NeD",
  getStripe: () => store.hasStripe ? ({ checkout: { sessions: { create: async (a: any) => { store.sessions.push(a); return { id: "cs_x", url: "https://c.test/x" }; } } }, subscriptions: { retrieve: async (id: string) => store.retrieve ? store.retrieve(id) : ({ id, status: "active", customer: "cus_1", metadata: { app: "rreal-ai-academy" }, items: { data: [{ price: { id: "price_1UXevHK68Pw0CGHvMMNt6NeD" } }] }, current_period_end: 1900000000 }) } }) : null,
  verifyWebhook: async (raw: string) => JSON.parse(raw) }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", email: "a@m.test" } } }) }, from: () => ({ select: () => ({ eq: () => ({ not: () => ({ limit: () => ({ maybeSingle: async () => ({ data: store.subRows[0] ?? null }) }) }), in: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }),
  getSupabaseAdmin: () => ({ from: (t: string) => ({ insert: async (r: any) => { if (store.events.has(r.id)) return { error: { code: "23505" } }; store.events.add(r.id); return { error: null }; }, upsert: async (r: any) => { if (t === "subscriptions") store.subs.set(r.stripe_subscription_id, { ...r }); return { error: null }; }, delete: () => ({ eq: async (_c: string, id: string) => { store.events.delete(id); return {}; } }), select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }), or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }), rpc: async () => ({ error: null }) }) }));
vi.mock("@/lib/referrals-server", () => ({ processReferralPaymentEvent: async () => {} }));
const ENV0 = { ...process.env }; const U1 = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { store.subs.clear(); store.events.clear(); store.sessions.length = 0; store.subRows = []; store.hasStripe = true; store.retrieve = null; process.env = { ...ENV0, STRIPE_WEBHOOK_SECRET: "whsec_l", STRIPE_SECRET_KEY: "sk_live_abc", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }; delete process.env.STRIPE_CHECKOUT_MODE; });
const subEv = (id: string, status: string, created: number, price = "price_1UXevHK68Pw0CGHvMMNt6NeD") => JSON.stringify({ id, type: "customer.subscription.updated", livemode: true, created, data: { object: { id: "sub_A", status, customer: "cus_1", metadata: { app: "rreal-ai-academy", user_id: U1 }, items: { data: [{ price: { id: price } }] }, current_period_end: 1900000000 } } });
const post = async (body: string) => { const { POST } = await import("../src/app/api/webhooks/stripe/route"); return POST(new Request("https://x.test/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": "s" } })); };
const status = () => store.subs.get("sub_A")?.status;
const walk = (d: string, out: string[] = []) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(f)) out.push(p); } return out; };

describe("Rreal 930a0a7 adversarial", () => {
  for (const env of ["test", "production"]) {
    it(`A [${env}] out-of-order protection works with REALISTIC Stripe event ids and survives between requests: active(100) -> canceled(300) -> stale active(200) must end canceled`, async () => {
      vi.stubEnv("NODE_ENV", env);
      await post(subEv("evt_1QabcAAAA", "active", 100)); await post(subEv("evt_1QabcCCCC", "canceled", 300)); await post(subEv("evt_1QabcBBBB", "active", 200));
      expect(status(), "stale active event resurrected a cancelled subscription").toBe("canceled"); vi.unstubAllEnvs();
    });
  }
  it("B price allow-list contains only configured real price ids (no hard-coded test fixture ids such as 'price_LIVE1' / placeholders)", async () => {
    await post(subEv("evt_1QpriceAA", "active", 100, "price_LIVE1")); expect(store.subs.size, "fixture price id accepted by the production allow-list").toBe(0);
  });
  it("C consistency: if checkout still redirects to the public Payment Link when no API key is configured, the webhook must grant that purchase (else customers pay and get nothing)", async () => {
    store.hasStripe = false; delete process.env.STRIPE_SECRET_KEY; process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK = "https://buy.stripe.com/LIVELINK";
    const { POST: checkout } = await import("../src/app/api/stripe/checkout/route"); const r = await checkout(new Request("https://x.test/api/stripe/checkout", { method: "POST" })); const j: any = await r.json(); const offered = !!j.url;
    await post(JSON.stringify({ id: "evt_1QlinkAAAA", type: "checkout.session.completed", livemode: true, created: 100, data: { object: { id: "cs_live_link", mode: "subscription", subscription: "sub_L", client_reference_id: U1, payment_link: "plink_ABC", payment_status: "paid", customer: "cus_1", metadata: {} } } }));
    expect(!offered || store.subs.size === 1, `checkout offered a Payment Link (${offered}) but the webhook granted ${store.subs.size} memberships`).toBe(true);
  });
  it("D double-checkout guard cannot be bypassed by an older cancelled row: user has [canceled, active] rows — a second Checkout Session must NOT be created", async () => {
    store.subRows = [{ stripe_customer_id: "cus_old", status: "canceled" }, { stripe_customer_id: "cus_1", status: "active" }];
    const { POST: checkout } = await import("../src/app/api/stripe/checkout/route"); await checkout(new Request("https://x.test/api/stripe/checkout", { method: "POST" })); expect(store.sessions.length, "second checkout created although an active subscription exists").toBe(0);
  });
  it("D2 [control] a single active row blocks a second checkout", async () => {
    store.subRows = [{ stripe_customer_id: "cus_1", status: "active" }]; const { POST: checkout } = await import("../src/app/api/stripe/checkout/route"); const r = await checkout(new Request("https://x.test/api/stripe/checkout", { method: "POST" })); expect(r.status).toBe(400); expect(store.sessions.length).toBe(0);
  });
  it("E every production callClaude() call-site passes metering (otherwise the meter is bypassed)", () => {
    const files = walk(join(process.cwd(), "src/app")); const missing: string[] = [];
    for (const f of files) { const s = readFileSync(f, "utf8"); const re = /callClaude\(\s*\{([\s\S]*?)\}\s*\)/g; let m; while ((m = re.exec(s))) if (!/metering\s*:/.test(m[1])) missing.push(f.replace(process.cwd() + "/", "")); }
    expect(missing, "unmetered callClaude call sites: " + missing.join(", ")).toEqual([]);
  });
  it("F the default cost store is durable (not MemoryFoundersCostStore) and metering cannot be skipped by omitting the option", () => {
    const s = readFileSync(join(process.cwd(), "src/lib/claude.ts"), "utf8"); expect(s, "default metering manager uses MemoryFoundersCostStore").not.toMatch(/new CostMeteringManager\(new MemoryFoundersCostStore\(\)\)/); expect(s, "callClaude falls through to an unmetered provider call when options.metering is absent").not.toMatch(/return await executeProviderCall\(opts\);\s*\}/);
  });
  it("G settlement uses PROVIDER-reported usage, not estimates or char/4", () => {
    const s = readFileSync(join(process.cwd(), "src/lib/claude.ts"), "utf8"); expect(s, "actual input tokens equal the pre-call estimate; output derived from char/4").not.toMatch(/actualInputTokens:\s*estimatedPromptTokens/);
  });
  it("H production code contains no test-fixture detection (event-id prefixes, hard-coded test session ids, NODE_ENV==='test' behaviour switches)", () => {
    const s = readFileSync(join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"), "utf8"); const hits = [/evt_\[123\]/, /startsWith\("evt_/, /"cs_2"/, /cs_async_sub/, /NODE_ENV === "test"/].filter((r) => r.test(s)).map(String); expect(hits, "test-fitting logic in the production webhook: " + hits.join(" ")).toEqual([]);
  });
  it("I ordering state is durable: it must not live in a module-level Map that is deleted at the end of each request", () => {
    const s = readFileSync(join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"), "utf8"); expect(s, "in-memory latestSubEvents Map").not.toMatch(/new Map<string, \{ created: number/); expect(s).not.toMatch(/latestSubEvents\.delete/);
  });
});
