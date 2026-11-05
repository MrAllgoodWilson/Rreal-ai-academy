# Disabled feature-allowance accounting foundation (internal project wallet)

Migration `0007_project_wallet.sql` is new and has **not** been applied to production. It does not replace or convert existing course/video balances. `PROJECT_WALLET_ENABLED` is unset/false, the database control is disabled with zero daily caps, and the trusted rate card is empty. The quote API returns unavailable; no project provider or new Stripe product is connected. This is a foundation, not a claim of a working paid project purchase.

## Accounting contract

Keep purchased and referral funding in separate accounts per user. Every grant has both integer retail credits and an explicitly funded provider-cost budget in cents. The word credit is an internal integer allowance unit, not a customer cash balance, redeemable value or provider token. Customer API labels use feature allowances; retail package price is stored separately. Grants are globally idempotent by source reference and reject mismatched replays. A verified Stripe session reference should be namespaced `stripe:<session_id>`; a reviewed referral reward uses `referral:<reward_uuid>`.

The service-role grant RPC accepts a trusted funded-cost amount; **this is not independent proof of payment, cash reserves, or actual provider cost**. Before calling it, a billing adapter must validate the correct payment account/mode/product/amount/currency/paid status, subtract applicable fees/refund exposure and allocate actual collected funding. Owner clarified immediate reward at twenty qualifying first payments, with no hold; that timing does not invent funding. Before referral grants, an adapter must lock the approved pending reward, verify its policy/status and a separately funded promotion budget, call grant and mark credited in the SAME database transaction. That referral adapter is not supplied by this migration and reward rows must not be marked credited by a separate unprotected request. Do not grant against predicted sponsorship, uncollected subscription renewals, self-reported cost or nominal reward face value. There is no automatic free allowance.

`project_wallet_quote` stores an immutable, server-authored, five-minute quote in the library (database maximum fifteen minutes) with feature, rate version, fixed allowance units, separate retail price, allocated net funding, risk reserve, required contribution and a known positive maximum provider cost. Quotes must satisfy maximum provider cost <= allocated net funding minus reserve minus required positive contribution. Net funding must originate from settled paid receipts or a separately funded promotion reserve after fees. As a second conservative ceiling, the default maximum direct execution cost is 30% of retail. This is a contribution-cost cap, not a guarantee of business profit after all fixed/support/tax/refund costs. No rate is approved yet, so the public endpoint has nothing to sell. It rejects browser-supplied price/cost values.

`project_wallet_reserve` atomically moves available credits and provider funding to reserved, once per idempotency key and quote. It serializes global daily cost reservations and enforces user/global daily caps. Zero/negative/unknown estimates cannot reserve. Purchased credits cannot silently use a referral account's funding or vice versa. No executor may run before confirmed reservation.

`project_wallet_finish(job, release, actualCostCents)` settles the accepted fixed credit price only after a usable output and known final provider cost. Unused provider-cost reservation returns to that funding bucket; fixed quoted retail credits are consumed. Confirmed zero-cost failures release credits once. An unknown/running job, provider timeout or charged failure is **not** automatically refunded. An over-cap actual cost is rejected for manual reconciliation, not hidden by truncating the cost. Finishing existing jobs is permitted after new-job execution is disabled. A real adapter must reconcile provider-success/database-save-failure, retain usable output, know terminal provider status and prevent new spend after its maximum; the wallet alone cannot enforce a remote provider's invoice.

Balances/jobs/grants/quotes/daily totals/ledger have no direct financial write grants for authenticated or service roles. Only reviewed service-role mutation RPCs write them. RLS exposes only the member's rows; the ledger and quotes are append-only through permitted application paths. Database owners remain capable of administrative changes, so operational audit/access controls are still necessary.

## Closure guard

`project_wallet_account_closure_status(p_user uuid default null)` is read-only. Authenticated members omit the parameter or name themselves; service role supplies a user UUID. It returns only `availableCredits`, `reservedCredits`, `activeJobs`, `hasFinancialHistory`, `blocked`, with no identity or payment information. It remains available when new wallet execution is disabled. Cross-user access is rejected.

Current financial references restrict deleting a profile that has any wallet history, even a quote or a zero balance. Wire a truthful 409 support/reconciliation message before enabling the wallet. Do not silently burn a balance, erase an audit trail or anonymize payment ownership. A reviewed financial retention/refund/account-closure policy and migration is required before self-service deletion can coexist with these records.

## Remaining integration gates

- Owner-approved pack/feature scope, full-redemption economics and actual provider benchmarks.
- Reviewed project Stripe purchase adapter and referral grant+mark-credited transaction.
- Refund/dispute reconciliation; existing granted credits must not be silently mutated.
- Costed remote provider adapters and resumable job/output persistence. Existing unfunded-execution guards remain closed.
- Dashboard, consent and before/after quote accessibility/browser acceptance.
- Actual sandbox paid event → one grant → one reservation → usable output → settlement, plus failure/replay acceptance.
- Production migration approval, source review and release approval. No paid service/account was provisioned.

## Verification

`bash tests/sql/project-wallet-checks.sh` runs real PostgreSQL 17 in a disposable preinstalled Docker image with no network, host port, volume or production credentials, capped at 256 MB and one CPU. It tests disabled defaults, positive known costs, idempotent/mismatched grants, RLS/write denial, two-session reservation competition, reservation/release/settlement replay, failed-cost rollback, separated funding, global cost cap and finishing after disabling new jobs. The container is removed on exit. Unit tests cover empty rate cards, rejection of browser prices and unsafe refund costs. Typecheck/lint/full unit checks must pass before commit.
