# Founders integration: migrations, runtime, proofs and open gates

Scope: migrations 0011–0013 and the application code that depends on them. Status words used here are deliberate:
**source complete** (code exists), **locally validated** (proven on a disposable Postgres 17 with simulated
Stripe/auth/provider), **provider verified** (real Stripe TEST evidence), **deployed**. Nothing in this document is
provider verified or deployed.

## 1. Migrations

| File | Adds | Re-runnable | Rollback |
|---|---|---|---|
| `0011_subscription_event_ordering.sql` | `subscriptions.last_event_created` (+ backfill from `updated_at`), `upsert_subscription_ordered`, webhook ledger columns + `claim/complete/fail_webhook_event`, `checkout_bindings`, `bind_checkout_subscription`, `resolve_subscription_account` | yes | drop the six functions; `drop table checkout_bindings`; drop the four `webhook_events` columns + check constraint; drop `subscriptions.last_event_created` |
| `0012_founders_schema.sql` | schema `founders` with the accepted library tables (unchanged) + two terminal-state triggers | yes | `drop schema founders cascade` — **destroys** eligibility, enrollment, audit and cost data |
| `0013_durable_rate_limits.sql` | `rate_limits`, `rate_limit_hit`, `rate_limit_ok` | yes | drop both functions and the table |

Order matters: **apply 0011–0013 before deploying the code**. The new webhook and sign-in routes have no fallback:
without the functions they answer 500/503 (Stripe retries; nothing is granted or lost). The previous code keeps working
on the migrated schema (new columns are additive and defaulted), so "migrate first, deploy second" is safe, and a code
rollback does not require a schema rollback.

Existing data: rows already in `webhook_events` become `status='processed'` (they were only ever kept on success).
Existing subscription rows get `last_event_created` from `updated_at`, so the legacy $1 subscriber cannot be regressed
by a replayed older event. No existing row is deleted or re-bound.

Not yet done against any hosted project: these migrations have only been applied to a disposable local Postgres 17
with Supabase-shaped stubs (`tests/sql/supabase-stub.sql`). Applying them to a real Supabase project is an operator
action that needs founder approval.

## 2. Runtime configuration (names only)

| Name | Purpose |
|---|---|
| `FOUNDERS_DATABASE_URL` (or `DATABASE_URL`) | Direct or session-pooled Postgres connection for the Founders store and cost ledger. **No in-memory fallback exists.** A transaction-pooled connection is not sufficient: the per-account advisory lock is session-scoped. |
| `FOUNDERS_DB_SCHEMA` | Defaults to `founders`. |
| `STRIPE_FOUNDERS_PRICE_ID` | The real Stripe price for the $4.99/month Founders plan. The webhook also verifies amount 499, currency usd, interval month. |
| `FOUNDERS_MANAGED_AI` | Must be exactly `enabled` for any Academy-funded AI call. Unset = no Academy-funded calls at all. |

Deployment gate (open): the app is hosted on Cloudflare Workers. `pg` over a direct connection from Workers needs
`nodejs_compat` TCP sockets or Hyperdrive in session mode; this has **not** been tested on Workers.

The database role used for `FOUNDERS_DATABASE_URL` needs only `USAGE` on schema `founders` and
`SELECT/INSERT/UPDATE/DELETE` on its tables (validated with such a role, `founders_app`, non-superuser).

## 3. Operator actions that code does not perform

