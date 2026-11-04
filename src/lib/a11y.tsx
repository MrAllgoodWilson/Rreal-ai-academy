"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

export interface Prefs {
  theme: "dark" | "light";
  contrast: "normal" | "high";
  fontScale: number;
  motion: "system" | "reduce";
  readable: boolean;
  captions: boolean;
  autoReadAloud: boolean;
  sounds: boolean;
  visualAlerts: boolean;
  voiceRate: number;
  voicePitch: number;
  /** "premium" = selected cloud/ElevenLabs voice; "device" = selected browser voice. */
  voiceProvider: "premium" | "device";
  premiumVoiceId: string;
  deviceVoiceName: string;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  contrast: "normal",
  fontScale: 1,
  motion: "system",
  readable: false,
  captions: true,
  autoReadAloud: false,
  sounds: true,
  visualAlerts: true,
  voiceRate: 1,
  voicePitch: 1,
  voiceProvider: "premium",
  premiumVoiceId: "cf:en:asteria",
  deviceVoiceName: "",
};

const KEY = "rreal.v1.prefs";

interface A11yCtx {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  reset: () => void;
  /** Announce text to screen readers via aria-live */
  announce: (msg: string, politeness?: "polite" | "assertive") => void;
  /** Visual flash for auditory alerts (deaf / hard-of-hearing users) */
  flash: () => void;
  /** Short UI sound. Always paired with a visual cue. */
  chime: (kind?: "success" | "level") => void;
  speak: (text: string, opts?: { onBoundary?: (charIndex: number) => void; onEnd?: () => void }) => void;
  stopSpeaking: () => void;
}

const Ctx = createContext<A11yCtx | null>(null);

export function A11yProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = prefs.theme;
    el.dataset.contrast = prefs.contrast;
    el.dataset.motion = prefs.motion;
    el.dataset.readable = String(prefs.readable);
    el.style.setProperty("--font-scale", String(prefs.fontScale));
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  const announce = useCallback((msg: string, politeness: "polite" | "assertive" = "polite") => {
    const set = politeness === "assertive" ? setAssertive : setPolite;
    set("");
    setTimeout(() => set(msg), 50);
  }, []);

  const flash = useCallback(() => {
    if (!prefs.visualAlerts) return;
    setFlashing(true);
    setTimeout(() => setFlashing(false), 450);
  }, [prefs.visualAlerts]);

  const chime = useCallback(
    (kind: "success" | "level" = "success") => {
      flash();
      if (!prefs.sounds) return;
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const notes = kind === "level" ? [523, 659, 784, 1047] : [660, 990];
        notes.forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.09 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.25);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + i * 0.09);
          o.stop(ctx.currentTime + i * 0.09 + 0.3);
        });
        setTimeout(() => ctx.close(), 1200);
      } catch {}
    },
    [prefs.sounds, flash],
  );

  const speak = useCallback<A11yCtx["speak"]>(
    (text, opts) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        opts?.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = prefs.voiceRate;
      u.pitch = prefs.voicePitch;
      const lang = document.documentElement.lang === "es" ? "es" : "en";
      u.lang = lang === "es" ? "es-US" : "en-US";
      const voices = window.speechSynthesis.getVoices();
      const chosen = voices.find((v) => v.name === prefs.deviceVoiceName && v.lang.toLowerCase().startsWith(lang));
      const preferred = chosen ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang) && /(natural|neural|samantha|google|aria|jenny|paulina|monica)/i.test(v.name)) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang));
      if (preferred) u.voice = preferred;
      u.onboundary = (e) => opts?.onBoundary?.(e.charIndex);
      u.onend = () => opts?.onEnd?.();
      u.onerror = () => opts?.onEnd?.();
      window.speechSynthesis.speak(u);
    },
    [prefs.voiceRate, prefs.voicePitch, prefs.deviceVoiceName],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  return (
    <Ctx.Provider value={{ prefs, setPref: (k, v) => setPrefs((p) => ({ ...p, [k]: v })), reset: () => setPrefs(DEFAULT_PREFS), announce, flash, chime, speak, stopSpeaking }}>
      <MotionConfig reducedMotion={prefs.motion === "reduce" ? "always" : "user"}>{children}</MotionConfig>
      <div aria-live="polite" aria-atomic="true" className="sr-only">{polite}</div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">{assertive}</div>
      <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-[100] border-[6px] border-neon transition-opacity duration-150 ${flashing ? "opacity-100" : "opacity-0"}`} />
    </Ctx.Provider>
  );
}

export function useA11y() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useA11y must be used inside <A11yProvider>");
  return c;
}
