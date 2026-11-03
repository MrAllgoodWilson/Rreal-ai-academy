import { describe, expect, it } from "vitest";
import { ALL_LESSONS, ALL_TRACKS, PLAYBOOKS, TRACKS, lessonsForTrack, lockReason, nextLesson, registerTracks } from "@/lib/curriculum";
import { toICS } from "@/lib/studio";
import { offlineCoach } from "@/lib/coach-offline";

describe("curriculum integrity", () => {
  it("has 5 tracks spanning 8 weeks", () => {
    expect(TRACKS).toHaveLength(5);
    expect(new Set(TRACKS.flatMap((t) => t.weeks.map((w) => w.number)))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  });
  it("has unique lesson and quiz ids, and valid answers (program + courses)", () => {
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
  const t3 = ALL_LESSONS.find((r) => r.track.level === 3 && r.track.kind === "program")!.lesson.id;
  const courseFirst = lessonsForTrack("c-website-nocode")[0].lesson.id;
  const courseSecond = lessonsForTrack("c-website-nocode")[1].lesson.id;
  it("everything requires a membership ($1/month)", () => {
    expect(lockReason(first, {}, { subscribed: false })).toBe("subscription");
    expect(lockReason(courseFirst, {}, { subscribed: false })).toBe("subscription");
  });
  it("first lesson open for members", () => expect(lockReason(first, {}, { subscribed: true })).toBeNull());
  it("program requires prerequisites", () => expect(lockReason(second, {}, { subscribed: true })).toBe("prerequisite"));
  it("placement unlocks a later program track", () => {
    expect(lockReason(t3, {}, { subscribed: true, placementLevel: 1 })).toBe("prerequisite");
    expect(lockReason(t3, {}, { subscribed: true, placementLevel: 3 })).toBeNull();
  });
  it("standalone courses start independently and unlock in order", () => {
    expect(lockReason(courseFirst, {}, { subscribed: true })).toBeNull();
    expect(lockReason(courseSecond, {}, { subscribed: true })).toBe("prerequisite");
    expect(lockReason(courseSecond, { [courseFirst]: true }, { subscribed: true })).toBeNull();
  });
  it("nextLesson walks the program path", () => expect(nextLesson({ [first]: true })?.lesson.id).toBe(second));
});

describe("catalog", () => {
  it("has 12 standalone courses spanning all 5 levels", () => {
    const courses = ALL_TRACKS.filter((t) => t.kind === "course");
    expect(courses.length).toBe(12);
    expect(new Set(courses.map((c) => c.level))).toEqual(new Set([1, 2, 3, 4, 5]));
  });
  it("playbooks list tools and steps", () => {
    expect(PLAYBOOKS.length).toBeGreaterThanOrEqual(10);
    for (const p of PLAYBOOKS) {
      expect(p.tools.some((t) => t.required)).toBe(true);
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("registerTracks adds custom courses idempotently", () => {
    const before = ALL_LESSONS.length;
    const custom = { ...ALL_TRACKS.find((t) => t.id === "c-ai-dummies")!, id: "u-test-x", kind: "custom" as const, weeks: [{ number: 1, title: "x", modules: [{ id: "u-test-x-m1", title: "x", description: "x", lessons: [{ id: "u-test-x-l1", title: "L", minutes: 5, xp: 50, summary: "s", blocks: [] }] }] }] };
    registerTracks([custom]);
    registerTracks([custom]);
    expect(ALL_LESSONS.length).toBe(before + 1);
    expect(lockReason("u-test-x-l1", {}, { subscribed: true })).toBeNull();
  });
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
