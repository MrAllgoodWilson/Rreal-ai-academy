"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import { useA11y } from "@/lib/a11y";
import { useI18n } from "@/lib/i18n";
import { CLOUD_VOICES, PREMIUM_VOICES, guessGender, type Gender } from "@/lib/voices";
import { getByok } from "@/lib/byok";
import { apiHeaders } from "@/lib/byok";

const SAMPLE = { en: "Hi! I'm your Rreal Coach. Let's learn something amazing today.", es: "¡Hola! Soy tu Coach Rreal. Aprendamos algo increíble hoy." };

/** Lets learners choose the coach's voice: premium (ElevenLabs) or any voice on their device, filtered by gender. */
export function VoicePicker() {
  const { prefs, setPref } = useA11y();
  const { lang } = useI18n();
  const [gender, setGender] = useState<Gender | "all">("all");
  const [device, setDevice] = useState<SpeechSynthesisVoice[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [eleven, setEleven] = useState(false);

  useEffect(() => {
    const own = Boolean(getByok().elevenlabs);
    setEleven(own);
    fetch("/api/health").then((r) => r.json()).then((h: { integrations?: { elevenlabs?: boolean } }) => setEleven(own || Boolean(h.integrations?.elevenlabs))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setDevice(window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang)));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [lang]);

  const premium = useMemo(() => [...CLOUD_VOICES.filter((v) => v.lang === lang), ...(eleven ? PREMIUM_VOICES : [])].filter((v) => gender === "all" || v.gender === gender), [gender, lang, eleven]);
  const devices = useMemo(() => device.filter((v) => gender === "all" || guessGender(v.name) === gender), [device, gender]);

  const stop = () => {
    window.speechSynthesis?.cancel();
    document.querySelectorAll<HTMLAudioElement>("audio[data-voice-preview]").forEach((a) => a.pause());
    setPlaying(null);
  };

  const previewPremium = async (id: string) => {
    stop();
    setPlaying(id);
    const res = await fetch("/api/tts", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ text: SAMPLE[lang], voiceId: id, lang }) }).catch(() => null);
    if (res?.ok && res.headers.get("content-type")?.includes("audio")) {
      const a = new Audio(URL.createObjectURL(await res.blob()));
      a.dataset.voicePreview = "1";
      a.onended = () => setPlaying(null);
      a.play();
    } else setPlaying(null);
  };

  const previewDevice = (v: SpeechSynthesisVoice) => {
    stop();
    const u = new SpeechSynthesisUtterance(SAMPLE[lang]);
    u.voice = v;
    u.rate = prefs.voiceRate;
    u.pitch = prefs.voicePitch;
    u.onend = () => setPlaying(null);
    setPlaying(v.name);
    window.speechSynthesis.speak(u);
  };

  const row = (selected: boolean) => `flex items-center justify-between gap-3 rounded-xl border p-3 ${selected ? "border-neon bg-neon/10" : "border-line"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Voice source">
        {(["premium", "device"] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={prefs.voiceProvider === p} onClick={() => setPref("voiceProvider", p)} className={`chip min-h-[40px] px-4 text-sm ${prefs.voiceProvider === p ? "border-neon text-ink" : ""}`}>
            {p === "premium" ? "Premium voices" : "Device voices (offline)"}
          </button>
        ))}
      </div>
      {prefs.voiceProvider === "premium" && !eleven && (
        <p className="text-sm text-muted">{lang === "es" ? "Estas voces están incluidas en tu membresía. Conecta tu cuenta de ElevenLabs en Ajustes para 12 voces más." : "These voices are included with your membership. Connect your ElevenLabs account in Settings → Your AI accounts for 12 more."}</p>
      )}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Voice gender">
        {(["all", "female", "male", "neutral"] as const).map((g) => (
          <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => setGender(g)} className={`chip min-h-[36px] px-3 capitalize ${gender === g ? "border-violet text-ink" : ""}`}>
            {g}
          </button>
        ))}
      </div>

      <ul className="max-h-72 space-y-2 overflow-y-auto pr-1" tabIndex={0} aria-label="Available voices">
        {prefs.voiceProvider === "premium"
          ? premium.map((v) => (
              <li key={v.id} className={row(prefs.premiumVoiceId === v.id)}>
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input type="radio" name="premium-voice" checked={prefs.premiumVoiceId === v.id} onChange={() => setPref("premiumVoiceId", v.id)} className="h-5 w-5 accent-[rgb(var(--neon))]" />
                  <span>
                    <span className="block font-semibold">{v.name}</span>
                    <span className="block text-xs text-muted">{v.gender} · {v.accent} · {v.style}</span>
                  </span>
                </label>
                <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-line" aria-label={`Preview ${v.name}`} onClick={() => (playing === v.id ? stop() : previewPremium(v.id))}>
                  {playing === v.id ? <Square className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                </button>
              </li>
            ))
          : devices.map((v) => (
              <li key={v.name} className={row(prefs.deviceVoiceName === v.name)}>
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input type="radio" name="device-voice" checked={prefs.deviceVoiceName === v.name} onChange={() => setPref("deviceVoiceName", v.name)} className="h-5 w-5 accent-[rgb(var(--neon))]" />
                  <span>
                    <span className="block font-semibold">{v.name}</span>
                    <span className="block text-xs capitalize text-muted">{guessGender(v.name)} · {v.lang}</span>
                  </span>
                </label>
                <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-line" aria-label={`Preview ${v.name}`} onClick={() => (playing === v.name ? stop() : previewDevice(v))}>
                  {playing === v.name ? <Square className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                </button>
              </li>
            ))}
        {prefs.voiceProvider === "device" && devices.length === 0 && <li className="text-sm text-muted">No device voices match. Try “all” or Premium voices.</li>}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vp-rate" className="label">Speed: {prefs.voiceRate.toFixed(1)}×</label>
          <input id="vp-rate" type="range" min={0.6} max={1.6} step={0.1} value={prefs.voiceRate} onChange={(e) => setPref("voiceRate", Number(e.target.value))} className="w-full accent-[rgb(var(--neon))]" />
        </div>
        <div>
          <label htmlFor="vp-pitch" className="label">Pitch (device voices): {prefs.voicePitch.toFixed(1)}</label>
          <input id="vp-pitch" type="range" min={0.5} max={1.5} step={0.1} value={prefs.voicePitch} onChange={(e) => setPref("voicePitch", Number(e.target.value))} className="w-full accent-[rgb(var(--neon))]" />
        </div>
      </div>
    </div>
  );
}
