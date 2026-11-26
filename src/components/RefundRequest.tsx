"use client";

import { useState } from "react";
import { REFUND_KINDS, type RefundKind } from "@/lib/refund-policy";

/** Asks a person to review a refund. It never issues a refund by itself. */
export function RefundRequest() {
  const [kind, setKind] = useState<RefundKind>("first_charge");
  const [details, setDetails] = useState("");
  const [purchasedOn, setPurchasedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setStatus(null);
    try {
      const r = await fetch("/api/refund-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, details, purchasedOn }) });
      const j = await r.json().catch(() => ({}));
      setStatus({ ok: r.ok, text: j.message || j.error || (r.ok ? "Sent." : "Something went wrong. Please try again.") });
      if (r.ok) setDetails("");
    } catch {
      setStatus({ ok: false, text: "We could not reach the server. Please try again, or email support." });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby="refund-status">
      <div>
        <label htmlFor="refund-kind" className="label">What is the refund for?</label>
        <select id="refund-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as RefundKind)}>
          {REFUND_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="refund-date" className="label">Date of the charge (optional)</label>
        <input id="refund-date" type="date" className="input" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />
      </div>
      <div>
        <label htmlFor="refund-details" className="label">Tell us what happened</label>
        <textarea id="refund-details" className="input min-h-[7rem]" required minLength={10} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send refund request"}</button>
      <p id="refund-status" role="status" aria-live="polite" className={status ? (status.ok ? "text-lime" : "text-danger") : "sr-only"}>{status?.text ?? ""}</p>
    </form>
  );
}
