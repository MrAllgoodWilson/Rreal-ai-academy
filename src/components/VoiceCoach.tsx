"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Captions, Keyboard, Loader2, Mic, MicOff, Send, Square, Volume2, VolumeX } from "lucide-react";
import { useA11y } from "@/lib/a11y";
import { useAcademy } from "@/lib/store";
import { getLessonRef } from "@/lib/curriculum";
import type { CoachMode } from "@/lib/coach-offline";
import { SPEECH_LANG, useI18n } from "@/lib/i18n";
import { VoicePicker } from "@/components/VoicePicker";
import { apiHeaders } from "@/lib/byok";

/* Minimal typings for the Web Speech API (not in TS DOM lib everywhere) */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

interface Msg { role: "user" | "assistant"; content: string }

const MODES: { id: CoachMode; label: string; hint: string }[] = [
  { id: "chat", label: "Ask anything", hint: "Explain, brainstorm, troubleshoot" },
  { id: "quiz", label: "Quiz me", hint: "Spoken quiz with instant feedback" },
  { id: "grade", label: "Grade my prompt", hint: "Score 0–100 with fixes" },
  { id: "interview", label: "Interview practice", hint: "Mock AI-job interview" },
];

/** Live mic waveform (real audio) or synthetic speaking waveform for the coach's voice. */
function Waveform({ stream, speaking }: { stream: MediaStream | null; speaking: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let analyser: AnalyserNode | null = null;
    let audioCtx: AudioContext | null = null;
    if (stream) {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
    }
    const data = new Uint8Array(64);
    const styles = getComputedStyle(document.documentElement);
    const neon = `rgb(${styles.getPropertyValue("--neon").trim().replace(/ /g, ",")})`;
    const violet = `rgb(${styles.getPropertyValue("--violet").trim().replace(/ /g, ",")})`;
    const draw = (t: number) => {
      const { width: w, height: h } = c;
      ctx.clearRect(0, 0, w, h);
      const bars = 48;
      if (analyser) analyser.getByteFrequencyData(data);
      for (let i = 0; i < bars; i++) {
        let v: number;
        if (analyser) v = data[Math.floor((i / bars) * 48)] / 255;
        else if (speaking) v = 0.25 + 0.6 * Math.abs(Math.sin(t / 180 + i * 0.5) * Math.cos(t / 330 + i * 0.21));
        else v = 0.06 + 0.04 * Math.sin(t / 600 + i * 0.4);
        const bh = Math.max(4, v * h * 0.9);
        const x = (i / bars) * w;
        const g = ctx.createLinearGradient(0, h, 0, 0);
        g.addColorStop(0, neon);
        g.addColorStop(1, violet);
        ctx.fillStyle = g;
        const bw = w / bars - 3;
        ctx.beginPath();
        ctx.roundRect(x, (h - bh) / 2, bw, bh, bw / 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      audioCtx?.close();
    };
  }, [stream, speaking]);
  return <canvas ref={canvas} width={720} height={120} className="h-24 w-full" aria-hidden="true" />;
}

export function VoiceCoach({ lessonId }: { lessonId?: string }) {
  const { prefs, announce } = useA11y();
  const { lang } = useI18n();
  const { bump, progress } = useAcademy();
  const [showVoices, setShowVoices] = useState(false);
  const lesson = lessonId ? getLessonRef(lessonId) : undefined;
  const [mode, setMode] = useState<CoachMode>("chat");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: lesson ? `Hi! I'm your Rreal Coach. Let's dig into "${lesson.lesson.title}". Ask me anything about it, or switch to Quiz mode.` : "Hi! I'm your Rreal Coach. Tap the mic and talk to me, or type below. I can explain anything about AI, quiz you, grade your prompts, or run a mock interview." },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [supported, setSupported] = useState(true);
  const [engine, setEngine] = useState<"live" | "offline" | null>(null);
  const pendingQuiz = useRef<string | undefined>(undefined);
  const recog = useRef<SpeechRecognitionLike | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const usedVoice = useRef(false);

  useEffect(() => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const stopVoice = useCallback(() => {
    window.speechSynthesis?.cancel();
    audioEl.current?.pause();
    setSpeaking(false);
    setCaption("");
  }, []);

  const say = useCallback(
    async (text: string) => {
      if (!voiceOn) return;
      stopVoice();
      setSpeaking(true);
      // Premium voice via ElevenLabs if configured, otherwise browser TTS
      try {
        const res = prefs.voiceProvider === "premium" ? await fetch("/api/tts", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ text, voiceId: prefs.premiumVoiceId, lang }) }) : null;
        if (res?.ok && res.headers.get("content-type")?.includes("audio")) {
          const url = URL.createObjectURL(await res.blob());
          const a = new Audio(url);
          audioEl.current = a;
          a.playbackRate = prefs.voiceRate;
          // Approximate caption sync by audio progress
          a.ontimeupdate = () => {
            const i = Math.floor((a.currentTime / (a.duration || 1)) * text.length);
            setCaption(text.slice(Math.max(0, text.lastIndexOf(" ", i - 60)), i + 40));
          };
          a.onended = () => { setSpeaking(false); setCaption(""); URL.revokeObjectURL(url); };
          await a.play();
          return;
        }
      } catch {
        /* fall back */
      }
      if (!("speechSynthesis" in window)) { setSpeaking(false); return; }
      const u = new SpeechSynthesisUtterance(text.replace(/[•✅]/g, ""));
      u.rate = prefs.voiceRate;
      u.pitch = prefs.voicePitch;
      u.lang = SPEECH_LANG[lang];
      const all = window.speechSynthesis.getVoices().filter((x) => x.lang.toLowerCase().startsWith(lang));
      const v = all.find((x) => x.name === prefs.deviceVoiceName) ?? all.find((x) => /(natural|neural|samantha|google|aria|jenny|paulina|monica)/i.test(x.name)) ?? all[0];
      if (v) u.voice = v;
      u.onboundary = (e) => setCaption(text.slice(Math.max(0, text.lastIndexOf(" ", e.charIndex - 60)), e.charIndex + 40));
      u.onend = () => { setSpeaking(false); setCaption(""); };
      u.onerror = () => { setSpeaking(false); setCaption(""); };
      window.speechSynthesis.speak(u);
    },
    [voiceOn, prefs.voiceRate, prefs.voicePitch, prefs.voiceProvider, prefs.premiumVoiceId, prefs.deviceVoiceName, lang, stopVoice],
  );

  const send = useCallback(
    async (text: string, modeOverride?: CoachMode) => {
      const content = text.trim();
      if (!content || busy) return;
      stopVoice();
      const next = [...messages, { role: "user" as const, content }];
      setMessages(next);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ messages: next.slice(-12), mode: modeOverride ?? mode, lessonId, lang, pendingQuizId: pendingQuiz.current, learner: { level: progress.onboarding.placementLevel, goal: progress.onboarding.goal } }),
        });
        const json = await res.json();
        const reply: string = json.reply ?? "Sorry, I couldn't respond just now.";
        pendingQuiz.current = json.pendingQuizId;
        setEngine(json.mode ?? null);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        announce(`Coach says: ${reply}`);
        say(reply);
      } catch {
        setMessages((m) => [...m, { role: "assistant", content: "I'm having trouble connecting. Check your internet and try again." }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, mode, lessonId, lang, progress.onboarding, announce, say, stopVoice],
  );

  const startListening = async () => {
    stopVoice();
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
    } catch {
      announce("Microphone permission was denied. You can still type to the coach.", "assertive");
      return;
    }
    const r = new SR();
    r.lang = SPEECH_LANG[lang];
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      setInterim(finalText + interimText);
    };
    r.onerror = () => stopListening();
    r.onend = () => {
      setListening(false);
      setInterim("");
      setStream((s) => { s?.getTracks().forEach((t) => t.stop()); return null; });
      if (finalText.trim()) send(finalText);
    };
    recog.current = r;
    r.start();
    setListening(true);
    announce("Listening. Speak now.");
    if (!usedVoice.current) {
      usedVoice.current = true;
      bump("voiceSessions");
    }
  };

  const stopListening = () => {
    recog.current?.stop();
    setListening(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="glass flex min-h-[600px] flex-col overflow-hidden" aria-label="Conversation with Rreal Coach">
        {/* Voice stage */}
        <div className="border-b border-line/60 bg-bg/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-neon to-violet">
                <Mic className="h-6 w-6 text-bg" aria-hidden="true" />
                {(listening || speaking) && <span className="absolute inset-0 animate-ping rounded-full bg-neon/40" aria-hidden="true" />}
              </div>
              <div>
                <p className="font-semibold">Rreal Coach</p>
                <p className="text-xs text-muted" aria-live="polite">
                  {listening ? "● Listening…" : speaking ? "● Speaking…" : busy ? "Thinking…" : "Ready"}
                  {engine && <span className="ml-2 chip py-0">{engine === "live" ? "Claude live" : "offline coach"}</span>}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => { setVoiceOn((v) => !v); stopVoice(); }} className="btn-ghost min-h-[40px] px-3 text-sm" aria-pressed={voiceOn}>
              {voiceOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />} Voice {voiceOn ? "on" : "off"}
            </button>
          </div>
          <Waveform stream={stream} speaking={speaking} />
          {/* Live captions — synchronized for deaf & hard-of-hearing learners */}
          {prefs.captions && (
            <div className="min-h-[3.5rem] rounded-xl bg-black/85 px-4 py-3 text-center text-lg font-semibold leading-snug text-white" aria-hidden="true">
              <span className="mr-2 inline-flex items-center gap-1 align-middle text-xs font-bold uppercase tracking-widest text-neon"><Captions className="h-4 w-4" /> CC</span>
              {listening ? interim || "…" : caption || <span className="text-white/50">Captions appear here</span>}
            </div>
          )}
        </div>

        {/* Transcript */}
        <div ref={logRef} role="log" aria-label="Transcript" aria-live="off" tabIndex={0} className="flex-1 space-y-4 overflow-y-auto p-5" style={{ maxHeight: 420 }}>
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 ${m.role === "user" ? "rounded-br-sm bg-neon text-bg" : "rounded-bl-sm border border-line bg-raised/70"}`}>
                  <span className="sr-only">{m.role === "user" ? "You said: " : "Coach said: "}</span>
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {busy && (
            <div className="flex gap-1.5 px-2" aria-hidden="true">
              {[0, 1, 2].map((i) => <motion.span key={i} className="h-2.5 w-2.5 rounded-full bg-violet" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />)}
            </div>
          )}
        </div>

        {/* Controls */}
        <form className="flex items-end gap-2 border-t border-line/60 p-4" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            disabled={!supported || busy}
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl transition ${listening ? "bg-danger text-bg" : "bg-gradient-to-br from-neon to-violet text-bg hover:shadow-glow"} disabled:opacity-40`}
            aria-label={listening ? "Stop listening" : "Start talking"}
            aria-pressed={listening}
          >
            {listening ? <Square className="h-6 w-6" aria-hidden="true" /> : supported ? <Mic className="h-6 w-6" aria-hidden="true" /> : <MicOff className="h-6 w-6" aria-hidden="true" />}
          </button>
          <div className="flex-1">
            <label htmlFor="coach-input" className="sr-only">Message the coach</label>
            <textarea
              id="coach-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={mode === "grade" ? "Paste a prompt to grade…" : mode === "quiz" ? "Type 'start' or your answer (A–D)…" : "Type a message…"}
              className="input min-h-[56px] resize-none"
            />
          </div>
          <button type="submit" disabled={!input.trim() || busy} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-line hover:border-neon disabled:opacity-40" aria-label="Send message">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5" aria-hidden="true" />}
          </button>
        </form>
        {!supported && (
          <p className="flex items-center gap-2 px-4 pb-4 text-sm text-muted"><Keyboard className="h-4 w-4" aria-hidden="true" /> Voice input isn’t supported in this browser (try Chrome, Edge or Safari). Typing works everywhere.</p>
        )}
      </section>

      <aside className="space-y-4" aria-label="Coach modes">
        <div className="card">
          <h2 className="mb-3 font-display text-lg font-semibold">Mode</h2>
          <div role="radiogroup" aria-label="Coach mode" className="space-y-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  pendingQuiz.current = undefined;
                  if (m.id === "quiz" || m.id === "interview") send(m.id === "quiz" ? "Start the quiz" : "Start the interview", m.id);
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${mode === m.id ? "border-neon bg-neon/10" : "border-line hover:border-neon/60"}`}
              >
                <span className="block font-semibold">{m.label}</span>
                <span className="block text-xs text-muted">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Coach voice</h2>
            <button type="button" className="text-sm text-neon underline" aria-expanded={showVoices} aria-controls="coach-voices" onClick={() => setShowVoices((v) => !v)}>{showVoices ? "Hide" : "Choose voice"}</button>
          </div>
          {showVoices && <div id="coach-voices" className="mt-4"><VoicePicker /></div>}
        </div>
        <div className="card text-sm text-muted">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">Tips</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Press <kbd className="rounded border border-line px-1">Enter</kbd> to send, <kbd className="rounded border border-line px-1">Shift+Enter</kbd> for a new line.</li>
            <li>Captions follow everything you say and hear.</li>
            <li>Screen readers: the transcript is a log region; new replies are announced.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
