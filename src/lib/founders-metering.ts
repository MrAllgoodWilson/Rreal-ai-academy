import "server-only";
import { getDefaultCostMeteringManager } from "@/lib/claude";
import { getFoundersCostStore } from "@/lib/founders-engine";

/**
 * Operator reconciliation for managed-AI reservations that were left HELD: the provider was (or may have been)
 * called but no usable usage report came back. A held reservation keeps its money, unit and concurrency slot, and is
 * never released by age. It ends only through one of the two evidence-backed outcomes below.
 */
export type ReconcileEvidence =
  /** Provider-side record (dashboard / usage export / invoice line) of what the call consumed. */
  | { kind: "provider_usage"; inputTokens: number; outputTokens: number; source: string }
  /** Provider-side confirmation that the request never executed and was not billed. */
  | { kind: "verified_not_executed"; source: string };

export async function listHeldReservations(accountId: string) {
  return (await getFoundersCostStore().listActiveReservations(accountId)).filter((r) => r.status === "reserved");
}

export async function reconcileReservation(reservationId: string, evidence: ReconcileEvidence): Promise<"settled" | "released"> {
  if (!evidence.source || evidence.source.trim().length < 3) throw new Error("reconciliation requires a named evidence source");
  const reservation = await getFoundersCostStore().getReservation(reservationId);
  if (!reservation) throw new Error("reservation not found");
  if (reservation.status !== "reserved") throw new Error(`reservation is already ${reservation.status}`);
  const manager = getDefaultCostMeteringManager();
  if (evidence.kind === "provider_usage") {
    const { inputTokens, outputTokens } = evidence;
    if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens) || inputTokens < 0 || outputTokens < 0) {
      throw new Error("provider usage must be non-negative integers");
    }
    await manager.settleUsage(reservationId, inputTokens, outputTokens, 1);
    return "settled";
  }
  await manager.releaseUsage(reservationId);
  return "released";
}
