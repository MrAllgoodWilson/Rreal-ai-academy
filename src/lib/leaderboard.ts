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
        subtitle: `You're #1 this week with ${weekXp} XP.${nextLeagueText} Leagues reset every Monday.`,
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
    subtitle: `You're #${myRank} of ${rows.length} this week with ${weekXp} XP.${nextLeagueText} Leagues reset every Monday.`,
    rows,
    otherClassmatesCount,
  };
}
