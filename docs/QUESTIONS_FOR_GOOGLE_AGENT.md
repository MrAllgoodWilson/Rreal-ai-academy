# Open Questions for the Owner & Google Agent

_From Claude (engineering lead). The app is built and working in Demo mode. These answers decide how we launch.
Each question includes my recommendation so you can just say "agree" where it fits._

## A. Brand & legal
1. **Name spelling**: is it definitely **"Rreal"** (double R)? Has a trademark search been done, and which domain will we use?
   _Rec: run a USPTO trademark search on "Rreal AI Academy" and secure the .com before launch._
2. **Business entity, support email and legal pages**: who drafts the final Terms of Service and Privacy Policy? (Drafts are in the app.)
3. **Minimum age**: 13+, 16+ or 18+? Under-13 users trigger COPPA requirements in the US.
   _Rec: 16+ at launch, with a separate teen/school product later._

## B. Business model
4. **Pricing**: the app currently shows Free (Week 1), **Pro $29/month or $249/year** with a 7-day free trial, and Teams (contact sales). Confirm or change.
5. **Trial**: card required up front (higher conversion to paid) or no card (more signups)?
   _Rec: card required, 7 days._
6. **Is Week 1 free forever** (lead magnet), or should all content be paywalled after the trial?
7. **Refunds and scholarships**: what's the refund policy? Do we offer need-based or accessibility discounts? (The pricing page mentions scholarships.)
8. **Teams/Enterprise**: build the company dashboard now, or after consumer launch?

## C. Certification
9. **Accreditation goal**: which matters most for "businesses will accept it"?
   (a) Open Badges 3.0 via Credly or Accredible, (b) IACET continuing-education units, (c) ISO/IEC 17024 accreditation, (d) employer partnerships.
   _Rec: (a) + (d) in phase 2, start (b) in parallel, and treat (c) as a 12-month goal._
10. **Exam integrity**: should the final exam be **proctored** (webcam/ID verification, timed)? This adds cost and friction but greatly increases credibility.
11. **Credential names**: confirm the five track certificates plus the master "Rreal Certified AI Professional". Should credentials **expire** (e.g., every 2 years, since AI changes fast)?
12. **Revocation policy**: when do we revoke a credential (cheating, refunds)?

## D. Content
13. **Subject-matter review**: who reviews lesson accuracy? Do you want a named instructor or a human face, or is the AI coach the brand?
14. **Video content**: do you want recorded instructor videos (with captions + ASL), or keep the interactive text/voice format? (Our analysis says interactive retains better; short videos help the visual learners.)
15. **Which real tools to feature** in the creator and video tracks (e.g., specific image, voice and video generators)? Any partnerships or affiliate deals?
16. **Languages**: launch English-only, or English + Spanish?

## E. Accessibility
17. **Budget for an independent accessibility audit + VPAT** (typically a few thousand dollars)? Needed before we advertise WCAG compliance.
18. **ASL videos**: hire a Deaf ASL interpreter to record summaries of core lessons?
19. **User testing**: can we recruit blind, low-vision, Deaf and motor-impaired testers before launch? (Strongly recommended, and paid.)

## F. Integrations & accounts (I need access or keys)
20. **Which accounts exist already?** Supabase, Stripe, Resend, Anthropic (Claude API), ElevenLabs, Vercel, domain registrar. Please create whatever's missing and add the keys to the hosting environment (never paste keys into chat).
21. **Voice**: is ElevenLabs approved (adds per-character cost), or is the free browser voice fine at launch? Pick a coach voice and persona name.
22. **Social posting**: should we apply now for TikTok, Instagram and YouTube developer API access (review takes weeks)? Whose business accounts own those apps?
23. **AI cost controls**: what's the max monthly AI spend per subscriber? (I'll enforce per-user daily caps.)

## G. Platform
24. **Native apps**: is a mobile web app / installable PWA (done) enough for launch, or are App Store / Play Store listings required on day one? (Native shells add ~2–4 weeks plus store review. Apple takes up to 30% of in-app subscriptions.)
25. **GitHub**: please create an empty GitHub repository (e.g., `rreal-ai-academy`) and give me access so I can push the code and open a pull request. I can't create repositories myself from this session.

## H. Data & privacy
26. **Analytics and marketing**: OK to use privacy-friendly product analytics (PostHog) and error monitoring (Sentry)? Any email-marketing tool already chosen?
27. **Learner data for AI**: confirm we will **not** use learners' prompts to train models, and that the Claude API (which doesn't train on API data by default) is acceptable.
