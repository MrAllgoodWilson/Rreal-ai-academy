# Directive v2: AI features of Rreal AI Academy

**For:** Leroy or Ant · **From:** AL Wilson (owner) · **Updated:** 2026-11-04

## What changed
The AI features now run on **Cloudflare's own AI** (included in our Workers Paid plan), so **no API keys are needed to launch**.
Live and tested on https://rrealaiacademy.app: the Coach (English and Spanish), Sandbox, course and playbook builder,
Spanish translation, and the coach voice. Check any time at https://rrealaiacademy.app/api/health:
`"active": {"ai":"cloudflare","voice":"cloudflare","email":...}`.

## Security rules (unchanged)
1. Never send a key, password or code through text, email, Slack or chat (including to Claude).
2. Keys go only into `~/rreal-secrets.env` on Blackie and are uploaded with `~/rreal-upload-keys.sh`.
3. Leroy found what look like API keys in old emails. Treat them as exposed: revoke and replace them in each provider's dashboard. Don't reuse them.

## Task 1 (required, about 2 minutes): turn on email (password and username reset)
Cloudflare dashboard → **Compute** → **Email Service** → **Email Sending** → **Onboard Domain** → choose `rrealaiacademy.app` → **Done**.
Cloudflare adds the DNS records itself. Emails go out from `Rreal AI Academy <support@rrealaiacademy.app>`. No key and no Resend account needed.
Optional: **Email Routing** → forward `support@rrealaiacademy.app` to `alwilson.abc@gmail.com` so replies reach AL.

## Optional upgrades (only when AL wants them)
Each one replaces the Cloudflare version automatically once its key is uploaded:
| Upgrade | What it adds | Key line in `~/rreal-secrets.env` |
|---|---|---|
| Anthropic (Claude) | Higher-quality coach and courses | `ANTHROPIC_API_KEY=` |
| ElevenLabs (Starter) | 12 selectable premium voices | `ELEVENLABS_API_KEY=` |
| Replicate | Real AI video rendering in the Studio | `REPLICATE_API_TOKEN=` |
| Ayrshare (Business) | Post to members' social accounts | `AYRSHARE_API_KEY=`, `AYRSHARE_DOMAIN=`, `AYRSHARE_PRIVATE_KEY=` |
| Stripe restricted key | "Manage billing" button | `STRIPE_SECRET_KEY=` |

**Account email for all of these:** `alwilson.abc@gmail.com`. Turn on two-factor login, name every key `rreal-ai-academy-production`, and set a $50 monthly limit where offered.
Alternative to an Anthropic account: in the Cloudflare dashboard, **AI → AI Gateway → load credits (Unified Billing)**, then tell Claude. Claude switches the app to real Claude with no Anthropic key.

## Done when
- [ ] `/api/health` shows `"email":"cloudflare"` and a "Forgot password" email arrives
- [ ] Old exposed keys are revoked
