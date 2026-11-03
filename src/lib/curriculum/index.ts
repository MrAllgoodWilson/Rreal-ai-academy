import { TRACKS } from "./tracks";
import type { Block, Lesson, Module, Track, Week } from "./types";

export { TRACKS };
export type { Block, Lesson, Module, Track, Week };

export interface LessonRef {
  lesson: Lesson;
  module: Module;
  week: Week;
  track: Track;
  /** Position in the global learning path (0-based) */
  index: number;
}

/** Week 1 is the free preview. Everything else needs an active subscription/trial. */
export const FREE_WEEKS = new Set([1]);

export const ALL_LESSONS: LessonRef[] = (() => {
  const out: LessonRef[] = [];
  for (const track of TRACKS)
    for (const week of track.weeks)
      for (const mod of week.modules)
        for (const lesson of mod.lessons) out.push({ lesson, module: mod, week, track, index: out.length });
  return out;
})();

const byId = new Map(ALL_LESSONS.map((r) => [r.lesson.id, r]));

export const getLessonRef = (id: string) => byId.get(id);
export const getTrack = (id: string) => TRACKS.find((t) => t.id === id);
export const lessonsForTrack = (trackId: string) => ALL_LESSONS.filter((r) => r.track.id === trackId);
export const TOTAL_WEEKS = Math.max(...TRACKS.flatMap((t) => t.weeks.map((w) => w.number)));

export function isFreeLesson(id: string) {
  const ref = byId.get(id);
  return !!ref && FREE_WEEKS.has(ref.week.number);
}

export type LockReason = "subscription" | "prerequisite" | null;

/**
 * Gating logic:
 *  1. Paid content needs an active subscription or trial.
 *  2. Lessons unlock in order. A placement result lets learners start
 *     at a higher track (the first lesson of any track <= placementLevel is open).
 */
export function lockReason(
  id: string,
  completed: Record<string, unknown>,
  opts: { subscribed: boolean; placementLevel?: number },
): LockReason {
  const ref = byId.get(id);
  if (!ref) return "prerequisite";
  if (!FREE_WEEKS.has(ref.week.number) && !opts.subscribed) return "subscription";
  if (ref.index === 0) return null;
  const prev = ALL_LESSONS[ref.index - 1];
  if (completed[prev.lesson.id]) return null;
  const firstInTrack = lessonsForTrack(ref.track.id)[0];
  if (firstInTrack.lesson.id === id && (opts.placementLevel ?? 1) >= ref.track.level) return null;
  // Placement can also open later lessons in a skipped-into track once its previous lesson is done
  if (prev.track.id !== ref.track.id && (opts.placementLevel ?? 1) >= ref.track.level) return null;
  return "prerequisite";
}

export function trackProgress(trackId: string, completed: Record<string, unknown>) {
  const lessons = lessonsForTrack(trackId);
  const done = lessons.filter((r) => completed[r.lesson.id]).length;
  return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}

export function nextLesson(completed: Record<string, unknown>) {
  return ALL_LESSONS.find((r) => !completed[r.lesson.id]);
}

export function quizBlocks(lessonId: string) {
  const ref = byId.get(lessonId);
  return (ref?.lesson.blocks.filter((b) => b.type === "quiz") ?? []) as Extract<Block, { type: "quiz" }>[];
}