- **Qualifying an account for the pilot.** Checkout never qualifies. An operator runs
  `engine.qualifyAccount("rreal", { accountId, registeredAt, authVerified: true })` against the Founders store; the
  cap (5 ever admitted, the coordinator's conservative default — the refill policy is undecided) is enforced there.
- **Seeding the offer row** (`founders.founders_offers`) with the approved terms version and hash.
- **Reconciling held AI reservations** with `reconcileReservation(id, evidence)` in `src/lib/founders-metering.ts`.
  A hold is never released by age; it needs provider usage or provider confirmation that nothing executed.

## 4. Proofs and how to re-run them

All on a harness-owned Postgres 17 (loopback only, nonce marker checked before any write) behind a real PostgREST,
using real supabase-js, the real route handlers and the Stripe SDK's real signature verification.
**Simulated:** Stripe (events built and signed locally, API client is a fixture), sign-in (locally signed JWT), and
the model provider (counting stub). No request leaves the machine.

| Series | File | What it shows |
|---|---|---|
| SQL | `tests/sql/founders-0011-checks.sh` | 24 concurrent first inserts → 1 row; cancel terminal; ties; account re-binding refused; malformed input errors; 12 concurrent claims → exactly one `new`; binding rules; API roles denied |
| R | `tests/webhook-route.pgint.ts` | standard and Founders lifecycles through the real routes; no self-qualification; consent; forfeiture on cancel request with paid-through access; impersonation attempts grant nothing; missing SQL function → 500 → retry converges once; wrong amount grants nothing; double checkout blocked |
| X | `tests/pgint-multiproc.mjs` + `tests/webhook-worker.pgint.ts` | separate OS processes released together: 8 on one new subscription; 4 admitted + 8 simultaneous → exactly 5; one event ×6 → one enrollment/audit/mirror; SIGKILL inside the engine transaction and inside the mirror write (fault window asserted) → retry converges once; cancel-vs-renew tie → canceled and forfeited |
| C | `tests/metering.pgint.ts` | no entitlement / quota exhausted / over limits / model override → zero provider calls; settlement from provider usage; missing usage or timeout → held, blocks further spend, evidence-based reconcile; state survives re-wiring; member-key calls never touch the meter |
| L | `tests/login-limiter.pgint.ts` | rotating `X-Forwarded-For` does not evade; attacker stopped per account+address while the owner signs in elsewhere; counters durable across module reload; limiter outage → 503 |

`npm test` runs the mock/unit suite only. The pgint files need the local stack and are run with
`vitest run --config vitest.pgint.config.mts`.

### Superseded probe files

Four earlier QA probe files model the pre-0011 table calls in their inline mocks, so they fail on fixture shape.
They are kept unedited and excluded from `npm test`; `npm run test:superseded-probes` runs them (expected: 15 failing).

| Old probe | Property | Re-proven by |
|---|---|---|
| baseline F1, adversarial A (test/production) | stale `active` cannot resurrect `canceled`, across requests/processes | SQL T2, R1, X1/X1b |
| baseline F2 | exact replay is a duplicate | SQL T6, R1, R4 |
| baseline F3 | failure then retry processes once | R4, X4, X5 |
| baseline F4 | concurrent deliveries of one event | X3 |
| baseline F5, adversarial D/D2 | no second checkout, regardless of row order | R6, R2 |
| baseline F9 | `past_due`/`unpaid` are recorded | R1, SQL T3 |
| baseline F10 | legacy $1 subscription recorded unchanged | R1 |
| adversarial E | every AI call site is funded explicitly | C1–C9; `callClaude` rejects a call without a funding mode |
| login-throttle F13/F13b | rotating X-Forwarded-For cannot evade; fixed address stops at 10 | L1, L2, L3 |
| sandbox X2 | mirror only accepts a UUID account | unit test "non-UUID … grants nothing"; SQL argument type |

## 5. Isolated Stripe TEST evidence — what is needed (not available today)

No isolated TEST credentials are available to the builders, and the connected Stripe account is live-only, so no
provider-originated evidence exists. Minimal owner actions:

1. In the Stripe account, switch to **Test mode** (or create a Sandbox) and create a product + recurring price:
   USD 4.99 / month. Note the price id.
2. Create a **separate Supabase project** for testing (never the production project). Apply migrations 0001–0013.
3. Create a test-mode webhook endpoint pointing at the test deployment's `/api/webhooks/stripe`, subscribed to
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created|updated|deleted`.
4. Store in the test deployment's secret store (names only): `STRIPE_CHECKOUT_MODE=test`, `STRIPE_SECRET_KEY` (test
   key), `STRIPE_TEST_WEBHOOK_SECRET`, `STRIPE_TEST_PRICE_MONTHLY`, `STRIPE_FOUNDERS_PRICE_ID`, the
   `SUPABASE_TEST_*` / `SUPABASE_PRODUCTION_PROJECT_REF` set required by `sandboxStorageSafe`, `FOUNDERS_DATABASE_URL`.
   Never paste values into chat, the bridge, or a file in the repository.
5. Then run, with a test card: checkout → signed event → renewal (test clock) → cancel at period end → deletion →
   re-enrol refused → replay of a delivered event → a forced 500 and Stripe's automatic retry.

## 6. Decisions that are NOT made by this change (founder)

1. **Course generation** now runs only on a member's own AI account. The credit-funded Academy generation is removed
   here because an 8,000-token course cannot fit the approved managed limits (1,000 output tokens); no credit is
   spent when it cannot run. Restore it only with its own approved budget and meter.
2. **Academy-funded AI** is off by default and limited to Coach and Sandbox for Founders-entitled accounts.
3. **Prompt bound.** Reserving the true maximum means bounding prompt tokens by bytes; under the current limit of
   2,000 prompt tokens that is roughly 1.9 KB of prompt including the system text. Raising it is a cost decision.
4. **Refunds.** No refund event changes any entitlement. Policy needed.
5. **Refill policy** for the pilot (5 ever admitted is the conservative default).
6. **Sign-in throttle thresholds** (10 per address / 5 min; 5 failures per account+address / 15 min; 50 failures per
   account / 15 min). The account-wide brake can still be tripped by a determined attacker; it self-clears.

## 7. Known gaps

- Account deletion now calls the closure path before destructive auth deletion. See D1-D7 proofs and FOUNDERS_RELEASE_GATES section 4; auth-provider deletion itself remains simulated locally.
- All twenty former limiter call sites now use the SQL limiter, and checkout has an account-keyed limit. See the complete limiter inventory in FOUNDERS_RELEASE_GATES. Edge header authenticity in the intended deployment still requires verification.
- The library's duplicate-identity path writes status `ineligible_duplicate`, which its own table constraint rejects
  (it fails closed with an error instead of recording the duplicate). Library change, not made here.
- A Founders-bound subscription moved to a different price is ignored (logged), not modelled.
- Cost figures are price-table arithmetic. No measured provider usage, invoice, or support/fixed-cost allocation
  evidence exists; projected advertising revenue is not part of any Founders cost figure.

## Recovery verification (Leroy, November 13)

Claude's in-flight work was preserved on a new leroy/founders-recovery-20261113 branch. The old sandbox fixture
qa-claude-sandbox-38347ec now returns the current explicit boolean rate_limit_hit RPC contract and every subscription
row (a canceled legacy-customer row) rather than the former single-customer query shape. Its twelve assertions
were retained. This file was already labelled a successor fixture adaptation; it is not one of the four untouched
original probes excluded above. Typecheck and the full 172-test unit run passed after this fixture correction.

Privacy/operation gates: the closure adapter now requires FOUNDERS_IDENTITY_HMAC_KEY (at least 32 bytes of
server-generated random material in the secret store) for versioned HMAC-SHA256 tombstones; absence fails closed.
Do not silently rotate the key: retained identity signals require a coordinated key-version migration. Existing
plain-SHA draft signals need explicit migration/requalification before activation; they are not compatible with
the new keyed format. No connected database or secret was changed during this recovery. Likewise edgeAddress trusts CF-Connecting-IP
and X-Real-IP: deployment must ensure those values are overwritten by a trusted edge and direct origin bypass is
unavailable. Local forged-header rejection is not proof of the intended hosted edge's behavior.
