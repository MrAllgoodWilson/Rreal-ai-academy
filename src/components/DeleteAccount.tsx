"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAcademy } from "@/lib/store";

/** Permanent account deletion with type-to-confirm. Production only (demo mode has "Reset progress"). */
export function DeleteAccount() {
  const { signOut } = useAcademy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: text }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      await signOut();
      router.push("/");
      return;
    }
    setBusy(false);
    setErr(j.error ?? "Something went wrong. Please try again.");
  };

  if (!open)
    return <button type="button" className="btn-ghost min-h-[44px] text-danger" onClick={() => setOpen(true)}>Delete my account…</button>;

  return (
    <form onSubmit={go} className="space-y-3 rounded-xl border border-danger/60 p-4">
      <p className="text-sm">This permanently deletes your profile, progress, certificates, credits and private courses. It can&apos;t be undone. Cancel your membership first if you have one.</p>
      <label htmlFor="del-confirm" className="label">Type DELETE to confirm</label>
      <input id="del-confirm" className="input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary min-h-[44px] bg-danger" disabled={busy || text !== "DELETE"}>{busy ? "Deleting…" : "Permanently delete my account"}</button>
        <button type="button" className="btn-ghost min-h-[44px]" onClick={() => { setOpen(false); setText(""); setErr(""); }}>Keep my account</button>
      </div>
    </form>
  );
}
