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
let lockPool: Pool | null = null;
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

export function foundersEngineConfig() {
  const live = foundersLivemode();
  return { livemode: live, environment: live ? "production" : "development" };
}

/** True when this deployment has Founders storage at all. Without it no Founders account can exist. */
export function foundersStorageConfigured(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return Boolean(env.FOUNDERS_DATABASE_URL || env.DATABASE_URL);
}

export function getDefaultFoundersRulesEngine(): AccountBoundRulesEngine {
  if (!engine) engine = new AccountBoundRulesEngine(getFoundersStore(), foundersEngineConfig());
  return engine;
}

/**
 * Runs `fn` while holding a session-level advisory lock for one account, serializing every Founders state change for
 * that account across all processes (the library reads then writes without row locks). The lock dies with the
 * connection, so a crashed process cannot leave it held. Needs a direct or session-pooled connection.
 */
/**
 * Lock waiters must not consume the data pool: callbacks use that pool for their transactions.
 * Sharing it deadlocks when all slots hold locks while waiting for callback connections.
 */
function getFoundersLockPool(): Pool {
  if (lockPool) return lockPool;
  const url = process.env.FOUNDERS_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Founders lock storage is not configured.");
  lockPool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000 });
  lockPool.on("error", () => undefined);
  return lockPool;
}

export async function withFoundersAccountLock<T>(company: string, accountId: string, fn: () => Promise<T>): Promise<T> {
  const key = `founders:${company}:${accountId}`;
  const lock = await getFoundersLockPool().connect();
  try {
    await lock.query("set lock_timeout = '5s'");
    await lock.query("select pg_advisory_lock(hashtextextended($1, 0))", [key]);
    return await fn();
  } finally {
    try {
      await lock.query("select pg_advisory_unlock(hashtextextended($1, 0))", [key]);
      lock.release();
    } catch {
      lock.release(true); // drop the connection: its session lock dies with it
    }
  }
}

/** Test seam: lets a harness inject an engine built on its own disposable database. Never used by app code. */
export function setDefaultFoundersRulesEngine(next: AccountBoundRulesEngine | null): void {
  engine = next;
}

/** Test seam: drop cached pool/stores so a new process-level configuration is picked up. */
export async function resetFoundersWiringForTests(): Promise<void> {
  const p = pool;
  const locks = lockPool;
  pool = null; lockPool = null; engine = null; store = null; costStore = null;
  await Promise.all([p?.end().catch(() => undefined), locks?.end().catch(() => undefined)]);
}
