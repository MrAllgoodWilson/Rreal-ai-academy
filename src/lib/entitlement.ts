/**
 * Rreal AI Academy is FREE for every signed-in learner (founder decision 2026-11-17).
 *
 * This single flag replaces the old "active $1/month membership" requirement everywhere the app decides whether a signed-in
 * learner may use courses, tools and certificates. It defaults to ON. Fair-use quotas (server-auth.ts QUOTAS) still apply to
 * every learner: free access never means unmetered AI spend.
 *
 * Kill switch / rollback: build with NEXT_PUBLIC_FREE_ACCESS=false (server and browser read the same inlined value) AND set the
 * database switch `app_settings.free_access` to false (migration 0010; it gates complete_lesson / create_custom_course). Both layers
 * must agree, so rolling back is a deliberate two-step operation documented in docs/FREE_ACCESS_2026-11-17.md.
 *
 * Existing paid subscriptions are NOT touched by this flag: they stay active, keep renewing until the member cancels, and remain
 * manageable in the billing portal. Nothing here cancels, refunds or charges anyone.
 */
export const FREE_ACCESS: boolean = process.env.NEXT_PUBLIC_FREE_ACCESS !== "false";

/** True when this learner may use the product: everyone while free access is on, otherwise only active/trialing subscribers. */
export function hasAccess(status: string | null | undefined): boolean {
  return FREE_ACCESS || status === "active" || status === "trialing";
}
