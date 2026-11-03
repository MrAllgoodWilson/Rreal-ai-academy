"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/AuthCard";
import { LEVEL_NAMES, type Track } from "@/lib/curriculum";

interface Row { id: string; title: string; level: number; language: string; status: string; request: string | null; created_at: string; content: Track }

function Admin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/courses", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error ?? "Not allowed");
    else setRows(j.courses);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = async (id: string, status: string) => {
    const r = await fetch("/api/admin/courses", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (r.ok) load();
    else setError((await r.json().catch(() => ({}))).error ?? "Failed");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="Admin" title="Course review queue" subtitle="Learner-created courses submitted for everyone. Review content for accuracy and safety before publishing." />
      {error && <FormAlert kind="error">{error}</FormAlert>}
      {rows?.length === 0 && <p className="text-muted">Nothing to review right now.</p>}
      <ul className="space-y-4">
        {rows?.map((c) => (
          <li key={c.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">{c.content.emoji} {c.title}</p>
                <p className="text-sm text-muted">{LEVEL_NAMES[c.level]} · {c.language.toUpperCase()} · <span className="capitalize">{c.status}</span> · {new Date(c.created_at).toLocaleDateString()}</p>
                {c.request && <p className="mt-1 text-sm">Request: “{c.request}”</p>}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => set(c.id, "published")} disabled={c.status === "published"}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Publish</button>
                <button type="button" className="btn-ghost" onClick={() => set(c.id, "rejected")} disabled={c.status === "rejected"}><XCircle className="h-4 w-4" aria-hidden="true" /> Reject</button>
              </div>
            </div>
            <button type="button" className="mt-3 text-sm text-neon underline" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Hide content" : "Review content"}</button>
            {open === c.id && <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-bg/60 p-3 text-xs">{JSON.stringify(c.content.weeks, null, 2)}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminPage() {
  return <RequireAuth><Admin /></RequireAuth>;
}
