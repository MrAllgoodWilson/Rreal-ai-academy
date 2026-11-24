# Rreal AI Academy — ChatGPT Mastery + 10 Income-Building Courses
Date: 2026-11-24
Status: **Source curriculum, not live/published**. Never run the seed against production without explicit founder approval, a backup, an approved free-access policy, and a rollback plan.

## Scope
- One standalone ChatGPT Complete Guide (20 lessons), including Projects, plugins, Work, voice, files, research, model limitations, privacy, APIs, coding, QA and a capstone.
- Ten separate practical business courses (5 lessons each): AI consulting, social media service, support assistant, lead intake CRM, local business websites, scheduling, ecommerce email, digital templates, career documents and micro-SaaS.
- **11 new courses, 70 new lessons.** Existing lesson IDs and prior course definitions are preserved.
- Lessons contain a purpose, hands-on task, original copy-paste exercise, testable acceptance criteria, quiz with answer, prompt lab, reflection and privacy/commercial safeguards.
- Written in original language; not copied from Alicia Lyttle or other instructors. The referenced video (https://youtu.be/6Tt2wjv8hio) was used only as high-level inspiration after independently confirming title and creator, not as copied lesson source.

## Source of truth and integration
`src/lib/curriculum/chatgpt-income-courses.ts` defines the course tracks. `src/lib/curriculum/index.ts` exports the combined existing + new catalog. `scripts/generate-seed.mts` regenerates SQL using existing tracks + independent new course module. This approach avoids editing Claude's separate `courses.ts` work in PR #2; merge and QA both branches together before publishing.

`npm run db:seed` now uses pinned `tsx` to avoid Node 22's `ERR_NO_TYPESCRIPT` from the older direct loader. This **generates** `supabase/seed.sql` locally; it does not apply migrations to Supabase.

## Verified tests
- Run `npm ci --ignore-scripts --no-audit --no-fund`; `npm run typecheck`; `npm test`; `npm run db:seed`.
- Tests assert 11 distinct courses, 20+50=70 indexed new lessons, unique lesson and quiz IDs, valid quiz answers, prompt labs, safeguards.
- Database seed regenerated twice identically and retains the pre-existing tracks.
- Browser, screen-reader, learner signup, certificate generation with these new courses, and live Supabase seed apply **not yet verified**.

## Business, legal, and quality guardrails
- **Free courses:** Founder previously directed Rreal Academy to be free for users. The current legacy curriculum lock logic still checks subscriptions and seed marks lessons paid. Do **not** treat this new curriculum as publicly accessible until that free-access logic is repaired and tested. Claude has separate unmerged free-access work; coordinate and choose one canonical fix.
- **Money claims:** No guarantee of revenue, profit, clients, employment, or passive income. Include only transparent sample budgets/assumptions, permissioned customer outreach, human editing, privacy, source rights and applicable marketing/email rules.
- **OpenAI feature freshness:** As of November 2026, OpenAI's official materials state that custom GPTs are being retired in favor of plugins; do not teach building/selling new GPTs as if that path is permanent. Refresh from https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq and https://help.openai.com/en/articles/11487775-connectors-in-chatgpt before release. Rreal course is independent, not endorsed by OpenAI or Anthropic.
- **Release gate:** Claude + Ant curriculum consistency review, Rigel E2E/browser/a11y, Sentinel policy/claims review, founder-approved free-access behavior, test user navigation/quiz/certificate, then founder-controlled Cloudflare deploy and Supabase seed apply.
