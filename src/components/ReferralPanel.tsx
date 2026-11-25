"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { referralProgress, type ReferralDashboard } from "@/lib/referrals";
interface Dashboard extends ReferralDashboard { url?: string; qr?: string }
export function ReferralPanel() {
  const { lang } = useI18n();
  const es = lang === "es";
  const [data, setData] = useState<Dashboard | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    const load = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const res = await fetch("/api/referrals", { signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const next = await res.json();
        if (!controller.signal.aborted) { setData(next); setNotice(""); }
      } catch {
        if (!controller.signal.aborted) setNotice(es ? "El estado de referidos no está disponible. Tu acceso a funciones existente no cambia." : "Referral status is unavailable. Your existing feature allowances are unchanged.");
      } finally { loading = false; }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 60_000);
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [es]);
  async function acknowledge(id: string) {
    try {
      const res = await fetch("/api/referrals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "acknowledge", rewardId: id }) });
      if (!res.ok || !(await res.json()).ok) throw new Error("unavailable");
      setData((current) => current ? { ...current, rewards: current.rewards?.map((r) => r.id === id ? { ...r, seen: true } : r) } : current);
    } catch { setNotice(es ? "No se pudo cerrar el aviso. Reintenta." : "Could not dismiss this notice. Please retry."); }
  }
  const progress = data ? referralProgress(data) : null;
  return <section className="card p-5" aria-labelledby="referrals-title">
    <h2 id="referrals-title" className="text-xl font-bold">{es ? "Invita a otros estudiantes" : "Invite learners"}</h2>
    {notice && <p role="status">{notice}</p>}
    {!data && !notice && <p role="status">{es ? "Cargando referidos…" : "Loading referral status…"}</p>}
    {data && !data.eligible && <p>{es ? "Tu enlace estará disponible después del primer pago válido de $1 de membresía." : "Your referral link becomes available after your first qualifying $1 membership payment."}</p>}
    {data?.eligible && <>
      <p>{es ? `Cada ${data.threshold} estudiantes nuevos con pagos válidos generan $${(data.rewardCents / 100).toFixed(2)} en acceso a funciones de proyectos. ${data.holdDays === 0 ? "Los pagos válidos liquidados cuentan de inmediato; se revisan fraude y reembolsos." : `Los pagos califican después de ${data.holdDays} días y revisión de fraude/reembolsos.`} Las renovaciones no cuentan.` : `Every ${data.threshold} distinct qualifying new paid learners earns $${(data.rewardCents / 100).toFixed(2)} worth of project feature access. ${data.holdDays === 0 ? "Settled qualifying payments count immediately; fraud/refund checks apply." : `Payments qualify after ${data.holdDays} days and fraud/refund checks.`} Renewals do not count.`}</p>
      <label className="label mt-3" htmlFor="referral-link">{es ? "Tu enlace de referido" : "Your referral link"}</label>
      <input id="referral-link" className="input w-full" readOnly value={data.url || ""} onFocus={(event) => event.currentTarget.select()} />
      <p className="mt-2 break-all">{es ? "Código" : "Code"}: <code>{data.code}</code></p>
      {/* Local QR has the full link available as accessible text above. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {data.qr && <img src={data.qr} width={240} height={240} alt={es ? "Código QR de tu enlace de referido" : "QR code for your referral link"} />}
      <p>{es ? `${data.visits || 0} visitas; ${data.signups || 0} registros atribuidos. Las visitas pueden incluir repeticiones y bots; no generan recompensas.` : `${data.visits || 0} link visits; ${data.signups || 0} attributed signups. Visits may include repeat visitors and bots; they do not earn rewards.`}</p>
      <p>{es ? `${progress?.towardNext} de ${data.threshold} para la próxima recompensa; ${data.pending || 0} pagos pendientes de revisión.` : `${progress?.towardNext} of ${data.threshold} toward your next reward; ${data.pending || 0} paid referrals pending checks.`}</p>
      <p className="text-sm">{es ? "Comparte con transparencia: «Puedo ganar acceso a funciones si te unes con mi enlace». No hay pagos en efectivo ni garantía de ganancias." : "Share transparently: ‘I may earn feature access if you join through my link.’ No cash payout or earnings guarantee."}</p>
      {data.rewards?.filter((r) => !r.seen).map((reward) => <div key={reward.id} role="status" className="mt-3 rounded-lg border border-line p-3">
        <p>{es ? `Meta ${reward.milestone}: $${(reward.valueCents / 100).toFixed(2)} — ` : `Referral milestone ${reward.milestone}: $${(reward.valueCents / 100).toFixed(2)} — `}{reward.status === "credited" ? (es ? "acceso a funciones añadido." : "feature allowance added.") : reward.status === "review" ? (es ? "recompensa en revisión." : "reward under review.") : (es ? "recompensa registrada; la activación del acceso está pendiente." : "feature-access reward recorded; activation is pending.")}</p>
        <button type="button" className="btn-ghost mt-2 min-h-[44px]" onClick={() => acknowledge(reward.id)}>{es ? "Cerrar aviso" : "Dismiss reward notice"}</button>
      </div>)}
    </>}
  </section>;
}
