import { describe, expect, it } from "vitest";
import { applyActivity, daysBetween, levelForXp, streakMultiplier, streakStatus, leagueFor } from "@/lib/gamification";

const s = (current: number, lastActive: string | null, freezes = 1) => ({ current, longest: current, lastActive, freezes });

describe("streaks", () => {
  it("starts at 1", () => expect(applyActivity(s(0, null), "2026-11-03").current).toBe(1));
  it("same day does not double count", () => expect(applyActivity(s(4, "2026-11-03"), "2026-11-03").current).toBe(4));
  it("consecutive day extends", () => expect(applyActivity(s(4, "2026-11-02"), "2026-11-03").current).toBe(5));
  it("freeze covers one missed day", () => {
    const r = applyActivity(s(4, "2026-11-01", 1), "2026-11-03");
    expect(r.current).toBe(5);
    expect(r.freezes).toBe(0);
    expect(r.usedFreezes).toBe(1);
  });
  it("resets when missed days exceed freezes", () => expect(applyActivity(s(9, "2026-10-30", 1), "2026-11-03").current).toBe(1));
  it("handles month/year boundaries", () => expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1));
  it("flags at-risk streaks", () => {
    expect(streakStatus(s(3, "2026-11-02"), "2026-11-03")).toBe("at-risk");
    expect(streakStatus(s(3, "2026-11-03"), "2026-11-03")).toBe("safe");
    expect(streakStatus(s(3, "2026-10-20", 0), "2026-11-03")).toBe("broken");
  });
});

describe("xp & levels", () => {
  it("level 1 at 0 xp", () => expect(levelForXp(0)).toMatchObject({ level: 1, pct: 0 }));
  it("level 2 at 100 xp", () => expect(levelForXp(100).level).toBe(2));
  it("keeps leveling past the table", () => expect(levelForXp(20000).level).toBeGreaterThan(14));
  it("streak multiplier caps at +50%", () => {
    expect(streakMultiplier(6)).toBe(1);
    expect(streakMultiplier(7)).toBeCloseTo(1.1);
    expect(streakMultiplier(100)).toBe(1.5);
  });
  it("leagues", () => expect(leagueFor(900).name).toBe("Gold"));
});
