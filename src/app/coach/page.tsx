"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { VoiceCoach } from "@/components/VoiceCoach";

function CoachInner() {
  const lessonId = useSearchParams().get("lesson") ?? undefined;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Rreal Coach" title="Talk to your AI coach" subtitle="Two-way voice with live captions. Ask questions, get quizzed, have your prompts graded, or rehearse an AI job interview." />
      <VoiceCoach lessonId={lessonId} />
    </div>
  );
}

export default function CoachPage() {
  return (
    <RequireMember>
      <Suspense>
        <CoachInner />
      </Suspense>
    </RequireMember>
  );
}
