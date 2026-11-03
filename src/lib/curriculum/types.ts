export type Block =
  | { type: "text"; heading?: string; body: string }
  | { type: "keypoints"; heading?: string; items: string[] }
  | { type: "tip"; body: string }
  | { type: "example"; label: string; bad?: string; good: string }
  | {
      type: "quiz";
      id: string;
      question: string;
      options: string[];
      answer: number;
      explanation: string;
    }
  | {
      type: "prompt-lab";
      goal: string;
      starter?: string;
      /** Minimum Prompt Quality Score (0-100) needed to pass this lab */
      minScore: number;
    }
  | { type: "reflect"; prompt: string };

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  xp: number;
  summary: string;
  blocks: Block[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Week {
  number: number;
  title: string;
  modules: Module[];
}

export type TrackLevel = 1 | 2 | 3 | 4 | 5;

export interface Track {
  id: string;
  level: TrackLevel;
  stage: string;
  name: string;
  tagline: string;
  outcome: string;
  /** Tailwind gradient classes */
  gradient: string;
  emoji: string;
  certificateTitle: string;
  weeks: Week[];
}
