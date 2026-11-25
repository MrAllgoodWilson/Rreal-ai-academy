import { describe, expect, it } from "vitest";
import { COURSES } from "@/lib/curriculum/courses";
import { lockReason } from "@/lib/curriculum";
const track = COURSES.find(t => t.id === "c-smartphone-foundations")!;
const rows = track.weeks.flatMap(w => w.modules.flatMap(m => m.lessons.map(lesson => ({ week: w.number, lesson }))));
describe("reviewed smartphone course", () => {
  it("contains12 distinct lessons across8 weeks with safe practice anatomy", () => {
    expect(rows).toHaveLength(12);
    expect(track.weeks.map(w => w.modules.flatMap(m => m.lessons).length)).toEqual([3,2,2,1,1,1,1,1]);
    expect(new Set(rows.map(r => r.lesson.id)).size).toBe(12);
    for (const { lesson } of rows) {
      expect(lesson.blocks.length).toBeGreaterThanOrEqual(4);
      expect(lesson.blocks.length).toBeLessThanOrEqual(6);
      const quiz = lesson.blocks.filter(b => b.type === "quiz");
      expect(quiz).toHaveLength(1);
      expect(quiz[0].options).toHaveLength(4);
      expect(Number.isInteger(quiz[0].answer)).toBe(true);
      expect(quiz[0].answer).toBeGreaterThanOrEqual(0);
      expect(quiz[0].answer).toBeLessThan(4);
      expect(lesson.blocks.filter(b => b.type === "prompt-lab")).toHaveLength(1);
    }
  });
  it("enforces membership and week2 timing while preserving a free local practice path", () => {
    expect(lockReason("phone-identify", {}, { subscribed: false })).not.toBeNull();
    expect(lockReason("phone-identify", {}, { subscribed: true })).toBeNull();
    const progress = Object.fromEntries(rows.filter(r => r.week === 1).map(r => [r.lesson.id, { at: new Date(Date.now() - 86400000).toISOString() }]));
    expect(lockReason("phone-communication", progress, { subscribed: true })).toBe("scheduled");
    expect(JSON.stringify(rows)).toContain("No cloud speech, AI subscription, new account or paid Rreal generation is required");
  });
});
