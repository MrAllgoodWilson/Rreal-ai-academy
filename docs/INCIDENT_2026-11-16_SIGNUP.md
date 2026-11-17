# Incident 2026-11-16 22:27 EST: first-time learner told "email already exists" (redacted RCA)

Status: fix on branch `fix/signup-silent-success-duplicate-20261117`; NOT deployed. No production data was written, deleted or reset in the investigation. No email address, password or token appears in this document.

## What happened (production evidence, redacted)
Read-only queries on the production Supabase project (aggregate counts and timestamps only):

| Time (UTC, 2026-11-17) | Event |
|---|---|
| 03:24:39 | `POST /auth/v1/admin/users` 200: the learner's account was CREATED; two `token` 200 calls: signed in server-side within 1 s |
| 03:25:09 | `POST /auth/v1/admin/users` 422 `email_exists`: a SECOND sign-up with the same email, 30 s later. This is the error the learner saw |
| 03:26:19 | `POST /auth/v1/token` 400 `invalid_credentials`: a sign-in attempt that failed |
| 03:26:35 | `admin/generate_link` 200: password recovery requested |
| 03:26:52 | `verify` 200: recovery link used successfully; the learner got in (newest account `last_sign_in` matches) |

Compared with an earlier successful sign-up (02:50 UTC), which produced 53 follow-up `GET /auth/v1/user` calls (a live session), the incident account produced only 2 before the second sign-up: the page gave no visible sign of success.

## Classification (Leroy's list)
- Real existing identity created by the learner's OWN first attempt 30 s earlier: **YES** (the 422 was genuine, not a bug in GoTrue).
- Phantom duplicate profile: no. All 5 `auth.users` have exactly one profile, user_state row and identity; 0 orphans either way; 0 duplicate or upper-case emails; trigger `on_auth_user_created` present.
- Stale pre-created user: no (every account was created by the app's sign-up route; provider `email` only).
- Wrong Supabase project: no (the logs and rows above are the production project `rreal-ai-academy`; the three other projects in the account are inactive).
- Learner error: not assumed. The product let a successful sign-up look like nothing happened.

## Root causes (two defects, both in this repo)
1. **Silent success.** `/signup` page: after `signUp()` returned `{ok:true}` with no message the form stayed on screen and relied on a separate state hydration to redirect. A learner who sees an unchanged form submits again.
2. **A retry was treated as an error, and the error matcher was too loose.** `/api/auth/signup` answered any `createUser` failure whose text contained "already", "registered" or "exists" with "An account with that email already exists" (HTTP 409), so (a) a repeat submit of the same credentials failed instead of signing the person in, and (b) an unrelated database error mentioning one of those words would have been mis-reported as an existing email.

Why the page stayed silent in the specific incident cannot be proven from server logs (no browser telemetry): either the form was not redirected, or the learner returned to it from `/subscribe`. The fix covers both.

## Fix
- `src/lib/signup-errors.ts`: only `email_exists` / `user_already_exists` (or the exact legacy 422 text) mean "existing email".
- `/api/auth/signup`: on an existing email, verify the SUBMITTED password once with `signInWithPassword`. Match => idempotent success (signed in, nothing created or changed, no referral side effects). No match => 409 with `code: "email_exists"` and "Sign in, or use Forgot password" (the real account is never overwritten or opened). Other errors => generic 500; only the error code is logged, never the message.
- `/signup` page: success navigates to `/subscribe` immediately and keeps the button locked; an `email_exists` error shows **Sign in** and **Forgot password** links.
- Tests: `tests/signup-duplicate-incident.test.ts` (12). Against the OLD route 3 fail (retry returns 409; no code/guidance; an unrelated database error is reported as an existing email); all 12 pass on the fix. Full suite 141/141, typecheck and lint clean.

## Known limits / residual
- OAuth / OTP conflicts: the app has only the email provider, so there is no OAuth/OTP path to test; `user_already_exists` is classified for completeness.
- Inaccessible email: the Forgot-password route needs the email. A learner who knows the password can sign in; one who knows neither needs operator-assisted recovery (not automated; no bypass).
- Email enumeration: the 409 still confirms that an address has an account (inherent to the no-confirmation-email design, already rate limited). A repeat submit with the correct password now also acts as a sign-in; that is one password check per request behind the same rate limit and Supabase's own limits. The sign-up rate limiter is per-instance memory, so it is weak on Workers; recommend a durable limiter as a follow-up.
- The browser-side reason for the silent form is unverified (no client telemetry).

## Deployment gate / operator action
No data repair is needed (the learner's account exists and works). Deploying needs founder approval (`npm run deploy` or Workers Builds). After deploy: one real first-time sign-up in a browser must land on `/subscribe`, and a repeat submit must sign in; do not create production accounts for testing without the founder's say-so (use disposable fixtures). Rreal public registration is separate from the TiQology founder-only allowlist and is unaffected by it.
