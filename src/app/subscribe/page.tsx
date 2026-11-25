"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { capturePendingReferral } from "@/lib/referrals-client";
import { RequireAuth } from "@/components/RequireAuth";
import { FormAlert } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { ALL_TRACKS, PLAYBOOKS, ALL_LESSONS } from "@/lib/curriculum";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const PERKS = [
  "The 8-week Rreal AI Mastery Program (Dummy → Expert)",
  "Every standalone course — flyers, websites, video, business, automation, agents",
  "Step-by-step Playbooks with the exact tools to use",
  "AI Course Creator — ask for any course you want",
  "Rreal Coach: two-way voice tutor in English & Spanish, choose your voice",
  "AI video rendering, Social Video Studio & social posting",
  "Verifiable certificates + LinkedIn sharing",
  "Streaks, leagues, badges and a personal progress dashboard",
];

function Subscribe() {
  const { subscribed, startTrial, user } = useAcademy();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const returned = params.get("checkout") === "success";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(returned);

  useEffect(() => {
    if (subscribed) router.replace(next.startsWith("/") ? next : "/dashboard");
  }, [subscribed, router, next]);

  // After Stripe checkout, the webhook activates the membership within seconds — poll until it lands.
  useEffect(() => {
    if (!returned) return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      const sb = getSupabaseBrowser();
      if (sb && user) {
        const { data } = await sb.from("subscriptions").select("status").eq("user_id", user.id).in("status", ["active", "trialing"]).limit(1).maybeSingle();
        if (data) window.location.href = "/dashboard?welcome=1";
      }
      if (tries > 30) {
        clearInterval(iv);
        setWaiting(false);
        setError("Payment received but activation is taking longer than usual. Refresh in a minute or contact support.");
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [returned, user]);

  const join = async () => {
    setBusy(true);
    setError("");
    try { await capturePendingReferral(); } catch {
      setError("We couldn't confirm your referral. Please retry before checkout."); setBusy(false); return;
    }
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: "monthly" }) });
    if (res.status === 501) {
      startTrial("monthly"); // Demo mode only (no Supabase/Stripe configured)
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (json.url) window.location.href = json.url;
    else {
      setError(json.error ?? "Checkout is unavailable. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-8 text-center shadow-glow sm:p-10">
        <p className="chip mx-auto mb-4 border-neon/50 text-neon">{ALL_TRACKS.length} courses · {ALL_LESSONS.length}+ lessons · {PLAYBOOKS.length} playbooks</p>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">{t("pay.title")}</h1>
        <p className="mt-3 text-muted">{t("pay.required")}</p>
        <p className="mt-8 font-display text-7xl font-bold">$1<span className="text-2xl font-normal text-muted">/month</span></p>
        <ul className="mx-auto mt-8 max-w-xl space-y-3 text-left">
          {PERKS.map((p) => <li key={p} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-lime" aria-hidden="true" />{p}</li>)}
        </ul>
        {error && <div className="mt-6 text-left"><FormAlert kind="error">{error}</FormAlert></div>}
        {waiting ? (
          <p className="mt-8 flex items-center justify-center gap-2 font-semibold" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Activating your membership…</p>
        ) : (
          <button type="button" onClick={join} disabled={busy} className="btn-primary mt-8 w-full text-lg sm:w-auto">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CreditCard className="h-5 w-5" aria-hidden="true" />} {t("pay.cta")}
          </button>
        )}
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Secure checkout by Stripe · Cancel anytime in Settings</p>
      </motion.div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <RequireAuth>
      <Suspense>
        <Subscribe />
      </Suspense>
    </RequireAuth>
  );
}
