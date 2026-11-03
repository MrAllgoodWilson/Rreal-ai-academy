"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useAcademy, type Celebration } from "@/lib/store";
import { useA11y } from "@/lib/a11y";
import { getBadge } from "@/lib/badges";
import { levelTitle } from "@/lib/gamification";

const TIER: Record<string, string> = {
  bronze: "from-amber-700 via-orange-400 to-amber-700",
  silver: "from-slate-400 via-white to-slate-400",
  gold: "from-yellow-500 via-amber-200 to-yellow-500",
  legendary: "from-fuchsia-500 via-cyan-300 to-violet-500",
};

function describe(c: Celebration) {
  switch (c.kind) {
    case "lesson":
      return { emoji: "✅", title: "Lesson complete!", body: `${c.title} — +${c.xp} XP${c.bonus > 0 ? ` (includes +${c.bonus} streak bonus)` : ""}`, tier: "silver" };
    case "badge": {
      const b = getBadge(c.badgeId);
      return { emoji: b?.emoji ?? "🏅", title: `Badge unlocked: ${b?.name}`, body: b?.description ?? "", tier: b?.tier ?? "bronze" };
    }
    case "level":
      return { emoji: "⬆️", title: `Level ${c.level}!`, body: `You're now a ${levelTitle(c.level)}.`, tier: "gold" };
    case "streak":
      return { emoji: "🔥", title: `${c.days}-day streak!`, body: "Consistency is your superpower. See you tomorrow.", tier: "bronze" };
    case "certificate":
      return { emoji: "📜", title: "You're Rreal Certified!", body: c.title, tier: "legendary" };
  }
}

export function CelebrationOverlay() {
  const { celebrations, dismissCelebration } = useAcademy();
  const { prefs, announce, chime } = useA11y();
  const current = celebrations[0];
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!current) return;
    const d = describe(current);
    announce(`${d.title}. ${d.body}`, "assertive");
    chime(current.kind === "level" || current.kind === "certificate" ? "level" : "success");
    btn.current?.focus();
    const reduced = prefs.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const big = current.kind !== "lesson";
      confetti({ particleCount: big ? 160 : 90, spread: big ? 100 : 70, origin: { y: 0.6 }, colors: ["#22d3ee", "#a78bfa", "#fb923c", "#a3e635", "#ffffff"], disableForReducedMotion: true });
      if (big) setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 } }), 250);
      if (big) setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 } }), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div key={JSON.stringify(current)} className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {(() => {
            const d = describe(current);
            return (
              <motion.div role="alertdialog" aria-modal="true" aria-labelledby="celebrate-title" aria-describedby="celebrate-body" className="glass w-full max-w-sm p-8 text-center shadow-glow" initial={{ scale: 0.7, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", damping: 14 }}>
                <div style={{ perspective: 800 }} className="mx-auto mb-6 h-32 w-32">
                  <motion.div
                    className={`grid h-full w-full place-items-center rounded-full bg-gradient-to-br ${TIER[d.tier]} p-1 shadow-2xl`}
                    initial={{ rotateY: -540, scale: 0.3 }}
                    animate={{ rotateY: 0, scale: 1 }}
                    transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div className="grid h-full w-full place-items-center rounded-full bg-bg text-6xl" aria-hidden="true">
                      {d.emoji}
                    </div>
                  </motion.div>
                </div>
                <h2 id="celebrate-title" className="font-display text-2xl font-bold">{d.title}</h2>
                <p id="celebrate-body" className="mt-2 text-muted">{d.body}</p>
                <button ref={btn} type="button" onClick={dismissCelebration} className="btn-primary mt-6 w-full">
                  {celebrations.length > 1 ? `Next (${celebrations.length - 1} more)` : "Keep going"}
                </button>
              </motion.div>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
