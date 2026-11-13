import { describe, it, expect, vi, beforeEach } from "vitest";
import { isolatedStorage } from "./isolated-storage-fixture";
import { callClaude } from "@/lib/claude";
import {
  CostMeteringManager,
  MemoryFoundersCostStore,
  AccountBoundRulesEngine,
  MemoryFoundersStore,
  AuthenticatedAccount,
  FoundersOffer,
  RateForfeitedException,
  computeTermsHash,
  setDefaultFoundersRulesEngine,
} from "@/lib/founders";

vi.mock("server-only", () => ({}));

// Stateful stand-ins for Supabase and Stripe
const db: any = {
  subscriptions: new Map<string, any>(),
  webhookEvents: new Set<string>(),
  sessions: [] as any[],
  subRows: [] as any[],
};

const TEST_FOUNDERS_PRICE = "price_testfounders499monthly";

vi.mock("@/lib/stripe", () => ({
  MONTHLY_PRICE_ID: "price_testfounders499monthly",
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (args: any) => {
          db.sessions.push(args);
          return { id: "cs_test_founders_1", url: "https://checkout.stripe.test/c/pay/cs_test_founders_1" };
        },
      },
    },
    subscriptions: {
      retrieve: async (id: string) => ({
        id,
        status: db.subscriptions.get(id)?.status || "active",
        customer: "cus_test_1",
        metadata: { app: "rreal-ai-academy", user_id: "11111111-1111-4111-8111-111111111111" },
        items: {
          data: [{ price: { id: TEST_FOUNDERS_PRICE } }],
        },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        cancel_at_period_end: false,
      }),
    },
  }),
  verifyWebhook: async (raw: string) => JSON.parse(raw),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: "founder-member@rreal.test",
          },
        },
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          not: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: db.subRows[0] ?? null,
              }),
            }),
          }),
        }),
      }),
    }),
  }),
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      insert: async (row: any) => {
        if (table === "webhook_events") {
          if (db.webhookEvents.has(row.id)) return { error: { code: "23505" } };
          db.webhookEvents.add(row.id);
        }
        return { error: null };
      },
      upsert: async (row: any) => {
        if (table === "subscriptions") {
          db.subscriptions.set(row.stripe_subscription_id, { ...row });
        }
        return { error: null };
      },
      delete: () => ({
        eq: async (_col: string, id: string) => {
          db.webhookEvents.delete(id);
          return {};
        },
      }),
      select: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
        or: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    }),
    rpc: async () => ({ error: null }),
  }),
}));

vi.mock("@/lib/referrals-server", () => ({ processReferralPaymentEvent: async () => {} }));

