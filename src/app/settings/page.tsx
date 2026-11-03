"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { A11ySettings } from "@/components/A11yPanel";
import { VoicePicker } from "@/components/VoicePicker";
import { useI18n } from "@/lib/i18n";
import { FormAlert } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";

const AVATARS = ["🦊", "🦄", "🐼", "🦁", "🐙", "🦉", "🐯", "🐸", "🤖", "👩🏽‍🚀", "🧑🏿‍💻", "🧕🏻", "👨🏼‍🎨", "🧑🏾‍🦽"];

function Settings() {
  const { user, progress, subscription, updateProfile, setDailyGoal, cancelSubscription, resetProgress, demo } = useAcademy();
  const router = useRouter();
  const [name, setName] = useState(user!.displayName);
  const [msg, setMsg] = useState("");
  const { lang, setLang } = useI18n();

  const billing = async () => {
    const r = await fetch("/api/stripe/portal", { method: "POST" });
    if (r.status === 501) {
      if (confirm("Demo mode: cancel your local trial?")) cancelSubscription();
      return;
    }
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else setMsg(j.error ?? "Billing unavailable.");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ account: user, progress, subscription }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rreal-academy-my-data.json";
    a.click();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="Settings" title="Your account" />
      {msg && <div className="mb-6"><FormAlert kind="success">{msg}</FormAlert></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-5" aria-labelledby="profile-h">
          <h2 id="profile-h" className="font-display text-xl font-semibold">Profile</h2>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateProfile({ displayName: name.trim() || user!.displayName }); setMsg("Profile saved."); }}>
            <div>
              <label htmlFor="dn" className="label">Display name (appears on certificates)</label>
              <input id="dn" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <p className="text-sm text-muted">Username: <strong className="text-ink">@{user!.username}</strong> · Email: <strong className="text-ink">{user!.email}</strong></p>
            <button className="btn-primary">Save profile</button>
          </form>
          <fieldset>
            <legend className="label">Avatar</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
              {AVATARS.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={user!.avatar === a} aria-label={`Avatar ${a}`} onClick={() => updateProfile({ avatar: a })} className={`grid h-12 w-12 place-items-center rounded-xl border text-2xl ${user!.avatar === a ? "border-neon bg-neon/15" : "border-line"}`}>{a}</button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="goal" className="label">Daily XP goal</label>
            <select id="goal" className="input" value={progress.dailyGoalXp} onChange={(e) => setDailyGoal(Number(e.target.value))}>
              {[50, 100, 200, 300].map((x) => <option key={x} value={x}>{x} XP</option>)}
            </select>
          </div>
        </section>

        <section className="card space-y-4" aria-labelledby="voice-h">
          <h2 id="voice-h" className="font-display text-xl font-semibold">Language & coach voice</h2>
          <div role="radiogroup" aria-label="Language" className="flex gap-2">
            {(["en", "es"] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={`btn-ghost ${lang === l ? "border-neon" : ""}`}>{l === "en" ? "English" : "Español"}</button>
            ))}
          </div>
          <VoicePicker />
        </section>

        <section className="card" aria-labelledby="a11y-h">
          <h2 id="a11y-h" className="font-display text-xl font-semibold">Accessibility</h2>
          <A11ySettings />
        </section>

        <section className="card space-y-4" aria-labelledby="bill-h">
          <h2 id="bill-h" className="font-display text-xl font-semibold">Plan & billing</h2>
          <p>Status: <strong className="capitalize">{subscription.status === "none" ? "Free" : subscription.status}</strong>{subscription.plan && ` · ${subscription.plan}`}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-ghost" onClick={() => router.push("/pricing")}>Change plan</button>
            {subscription.status !== "none" && <button type="button" className="btn-ghost" onClick={billing}>Manage billing / cancel</button>}
          </div>
        </section>

        <section className="card space-y-4" aria-labelledby="data-h">
          <h2 id="data-h" className="font-display text-xl font-semibold">Your data</h2>
          <p className="text-sm text-muted">Download everything we store about your learning, anytime.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-ghost" onClick={exportData}>Export my data (JSON)</button>
            {demo && <button type="button" className="btn-ghost text-danger" onClick={() => { if (confirm("Reset all progress? This can't be undone.")) resetProgress(); }}>Reset progress</button>}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <RequireAuth><Settings /></RequireAuth>;
}
