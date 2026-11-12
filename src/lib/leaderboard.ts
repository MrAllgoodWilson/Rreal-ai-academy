import { LEAGUES, leagueFor, dayKey } from "@/lib/gamification";

export interface LeaderboardRow {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  me?: boolean;
  rank?: number;
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
 * matching PostgreSQL's date_trunc('week', now() at time zone 'UTC').
 */
export function getMondayOfWeek(d: Date = new Date()): Date {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = (day + 6) % 7; // days since previous Monday
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff, 0, 0, 0, 0));
}

/**
 * Calculates the learner's weekly XP aligned with the Monday 00:00:00 UTC cycle.
 * Clamps to [Monday 00:00:00 UTC, now], discards future-dated XP, negative values, and non-finite numbers.
 * Supports dayKey matching learner's current local day under non-UTC timezones.
 */
export function calculateWeeklyXp(xpByDay?: Record<string, number> | null, now: Date = new Date()): number {
  if (!xpByDay || typeof xpByDay !== "object") return 0;
  const mondayTime = getMondayOfWeek(now).getTime();
  const nowTime = now.getTime();
  const currentLocalDay = dayKey(now);

  return Object.entries(xpByDay)
    .filter(([k, v]) => {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return false;
      // If key is learner's local date for `now`, it belongs to today's active cycle
      if (k === currentLocalDay) return true;
      const time = new Date(k.includes("T") ? k : `${k}T00:00:00Z`).getTime();
      return !Number.isNaN(time) && time >= mondayTime && time <= nowTime;
    })
    .reduce((a, [, v]) => a + (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0), 0);
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

  if (status === "empty" || !remote || remote.length === 0) {
    const emptyMsg =
      weekXp > 0
        ? `No participating learners have placed on the leaderboard this week yet. Standings reflect opted-in learners and reset every Monday at 00:00 UTC.`
        : `Complete a lesson to place on the weekly leaderboard! Standings reflect opted-in learners and reset every Monday at 00:00 UTC.`;

    return {
      status: "empty",
      myRank: null,
      subtitle: `You have ${weekXp} XP this week in the ${league.name} League.${nextLeagueText} ${emptyMsg}`,
      rows: [me],
      otherClassmatesCount: 0,
    };
  }

  // status === "active"
  const selfInRemote = remote.find((r) => r.me || (user?.id && r.id === user.id));

  // If self is not in remote:
  // C1: If remote has 50 rows (server limit), self is below the top 50, so global rank is unknown -> null
  // C2: If remote has < 50 rows, but self XP > top returned peer, self is opted out -> null
  const isSelfOptedOut = !selfInRemote && remote.length < 50 && weekXp > (remote[0]?.xp ?? 0);
  const isSelfBelowLimit = !selfInRemote && remote.length >= 50;

  // Build combined rows
  let combinedRows: LeaderboardRow[];
  if (selfInRemote) {
    // Self is already in server results: mark self
    combinedRows = remote.map((r) =>
      r.me || (user?.id && r.id === user.id) ? { ...r, me: true, name: meName } : r
    );
  } else if (!isSelfOptedOut && !isSelfBelowLimit) {
    // Self is not in remote, but within active cohort size (< 50) and not opted-out (e.g. C6 tie with peers)
    combinedRows = [...remote.filter((r) => r.id !== meId), me];
  } else {
    // Opted-out or below limit: keep self out of public standings to avoid false placement
    combinedRows = [...remote];
  }

  // Sort descending by XP
  combinedRows.sort((a, b) => b.xp - a.xp);

  // Compute shared ranks for ties
  let currentRank = 1;
  let myRank: number | null = null;
  const rowsWithRanks: LeaderboardRow[] = combinedRows.map((r, i) => {
    if (i > 0 && r.xp < combinedRows[i - 1].xp) {
      currentRank = i + 1;
    }
    if (r.me) {
      myRank = currentRank;
    }
    return { ...r, rank: currentRank };
  });

  // If self was below top 50 or opted out, suppress rank
  if (isSelfBelowLimit || isSelfOptedOut) {
    myRank = null;
  }

  const otherClassmatesCount = Math.max(0, rowsWithRanks.length - (rowsWithRanks.some((r) => r.me) ? 1 : 0));

  let subtitle: string;
  if (myRank !== null) {
    subtitle = `You're #${myRank} of ${rowsWithRanks.length} participating learners this week with ${weekXp} XP.${nextLeagueText} Standings reflect opted-in learners and reset every Monday at 00:00 UTC.`;
  } else {
    subtitle = `You have ${weekXp} XP this week in the ${league.name} League.${nextLeagueText} Standings reflect opted-in learners and reset every Monday at 00:00 UTC.`;
  }

  return {
    status: "active",
    myRank,
    subtitle,
    rows: rowsWithRanks,
    otherClassmatesCount,
  };
}
