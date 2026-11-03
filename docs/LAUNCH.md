# Go-Live Guide — Rreal AI Academy

Everything that can be done from code is done. These are the remaining steps that need **your** accounts.
Total time: about 20–30 minutes. Hosting: **Cloudflare Workers**.

## Live status (updated by Claude)
**Live URL:** https://rreal-ai-academy.alwilson-abc.workers.dev (Cloudflare Workers, deployed from the owner's machine with `~/rreal-deploy.sh`)

| Item | Status |
|---|---|
| Supabase `rreal-ai-academy` — migrations 0001, 0002, 0003 + seed (17 courses / 69 lessons) | ✅ applied |
| Cloudflare Worker `rreal-ai-academy` (Workers Paid) | ✅ deployed, connected to Supabase |
| Secrets: `CERT_SIGNING_SECRET`, `ADMIN_EMAILS`, `STRIPE_WEBHOOK_SECRET` | ✅ set |
| Stripe $1/month price, payment link (redirects back to the site), live webhook `we_1UXpIWK68Pw0CGHvolRNKn5E` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` + AI/voice/video/social/email keys | ⏳ owner fills `~/rreal-secrets.env`, then runs `~/rreal-upload-keys.sh` |
| Supabase Auth URL configuration + custom SMTP | ⏳ owner (dashboard only) |
| GitHub → Cloudflare auto-deploy (Workers Builds) | optional — redeploy any time with `~/rreal-deploy.sh https://rreal-ai-academy.alwilson-abc.workers.dev` |

## 1. Deploy on Cloudflare Workers (gets you the live link)
The app runs on Cloudflare Workers through the official OpenNext adapter (`wrangler.jsonc`, `open-next.config.ts`). It was built and fully tested in Cloudflare's runtime (67/67 checks).

**Plan:** use **Workers Paid ($5/month)**. The free plan allows only 10 ms of CPU per request; server-rendered pages typically need 10–20 ms, so free-plan pages would fail intermittently.

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → connect GitHub → pick `MrAllgoodWilson/rreal-ai-academy`.
2. Build settings:
   - Project name: `rreal-ai-academy` (must match `name` in `wrangler.jsonc`)
   - Production branch: `main` (merge PR #1 first, or temporarily pick `feature/v0.2-launch`)
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
3. **Build variables** (Settings → Build → Variables and secrets). `NEXT_PUBLIC_*` values are baked in at build time, so they MUST be here:
   - `NEXT_PUBLIC_SITE_URL` = your site, e.g. `https://rreal-ai-academy.<your-subdomain>.workers.dev` or your custom domain
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vwajwkhlehgmpecrwnur.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase → Project Settings → API → `anon` public key
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` = `https://buy.stripe.com/7sY5kEfff2MUb3Y5tWcQU09`
   - `NEXT_PUBLIC_STRIPE_PORTAL_URL`, `NEXT_PUBLIC_LINKEDIN_ORG_ID` (optional)
4. **Runtime variables & secrets** (Worker → Settings → **Variables and Secrets**; choose type *Secret* for keys). Add the same `NEXT_PUBLIC_*` values here too, plus:
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → service_role — keep secret)
   - `CERT_SIGNING_SECRET` = 48+ random characters (e.g. `openssl rand -base64 48`). **Never change it later.**
   - `ADMIN_EMAILS` = your email
   - `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `STRIPE_SECRET_KEY` (optional — without it the payment link is used), `STRIPE_WEBHOOK_SECRET`,
     `RESEND_API_KEY`, `EMAIL_FROM`, `REPLICATE_API_TOKEN`, `AYRSHARE_API_KEY`, `AYRSHARE_DOMAIN`, `AYRSHARE_PRIVATE_KEY`
5. **Deploy** (or push to the branch). Open `https://YOUR_SITE/api/health` — each integration you configured shows `true`.
6. Custom domain (optional): Worker → Settings → **Domains & Routes → Add → Custom domain**. Then update `NEXT_PUBLIC_SITE_URL` in both places and redeploy.

## 2. Database (do this first — 2 minutes)
Supabase → project **rreal-ai-academy** → **SQL Editor → New query**:
1. Open `supabase/migrations/0002_courses_quotas_integrations.sql` on GitHub (branch `feature/v0.2-launch`) → **Raw** → copy all → paste → **Run**.
   If Supabase warns about destructive operations, confirm — it only replaces two access policies with stricter versions.
2. New query → paste all of `supabase/seed.sql` → **Run** (loads the 17 courses / 69 lessons).
(Migration 0001 is already applied.)

## 3. Supabase Auth settings
Supabase → Authentication → **URL Configuration**: Site URL = your site; Redirect URLs: `https://YOUR_SITE/reset-password`, `https://YOUR_SITE/subscribe`.
Authentication → **SMTP**: use Resend (host `smtp.resend.com`, port 465, user `resend`, password = Resend API key) so reset emails come from your domain.

## 4. Stripe webhook (activates memberships)
Stripe → Developers → **Webhooks → Add endpoint**: `https://YOUR_SITE/api/webhooks/stripe`
Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
Copy the **signing secret** into the Worker's Variables and Secrets as `STRIPE_WEBHOOK_SECRET` (type: Secret) and redeploy.
If you use the payment link: Stripe → Payment Links → the $1 link → **After payment → Redirect** to `https://YOUR_SITE/subscribe?checkout=success`.
Enable the **Customer portal** (Settings → Billing) and put its login link in `NEXT_PUBLIC_STRIPE_PORTAL_URL` if you don't set a secret key.

## 5. Smoke test (5 minutes)
1. Sign up → you land on the $1 page → pay with a real card (refund yourself afterwards in Stripe).
2. You're redirected to onboarding → dashboard. Complete a lesson (XP + badge celebration).
3. Coach: talk by voice; switch voices; switch to Español.
4. Create a course on **Create a course**; submit it; approve it on `/admin`.
5. Studio → render a video; Connections → link a social account and post.

## Costs to watch at $1/month
Stripe takes ~2.9% + $0.30 per charge, so you keep about **$0.67** of each $1. AI calls cost real money, so fair-use limits are built in
(env `QUOTA_*`). Video rendering is the most expensive feature (often tens of cents per clip) — the default is 1 render/month per member.
