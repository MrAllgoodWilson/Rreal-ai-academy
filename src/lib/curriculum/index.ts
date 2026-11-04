import { TRACKS as PROGRAM } from "./tracks";
import { COURSES } from "./courses";
import { PLAYBOOKS, getPlaybook } from "./playbooks";
import type { Block, Lesson, Module, Playbook, Track, Week } from "./types";

export type { Block, Lesson, Module, Playbook, Track, Week };
export { PLAYBOOKS, getPlaybook, COURSES };

/** The 8-week Rreal AI Mastery Program (sequential across its 5 tracks). */
export const TRACKS: Track[] = PROGRAM.map((t) => ({ ...t, kind: "program" as const }));

export interface LessonRef {
  lesson: Lesson;
  module: Module;
  week: Week;
  track: Track;
  /** Position in the global lesson list (0-based) */
  index: number;
}

/** Every track/course the app knows about. Custom (AI-generated) courses are added at runtime via registerTracks. */
export const ALL_TRACKS: Track[] = [...TRACKS, ...COURSES];
export const ALL_LESSONS: LessonRef[] = [];
const byId = new Map<string, LessonRef>();

function index(track: Track) {
  for (const week of track.weeks)
    for (const mod of week.modules)
      for (const lesson of mod.lessons) {
        if (byId.has(lesson.id)) continue;
        const ref: LessonRef = { lesson, module: mod, week, track, index: ALL_LESSONS.length };
        ALL_LESSONS.push(ref);
        byId.set(lesson.id, ref);
      }
}
ALL_TRACKS.forEach(index);

/** Adds AI-generated/custom courses (from the database) to the runtime catalog. Idempotent. */
export function registerTracks(tracks: Track[]) {
  for (const t of tracks) {
    if (ALL_TRACKS.some((x) => x.id === t.id)) continue;
    ALL_TRACKS.push({ ...t, kind: t.kind ?? "custom" });
    index(ALL_TRACKS[ALL_TRACKS.length - 1]);
  }
}

export const getLessonRef = (id: string) => byId.get(id);
export const getTrack = (id: string) => ALL_TRACKS.find((t) => t.id === id);
export const lessonsForTrack = (trackId: string) => ALL_LESSONS.filter((r) => r.track.id === trackId);
export const programLessons = () => ALL_LESSONS.filter((r) => r.track.kind === "program");
export const TOTAL_WEEKS = Math.max(...TRACKS.flatMap((t) => t.weeks.map((w) => w.number)));

export type LockReason = "subscription" | "prerequisite" | "scheduled" | null;

type Completed = Record<string, unknown>;
const completedAt = (v: unknown) => (v && typeof v === "object" && "at" in v ? Date.parse(String((v as { at: string }).at)) : NaN);

/**
 * Weekly release schedule (mirrors week_unlock_at() in SQL): the week a learner starts in opens immediately;
 * each later week opens 7 days after their first completed lesson in that program/course.
 */
export function weekUnlockDate(id: string, completed: Completed): Date | null {
  const ref = byId.get(id);
  if (!ref) return null;
  const siblings = ref.track.kind === "program" ? programLessons() : lessonsForTrack(ref.track.id);
  let first: { at: number; week: number } | null = null;
  for (const r of siblings) {
    const at = completedAt(completed[r.lesson.id]);
    if (!Number.isNaN(at) && (!first || at < first.at)) first = { at, week: r.week.number };
  }
  if (!first || ref.week.number <= first.week) return null;
  return new Date(first.at + (ref.week.number - first.week) * 7 * 86_400_000);
}

/**
 * Gating logic (all content is paid — membership is $1/month):
 *  1. Every lesson needs an active subscription.
 *  2. Mastery Program: lessons unlock in order across tracks; placement lets learners start at a higher track.
 *  3. Standalone & custom courses: lessons unlock in order inside the course; the first lesson is always open.
 */
export function lockReason(id: string, completed: Record<string, unknown>, opts: { subscribed: boolean; placementLevel?: number; now?: number }): LockReason {
  const ref = byId.get(id);
  if (!ref) return "prerequisite";
  if (!opts.subscribed) return "subscription";
  if (!completed[id]) {
    const opensAt = weekUnlockDate(id, completed);
    if (opensAt && opensAt.getTime() > (opts.now ?? Date.now())) return "scheduled";
  }
  const siblings = ref.track.kind === "program" ? programLessons() : lessonsForTrack(ref.track.id);
  const pos = siblings.findIndex((r) => r.lesson.id === id);
  if (pos <= 0) return null;
  const prev = siblings[pos - 1];
  if (completed[prev.lesson.id]) return null;
  if (ref.track.kind === "program" && prev.track.id !== ref.track.id && (opts.placementLevel ?? 1) >= ref.track.level) return null;
  return "prerequisite";
}

export function trackProgress(trackId: string, completed: Record<string, unknown>) {
  const lessons = lessonsForTrack(trackId);
  const done = lessons.filter((r) => completed[r.lesson.id]).length;
  return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}

/** Next lesson in the Mastery Program, or in a specific course when trackId is given. */
export function nextLesson(completed: Record<string, unknown>, trackId?: string) {
  const list = trackId ? lessonsForTrack(trackId) : programLessons();
  return list.find((r) => !completed[r.lesson.id]);
}

/** Courses the learner has started but not finished (most recent first by catalog order). */
export function inProgressTracks(completed: Record<string, unknown>) {
  return ALL_TRACKS.filter((t) => {
    const p = trackProgress(t.id, completed);
    return p.done > 0 && p.done < p.total;
  });
}

export function quizBlocks(lessonId: string) {
  const ref = byId.get(lessonId);
  return (ref?.lesson.blocks.filter((b) => b.type === "quiz") ?? []) as Extract<Block, { type: "quiz" }>[];
}

export const LEVEL_NAMES = ["", "Dummy", "Beginner", "Intermediate", "Advanced", "Expert"] as const;
