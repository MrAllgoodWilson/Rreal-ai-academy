"use client";

import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Crown, RefreshCw, Users } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAcademy } from "@/lib/store";
import { leagueFor } from "@/lib/gamification";
import {
  calculateWeeklyXp,
  computeLeaderboardState,
  type LeaderboardRow,
  type LeaderboardStatus,
} from "@/lib/leaderboard";

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
  const [status, setStatus] = useState<LeaderboardStatus>("loading");
  const [remote, setRemote] = useState<LeaderboardRow[] | null>(null);

  // Aligned with Postgres date_trunc('week', now()) - resets Monday 00:00:00 UTC
  const weekXp = useMemo(() => {
    return calculateWeeklyXp(progress?.xpByDay);
  }, [progress?.xpByDay]);

  useEffect(() => {
    let active = true;
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (!active) return;
        if (!j || j.demo || !Array.isArray(j.rows)) {
          setStatus("unavailable");
          setRemote(null);
        } else if (j.rows.length === 0) {
          setStatus("empty");
          setRemote([]);
        } else {
          setStatus("active");
          setRemote(
            j.rows.map(
              (
                r: {
                  display_name?: string;
                  avatar?: string;
                  weekly_xp?: number;
                  is_self?: boolean;
                },
                idx: number
              ) => ({
                id: r.is_self ? (user?.id ?? "me") : `peer-${idx}`,
                name: r.display_name ?? "Learner",
                avatar: r.avatar ?? "👤",
                xp: typeof r.weekly_xp === "number" ? r.weekly_xp : 0,
                me: Boolean(r.is_self),
              })
            )
          );
        }
      })
      .catch(() => {
        if (active) {
          setStatus("unavailable");
          setRemote(null);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const computed = useMemo(() => {
    return computeLeaderboardState({ status, remote, user, weekXp });
  }, [status, remote, user, weekXp]);

  const league = leagueFor(weekXp);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Weekly leagues"
        title={<span style={{ color: league.color }}>{league.name} League</span>}
        subtitle={computed.subtitle}
      />

      {computed.status === "loading" && (
        <div className="mb-6 rounded-2xl border border-line bg-surface/60 p-4 text-sm text-muted">
          <p className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />
            Loading live weekly standings...
          </p>
        </div>
      )}

      {computed.status === "unavailable" && (
        <div className="mb-6 rounded-2xl border border-line bg-surface/60 p-4 text-sm text-muted">
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
            Live league standings are currently unavailable. Your XP and streak continue to be tracked safely.
          </p>
        </div>
      )}

      {computed.status === "empty" && (
        <div className="mb-6 rounded-2xl border border-lime/40 bg-lime/10 p-4 text-sm text-lime">
          {weekXp > 0
            ? "You are currently the first participating learner on the leaderboard this week! Standings include classmates who opted in to share weekly progress."
            : "No participating learners have placed on the leaderboard this week yet. Complete a lesson to take the lead among opted-in classmates!"}
        </div>
      )}

      {computed.status === "active" && (
        <div className="mb-6 rounded-2xl border border-line bg-surface/60 p-3 text-xs text-muted">
          <p className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            Standings reflect participating classmates who opted in to the weekly leaderboard. Resets every Monday at 00:00 UTC.
          </p>
        </div>
      )}

      <ol className="space-y-2" aria-label="Leaderboard">
        {computed.rows.map((r, i) => {
          const showRank = computed.myRank !== null || !r.me;
          return (
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
              <span className={`w-8 text-center font-display text-xl font-bold ${showRank && i < 3 ? "text-flame" : "text-muted"}`}>
                {!showRank ? (
                  <span className="text-sm font-normal text-muted">—</span>
                ) : i === 0 ? (
                  <Crown className="mx-auto h-6 w-6 text-flame" aria-label="1st" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-raised text-2xl" aria-hidden="true">
                {r.avatar}
              </span>
              <span className="flex-1 font-semibold">{r.name}</span>
              <span className="font-display font-bold text-lime">{r.xp} XP</span>
              {showRank && i < 3 && <span className="sr-only">Promotion zone</span>}
            </motion.li>
          );
        })}
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
