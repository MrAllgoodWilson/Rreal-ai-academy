"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Accessibility, ArrowRight, BadgeCheck, Captions, Check, Clapperboard, Ear, Eye, FlaskConical, Mic, Minus, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import { TRACKS, ALL_LESSONS, ALL_TRACKS } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.5 } };

const FEATURES = [
  { icon: Sparkles, title: "Ask for ANY course", body: "Describe what you want to learn and the AI builds a full course for you — then shares the best ones with everyone." },
  { icon: Clapperboard, title: "Playbooks: make anything", body: "Step-by-step guides for TikToks, ads, flyers, logos and websites — including exactly which tools to sign up for." },
  { icon: Mic, title: "Rreal Coach — talk to your tutor", body: "Two-way voice coaching with a live waveform and synchronized captions. Ask anything, get graded, practice out loud." },
  { icon: FlaskConical, title: "Live Prompt Sandbox", body: "Type a prompt, get an instant Prompt Quality Score with line-by-line coaching. Zero installs, zero setup." },
  { icon: Clapperboard, title: "Social Video Studio", body: "Hooks → script → scene storyboard → captioned 9:16 preview → posting calendar export. A real creator pipeline." },
  { icon: BadgeCheck, title: "Verifiable credentials", body: "Every certificate has a tamper-proof signature, a QR code, a public verification page and one-click LinkedIn add." },
  { icon: Trophy, title: "Streaks, leagues & badges", body: "XP, levels, streak freezes, weekly leagues and 19 collectible badges with 3D unlock celebrations." },
  { icon: Sparkles, title: "Learn-by-building portfolio", body: "Every lab you pass is saved to a shareable portfolio — proof of skill, not just proof of attendance." },
];

const A11Y = [
  { icon: Eye, title: "Blind & low-vision", body: "Screen-reader-first markup, read-aloud lessons, text scaling to 150%, high-contrast mode." },
  { icon: Ear, title: "Deaf & hard-of-hearing", body: "Live captions on every voice interaction, visual flash for every sound, full transcripts." },
  { icon: Accessibility, title: "Motor & cognitive", body: "Full keyboard control, 44px touch targets, voice input, reduced motion, dyslexia-friendly spacing." },
];

const COMPARE: [string, boolean | "partial", boolean | "partial", boolean | "partial"][] = [
  ["Beginner → expert path in one place", true, "partial", false],
  ["Two-way voice tutor with live captions", true, false, false],
  ["Hands-on labs with instant AI grading", true, "partial", "partial"],
  ["Social video creation & posting pipeline", true, false, false],
  ["Streaks, leagues & badges", true, false, true],
  ["Publicly verifiable, tamper-proof certificates", true, "partial", false],
  ["Accessibility built in (not bolted on)", true, "partial", "partial"],
];

function Mark({ v }: { v: boolean | "partial" }) {
  if (v === true) return <Check className="mx-auto h-5 w-5 text-lime" aria-label="Yes" />;
  if (v === "partial") return <span className="text-sm text-muted">Partial</span>;
  return <Minus className="mx-auto h-5 w-5 text-muted" aria-label="No" />;
}

