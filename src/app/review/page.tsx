"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuizBlock } from "@/components/LessonBlocks";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { quizBlocks } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";

/**
 * Daily Review: spaced-repetition-lite. Pulls questions from completed lessons,
 * weighting older and lower-scored lessons more heavily so knowledge sticks.
 */
function Review() {
  const { progress, bump } = useAcademy();
  const questions = useMemo(() => {
    const pool = Object.entries(progress.completed).flatMap(([id, c]) => {
      const ageDays = (Date.now() - new Date(c.at).getTime()) / 86_400_000;
      const weight = 1 + ageDays / 3 + (100 - c.score) / 25;
      return quizBlocks(id).map((q) => ({ q, w: weight * Math.random() }));
    });
    return pool.sort((a, b) => b.w - a.w).slice(0, 5).map((x) => x.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [i, setI] = useState(0);
  const [ok, setOk] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  if (!questions.length)
    return (
      <div className="card text-center">
        <p className="text-5xl" aria-hidden="true">🧠</p>
        <p className="mt-3 font-display text-xl font-bold">Nothing to review yet</p>
        <p className="mt-1 text-muted">Complete a lesson with a quiz and it’ll show up here to keep your memory sharp.</p>
        <Link href="/learn" className="btn-primary mt-6">Start a lesson</Link>
      </div>
    );

  if (done)
    return (
      <div className="card text-center">
        <p className="text-6xl" aria-hidden="true">🧠✨</p>
        <p className="mt-3 font-display text-2xl font-bold">Review complete: {correct}/{questions.length} on the first try</p>
        <p className="mt-1 text-muted">Spaced review is how experts make knowledge stick. Come back tomorrow.</p>
        <Link href="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    );

  return (
    <div>
      <ProgressBar pct={((i + 1) / questions.length) * 100} label="Review progress" className="mb-6" />
      <div className="card">
        <QuizBlock key={questions[i].id} block={questions[i]} onAnswered={(first, d) => { if (first) setCorrect((c) => c + 1); if (d) setOk(true); }} />
      </div>
      <button
        type="button"
        className="btn-primary mt-6"
        disabled={!ok}
        onClick={() => {
          setOk(false);
          if (i < questions.length - 1) setI(i + 1);
          else {
            setDone(true);
            bump("reviewsDone");
          }
        }}
      >
        {i < questions.length - 1 ? "Next question" : "Finish review"}
      </button>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <RequireMember>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="Daily Review" title="Keep it fresh" subtitle="5 quick questions from what you’ve learned — chosen by spaced repetition." />
        <Review />
      </div>
    </RequireMember>
  );
}
