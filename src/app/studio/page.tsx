"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, Check, Pause, Play, RefreshCw, Save, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { generateHooks, generateScript, toICS, totalSeconds, type Platform, type Scene } from "@/lib/studio";
import { useAcademy } from "@/lib/store";
import { useA11y } from "@/lib/a11y";

const STEPS = ["Concept", "Hook", "Script", "Preview", "Schedule"];
const PLATFORMS: Platform[] = ["TikTok", "Instagram Reels", "YouTube Shorts"];
const BG = ["from-cyan-500 to-violet-600", "from-fuchsia-500 to-orange-400", "from-emerald-500 to-cyan-600", "from-violet-600 to-rose-500", "from-amber-400 to-pink-600"];

function PhonePreview({ scenes, platform, disclose }: { scenes: Scene[]; platform: Platform; disclose: boolean }) {
  const { prefs, speak, stopSpeaking } = useA11y();
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const total = totalSeconds(scenes);
  const reduced = prefs.motion === "reduce";

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => {
    let acc = 0;
    for (let i = 0; i < scenes.length; i++) {
      acc += scenes[i].seconds;
      if (elapsed < acc) {
        if (i !== idx) {
          setIdx(i);
          if (playing) speak(scenes[i].voiceover);
        }
        return;
      }
    }
    setPlaying(false);
    setElapsed(0);
    setIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const s = scenes[idx];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[9/16] w-[270px] overflow-hidden rounded-[2.2rem] border-[6px] border-raised bg-black shadow-2xl" role="img" aria-label={`Vertical ${platform} preview. Scene ${idx + 1} of ${scenes.length}: ${s?.caption}`}>
        <AnimatePresence mode="wait">
          <motion.div key={idx} className={`absolute inset-0 bg-gradient-to-br ${BG[idx % BG.length]}`} initial={{ opacity: 0, scale: reduced ? 1 : 1.15 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <motion.div className="absolute inset-0 grid place-items-center text-8xl" animate={playing && !reduced ? { scale: [1, 1.12, 1], rotate: [0, 4, -4, 0] } : {}} transition={{ duration: s?.seconds ?? 2, ease: "easeInOut" }} aria-hidden="true">
              {s?.emoji}
            </motion.div>
          </motion.div>
        </AnimatePresence>
        {/* Burned-in captions, centered safe zone */}
        <div className="absolute inset-x-4 top-[58%] text-center" aria-hidden="true">
          <motion.p key={`c-${idx}`} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline rounded-lg bg-black/75 px-2 py-1 font-display text-lg font-bold leading-snug text-white [box-decoration-break:clone]">
            {s?.caption}
          </motion.p>
        </div>
        {disclose && <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">AI-generated</span>}
        <span className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white">{platform}</span>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden="true">
          <div className="h-full bg-white transition-[width]" style={{ width: `${(elapsed / total) * 100}%` }} />
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={() => { if (playing) { stopSpeaking(); setPlaying(false); } else { setPlaying(true); speak(scenes[idx].voiceover); } }}>
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />} {playing ? "Pause" : "Play preview"} · {total}s
      </button>
    </div>
  );
}

function Studio() {
  const { addPortfolio, bump } = useAcademy();
  const { announce } = useA11y();
  const [step, setStep] = useState(0);
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [platform, setPlatform] = useState<Platform>("TikTok");
  const [cta, setCta] = useState("Comment 'AI' and I'll send you the prompt");
  const [seed, setSeed] = useState(0);
  const [hook, setHook] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [disclose, setDisclose] = useState(true);
  const [posts, setPosts] = useState<{ date: string; time: string }[]>(() => {
    const d = new Date();
    return [1, 3, 5].map((o) => {
      const x = new Date(d.getTime() + o * 86_400_000);
      return { date: x.toISOString().slice(0, 10), time: "18:00" };
    });
  });
  const [saved, setSaved] = useState(false);
  const hooks = useMemo(() => generateHooks(niche, audience, seed), [niche, audience, seed]);

  const go = (n: number) => {
    setStep(n);
    announce(`Step ${n + 1}: ${STEPS[n]}`);
  };

  const exportICS = () => {
    const ics = toICS(posts.map((p, i) => ({ title: `Post on ${platform}: ${hook.slice(0, 40)}${i ? ` (repost ${i})` : ""}`, description: scenes.map((s) => s.caption).join("\n"), start: new Date(`${p.date}T${p.time}`) })));
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "rreal-posting-schedule.ics";
    a.click();
    URL.revokeObjectURL(url);
    announce("Calendar file downloaded.");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Social Video Studio" title="Idea → captioned video → scheduled" subtitle="Build a short-form video plan end to end. Then take it to your favourite AI video tool to render." />

      <ol className="mb-8 flex flex-wrap gap-2" aria-label="Studio steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => (i <= step || (i === 1 && niche) ? go(i) : null)} aria-current={step === i ? "step" : undefined} disabled={i > step && !(i === 1 && niche)} className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold ${step === i ? "border-neon bg-neon/15" : i < step ? "border-lime/60 text-lime" : "border-line text-muted"}`}>
              {i < step ? <Check className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>} {s}
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="card">
          {step === 0 && (
            <form className="grid gap-5 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); go(1); }}>
              <div><label htmlFor="niche" className="label">Niche / topic</label><input id="niche" className="input" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. budget meal prep" required /></div>
              <div><label htmlFor="aud" className="label">Audience</label><input id="aud" className="input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. busy college students" /></div>
              <fieldset className="md:col-span-2">
                <legend className="label">Platform</legend>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <label key={p} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-4 ${platform === p ? "border-neon bg-neon/10" : "border-line"}`}>
                      <input type="radio" name="platform" className="accent-[rgb(var(--neon))]" checked={platform === p} onChange={() => setPlatform(p)} /> {p}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="md:col-span-2"><label htmlFor="cta" className="label">Call to action</label><input id="cta" className="input" value={cta} onChange={(e) => setCta(e.target.value)} /></div>
              <button className="btn-primary md:col-span-2 md:justify-self-start" disabled={!niche.trim()}>Generate hooks →</button>
            </form>
          )}

          {step === 1 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Pick your hook</h2>
                <button type="button" className="btn-ghost" onClick={() => setSeed((s) => s + 3)}><RefreshCw className="h-4 w-4" aria-hidden="true" /> More hooks</button>
              </div>
              <div role="radiogroup" aria-label="Hooks" className="grid gap-3 md:grid-cols-2">
                {hooks.map((h) => (
                  <button key={h} type="button" role="radio" aria-checked={hook === h} onClick={() => setHook(h)} className={`rounded-xl border p-4 text-left font-semibold transition ${hook === h ? "border-neon bg-neon/10 shadow-glow" : "border-line hover:border-neon/60"}`}>“{h}”</button>
                ))}
              </div>
              <button type="button" className="btn-primary mt-6" disabled={!hook} onClick={() => { setScenes(generateScript(hook, niche, cta)); go(2); }}>Write the script →</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-1 font-display text-xl font-semibold">Scene-by-scene script</h2>
              <p className="mb-4 text-sm text-muted">Edit anything. Total length: {totalSeconds(scenes)} seconds (sweet spot: 15–35s).</p>
              <ol className="space-y-4">
                {scenes.map((s, i) => (
                  <li key={s.id} className="rounded-xl border border-line p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold">{i === 0 ? "Hook" : i === scenes.length - 1 ? "CTA" : `Value beat ${i}`} <span className="text-muted">· {s.emoji}</span></p>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`sec-${s.id}`} className="text-sm text-muted">Seconds</label>
                        <input id={`sec-${s.id}`} type="number" min={1} max={15} value={s.seconds} onChange={(e) => setScenes((sc) => sc.map((x) => (x.id === s.id ? { ...x, seconds: Number(e.target.value) || 1 } : x)))} className="input w-20 min-h-[40px] py-1" />
                        {scenes.length > 2 && <button type="button" onClick={() => setScenes((sc) => sc.filter((x) => x.id !== s.id))} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:text-danger" aria-label={`Delete scene ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {(["caption", "voiceover", "visual"] as const).map((f) => (
                        <div key={f}>
                          <label htmlFor={`${f}-${s.id}`} className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">{f === "visual" ? "Visual / AI video prompt" : f}</label>
                          <textarea id={`${f}-${s.id}`} rows={3} className="input text-sm" value={s[f]} onChange={(e) => setScenes((sc) => sc.map((x) => (x.id === s.id ? { ...x, [f]: e.target.value } : x)))} />
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn-primary mt-6" onClick={() => go(3)}>Preview video →</button>
            </div>
          )}

          {step === 3 && (
            <div className="grid items-start gap-8 md:grid-cols-[auto_1fr]">
              <PhonePreview scenes={scenes} platform={platform} disclose={disclose} />
              <div className="space-y-4">
                <h2 className="font-display text-xl font-semibold">Pre-flight checklist</h2>
                <ul className="space-y-2">
                  {[
                    ["Hook lands in the first 2 seconds", scenes[0]?.seconds <= 3],
                    ["Total length 15–35 seconds", totalSeconds(scenes) >= 15 && totalSeconds(scenes) <= 35],
                    ["Captions on every scene", scenes.every((s) => s.caption.trim())],
                    ["Clear call to action at the end", !!scenes.at(-1)?.caption.trim()],
                    ["AI disclosure label on", disclose],
                  ].map(([label, ok]) => (
                    <li key={String(label)} className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full ${ok ? "bg-lime text-bg" : "bg-raised text-muted"}`} aria-hidden="true">{ok ? "✓" : "–"}</span>{label as string}<span className="sr-only">{ok ? " — passed" : " — not yet"}</span></li>
                  ))}
                </ul>
                <label className="flex items-center gap-3"><input type="checkbox" checked={disclose} onChange={(e) => setDisclose(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--neon))]" /> Show “AI-generated” label</label>
                <button type="button" className="btn-primary" onClick={() => go(4)}>Schedule posts →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-xl font-semibold">Posting schedule</h2>
              <p className="mb-4 text-sm text-muted">Pick when to post. Export to your calendar with reminders, then upload through {platform} or your scheduler.</p>
              <ul className="space-y-3">
                {posts.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-end gap-3">
                    <div><label htmlFor={`d-${i}`} className="label">Post {i + 1} date</label><input id={`d-${i}`} type="date" className="input" value={p.date} onChange={(e) => setPosts((ps) => ps.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></div>
                    <div><label htmlFor={`t-${i}`} className="label">Time</label><input id={`t-${i}`} type="time" className="input" value={p.time} onChange={(e) => setPosts((ps) => ps.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} /></div>
                    <button type="button" className="btn-ghost" onClick={() => setPosts((ps) => ps.filter((_, j) => j !== i))} aria-label={`Remove post ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="btn-ghost" onClick={() => setPosts((ps) => [...ps, { date: ps.at(-1)?.date ?? new Date().toISOString().slice(0, 10), time: "18:00" }])}>+ Add post</button>
                <button type="button" className="btn-primary" onClick={exportICS} disabled={!posts.length}><CalendarPlus className="h-4 w-4" aria-hidden="true" /> Export to calendar (.ics)</button>
                <button
                  type="button"
                  className="btn-violet"
                  disabled={saved}
                  onClick={() => {
                    addPortfolio({ kind: "video", title: `${platform}: ${hook}`, content: scenes.map((s, i) => `Scene ${i + 1} (${s.seconds}s)\nCaption: ${s.caption}\nVO: ${s.voiceover}\nVisual: ${s.visual}`).join("\n\n") });
                    bump("studioSaves");
                    setSaved(true);
                    announce("Video project saved to your portfolio.");
                  }}
                >
                  <Save className="h-4 w-4" aria-hidden="true" /> {saved ? "Saved to portfolio" : "Save project"}
                </button>
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

export default function StudioPage() {
  return <RequireAuth><Studio /></RequireAuth>;
}
