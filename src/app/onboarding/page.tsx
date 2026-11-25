"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { A11ySettings } from "@/components/A11yPanel";
import { useAcademy } from "@/lib/store";
import { TRACKS } from "@/lib/curriculum";
import { ProgressBar } from "@/components/ui/ProgressRing";

const GOALS = [
  { id: "career", emoji: "💼", label: "Boost my career or switch jobs" },
  { id: "creator", emoji: "📱", label: "Grow on social media with AI video" },
  { id: "business", emoji: "🏪", label: "Use AI in my business" },
  { id: "builder", emoji: "🛠️", label: "Build AI apps and agents" },
  { id: "curious", emoji: "🤔", label: "I'm just curious about AI" },
];

const PACE = [
  { minutes: 5, xp: 50, label: "Casual", sub: "5 min/day" },
  { minutes: 10, xp: 100, label: "Regular", sub: "10 min/day" },
  { minutes: 20, xp: 200, label: "Serious", sub: "20 min/day" },
  { minutes: 30, xp: 300, label: "Intense", sub: "30 min/day" },
];

function Flow() {
  const { user, progress, setOnboarding, setDailyGoal } = useAcademy();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(progress.onboarding.goal ?? "");
  const [level, setLevel] = useState(progress.onboarding.placementLevel ?? 1);
  const [pace, setPace] = useState(progress.onboarding.dailyMinutes ?? 10);
  const steps = ["Your goal", "Your starting point", "Your pace", "Make it yours"];

  const finish = () => {
    setOnboarding({ done: true, goal, placementLevel: level, dailyMinutes: pace });
    setDailyGoal(PACE.find((p) => p.minutes === pace)?.xp ?? 100);
    router.push("/dashboard");
  };

  const choice = (selected: boolean) => `w-full rounded-2xl border p-4 text-left transition-all ${selected ? "border-neon bg-neon/10 shadow-glow" : "border-line bg-raised/40 hover:border-neon/60"}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm text-muted">Step {step + 1} of {steps.length}</p>
      <ProgressBar pct={((step + 1) / steps.length) * 100} label="Onboarding progress" className="mt-2" />
      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mt-8" aria-labelledby="ob-title">
          {step === 0 && (
            <>
              <h1 id="ob-title" className="font-display text-3xl font-bold">Hi {user?.displayName.split(" ")[0]} 👋 What brings you here?</h1>
              <p className="mt-2 text-muted">We’ll tailor examples and recommendations to your goal.</p>
              <div role="radiogroup" aria-labelledby="ob-title" className="mt-6 grid gap-3">
                {GOALS.map((g) => (
                  <button key={g.id} type="button" role="radio" aria-checked={goal === g.id} onClick={() => setGoal(g.id)} className={choice(goal === g.id)}>
                    <span className="mr-3 text-2xl" aria-hidden="true">{g.emoji}</span>
                    <span className="font-semibold">{g.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 id="ob-title" className="font-display text-3xl font-bold">Where should you start?</h1>
              <p className="mt-2 text-muted">Pick honestly — you can always go back. Choosing a higher track unlocks it right away (with an active plan).</p>
              <div role="radiogroup" aria-labelledby="ob-title" className="mt-6 grid gap-3">
                {TRACKS.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={level === t.level} onClick={() => setLevel(t.level)} className={choice(level === t.level)}>
                    <span className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">{t.emoji}</span>
                      <span>
                        <span className="block font-semibold">{t.stage}: {t.name}</span>
                        <span className="block text-sm text-muted">{t.outcome}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h1 id="ob-title" className="font-display text-3xl font-bold">Set your daily goal</h1>
              <p className="mt-2 text-muted">Small and steady beats big and rare. Learners who set a goal are far more likely to finish.</p>
              <div role="radiogroup" aria-labelledby="ob-title" className="mt-6 grid grid-cols-2 gap-3">
                {PACE.map((p) => (
                  <button key={p.minutes} type="button" role="radio" aria-checked={pace === p.minutes} onClick={() => setPace(p.minutes)} className={choice(pace === p.minutes)}>
                    <span className="block font-display text-xl font-bold">{p.label}</span>
                    <span className="block text-sm text-muted">{p.sub} · {p.xp} XP</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h1 id="ob-title" className="font-display text-3xl font-bold">Make it work for you</h1>
              <p className="mt-2 text-muted">Set up captions, text size, contrast, motion and voice. Change these anytime with Alt + A.</p>
              <div className="card mt-6"><A11ySettings /></div>
            </>
          )}
        </motion.section>
      </AnimatePresence>
      <div className="mt-8 flex justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !goal}>
            Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={finish}>Start learning 🚀</button>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireMember>
      <Flow />
    </RequireMember>
  );
}
