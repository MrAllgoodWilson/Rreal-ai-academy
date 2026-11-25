"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Download, ExternalLink, Link2, Linkedin, Lock, Printer } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { CertificateArt, certificateSvg } from "@/components/CertificateArt";
import { FormAlert } from "@/components/AuthCard";
import { TRACKS, ALL_TRACKS, trackProgress, lessonsForTrack } from "@/lib/curriculum";
import { useAcademy, type Certificate } from "@/lib/store";
import { linkedInAddUrl, verifyUrl } from "@/lib/certificates/shared";
import { useA11y } from "@/lib/a11y";

const MASTER = { id: "master", name: "Rreal Certified AI Professional", emoji: "👑" };

function CertActions({ c }: { c: Certificate }) {
  const { announce } = useA11y();
  const download = async () => {
    const svg = await certificateSvg({ name: c.name, title: c.title, code: c.code, issued: c.issuedAt, verifyUrl: verifyUrl(c.token), score: c.score });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <a href={linkedInAddUrl({ title: c.title, token: c.token, code: c.code, issued: c.issuedAt })} target="_blank" rel="noopener noreferrer" className="btn-primary"><Linkedin className="h-4 w-4" aria-hidden="true" /> Add to LinkedIn</a>
      <button type="button" className="btn-ghost" onClick={download}><Download className="h-4 w-4" aria-hidden="true" /> Download SVG</button>
      <button type="button" className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" /> Print / Save PDF</button>
      <button type="button" className="btn-ghost" onClick={() => { navigator.clipboard.writeText(verifyUrl(c.token)); announce("Verification link copied."); }}><Link2 className="h-4 w-4" aria-hidden="true" /> Copy verify link</button>
      <Link href={`/verify/${c.token}`} className="btn-ghost" target="_blank"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Verification page</Link>
    </div>
  );
}

function Certificates() {
  const { user, progress, subscribed, addCertificate, catalogVersion } = useAcademy();
  void catalogVersion;
  const [selected, setSelected] = useState<string | null>(progress.certificates[0]?.trackId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const allDone = TRACKS.every((t) => trackProgress(t.id, progress.completed).pct === 100);
  const examScore = progress.completed["capstone-exam"]?.score ?? 0;

  const claim = async (trackId: string) => {
    setBusy(trackId);
    setError("");
    try {
      const lessons = trackId === "master" ? Object.keys(progress.completed) : lessonsForTrack(trackId).map((r) => r.lesson.id);
      const scores = lessons.map((id) => progress.completed[id]?.score ?? 0);
      const res = await fetch("/api/certificates/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId, name: user!.displayName, completedLessonIds: Object.keys(progress.completed), score: trackId === "architect" || trackId === "master" ? examScore : Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) }),
      });
      const json = await res.json().catch(() => ({ error: `Server error (${res.status}). Please try again.` }));
      if (!res.ok) throw new Error(json.error);
      addCertificate(json.certificate);
      setSelected(trackId);
    } catch (e) {
      setError((e as Error).message || "Couldn't issue certificate.");
    } finally {
      setBusy(null);
    }
  };

  const current = progress.certificates.find((c) => c.trackId === selected);
  const rows = [...TRACKS.map((t) => ({ id: t.id, name: t.certificateTitle, emoji: t.emoji, pct: trackProgress(t.id, progress.completed).pct })), { ...MASTER, pct: allDone ? 100 : Math.round(TRACKS.reduce((a, t) => a + trackProgress(t.id, progress.completed).pct, 0) / TRACKS.length) },
    ...ALL_TRACKS.filter((t) => t.kind !== "program" && (trackProgress(t.id, progress.completed).done > 0 || progress.certificates.some((c) => c.trackId === t.id))).map((t) => ({ id: t.id, name: t.certificateTitle, emoji: t.emoji, pct: trackProgress(t.id, progress.completed).pct }))];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Credentials" title="Rreal Certified" subtitle="Complete a track to earn a signed certificate that anyone can verify. Share it on LinkedIn in one click." />
      {error && <div className="mb-6"><FormAlert kind="error">{error}</FormAlert></div>}
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <ul className="space-y-3" aria-label="Available certificates">
          {rows.map((r) => {
            const cert = progress.certificates.find((c) => c.trackId === r.id);
            const eligible = r.pct === 100 && subscribed;
            return (
              <li key={r.id} className={`glass p-4 ${selected === r.id ? "border-neon" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{r.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{r.name.replace("Rreal Certified: ", "")}</p>
                    <ProgressBar pct={r.pct} label={`${r.name} progress`} className="mt-2" />
                  </div>
                </div>
                <div className="mt-3">
                  {cert ? (
                    <button type="button" className="btn-ghost w-full" onClick={() => setSelected(r.id)} aria-pressed={selected === r.id}>View certificate · {cert.code}</button>
                  ) : eligible ? (
                    <button type="button" className="btn-primary w-full" onClick={() => claim(r.id)} disabled={busy === r.id}>{busy === r.id ? "Issuing…" : "Claim certificate"}</button>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" aria-hidden="true" /> {r.pct < 100 ? `${r.pct}% complete` : "Requires an active plan"}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <section aria-label="Certificate preview">
          {current ? (
            <motion.div key={current.token} initial={{ opacity: 0, rotateX: 20, y: 30 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ duration: 0.6 }} style={{ perspective: 1200 }} className="space-y-5">
              <div id="certificate-print">
                <CertificateArt name={current.name} title={current.title} code={current.code} issued={current.issuedAt} verifyUrl={verifyUrl(current.token)} score={current.score} />
              </div>
              <CertActions c={current} />
            </motion.div>
          ) : (
            <div className="card grid min-h-[300px] place-items-center text-center">
              <div>
                <p className="text-6xl" aria-hidden="true">📜</p>
                <p className="mt-4 font-display text-2xl font-bold">Your first certificate is waiting</p>
                <p className="mt-2 text-muted">Finish every lesson in a track, then claim it here.</p>
                <Link href="/learn" className="btn-primary mt-6">Keep learning</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  return <RequireMember><Certificates /></RequireMember>;
}
