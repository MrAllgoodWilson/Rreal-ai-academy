const DEFAULT_LIVE_PRICE = "price_1UXevHK68Pw0CGHvMMNt6NeD";

/** 
 * Fail closed on temporary internal sandbox checkout.
 * Do not silently fall back to the live Payment Link.
 * The presence of a test key alone does not enable this path.
 */
export function resolveCheckoutPrice(env: Readonly<Record<string, string | undefined>>): { priceId: string; sandbox: boolean } | null {
  if (env.STRIPE_CHECKOUT_MODE !== "test") {
    if (env.STRIPE_CHECKOUT_MODE && env.STRIPE_CHECKOUT_MODE !== "live") return null;
    const key = env.STRIPE_SECRET_KEY || "";
    // If a secret key is present in live/unset mode, it must be a valid live key, never a test key.
    if (key && !/^(sk|rk)_live_[A-Za-z0-9]+$/.test(key)) return null;
    return { priceId: env.STRIPE_PRICE_MONTHLY || DEFAULT_LIVE_PRICE, sandbox: false };
  }
  const key = env.STRIPE_SECRET_KEY || "";
  const testPrice = env.STRIPE_TEST_PRICE_MONTHLY || "";
  if (!sandboxStorageSafe(env)) return null;
  if (!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key)) return null;
  if (!/^price_[A-Za-z0-9]+$/.test(testPrice)) return null;
  const configuredLivePrice = env.STRIPE_PRICE_MONTHLY || DEFAULT_LIVE_PRICE;
  if (testPrice === DEFAULT_LIVE_PRICE || testPrice === configuredLivePrice) return null;
  return { priceId: testPrice, sandbox: true };
}

/** A test deployment must point ALL user/browser/admin clients at the same isolated project.
 * No runtime switching of a production deployment into test mode is supported.
 */
export function sandboxStorageSafe(env: Readonly<Record<string, string | undefined>>): boolean {
  try {
    const ref = env.SUPABASE_TEST_PROJECT_REF || "";
    const prod = env.SUPABASE_PRODUCTION_PROJECT_REF || "";
    if (!/^[a-z0-9]{20}$/.test(ref) || !/^[a-z0-9]{20}$/.test(prod) || ref === prod) return false;
    const expected = `https://${ref}.supabase.co`;
    if (env.NEXT_PUBLIC_SUPABASE_URL !== expected || env.SUPABASE_TEST_URL !== expected) return false;
    const anon = env.SUPABASE_TEST_ANON_KEY;
    const admin = env.SUPABASE_TEST_SERVICE_ROLE_KEY;
    return !!anon && !!admin && anon !== admin
      && env.NEXT_PUBLIC_SUPABASE_ANON_KEY === anon
      && env.SUPABASE_SERVICE_ROLE_KEY === admin;
  } catch { return false; }
}
