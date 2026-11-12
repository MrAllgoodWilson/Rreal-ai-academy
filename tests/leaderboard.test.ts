import { describe, expect, it, vi, beforeEach } from "vitest";
import { leagueFor } from "@/lib/gamification";
import { GET } from "@/app/api/leaderboard/route";
import { computeLeaderboardState, type LeaderboardRow } from "@/lib/leaderboard";

describe("leaderboard API & state logic", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns demo: true when Supabase is not configured", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.demo).toBe(true);
    expect(Array.isArray(data.rows)).toBe(true);
    expect(data.rows).toEqual([]);
  });

  it("calculates weekly league accurately and safe against empty xpByDay", () => {
    const xpByDayEmpty: Record<string, number> = {};
    const weekXp = Object.entries(xpByDayEmpty)
      .filter(([k]) => Date.now() - new Date(k).getTime() < 7 * 86_400_000)
      .reduce((a, [, v]) => a + v, 0);

    expect(weekXp).toBe(0);
    const league = leagueFor(weekXp);
    expect(league.id).toBe("bronze");
    expect(league.name).toBe("Bronze");
  });

  it("never claims #1 or unearned rank when status is loading", () => {
    const state = computeLeaderboardState({
      status: "loading",
      remote: null,
      user: { id: "user-123", displayName: "AL", avatar: "👤" },
      weekXp: 0,
    });

    expect(state.myRank).toBeNull();
    expect(state.subtitle).not.toContain("#1");
    expect(state.subtitle).toContain("Loading weekly league standings...");
    expect(state.rows.length).toBe(1);
    expect(state.rows[0].id).toBe("user-123");
  });

  it("never claims #1 or unearned rank when status is unavailable (RPC error, offline, or demo mode)", () => {
    const state = computeLeaderboardState({
      status: "unavailable",
      remote: null,
      user: { id: "user-123", displayName: "AL", avatar: "👤" },
      weekXp: 75,
    });

    expect(state.myRank).toBeNull();
    expect(state.subtitle).not.toContain("#1");
    expect(state.subtitle).toContain("Live standings are currently reconnecting.");
    expect(state.rows.length).toBe(1);
  });

  it("handles empty league safely without claiming #1 for 0 XP learners", () => {
    const state = computeLeaderboardState({
      status: "empty",
      remote: [],
      user: { id: "user-123", displayName: "AL", avatar: "👤" },
      weekXp: 0,
    });

    expect(state.myRank).toBeNull();
    expect(state.subtitle).not.toContain("#1");
    expect(state.subtitle).toContain("Complete a lesson to place on the weekly leaderboard!");
  });

  it("authoritatively assigns #1 only when authenticated learner has active XP in an empty league", () => {
    const state = computeLeaderboardState({
      status: "empty",
      remote: [],
      user: { id: "user-123", displayName: "AL", avatar: "👤" },
      weekXp: 50,
    });

    expect(state.myRank).toBe(1);
    expect(state.subtitle).toContain("You're #1 this week with 50 XP.");
  });

  it("sorts learner row into genuine peers accurately without exposing private fields", () => {
    const peers: LeaderboardRow[] = [
      { id: "peer-1", name: "Genuine Classmate 1", avatar: "🦄", xp: 120 },
      { id: "peer-2", name: "Genuine Classmate 2", avatar: "🐼", xp: 40 },
    ];
    const user = { id: "user-123", displayName: "AL", avatar: "👤" };
    const state = computeLeaderboardState({
      status: "active",
      remote: peers,
      user,
      weekXp: 50,
    });

    expect(state.status).toBe("active");
    expect(state.rows.length).toBe(3);
    expect(state.rows[0].name).toBe("Genuine Classmate 1");
    expect(state.rows[1].name).toBe("AL (you)");
    expect(state.rows[2].name).toBe("Genuine Classmate 2");
    expect(state.myRank).toBe(2);
    expect(state.subtitle).toContain("You're #2 of 3 this week with 50 XP.");

    // Verify zero private fields leak
    for (const r of state.rows) {
      const item = r as unknown as Record<string, unknown>;
      expect(item.email).toBeUndefined();
      expect(item.token).toBeUndefined();
      expect(item.password).toBeUndefined();
    }
  });
});
