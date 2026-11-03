"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";

const PLANS = [
  { id: "free", name: "Starter", price: { monthly: 0, annual: 0 }, blurb: "Try it out", features: ["Week 1: AI Foundations", "Rreal Coach (text + voice)", "Prompt Sandbox", "Streaks, XP & badges"], cta: "Current free plan" },
  { id: "pro", name: "Pro", price: { monthly: 29, annual: 249 }, blurb: "Everything, dummy → expert", features: ["All 5 tracks · 8 weeks · 30+ lessons", "Social Video Studio", "Verifiable Rreal Certified credentials", "Daily Review (spaced repetition)", "Mock interviews with Coach", "Portfolio & LinkedIn sharing"], cta: "Start 7-day free trial", highlight: true },
  { id: "team", name: "Teams", price: { monthly: 0, annual: 0 }, blurb: "For companies & schools", features: ["Everything in Pro", "Team dashboard & reporting", "Seat management & SSO", "Custom learning paths", "Volume pricing"], cta: "Contact sales" },
] as const;

export default function PricingPage() {
  const { user, subscription, startTrial, subscribed } = useAcademy();
  const router = useRouter();
  const [period, setPeriod] = useState<"monthly" | "annual">("annual");
  const [msg, setMsg] = useState("");

  const choose = async (id: string) => {
    if (id === "team") return (window.location.href = "mailto:sales@example.com?subject=Rreal%20AI%20Academy%20Teams");
    if (id !== "pro") return;
    if (!user) return router.push("/signup");
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: period }) });
    if (res.status === 501) {
      startTrial(period);
      setMsg("Demo mode: your 7-day free trial is active — every week is unlocked. (Connect Stripe to take real payments.)");
      return;
    }
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else setMsg(json.error ?? "Checkout failed.");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Pricing" title="Invest in the skill of the decade" subtitle="Start free. Upgrade when you’re hooked. Cancel anytime in two clicks." />
      <div className="mb-8 inline-flex rounded-xl border border-line p-1" role="radiogroup" aria-label="Billing period">
        {(["monthly", "annual"] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={`min-h-[44px] rounded-lg px-5 font-semibold capitalize ${period === p ? "bg-neon text-bg" : "text-muted"}`}>
            {p} {p === "annual" && <span className="ml-1 text-xs">(save 28%)</span>}
          </button>
        ))}
      </div>
      {msg && <div className="mb-6"><FormAlert kind="success">{msg}</FormAlert></div>}
      <ul className="grid gap-6 md:grid-cols-3">
        {PLANS.map((p, i) => (
          <motion.li key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className={`glass relative flex flex-col p-6 ${"highlight" in p ? "border-neon shadow-glow" : ""}`}>
            {"highlight" in p && <span className="absolute -top-3 left-6 rounded-full bg-neon px-3 py-1 text-xs font-bold text-bg">Most popular</span>}
            <h2 className="font-display text-2xl font-bold">{p.name}</h2>
            <p className="text-muted">{p.blurb}</p>
            <p className="mt-6 font-display text-5xl font-bold">
              {p.id === "team" ? "Custom" : p.price[period] === 0 ? "Free" : `$${p.price[period]}`}
              {p.id === "pro" && <span className="text-base font-normal text-muted">/{period === "annual" ? "year" : "month"}</span>}
            </p>
            {p.id === "pro" && period === "annual" && <p className="text-sm text-lime">≈ $20.75/month, billed yearly</p>}
            <ul className="mt-6 flex-1 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-lime" aria-hidden="true" />{f}</li>
              ))}
            </ul>
            <button type="button" onClick={() => choose(p.id)} disabled={p.id === "free" || (p.id === "pro" && subscribed)} className={`mt-8 ${"highlight" in p ? "btn-primary" : "btn-ghost"}`}>
              {p.id === "pro" && subscribed ? (subscription.status === "trialing" ? "Trial active" : "Your plan") : p.cta}
            </button>
          </motion.li>
        ))}
      </ul>
      <p className="mt-8 text-center text-sm text-muted">Prices in USD. Need-based scholarships and accessibility discounts available — just ask.</p>
    </div>
  );
}
