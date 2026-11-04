"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2 } from "lucide-react";
import { FormAlert } from "@/components/AuthCard";
import { useA11y } from "@/lib/a11y";
import { useAcademy } from "@/lib/store";

/** Renders a real AI video clip from a scene prompt and polls until it's ready. */
export function VideoRenderer({ defaultPrompt }: { defaultPrompt: string }) {
  const { announce } = useA11y();
  const { addPortfolio } = useAcademy();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [status, setStatus] = useState<"idle" | "queued" | "processing" | "succeeded" | "failed">("idle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const render = async () => {
    setError("");
    setUrl("");
    setStatus("queued");
    const r = await fetch("/api/video/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
    const j = await r.json().catch(() => ({ error: `Server error (${r.status})` }));
    if (!r.ok) {
      setStatus("failed");
      setError(j.error);
      return;
    }
    announce("Rendering started. AI video usually takes one to five minutes.");
    timer.current = setInterval(async () => {
      const p = await fetch(`/api/video/${j.id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (!p) return;
      setStatus(p.status);
      if (p.status === "succeeded") {
        clearInterval(timer.current);
        setUrl(p.output_url);
        addPortfolio({ kind: "video", title: `AI clip: ${prompt.slice(0, 60)}`, content: `${p.output_url}\n\nPrompt: ${prompt}` });
        announce("Your AI video is ready.");
      }
      if (p.status === "failed") {
        clearInterval(timer.current);
        setError(p.error || "Render failed.");
      }
    }, 5000);
  };

  const busy = status === "queued" || status === "processing";
  return (
    <div className="space-y-3 rounded-2xl border border-violet/40 bg-violet/5 p-4">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Film className="h-5 w-5 text-violet" aria-hidden="true" /> Render a real AI video clip</h3>
      <label htmlFor="vr-prompt" className="label">Scene prompt</label>
      <textarea id="vr-prompt" rows={3} className="input text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      {error && <FormAlert kind="error">{error}</FormAlert>}
      <button type="button" className="btn-violet" onClick={render} disabled={busy || prompt.trim().length < 10}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Film className="h-4 w-4" aria-hidden="true" />}
        {busy ? `Rendering… (${status})` : "Render with AI"}
      </button>
      <p className="text-xs text-muted">Included: 1 free AI render every month; more with <a href="/credits" className="text-neon underline">video credits</a> (5 for $4.99). Clips take 1–5 minutes. Label realistic AI video when you post it.</p>
      {url && (
        <div className="space-y-2">
          <video src={url} controls playsInline className="max-h-[480px] rounded-xl" aria-label="Your rendered AI video" />
          <a href={url} download target="_blank" rel="noopener noreferrer" className="btn-ghost"><Download className="h-4 w-4" aria-hidden="true" /> Download</a>
        </div>
      )}
    </div>
  );
}
