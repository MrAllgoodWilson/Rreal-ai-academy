# Go-Live Guide — Rreal AI Academy

Everything that can be done from code is done. These are the remaining steps that need **your** accounts.
Total time: about 20–30 minutes.

## What's already set up
| Item | Status |
|---|---|
| GitHub repo `MrAllgoodWilson/rreal-ai-academy` | ✅ code pushed |
| Supabase project **rreal-ai-academy** (`vwajwkhlehgmpecrwnur`, us-east-1) | ✅ created, migration 0001 applied |
| Supabase migration 0002 + course seed | ⏳ waiting for your approval in the Supabase connector (or paste the files in the SQL editor — step 2) |
| Stripe product + **$1/month** price `price_1UXevHK68Pw0CGHvMMNt6NeD` | ✅ live |
| Stripe payment link (fallback checkout) `https://buy.stripe.com/7sY5kEfff2MUb3Y5tWcQU09` | ✅ live |

## 1. Deploy on Vercel (gets you the live link)
1. Go to **vercel.com → Add New → Project → Import** `MrAllgoodWilson/rreal-ai-academy`.
2. Framework: Next.js (auto-detected). Click **Deploy**.
3. In the project: **Storage / Integrations → Supabase → Connect** and pick the **rreal-ai-academy** project.
   This fills `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` automatically.
   (Manual alternative: URL `https://vwajwkhlehgmpecrwnur.supabase.co`, anon key from Supabase → Project Settings → API; service-role key from the same page — keep it secret.)
4. **Settings → Environment Variables** — add (see `.env.example` for the full list):
   - `NEXT_PUBLIC_SITE_URL` = your Vercel URL or domain (e.g. `https://rreal-ai-academy.vercel.app`)
   - `CERT_SIGNING_SECRET` = output of `openssl rand -base64 48` (or any 48+ random characters). **Never change it later.**
   - `ADMIN_EMAILS` = your email
   - `ANTHROPIC_API_KEY` = from console.anthropic.com → API keys
   - `ELEVENLABS_API_KEY` = from elevenlabs.io → Profile → API keys
   - `STRIPE_SECRET_KEY` = Stripe → Developers → API keys (live secret key) — *or* skip it and the payment link is used
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` = `https://buy.stripe.com/7sY5kEfff2MUb3Y5tWcQU09`
   - `RESEND_API_KEY`, `EMAIL_FROM`
   - `REPLICATE_API_TOKEN` (AI video) — replicate.com → Account → API tokens
   - `AYRSHARE_API_KEY`, `AYRSHARE_DOMAIN`, `AYRSHARE_PRIVATE_KEY` (social accounts) — ayrshare.com, **Business plan** (needed for per-user profiles)
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables take effect. Open `/api/health` — every integration you set shows `true`.

## 2. Database (if the connector approval didn't run)
Supabase → **SQL Editor**: run `supabase/migrations/0002_courses_quotas_integrations.sql`, then `supabase/seed.sql`.
(0001 is already applied.)

## 3. Supabase Auth settings
Supabase → Authentication → **URL Configuration**: Site URL = your site; Redirect URLs: `https://YOUR_SITE/reset-password`, `https://YOUR_SITE/subscribe`.
Authentication → **SMTP**: use Resend (host `smtp.resend.com`, port 465, user `resend`, password = Resend API key) so reset emails come from your domain.

## 4. Stripe webhook (activates memberships)
Stripe → Developers → **Webhooks → Add endpoint**: `https://YOUR_SITE/api/webhooks/stripe`
Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
Copy the **signing secret** into Vercel as `STRIPE_WEBHOOK_SECRET` and redeploy.
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
