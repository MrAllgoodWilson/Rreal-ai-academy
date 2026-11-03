"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { Playbook } from "@/lib/curriculum";
import { useTranslated } from "@/lib/i18n";
import { useA11y } from "@/lib/a11y";

const PRICE: Record<string, string> = { free: "Free", freemium: "Free plan + paid upgrades", paid: "Paid subscription" };

export function PlaybookView({ pb }: { pb: Playbook }) {
  const { value: p, translating } = useTranslated(`pb:${pb.id}`, pb);
  const { announce } = useA11y();
  const key = `rreal.v1.pbdone.${pb.id}`;
  const [done, setDone] = useState<Record<number, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) || "{}"));
    } catch {}
  }, [key]);
  const toggle = (i: number) => {
    const next = { ...done, [i]: !done[i] };
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  const count = Object.values(done).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {translating && <p className="text-sm text-muted" role="status">Traduciendo…</p>}
      <header>
        <p className="text-5xl" aria-hidden="true">{p.emoji}</p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{p.title}</h1>
        <p className="mt-2 text-lg text-muted">{p.outcome}</p>
        <p className="mt-3 flex flex-wrap gap-2"><span className="chip capitalize">{p.category}</span><span className="chip">~{p.minutes} min</span><span className="chip">{count}/{p.steps.length} steps done</span></p>
      </header>

      <section aria-labelledby="tools-h" className="card">
        <h2 id="tools-h" className="font-display text-xl font-semibold">Accounts & subscriptions you need</h2>
        <p className="mt-1 text-sm text-muted">Prices change often — check each site for current plans before subscribing.</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {p.tools.map((t) => (
            <li key={t.name} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{t.name}</p>
                <span className={`chip shrink-0 ${t.required ? "border-neon/60 text-neon" : ""}`}>{t.required ? "Required" : "Optional"}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{t.use}</p>
              <p className="mt-2 text-xs">{PRICE[t.pricing]}</p>
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-neon underline">Open site <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> for {t.name} (opens in new tab)</span></a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-h">
        <h2 id="steps-h" className="mb-4 font-display text-xl font-semibold">Step by step</h2>
        <ol className="space-y-4">
          {p.steps.map((s, i) => (
            <li key={i} className={`card ${done[i] ? "border-lime/60" : ""}`}>
              <div className="flex items-start gap-4">
                <button type="button" role="checkbox" aria-checked={!!done[i]} aria-label={`Mark step ${i + 1} done`} onClick={() => toggle(i)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 font-display font-bold ${done[i] ? "border-lime bg-lime text-bg" : "border-line"}`}>
                  {done[i] ? <Check className="h-5 w-5" aria-hidden="true" /> : i + 1}
                </button>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 leading-relaxed">{s.body}</p>
                  {s.prompt && (
                    <div className="mt-3 rounded-xl border border-violet/40 bg-violet/10 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-widest text-violet">Copy-paste prompt</p>
                        <button type="button" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink" onClick={() => { navigator.clipboard.writeText(s.prompt!); announce("Prompt copied."); }}>
                          <Copy className="h-4 w-4" aria-hidden="true" /> Copy
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-sm">{s.prompt}</pre>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {p.category === "video" && (
        <div className="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Ready to build it? Draft the script, render AI clips and schedule posts in the Studio.</p>
          <Link href="/studio" className="btn-primary">Open Studio</Link>
        </div>
      )}
    </div>
  );
}
