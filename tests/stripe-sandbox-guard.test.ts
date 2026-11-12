import { describe, expect, it } from "vitest";
import { resolveCheckoutPrice } from "../src/lib/stripe-sandbox-guard";

const livePrice = "price_1UXevHK68Pw0CGHvMMNt6NeD";

describe("Rreal internal Stripe sandbox isolation", () => {
  it("preserves existing live price when sandbox mode is not selected", () => {
    expect(resolveCheckoutPrice({} as unknown as NodeJS.ProcessEnv)).toEqual({ priceId: livePrice, sandbox: false });
  });

  it("rejects sandbox without an explicitly configured test-only key and distinct test price", () => {
    for (const env of [
      { STRIPE_CHECKOUT_MODE: "test" },
      { STRIPE_CHECKOUT_MODE: "test", STRIPE_SECRET_KEY: "sk_live_NOT_SAFE", STRIPE_TEST_PRICE_MONTHLY: "price_sandbox123" },
      { STRIPE_CHECKOUT_MODE: "test", STRIPE_SECRET_KEY: "sk_test_dummyaaa" },
      { STRIPE_CHECKOUT_MODE: "test", STRIPE_SECRET_KEY: "sk_test_dummyaaa", STRIPE_TEST_PRICE_MONTHLY: livePrice },
      { STRIPE_CHECKOUT_MODE: "test", STRIPE_SECRET_KEY: "sk_test_dummyaaa", STRIPE_TEST_PRICE_MONTHLY: "invalid" },
      { STRIPE_CHECKOUT_MODE: "unknown" },
    ]) {
      expect(resolveCheckoutPrice(env as unknown as NodeJS.ProcessEnv)).toBe(null);
    }
  });

  it("accepts a distinct test-mode key and price (without proving Stripe entitlement)", () => {
    expect(resolveCheckoutPrice({
      STRIPE_CHECKOUT_MODE: "test",
      STRIPE_SECRET_KEY: "sk_test_dummyaaa",
      STRIPE_TEST_PRICE_MONTHLY: "price_sandbox123"
    } as unknown as NodeJS.ProcessEnv)).toEqual({ priceId: "price_sandbox123", sandbox: true });
  });
});
