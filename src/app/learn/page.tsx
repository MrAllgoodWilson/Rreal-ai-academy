"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TRACKS, lessonsForTrack, trackProgress } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";

function Catalog() {
  const { progress } = useAcademy();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Curriculum" title="Your path from beginner to expert" subtitle="5 tracks, 8 weeks. Each track ends with a verifiable Rreal Certified credential." />
      <ol className="grid gap-6 md:grid-cols-2">
        {TRACKS.map((t, i) => {
          const p = trackProgress(t.id, progress.completed);
          const minutes = lessonsForTrack(t.id).reduce((a, r) => a + r.lesson.minutes, 0);
          return (
            <motion.li key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link href={`/learn/${t.id}`} className="card group flex h-full flex-col gap-4 transition hover:shadow-glow">
                <div className="flex items-start justify-between gap-4">
                  <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${t.gradient} text-3xl transition-transform group-hover:scale-110 group-hover:rotate-3`} aria-hidden="true">{t.emoji}</div>
                  <ProgressRing pct={p.pct} label={`${t.name} completion`}>
                    <span className="text-sm font-bold">{p.pct}%</span>
                  </ProgressRing>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Track {t.level} · {t.stage} · Week {t.weeks.map((w) => w.number).join("–")}</p>
                  <h2 className="mt-1 font-display text-2xl font-bold">{t.name}</h2>
                  <p className="mt-2 text-muted">{t.tagline}</p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <span className="chip">{p.total} lessons</span>
                  <span className="chip">~{Math.round(minutes / 6) * 6 >= 60 ? `${(minutes / 60).toFixed(1)} h` : `${minutes} min`}</span>
                  <span className="chip">🎓 Certificate</span>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

export default function LearnPage() {
  return <RequireAuth><Catalog /></RequireAuth>;
}