export default function Home() {
  const { user } = useAcademy();
  const cta = user ? "/dashboard" : "/signup";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* HERO */}
      <section className="grid grid-cols-1 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24 [&>*]:min-w-0" aria-labelledby="hero-title">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chip mb-6 border-neon/40 text-neon">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {ALL_TRACKS.length} courses · {ALL_LESSONS.length} lessons · English & Español · $1/month
          </motion.p>
          <motion.h1 id="hero-title" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Go from <span className="heading-gradient">“what is AI?”</span> to AI expert.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 max-w-xl text-lg text-muted">
            Rreal AI Academy is the interactive, voice-guided AI school for everyone. Talk to your coach, build real projects in live labs, create social videos, and earn certificates employers can verify in one click.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 flex flex-wrap gap-3">
            <Link href={cta} className="btn-primary text-lg">
              {user ? "Continue learning" : "Join for $1/month"} <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="btn-ghost text-lg">See plans</Link>
          </motion.div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lime" aria-hidden="true" /> Every course & tool for $1/month</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lime" aria-hidden="true" /> Built for screen readers & captions</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lime" aria-hidden="true" /> Cancel anytime</li>
          </ul>
        </div>

        {/* Animated coach preview */}
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className="relative" aria-hidden="true">
          <div className="glass relative overflow-hidden p-6 shadow-glow">
            <div className="mb-5 flex items-center gap-3">
              <div className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-neon to-violet">
                <Mic className="h-6 w-6 text-bg" />
                <span className="absolute inset-0 animate-ping rounded-full bg-neon/40" />
              </div>
              <div>
                <p className="font-semibold">Rreal Coach</p>
                <p className="text-xs text-lime">● Listening</p>
              </div>
            </div>
            <div className="flex h-20 items-center justify-center gap-1">
              {Array.from({ length: 36 }).map((_, i) => (
                <motion.span key={i} className="w-1.5 rounded-full bg-gradient-to-t from-neon to-violet" animate={{ height: [8, 20 + ((i * 37) % 50), 8] }} transition={{ duration: 0.9 + (i % 5) * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.03 }} />
              ))}
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <p className="rounded-xl bg-raised/80 p-3"><span className="font-semibold text-neon">You:</span> How do I write a hook for my bakery’s TikTok?</p>
              <p className="rounded-xl border border-violet/40 bg-violet/10 p-3"><span className="font-semibold text-violet">Coach:</span> Try a result-first hook: “We sold out in 2 hours — here’s the one croissant trick.” Want 9 more in that style?</p>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-bg/60 p-3">
              <span className="flex items-center gap-2 text-sm"><Captions className="h-4 w-4 text-neon" /> Captions on</span>
              <span className="flex items-center gap-1 font-display text-lg font-bold text-lime"><Zap className="h-4 w-4" /> +75 XP</span>
            </div>
          </div>
          <motion.div className="glass absolute -bottom-16 left-8 hidden items-center gap-3 p-4 sm:flex" animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity }}>
            <span className="text-3xl">🔥</span>
            <div><p className="font-display text-xl font-bold">12 days</p><p className="text-xs text-muted">streak</p></div>
          </motion.div>
          <motion.div className="glass absolute -right-4 -top-6 hidden items-center gap-3 p-4 sm:flex" animate={{ y: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity }}>
            <ShieldCheck className="h-8 w-8 text-lime" />
            <div><p className="font-semibold">Verified credential</p><p className="text-xs text-muted">RRAI-2026-8F3C…</p></div>
          </motion.div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <motion.section {...fade} className="py-16" aria-labelledby="how-title">
        <h2 id="how-title" className="text-center font-display text-3xl font-bold sm:text-4xl">Learn it. Build it. Prove it.</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ["1", "Learn in 5–15 minute bursts", "Bite-size lessons you can read, listen to, or talk through with your coach."],
            ["2", "Build in live labs", "Every concept ends in a hands-on lab graded instantly — and saved to your portfolio."],
            ["3", "Prove it with a credential", "Pass the track and receive a signed, publicly verifiable certificate."],
          ].map(([n, t, b]) => (
            <li key={n} className="card">
              <span className="font-display text-5xl font-bold text-neon/80" aria-hidden="true">{n}</span>
              <h3 className="mt-3 font-display text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* TRACKS */}
      <motion.section {...fade} className="py-16" aria-labelledby="tracks-title">
        <h2 id="tracks-title" className="font-display text-3xl font-bold sm:text-4xl">Your 8-week path</h2>
        <p className="mt-2 max-w-2xl text-muted">Start wherever you are. A 2-minute placement check lets you skip what you already know.</p>
        <ol className="mt-10 space-y-4">
          {TRACKS.map((t, i) => (
            <motion.li key={t.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="glass flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${t.gradient} text-3xl`} aria-hidden="true">{t.emoji}</div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Track {t.level} · {t.stage} · Week {t.weeks.map((w) => w.number).join("–")}
                </p>
                <h3 className="font-display text-xl font-semibold">{t.name}</h3>
                <p className="text-muted">{t.tagline}</p>
              </div>
              <span className="chip self-start sm:self-center">{t.certificateTitle.replace("Rreal Certified: ", "🎓 ")}</span>
            </motion.li>
          ))}
        </ol>
      </motion.section>

      {/* FEATURES */}
      <motion.section {...fade} className="py-16" aria-labelledby="features-title">
        <h2 id="features-title" className="font-display text-3xl font-bold sm:text-4xl">Features other AI courses don’t have</h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <motion.li key={title} whileHover={{ y: -4 }} className="card">
              <Icon className="h-8 w-8 text-neon" aria-hidden="true" />
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-muted">{body}</p>
            </motion.li>
          ))}
        </ul>
      </motion.section>

      {/* ACCESSIBILITY */}
      <motion.section {...fade} className="py-16" aria-labelledby="a11y-title">
        <div className="glass overflow-hidden p-8 sm:p-12">
          <h2 id="a11y-title" className="font-display text-3xl font-bold sm:text-4xl">Built for <span className="heading-gradient">every</span> learner</h2>
          <p className="mt-3 max-w-2xl text-muted">Accessibility isn’t a setting we added later. It’s how the academy is built — designed against WCAG 2.1 AAA.</p>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {A11Y.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon className="h-8 w-8 text-violet" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      {/* COMPARISON */}
      <motion.section {...fade} className="py-16" aria-labelledby="compare-title">
        <h2 id="compare-title" className="font-display text-3xl font-bold sm:text-4xl">How we compare</h2>
        <div className="mt-8 overflow-x-auto glass">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">Rreal AI Academy compared with typical online course platforms</caption>
            <thead>
              <tr className="border-b border-line/60 text-sm">
                <th scope="col" className="p-4">Feature</th>
                <th scope="col" className="p-4 text-center text-neon">Rreal AI Academy</th>
                <th scope="col" className="p-4 text-center text-muted">Typical video-course sites</th>
                <th scope="col" className="p-4 text-center text-muted">Typical gamified apps</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([f, a, b, c]) => (
                <tr key={f} className="border-b border-line/40 last:border-0">
                  <th scope="row" className="p-4 font-medium">{f}</th>
                  <td className="p-4 text-center"><Mark v={a} /></td>
                  <td className="p-4 text-center"><Mark v={b} /></td>
                  <td className="p-4 text-center"><Mark v={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section {...fade} className="py-20 text-center" aria-labelledby="cta-title">
        <h2 id="cta-title" className="font-display text-4xl font-bold sm:text-5xl">Your first AI win is 6 minutes away.</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">Every course, playbook, tool and certificate for $1 a month. In English and Spanish. Cancel anytime.</p>
        <Link href={cta} className="btn-primary mt-8 text-lg">
          {user ? "Back to my dashboard" : "Join for $1/month"} <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </motion.section>
    </div>
  );
}
