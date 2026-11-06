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

export type TrackKind = "program" | "course" | "custom";
export type Category = "foundations" | "creative" | "video" | "design" | "web" | "business" | "automation" | "developer" | "career";

export interface Track {
  id: string;
  /** program = the 8-week Mastery Program (sequential across tracks); course = standalone; custom = AI-generated */
  kind?: TrackKind;
  category?: Category;
  language?: "en" | "es";
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

/** Step-by-step creation recipes ("make a TikTok ad", "build a website") with the tools to subscribe to. */
export interface PlaybookTool {
  name: string;
  use: string;
  url: string;
  pricing: "free" | "freemium" | "paid";
  required: boolean;
}

export interface PlaybookStep {
  title: string;
  body: string;
  /** Copy-paste prompt for this step */
  prompt?: string;
}

export interface Playbook {
  id: string;
  title: string;
  category: "video" | "design" | "web" | "audio" | "business";
  level: TrackLevel;
  minutes: number;
  outcome: string;
  emoji: string;
  tools: PlaybookTool[];
  steps: PlaybookStep[];
}
