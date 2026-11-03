# CLAUDE.md — Rreal AI Academy

Guidance for Claude (and humans) working in this repository.

## What this is
Rreal AI Academy is a subscription web app (installable PWA) that teaches AI from absolute beginner to expert:
5 tracks over 8 weeks, interactive lessons, a two-way voice tutor ("Rreal Coach"), a live Prompt Sandbox,
a Social Video Studio, gamification (XP, streaks, leagues, badges), and signed, publicly verifiable certificates.
Accessibility (blind, deaf, motor, cognitive) is a core requirement, not an add-on.

## Commands
| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` → http://localhost:3000 |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` (Vitest, `tests/*.test.ts`) |
| Production build | `npm run build && npm start` |
| E2E + a11y smoke test | `npm run build && npm start` then `BASE=http://localhost:3000 node tests/e2e/smoke.mjs` (needs Playwright + Chromium; writes `docs/screenshots/`) |
| Regenerate DB seed from curriculum | `node --experimental-strip-types scripts/generate-seed.mts` |

**Always run `npm run typecheck && npm run lint && npm test` before committing.** Run the E2E smoke test for any UI-flow change.
The E2E test needs `CERT_SIGNING_SECRET` set (put it in `.env.local`) because production mode refuses to sign certificates without it.

## Two runtime modes
- **Demo mode** (no `NEXT_PUBLIC_SUPABASE_*` env): accounts + progress live in `localStorage`. Every feature works offline.
  Coach/Sandbox use the built-in offline engines; checkout starts a local trial.
- **Production mode** (Supabase configured): Supabase Auth + Postgres with RLS are the source of truth.
  The client still renders optimistically from the same store, then syncs.
- Optional integrations switch on by env var: `ANTHROPIC_API_KEY` (live Coach + Sandbox), `ELEVENLABS_API_KEY` (premium voice),
  `STRIPE_*` (billing), `RESEND_API_KEY` (email). See `.env.example`. `GET /api/health` reports what's enabled.

## Architecture map
```
src/
  app/                      Next.js 14 App Router pages + API routes
    (auth)/                 login, signup, forgot-password, forgot-username, reset-password
    dashboard, learn, lesson/[lessonId], coach, sandbox, studio, review,
    leaderboard, achievements, certificates, portfolio, settings, pricing, onboarding
    verify/[token]          PUBLIC employer verification page (server-rendered)
    api/                    auth/login, auth/forgot-username, coach, sandbox, tts,
                            progress, progress/complete, certificates/issue,
                            stripe/checkout, stripe/portal, webhooks/stripe, leaderboard, health
  components/               AppShell, A11yPanel, VoiceCoach, PromptLab, LessonBlocks,
                            CertificateArt, CelebrationOverlay, ReadAloud, AuthCard, ui/*
  lib/
    curriculum/             tracks.ts = ALL course content (typed data) + gating helpers
    store.tsx               AcademyProvider: auth, progress, XP, streaks, badges, sync
    a11y.tsx                A11yProvider: prefs, aria-live announcer, TTS, visual alerts
    gamification.ts         pure XP/level/streak/league rules (mirrored in SQL)
    badges.ts               badge definitions + unlock rules
    prompt-grader.ts        offline Prompt Quality Score (0–100)
    coach-offline.ts        offline Coach engine (chat/quiz/grade/interview)
    certificates/server.ts  HMAC-signed credential tokens (server-only)
    studio.ts               hook/script generators + .ics export
    supabase/*, stripe.ts, claude.ts, email.ts, rate-limit.ts
supabase/migrations/        schema + RLS + SECURITY DEFINER functions
supabase/seed.sql           GENERATED from tracks.ts — never hand-edit
tests/                      Vitest unit tests + tests/e2e/smoke.mjs
docs/                       product docs, open questions, screenshots
```

## Rules of the road
1. **Curriculum is data.** Add or edit lessons only in `src/lib/curriculum/tracks.ts`, then regenerate `supabase/seed.sql`.
   Lesson and quiz ids must stay unique and stable (progress is keyed by them). `tests/curriculum.test.ts` enforces this.
2. **Never trust the client for anything that has value.** XP, streaks, completions, subscriptions and certificates are written only by
   `complete_lesson()` (SECURITY DEFINER), the Stripe webhook (service role), or the certificate issuer (service role).
   RLS + column grants block direct writes. Keep it that way.
3. **Gamification rules live in two places on purpose:** `src/lib/gamification.ts` (optimistic UI) and `complete_lesson()` in SQL
   (authoritative). Change both together, and keep `tests/gamification.test.ts` passing.
4. **Accessibility is a release blocker.** Every interactive element needs a keyboard path, a visible focus state, an accessible name,
   and 44px minimum targets. Every sound pairs with a visual cue (`useA11y().chime/flash`). Every spoken output gets captions.
   Respect `prefers-reduced-motion` and the in-app toggle (Framer Motion's `MotionConfig` is wired in `a11y.tsx`).
   The E2E test runs axe-core and must stay free of serious/critical violations.
5. **Secrets stay server-side.** Only `NEXT_PUBLIC_*` vars reach the browser. `CERT_SIGNING_SECRET` is required in production;
   rotating it invalidates every previously issued certificate token (DB-registered certificates can be re-issued).
6. **AI calls go through `src/lib/claude.ts`** and must degrade gracefully (return `null` → offline fallback). Model is set by
   `ANTHROPIC_MODEL`. Coach replies are spoken, so the system prompt keeps them short and markdown-free.
7. Use the existing design tokens (`bg`, `surface`, `raised`, `line`, `ink`, `muted`, `neon`, `violet`, `lime`, `flame`, `danger`)
   and component classes (`card`, `glass`, `btn-primary`, `btn-ghost`, `input`, `label`, `chip`). They have light, dark and
   high-contrast variants in `globals.css`.

## Database (Supabase)
- Apply `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
- Key functions: `complete_lesson`, `username_available` (public), `email_for_username` / `username_for_email` (service role only),
  `leaderboard_weekly`, `certificate_status`.
- In Supabase Auth settings: enable email confirmations, set Site URL, add `/reset-password` and `/onboarding` to redirect URLs,
  and plug in Resend as custom SMTP so reset emails come from your domain.

## Open items
See `docs/QUESTIONS_FOR_GOOGLE_AGENT.md` for decisions that need the owner's input, and `docs/PRODUCT_BLUEPRINT.md` for the roadmap.
