import "server-only";
import { ownsTextAi, type Byok } from "@/lib/byok-server";
import type { AiFunding } from "@/lib/claude";
import { getDefaultFoundersRulesEngine } from "@/lib/founders-engine";

/** Features whose requests fit the approved managed-model request limits. Course/playbook generation does not. */
const MANAGED_FEATURES = new Set(["coach", "sandbox"]);

/**
 * Decides who pays for a text-generation request, or null when nobody does (the caller then uses its offline engine).
 *
 *  1. A member key always wins: owner-funded, never metered against the Academy, never an Academy fallback.
 *  2. Academy-funded ("managed") execution is OFF unless the operator sets FOUNDERS_MANAGED_AI=enabled, and then only
 *     for an account with an active Founders entitlement in durable storage, and only for features in MANAGED_FEATURES.
 *     Any storage/configuration problem means "not funded" - never "funded without a meter".
 */
export async function resolveAiFunding(byok: Byok, accountId: string, feature: "coach" | "sandbox" | "course" | "playbook"): Promise<AiFunding | null> {
  if (ownsTextAi(byok)) return { kind: "byok", byok };
  if (process.env.FOUNDERS_MANAGED_AI !== "enabled" || !MANAGED_FEATURES.has(feature)) return null;
  try {
    const entitlement = await getDefaultFoundersRulesEngine().checkEntitlement("rreal", accountId);
    return entitlement.hasActiveEntitlement ? { kind: "managed", accountId } : null;
  } catch {
    return null;
  }
}
