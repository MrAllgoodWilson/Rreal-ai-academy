"use client";

import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Crown, RefreshCw, Users } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAcademy } from "@/lib/store";
import { LEAGUES, leagueFor } from "@/lib/gamification";

interface Row {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  me?: boolean;
}

interface BoundaryProps {
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

class LeaderboardErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Leaderboard component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-2xl border border-line bg-surface/80 p-8 shadow-xl">
            <AlertCircle className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
            <h2 className="mt-4 font-display text-xl font-bold text-ink">League Table Unavailable</h2>
            <p className="mt-2 text-sm text-muted">We encountered an issue loading the weekly league standings. Your XP and streak remain fully saved.</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="btn-primary mt-6 inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Board() {
  const { user, progress } = useAcademy();
  const [remote, setRemote] = useState<Row[] | null>(null);

  const weekXp = useMemo(() => {
    if (!progress?.xpByDay || typeof progress.xpByDay !== "object") return 0;
    return Object.entries(progress.xpByDay)
      .filter(([k]) => {
        const time = new Date(k).getTime();
        return !Number.isNaN(time) && Date.now() - time < 7 * 86_400_000;
      })
      .reduce((a, [, v]) => a + (typeof v === "number" && !Number.isNaN(v) ? v : 0), 0);
  }, [progress?.xpByDay]);

  useEffect(() => {
    let active = true;
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (!active) return;
        if (!j || j.demo || !Array.isArray(j.rows)) {
          setRemote(null);
        } else {
          setRemote(
            j.rows.map(
              (r: {
                user_id?: string;
                id?: string;
                display_name?: string;
                name?: string;
                avatar?: string;
                weekly_xp?: number;
                xp?: number;
              }) => ({
                id: r.user_id ?? r.id ?? `peer-${Math.random()}`,
                name: r.display_name ?? r.name ?? "Learner",
                avatar: r.avatar ?? "👤",
                xp: typeof r.weekly_xp === "number" ? r.weekly_xp : (typeof r.xp === "number" ? r.xp : 0),
              })
            )
          );
        }
      })
      .catch(() => {
        if (active) setRemote(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const meId = user?.id ?? "me";
    const meName = user?.displayName ? `${user.displayName} (you)` : "You";
    const meAvatar = user?.avatar ?? "👤";
    const me: Row = { id: meId, name: meName, avatar: meAvatar, xp: weekXp, me: true };

    const base: Row[] = remote ?? [];
    return [...base.filter((r) => r.id !== meId), me].sort((a, b) => b.xp - a.xp);
  }, [remote, user, weekXp]);

  const myRank = Math.max(1, rows.findIndex((r) => r.me) + 1);
  const league = leagueFor(weekXp);
  const nextLeague = LEAGUES.find((l) => l.min > weekXp);
  const otherClassmatesCount = rows.length - 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Weekly leagues"
        title={<span style={{ color: league.color }}>{league.name} League</span>}
        subtitle={`You're #${myRank} this week with ${weekXp} XP.${
          nextLeague ? ` ${nextLeague.min - weekXp} XP to reach ${nextLeague.name}.` : " You're at the top league!"
        } Leagues reset every Monday.`}
      />

      {remote === null && (
        <div className="mb-6 rounded-2xl border border-line bg-surface/60 p-4 text-sm text-muted">
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
            Showing your weekly activity. Live classmate rankings update as peers complete lessons this week.
          </p>
        </div>
      )}

      {remote !== null && otherClassmatesCount === 0 && (
        <div className="mb-6 rounded-2xl border border-lime/40 bg-lime/10 p-4 text-sm text-lime">
          You are the first learner on the leaderboard this week! Keep learning to maintain your lead.
        </div>
      )}

      <ol className="space-y-2" aria-label="Leaderboard">
        {rows.map((r, i) => (
          <motion.li
            key={r.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 10) * 0.03 }}
            className={`flex items-center gap-4 rounded-2xl border p-3 ${
              r.me ? "border-neon bg-neon/10 shadow-glow" : "border-line bg-surface/60"
            }`}
          >
            <span className={`w-8 text-center font-display text-xl font-bold ${i < 3 ? "text-flame" : "text-muted"}`}>
              {i === 0 ? <Crown className="mx-auto h-6 w-6 text-flame" aria-label="1st" /> : i + 1}
            </span>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-raised text-2xl" aria-hidden="true">
              {r.avatar}
            </span>
            <span className="flex-1 font-semibold">{r.name}</span>
            <span className="font-display font-bold text-lime">{r.xp} XP</span>
            {i < 3 && <span className="sr-only">Promotion zone</span>}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <RequireMember>
      <LeaderboardErrorBoundary>
        <Board />
      </LeaderboardErrorBoundary>
    </RequireMember>
  );
}
