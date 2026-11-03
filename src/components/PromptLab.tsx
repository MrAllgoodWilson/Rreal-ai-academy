"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Play, Save, Sparkles, X, Copy } from "lucide-react";
import { gradePrompt } from "@/lib/prompt-grader";
import { useAcademy } from "@/lib/store";
import { useA11y } from "@/lib/a11y";

export interface LabResult {
  score: number;
  passed: boolean;
  prompt: string;
}

const GRADE_COLOR: Record<string, string> = { S: "text-lime", A: "text-neon", B: "text-violet", C: "text-flame", D: "text-danger" };

export function PromptLab({ goal, starter = "", minScore = 0, onResult, saveTitle, compact }: { goal?: string; starter?: string; minScore?: number; onResult?: (r: LabResult) => void; saveTitle?: string; compact?: boolean }) {
  const { recordPromptScore, addPortfolio } = useAcademy();
  const { announce } = useA11y();
  const [prompt, setPrompt] = useState(starter);
  const [output, setOutput] = useState("");
  const [critique, setCritique] = useState("");
  const [mode, setMode] = useState<"live" | "simulated" | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const grade = useMemo(() => gradePrompt(prompt), [prompt]);
  const passed = grade.score >= minScore && grade.wordCount > 0;
  const announced = useRef(false);

  useEffect(() => {
    onResult?.({ score: grade.score, passed, prompt });
    if (passed && minScore > 0 && !announced.current) {
      announced.current = true;
      announce(`Prompt score ${grade.score}. You passed this lab.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade.score, passed]);

  const run = async () => {
    setBusy(true);
    setOutput("");
    setCritique("");
    recordPromptScore(grade.score);
    try {
      const res = await fetch("/api/sandbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, goal }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sandbox error");
      setOutput(json.output);
      setCritique(json.critique ?? "");
      setMode(json.mode);
      announce("AI output ready.");
    } catch (e) {
      setOutput(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {goal && (
        <div className="rounded-xl border border-violet/40 bg-violet/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet">Lab mission</p>
          <p className="mt-1">{goal}</p>
          {minScore > 0 && <p className="mt-2 text-sm text-muted">Pass mark: Prompt Quality Score {minScore}+</p>}
        </div>
      )}

      <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-[1fr_280px]"}`}>
        <div>
          <label htmlFor="prompt-input" className="label">Your prompt</label>
          <textarea
            id="prompt-input"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSaved(false);
            }}
            rows={compact ? 6 : 9}
            className="input min-h-[160px] resize-y font-mono text-sm leading-relaxed"
            placeholder="You are a… Write/Create/Plan… for… Format… Constraints…"
            aria-describedby="pqs-summary"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={run} disabled={busy || !prompt.trim()} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />} Run prompt
            </button>
            {saveTitle && (
              <button
                type="button"
                className="btn-ghost"
                disabled={!passed || saved}
                onClick={() => {
                  addPortfolio({ kind: "prompt", title: saveTitle, content: prompt, score: grade.score });
                  setSaved(true);
                  announce("Saved to your portfolio.");
                }}
              >
                <Save className="h-4 w-4" aria-hidden="true" /> {saved ? "Saved" : "Save to portfolio"}
              </button>
            )}
            <span className="self-center text-xs text-muted">Ctrl/⌘ + Enter to run</span>
          </div>
        </div>

        <aside aria-label="Prompt Quality Score" className="rounded-2xl border border-line bg-bg/40 p-4">
          <div className="flex items-baseline justify-between" id="pqs-summary" aria-live="polite">
            <span className="text-sm font-semibold text-muted">Prompt Quality Score</span>
            <span className={`font-display text-3xl font-bold ${GRADE_COLOR[grade.grade]}`}>
              {grade.score}<span className="sr-only"> out of 100, grade {grade.grade}</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
            <motion.div className="h-full bg-gradient-to-r from-flame via-violet to-lime" animate={{ width: `${grade.score}%` }} transition={{ type: "spring", damping: 20 }} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {grade.criteria.map((c) => (
              <li key={c.id} className="flex gap-2">
                {c.passed ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden="true" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
                <span>
                  <span className={c.passed ? "font-semibold" : "font-semibold text-muted"}>{c.label}</span>
                  <span className="sr-only">{c.passed ? ": done" : ": missing"}</span>
                  {!c.passed && <span className="block text-xs text-muted">{c.tip}</span>}
                </span>
              </li>
            ))}
          </ul>
          {minScore > 0 && (
            <p className={`mt-4 rounded-lg p-2 text-center text-sm font-semibold ${passed ? "bg-lime/15 text-lime" : "bg-raised text-muted"}`}>{passed ? "✓ Lab passed" : `${Math.max(0, minScore - grade.score)} points to pass`}</p>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {(output || busy) && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-neon/40 bg-bg/60 p-4" aria-labelledby="output-title" aria-busy={busy}>
            <div className="mb-2 flex items-center justify-between">
              <h3 id="output-title" className="flex items-center gap-2 text-sm font-semibold text-neon">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> AI output {mode === "simulated" && <span className="chip">offline simulator</span>}
              </h3>
              {output && (
                <button type="button" className="text-muted hover:text-ink" aria-label="Copy output" onClick={() => navigator.clipboard.writeText(output)}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {busy ? <p className="animate-pulse text-muted">Thinking…</p> : <div className="whitespace-pre-wrap text-sm leading-relaxed">{output}</div>}
            {critique && (
              <div className="mt-4 rounded-xl border border-violet/40 bg-violet/10 p-3 text-sm">
                <p className="mb-1 font-semibold text-violet">Coach’s critique</p>
                <p className="whitespace-pre-wrap">{critique}</p>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
