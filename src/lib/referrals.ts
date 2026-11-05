export interface ReferralReward { id: string; milestone: number; valueCents: number; status: "pending_wallet" | "credited" | "review"; seen: boolean }
export interface ReferralDashboard {
  eligible: boolean; code?: string; visits?: number; signups?: number; qualified?: number; pending?: number;
  threshold: number; rewardCents: number; holdDays: number; rewards?: ReferralReward[];
}

/** Counts paid, hold-cleared members; raw clicks and renewals never advance a milestone. */
export function referralProgress(data: ReferralDashboard) {
  const threshold = Number.isSafeInteger(data.threshold) && data.threshold > 0 ? data.threshold : 20;
  const qualified = Number.isSafeInteger(data.qualified) && data.qualified! >= 0 ? data.qualified! : 0;
  const complete = Math.floor(qualified / threshold);
  return { complete, towardNext: qualified % threshold, remaining: threshold - qualified % threshold };
}

/** A code is opaque, contains no user identifier and stays on the Academy's configured origin. */
export function referralUrl(origin: string, code: string): string {
  if (!/^[a-f0-9]{32}$/.test(code)) throw new Error("Invalid referral code");
  const url = new URL(`/r/${code}`, origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) throw new Error("Secure Academy origin required");
  return url.toString();
}
