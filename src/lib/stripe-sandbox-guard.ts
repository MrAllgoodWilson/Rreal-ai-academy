/** 
 * Fail closed on temporary internal sandbox checkout.
 * Do not silently fall back to the live Payment Link.
 * The presence of a test key alone does not enable this path.
 */
export function resolveCheckoutPrice(env: NodeJS.ProcessEnv): { priceId: string; sandbox: boolean } | null {
  if (env.STRIPE_CHECKOUT_MODE !== "test") {
    if (env.STRIPE_CHECKOUT_MODE && env.STRIPE_CHECKOUT_MODE !== "live") return null;
    return { priceId: env.STRIPE_PRICE_MONTHLY || "price_1UXevHK68Pw0CGHvMMNt6NeD", sandbox: false };
  }
  const key = env.STRIPE_SECRET_KEY || "";
  const testPrice = env.STRIPE_TEST_PRICE_MONTHLY || "";
  if (!/^sk_test_[A-Za-z0-9]+$/.test(key)) return null;
  if (!/^price_[A-Za-z0-9]+$/.test(testPrice)) return null;
  if (testPrice === "price_1UXevHK68Pw0CGHvMMNt6NeD") return null;
  return { priceId: testPrice, sandbox: true };
}
