"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useAcademy } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { ALL_TRACKS, PLAYBOOKS } from "@/lib/curriculum";
import { FREE_ACCESS } from "@/lib/entitlement";

const FEATURES = [
  "8-week Mastery Program: Dummy → Expert",
  `${ALL_TRACKS.length - 5}+ standalone courses from Dummy to Expert — and growing every month`,
  `${PLAYBOOKS.length} step-by-step Playbooks: videos, flyers, logos, websites, eBooks`,
  "AI Course Creator — ask for any course you want",
  "Rreal Coach voice tutor (English & Spanish) — built-in AI included",
  "Bring your own Claude, ChatGPT, ElevenLabs or Replicate account for premium AI — or buy credits",
  "AI images for flyers & thumbnails + Social Video Studio",
  "Social & Automation Roadmap (TikTok, YouTube, Zapier integrations coming soon)",
  "Verifiable certificates + one-click LinkedIn",
  "Personal dashboard, streaks, leagues, badges, portfolio",
];

/** Shown while the Academy is free for everyone (the default). The paid page below returns only if NEXT_PUBLIC_FREE_ACCESS=false. */
function FreePricing() {
  const { user, subscription } = useAcademy();
  const { t } = useI18n();
  const legacyPaid = subscription.status === "active" || subscription.status === "trialing";
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass relative p-8 text-center shadow-glow sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-neon">Pricing</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{t("free.title")}</h1>
        <p className="mt-3 text-muted">{t("free.sub")}</p>
        <p className="mt-8 font-display text-7xl font-bold">Free</p>
        <p className="mt-2 text-muted">No card. No trial. No catch.</p>
        <ul className="mx-auto mt-8 max-w-xl space-y-3 text-left">
          {FEATURES.map((f) => <li key={f} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-lime" aria-hidden="true" />{f}</li>)}
        </ul>
        <Link href={user ? "/dashboard" : "/signup"} className="btn-primary mt-10 text-lg">{user ? t("free.dash") : t("free.cta")}</Link>
        {legacyPaid && (
          <p className="mt-6 rounded-xl border border-line p-4 text-left text-sm text-muted" role="note">
            You have a paid membership from before the Academy became free. You don&apos;t need it to learn or earn certificates. It stays active and keeps renewing only until you cancel it in Settings → Plan &amp; billing — we will never cancel or change it without telling you.
          </p>
        )}
      </motion.div>
      <p className="mt-6 text-center text-sm text-muted">Fair-use limits keep the free built-in AI sustainable for everyone. Optional power-ups (extra credits for premium AI video and custom courses) are never needed to learn, practise or get certified.</p>
    </div>
  );
}

export default function PricingPage() {
  return FREE_ACCESS ? <FreePricing /> : <PaidPricing />;
}

function PaidPricing() {
  const { user, subscribed } = useAcademy();
  const { t } = useI18n();
  const href = !user ? "/signup" : subscribed ? "/dashboard" : "/subscribe";
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass relative p-8 text-center shadow-glow sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-neon">Pricing</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{t("pay.title")}</h1>
        <p className="mt-3 text-muted">{t("pay.sub")}</p>
        <p className="mt-8 font-display text-7xl font-bold">$1<span className="text-2xl font-normal text-muted">/month</span></p>
        <ul className="mx-auto mt-8 max-w-xl space-y-3 text-left">
          {FEATURES.map((f) => <li key={f} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-lime" aria-hidden="true" />{f}</li>)}
        </ul>
        <Link href={href} className="btn-primary mt-10 text-lg">{subscribed ? t("pay.active") : t("pay.cta")}</Link>
        <p className="mt-4 text-sm text-muted">Billed monthly in USD via Stripe. Cancel anytime in Settings → Plan & billing.</p>
      </motion.div>
      <p className="mt-6 text-center text-sm text-muted">Optional power-ups: build your own custom course for $9.99, and AI video credits from $4.99 (1 free render every month). Fair-use limits keep membership at $1 forever.</p>
    </div>
  );
}
