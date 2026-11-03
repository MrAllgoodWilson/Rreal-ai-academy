"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wand2 } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { ALL_TRACKS, LEVEL_NAMES, lessonsForTrack, trackProgress, type Track } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";
import { useI18n, useTranslated } from "@/lib/i18n";

const CATS = ["all", "foundations", "creative", "video", "design", "web", "business", "automation", "developer", "career"] as const;

function Card({ t, name, tagline, i }: { t: Track; name: string; tagline: string; i: number }) {
  const { progress } = useAcademy();
  const { t: tr } = useI18n();
  const p = trackProgress(t.id, progress.completed);
  const minutes = lessonsForTrack(t.id).reduce((a, r) => a + r.lesson.minutes, 0);
  return (
    <motion.li initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.04 }}>
      <Link href={`/learn/${t.id}`} className="card group flex h-full flex-col gap-4 transition hover:shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${t.gradient} text-3xl transition-transform group-hover:rotate-3 group-hover:scale-110`} aria-hidden="true">{t.emoji}</div>
          <ProgressRing pct={p.pct} size={60} stroke={6} label={`${name} completion`}><span className="text-xs font-bold">{p.pct}%</span></ProgressRing>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">{LEVEL_NAMES[t.level]}{t.kind === "program" ? ` · Week ${t.weeks.map((w) => w.number).join("–")}` : ""}</p>
          <h3 className="mt-1 font-display text-xl font-bold">{name}</h3>
          <p className="mt-1 text-sm text-muted">{tagline}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <span className="chip">{p.total} {tr("learn.lessons")}</span>
          <span className="chip">~{minutes >= 60 ? `${(minutes / 60).toFixed(1)} h` : `${minutes} min`}</span>
          <span className="chip">🎓 {tr("learn.cert")}</span>
          {t.language === "es" && <span className="chip">ES</span>}
        </div>
      </Link>
    </motion.li>
  );
}

function Catalog() {
  const { catalogVersion } = useAcademy();
  const { t } = useI18n();
  const [level, setLevel] = useState(0);
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tracks = useMemo(() => [...ALL_TRACKS], [catalogVersion]);
  const meta = useMemo(() => tracks.filter((x) => x.kind !== "custom").map((x) => ({ id: x.id, name: x.name, tagline: x.tagline })), [tracks]);
  const { value: translated } = useTranslated("catalog-meta", meta);
  const label = (x: Track) => translated.find((m) => m.id === x.id) ?? x;

  const program = tracks.filter((x) => x.kind === "program");
  const filt = (x: Track) => (!level || x.level === level) && (cat === "all" || x.category === cat);
  const courses = tracks.filter((x) => x.kind === "course" && filt(x));
  const community = tracks.filter((x) => x.kind === "custom" && filt(x));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t("nav.courses")} title={t("learn.title")} subtitle={t("learn.sub")} actions={<Link href="/create" className="btn-violet"><Wand2 className="h-4 w-4" aria-hidden="true" /> {t("nav.create")}</Link>} />

      <section aria-labelledby="prog-h" className="mb-14">
        <h2 id="prog-h" className="mb-4 font-display text-2xl font-bold">{t("learn.program")}</h2>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {program.map((x, i) => { const l = label(x); return <Card key={x.id} t={x} name={l.name} tagline={l.tagline} i={i} />; })}
        </ol>
      </section>

      <section aria-labelledby="courses-h">
        <h2 id="courses-h" className="mb-4 font-display text-2xl font-bold">{t("learn.courses")}</h2>
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Level">
            {[0, 1, 2, 3, 4, 5].map((l) => (
              <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={`chip min-h-[40px] px-4 ${level === l ? "border-neon text-ink" : ""}`}>{l ? LEVEL_NAMES[l] : t("learn.all")}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
            {CATS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)} className={`chip min-h-[36px] capitalize ${cat === c ? "border-violet text-ink" : ""}`}>{c}</button>
            ))}
          </div>
        </div>
        {courses.length ? (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((x, i) => { const l = label(x); return <Card key={x.id} t={x} name={l.name} tagline={l.tagline} i={i} />; })}
          </ul>
        ) : (
          <p className="text-muted">No courses match these filters yet.</p>
        )}
      </section>

      {community.length > 0 && (
        <section aria-labelledby="comm-h" className="mt-14">
          <h2 id="comm-h" className="mb-4 font-display text-2xl font-bold">{t("learn.community")}</h2>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {community.map((x, i) => <Card key={x.id} t={x} name={x.name} tagline={x.tagline} i={i} />)}
          </ul>
        </section>
      )}

      <div className="card mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">{t("learn.createCta")}</p>
        <Link href="/create" className="btn-primary"><Wand2 className="h-4 w-4" aria-hidden="true" /> {t("nav.create")}</Link>
      </div>
    </div>
  );
}

export default function LearnPage() {
  return <RequireMember><Catalog /></RequireMember>;
}
