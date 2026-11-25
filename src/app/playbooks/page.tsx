"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Wand2 } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/AuthCard";
import { PlaybookView } from "@/components/PlaybookView";
import { PLAYBOOKS, LEVEL_NAMES, type Playbook } from "@/lib/curriculum";
import { useAcademy } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { apiHeaders } from "@/lib/byok";

const CATS = ["all", "video", "design", "web", "audio", "business"] as const;
const SAVED = "rreal.v1.playbooks";

function Playbooks() {
  const { addPortfolio } = useAcademy();
  const { lang } = useI18n();
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState<Playbook | null>(null);
  const [saved, setSaved] = useState<Playbook[]>([]);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(SAVED) || "[]"));
    } catch {}
  }, []);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/playbooks/generate", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ request, language: lang }) });
      const j = await r.json().catch(() => ({ error: `Server error (${r.status})` }));
      if (!r.ok) throw new Error(j.error);
      setCustom(j.playbook);
      const next = [j.playbook, ...saved].slice(0, 20);
      setSaved(next);
      localStorage.setItem(SAVED, JSON.stringify(next));
      addPortfolio({ kind: "prompt", title: `Playbook: ${j.playbook.title}`, content: (j.playbook as Playbook).steps.map((s, i) => `${i + 1}. ${s.title}\n${s.body}${s.prompt ? `\nPrompt: ${s.prompt}` : ""}`).join("\n\n") });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const list = PLAYBOOKS.filter((p) => cat === "all" || p.category === cat);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Playbooks" title="Make anything, step by step" subtitle="From a TikTok video to a flyer to a full website: exactly which tools to sign up for, and every step to follow." />

      <form className="card mb-10 space-y-4" onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <label htmlFor="pb-req" className="font-display text-lg font-semibold">What do you want to create?</label>
        <input id="pb-req" className="input" value={request} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. A cartoon-style TikTok story about my dog · A wedding invitation · A Shopify store" minLength={5} required />
        {error && <FormAlert kind="error">{error}</FormAlert>}
        <button className="btn-primary" disabled={busy || request.trim().length < 5}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-5 w-5" aria-hidden="true" />} {busy ? "Building your playbook…" : "Build my playbook"}
        </button>
      </form>

      {custom && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12" aria-label="Your custom playbook">
          <PlaybookView pb={custom} />
        </motion.section>
      )}

      <div className="mb-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Filter playbooks">
        {CATS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)} className={`chip min-h-[40px] px-4 capitalize ${cat === c ? "border-neon text-ink" : ""}`}>{c}</button>
        ))}
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => (
          <motion.li key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Link href={`/playbooks/${p.id}`} className="card flex h-full flex-col gap-3 transition hover:shadow-glow">
              <span className="text-4xl" aria-hidden="true">{p.emoji}</span>
              <h2 className="font-display text-lg font-semibold">{p.title}</h2>
              <p className="flex-1 text-sm text-muted">{p.outcome}</p>
              <p className="flex flex-wrap gap-2"><span className="chip capitalize">{p.category}</span><span className="chip">{LEVEL_NAMES[p.level]}</span><span className="chip">{p.tools.filter((t) => t.required).length} tools</span></p>
            </Link>
          </motion.li>
        ))}
      </ul>

      {saved.length > 0 && (
        <section className="mt-12" aria-labelledby="saved-h">
          <h2 id="saved-h" className="mb-4 font-display text-xl font-semibold">Your custom playbooks</h2>
          <ul className="flex flex-wrap gap-2">
            {saved.map((p) => <li key={p.id}><button type="button" className="chip min-h-[40px] px-4" onClick={() => { setCustom(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{p.emoji} {p.title}</button></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function PlaybooksPage() {
  return <RequireMember><Playbooks /></RequireMember>;
}
