const KEY = "rreal.pending-referral";
export const validReferralCode = (value: string) => /^[a-f0-9]{32}$/.test(value);
export function rememberReferral(code: string) {
  if (typeof window === "undefined" || !validReferralCode(code)) return;
  try { window.sessionStorage.setItem(KEY, code); } catch { /* Explicit signup field still reaches the server. */ }
}
export function forgetReferral() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(KEY); } catch { /* No stored attribution can be cleared in this browser. */ }
}
/** Called before Checkout so a delayed email-confirmation flow does not lose attribution. */
export async function capturePendingReferral() {
  if (process.env.NEXT_PUBLIC_REFERRALS_ENABLED !== "true" || typeof window === "undefined") return;
  let code: string | null = null;
  try { code = window.sessionStorage.getItem(KEY); } catch { return; }
  if (!code || !validReferralCode(code)) return;
  const res = await fetch("/api/referrals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "attribute", code }) });
  if (!res.ok) throw new Error("Referral attribution is temporarily unavailable. Please retry before starting checkout.");
  const data = await res.json();
  if (typeof data.ok !== "boolean") throw new Error("Referral attribution could not be confirmed.");
  // true=attributed; false=already attributed/paid or invalid/self code. Never overwrite the original source.
  try { window.sessionStorage.removeItem(KEY); } catch { /* Retrying is idempotent. */ }
}
