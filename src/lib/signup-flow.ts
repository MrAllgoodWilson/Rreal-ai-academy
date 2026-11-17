/** What the sign-up page must do with the result of `signUp`. Pure so it is unit-tested without a browser. */
export type SignupResult = { ok: true; message?: string } | { ok: false; error: string; code?: string };
export type SignupOutcome = { kind: "navigate" } | { kind: "notice"; message: string } | { kind: "error"; message: string; code?: string };

/**
 * A successful sign-up with nothing to say (the server created the account and signed the learner in) must NAVIGATE, not
 * leave the form on screen: on 2026-11-16 a learner saw an unchanged form after a successful sign-up, submitted it again
 * 30 seconds later and was told the email already existed.
 */
export function signupOutcome(r: SignupResult): SignupOutcome {
  if (!r.ok) return { kind: "error", message: r.error, code: r.code };
  if (r.message) return { kind: "notice", message: r.message };
  return { kind: "navigate" };
}
