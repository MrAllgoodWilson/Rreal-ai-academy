import { describe, expect, it } from "vitest";
import { MANUS_DIY_COURSES } from "@/lib/curriculum/manus-diy-courses";
import { lockReason } from "@/lib/curriculum";

describe("Manus 100 DIY Courses Catalog & Gating", () => {
  it("imports exactly 100 DIY tracks", () => {
    expect(MANUS_DIY_COURSES.length).toBe(100);
  });

  it("has exactly 400 total lessons (4 per course)", () => {
    const allLessons = MANUS_DIY_COURSES.flatMap((t) => t.weeks.flatMap((w) => w.modules.flatMap((m) => m.lessons)));
    expect(allLessons.length).toBe(400);

    // Verify all lesson IDs are unique
    const ids = allLessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(400);
  });

  it("verifies all tracks have stable c-diy-* IDs and certificates", () => {
    for (const t of MANUS_DIY_COURSES) {
      expect(t.id).toMatch(/^c-diy-\d{3}$/);
      expect(t.certificateTitle).toContain("Rreal Certified: ");
      expect(t.kind).toBe("course");
      expect(t.level).toBe(2);
    }
  });

  it("verifies quizzes are valid with correct answer boundaries", () => {
    let quizCount = 0;
    const allLessons = MANUS_DIY_COURSES.flatMap((t) => t.weeks.flatMap((w) => w.modules.flatMap((m) => m.lessons)));
    for (const l of allLessons) {
      const quizzes = l.blocks.filter((b) => b.type === "quiz");
      for (const q of quizzes) {
        if (q.type === "quiz") {
          quizCount++;
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.question.length).toBeGreaterThan(5);
        }
      }
    }
    expect(quizCount).toBe(400);
  });

  it("enforces $1/month paid subscriber gating for DIY courses", () => {
    const firstLesson = MANUS_DIY_COURSES[0].weeks[0].modules[0].lessons[0].id;
    // Unsubscribed user is locked with 'subscription'
    expect(lockReason(firstLesson, {}, { subscribed: false })).toBe("subscription");
    // Subscribed user is unlocked
    expect(lockReason(firstLesson, {}, { subscribed: true })).toBeNull();
  });
});
