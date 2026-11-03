"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock, Mic, X } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { LabBlock, QuizBlock, StaticBlock } from "@/components/LessonBlocks";
import { ALL_LESSONS, getLessonRef, lockReason } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";
import { useA11y } from "@/lib/a11y";

const EXAM_ID = "capstone-exam";
const EXAM_PASS = 80;

function Player({ lessonId }: { lessonId: string }) {
  const ref = getLessonRef(lessonId);
  const { progress, subscribed, completeLesson } = useAcademy();
  const { prefs, announce } = useA11y();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [canAdvance, setCanAdvance] = useState<Record<number, boolean>>({});
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState<null | { score: number; passed: boolean }>(null);

  if (!ref) notFound();
  const { lesson, track, week, module } = ref;
  const exam = lesson.id === EXAM_ID;
  const blocks = lesson.blocks;
  const block = blocks[step];
  const quizIdx = useMemo(() => blocks.map((b, i) => (b.type === "quiz" ? i : -1)).filter((i) => i >= 0), [blocks]);
  const reason = lockReason(lesson.id, progress.completed, { subscribed, placementLevel: progress.onboarding.placementLevel });
  const gated = (block.type === "quiz" || block.type === "prompt-lab") && !canAdvance[step];
  const next = ALL_LESSONS[ref.index + 1];

  useEffect(() => {
    announce(`Step ${step + 1} of ${blocks.length}`);
  }, [step, blocks.length, announce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "ArrowRight" && !gated) advance();
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (reason) {
    return (
      <div className="mx-auto grid max-w-lg place-items-center px-4 py-24 text-center">
        <Lock className="h-14 w-14 text-violet" aria-hidden="true" />
        <h1 className="mt-4 font-display text-3xl font-bold">{reason === "subscription" ? `Week ${week.number} is a Pro lesson` : "Finish the previous lesson first"}</h1>
        <p className="mt-2 text-muted">{reason === "subscription" ? "Start your 7-day free trial to unlock every week, the full Studio and certificates." : "Lessons build on each other. Complete the one before this to unlock it."}</p>
        <Link href={reason === "subscription" ? "/pricing" : `/learn/${track.id}`} className="btn-primary mt-6">{reason === "subscription" ? "Start free trial" : "Back to track"}</Link>
      </div>
    );
  }

  function advance() {
    if (step < blocks.length - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const correct = quizIdx.filter((i) => firstTry[i]).length;
    const score = quizIdx.length ? Math.round((correct / quizIdx.length) * 100) : 100;
    const passed = !exam || score >= EXAM_PASS;
    setFinished({ score, passed });
    if (passed) completeLesson(lesson.id, score);
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl" aria-hidden="true">{finished.passed ? "🎉" : "📚"}</motion.p>
        <h1 className="mt-4 font-display text-4xl font-bold">{finished.passed ? (exam ? "You passed the exam!" : "Lesson complete!") : "Almost there"}</h1>
        <p className="mt-3 text-lg text-muted">
          {quizIdx.length > 0 && <>First-try quiz score: <strong className="text-ink">{finished.score}%</strong>. </>}
          {finished.passed ? (exam ? "Head to Certificates to claim your credential." : "Nice work — keep the momentum going.") : `You need ${EXAM_PASS}% to certify. Review and try again — you've got this.`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {finished.passed && exam && <Link href="/certificates" className="btn-primary">Claim certificate</Link>}
          {finished.passed && next && !exam && (
            <button type="button" className="btn-primary" onClick={() => router.push(`/lesson/${next.lesson.id}`)}>
              Next: {next.lesson.title} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {!finished.passed && (
            <button type="button" className="btn-primary" onClick={() => { setFinished(null); setStep(0); setCanAdvance({}); setFirstTry({}); }}>Retake exam</button>
          )}
          <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/learn/${track.id}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line" aria-label="Exit lesson">
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
        <ProgressBar pct={((step + 1) / blocks.length) * 100} label="Lesson progress" />
        <span className="shrink-0 text-sm text-muted" aria-hidden="true">{step + 1}/{blocks.length}</span>
      </div>

      <p className="text-sm text-muted">{track.emoji} {track.name} · Week {week.number} · {module.title}</p>
      <h1 className="mb-6 font-display text-3xl font-bold">{lesson.title}</h1>

      <AnimatePresence mode="wait">
        <motion.article key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="card" aria-roledescription="lesson step" aria-label={`Step ${step + 1} of ${blocks.length}`}>
          {block.type === "quiz" ? (
            <QuizBlock
              block={block}
              exam={exam || undefined}
              onAnswered={(first, done) => {
                setFirstTry((f) => (step in f ? f : { ...f, [step]: first }));
                if (done) setCanAdvance((c) => ({ ...c, [step]: true }));
              }}
            />
          ) : block.type === "prompt-lab" ? (
            <LabBlock block={block} title={lesson.title} onResult={(r) => setCanAdvance((c) => (c[step] === r.passed ? c : { ...c, [step]: r.passed }))} />
          ) : (
            <StaticBlock block={block} autoRead={prefs.autoReadAloud} />
          )}
        </motion.article>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>
        <Link href={`/coach?lesson=${lesson.id}`} className="btn-ghost hidden sm:inline-flex">
          <Mic className="h-4 w-4" aria-hidden="true" /> Ask Coach
        </Link>
        <button type="button" className="btn-primary" onClick={advance} disabled={gated}>
          {step === blocks.length - 1 ? (exam ? "Submit exam" : "Finish lesson") : "Continue"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {gated && <p className="mt-3 text-right text-sm text-muted">{block.type === "quiz" ? "Answer correctly to continue." : "Reach the pass mark to continue."}</p>}
    </div>
  );
}

export default function LessonPage({ params }: { params: { lessonId: string } }) {
  return (
    <RequireAuth>
      <Player key={params.lessonId} lessonId={params.lessonId} />
    </RequireAuth>
  );
}
