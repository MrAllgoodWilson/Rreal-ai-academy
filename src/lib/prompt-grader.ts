/**
 * Rreal Prompt Quality Score (PQS) — an explainable, offline rubric that grades a prompt 0–100.
 * Runs instantly in the browser (no API key needed) so feedback is real-time while typing.
 * When the Claude API is configured, /api/sandbox adds an AI critique on top of this score.
 */

export interface Criterion {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  tip: string;
}

export interface Grade {
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  criteria: Criterion[];
  wordCount: number;
}

const has = (re: RegExp, s: string) => re.test(s);

export function gradePrompt(raw: string): Grade {
  const p = raw.trim();
  const lower = p.toLowerCase();
  const words = p ? p.split(/\s+/).length : 0;

  const criteria: Criterion[] = [
    {
      id: "role",
      label: "Role",
      weight: 15,
      passed: has(/\b(you are|act as|you're|as an? |role:|pretend to be|imagine you are)\b/i, p),
      tip: "Give the AI a role: \"You are a senior social media strategist…\"",
    },
    {
      id: "task",
      label: "Clear task",
      weight: 20,
      passed: has(/\b(write|create|generate|draft|list|summari[sz]e|explain|rewrite|compare|plan|design|analy[sz]e|extract|give|suggest|build|outline|translate|turn)\b/i, p),
      tip: "Start with a clear action verb: write, list, plan, extract…",
    },
    {
      id: "context",
      label: "Context & audience",
      weight: 20,
      passed: has(/\b(for (my|a|an|our|the)|audience|my (business|company|brand|channel|team|job)|i am|i'm|i have|we are|context:|background|beginners?|customers?|clients?|followers?|readers?)\b/i, p),
      tip: "Add context: who it's for and your situation.",
    },
    {
      id: "format",
      label: "Output format",
      weight: 15,
      passed: has(/\b(bullet|table|json|list of|\d+\s+(ideas|options|versions|hooks|bullets|steps|tips|posts|shots|captions|days)|\d+[- ]?(word|second|minute|character|line)s?|format|markdown|numbered|outline|columns?|schema|layout:|(caption|email|script|thread|tweet|headline|summary|poem|essay|checklist|template|storyboard|shot list)s?)\b/i, p),
      tip: "Specify the format: \"as a table\", \"5 bullet points\", \"valid JSON\"…",
    },
    {
      id: "constraints",
      label: "Constraints",
      weight: 15,
      passed: has(/\b(under|max(imum)?|at most|no more than|less than|limit|only|avoid|don't|do not|never|must|tone|words?|characters|budget|seconds?)\b/i, p),
      tip: "Add constraints: length, tone, what to avoid, budget, deadline.",
    },
    {
      id: "examples",
      label: "Examples / specifics",
      weight: 10,
      passed: has(/(e\.g\.|for example|like this|such as|examples?:|"[^"]{4,}"|“[^”]{4,}”|:\s*\n)/i, p),
      tip: "Show an example or quote of what good looks like (few-shot).",
    },
    {
      id: "detail",
      label: "Enough detail",
      weight: 5,
      passed: words >= 25,
      tip: "Great prompts are usually 25+ words. Every detail removes a guess.",
    },
  ];

  let score = criteria.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0);
  if (words > 0 && words < 6) score = Math.min(score, 20);
  if (lower.includes("step by step") || lower.includes("assumptions")) score = Math.min(100, score + 5);
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? "S" : score >= 75 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  return { score, grade, criteria, wordCount: words };
}
