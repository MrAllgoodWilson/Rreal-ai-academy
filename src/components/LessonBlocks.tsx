"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import type { Block } from "@/lib/curriculum";
import { ReadAloud } from "@/components/ReadAloud";
import { PromptLab, type LabResult } from "@/components/PromptLab";

export function blockText(b: Block): string {
  switch (b.type) {
    case "text": return `${b.heading ? b.heading + ". " : ""}${b.body}`;
    case "keypoints": return `${b.heading ? b.heading + ". " : ""}${b.items.join(". ")}`;
    case "tip": return `Tip. ${b.body}`;
    case "example": return `${b.label}. ${b.bad ? `Weak version: ${b.bad}. ` : ""}Strong version: ${b.good}`;
    case "quiz": return `${b.question} Options: ${b.options.map((o, i) => `${String.fromCharCode(65 + i)}, ${o}`).join(". ")}`;
    case "prompt-lab": return `Lab mission. ${b.goal}`;
    case "reflect": return `Reflection. ${b.prompt}`;
  }
}

export function QuizBlock({ block, onAnswered, exam }: { block: Extract<Block, { type: "quiz" }>; onAnswered: (firstTryCorrect: boolean, done: boolean) => void; exam?: boolean }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const correct = picked === block.answer;

  const check = () => {
    if (picked === null) return;
    setChecked(true);
    const n = attempts + 1;
    setAttempts(n);
    onAnswered(n === 1 && picked === block.answer, exam ? true : picked === block.answer);
  };

  return (
    <fieldset>
      <legend className="font-display text-xl font-semibold">{block.question}</legend>
      <div className="mt-4 grid gap-3" role="radiogroup">
        {block.options.map((o, i) => {
          const state = checked && i === picked ? (correct ? "right" : "wrong") : checked && exam === undefined && correct && i === block.answer ? "right" : null;
          return (
            <motion.button
              key={i}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={checked && (correct || !!exam)}
              onClick={() => { setPicked(i); setChecked(false); }}
              whileTap={{ scale: 0.98 }}
              animate={state === "wrong" ? { x: [0, -8, 8, -6, 6, 0] } : {}}
              className={`flex min-h-[52px] items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                state === "right" ? "border-lime bg-lime/10" : state === "wrong" ? "border-danger bg-danger/10" : picked === i ? "border-neon bg-neon/10" : "border-line hover:border-neon/60"
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line font-mono text-sm" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
              {o}
            </motion.button>
          );
        })}
      </div>
      {!(checked && (correct || exam)) && (
        <button type="button" className="btn-primary mt-4" onClick={check} disabled={picked === null}>Check answer</button>
      )}
      {checked && !exam && (
        <div role="status" className={`mt-4 flex gap-3 rounded-xl p-4 ${correct ? "bg-lime/10" : "bg-danger/10"}`}>
          {correct ? <CheckCircle2 className="h-6 w-6 shrink-0 text-lime" aria-hidden="true" /> : <XCircle className="h-6 w-6 shrink-0 text-danger" aria-hidden="true" />}
          <div>
            <p className="font-semibold">{correct ? "Correct!" : "Not quite — try again."}</p>
            <p className="text-sm text-muted">{correct ? block.explanation : "Re-read the options. Hint: " + block.explanation.split(".")[0] + "."}</p>
          </div>
        </div>
      )}
      {checked && exam && <p role="status" className="mt-4 text-sm text-muted">Answer locked in.</p>}
    </fieldset>
  );
}

export function StaticBlock({ block, autoRead }: { block: Block; autoRead?: boolean }) {
  return (
    <div className="space-y-4">
      {block.type === "text" && (
        <>
          {block.heading && <h2 className="font-display text-2xl font-bold">{block.heading}</h2>}
          <p className="text-lg leading-relaxed">{block.body}</p>
        </>
      )}
      {block.type === "keypoints" && (
        <>
          {block.heading && <h2 className="font-display text-2xl font-bold">{block.heading}</h2>}
          <ul className="space-y-3">
            {block.items.map((it, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="flex gap-3 rounded-xl bg-raised/50 p-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-neon" aria-hidden="true" />
                <span>{it}</span>
              </motion.li>
            ))}
          </ul>
        </>
      )}
      {block.type === "tip" && (
        <div className="flex gap-3 rounded-2xl border border-flame/50 bg-flame/10 p-5">
          <Lightbulb className="h-6 w-6 shrink-0 text-flame" aria-hidden="true" />
          <p className="text-lg">{block.body}</p>
        </div>
      )}
      {block.type === "example" && (
        <>
          <h2 className="font-display text-2xl font-bold">{block.label}</h2>
          {block.bad && (
            <div className="rounded-xl border border-danger/50 bg-danger/5 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-danger">Weak</p>
              <pre className="whitespace-pre-wrap font-mono text-sm">{block.bad}</pre>
            </div>
          )}
          <div className="rounded-xl border border-lime/50 bg-lime/5 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-lime">Strong</p>
            <pre className="whitespace-pre-wrap font-mono text-sm">{block.good}</pre>
          </div>
        </>
      )}
      {block.type === "reflect" && (
        <>
          <h2 className="font-display text-2xl font-bold">Reflect</h2>
          <p className="text-lg">{block.prompt}</p>
          <label htmlFor="reflection" className="label">Your answer (private — saved to your portfolio if you choose)</label>
          <textarea id="reflection" className="input min-h-[100px]" />
        </>
      )}
      <ReadAloud text={blockText(block)} autoPlay={autoRead} />
    </div>
  );
}

export function LabBlock({ block, title, onResult }: { block: Extract<Block, { type: "prompt-lab" }>; title: string; onResult: (r: LabResult) => void }) {
  return <PromptLab goal={block.goal} starter={block.starter} minScore={block.minScore} onResult={onResult} saveTitle={title} />;
}
