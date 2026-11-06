# Directive v3 for Leroy (and Ant), from AL. Rreal AI Academy, 2026-11-04

Leroy: do every task you can. Anything you can't finish, write a short directive for Ant (Antigravity) with `team task leroy ant "<title>" "<steps>"` and tell me. Ask me before anything that spends money, creates an account in my name, or contacts anyone outside the team.

## 0. Our team bridge (read first)
- Read `~/team-bridge/README.md` on Blackie. Run `team inbox leroy` and `team tasks` every time you start.
- Message me or Claude: `team post leroy al "..."` / `team post leroy claude "..."`. Report each finished task with `team done <id> "what you did + proof"`.
- Never put passwords, API keys, card numbers or login codes in the bridge, chat, text or email. Keys only go in `~/rreal-secrets.env`, then run `~/rreal-upload-keys.sh`.
- Explore what's already built: the Hermes Kanban and gateway (`~/.hermes`) and the TiQology bridge code (`~/founder-command-center-20261008/api/src/leroy-bridge`, `execution-bridge-v1`). Write what works, what's missing, and your recommendation in `team post leroy al`.

## 1. Security (do first)
- Revoke every API key you saw exposed in old emails: open each provider's dashboard → API keys → delete or roll. Make new ones only if I still need them.
- Report only the provider names and "revoked"; never the key values.
- Turn on two-factor login wherever it's off.

## 2. Turn on email (password and username resets, reminders): about 5 minutes
1. Cloudflare dashboard → Compute → Email Service → **Email Sending** → **Onboard Domain** → `rrealaiacademy.app` → Done. Cloudflare adds the DNS records.
2. Email Service → **Email Routing** → enable for `rrealaiacademy.app` → add a rule: `support@rrealaiacademy.app` → forward to `alwilson.abc@gmail.com`. Cloudflare emails me a verification link; tell me to click it.
3. So I can **reply as support@** from Gmail: Cloudflare → My Profile → API Tokens → Create token, named `rreal-gmail-smtp`, permission **Email Sending: Edit** for the account.
   Then in Gmail → Settings → Accounts → "Send mail as" → Add `support@rrealaiacademy.app`, SMTP server `smtp.mx.cloudflare.net`, port 465 (SSL), username `api_token`, password = that token.
   Paste the token straight into Gmail's form. Never message it.
4. Test: on https://rrealaiacademy.app use "Forgot password" with my email. Confirm the email arrives from support@rrealaiacademy.app.

## 3. Supabase Auth settings (2 minutes)
Supabase → project `rreal-ai-academy` → Authentication → URL Configuration:
- Site URL: `https://rrealaiacademy.app`
- Redirect URLs: add `https://rrealaiacademy.app/reset-password` and `https://rrealaiacademy.app/onboarding`

## 4. Cut AI costs with Cloudflare
- Cloudflare → AI → **AI Gateway** → create a gateway named `rreal` with **caching on** and logging on. Tell Claude the gateway name.
- Check whether this account qualifies for **Cloudflare for Startups** credits. Report what's needed; don't apply without my OK.
- Check AI → Workers AI → usage once a week and post the number to me.

## 5. Things that still need keys: do them, or find a workaround
Members can already plug in their own Claude, ChatGPT, ElevenLabs and Replicate accounts (Settings → Your AI accounts). These are only for features I pay for.
| Feature | Option A (key) | Workaround to explore and report |
|---|---|---|
| Real Claude for the built-in Coach | Anthropic key (console.anthropic.com, $50/month cap) → `ANTHROPIC_API_KEY` | Load prepaid credits in Cloudflare AI Gateway (Unified Billing): no Anthropic account. Tell Claude when loaded. |
| AI video sold as credits | Replicate token, $50/month cap → `REPLICATE_API_TOKEN` | Check whether Cloudflare's model catalog (developers.cloudflare.com/ai/models) has a text-to-video model under Unified Billing. Report the model name. |
| Posting to members' social accounts | Ayrshare Business → `AYRSHARE_API_KEY`, `AYRSHARE_DOMAIN`, `AYRSHARE_PRIVATE_KEY` (one line, `\n` for line breaks) | Price cheaper options (Upload-Post, Buffer, Late/getlate.dev APIs). Meanwhile members download and post natively. |
| Premium voices for everyone | ElevenLabs Starter → `ELEVENLABS_API_KEY` | Members use their own ElevenLabs. Check which Cloudflare TTS voices support Spanish (Workers AI catalog). |
| "Manage billing" button | Stripe (TiQology Holdings LLC, Live) → Developers → API keys → Restricted key `rreal-ai-academy-production` with Write on Checkout Sessions, Customers, Customer portal, Subscriptions → `STRIPE_SECRET_KEY` | none needed |
Name every key `rreal-ai-academy-production`, set a monthly spending cap, and turn on 2FA. Then run `~/rreal-upload-keys.sh` and open https://rrealaiacademy.app/api/health.

## 6. Bridge alerts to my phone (optional, ask me which app first)
Pair the Hermes gateway with WhatsApp or Telegram (`hermes gateway`, `hermes whatsapp`) so I'm pinged when `team post ... al` arrives. Report how it works before turning it on.

## 7. Sponsors (research only, no outreach without my OK)
Build `~/team-bridge/sponsors-prospects.md` with 25 prospects: name, partner or affiliate program URL, contact path, why they fit, and suggested tier (Community / Course / Tool partner / Title).
Start with tools our courses already teach: ElevenLabs, Canva, Replicate, Cloudflare, CapCut, Descript, Runway, HeyGen, Suno, Opus Clip, Zapier, Make, Notion, Hostinger, Wix, Webflow and iFilms Studios. Also include local businesses and Hispanic-serving organizations.
Apply to free affiliate programs only after I approve the list.

## 8. Accreditation partners (research only)
List 5 community college or university continuing-education offices near me that offer CEUs. Include the contact page and what they require to co-issue certificates.

## Done when (report with `team post leroy al`)
- [ ] Exposed keys revoked (provider names only)
- [ ] A "Forgot password" email arrived from support@rrealaiacademy.app
- [ ] support@ forwards to Gmail, and Gmail can send as support@
- [ ] Supabase URL settings saved
- [ ] AI Gateway `rreal` created
- [ ] Workarounds table answered (section 5)
- [ ] Sponsor and accreditation lists saved
- [ ] Anything unfinished handed to Ant with `team task leroy ant ...`
