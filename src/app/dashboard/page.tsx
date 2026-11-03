"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Brain, Clapperboard, Flame, FlaskConical, Mic, Snowflake, Sparkles, Zap } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressRing";
import { useAcademy, TOTAL_LESSONS } from "@/lib/store";
import { TRACKS, nextLesson, trackProgress, lockReason } from "@/lib/curriculum";
import { dayKey, levelTitle, streakStatus, leagueFor } from "@/lib/gamification";
import { BADGES } from "@/lib/badges";

function WeekChart({ xpByDay }: { xpByDay: Record<string, number> }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: "short" }) };
  });
  const max = Math.max(100, ...days.map((d) => xpByDay[d.key] ?? 0));
  const total = days.reduce((a, d) => a + (xpByDay[d.key] ?? 0), 0);
  return (
    <figure>
      <figcaption className="sr-only">XP earned over the last 7 days, total {total}</figcaption>
      <table className="sr-only">
        <tbody>
          {days.map((d) => (
            <tr key={d.key}><th scope="row">{d.label}</th><td>{xpByDay[d.key] ?? 0} XP</td></tr>
          ))}
        </tbody>
      </table>
      <div className="flex h-36 items-end gap-2" aria-hidden="true">
        {days.map((d, i) => {
          const v = xpByDay[d.key] ?? 0;
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] text-muted">{v || ""}</span>
              <motion.div className={`w-full rounded-t-lg ${i === 6 ? "bg-gradient-to-t from-neon to-violet" : "bg-line"}`} initial={{ height: 0 }} animate={{ height: `${Math.max(4, (v / max) * 100)}px` }} transition={{ delay: i * 0.05, duration: 0.6 }} />
              <span className="text-xs text-muted">{d.label}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function Dashboard() {
  const { user, progress, level, todayXp, subscribed, subscription } = useAcademy();
  const router = useRouter();
  useEffect(() => {
    if (!progress.onboarding.done) router.replace("/onboarding");
  }, [progress.onboarding.done, router]);

  const status = streakStatus(progress.streak, dayKey());
  const next = nextLesson(progress.completed);
  const nextLock = next ? lockReason(next.lesson.id, progress.completed, { subscribed, placementLevel: progress.onboarding.placementLevel }) : null;
  const goalPct = Math.min(100, Math.round((todayXp / progress.dailyGoalXp) * 100));
  const doneCount = Object.keys(progress.completed).length;
  const weekXp = Object.entries(progress.xpByDay).filter(([k]) => Date.now() - new Date(k).getTime() < 7 * 86_400_000).reduce((a, [, v]) => a + v, 0);
  const league = leagueFor(weekXp);
  const recentBadges = BADGES.filter((b) => progress.badges[b.id]).slice(-6);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{greeting}, {user?.displayName.split(" ")[0]} {user?.avatar}</h1>
        <p className="mt-1 text-muted">Level {level.level} · {levelTitle(level.level)} · {doneCount}/{TOTAL_LESSONS} lessons</p>
      </header>

      {status === "at-risk" && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-flame/60 bg-flame/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3 font-semibold">
            <AlertTriangle className="h-5 w-5 text-flame" aria-hidden="true" /> Your {progress.streak.current}-day streak ends at midnight! One lesson keeps it alive.
          </p>
          {next && <Link href={`/lesson/${next.lesson.id}`} className="btn-primary">Save my streak</Link>}
        </motion.div>
      )}

      {!subscribed && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-violet/50 bg-violet/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>You’re on the free plan.</strong> Week 1 is unlocked. Start a 7-day free trial to unlock all 8 weeks, certificates and the full Studio.</p>
          <Link href="/pricing" className="btn-violet shrink-0">Start free trial</Link>
        </div>
      )}
      {subscription.status === "trialing" && subscription.trialEndsAt && (
        <p className="mb-6 text-sm text-muted">Free trial active until {new Date(subscription.trialEndsAt).toLocaleDateString()}.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue */}
        <section className="card relative overflow-hidden lg:col-span-2" aria-labelledby="continue-title">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-neon/10 blur-3xl" aria-hidden="true" />
          <h2 id="continue-title" className="text-sm font-semibold uppercase tracking-widest text-neon">Continue learning</h2>
          {next ? (
            <>
              <p className="mt-3 text-sm text-muted">{next.track.emoji} {next.track.name} · Week {next.week.number} · {next.module.title}</p>
              <p className="mt-1 font-display text-2xl font-bold">{next.lesson.title}</p>
              <p className="mt-1 text-muted">{next.lesson.summary}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {nextLock === "subscription" ? (
                  <Link href="/pricing" className="btn-violet">Unlock Week {next.week.number}</Link>
                ) : (
                  <Link href={`/lesson/${next.lesson.id}`} className="btn-primary">
                    Start lesson <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                <span className="chip">⏱ {next.lesson.minutes} min</span>
                <span className="chip">⚡ {next.lesson.xp} XP</span>
              </div>
            </>
          ) : (
            <p className="mt-3 font-display text-2xl font-bold">You’ve completed every lesson. Legend. 🏆 <Link href="/certificates" className="text-neon underline">Claim your certificates</Link></p>
          )}
        </section>

        {/* Daily goal */}
        <section className="card flex items-center gap-5" aria-labelledby="goal-title">
          <ProgressRing pct={goalPct} size={104} stroke={10} label="Daily goal">
            <div>
              <p className="font-display text-xl font-bold">{todayXp}</p>
              <p className="text-[10px] text-muted">/ {progress.dailyGoalXp} XP</p>
            </div>
          </ProgressRing>
          <div>
            <h2 id="goal-title" className="font-display text-lg font-semibold">Daily goal</h2>
            <p className="text-sm text-muted">{goalPct >= 100 ? "Crushed it today! 🎉" : `${progress.dailyGoalXp - todayXp} XP to go`}</p>
          </div>
        </section>

        {/* Streak */}
        <section className="card" aria-labelledby="streak-title">
          <h2 id="streak-title" className="sr-only">Streak</h2>
          <div className="flex items-center gap-4">
            <Flame className={`h-14 w-14 ${progress.streak.current ? "animate-flicker text-flame" : "text-muted"}`} aria-hidden="true" />
            <div>
              <p className="font-display text-4xl font-bold">{progress.streak.current}</p>
              <p className="text-sm text-muted">day streak · best {progress.streak.longest}</p>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Snowflake className="h-4 w-4 text-neon" aria-hidden="true" /> {progress.streak.freezes} streak freeze{progress.streak.freezes === 1 ? "" : "s"} — earn one every 7 days
          </p>
        </section>

        {/* Level */}
        <section className="card" aria-labelledby="level-title">
          <h2 id="level-title" className="flex items-center gap-2 font-display text-lg font-semibold"><Zap className="h-5 w-5 text-lime" aria-hidden="true" /> Level {level.level}</h2>
          <p className="text-sm text-muted">{levelTitle(level.level)}</p>
          <ProgressBar pct={level.pct} label="Progress to next level" className="mt-4" />
          <p className="mt-2 text-xs text-muted">{progress.xp.toLocaleString()} / {level.ceil.toLocaleString()} XP</p>
          <Link href="/leaderboard" className="mt-4 inline-flex text-sm font-semibold" style={{ color: league.color }}>
            {league.name} League · {weekXp} XP this week →
          </Link>
        </section>

        {/* Weekly chart */}
        <section className="card" aria-labelledby="week-title">
          <h2 id="week-title" className="mb-4 font-display text-lg font-semibold">This week</h2>
          <WeekChart xpByDay={progress.xpByDay} />
        </section>

        {/* Tracks */}
        <section className="card lg:col-span-2" aria-labelledby="tracks-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="tracks-title" className="font-display text-lg font-semibold">Your tracks</h2>
            <Link href="/learn" className="text-sm text-neon hover:underline">View all</Link>
          </div>
          <ul className="space-y-4">
            {TRACKS.map((t) => {
              const p = trackProgress(t.id, progress.completed);
              return (
                <li key={t.id}>
                  <Link href={`/learn/${t.id}`} className="group flex items-center gap-4 rounded-xl p-2 hover:bg-raised/60">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${t.gradient} text-2xl`} aria-hidden="true">{t.emoji}</span>
                    <span className="flex-1">
                      <span className="flex justify-between text-sm font-semibold"><span>{t.name}</span><span className="text-muted">{p.done}/{p.total}</span></span>
                      <ProgressBar pct={p.pct} label={`${t.name} progress`} className="mt-2" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Quick actions */}
        <section className="card" aria-labelledby="quick-title">
          <h2 id="quick-title" className="mb-4 font-display text-lg font-semibold">Practice</h2>
          <ul className="grid grid-cols-2 gap-3">
            {[
              { href: "/coach", icon: Mic, label: "Talk to Coach" },
              { href: "/sandbox", icon: FlaskConical, label: "Prompt Sandbox" },
              { href: "/studio", icon: Clapperboard, label: "Video Studio" },
              { href: "/review", icon: Brain, label: "Daily Review" },
            ].map(({ href, icon: Icon, label }) => (
              <li key={href}>
                <Link href={href} className="flex h-full flex-col items-center gap-2 rounded-xl border border-line p-4 text-center text-sm font-semibold transition hover:border-neon hover:shadow-glow">
                  <Icon className="h-6 w-6 text-neon" aria-hidden="true" /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Badges */}
        <section className="card lg:col-span-3" aria-labelledby="badges-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="badges-title" className="flex items-center gap-2 font-display text-lg font-semibold"><Sparkles className="h-5 w-5 text-violet" aria-hidden="true" /> Recent badges</h2>
            <Link href="/achievements" className="text-sm text-neon hover:underline">All badges</Link>
          </div>
          {recentBadges.length ? (
            <ul className="flex flex-wrap gap-4">
              {recentBadges.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                  <span className="text-3xl" aria-hidden="true">{b.emoji}</span>
                  <span><span className="block font-semibold">{b.name}</span><span className="block text-xs text-muted">{b.description}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Complete your first lesson to earn your first badge.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
