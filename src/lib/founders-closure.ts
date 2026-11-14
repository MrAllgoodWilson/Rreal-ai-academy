import "server-only";
import { createHmac } from "node:crypto";
import { AccountBoundRulesEngine } from "@/lib/founders/rules-engine";
import { foundersEngineConfig, foundersStorageConfigured, getFoundersStore, withFoundersAccountLock } from "@/lib/founders-engine";

const COMPANY = "rreal" as const;

/** Versioned server-keyed identity signal; never persist raw or dictionary-recomputable e-mail hashes.
 * This key must remain stable for the lifetime of retained tombstones. Rotation needs an explicit migration.
 */
export function emailHash(email: string): string {
  const key = process.env.FOUNDERS_IDENTITY_HMAC_KEY;
  if (!key || Buffer.byteLength(key, "utf8") < 32) {
    throw new Error("Founders identity key is not configured safely.");
  }
  return "hmac-sha256:v1:" + createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Account closure for the Founders policy. MUST complete before any destructive deletion of the account.
 *
 * Data minimisation: an account that has NO Founders eligibility or enrollment gets nothing written here - no audit
 * row, no tombstone, no identity key required - and its deletion proceeds normally ("no_founders_record").
 *
 * For an account that DOES have a Founders record, in one transaction and under the per-account lock (the same lock
 * operator qualification takes, so a concurrent qualification serializes against this check): eligibility becomes
 * permanently forfeited, any enrollment is canceled, an `account_closed` audit entry is written, and the keyed
 * e-mail signal is indexed. Those rows live in the `founders` schema with no foreign key to the profile, so they
 * survive the deletion as the minimal tombstone. The identity key is required ONLY on this path; if it is missing
 * or too short the transaction rolls back and this THROWS, so the caller deletes nothing.
 *
 * "not_configured": this deployment has no Founders storage at all (no Founders account can exist).
 * If storage is configured but unavailable this THROWS, and the caller must delete nothing.
 * Safe to repeat: a retry after a crash re-asserts the same terminal state.
 */
export type ClosureOutcome = "closed" | "no_founders_record" | "not_configured";

export async function closeFoundersAccount(accountId: string, email: string | null | undefined): Promise<ClosureOutcome> {
  if (!foundersStorageConfigured()) return "not_configured";
  const store = getFoundersStore();
  return withFoundersAccountLock(COMPANY, accountId, () =>
    store.withTransaction(async (txn): Promise<ClosureOutcome> => {
      const [eligibility, enrollment] = await Promise.all([txn.getEligibility(COMPANY, accountId), txn.getEnrollment(COMPANY, accountId)]);
      if (!eligibility && !enrollment) return "no_founders_record";
      // Compute the keyed signal first: a missing key must fail before any state is written.
      const signal = email ? emailHash(email) : null;
      await new AccountBoundRulesEngine(txn, foundersEngineConfig()).handleAccountClosure(COMPANY, accountId);
      if (signal && txn.indexIdentitySignals) await txn.indexIdentitySignals(COMPANY, accountId, { emailHash: signal });
      return "closed";
    }),
  );
}

/**
 * Operator entry point for admitting an account to the pilot (never called from a request handler).
 * Always supplies the hashed e-mail so an address that already held - and closed or forfeited - a Founders account
 * is recognised on re-registration and refused.
 */
export async function qualifyFoundersAccount(account: { id: string; email: string; registeredAt: string }) {
  const engine = new AccountBoundRulesEngine(getFoundersStore(), foundersEngineConfig());
  return withFoundersAccountLock(COMPANY, account.id, () =>
    engine.qualifyAccount(COMPANY, {
      accountId: account.id,
      registeredAt: account.registeredAt,
      authVerified: true,
      identitySignals: { emailHash: emailHash(account.email) },
    }),
  );
}
