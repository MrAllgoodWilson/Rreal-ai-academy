/** Pure, framework-free gamification rules. Shared by client store, server RPC mirrors and tests. */

export const LEVELS = [0, 100, 250, 500, 850, 1300, 1900, 2600, 3500, 4600, 6000, 7600, 9500, 12000];

export function levelForXp(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) level = i + 1;
  if (xp >= LEVELS[LEVELS.length - 1]) level += Math.floor((xp - LEVELS[LEVELS.length - 1]) / 3000);
  const floor = level - 1 < LEVELS.length ? LEVELS[level - 1] : LEVELS[LEVELS.length - 1] + (level - LEVELS.length) * 3000;
  const ceil = level < LEVELS.length ? LEVELS[level] : floor + 3000;
  return { level, floor, ceil, pct: Math.min(100, Math.round(((xp - floor) / (ceil - floor)) * 100)) };
}

export const LEVEL_TITLES = ["Curious Human", "Prompt Rookie", "Prompt Crafter", "Creator", "Producer", "Automator", "Builder", "Integrator", "Agent Wrangler", "Architect", "AI Elite", "AI Legend"];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

/** YYYY-MM-DD in the learner's local timezone */
export function dayKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export interface StreakState {
  current: number;
  longest: number;
  lastActive: string | null;
  freezes: number;
}

/**
 * Record activity for `today`. Missing days are covered by streak freezes if available
 * (one freeze per missed day), otherwise the streak resets to 1.
 */
export function applyActivity(s: StreakState, today: string): StreakState & { usedFreezes: number; extended: boolean } {
  if (!s.lastActive) return { ...s, current: 1, longest: Math.max(1, s.longest), lastActive: today, usedFreezes: 0, extended: true };
  const gap = daysBetween(s.lastActive, today);
  if (gap <= 0) return { ...s, usedFreezes: 0, extended: false };
  if (gap === 1) {
    const current = s.current + 1;
    return { ...s, current, longest: Math.max(current, s.longest), lastActive: today, usedFreezes: 0, extended: true };
  }
  const missed = gap - 1;
  if (missed <= s.freezes) {
    const current = s.current + 1;
    return { current, longest: Math.max(current, s.longest), lastActive: today, freezes: s.freezes - missed, usedFreezes: missed, extended: true };
  }
  return { ...s, current: 1, lastActive: today, usedFreezes: 0, extended: true };
}

/** Streak is "at risk" when the learner was active yesterday but not yet today. */
export function streakStatus(s: StreakState, today: string): "safe" | "at-risk" | "broken" | "none" {
  if (!s.lastActive || s.current === 0) return "none";
  const gap = daysBetween(s.lastActive, today);
  if (gap <= 0) return "safe";
  if (gap === 1) return "at-risk";
  return gap - 1 <= s.freezes ? "at-risk" : "broken";
}

/** Streak bonus multiplier: +10% per 7-day block, capped at +50% */
export const streakMultiplier = (streak: number) => 1 + Math.min(0.5, Math.floor(streak / 7) * 0.1);

export const LEAGUES = [
  { id: "bronze", name: "Bronze", min: 0, color: "#cd7f32" },
  { id: "silver", name: "Silver", min: 300, color: "#c0c0c0" },
  { id: "gold", name: "Gold", min: 800, color: "#ffd700" },
  { id: "platinum", name: "Platinum", min: 1500, color: "#7ee8fa" },
  { id: "diamond", name: "Diamond", min: 2500, color: "#b9f2ff" },
] as const;
export const leagueFor = (weeklyXp: number) => [...LEAGUES].reverse().find((l) => weeklyXp >= l.min) ?? LEAGUES[0];
