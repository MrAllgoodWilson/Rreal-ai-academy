"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAcademy } from "@/lib/store";
import { LEAGUES, leagueFor } from "@/lib/gamification";

interface Row { id: string; name: string; avatar: string; xp: number; me?: boolean }

/** Deterministic demo peers so the board feels alive before real users exist. */
function demoPeers(seed: number): Row[] {
  const names = ["Maya", "Jordan", "Priya", "Luis", "Aisha", "Chen", "Tomás", "Grace", "Omar", "Zoe", "Kenji", "Fatima", "Noah", "Ivy"];
  const avatars = ["🦄", "🐼", "🦁", "🐙", "🦉", "🐯", "🐸", "🦊", "🐨", "🐬", "🦋", "🐝", "🐺", "🐧"];
  return names.map((n, i) => ({ id: `demo-${i}`, name: n, avatar: avatars[i], xp: Math.round(((seed * (i + 7)) % 900) + 40 + (13 - i) * 35) }));
}

function Board() {
  const { user, progress } = useAcademy();
  const [remote, setRemote] = useState<Row[] | null>(null);
  const weekXp = Object.entries(progress.xpByDay).filter(([k]) => Date.now() - new Date(k).getTime() < 7 * 86_400_000).reduce((a, [, v]) => a + v, 0);

  useEffect(() => {
    fetch("/api/leaderboard").then((r) => r.json()).then((j) => {
      if (!j.demo) setRemote((j.rows as { user_id: string; display_name: string; avatar: string; weekly_xp: number }[]).map((r) => ({ id: r.user_id, name: r.display_name, avatar: r.avatar, xp: r.weekly_xp })));
    }).catch(() => {});
  }, []);

  const rows = useMemo(() => {
    const base = remote ?? demoPeers(new Date().getDate() + 3);
    const me: Row = { id: user!.id, name: `${user!.displayName} (you)`, avatar: user!.avatar, xp: weekXp, me: true };
    return [...base.filter((r) => r.id !== user!.id), me].sort((a, b) => b.xp - a.xp);
  }, [remote, user, weekXp]);
  const myRank = rows.findIndex((r) => r.me) + 1;
  const league = leagueFor(weekXp);
  const nextLeague = LEAGUES.find((l) => l.min > weekXp);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader eyebrow="Weekly leagues" title={<span style={{ color: league.color }}>{league.name} League</span>} subtitle={`You're #${myRank} this week with ${weekXp} XP.${nextLeague ? ` ${nextLeague.min - weekXp} XP to reach ${nextLeague.name}.` : " You're at the top league!"} Leagues reset every Monday.`} />
      {!remote && <p className="mb-4 text-sm text-muted">Showing demo learners. Real classmates appear once the database is connected.</p>}
      <ol className="space-y-2" aria-label="Leaderboard">
        {rows.map((r, i) => (
          <motion.li key={r.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className={`flex items-center gap-4 rounded-2xl border p-3 ${r.me ? "border-neon bg-neon/10 shadow-glow" : "border-line bg-surface/60"}`}>
            <span className={`w-8 text-center font-display text-xl font-bold ${i < 3 ? "text-flame" : "text-muted"}`}>{i === 0 ? <Crown className="mx-auto h-6 w-6 text-flame" aria-label="1st" /> : i + 1}</span>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-raised text-2xl" aria-hidden="true">{r.avatar}</span>
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
  return <RequireMember><Board /></RequireMember>;
}
