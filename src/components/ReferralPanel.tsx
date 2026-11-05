"use client";
import { useEffect, useState } from "react";
import { referralProgress, type ReferralDashboard } from "@/lib/referrals";
interface Dashboard extends ReferralDashboard { url?: string; qr?: string }
export function ReferralPanel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/referrals", { signal: controller.signal }).then(async (res) => {
      if (!res.ok) throw new Error("Referral status is unavailable.");
      setData(await res.json());
    }).catch((e) => { if (e.name !== "AbortError") setNotice("Referral status is unavailable. Your existing credits are unchanged."); });
    return () => controller.abort();
  }, []);
  async function acknowledge(id: string) {
    const res = await fetch("/api/referrals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "acknowledge", rewardId: id }) }).catch(() => null);
    if (!res?.ok || !(await res.json()).ok) { setNotice("Could not dismiss this notice. Please retry."); return; }
    setData((current) => current ? { ...current, rewards: current.rewards?.map((r) => r.id === id ? { ...r, seen: true } : r) } : current);
  }
  const progress = data ? referralProgress(data) : null;
  return <section className="card p-5" aria-labelledby="referrals-title">
    <h2 id="referrals-title" className="text-xl font-bold">Invite learners</h2>
    {notice && <p role="status">{notice}</p>}
    {!data && !notice && <p role="status">Loading referral status…</p>}
    {data && !data.eligible && <p>Your referral link becomes available after your first qualifying $1 membership payment.</p>}
    {data?.eligible && <>
      <p>Every {data.threshold} distinct qualifying new paid learners earns ${(data.rewardCents / 100).toFixed(2)} toward project credits. Payments qualify after {data.holdDays} days and fraud/refund checks. Renewals do not count.</p>
      <label className="label mt-3" htmlFor="referral-link">Your referral link</label>
      <input id="referral-link" className="input w-full" readOnly value={data.url || ""} onFocus={(event) => event.currentTarget.select()} />
      <p className="mt-2 break-all">Code: <code>{data.code}</code></p>
      {/* Data URL generated from the first-party link, with the complete link also available as text. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {data.qr && <img src={data.qr} width={240} height={240} alt="QR code for your referral link" />}
      <p>{data.visits || 0} link visits; {data.signups || 0} attributed signups. Visits may include repeat visitors and bots; they do not earn rewards.</p>
      <p>{progress?.towardNext} of {data.threshold} toward your next reward; {data.pending || 0} paid referrals pending checks.</p>
      <p className="text-sm">Share transparently: “I may earn project credits if you join through my link.” No cash payout or earnings guarantee.</p>
      {data.rewards?.filter((r) => !r.seen).map((reward) => <div key={reward.id} role="status" className="mt-3 rounded-lg border border-line p-3">
        <p>Referral milestone {reward.milestone}: ${(reward.valueCents / 100).toFixed(2)} {reward.status === "credited" ? "in project credits added." : reward.status === "review" ? "reward under review." : "project-credit reward recorded; wallet redemption is being prepared."}</p>
        <button type="button" className="btn-ghost mt-2 min-h-[44px]" onClick={() => acknowledge(reward.id)}>Dismiss reward notice</button>
      </div>)}
    </>}
  </section>;
}
