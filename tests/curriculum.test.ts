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
    // Check raw data: the runtime index deliberately skips duplicate lesson IDs.
    const raw = ALL_TRACKS.flatMap((t) => t.weeks.flatMap((w) => w.modules.flatMap((m) => m.lessons)));
    const ids = raw.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    const quizzes = raw.flatMap((lesson) => lesson.blocks).filter((b) => b.type === "quiz");
    expect(new Set(quizzes.map((q) => (q as { id: string }).id)).size).toBe(quizzes.length);
    for (const q of quizzes) if (q.type === "quiz") expect(q.answer).toBeLessThan(q.options.length);
  });
});

describe("reviewed weekly course extension", () => {
  const cases = [
    { id: "c-ai-dummies", prefix: "dum-w", old: ["dum-sign-up", "dum-everyday", "dum-safety"] },
    { id: "c-small-business", prefix: "sb-w", old: ["sb-marketing", "sb-service", "sb-admin"] },
    { id: "c-faceless-video", prefix: "fv-w", old: ["fv-niche", "fv-produce", "fv-grow"] },
  ];
  const extensions = cases.flatMap((c) => lessonsForTrack(c.id).filter((r) => r.lesson.id.startsWith(c.prefix)));
  it("preserves each original module and provides ten lessons across eight weeks", () => {
    for (const c of cases) {
      const course = ALL_TRACKS.find((t) => t.id === c.id)!;
      expect(course.weeks[0].modules[0].id).toBe(`${c.id}-m1`);
      expect(course.weeks[0].modules[0].lessons.map((l) => l.id)).toEqual(c.old);
      expect(course.weeks.map((w) => w.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(lessonsForTrack(c.id)).toHaveLength(10);
      for (const w of course.weeks.slice(1)) expect(w.modules.flatMap((m) => m.lessons)).toHaveLength(1);
    }
  });
  it("each new lesson has one four-option quiz and one prompt lab in 4–6 blocks", () => {
    expect(extensions).toHaveLength(21);
    for (const { lesson } of extensions) {
      expect(lesson.blocks.length).toBeGreaterThanOrEqual(4);
      expect(lesson.blocks.length).toBeLessThanOrEqual(6);
      const quizzes = lesson.blocks.filter((b) => b.type === "quiz");
      expect(quizzes).toHaveLength(1);
      for (const q of quizzes) if (q.type === "quiz") {
        expect(q.options).toHaveLength(4);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(4);
      }
      expect(lesson.blocks.filter((b) => b.type === "prompt-lab")).toHaveLength(1);
    }
  });
  it("enforces the seven-day boundary for the new standalone week", () => {
    const start = Date.UTC(2026, 10, 4);
    for (const c of cases) {
      const completed = Object.fromEntries(c.old.map((id) => [id, { at: new Date(start).toISOString() }]));
      const next = lessonsForTrack(c.id).find((r) => r.week.number === 2)!.lesson.id;
      expect(lockReason(next, completed, { subscribed: true, now: start + 7 * 86_400_000 - 1 })).toBe("scheduled");
      expect(lockReason(next, completed, { subscribed: true, now: start + 7 * 86_400_000 })).toBeNull();
      expect(lockReason(next, completed, { subscribed: false, now: start + 8 * 86_400_000 })).toBe("subscription");
    }
  });
  it("keeps the final week closed until day 49 and still requires the preceding lesson", () => {
    const start = Date.UTC(2026, 10, 4);
    for (const c of cases) {
      const refs = lessonsForTrack(c.id);
      const completed = Object.fromEntries(refs.filter((r) => r.week.number < 8).map((r) => [r.lesson.id, { at: new Date(start).toISOString() }]));
      const last = refs.find((r) => r.week.number === 8)!.lesson.id;
      expect(lockReason(last, completed, { subscribed: true, now: start + 49 * 86_400_000 - 1 })).toBe("scheduled");
      expect(lockReason(last, completed, { subscribed: true, now: start + 49 * 86_400_000 })).toBeNull();
      delete completed[refs.find((r) => r.week.number === 7)!.lesson.id];
      expect(lockReason(last, completed, { subscribed: true, now: start + 49 * 86_400_000 })).toBe("prerequisite");
    }
  });
  it("includes bounded iFilms tips in all new video lessons", () => {
    const video = extensions.filter((r) => r.track.id === "c-faceless-video");
    expect(video).toHaveLength(7);
    for (const { lesson } of video) {
      const tips = lesson.blocks.filter((b) => b.type === "tip");
      expect(tips.some((b) => b.type === "tip" && b.body.includes("https://ifilmsstudio.pics"))).toBe(true);
      expect(tips.some((b) => b.type === "tip" && b.body.includes("keep your cut"))).toBe(false);
    }
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
  it("has 14 standalone courses spanning all 5 levels", () => {
    const courses = ALL_TRACKS.filter((t) => t.kind === "course");
    expect(courses.length).toBe(14);
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

describe("weekly release schedule", () => {
  const prog = ALL_LESSONS.filter((r) => r.track.kind === "program");
  const w1 = prog.filter((r) => r.week.number === 1);
  const w2first = prog.find((r) => r.week.number === 2)!.lesson.id;
  const done = (days: number) => Object.fromEntries(w1.map((r) => [r.lesson.id, { at: new Date(Date.now() - days * 86_400_000).toISOString() }]));
  it("locks week 2 until 7 days after starting", () => expect(lockReason(w2first, done(1), { subscribed: true })).toBe("scheduled"));
  it("opens week 2 after 7 days", () => expect(lockReason(w2first, done(8), { subscribed: true })).toBeNull());
});
