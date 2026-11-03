import { describe, expect, it } from "vitest";
import { ALL_LESSONS, TRACKS, lockReason, nextLesson } from "@/lib/curriculum";
import { toICS } from "@/lib/studio";
import { offlineCoach } from "@/lib/coach-offline";

describe("curriculum integrity", () => {
  it("has 5 tracks spanning 8 weeks", () => {
    expect(TRACKS).toHaveLength(5);
    expect(new Set(TRACKS.flatMap((t) => t.weeks.map((w) => w.number)))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  });
  it("has unique lesson and quiz ids, and valid answers", () => {
    const ids = ALL_LESSONS.map((r) => r.lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    const quizzes = ALL_LESSONS.flatMap((r) => r.lesson.blocks).filter((b) => b.type === "quiz");
    expect(new Set(quizzes.map((q) => (q as { id: string }).id)).size).toBe(quizzes.length);
    for (const q of quizzes) if (q.type === "quiz") expect(q.answer).toBeLessThan(q.options.length);
  });
});

describe("gating", () => {
  const first = ALL_LESSONS[0].lesson.id;
  const second = ALL_LESSONS[1].lesson.id;
  const week2 = ALL_LESSONS.find((r) => r.week.number === 2)!.lesson.id;
  const t3 = ALL_LESSONS.find((r) => r.track.level === 3)!.lesson.id;
  it("first lesson is open and free", () => expect(lockReason(first, {}, { subscribed: false })).toBeNull());
  it("requires prerequisites", () => expect(lockReason(second, {}, { subscribed: false })).toBe("prerequisite"));
  it("requires subscription after week 1", () => expect(lockReason(week2, {}, { subscribed: false })).toBe("subscription"));
  it("placement unlocks a later track start", () => {
    expect(lockReason(t3, {}, { subscribed: true, placementLevel: 1 })).toBe("prerequisite");
    expect(lockReason(t3, {}, { subscribed: true, placementLevel: 3 })).toBeNull();
  });
  it("nextLesson walks the path", () => expect(nextLesson({ [first]: true })?.lesson.id).toBe(second));
});

describe("studio + coach", () => {
  it("exports a valid ICS calendar", () => {
    const ics = toICS([{ title: "Post, now; please", description: "line1\nline2", start: new Date("2026-11-05T18:00:00Z") }]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261105T180000Z");
    expect(ics).toContain("SUMMARY:Post\\, now\\; please");
  });
  it("offline coach grades prompts and runs quizzes", () => {
    expect(offlineCoach({ mode: "grade", messages: [{ role: "user", content: "write about dogs" }] }).reply).toMatch(/scores \d+ out of 100/);
    const q = offlineCoach({ mode: "quiz", messages: [{ role: "user", content: "start" }] });
    expect(q.pendingQuizId).toBeTruthy();
    const ans = offlineCoach({ mode: "quiz", messages: [{ role: "user", content: "B" }], pendingQuizId: "q-ai-1" });
    expect(ans.reply).toMatch(/Correct/);
  });
});
