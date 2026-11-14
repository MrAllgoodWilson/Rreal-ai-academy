# Founders: release gates, proposals awaiting a founder decision, and limiter inventory

Nothing here is approved by being written down. Items marked **PROPOSAL** change what a customer gets and stay
disabled until the founder decides. Items marked **GATE** block customer activation.

## 1. Proposals (not approved offer revisions)

| # | Topic | Before (at base 6dd018b / production code) | In this branch | Why | Options |
|---|---|---|---|---|---|
| P1 | Course generation without a member AI key | Production: a $9.99 course credit funds an Academy-paid generation (8,000 output tokens). At 6dd018b the same path was routed through the Founders meter, whose approved limit is 1,000 output tokens, so it failed after charging and refunded. | Runs only on the member's own AI account; no credit or quota is consumed when it cannot run. | An 8,000-token generation cannot fit the approved managed limits, and there is no approved budget/meter for credit-funded generation. | (a) keep own-account only; (b) restore credit-funded generation with its own model, price binding, per-credit max-cost reservation and ledger; (c) raise managed limits for this feature with a costed ceiling. |
| P2 | Academy-funded AI for Founders | No Academy-funded text generation ran at all ("No Academy-funded model call until … cost caps are wired"). | Available only when `FOUNDERS_MANAGED_AI=enabled`, for Founders-entitled accounts, for Coach and Sandbox. Default off. | These two fit the approved request limits; the switch keeps spending off until the founder turns it on. | (a) leave off; (b) enable for Coach+Sandbox; (c) add features with costed limits. |
| P3 | Prompt size for Academy-funded calls | Reservation used characters ÷ 4 as if it were a hard bound (≈8,000 characters passed). | Bound is bytes (a true upper bound on tokens): ≈1.9 KB including system text under the 2,000-token limit. | Reserving the true maximum is the only way the budget cannot be exceeded by adversarial input. | (a) keep; (b) raise `maxPromptTokens` with a recalculated ceiling; (c) add a real tokenizer for a tighter bound. |
| P4 | Sign-in throttling thresholds | 10 per address / 5 min, in memory, bypassable with a header. | 10 per address / 5 min; 5 failures per account+address / 15 min; 50 failures per account / 15 min; durable. | See §3. | Adjust numbers; the account-wide brake is a trade-off between slowing distributed guessing and lockout risk. |

Founders inclusions listed in the library (`COMPANY_INVENTORY.rreal`) are unchanged by this branch.

## 2. Gates

- **GATE – Refunds (unresolved).** No refund or dispute event changes any entitlement, and no refund terms are
  invented here. Proposed options for decision: (R1) full refund within N days ⇒ treat as cancellation: immediate
  access end + permanent forfeiture; (R2) refund of a single renewal ⇒ access to period end, forfeiture stands only if
  the subscription is also canceled; (R3) dispute/chargeback ⇒ immediate access end + forfeiture + block re-enrolment.
  Whichever is chosen needs `charge.refunded` / `charge.dispute.*` handling keyed to the server-side binding, and real
  Stripe TEST evidence.
- **GATE – Provider evidence.** No real Stripe TEST or isolated Supabase evidence exists (see FOUNDERS_MIGRATIONS §5).
- **GATE – Hosting.** Direct/session Postgres connectivity from the Workers runtime is untested.
- **GATE – Credential rotation** for the shared test database: prepared as a plan only; not executed.
- **GATE – Measured cost.** Only price-table arithmetic exists.

## 3. Limiter inventory

All 20 former in-memory call sites now use the shared SQL limiter (`src/lib/durable-limit.ts`, migration 0013),
keyed on the edge-reported address (`cf-connecting-ip`), never `X-Forwarded-For`. Sign-in has its own three-tier
logic; checkout gained a per-account limit.

| Route | Risk | Limit | Limiter outage |
|---|---|---|---|
| `auth/login` | account takeover | 10/addr/5 min; 5 fails/account+addr/15 min; 50 fails/account/15 min | 503 |
| `auth/reset-request` | mail abuse, enumeration | 5/addr/15 min; 3/e-mail/h | 503 |
| `auth/forgot-username` | mail abuse, enumeration | 5/addr/15 min; 3/e-mail/h | 503 |
| `auth/signup` | account farming | 5/addr/10 min | 503 |
| `account/delete` | destructive | 5/addr/h | 503 |
| `stripe/checkout` | payment session spam | 10/account/10 min | 503 |
| `coach`, `sandbox` | provider cost | 30 and 20 /addr/min | 503 |
| `courses/generate`, `playbooks/generate` | provider cost | 5 and 6 /addr/min | 503 |
| `image`, `video/render`, `tts`, `translate` | provider cost | 6, 5, 30, 60 /addr/min | 503 |
| `certificates/issue` | signing | 10/addr/min | 503 |
| `referrals`, `referrals/reconcile`, `project-wallet/quote` | value/abuse | 10, 2, 10 /addr/min | 503 |
| `r/[code]` (public redirect) | low | 20/addr/min | **stays up** |
| `sponsors` (public inquiry form) | low (spam) | 3/addr/h | **stays up** |

Remaining in-memory use: only in demo mode (no database configured), where nothing billable or privileged exists.
Acceptance limits: an attacker with many addresses can still consume per-address budgets; the per-feature quotas
(`consume_quota`) and the Founders meter remain the cost ceilings. Email-keyed limits can delay a victim's own reset
mail for up to an hour after three requests (pre-existing behaviour, now durable).

## 4. Account deletion and the Founders rate

Deleting the original account permanently forfeits the rate. `closeFoundersAccount` runs before the destructive
delete, under the per-account lock, in one transaction: eligibility → forfeited, enrollment → canceled, an
`account_closed` audit entry, and the server-keyed HMAC e-mail signal indexed. Those rows have no foreign key to the profile and remain
as the tombstone (account id, keyed e-mail signal, forfeiture, audit). A live subscription still blocks deletion. If Founders
storage is configured but unavailable, nothing is deleted. If the delete itself then fails, the forfeiture stands and
the user is told so. Re-registration with the same e-mail is refused admission (operator entry point
`qualifyFoundersAccount` always supplies the hash).

Open point for decision: forfeiture is recorded at the moment the user confirms deletion, even if the provider-side
delete then fails and they keep the account. The alternative (forfeit only after a successful delete) leaves a crash
window in which an account could be deleted without a tombstone.

## 5. Corrected test expectation (disclosed)

`tests/sql/founders-0011-checks.sh` T1 originally asserted `canceled:123` after 24 concurrent writers. The status
part is the invariant (the terminal cancel wins even with the oldest timestamp); the `:123` part assumed every
`active` writer landed before the cancel, which is arrival-order dependent, and it failed once (`canceled:121`).
The check now asserts the invariant (`status = canceled`) plus the clock bound (`50 ≤ clock ≤ 123`). Nothing about
the SQL changed. Monotonic clock behaviour is still asserted separately in T2/T3.
