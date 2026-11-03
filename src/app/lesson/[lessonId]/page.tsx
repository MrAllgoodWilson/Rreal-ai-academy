"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock, Mic, X } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { useI18n, useTranslated } from "@/lib/i18n";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { LabBlock, QuizBlock, StaticBlock } from "@/components/LessonBlocks";
import { ALL_LESSONS, getLessonRef, lockReason } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";
import { useA11y } from "@/lib/a11y";

const EXAM_ID = "capstone-exam";
const EXAM_PASS = 80;

function Player({ lessonId }: { lessonId: string }) {
  const { catalogVersion } = useAcademy();
  const ref = getLessonRef(lessonId);
  if (!ref && lessonId.startsWith("u-") && catalogVersion === 0)
    return <div className="grid min-h-[50vh] place-items-center" role="status"><span className="sr-only">Loading lesson…</span><div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-neon" aria-hidden="true" /></div>;
  if (!ref) notFound();
  return <LessonPlayer key={lessonId} lessonId={lessonId} />;
}

function LessonPlayer({ lessonId }: { lessonId: string }) {
  const ref = getLessonRef(lessonId)!;
  const { progress, subscribed, completeLesson } = useAcademy();
  const { t } = useI18n();
  const { value: tl, translating } = useTranslated(`lesson:${lessonId}`, { title: ref.lesson.title, blocks: ref.lesson.blocks });
  const { prefs, announce } = useA11y();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [canAdvance, setCanAdvance] = useState<Record<number, boolean>>({});
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState<null | { score: number; passed: boolean }>(null);

  const { track, week, module } = ref;
  const lesson = { ...ref.lesson, title: tl.title, blocks: tl.blocks };
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
        <h1 className="mt-4 font-display text-3xl font-bold">{reason === "subscription" ? t("lesson.paywall") : t("lesson.locked")}</h1>
        <p className="mt-2 text-muted">{reason === "subscription" ? "Every course, tool and certificate for $1/month." : "Lessons build on each other. Complete the one before this to unlock it."}</p>
        <Link href={reason === "subscription" ? "/subscribe" : `/learn/${track.id}`} className="btn-primary mt-6">{reason === "subscription" ? t("pay.cta") : "Back to course"}</Link>
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

      <p className="text-sm text-muted">{track.emoji} {track.name}{track.kind === "program" ? ` · Week ${week.number} · ${module.title}` : ""}</p>
      {translating && <p className="text-sm text-violet" role="status">{t("lesson.translating")}</p>}
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
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("lesson.back")}
        </button>
        <Link href={`/coach?lesson=${lesson.id}`} className="btn-ghost hidden sm:inline-flex">
          <Mic className="h-4 w-4" aria-hidden="true" /> {t("lesson.askCoach")}
        </Link>
        <button type="button" className="btn-primary" onClick={advance} disabled={gated}>
          {step === blocks.length - 1 ? (exam ? "Submit exam" : t("lesson.finish")) : t("lesson.continue")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {gated && <p className="mt-3 text-right text-sm text-muted">{block.type === "quiz" ? "Answer correctly to continue." : "Reach the pass mark to continue."}</p>}
    </div>
  );
}

export default function LessonPage({ params: paramsPromise }: { params: Promise<{ lessonId: string }> }) {
  const params = use(paramsPromise);
  return (
    <RequireMember>
      <Player key={params.lessonId} lessonId={params.lessonId} />
    </RequireMember>
  );
}
