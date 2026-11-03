"use client";

import Link from "next/link";
import { Copy, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAcademy } from "@/lib/store";
import { useA11y } from "@/lib/a11y";

function Portfolio() {
  const { progress, removePortfolio } = useAcademy();
  const { announce } = useA11y();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="Portfolio" title="Proof of skill" subtitle="Every lab you pass and every video you plan is saved here. Reuse your best prompts anytime." />
      {progress.portfolio.length === 0 ? (
        <div className="card text-center">
          <p className="text-5xl" aria-hidden="true">🗂️</p>
          <p className="mt-3 font-display text-xl font-bold">Your portfolio is empty</p>
          <p className="mt-1 text-muted">Pass a prompt lab or save a Studio project to add your first piece.</p>
          <div className="mt-6 flex justify-center gap-3"><Link href="/sandbox" className="btn-primary">Open Sandbox</Link><Link href="/studio" className="btn-ghost">Open Studio</Link></div>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {progress.portfolio.map((p) => (
            <li key={p.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="chip mb-2 capitalize">{p.kind}{p.score !== undefined ? ` · PQS ${p.score}` : ""}</p>
                  <h2 className="font-display text-lg font-semibold">{p.title}</h2>
                  <p className="text-xs text-muted">{new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:text-ink" aria-label={`Copy ${p.title}`} onClick={() => { navigator.clipboard.writeText(p.content); announce("Copied."); }}><Copy className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:text-danger" aria-label={`Delete ${p.title}`} onClick={() => removePortfolio(p.id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </div>
              <pre className="mt-4 max-h-60 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-bg/60 p-3 font-mono text-xs">{p.content}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  return <RequireAuth><Portfolio /></RequireAuth>;
}
