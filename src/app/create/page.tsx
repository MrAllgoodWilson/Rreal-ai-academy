"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, Sparkles, Wand2 } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useA11y } from "@/lib/a11y";
import { LEVEL_NAMES, type Track } from "@/lib/curriculum";

const IDEAS = [
  "Teach me to make a Christmas sale flyer for my nail salon",
  "How to start a faceless YouTube channel about history",
  "Use AI to manage my real-estate leads and follow-ups",
  "Build a restaurant website with online ordering",
  "Make AI music videos for my rap songs",
  "Enseñame a usar IA para mi negocio de comida",
];

const CATS = [
  ["foundations", "General AI"], ["creative", "Creative"], ["video", "Video & social"], ["design", "Design & flyers"], ["web", "Websites"],
  ["business", "Business"], ["automation", "Automation"], ["developer", "Developer"], ["career", "Career"],
] as const;

function Creator() {
  const { addCustomCourse, customCourses } = useAcademy();
  const { lang } = useI18n();
  const { announce } = useA11y();
  const [request, setRequest] = useState("");
  const [level, setLevel] = useState(1);
  const [category, setCategory] = useState<string>("foundations");
  const [language, setLanguage] = useState<"en" | "es">(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Track | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  const generate = async () => {
    setBusy(true);
    setError("");
    setCreated(null);
    announce("Building your course. This can take up to a minute.");
    try {
      const res = await fetch("/api/courses/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request, level, language, category }) });
      const json = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      if (!res.ok) throw new Error(json.error);
      addCustomCourse(json.track);
      setCreated(json.track);
      announce(`Your course ${json.track.name} is ready.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (id: string) => {
    const r = await fetch(`/api/courses/${id}/submit`, { method: "POST" });
    if (r.ok) {
      setSubmitted((s) => ({ ...s, [id]: true }));
      announce("Submitted for review. Once approved it will be offered to all learners.");
    }
  };

  const mine = customCourses.filter((c) => c.mine);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="AI Course Creator" title={<>Ask for <span className="heading-gradient">any</span> course</>} subtitle="Describe what you want to learn. Your AI coach builds a complete, step-by-step course with lessons, quizzes and hands-on labs — saved to your library. Share it and, once approved, it's offered to every learner." />

      <form className="card space-y-5" onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <div>
          <label htmlFor="req" className="label">What do you want to learn or create?</label>
          <textarea id="req" rows={4} className="input" value={request} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. Teach me to make TikTok ads for my bakery using AI, step by step" required minLength={8} maxLength={1000} />
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Ideas">
            {IDEAS.map((i) => (
              <button key={i} type="button" className="chip min-h-[36px]" onClick={() => setRequest(i)}>{i}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="lvl" className="label">Level</label>
            <select id="lvl" className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{LEVEL_NAMES[l]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cat" className="label">Category</label>
            <select id="cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lng" className="label">Language</label>
            <select id="lng" className="input" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "es")}>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>
        {error && <FormAlert kind="error">{error}</FormAlert>}
        <button className="btn-primary" disabled={busy || request.trim().length < 8}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-5 w-5" aria-hidden="true" />}
          {busy ? "Building your course… (up to 1 minute)" : "Build my course"}
        </button>
        <p className="text-xs text-muted">Each custom course is a one-time <strong>$9.99</strong> (credits never expire; failed builds are refunded automatically). AI can make mistakes — courses are reviewed before being offered to everyone. <a href="/credits" className="text-neon underline">Buy a course credit</a></p>
      </form>

      {busy && (
        <div className="mt-6 flex items-center gap-3 text-muted" role="status">
          {[0, 1, 2].map((i) => <motion.span key={i} className="h-3 w-3 rounded-full bg-violet" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} aria-hidden="true" />)}
          Designing lessons, writing quizzes and picking the right tools…
        </div>
      )}

      {created && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card mt-6 border-neon shadow-glow" aria-labelledby="created-title">
          <p className="chip mb-3 border-lime/60 text-lime"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Course ready</p>
          <h2 id="created-title" className="font-display text-2xl font-bold">{created.emoji} {created.name}</h2>
          <p className="mt-1 text-muted">{created.tagline}</p>
          <ol className="mt-4 list-decimal space-y-1 pl-6">
            {created.weeks[0].modules[0].lessons.map((l) => <li key={l.id}>{l.title}</li>)}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/learn/${created.id}`} className="btn-primary">Start this course</Link>
            <button type="button" className="btn-ghost" disabled={submitted[created.id]} onClick={() => submit(created.id)}>
              <Send className="h-4 w-4" aria-hidden="true" /> {submitted[created.id] ? "Submitted for review" : "Share with all learners"}
            </button>
          </div>
        </motion.section>
      )}

      {mine.length > 0 && (
        <section className="mt-10" aria-labelledby="mine-title">
          <h2 id="mine-title" className="mb-4 font-display text-xl font-semibold">My created courses</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {mine.map((c) => (
              <li key={c.id} className="card flex flex-col gap-3">
                <div>
                  <p className="font-semibold">{c.emoji} {c.name}</p>
                  <p className="text-sm text-muted">{LEVEL_NAMES[c.level]} · <span className="capitalize">{submitted[c.id] ? "submitted" : c.status ?? "private"}</span></p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link href={`/learn/${c.id}`} className="btn-ghost">Open</Link>
                  {(c.status === "private" || c.status === "rejected") && !submitted[c.id] && <button type="button" className="btn-ghost" onClick={() => submit(c.id)}>Share with all learners</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function CreatePage() {
  return <RequireMember><Creator /></RequireMember>;
}
