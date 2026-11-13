import "server-only";
import { Pool } from "pg";
import { AccountBoundRulesEngine } from "@/lib/founders/rules-engine";
import { PostgresFoundersStore, PostgresFoundersCostStore } from "@/lib/founders/postgres-store";

/**
 * App wiring for the Founders library. There is NO in-memory fallback in any environment:
 * without a database URL every Founders path fails closed (the caller answers 5xx / refuses to dispatch).
 *
 * The Founders tables live in their own schema (migration 0012, default `founders`) which is not exposed
 * through the public REST API; the pool pins search_path to it.
 */
const SCHEMA_RE = /^[a-z_][a-z0-9_]{0,62}$/;

let pool: Pool | null = null;
let engine: AccountBoundRulesEngine | null = null;
let store: PostgresFoundersStore | null = null;
let costStore: PostgresFoundersCostStore | null = null;

export function foundersLivemode(): boolean {
  return process.env.STRIPE_CHECKOUT_MODE !== "test";
}

export function getFoundersPool(): Pool {
  if (pool) return pool;
  const url = process.env.FOUNDERS_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Founders storage is not configured: FOUNDERS_DATABASE_URL (or DATABASE_URL) is required. There is no in-memory fallback.");
  }
  const schema = process.env.FOUNDERS_DB_SCHEMA || "founders";
  if (!SCHEMA_RE.test(schema)) throw new Error("Founders storage is not configured: invalid FOUNDERS_DB_SCHEMA.");
  pool = new Pool({ connectionString: url, max: 5, options: `-c search_path=${schema}` });
  // A broken idle connection must not crash the process; the next query surfaces the error to its caller.
  pool.on("error", () => undefined);
  return pool;
}

export function getFoundersStore(): PostgresFoundersStore {
  if (!store) store = new PostgresFoundersStore(getFoundersPool());
  return store;
}

export function getFoundersCostStore(): PostgresFoundersCostStore {
  if (!costStore) costStore = new PostgresFoundersCostStore(getFoundersPool());
  return costStore;
}

export function getDefaultFoundersRulesEngine(): AccountBoundRulesEngine {
  if (!engine) {
    const live = foundersLivemode();
    engine = new AccountBoundRulesEngine(getFoundersStore(), {
      livemode: live,
      environment: live ? "production" : "development",
    });
  }
  return engine;
}

/** Test seam: lets a harness inject an engine built on its own disposable database. Never used by app code. */
export function setDefaultFoundersRulesEngine(next: AccountBoundRulesEngine | null): void {
  engine = next;
}

/** Test seam: drop cached pool/stores so a new process-level configuration is picked up. */
export async function resetFoundersWiringForTests(): Promise<void> {
  const p = pool;
  pool = null; engine = null; store = null; costStore = null;
  if (p) await p.end().catch(() => undefined);
}
