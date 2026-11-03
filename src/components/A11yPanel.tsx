"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useA11y, type Prefs } from "@/lib/a11y";

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="font-medium">{label}</label>
        {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors ${checked ? "border-neon bg-neon" : "border-line bg-raised"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-bg shadow transition-transform ${checked ? "translate-x-6" : "translate-x-0.5"}`} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

export function A11ySettings() {
  const { prefs, setPref, reset } = useA11y();
  const t = <K extends keyof Prefs>(k: K) => (v: Prefs[K]) => setPref(k, v);
  return (
    <div className="divide-y divide-line/50">
      <fieldset className="py-3">
        <legend className="mb-2 font-medium">Text size</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Text size">
          {[1, 1.15, 1.3, 1.5].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={prefs.fontScale === s} onClick={() => setPref("fontScale", s)} className={`flex-1 rounded-xl border px-2 py-2 font-semibold ${prefs.fontScale === s ? "border-neon bg-neon/15 text-ink" : "border-line text-muted"}`} style={{ fontSize: `${s}rem` }}>
              A<span className="sr-only"> {Math.round(s * 100)}%</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Toggle id="pref-theme" label="Light theme" hint="Switch from the dark neon theme to a light theme." checked={prefs.theme === "light"} onChange={(v) => setPref("theme", v ? "light" : "dark")} />
      <Toggle id="pref-contrast" label="High contrast" hint="Maximum contrast, solid surfaces, underlined links (WCAG AAA)." checked={prefs.contrast === "high"} onChange={(v) => setPref("contrast", v ? "high" : "normal")} />
      <Toggle id="pref-motion" label="Reduce motion" hint="Turns off animations, confetti and parallax." checked={prefs.motion === "reduce"} onChange={(v) => setPref("motion", v ? "reduce" : "system")} />
      <Toggle id="pref-readable" label="Readable spacing" hint="Extra letter, word and line spacing — helpful for dyslexia." checked={prefs.readable} onChange={t("readable")} />
      <Toggle id="pref-captions" label="Live captions" hint="Show captions for everything the Coach says and hears." checked={prefs.captions} onChange={t("captions")} />
      <Toggle id="pref-read" label="Auto read-aloud lessons" hint="Lessons are read to you automatically (great with screen-off learning)." checked={prefs.autoReadAloud} onChange={t("autoReadAloud")} />
      <Toggle id="pref-sounds" label="Sound effects" checked={prefs.sounds} onChange={t("sounds")} />
      <Toggle id="pref-visual" label="Visual alerts" hint="Screen-edge flash whenever a sound plays — for deaf and hard-of-hearing learners." checked={prefs.visualAlerts} onChange={t("visualAlerts")} />
      <div className="py-3">
        <label htmlFor="pref-rate" className="font-medium">Voice speed: {prefs.voiceRate.toFixed(1)}×</label>
        <input id="pref-rate" type="range" min={0.6} max={1.6} step={0.1} value={prefs.voiceRate} onChange={(e) => setPref("voiceRate", Number(e.target.value))} className="mt-2 w-full accent-[rgb(var(--neon))]" />
      </div>
      <div className="pt-4">
        <button type="button" onClick={reset} className="btn-ghost w-full">Reset to defaults</button>
      </div>
    </div>
  );
}

export function A11yPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, [href], input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea");
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="a11y-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-[61] h-full w-full max-w-md overflow-y-auto border-l border-line bg-surface p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="a11y-title" className="font-display text-2xl font-bold">Accessibility</h2>
              <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl border border-line" aria-label="Close accessibility settings">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-2 text-sm text-muted">Settings save on this device and apply instantly. Shortcut: <kbd className="rounded border border-line px-1.5">Alt</kbd> + <kbd className="rounded border border-line px-1.5">A</kbd></p>
            <A11ySettings />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
