import { ALL_LESSONS, getLessonRef, quizBlocks } from "@/lib/curriculum";
import { gradePrompt } from "@/lib/prompt-grader";

export type CoachMode = "chat" | "quiz" | "grade" | "interview";
export interface CoachMessage { role: "user" | "assistant"; content: string }
export interface CoachRequest { messages: CoachMessage[]; mode: CoachMode; lessonId?: string; pendingQuizId?: string }
export interface CoachReply { reply: string; pendingQuizId?: string; mode: "live" | "offline" }

const KB: [RegExp, string][] = [
  [/\b(what is|explain).*(ai|llm|language model)\b|\bhow does (ai|chatgpt|claude) work/i, "Think of a large language model as a super-powered autocomplete. It learned patterns from a huge amount of text, and it writes answers by predicting the most helpful next words, one piece at a time. That's why clear instructions matter so much: the more context you give, the better its predictions."],
  [/\bprompt/i, "Use the R.E.A.L. framework: Role, Expectation, Audience, Layout. For example: 'You are a fitness coach. Write a 5-day beginner workout plan for a busy parent with no equipment, as a table with 20-minute sessions.' Want me to grade a prompt? Switch to Grade mode and paste it."],
  [/\bhook/i, "Hooks win in the first two seconds. Try a result-first hook — 'I made 30 videos in 10 minutes, here's how' — or a contrarian one — 'Stop posting every day. Do this instead.' Keep it under 12 words and make the first frame match the words."],
  [/\b(video|reel|tiktok|short)/i, "For short-form video: vertical 9:16, hook in two seconds, a visual change every three to five seconds, burned-in captions in the center safe zone, and one clear call to action. Open the Studio to build one step by step."],
  [/\bcaption/i, "Captions matter: lots of people watch on mute, and they make your content accessible to deaf and hard-of-hearing viewers. Keep them 2 to 5 words per line, high contrast, and always proofread auto-captions."],
  [/\b(image|picture|thumbnail|midjourney|dall)/i, "For images, stack your prompt: subject, setting, style, lighting, camera, then aspect ratio. Reuse a 'style card' of fixed phrases so all your visuals look like one brand."],
  [/\b(api|endpoint|key|env)/i, "An API call is a request to an endpoint with headers — like your API key — and a body with your prompt. Keep keys in server-side environment variables, never in browser code or a public repo."],
  [/\b(json|schema|structured)/i, "To get reliable JSON, give an exact schema with field names, types and allowed values, say 'return only JSON', and validate it in code. Many APIs also have native structured-output or tool modes."],
  [/\b(webhook)/i, "A webhook is a URL another service calls when something happens. Verify its signature, respond quickly, do heavy work in the background, and make it idempotent because events can arrive twice."],
  [/\b(rate limit|429|cost|token)/i, "Tokens are word pieces, and you pay for input plus output. Set max tokens, pick the smallest model that does the job, cache repeated work, and on a 429 error retry with exponential backoff."],
  [/\b(agent|tool call|autonomous|multi-agent|mcp)/i, "An agent is a loop: think, call a tool, observe the result, repeat until done. Give it small well-described tools, clear stop conditions, spending limits, and require human approval for risky actions."],
  [/\b(hallucinat|wrong|lie|false)/i, "AI can state false things confidently — that's a hallucination. Ask it to list assumptions, cite sources you can check, and verify anything important yourself."],
  [/\b(certif|credential|linkedin)/i, "Finish all lessons in a track to unlock its Rreal Certified credential. Each certificate has a tamper-proof signature, a QR code, a public verification page and a one-click LinkedIn add."],
  [/\b(streak|xp|level|badge)/i, "You earn XP for every lesson, with a streak bonus of up to 50 percent. Every 7 days of streak earns a streak freeze that protects you if you miss a day."],
];

