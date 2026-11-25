# Smart Guys Review #2: keyless AI, own-account AI, nudges, sponsors, certification

_Lens-based analysis by Claude (see `SMART_GUYS.md`). These are applied public philosophies, not the real people's views. No quotes, no endorsement._
_Date: 2026-11-04. Decisions reviewed: the owner's 17-point request of the same day._

## What was decided and built
| # | Decision | Status |
|---|---|---|
| 1 | Run built-in AI on **Cloudflare Workers AI** (text, Spanish voice, images) and Cloudflare Email/Cron. No third-party keys needed. | Live |
| 2 | **Members bring their own accounts** (Claude, ChatGPT, ElevenLabs, Replicate) for premium AI. Keys stay in the member's browser. Otherwise they buy credits. | Live |
| 3 | **Friendly nudges**: one email at most per week after 3+ quiet days, with a one-click unsubscribe. | Live (sends once Email Sending is onboarded) |
| 4 | **Sponsors** page + inquiry intake; tiers: Community, Course, Tool partner, Title. | Live (pricing to be set by AL) |
| 5 | New courses: **Cell Phone Game**, **Networking in the AI Era**; phone-game playbook. | Live |
| 6 | **iFilms Studios** recommended in every film / music / video course and playbook. | Live |
| 7 | Local **Ollama** drafts for course expansion; Claude/human review before publishing. | Script ready |
| 8 | **Team bridge** on Blackie (`team` command + Hermes Kanban board `rreal`). | Live |

## Lens by lens
- **Jobs (focus, craft).** Own-account keys are powerful but technical. Keep them out of the beginner's path: the default experience must "just work" with built-in AI, and keys live in Settings → *Your AI accounts*. Done that way. *Push:* the cloud voice is plain; get premium voices back for everyone once revenue allows.
- **Zuckerberg (growth loops).** Nudges are the first retention loop. The next loop: networking. Members showing their projects to each other, and share cards that bring new members in. *Recommendation:* build an opt-in **member directory + project showcase** next (see "Networking" below).
- **Cuban (unit economics).** This is the best economic change so far. Heavy AI cost moves to the member's own account or to paid credits, and the built-in AI on Workers AI costs fractions of a cent per lesson. *Watch:* Workers AI has a daily free allocation, then usage billing. Check the Cloudflare AI dashboard weekly. Sponsors are pure margin: price them.
- **Musk (first principles, speed).** Stop waiting on vendor accounts. Use what is already paid for (Cloudflare) and what's free (Ollama on Blackie). Delete steps: one `team` command instead of a heavy bridge platform. *Push:* automate course expansion end-to-end. Ollama drafts → Workers AI 70B review → human approval.
- **Huang (platform, compute).** Put inference at the edge (Workers AI) and keep model choice swappable (`WORKERS_AI_MODEL`, AI Gateway). Members' own keys turn Rreal into a platform that teaches on any model. *Push:* add AI Gateway caching and logging so repeated questions cost nothing.
- **Krishna (enterprise trust, governance).** Own-account keys must never touch the database or logs. They don't: browser storage only, format-checked, never logged. Nudges need consent and an unsubscribe, which they have. Revoke exposed keys today. *Push:* write a short public Security page and add the sponsor and data-processing terms to the Terms page.
- **Su (execution, roadmap discipline).** Good sequencing: email → nudges → sponsors. The single biggest blocker is the 2-minute Email Sending onboarding. *Push:* a weekly scorecard: members, day-7 retention, nudge click-through, AI cost per member.
- **Altman (AI-native product, safety).** Teach members to use their own frontier accounts. That is the real skill they're paying to learn. Keep safety rules in every AI lesson (disclosure, consent, no copied IP). *Push:* when a member connects Claude or ChatGPT, unlock a "Pro" track that uses tool calling and agents.
- **Bezos lens, added (customer obsession, the more the merrier).** Nudges must feel like a friend, not marketing. One email, short, about *their* next lesson, easy to stop. Reply-to goes to a real inbox (`support@` → AL's Gmail).
- **Nadella lens, added (partnerships).** Sponsors and tool partners (ElevenLabs, Canva, Replicate, Cloudflare, iFilms) are distribution. Partner links should help the learner first.

## Where they disagree (owner decides)
1. **Cuban vs Jobs on sponsor visibility.** Cuban wants sponsor placements in every lesson. Jobs wants them limited to course pages and playbooks so lessons stay clean. *Recommendation:* Jobs' version (built that way); revisit at 10,000 members.
2. **Musk vs Krishna on auto-publishing AI-drafted lessons.** Musk: publish drafts fast. Krishna: human review first. *Recommendation:* review first (accuracy is the brand).
3. **Zuckerberg vs Krishna on networking.** Open member messaging (growth) vs. moderation and safety risk. *Recommendation:* opt-in directory + showcase with outside links only (LinkedIn, iFilms, portfolio), no in-app DMs until moderation exists.

## Certification (owner's question)
Both paths are built, and you can run them side by side:
1. **Rreal-issued certificates (now).** Completion certificates are legal to issue in the US and most countries, as long as they're described honestly ("Certificate of Completion", not a degree or license). Rreal's are signed, publicly verifiable, Open Badges 3.0 compatible, and LinkedIn-ready.
2. **Accredited credentials (partnership).** Credits that count toward a degree, CEUs or a license must come from an accredited body. Options:
   - Partner with a community college or university continuing-education department, which co-signs and issues CEUs.
   - Become an IACET-accredited provider (a formal application and audit, months of work).
   - Align courses to an industry certification (e.g., CompTIA, Google, Microsoft or AWS AI fundamentals) and prepare students for that exam.
   - The app already supports partner-issued, accredited credentials (`ACCREDITATION_*` settings) once a partner signs.
*Recommendation:* launch with Rreal-issued certificates. In parallel, pitch 2–3 local community colleges' continuing-ed offices. Accreditation partners are also a strong sponsor category.

## Networking (owner's item 15): interpretation
Built now: the **Networking in the AI Era** course. Proposed next (needs AL's OK): an opt-in **member directory** (name, headline, skills, course badges, links to LinkedIn, portfolio and iFilms channel), filterable by course and city, plus a monthly virtual meetup.
