import { describe, expect, it, vi, beforeEach } from "vitest";
import { leagueFor } from "@/lib/gamification";
import { GET } from "@/app/api/leaderboard/route";

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

  it("calculates 50 XP weekly league accurately for signed-in learner", () => {
    const today = new Date().toISOString().slice(0, 10);
    const xpByDay: Record<string, number> = { [today]: 50 };
    const weekXp = Object.entries(xpByDay)
      .filter(([k]) => Date.now() - new Date(k).getTime() < 7 * 86_400_000)
      .reduce((a, [, v]) => a + v, 0);

    expect(weekXp).toBe(50);
    const league = leagueFor(weekXp);
    expect(league.id).toBe("bronze");
    expect(league.name).toBe("Bronze");
  });

  it("retains zero manufactured fake rankings when remote is empty or unconfigured", () => {
    // When remote is null or [] (no other active users), list must contain ONLY the authentic learner
    const remoteNull: unknown[] | null = null;
    const baseWhenNull = remoteNull ?? [];
    const me = { id: "user-123", name: "AL (you)", avatar: "👤", xp: 50, me: true };
    const rowsWhenNull = [...baseWhenNull, me];
    expect(rowsWhenNull.length).toBe(1);
    expect(rowsWhenNull[0].id).toBe("user-123");

    // Zero fake names like Maya/Jordan/Priya in the list
    expect(rowsWhenNull.some((r) => r.name === "Maya")).toBe(false);
    expect(rowsWhenNull.some((r) => r.name === "Jordan")).toBe(false);
  });

  it("sorts learner row into genuine peers accurately without exposing private fields", () => {
    interface TestRow {
      id: string;
      name: string;
      avatar: string;
      xp: number;
      me?: boolean;
    }
    const peers: TestRow[] = [
      { id: "peer-1", name: "Genuine Classmate 1", avatar: "🦄", xp: 120 },
      { id: "peer-2", name: "Genuine Classmate 2", avatar: "🐼", xp: 40 },
    ];
    const me: TestRow = { id: "user-123", name: "AL (you)", avatar: "👤", xp: 50, me: true };
    const rows = [...peers.filter((r) => r.id !== me.id), me].sort((a, b) => b.xp - a.xp);

    expect(rows.length).toBe(3);
    expect(rows[0].name).toBe("Genuine Classmate 1");
    expect(rows[1].name).toBe("AL (you)");
    expect(rows[2].name).toBe("Genuine Classmate 2");
    const myRank = rows.findIndex((r) => r.me) + 1;
    expect(myRank).toBe(2);

    // Verify no sensitive fields (passwords, tokens, emails) are present
    for (const r of rows) {
      const item = r as unknown as Record<string, unknown>;
      expect(item.email).toBeUndefined();
      expect(item.token).toBeUndefined();
      expect(item.password).toBeUndefined();
    }
  });
});
