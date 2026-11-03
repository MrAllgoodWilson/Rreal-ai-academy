export interface BadgeStats {
  lessonsCompleted: number;
  xp: number;
  streak: number;
  tracksCompleted: string[];
  bestPromptScore: number;
  voiceSessions: number;
  studioSaves: number;
  portfolioCount: number;
  perfectLessons: number;
  certificates: number;
  reviewsDone: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  earned: (s: BadgeStats) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first-steps", name: "First Steps", description: "Complete your first lesson.", emoji: "👣", tier: "bronze", earned: (s) => s.lessonsCompleted >= 1 },
  { id: "on-a-roll", name: "On a Roll", description: "Complete 5 lessons.", emoji: "🎳", tier: "bronze", earned: (s) => s.lessonsCompleted >= 5 },
  { id: "spark", name: "Spark", description: "3-day learning streak.", emoji: "✨", tier: "bronze", earned: (s) => s.streak >= 3 },
  { id: "week-warrior", name: "Week Warrior", description: "7-day learning streak.", emoji: "🔥", tier: "silver", earned: (s) => s.streak >= 7 },
  { id: "unstoppable", name: "Unstoppable", description: "30-day learning streak.", emoji: "🌋", tier: "gold", earned: (s) => s.streak >= 30 },
  { id: "xp-500", name: "Power Up", description: "Earn 500 XP.", emoji: "⚡", tier: "bronze", earned: (s) => s.xp >= 500 },
  { id: "xp-2500", name: "Supercharged", description: "Earn 2,500 XP.", emoji: "🚀", tier: "silver", earned: (s) => s.xp >= 2500 },
  { id: "prompt-pro", name: "Prompt Pro", description: "Score 90+ on the Prompt Quality Score.", emoji: "🎯", tier: "silver", earned: (s) => s.bestPromptScore >= 90 },
  { id: "perfectionist", name: "Perfectionist", description: "Ace 5 lessons with a perfect quiz score.", emoji: "💯", tier: "silver", earned: (s) => s.perfectLessons >= 5 },
  { id: "voice-explorer", name: "Voice Explorer", description: "Talk to Rreal Coach by voice.", emoji: "🎙️", tier: "bronze", earned: (s) => s.voiceSessions >= 1 },
  { id: "director", name: "Director", description: "Save a video project in the Studio.", emoji: "🎬", tier: "silver", earned: (s) => s.studioSaves >= 1 },
  { id: "portfolio-builder", name: "Portfolio Builder", description: "Save 3 items to your portfolio.", emoji: "🗂️", tier: "silver", earned: (s) => s.portfolioCount >= 3 },
  { id: "memory-master", name: "Memory Master", description: "Finish 3 Daily Review sessions.", emoji: "🧠", tier: "silver", earned: (s) => s.reviewsDone >= 3 },
  { id: "track-foundations", name: "Foundations Graduate", description: "Complete AI Foundations.", emoji: "🌱", tier: "gold", earned: (s) => s.tracksCompleted.includes("foundations") },
  { id: "track-creator", name: "Creative Producer", description: "Complete Creative AI Studio.", emoji: "🎨", tier: "gold", earned: (s) => s.tracksCompleted.includes("creator") },
  { id: "track-producer", name: "Video Pipeline Pro", description: "Complete AI Video & Social Automation.", emoji: "🎥", tier: "gold", earned: (s) => s.tracksCompleted.includes("producer") },
  { id: "track-engineer", name: "Integration Specialist", description: "Complete AI Dependencies & Integrations.", emoji: "🛠️", tier: "gold", earned: (s) => s.tracksCompleted.includes("engineer") },
  { id: "track-architect", name: "Agent Architect", description: "Complete Autonomous Agents & Capstone.", emoji: "🏆", tier: "legendary", earned: (s) => s.tracksCompleted.includes("architect") },
  { id: "certified", name: "Rreal Certified", description: "Earn your first verifiable certificate.", emoji: "📜", tier: "gold", earned: (s) => s.certificates >= 1 },
];

export const getBadge = (id: string) => BADGES.find((b) => b.id === id);

export function newlyEarned(stats: BadgeStats, owned: Record<string, unknown>) {
  return BADGES.filter((b) => !owned[b.id] && b.earned(stats));
}
