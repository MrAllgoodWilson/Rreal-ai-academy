# Rreal AI Academy is free for everyone (founder decision 2026-11-17)

Status: implemented on branch `feature/free-for-all-20261117` (stacked on the sign-up fix `e30720d8`). **NOT deployed. The production database migration has NOT been applied. No Stripe change, refund, cancellation or charge was made.** No personal data (emails, customer IDs, payment details) is in this document.

## What changed
Three independent layers, all defaulting to FREE, all reversible:

| Layer | Change | Switch back |
|---|---|---|
| App (client + server) | `src/lib/entitlement.ts` `FREE_ACCESS`: the learner's `subscribed` flag now means "entitled" (everyone signed in while free). Server `getMember`, the member route guard, lesson locks, dashboard CTAs and the certificate route follow it. | Build with `NEXT_PUBLIC_FREE_ACCESS=false` |
| Database | Migration `0010_free_access.sql`: `app_settings.free_access` (default true) read by `has_access(uid)`; `complete_lesson` and `create_custom_course` use it instead of the inline subscription check (their bodies are otherwise byte-for-byte the latest repo definitions). | `update public.app_settings set value='false'::jsonb where key='free_access';` (instant, no redeploy) |
| Stripe checkout | `/api/stripe/checkout` answers **410 `free_access` before any Stripe call** while free: no session, customer or live charge can be created from the app. The billing portal and the webhook are untouched (existing subscribers keep full control). | Same build flag |

Pages: home, pricing (now "Free"), `/subscribe` (now a plain redirect, so old links and any in-flight Stripe return URL continue to the dashboard), sign-up (goes straight to onboarding), settings (billing note for existing payers), credits, sponsors, terms, privacy, delete-account copy, nav, i18n (EN/ES, separate `free.*` keys so the paid copy returns with the kill switch). Fair-use quotas (`takeQuota` / `consume_quota`) are unchanged: **free never means unmetered AI.**

## Existing customers (read-only facts from live Stripe + Supabase, counts and dates only)
- Rreal's live $1/month price has exactly **2 active subscriptions** (Supabase `subscriptions` agrees: 2 active). Both bill automatically, neither is set to cancel.
  - A: started 2026-11-03 20:52 EST, **next renewal 2026-12-03 20:52 EST**.
  - B: started 2026-11-16 21:53 EST (about two hours before this decision), **next renewal 2026-12-16 21:53 EST**.
- Nothing was cancelled, refunded or changed. They keep their account and content (everyone does). The settings page tells them plainly that their membership is unchanged, still renews, and is theirs to cancel.
- **Founder decision needed before 2026-12-03:** (A) leave them running (current behaviour); (B) cancel both at period end so no further $1 is charged (no refund); (C) cancel now and refund (esp. B, paid ~2 h before the change). Any of B/C is a Stripe write and needs explicit approval; I will not do it unprompted.
- **A live Stripe Payment Link for the $1/month membership is still active** (redirects to `/subscribe?checkout=success`). The app no longer offers it, but anyone holding the URL could still start a subscription. Recommend deactivating it in Stripe (needs approval). The three optional credit-pack payment links stay (optional power-ups, never required).

## Verification (all local, disposable)
- Unit: `tests/free-access.test.ts` (11) + `tests/signup-duplicate-incident.test.ts` (12) and the rest of the suite: **152/152**. Typecheck and lint clean.
- Database: `tests/sql/free-access-checks.sh` **18/18** on a throwaway Postgres, on production's exact base (migrations 0001-0005, `UPTO=5`) and on 0001-0009 (`UPTO=9`). Covers: a learner with no subscription completes a lesson and saves a custom course; quotas still block the 3rd use; learners cannot read/modify the switch or call `has_access`; switch OFF restores "subscription required" exactly while an existing payer is unaffected; re-applying the migration never flips a deliberately-off switch; subscriptions rows untouched; prerequisite rules still apply. Negative control (a migration that ignores the switch) fails exactly the 3 free-learner checks.
- Production parity: the two replaced functions' fingerprints on a fresh 0001-0005 database equal production's live definitions (`complete_lesson` md5 `9655e9b9…` len 4140; `create_custom_course` md5 `415108ea…` len 2286), so the migration changes only the entitlement predicate. Production has migrations 0001-0005 only (referral/wallet 0006-0009 are not live).
- Browser smoke (demo mode, built app, axe a11y): 64/66. New free-flow checks pass: sign-up lands on onboarding with no paywall, `/subscribe` just continues, no payment prompt, pricing says Free. The 2 failures (`voice picker offers premium voices`, `voice gender filter`) need a premium-voice key and pre-date this change (not verified against the old commit). The smoke runs in demo mode, so it does not exercise the Supabase path.

## Deployment runbook (needs founder approval; nothing below has been run)
1. **Backup artifact (before anything):** the current production definitions are the repo's 0002/0004 functions (fingerprints above); `subscriptions` rows are never modified. Optionally take a Supabase backup/branch first.
2. **Database first:** apply `0010_free_access.sql` to production (additive: one new table, two helper functions, two replaced functions). Safe with the old code still live (the old UI just keeps showing the paywall).
3. **Then the code** to the Cloudflare Worker `rreal-ai-academy` (OpenNext: `npm run deploy` or Workers Builds). No new secrets are needed; `NEXT_PUBLIC_FREE_ACCESS` defaults to true.
4. **Verify in a real browser** (a disposable test account with the founder's say-so, never a charge): sign up -> onboarding -> a lesson completes with no paywall -> certificate eligibility -> `/subscribe` redirects -> `/pricing` says Free -> `POST /api/stripe/checkout` answers 410.
5. **Rollback:** (a) instant: set the database switch to false and redeploy with `NEXT_PUBLIC_FREE_ACCESS=false` (or `wrangler rollback` to the previous Worker version); (b) data is untouched in every case.

## Known limits / residual risk
- **Referral program is inert while free:** rewards depend on paid membership payments, so no new qualifying referrals will occur (UI copy was not changed here; decide whether to hide it).
- **Nudge emails** still go only to paying members (migration 0005 targets active subscribers). Emailing all free learners is a consent/marketing decision, not changed.
- **Abuse/cost:** free sign-up removes the payment barrier. The sign-up rate limiter is per-instance memory (weak on Workers); quotas bound AI cost per account, not per person. Recommend a durable limiter and a daily spend alert before announcing.
- **Legal text:** terms/privacy wording was updated minimally; it needs counsel review.
- **Sponsor/ad hooks:** the existing sponsors page was reworded to "keep the Academy free"; no ad code was added.
- **Optional power-ups** (credits) remain purchasable and are described as never required.
