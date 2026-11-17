/**
 * Classifies a Supabase Auth `admin.createUser` failure. The previous route matched /already|registered|exists/ against the
 * error TEXT, so any unrelated failure containing one of those words (for example a database error mentioning a constraint) was
 * reported to the learner as "an account with that email already exists". Only the explicit codes below count.
 */
export type CreateUserErrorKind = "email_exists" | "other";

export function classifyCreateUserError(e: { message?: string; code?: string; status?: number }): CreateUserErrorKind {
  if (e.code === "email_exists" || e.code === "user_already_exists") return "email_exists";
  // Older GoTrue releases return no code: accept only the exact 422 "already been registered" response.
  if (e.status === 422 && /already been registered|already registered/i.test(e.message ?? "")) return "email_exists";
  return "other";
}
