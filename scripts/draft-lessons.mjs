#!/usr/bin/env node
/**
 * Draft new lessons for a course with a FREE local model (Ollama on Blackie), so expanding courses to 2–3 months
 * doesn't burn paid tokens. Output is a DRAFT for review: a human or Claude checks facts, then pastes approved
 * lessons into src/lib/curriculum/courses.ts and runs `npm run db:seed`.
 *
 *   node scripts/draft-lessons.mjs --course "AI Voice, Podcasts & Music" --topics "Mixing basics;Release checklist" [--model llama3.1:8b]
 *
 * Env: OLLAMA_URL (default http://localhost:11434). Writes drafts/<slug>-<timestamp>.json
 * On Blackie's CPU an 8B model takes several minutes per lesson: run it overnight for big batches.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const course = arg("course");
const topics = (arg("topics") || "").split(";").map((s) => s.trim()).filter(Boolean);
const model = arg("model", "llama3.1:8b");
const base = process.env.OLLAMA_URL || "http://localhost:11434";
if (!course || !topics.length) { console.error('Usage: --course "<name>" --topics "Topic A;Topic B"'); process.exit(1); }

const SYSTEM = `You write lessons for Rreal AI Academy (beginner-friendly, accurate, plain language, no hype, never invent statistics).
Return ONLY JSON: {"title": string, "minutes": number (6-15), "summary": string (<=90 chars),
"blocks": [ {"type":"text","heading":string,"body":string} | {"type":"keypoints","heading":string,"items":string[]} |
{"type":"tip","body":string} | {"type":"quiz","question":string,"options":[4 strings],"answer":0-3,"explanation":string} |
{"type":"prompt-lab","goal":string,"minScore":60-80} ]}. Use 4-6 blocks and include exactly one quiz and one prompt-lab.`;

const slug = course.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const out = [];
for (const topic of topics) {
  process.stdout.write(`Drafting "${topic}" with ${model}… `);
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, stream: true, format: "json", options: { temperature: 0.4 }, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `Course: ${course}\nLesson topic: ${topic}` }] }),
  });
  if (!res.ok || !res.body) { console.log(`failed (${res.status})`); continue; }
  // Stream tokens so slow CPU generation never hits fetch's header timeout.
  let content = "";
  let buf = "";
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) content += JSON.parse(line).message?.content ?? "";
    }
  }
  const j = { message: { content } };
  try {
    const lesson = JSON.parse(j.message?.content ?? "");
    const ok = Array.isArray(lesson.blocks) && lesson.blocks.some((b) => b.type === "quiz") && lesson.title;
    out.push({ topic, needsReview: true, valid: Boolean(ok), lesson });
    console.log(ok ? "ok" : "needs fixing");
  } catch {
    out.push({ topic, needsReview: true, valid: false, raw: j.message?.content });
    console.log("not JSON (kept raw)");
  }
}
mkdirSync("drafts", { recursive: true });
const file = `drafts/${slug}-${Date.now()}.json`;
writeFileSync(file, JSON.stringify({ course, model, createdAt: new Date().toISOString(), lessons: out }, null, 2));
console.log(`\nSaved ${out.length} draft(s) to ${file}. Review before publishing.`);
