"use client";

import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { BADGES } from "@/lib/badges";
import { useAcademy } from "@/lib/store";

const RING: Record<string, string> = { bronze: "from-amber-700 to-orange-400", silver: "from-slate-400 to-white", gold: "from-yellow-500 to-amber-200", legendary: "from-fuchsia-500 via-cyan-300 to-violet-500" };

function Badges() {
  const { progress } = useAcademy();
  const owned = BADGES.filter((b) => progress.badges[b.id]).length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Achievements" title={`${owned} of ${BADGES.length} badges`} subtitle="Hover or focus a badge to flip it. Locked badges show you how to earn them." />
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {BADGES.map((b, i) => {
          const at = progress.badges[b.id];
          return (
            <motion.li key={b.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }} className="group" style={{ perspective: 800 }}>
              <div tabIndex={0} className="relative h-52 transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-within:[transform:rotateY(180deg)] focus:[transform:rotateY(180deg)]" aria-label={`${b.name}: ${at ? `earned ${new Date(at).toLocaleDateString()}` : "locked"}. ${b.description}`}>
                <div className="glass absolute inset-0 flex flex-col items-center justify-center p-4 text-center [backface-visibility:hidden]">
                  <div className={`grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br p-1 ${at ? RING[b.tier] : "from-line to-line"}`}>
                    <span className={`grid h-full w-full place-items-center rounded-full bg-bg text-4xl ${at ? "" : "grayscale opacity-40"}`} aria-hidden="true">{b.emoji}</span>
                  </div>
                  <p className="mt-3 font-semibold">{b.name}</p>
                  <p className="text-xs capitalize text-muted">{at ? b.tier : "Locked"}</p>
                </div>
                <div className="glass absolute inset-0 flex flex-col items-center justify-center p-4 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden="true">
                  <p className="font-semibold">{b.description}</p>
                  <p className="mt-2 text-xs text-muted">{at ? `Earned ${new Date(at).toLocaleDateString()}` : "Not yet earned"}</p>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AchievementsPage() {
  return <RequireAuth><Badges /></RequireAuth>;
}
