"use client";

import { useEffect, useState } from "react";
import { Pause, Volume2 } from "lucide-react";
import { useA11y } from "@/lib/a11y";

/** Reads text aloud with live word-highlighted captions. */
export function ReadAloud({ text, autoPlay }: { text: string; autoPlay?: boolean }) {
  const { speak, stopSpeaking, prefs } = useA11y();
  const [playing, setPlaying] = useState(false);
  const [charIdx, setCharIdx] = useState(-1);

  const start = () => {
    setPlaying(true);
    speak(text, { onBoundary: setCharIdx, onEnd: () => { setPlaying(false); setCharIdx(-1); } });
  };
  const stop = () => {
    stopSpeaking();
    setPlaying(false);
    setCharIdx(-1);
  };

  useEffect(() => {
    if (autoPlay) start();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const before = charIdx >= 0 ? text.slice(0, charIdx) : "";
  const rest = charIdx >= 0 ? text.slice(charIdx) : "";
  const word = rest.match(/^\S+/)?.[0] ?? "";

  return (
    <div>
      <button type="button" onClick={playing ? stop : start} className="btn-ghost min-h-[40px] px-3 py-1.5 text-sm" aria-pressed={playing}>
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        {playing ? "Stop" : "Listen"}
      </button>
      {playing && prefs.captions && charIdx >= 0 && (
        <p className="mt-3 rounded-xl bg-black/80 p-3 text-sm leading-relaxed text-white" aria-hidden="true">
          <span className="opacity-60">{before.slice(-120)}</span>
          <mark className="rounded bg-neon px-0.5 text-black">{word}</mark>
          <span>{rest.slice(word.length, word.length + 80)}</span>
        </p>
      )}
    </div>
  );
}
