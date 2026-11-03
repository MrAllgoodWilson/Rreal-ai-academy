# Rreal AI Academy — Product Blueprint & Engineering Review

_Prepared by Claude (engineering lead), building on the Google agent's master blueprint._

## 1. What was built (v0.1)

| Google blueprint requirement | Status | Where |
|---|---|---|
| Supabase Auth: sign up / in / out | ✅ Built (Supabase in production, local Demo mode without keys) | `src/lib/store.tsx`, `src/app/(auth)/*`, `api/auth/login` |
| Forgot Password (secure email token) | ✅ Supabase one-time recovery link → `/reset-password` | `(auth)/forgot-password`, `(auth)/reset-password` |
| Forgot Username (lookup by email) | ✅ Emailed via Resend; same response whether or not the email exists | `api/auth/forgot-username` |
| Profile: name, avatar, a11y toggles, courses, streak, XP, badges, certificates | ✅ | `profiles` table, Settings, Dashboard |
| Tracks → Weeks → Modules → Lessons → Challenges | ✅ 5 tracks, 8 weeks, 18 modules, 33 lessons, 30 quiz questions (incl. a 10-question capstone exam), 14 graded prompt labs | `src/lib/curriculum/tracks.ts` |
| Gating by subscription + prerequisites | ✅ Client (instant UI) **and** Postgres (authoritative) | `lockReason()`, `complete_lesson()` |
| Two-way voice coach, waveform, real-time TTS | ✅ Web Speech recognition, live mic waveform, ElevenLabs or browser TTS, synchronized captions | `components/VoiceCoach.tsx` |
| Hints, code review, prompt grading | ✅ Coach modes + Prompt Quality Score + Claude critique | `api/coach`, `api/sandbox`, `lib/prompt-grader.ts` |
| In-browser sandbox | ✅ No install, no key needed (offline simulator); live Claude when configured | `/sandbox` |
| WCAG: semantic HTML, ARIA, tab order | ✅ axe-core scans: 0 serious/critical violations on all core pages | `tests/e2e/smoke.mjs` |
| Captions, visual cues for audio | ✅ Live captions, visual flash on every sound | `lib/a11y.tsx` |
| High contrast, font scaling, reduced motion | ✅ Plus light theme, readable spacing, low-vision typeface | A11y panel (Alt+A) |
| XP engine, streaks, loss-prevention alerts, leaderboards | ✅ Plus streak freezes, daily goal, weekly leagues | `lib/gamification.ts` |
| Animated badge celebrations | ✅ 3D flip medal + confetti (auto-disabled for reduced motion) | `CelebrationOverlay.tsx` |
| Certificates with unique cryptographic IDs | ✅ HMAC-SHA256-signed tokens, QR code, SVG + print-to-PDF | `lib/certificates/server.ts` |
| Public `/verify/[id]` page | ✅ Detects tampering; checks revocation when the DB is connected | `app/verify/[token]` |
| One-click “Add to LinkedIn” | ✅ Official add-to-profile deep link | `lib/certificates/shared.ts` |
| Dark neon design, micro-interactions, page transitions, confetti, responsive | ✅ | `globals.css`, Framer Motion throughout |
| Stripe subscriptions + webhooks | ✅ Checkout with 7-day trial, Customer Portal, signed and idempotent webhook | `api/stripe/*`, `api/webhooks/stripe` |
| DB schema + RLS | ✅ Tested on Postgres 16 | `supabase/migrations/0001_init.sql` |

## 2. What I added beyond the Google blueprint
These came from studying why learning apps keep or lose subscribers.

**Retention and learning science**
- **Onboarding with placement**: learners pick a goal and a starting track, so experienced users don't churn in Week 1 boredom.
- **Daily goal ring + streak freezes** (earn one every 7 days) so one missed day doesn't kill motivation.
- **Streak-at-risk banner** on the dashboard ("ends at midnight, one lesson saves it").
- **Weekly leagues** (Bronze → Diamond), resetting Mondays.
- **Daily Review**: spaced-repetition quizzes weighted toward older and weaker lessons. This answers the "engagement theater" critique of streak-only apps.
- **Portfolio**: every passed lab and Studio project is saved, so learners finish with proof of skill, not just a badge.
- **Mock interview mode** in Coach, tied to the career outcome subscribers pay for.
- **Replay XP** (20%) rewards review without inflating the leaderboard.

**Content**
- **AI Ethics, Copyright & Disclosure** lesson (voice-cloning consent, deepfakes, platform AI labels). Employers expect this, and it protects learners' accounts.
- **Evaluating Agents** lesson (evals, golden sets, regressions): the skill that separates experts from hobbyists.
- **R.E.A.L. prompt framework** (Role, Expectation, Audience, Layout): a memorable, brandable method.
- **Studio pre-flight checklist** (hook timing, length, captions, CTA, AI label) and **.ics calendar export** with reminders.

