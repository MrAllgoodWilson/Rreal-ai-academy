/** Deterministic, offline content generators for the Social Video Studio. */

export type Platform = "TikTok" | "Instagram Reels" | "YouTube Shorts";

export interface Scene {
  id: string;
  seconds: number;
  caption: string;
  voiceover: string;
  visual: string;
  emoji: string;
}

const HOOKS = [
  (n: string, a: string) => `Stop scrolling if you're ${a} who wants to win at ${n}.`,
  (n: string) => `Nobody talks about this ${n} trick.`,
  (n: string) => `I tried 30 days of ${n} with AI. Here's what happened.`,
  (n: string) => `You're doing ${n} wrong if you skip this.`,
  (n: string) => `3 free AI tools that make ${n} feel unfair.`,
  (n: string) => `Stop overthinking ${n}. Do this instead.`,
  (n: string, a: string) => `If you're ${a}, this ${n} hack saves you hours.`,
  (n: string) => `The 10-second ${n} rule that changed everything.`,
  (n: string) => `POV: you finally figured out ${n}.`,
  (n: string) => `Here's the ${n} mistake I made so you don't have to.`,
];

const EMOJI = ["⚡", "🎯", "🚀", "💡", "🔥", "✨", "🧠", "📈"];

export function generateHooks(niche: string, audience: string, seed = 0): string[] {
  const n = niche.trim() || "content creation";
  const a = audience.trim() || "a busy beginner";
  const out: string[] = [];
  for (let i = 0; i < 6; i++) out.push(HOOKS[(i + seed) % HOOKS.length](n, a));
  return out;
}

export function generateScript(hook: string, niche: string, cta: string): Scene[] {
  const n = niche.trim() || "your niche";
  const id = () => Math.random().toString(36).slice(2, 9);
  return [
    { id: id(), seconds: 2, caption: hook, voiceover: hook, visual: `Close-up, fast push-in on creator's face, bold text, ${n} context`, emoji: "👀" },
    { id: id(), seconds: 5, caption: `Step 1: Start with one clear goal`, voiceover: `Step one. Pick one clear goal for ${n} — just one.`, visual: "Screen recording or B-roll, zoom on key detail", emoji: EMOJI[0] },
    { id: id(), seconds: 5, caption: `Step 2: Let AI draft it in seconds`, voiceover: `Step two. Give AI a role, your audience and a format. It drafts in seconds.`, visual: "Split screen: prompt typing / result appearing", emoji: EMOJI[2] },
    { id: id(), seconds: 5, caption: `Step 3: You edit. You stay the pilot.`, voiceover: `Step three. You edit and add your voice. AI is the co-pilot, you're the pilot.`, visual: "Hands editing on phone, warm light", emoji: EMOJI[3] },
    { id: id(), seconds: 3, caption: cta || "Follow for part 2", voiceover: cta || "Follow for part two.", visual: "Creator points to follow button, end card", emoji: "👉" },
  ];
}

export const totalSeconds = (s: Scene[]) => s.reduce((a, x) => a + x.seconds, 0);

/** RFC 5545 calendar file for the posting schedule. */
export function toICS(posts: { title: string; description: string; start: Date }[]) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => "\\" + m);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rreal AI Academy//Studio//EN", "CALSCALE:GREGORIAN"];
  posts.forEach((p, i) => {
    const end = new Date(p.start.getTime() + 15 * 60_000);
    lines.push("BEGIN:VEVENT", `UID:rreal-${p.start.getTime()}-${i}@rreal.academy`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(p.start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(p.title)}`, `DESCRIPTION:${esc(p.description)}`, "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Time to post!", "END:VALARM", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
