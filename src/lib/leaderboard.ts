import { LEAGUES, leagueFor } from "@/lib/gamification";

export interface LeaderboardRow {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  me?: boolean;
}

export type LeaderboardStatus = "loading" | "unavailable" | "empty" | "active";

export interface LeaderboardComputedState {
  status: LeaderboardStatus;
  myRank: number | null;
  subtitle: string;
  rows: LeaderboardRow[];
  otherClassmatesCount: number;
}

/**
 * Calculates the start of the week (Monday 00:00:00.000 UTC),
 * matching PostgreSQL's date_trunc('week', now()).
 */
export function getMondayOfWeek(d: Date = new Date()): Date {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = (day + 6) % 7; // days since previous Monday
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff, 0, 0, 0, 0));
}

/**
 * Calculates the learner's weekly XP aligned with the Monday 00:00:00 UTC cycle.
 */
export function calculateWeeklyXp(xpByDay?: Record<string, number> | null, now: Date = new Date()): number {
  if (!xpByDay || typeof xpByDay !== "object") return 0;
  const mondayTime = getMondayOfWeek(now).getTime();
  return Object.entries(xpByDay)
    .filter(([k]) => {
      const time = new Date(k.includes("T") ? k : `${k}T00:00:00Z`).getTime();
      return !Number.isNaN(time) && time >= mondayTime;
    })
    .reduce((a, [, v]) => a + (typeof v === "number" && !Number.isNaN(v) ? v : 0), 0);
}

export function computeLeaderboardState({
  status,
  remote,
  user,
  weekXp,
}: {
  status: LeaderboardStatus;
  remote: LeaderboardRow[] | null;
  user: { id?: string; displayName?: string; avatar?: string } | null;
  weekXp: number;
}): LeaderboardComputedState {
  const meId = user?.id ?? "me";
  const meName = user?.displayName ? `${user.displayName} (you)` : "You";
  const meAvatar = user?.avatar ?? "👤";
  const me: LeaderboardRow = { id: meId, name: meName, avatar: meAvatar, xp: weekXp, me: true };
  const league = leagueFor(weekXp);
  const nextLeague = LEAGUES.find((l) => l.min > weekXp);
  const nextLeagueText = nextLeague ? ` ${nextLeague.min - weekXp} XP to reach ${nextLeague.name}.` : " You're at the top league!";

  if (status === "loading") {
    return {
      status,
      myRank: null,
      subtitle: `You have ${weekXp} XP this week in the ${league.name} League.${nextLeagueText} Loading weekly league standings...`,
      rows: [me],
      otherClassmatesCount: 0,
    };
  }

  if (status === "unavailable") {
    return {
      status,
      myRank: null,
      subtitle: `You have earned ${weekXp} XP this week in the ${league.name} League.${nextLeagueText} Live standings are currently reconnecting.`,
      rows: [me],
      otherClassmatesCount: 0,
    };
  }

  if (status === "empty") {
    if (weekXp > 0) {
      return {
        status,
        myRank: 1,
        subtitle: `You're #1 among participating learners this week with ${weekXp} XP.${nextLeagueText} Standings reflect opted-in learners and reset every Monday at 00:00 UTC.`,
        rows: [me],
        otherClassmatesCount: 0,
      };
    }
    return {
      status,
      myRank: null,
      subtitle: `You have 0 XP this week in the ${league.name} League.${nextLeagueText} Complete a lesson to place on the weekly leaderboard!`,
      rows: [me],
      otherClassmatesCount: 0,
    };
  }

  // status === "active" (remote has peers)
  const base: LeaderboardRow[] = remote ?? [];
  const rows = [...base.filter((r) => r.id !== meId), me].sort((a, b) => b.xp - a.xp);
  const myRank = rows.findIndex((r) => r.me) + 1;
  const otherClassmatesCount = rows.length - 1;

  return {
    status,
    myRank,
    subtitle: `You're #${myRank} of ${rows.length} participating learners this week with ${weekXp} XP.${nextLeagueText} Standings reflect opted-in learners and reset every Monday at 00:00 UTC.`,
    rows,
    otherClassmatesCount,
  };
}
