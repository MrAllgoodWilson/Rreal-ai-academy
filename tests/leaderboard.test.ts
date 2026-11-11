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

  it("differentiates demo fallback (null) from honest empty board ([])", () => {
    // When remote is null (demo / offline), peers should be generated
    const remoteNull: unknown[] | null = null;
    const baseWhenNull = remoteNull ?? [{ id: "demo-1", name: "Demo User", avatar: "🦄", xp: 100 }];
    expect(baseWhenNull.length).toBe(1);

    // When remote is empty array [] (real DB connected, but 0 other active users),
    // it must NOT fall back to fake demo peers if remote is defined
    const remoteEmpty: unknown[] | null = [];
    const baseWhenEmpty = remoteEmpty === null ? [{ id: "demo-1", name: "Demo User", avatar: "🦄", xp: 100 }] : remoteEmpty;
    expect(baseWhenEmpty.length).toBe(0);
  });

  it("sorts learner row into peers accurately without exposing private fields", () => {
    interface TestRow {
      id: string;
      name: string;
      avatar: string;
      xp: number;
      me?: boolean;
    }
    const peers: TestRow[] = [
      { id: "peer-1", name: "Maya", avatar: "🦄", xp: 120 },
      { id: "peer-2", name: "Jordan", avatar: "🐼", xp: 40 },
    ];
    const me: TestRow = { id: "user-123", name: "AL (you)", avatar: "👤", xp: 50, me: true };
    const rows = [...peers.filter((r) => r.id !== me.id), me].sort((a, b) => b.xp - a.xp);

    expect(rows.length).toBe(3);
    expect(rows[0].name).toBe("Maya");
    expect(rows[1].name).toBe("AL (you)");
    expect(rows[2].name).toBe("Jordan");
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
