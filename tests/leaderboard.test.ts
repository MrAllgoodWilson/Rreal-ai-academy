import { describe, expect, it, vi, beforeEach } from "vitest";
import { leagueFor } from "@/lib/gamification";
import { GET } from "@/app/api/leaderboard/route";
import {
  calculateWeeklyXp,
  computeLeaderboardState,
  getMondayOfWeek,
  type LeaderboardRow,
} from "@/lib/leaderboard";

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

  it("calculates Monday 00:00:00 UTC start of week correctly across week boundaries", () => {
    // Wednesday 2026-11-11 15:30:00 UTC -> Monday 2026-11-09 00:00:00 UTC
    const wed = new Date("2026-11-11T15:30:00Z");
    const monWed = getMondayOfWeek(wed);
    expect(monWed.toISOString()).toBe("2026-11-09T00:00:00.000Z");

    // Sunday 2026-11-15 23:59:59 UTC -> Monday 2026-11-09 00:00:00 UTC
    const sun = new Date("2026-11-15T23:59:59Z");
    const monSun = getMondayOfWeek(sun);
    expect(monSun.toISOString()).toBe("2026-11-09T00:00:00.000Z");

    // Monday 2026-11-16 00:00:01 UTC -> Monday 2026-11-16 00:00:00 UTC
    const nextMon = new Date("2026-11-16T00:00:01Z");
    const monNext = getMondayOfWeek(nextMon);
    expect(monNext.toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });

  it("calculates weekly XP strictly aligned with Monday UTC reset, ignoring previous week XP", () => {
    const fixedNow = new Date("2026-11-11T12:00:00Z"); // Wednesday
    const xpByDay = {
      "2026-11-08": 100, // Sunday of previous week (must be excluded)
      "2026-11-09": 30,  // Monday (included)
      "2026-11-10": 20,  // Tuesday (included)
      "2026-11-11": 15,  // Wednesday (included)
    };

    const weekXp = calculateWeeklyXp(xpByDay, fixedNow);
    expect(weekXp).toBe(65); // 30 + 20 + 15 = 65 (excludes 100 from Sunday)
  });

  it("calculates weekly league accurately and safe against empty xpByDay", () => {
    const xpByDayEmpty: Record<string, number> = {};
    const weekXp = calculateWeeklyXp(xpByDayEmpty);
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

  it("truthfully suppresses rank when league response is empty, never claiming an unsupported rank #1", () => {
    const state = computeLeaderboardState({
      status: "empty",
      remote: [],
      user: { id: "user-123", displayName: "AL", avatar: "👤" },
      weekXp: 50,
    });

    expect(state.myRank).toBeNull();
    expect(state.subtitle).not.toContain("#1");
    expect(state.subtitle).toContain("reset every Monday at 00:00 UTC");
  });

  it("sorts learner row into genuine peers accurately with opt-in wording without exposing private fields", () => {
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
    expect(state.subtitle).toContain("You're #2 of 3 participating learners this week with 50 XP.");
    expect(state.subtitle).toContain("Standings reflect opted-in learners");

    // Verify zero private fields (user_id, username, email, token, password) leak
    for (const r of state.rows) {
      const item = r as unknown as Record<string, unknown>;
      expect(item.user_id).toBeUndefined();
      expect(item.username).toBeUndefined();
      expect(item.email).toBeUndefined();
      expect(item.token).toBeUndefined();
      expect(item.password).toBeUndefined();
    }
  });
});
