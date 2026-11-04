# Decision log

| Date | Decision | Options considered | Dissenting lens | Decided by |
|---|---|---|---|---|
| 2026-11-03 | Host on Cloudflare Workers | Vercel, Cloudflare | — | Owner |
| 2026-11-03 | $1/month for all members, no free tier | free tier, $1, higher | Cuban, Su (economics) | Owner |
| 2026-11-04 | Keep $1/month forever; add credit packs (video 5/$4.99, 20/$14.99); custom course $9.99 each | $1 forever; $1→$9.99; credit packs | Cuban (prefers $9.99 after month 1) — satisfied by packs | Owner |
| 2026-11-04 | Courses run 2–3 months with weekly releases (week N opens 7 days after week N−1) | self-paced; weekly drip | Jobs, Musk (let fast learners binge) | Owner |
| 2026-11-04 | Launch AI features on Cloudflare Workers AI + Email Service now (no third-party keys); keep Claude/ElevenLabs/Resend as drop-in upgrades | wait for keys; Cloudflare fallback; Claude via AI Gateway Unified Billing | Jobs (quality of Llama vs Claude for paid courses) — mitigated: schema validation + automatic refund, and Claude via AI Gateway is one setting away | Owner asked for a workaround |
| 2026-11-04 | Members use their own AI accounts (BYOK, browser-only keys) or buy credits for premium AI; $1 covers access + courses + built-in Cloudflare AI | owner-paid AI for all; BYOK + credits | Jobs (complexity for beginners) — keys live in Settings only | Owner |
| 2026-11-04 | Weekly-max friendly nudge emails after 3+ quiet days, opt-out in Settings + one-click link | none; daily; weekly | Bezos lens (must feel personal) | Owner |
| 2026-11-04 | Sponsors: Community / Course / Tool partner / Title tiers; placements on course pages + playbooks, not inside lessons | ads everywhere; limited placements | Cuban (wants more inventory) | Recommendation, owner to confirm pricing |
| 2026-11-04 | iFilms Studios is the recommended distribution channel in all film/music/video content | — | — | Owner |


## 2026-11-04 — Sponsor pricing delegation and voice consistency
AL approved the sponsor prospect list and tier structure, clarified that no prices had been chosen, and delegated affordable pricing to Leroy. Internal founding annual rates: Community $99, Course $249, Tool Partner $149, Title $749. Bounded scope and benchmark sources are in ~/team-bridge/sponsor-rate-card.md; no public pricing, outreach or billing change is authorized by this entry. Smart Guys review in ~/team-bridge/smart-guys-next-moves.md recommends a reliable small pilot first; growth speed and fulfillment-margin lenses remain conditional on readiness and actual delivery costs.

AL prefers the first voice and rejects unexpected voice changes. Local bug fix prevents selected Aura speech falling through to MeloTTS, prevents cloud failures switching to device speech, and pins a selected device voice within the session. Retry preserves the written reply. Exact preferred speaker identity and browser listening acceptance remain unverified; no deployment approved. Browser/accessibility smoke remains blocked locally by missing Playwright.