**Accessibility (beyond the brief)**
- Read-aloud of every lesson step with **word-by-word highlighted captions**.
- **Visual flash** for every sound; sound is never the only signal.
- **Atkinson Hyperlegible** typeface (designed for low-vision readers) and a **readable spacing** mode for dyslexia.
- Focus moves to the main content on navigation; global **Alt+A** shortcut; 44px minimum touch targets; arrow-key lesson navigation.
- Voice input works as an alternative to typing (motor accessibility).
- A public **Accessibility Statement** page.

**Trust, security and operations**
- **Demo mode**: the whole product works with zero keys, so you can show investors and testers today.
- Sign in with username **without exposing emails** to the browser; forgot-password and forgot-username **don't reveal which emails have accounts**.
- **Column-level grants**: learners can't write their own XP, streak, completions, subscriptions or certificates, even with direct API access.
- Stripe webhook **idempotency ledger**; rate limiting on auth, Coach, Sandbox and certificates; security headers.
- **Data export** (Settings) for privacy-law readiness.
- **PWA manifest** so it installs on phones today.
- Automated tests: 29 unit tests, 48 end-to-end + axe-core accessibility checks, and SQL security tests.

## 3. Corrections to the original plan (please read)
1. **"Real certified certification that businesses accept."** No app can make its own certificate officially "accredited" by declaring it.
   What we built is a cryptographically verifiable credential, the same trust model Credly and Accredible use.
   Employer *acceptance* comes from one or more of:
   - **Open Badges 3.0 / W3C Verifiable Credentials**: issue through Credly or Accredible so the badge lives in learners' wallets (phase 2).
   - **Proctored, server-graded final exam** with a randomized question bank. Today quiz answers ship to the browser, which is fine for practice but not for a high-stakes credential. This is the #1 priority before marketing the certificate as professional.
   - **Third-party accreditation**: IACET (continuing education units), or ISO/IEC 17024 personnel certification via ANAB for the "Rreal Certified Professional" credential (6–12+ months, requires a job-task analysis and a governance board).
   - **Employer and industry partnerships** that name the credential in job posts.
2. **WCAG 2.1 AAA "compliance" across the whole product isn't a realistic legal claim.** The W3C itself says AAA can't be met for all content.
   We build to AA everywhere and AAA where feasible, and we should commission an **independent audit + VPAT** before advertising compliance.
3. **"Blockchain" certificates aren't needed.** Signed credentials with a public verification page give the same tamper-proofing with none of the cost or confusion.
4. **Direct posting to TikTok, Instagram and YouTube** needs each platform's developer app review: TikTok Content Posting API audit, Instagram Graph API (business/creator accounts only), and the YouTube Data API quota audit.
   v0.1 exports a posting calendar; native auto-posting is phase 2 once those approvals are in hand.
5. **Named tools change fast** (Sora, Runway, Pika, model versions). Lessons teach transferable concepts and avoid depending on any one product. The AI model is a config variable (`ANTHROPIC_MODEL`), not hard-coded.
6. **Next.js version**: built on the latest patched Next.js 14 as specified. Plan an upgrade to the current major after launch.

## 4. Competitive positioning (summary)
- **Academic platforms** (university- and lab-branded courses): credible certificates, but passive video, rigid pacing and no live coaching. → We win on interactivity, voice and outcomes.
- **Coding sandboxes**: great hands-on practice, but focused on syntax and data science, not creator, business and agent workflows. → We win on breadth (beginner to agents) and the social video pipeline.
- **Gamified micro-learning apps**: great retention, weak tangible skills. → We pair streaks with portfolio artifacts and spaced review.
- **Churn drivers we designed against**: long lectures (lessons are 6–20 min), setup friction (zero-install sandbox), no feedback (instant grading + coach), invisible progress (dashboard, leagues, portfolio), and inaccessible content (built in from day one).

## 5. Roadmap
**Phase 1 — Launch (weeks 0–4)**
- Connect Supabase, Stripe, Resend, Claude and ElevenLabs. Brand domain and emails. Legal review of Terms and Privacy.
- Move exam grading server-side (question bank in the DB, randomized, timed). Add an admin panel to revoke certificates.
- Independent accessibility audit + VPAT. Error monitoring (Sentry) and analytics (PostHog), with privacy-friendly config.
- Streak reminder emails/push ("your streak ends tonight") via Supabase cron + Resend.

**Phase 2 — Differentiation (months 2–4)**
- Native iOS/Android shells (Capacitor or Expo) with push notifications and offline lessons.
- Real AI generation inside the Studio (image, voice and video providers via server-side APIs) with per-plan credit budgets.
- Direct publishing to TikTok, Instagram and YouTube after API approvals.
- Open Badges 3.0 issuance (Credly or Accredible) and an employer verification portal with bulk lookup.
- Cohorts and community: weekly live sessions, peer review of capstones, a Discord or in-app community.
- ASL video summaries for core lessons; Spanish localization (i18n framework).

**Phase 3 — Scale (months 4–12)**
- Teams/Enterprise: admin dashboard, seat management, SSO (SAML), custom paths, reporting.
- Accreditation track (IACET → ISO/IEC 17024), employer partner network, job board.
- Adaptive learning: the Coach recommends lessons based on quiz misses; AI-generated practice variants.
