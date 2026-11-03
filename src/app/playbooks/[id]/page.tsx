"use client";

import { use } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireMember } from "@/components/RequireAuth";
import { PlaybookView } from "@/components/PlaybookView";
import { getPlaybook } from "@/lib/curriculum";

export default function PlaybookPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const pb = getPlaybook(params.id);
  if (!pb) notFound();
  return (
    <RequireMember>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/playbooks" className="text-sm text-neon hover:underline">← All playbooks</Link>
        <div className="mt-6"><PlaybookView pb={pb} /></div>
      </div>
    </RequireMember>
  );
}
