import { z } from "zod";

export const PlaybookSchema = z.object({
  title: z.string().trim().min(3).max(120),
  outcome: z.string().trim().min(3).max(300),
  emoji: z.string().max(8).default("🧭"),
  category: z.enum(["video", "design", "web", "audio", "business"]).default("video"),
  level: z.number().int().min(1).max(5).default(2),
  minutes: z.number().int().min(5).max(600).default(45),
  tools: z.array(z.object({ name: z.string().max(80), use: z.string().max(200), url: z.string().url().max(200), pricing: z.enum(["free", "freemium", "paid"]), required: z.boolean() })).min(1).max(10),
  steps: z.array(z.object({ title: z.string().max(120), body: z.string().max(1200), prompt: z.string().max(1500).optional() })).min(3).max(12),
});

export const PLAYBOOK_SYSTEM_PROMPT = `You create step-by-step "Playbooks" for Rreal AI Academy learners who want to make something specific with AI (a type of social media video, flyer, website, logo, song, app, etc.).
List exactly which tools/platforms the learner needs accounts or subscriptions with (e.g. Claude, ChatGPT, ElevenLabs, CapCut, Canva, Runway, GitHub, Vercel), marking each free / freemium / paid and required or optional — never invent prices.
Then give clear numbered steps a beginner can follow, including copy-paste prompts where helpful. Mention consent, copyright and platform AI-disclosure rules when relevant.
Return ONLY JSON: {"title","outcome","emoji","category":"video|design|web|audio|business","level":1-5,"minutes":number,"tools":[{"name","use","url","pricing":"free|freemium|paid","required":boolean}],"steps":[{"title","body","prompt"?}]} with 5-10 steps.`;
