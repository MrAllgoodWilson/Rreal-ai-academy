const DEFAULT_LIVE_PRICE = "price_1UXevHK68Pw0CGHvMMNt6NeD";

/** 
 * Fail closed on temporary internal sandbox checkout.
 * Do not silently fall back to the live Payment Link.
 * The presence of a test key alone does not enable this path.
 */
export function resolveCheckoutPrice(env: NodeJS.ProcessEnv): { priceId: string; sandbox: boolean } | null {
  if (env.STRIPE_CHECKOUT_MODE !== "test") {
    if (env.STRIPE_CHECKOUT_MODE && env.STRIPE_CHECKOUT_MODE !== "live") return null;
    const key = env.STRIPE_SECRET_KEY || "";
    // If a secret key is present in live/unset mode, it must be a valid live key, never a test key.
    if (key && !/^(sk|rk)_live_[A-Za-z0-9]+$/.test(key)) return null;
    return { priceId: env.STRIPE_PRICE_MONTHLY || DEFAULT_LIVE_PRICE, sandbox: false };
  }
  const key = env.STRIPE_SECRET_KEY || "";
  const testPrice = env.STRIPE_TEST_PRICE_MONTHLY || "";
  if (!/^sk_test_[A-Za-z0-9]+$/.test(key)) return null;
  if (!/^price_[A-Za-z0-9]+$/.test(testPrice)) return null;
  const configuredLivePrice = env.STRIPE_PRICE_MONTHLY || DEFAULT_LIVE_PRICE;
  if (testPrice === DEFAULT_LIVE_PRICE || testPrice === configuredLivePrice) return null;
  return { priceId: testPrice, sandbox: true };
}
