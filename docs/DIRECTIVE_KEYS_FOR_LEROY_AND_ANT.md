# Directive: Turn on the AI features of Rreal AI Academy

**For:** Leroy or Ant · **From:** AL Wilson (owner) · **Time:** about 45–60 minutes · **Computer:** Blackie

The app is live at https://rreal-ai-academy.alwilson-abc.workers.dev. Payments and the database already work.
Your job is to create **API keys** for six services and paste them into one private file on Blackie.
Claude then uploads them to Cloudflare (encrypted) with one command.

## Security rules (non-negotiable)
1. **Never send a key by text, email, Slack, or chat — including to Claude.** Keys go only into the file in step 0.
2. Use the business email and the company card AL approves. Turn on two-factor login for every account.
3. Name every key `rreal-ai-academy-production`, so it can be found and revoked later.
4. Set a monthly spending limit wherever the site offers one (amounts below).

## Step 0 — open the key file on Blackie
Open a terminal on Blackie and run: `nano ~/rreal-secrets.env`
Paste each key right after its `=`, with no spaces or quotes. Save with **Ctrl+O, Enter**, exit with **Ctrl+X**.

## Step 1 — Claude API (Anthropic) · powers the Coach, course builder, playbooks, Spanish translation
1. Go to **console.anthropic.com** → sign up or log in with the business email.
2. **Billing** → add a card → buy starting credit ($25 is plenty to start) → set a **monthly limit of $50**.
3. **API Keys → Create Key** → name `rreal-ai-academy-production` → copy it.
4. Paste it into the line `ANTHROPIC_API_KEY=`.

## Step 2 — ElevenLabs · premium coach voices (English + Spanish)
1. **elevenlabs.io** → sign up → choose the **Starter** plan (it includes a commercial license).
2. Profile icon → **API Keys → Create** → name `rreal-ai-academy-production`, and allow **Text to Speech** → copy.
3. Paste into `ELEVENLABS_API_KEY=`.

## Step 3 — Replicate · real AI video rendering
1. **replicate.com** → sign in with GitHub (MrAllgoodWilson) → **Billing** → add a card → set a **monthly limit of $50**.
2. **Account → API tokens → Create token** → name `rreal-ai-academy-production` → copy.
3. Paste into `REPLICATE_API_TOKEN=`.

## Step 4 — Resend · emails (forgot password, forgot username)
Resend needs a domain the company owns. A `workers.dev` address won't work for sending email.
1. **Buy the domain** (if AL hasn't): Cloudflare dashboard → **Domain Registration → Register** → e.g. `rrealaiacademy.com`.
   (Tell Claude the domain afterwards. Claude will attach it to the app and update the payment links.)
2. **resend.com** → sign up → **Domains → Add domain** → enter the domain → choose **"Sign in to Cloudflare"** to add the DNS records automatically → wait until it shows **Verified**.
3. **API Keys → Create** → permission **Sending access**, restricted to that domain → copy.
4. Paste into `RESEND_API_KEY=`.

## Step 5 — Ayrshare · connect members' TikTok, Instagram, YouTube, Facebook, LinkedIn, X
1. **ayrshare.com** → sign up → choose the **Business** plan (required so each member can link their own accounts).
2. **API Key** page → copy the key → paste into `AYRSHARE_API_KEY=`.
3. **Integration / Profiles → "Generate a private key"** (for the user-linking page). Copy the domain shown into `AYRSHARE_DOMAIN=`.
4. The private key is several lines long. Paste it on **one line**, replacing every line break with the two characters `\n`.
   It must start with `-----BEGIN RSA PRIVATE KEY-----\n` and end with `\n-----END RSA PRIVATE KEY-----`.
   Paste into `AYRSHARE_PRIVATE_KEY=`.

## Step 6 — (optional) Stripe secret key · smoother checkout + "Manage billing" button
1. **dashboard.stripe.com** (account "TiQology Holdings LLC", Live mode) → **Developers → API keys → Create restricted key**
   → name `rreal-ai-academy-production` → give **Write** access to: Checkout Sessions, Customers, Customer portal, and Subscriptions → create → copy.
2. Paste into `STRIPE_SECRET_KEY=`.

## Step 7 — upload and verify
1. In the Blackie terminal run: `~/rreal-upload-keys.sh`
   It lists the key **names** it uploaded (never the values).
2. Open https://rreal-ai-academy.alwilson-abc.workers.dev/api/health. Each service you added should now show `true`.
3. Message AL: "Keys uploaded — health check shows: …" (paste only the true/false list, never a key).

## Done = all of these are true
- [ ] `/api/health` shows `claude`, `elevenlabs`, `resend` and `supabaseAdmin` as true (and `stripe` if step 6 was done)
- [ ] Two-factor login is on for every account
- [ ] Spending limits are set at Anthropic and Replicate
- [ ] No key was sent through any messaging app