function chat(req: CoachRequest): string {
  const last = req.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const lesson = req.lessonId ? getLessonRef(req.lessonId) : undefined;
  for (const [re, answer] of KB) if (re.test(last)) return answer + (lesson ? `\n\nThis connects to your lesson "${lesson.lesson.title}".` : "");
  if (lesson) return `Great question. In "${lesson.lesson.title}" the big idea is: ${lesson.lesson.summary} Want me to quiz you on it? Switch to Quiz mode, or ask me to explain any part in simpler words.`;
  if (/^(hi|hello|hey)\b/i.test(last.trim())) return "Hey! I'm your Rreal Coach. Ask me anything about AI, have me quiz you, grade a prompt, or practice an AI job interview. What are you working on today?";
  return "Good question. Here's how I'd approach it: break it into one clear goal, give the AI a role and context, ask for a specific format, then iterate with feedback. Tell me a bit more about what you want to create and I'll draft a prompt with you.";
}

function quiz(req: CoachRequest): CoachReply {
  const last = req.messages.filter((m) => m.role === "user").at(-1)?.content.trim() ?? "";
  const pool = req.lessonId ? quizBlocks(req.lessonId) : ALL_LESSONS.flatMap((r) => quizBlocks(r.lesson.id));
  let prefix = "";
  if (req.pendingQuizId) {
    const q = ALL_LESSONS.flatMap((r) => quizBlocks(r.lesson.id)).find((b) => b.id === req.pendingQuizId);
    if (q) {
      const letter = last.match(/\b([a-d])\b/i)?.[1]?.toUpperCase();
      const byText = q.options.findIndex((o) => last.length > 3 && o.toLowerCase().includes(last.toLowerCase()));
      const idx = letter ? letter.charCodeAt(0) - 65 : byText;
      prefix = idx === q.answer ? `✅ Correct! ${q.explanation}\n\n` : `Not quite. The answer is ${String.fromCharCode(65 + q.answer)}: ${q.options[q.answer]}. ${q.explanation}\n\n`;
    }
  }
  const q = pool[Math.floor(Math.random() * pool.length)] ?? ALL_LESSONS.flatMap((r) => quizBlocks(r.lesson.id))[0];
  return { mode: "offline", pendingQuizId: q.id, reply: `${prefix}Question: ${q.question}\n${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")}\n\nSay or type A, B, C or D.` };
}

function grade(req: CoachRequest): string {
  const last = req.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const g = gradePrompt(last);
  const missing = g.criteria.filter((c) => !c.passed);
  if (!last.trim()) return "Paste or say a prompt and I'll grade it out of 100.";
  return `Your prompt scores ${g.score} out of 100 — grade ${g.grade}.\n` + (missing.length ? `To level it up:\n${missing.map((c) => `• ${c.tip}`).join("\n")}` : "That's an excellent prompt. Every element is there. Try adding an example of the exact output you want to make it even sharper.");
}

const INTERVIEW_QS = [
  "Tell me about a time you used AI to save time or improve your work.",
  "How would you explain a large language model to a non-technical manager?",
  "A teammate pasted customer data into a public chatbot. What do you do?",
  "How would you measure whether an AI tool is actually helping your team?",
  "Walk me through how you'd design a prompt for consistent brand-voice content.",
];

function interview(req: CoachRequest): string {
  const asked = req.messages.filter((m) => m.role === "assistant" && m.content.startsWith("Interview question")).length;
  const last = req.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const words = last.split(/\s+/).filter(Boolean).length;
  const feedback = asked === 0 ? "" : words < 25 ? "Feedback: good start — add a concrete example with a result (a number if you can). Use the STAR method: Situation, Task, Action, Result.\n\n" : "Feedback: strong answer — specific and structured. To make it stand out, end with what you learned or would do differently.\n\n";
  if (asked >= INTERVIEW_QS.length) return `${feedback}That's the full mock interview. Nice work! Switch modes or start again anytime.`;
  return `${feedback}Interview question ${asked + 1} of ${INTERVIEW_QS.length}: ${INTERVIEW_QS[asked]}`;
}

export function offlineCoach(req: CoachRequest): CoachReply {
  switch (req.mode) {
    case "quiz": return quiz(req);
    case "grade": return { mode: "offline", reply: grade(req) };
    case "interview": return { mode: "offline", reply: interview(req) };
    default: return { mode: "offline", reply: chat(req) };
  }
}
