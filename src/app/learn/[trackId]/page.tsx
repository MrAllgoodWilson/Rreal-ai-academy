"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { getTrack, lockReason, trackProgress } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";

function TrackView({ trackId }: { trackId: string }) {
  const track = getTrack(trackId);
  const { progress, subscribed } = useAcademy();
  if (!track) notFound();
  const p = trackProgress(track.id, progress.completed);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/learn" className="text-sm text-neon hover:underline">← All tracks</Link>
      <header className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className={`grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-gradient-to-br ${track.gradient} text-5xl shadow-2xl`} aria-hidden="true">{track.emoji}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">Track {track.level} · {track.stage}</p>
          <h1 className="font-display text-4xl font-bold">{track.name}</h1>
          <p className="mt-2 text-muted"><strong className="text-ink">Outcome:</strong> {track.outcome}</p>
          <ProgressBar pct={p.pct} label={`${track.name} progress`} className="mt-4" />
          <p className="mt-1 text-sm text-muted">{p.done} of {p.total} lessons complete</p>
        </div>
      </header>

      {track.weeks.map((week) => (
        <section key={week.number} className="mt-12" aria-labelledby={`week-${week.number}`}>
          <h2 id={`week-${week.number}`} className="font-display text-2xl font-bold">
            <span className="text-neon">Week {week.number}</span> · {week.title}
          </h2>
          {week.modules.map((m) => (
            <div key={m.id} className="card mt-5">
              <h3 className="font-display text-xl font-semibold">{m.title}</h3>
              <p className="text-muted">{m.description}</p>
              <ol className="mt-4 space-y-2">
                {m.lessons.map((l, i) => {
                  const done = !!progress.completed[l.id];
                  const lock = lockReason(l.id, progress.completed, { subscribed, placementLevel: progress.onboarding.placementLevel });
                  const Icon = done ? CheckCircle2 : lock ? Lock : PlayCircle;
                  const status = done ? "completed" : lock === "subscription" ? "requires subscription" : lock ? "locked" : "available";
                  return (
                    <motion.li key={l.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={lock === "subscription" ? "/pricing" : `/lesson/${l.id}`} aria-disabled={lock === "prerequisite"} className={`flex items-center gap-4 rounded-xl border p-4 transition ${lock ? "border-line/50 opacity-70" : "border-line hover:border-neon hover:bg-raised/50"}`}>
                        <Icon className={`h-7 w-7 shrink-0 ${done ? "text-lime" : lock ? "text-muted" : "text-neon"}`} aria-hidden="true" />
                        <span className="flex-1">
                          <span className="block font-semibold">{l.title}<span className="sr-only"> — {status}</span></span>
                          <span className="block text-sm text-muted">{l.summary}</span>
                        </span>
                        <span className="hidden shrink-0 text-right text-xs text-muted sm:block">{l.minutes} min<br />⚡ {l.xp} XP</span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default function TrackPage({ params }: { params: { trackId: string } }) {
  return <RequireAuth><TrackView trackId={params.trackId} /></RequireAuth>;
}
