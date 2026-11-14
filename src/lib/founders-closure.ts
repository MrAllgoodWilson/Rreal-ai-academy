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
 * In one transaction, under the per-account lock: the Founders eligibility (if any) becomes permanently forfeited,
 * any enrollment is canceled, an `account_closed` audit entry is written, and the account's e-mail HASH is indexed.
 * Those rows live in the `founders` schema with no foreign key to the profile, so they survive the deletion as the
 * minimal tombstone: account id, hashed e-mail, forfeiture and audit - nothing else about the person.
 *
 * Returns "not_configured" only when this deployment has no Founders storage at all (no Founders account can exist).
 * If storage is configured but unavailable this THROWS, and the caller must delete nothing.
 * Safe to repeat: a retry after a crash re-asserts the same terminal state.
 */
export async function closeFoundersAccount(accountId: string, email: string | null | undefined): Promise<"closed" | "not_configured"> {
  if (!foundersStorageConfigured()) return "not_configured";
  const store = getFoundersStore();
  await withFoundersAccountLock(COMPANY, accountId, () =>
    store.withTransaction(async (txn) => {
      await new AccountBoundRulesEngine(txn, foundersEngineConfig()).handleAccountClosure(COMPANY, accountId);
      if (email && txn.indexIdentitySignals) await txn.indexIdentitySignals(COMPANY, accountId, { emailHash: emailHash(email) });
    }),
  );
  return "closed";
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
