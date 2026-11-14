"use client";

import { useState } from "react";
import { Handshake, Megaphone, Sparkles, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/AuthCard";

const TIERS = [
  { id: "community", icon: Megaphone, name: "Community sponsor", desc: "Proposed placement on our public Sponsors page. Any newsletter placement requires a separately agreed, consented audience and delivery plan." },
  { id: "course", icon: Sparkles, name: "Public preview sponsor", desc: "Proposed sponsorship of an eligible public course preview or resource page. Paid lessons and member workspaces stay ad-free." },
  { id: "tool-partner", icon: Wrench, name: "Tool partner", desc: "Proposed placement in our public partner resources. Tracking links require program approval and clear sponsorship or affiliate disclosure." },
  { id: "title", icon: Handshake, name: "Title partner", desc: "A proposed public sponsorship package with placement, dates, rights and reporting agreed before payment. Private learning records and certificates are excluded." },
] as const;

/** Public page where brands can sponsor the academy. */
export default function SponsorsPage() {
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>("course");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "ok" | "error"; msg?: string }>({ kind: "idle" });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    const r = await fetch("/api/sponsors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: f.get("company"), contact: f.get("contact"), email: f.get("email"), website: f.get("website") || "", tier, message: f.get("message") || "", hp: f.get("hp") || "" }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setState({ kind: "ok", msg: "Thank you! We'll reply within 2 business days." });
    else setState({ kind: "error", msg: j.error ?? "Something went wrong. Please try again." });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Sponsors" title="Help everyone learn AI for $1 a month" />
      <p className="max-w-3xl text-lg text-muted">
        Rreal AI Academy teaches AI from absolute beginner to expert, in English and Spanish, with accessibility built in for blind, deaf and disabled learners.
        Sponsors keep the price at $1 and put their brand in front of motivated people who are building real projects.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Sponsorship type">
        {TIERS.map(({ id, icon: Icon, name, desc }) => (
          <button key={id} type="button" role="radio" aria-checked={tier === id} onClick={() => setTier(id)} className={`card h-full w-full text-left transition-colors ${tier === id ? "border-neon" : "hover:border-violet"}`}>
              <Icon className="h-6 w-6 text-neon" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-semibold">{name}</h2>
              <p className="mt-1 text-sm text-muted">{desc}</p>
          </button>
        ))}
      </div>

      <section className="card mt-8" aria-labelledby="sp-form">
        <h2 id="sp-form" className="font-display text-2xl font-semibold">Start a conversation</h2>
        {state.kind === "ok" ? (
          <div className="mt-4"><FormAlert kind="success">{state.msg}</FormAlert></div>
        ) : (
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <div><label htmlFor="company" className="label">Company</label><input id="company" name="company" required maxLength={120} className="input" autoComplete="organization" /></div>
            <div><label htmlFor="contact" className="label">Your name</label><input id="contact" name="contact" required maxLength={120} className="input" autoComplete="name" /></div>
            <div><label htmlFor="email" className="label">Work email</label><input id="email" name="email" type="email" required maxLength={254} className="input" autoComplete="email" /></div>
            <div><label htmlFor="website" className="label">Website (optional)</label><input id="website" name="website" type="url" maxLength={300} className="input" placeholder="https://" autoComplete="url" /></div>
            <div className="sm:col-span-2"><label htmlFor="message" className="label">What would you like to achieve? (optional)</label><textarea id="message" name="message" maxLength={2000} rows={4} className="input" /></div>
            <div aria-hidden="true" className="hidden"><label htmlFor="hp">Leave empty</label><input id="hp" name="hp" tabIndex={-1} autoComplete="off" /></div>
            {state.kind === "error" && <div className="sm:col-span-2"><FormAlert kind="error">{state.msg}</FormAlert></div>}
            <div className="sm:col-span-2"><button className="btn-primary" disabled={state.kind === "sending"}>{state.kind === "sending" ? "Sending…" : `Request the ${TIERS.find((t) => t.id === tier)!.name.toLowerCase()} kit`}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