describe("Founders Beta — Isolated Stripe Test Payment -> Usable Service -> Cancellation -> Recovery E2E", () => {
  const USER_ID = "11111111-1111-4111-8111-111111111111";
  const SUB_ID = "sub_test_founders_100";
  const ENV_BACKUP = { ...process.env };

  let costStore: MemoryFoundersCostStore;
  let costManager: CostMeteringManager;
  let rulesStore: MemoryFoundersStore;
  let rulesEngine: AccountBoundRulesEngine;
  let offer: FoundersOffer;

  beforeEach(async () => {
    db.subscriptions.clear();
    db.webhookEvents.clear();
    db.sessions.length = 0;
    db.subRows.length = 0;
    process.env = {
      ...ENV_BACKUP,
      ...isolatedStorage,
      STRIPE_CHECKOUT_MODE: "test",
      STRIPE_TEST_WEBHOOK_SECRET: "whsec_test_founders",
      STRIPE_SECRET_KEY: "sk_test_mockfounderskey",
      STRIPE_TEST_PRICE_MONTHLY: TEST_FOUNDERS_PRICE,
      STRIPE_PRICE_MONTHLY: "price_1UXevHK68Pw0CGHvMMNt6NeD",
      STRIPE_FOUNDERS_PRICE_ID: TEST_FOUNDERS_PRICE,
    };

    costStore = new MemoryFoundersCostStore();
    costManager = new CostMeteringManager(costStore);
    rulesStore = new MemoryFoundersStore();
    rulesEngine = new AccountBoundRulesEngine(rulesStore);

    const deliverables = ["200 compute credits", "Creator tools access", "$4.99 price lock"];
    const termsHash = computeTermsHash(deliverables, 499, "month", "2026-11-12");

    offer = {
      id: "offer_rreal_founders_v1",
      companyId: "rreal",
      merchantContext: "rreal-ai-academy",
      offerVersion: 1,
      currency: "usd",
      unitAmount: 499,
      billingInterval: "month",
      state: "active",
      deliverables,
      betaTermsVersion: "2026-11-12",
      termsHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await rulesStore.saveOffer(offer);
    setDefaultFoundersRulesEngine(rulesEngine);
  });

  it("Step 1 -> 5: Full verified isolated lifecycle demonstration", async () => {
    // -------------------------------------------------------------------------
    // STEP 1: Authenticated Account Starts Checkout Session for Founders Beta
    // -------------------------------------------------------------------------
    const account: AuthenticatedAccount = {
      accountId: USER_ID,
      authVerified: true,
      registeredAt: new Date().toISOString(),
      identitySignals: { emailHash: "founder-member@rreal.test" },
      isClosed: false,
    };

    // Server-side eligibility qualification
    const qualification = await rulesEngine.qualifyAccount("rreal", account);
    expect(qualification.eligibilityStatus).toBe("eligible");

    // Call Next.js Checkout route
    const { POST: checkoutPost } = await import("@/app/api/stripe/checkout/route");
    const checkoutReq = new Request("https://isolated-test.rreal.test/api/stripe/checkout", {
      method: "POST",
    });
    const checkoutRes = await checkoutPost(checkoutReq);
    const checkoutJson = await checkoutRes.json();
    expect(checkoutRes.status).toBe(200);

    expect(checkoutJson.url).toContain("cs_test_founders_1");
    expect(db.sessions.length).toBe(1);
    expect(db.sessions[0].client_reference_id).toBe(USER_ID);
    expect(db.sessions[0].line_items[0].price).toBe(TEST_FOUNDERS_PRICE);

    // -------------------------------------------------------------------------
    // STEP 2: Signed Test Webhook Completes Checkout and Provisions Access
    // -------------------------------------------------------------------------
    const { POST: webhookPost } = await import("@/app/api/webhooks/stripe/route");
    const completedWebhookEvent = {
      id: "evt_test_checkout_completed_1",
      type: "checkout.session.completed",
      livemode: false,
      created: 1731500100,
      data: {
        object: {
          id: "cs_test_founders_1",
          mode: "subscription",
          subscription: SUB_ID,
          client_reference_id: USER_ID,
          customer: "cus_test_1",
          payment_status: "paid",
          metadata: { app: "rreal-ai-academy", environment: "sandbox" },
        },
      },
    };

    const webhookRes = await webhookPost(
      new Request("https://isolated-test.rreal.test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig_test_valid" },
        body: JSON.stringify(completedWebhookEvent),
      }),
    );
    expect(webhookRes.status).toBe(200);

    // Verify subscription row was saved with active status
    const savedSub = db.subscriptions.get(SUB_ID);
    expect(savedSub).toBeDefined();
    expect(savedSub.status).toBe("active");
    expect(savedSub.user_id).toBe(USER_ID);

    // -------------------------------------------------------------------------
    // STEP 3: Usable Bounded Service Execution via Metered Provider Dispatch
    // -------------------------------------------------------------------------
    const mockModelReply = "AI Prompt Analysis: Excellent concise structure with clear constraint bounds.";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: mockModelReply }],
      }),
    } as any);

    const serviceResult = await callClaude({
      system: "You are an AI academy grading assistant.",
      messages: [{ role: "user", content: "Grade this prompt engineering exercise." }],
      maxTokens: 150,
      byok: { anthropic: "sk-ant-test-key" },
      metering: {
        accountId: USER_ID,
        companyId: "rreal",
        meterManager: costManager,
      },
    });

    expect(serviceResult).toBe(mockModelReply);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Verify ledger recorded unit consumption and cost
    const monthWindow = new Date().toISOString().slice(0, 7);
    const ledger = await costManager.getAccountLedger("rreal", USER_ID, monthWindow);
    expect(ledger.totalUnitsConsumed).toBe(1);
    expect(ledger.totalSettledCostUsd).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // STEP 4: Subscription Cancellation and Permanent Forfeiture
    // -------------------------------------------------------------------------
    const cancelWebhookEvent = {
      id: "evt_test_sub_deleted_1",
      type: "customer.subscription.deleted",
      livemode: false,
      created: 1731500500,
      data: {
        object: {
          id: SUB_ID,
          status: "canceled",
          customer: "cus_test_1",
          metadata: { app: "rreal-ai-academy", user_id: USER_ID, environment: "sandbox" },
          items: {
            data: [{ price: { id: TEST_FOUNDERS_PRICE } }],
          },
        },
      },
    };

    const cancelRes = await webhookPost(
      new Request("https://isolated-test.rreal.test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig_test_valid" },
        body: JSON.stringify(cancelWebhookEvent),
      }),
    );
    expect(cancelRes.status).toBe(200);

    expect(db.subscriptions.get(SUB_ID)?.status).toBe("canceled");

    // Enforce permanent price forfeiture in rules engine
    await rulesEngine.forfeitEligibility("rreal", USER_ID, "Customer canceled subscription");

    // -------------------------------------------------------------------------
    // STEP 5: Recovery Attempt & Denied Re-Enrollment at Beta Rate
    // -------------------------------------------------------------------------
    // Attempting to qualify again at $4.99 Founders rate is STRICTLY REFUSED
    await expect(
      rulesEngine.qualifyAccount("rreal", account),
    ).rejects.toThrow(RateForfeitedException);

    // Double-check: Late out-of-order active event cannot resurrect forfeited subscription
    const staleActiveEvent = {
      id: "evt_test_stale_active_1",
      type: "customer.subscription.updated",
      livemode: false,
      created: 1731500200, // Older than canceled timestamp (1731500500)
      data: {
        object: {
          id: SUB_ID,
          status: "active",
          customer: "cus_test_1",
          metadata: { app: "rreal-ai-academy", user_id: USER_ID, environment: "sandbox" },
          items: {
            data: [{ price: { id: TEST_FOUNDERS_PRICE } }],
          },
        },
      },
    };

    await webhookPost(
      new Request("https://isolated-test.rreal.test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig_test_valid" },
        body: JSON.stringify(staleActiveEvent),
      }),
    );

    // Status remains canceled; stale active event ignored
    expect(db.subscriptions.get(SUB_ID)?.status).toBe("canceled");
  });
});
