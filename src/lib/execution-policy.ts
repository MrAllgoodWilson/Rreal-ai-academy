import { NextResponse } from "next/server";

/** Fail closed until a server-side quote, wallet reservation and cost cap exist.
 * This is not a purchasable offer: never direct a member to buy unusable credits.
 * BYOK paths may proceed only when the actual selected provider bills the member.
 */
export function unfundedExecution(feature: string) {
  return NextResponse.json({
    error: "Prepaid execution is being configured. Your course lessons and local practice remain available. No credits were charged.",
    code: "paid_execution_not_ready", feature,
  }, { status: 503 });
}

/** Planning gate: all values are integer micro-USD, costs include anticipated reward
 * redemption and direct operating costs. Unknown costs must never be treated as zero.
 * This does not guarantee business profitability or replace a live atomic budget reservation.
 */
export function contributionGate(revenue: number, costs: (number | null)[], minimum: number) {
  if (![revenue, minimum, ...costs].every(v => typeof v === "number" && Number.isSafeInteger(v) && v >= 0)) {
    return { allowed: false, contribution: null, reason: "unknown_or_invalid_cost" } as const;
  }
  const total = (costs as number[]).reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total)) return { allowed: false, contribution: null, reason: "unknown_or_invalid_cost" } as const;
  const contribution = revenue - total;
  return { allowed: contribution >= minimum, contribution, reason: contribution >= minimum ? "within_budget" : "margin_too_low" } as const;
}
