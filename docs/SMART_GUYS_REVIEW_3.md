# Smart Guys Review #3: "How Do I" section and Agentic Riley business agents

_Applied analytical lenses written by Claude (see `SMART_GUYS.md`). These are NOT the real people's opinions or endorsements, and nothing here is a quote._
_Date: 2026-11-05. Requested by AL. Status: recommendations for the owner's decision; nothing built or deployed._

---
## Part 1. "How Do I" (the DIY / how-to section for Rreal AI Academy)

**Owner idea:** a How-To library with starter guides plus an ask box: "How do I set the alarm on my iPhone 17?" "How do I fix the catalytic converter on my BMW i5?"

**Claude's view: yes, build it, and call it "How Do I".** It matches how people actually search, it's friendlier than "DIY", and it is the easiest door into AI for a beginner: they get a useful answer in 10 seconds, then see the courses. It fits the $1 membership (included, with a daily limit) and pairs with the smartphone course Leroy just built.

**The BMW i5 example is the perfect test.** The i5 is a battery-electric car. It has no engine, no exhaust and no catalytic converter. A careless AI would invent a repair procedure. "How Do I" must notice the false premise and say so, then help with what the person probably needs (for example, the i5's high-voltage battery warnings or its actual maintenance list).

### What the lenses say
| Lens | Position | Vote |
|---|---|---|
| Jobs | One box, one answer, big readable steps. No menus. Start with 30 great guides, not 3,000 mediocre ones. | Yes |
| Zuckerberg | Public guide pages are free search traffic that brings new members; ask box and saving need sign-in. Add thumbs up/down and "was this helpful?" from day one. | Yes |
| Cuban | Each answer costs money. Cache answers by normalized question, cap per member per day, and let members who connect their own AI account ask without limits. | Conditional on caching + caps |
| Musk | Ship in days: curated guides + search + ask box. Delete everything else (videos, community, comments) for v1. | Yes |
| Huang | Retrieval first: search our own guides, then link the maker's official manual, then (last) let the model answer, clearly labeled. | Yes |
| Krishna | Safety and liability: cars, electrical, gas, medical and legal questions get warnings and a "when to call a professional" line. Never claim certainty about a specific model. Show "last checked" dates. | Conditional on safety rules |
| Su | Measure: answer helpfulness rate, "I don't know" rate, cost per answer, guides read per visit. Launch with a small pilot. | Conditional on metrics |
| Altman | Honesty rule: if the model isn't sure about a make/model detail, it says so and points to the official source. Block dangerous how-tos (weapons, bypassing safety systems). | Conditional on honesty rules |

### Disagreements
- **Free public answers vs. cost (Zuckerberg vs. Cuban).** Public pages are free (static). The ask box needs sign-in and a daily limit.
- **How far should the AI go on repairs (Musk vs. Krishna).** Musk: answer everything. Krishna: for risky repairs give general guidance plus "see a professional." **Recommendation: Krishna's version.**

### Recommended v1 (about 2 to 3 days of work)
1. A new "How Do I" page with a search box, categories (Phones, Cars, Home, Money, Computers, AI tools) and about 30 hand-checked starter guides.
2. Search finds guides first. If nothing fits, "Ask" sends the question to the AI with strict rules: admit uncertainty, challenge false premises, add safety warnings, link official manuals.
3. Answers are cached; each member gets a daily limit (members with their own AI account have none).
4. Thumbs up/down on every answer, saved for review.
5. A "last checked" date on every guide; AL or a reviewer approves new guides before they go public.

**Owner decisions needed:** (a) the name "How Do I"; (b) daily free asks per member (suggest 10); (c) whether guide pages are public for search engines (suggest yes).

---
## Part 2. Agentic Riley: business agents that do real work

**What exists today (read from the repo, 2026-11-05):** a Cloudflare Worker with a public Q&A assistant that only selects pre-approved answers, a voice greeting, a private workspace (read-only owner pilot behind Cloudflare Access), a sandbox billing receiver, and an **action-policy** layer that already defines who may do what: authentication, tenant match, per-resource grants with expiry, and a spend budget. The README says plainly that private action approvals, budget reservation and provider execution **are not implemented yet**, and no agent can act today.

That policy-first design is exactly right. The job is to build the missing parts, one capability at a time.

### The honest framing for customers
Agents **prepare, draft, check, summarize and (with approval) carry out** work. For regulated work they assist a licensed professional; they do not replace one. We should not market "an agent that creates medicine" or "an agent that is your lawyer." We can truthfully market "an agent that does the preparation work, so your attorney, physician or researcher finishes in a fraction of the time."

### A ladder of agent work (small to complex)
| Tier | Examples | Rule |
|---|---|---|
| 0. Read and organize | Read and sort a shared inbox, summarize threads, extract invoices, flag urgent mail, find meeting times | Read-only. Safest first product. |
| 1. Draft and propose | Draft replies, quotes, social posts, FAQs, schedules, simple reports | Drafts only; a person clicks Send. |
| 2. Act with approval | Send an approved email, create a calendar event, update a CRM record, file an internal ticket | Each action approved once or by a written rule with a spend cap. Full audit log. |
| 3. Professional assist (regulated) | Legal: summarize records, build deposition outlines, exhibit indexes, question drafts for the attorney. Finance: reconcile and flag. Healthcare admin: summarize notes for clinician review, prior-auth paperwork drafts. | A named licensed professional reviews and signs. No autonomous filing, advice, diagnosis or prescribing. Special data handling and contracts required first. |
| 4. Research pipelines | Literature review, hypothesis lists, trial-protocol drafts, data analysis for scientists | Research support only. Never claims safety or efficacy. Medicine creation itself is lab science and regulation (FDA etc.); an agent can speed up the reading and the paperwork, not replace the science. |

### Smart Guys on Riley
| Lens | Position | Vote |
|---|---|---|
| Jobs | Start with ONE agent that feels magical: the inbox reader. Do that perfectly before a catalog of 50. | Yes |
| Zuckerberg | Let customers see what the agent did (an activity feed). Trust and word-of-mouth come from transparency. | Yes |
| Cuban | Price by outcome and by agent-hours with a hard cap per tenant. Never an open-ended "unlimited agent." | Conditional |
| Musk | Build the executor and approval queue once, then add skills as small plug-ins. Delete anything not needed for the first paying client. | Yes |
| Huang | Keep models swappable (Workers AI, Claude through the AI Gateway, a customer's own key). Put heavy jobs in queues with time and cost limits. | Yes |
| Krishna | Enterprise trust comes first: tenant isolation, audit logs, data retention rules, a kill switch, and signed agreements. Regulated tiers (legal, health, finance) need contracts and data-handling reviews before any real client data. Do not assume Workers AI or any provider is HIPAA-ready: verify and sign the required agreements first. | Conditional (hard gate) |
| Su | Acceptance tests per agent: replay, concurrency, budget exhaustion, wrong-tenant attempts, provider failure. No "green unit tests only" claims. | Conditional |
| Altman | Human in the loop for anything consequential, clear AI-disclosure, and refusal of harmful requests (for example weapons or illegal drug synthesis). Safety rules are part of the product. | Conditional |

### Disagreements
- **Breadth vs. depth (Musk wants a platform; Jobs wants one perfect agent).** Recommendation: build the platform pieces (approvals, budgets, audit) and ship only the inbox agent first.
- **Regulated work now vs. later (Zuckerberg: capture demand; Krishna: contracts first).** Recommendation: Krishna's gate. Take no regulated client data until agreements and data handling are in place.

### Recommended build order for Riley
1. **Foundations (finish what the README lists as missing):** durable approval queue, atomic budget reservation, tenant-scoped audit log, kill switch, and an adapter interface.
2. **Agent 1: Inbox Reader** (Tier 0 to 1): connect a work mailbox (read-only OAuth), classify and summarize, draft replies for approval.
3. **Agent 2: Back-office assistant** (Tier 1 to 2): invoices, scheduling, CRM updates, with approval and a spend cap.
4. **Pilot with 1 to 3 friendly businesses** under written scope and pricing.
5. **Tier 3 and 4 "assist" packages** only after legal and data-handling review, with named professional sign-off.

**Owner decisions needed:** (a) approve "Inbox Reader" as agent #1; (b) which two or three pilot businesses; (c) go or no-go on regulated tiers (legal, health, finance), which need counsel first.

---
## To log in `DECISIONS.md` once AL decides
- How Do I: name, daily asks, public pages.
- Riley: first agent, pilot clients, regulated-tier gate.
