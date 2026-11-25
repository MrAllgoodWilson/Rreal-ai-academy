import type { Track } from "./types";
import rawData from "./data/manus-diy-100.json";

/**
 * 100 DIY & Maker Courses generated from verified Manus package.
 * Each course has 4 structured lessons, quizzes, steps, and safety notes.
 * All courses are gated under the USD 1/month membership.
 */
export const MANUS_DIY_COURSES: Track[] = rawData as Track[];
