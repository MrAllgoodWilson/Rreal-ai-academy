"use client";

import { useState } from "react";
import { Download, ImagePlus } from "lucide-react";
import { apiHeaders } from "@/lib/byok";
import { useA11y } from "@/lib/a11y";

const STYLES = [
  ["flyer", "Flyer"],
  ["thumbnail", "Thumbnail"],
  ["logo", "Logo"],
  ["product", "Product photo"],
  ["poster", "Poster"],
] as const;

/** Generate images for flyers, thumbnails, logos and posters (Cloudflare Workers AI). */
export function ImageMaker() {
  const { announce } = useA11y();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number][0]>("flyer");
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    announce("Creating your image…");
    const r = await fetch("/api/image", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ prompt, style }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok && j.image) {
      setImg(j.image);
      announce("Your image is ready.");
    } else setErr(j.error ?? "Something went wrong. Please try again.");
  };

  return (
    <section className="card space-y-4" aria-labelledby="img-h">
      <h2 id="img-h" className="flex items-center gap-2 font-display text-xl font-semibold"><ImagePlus className="h-5 w-5 text-neon" aria-hidden="true" /> AI image maker</h2>
      <p className="text-sm text-muted">Create artwork for flyers, thumbnails, logos and posters. Add your words afterwards in Canva or any editor. Included with membership (10 per day).</p>
      <form className="space-y-3" onSubmit={go}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Image style">
          {STYLES.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={style === id} onClick={() => setStyle(id)} className={`chip min-h-[44px] px-4 ${style === id ? "border-neon text-ink" : ""}`}>{label}</button>
          ))}
        </div>
        <label htmlFor="img-prompt" className="label">Describe your image</label>
        <textarea id="img-prompt" className="input" rows={3} maxLength={800} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A summer block party in a city park at sunset, neon colors, happy crowd" />
        <button className="btn-primary" disabled={busy || prompt.trim().length < 5}>{busy ? "Creating…" : "Create image"}</button>
      </form>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      {img && (
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={`AI-generated ${style}: ${prompt}`} className="w-full rounded-xl border border-line" />
          <a href={img} download={`rreal-${style}.jpg`} className="btn-ghost inline-flex min-h-[44px]"><Download className="h-4 w-4" aria-hidden="true" /> Download</a>
        </figure>
      )}
    </section>
  );
}
