import { AccountBoundRulesEngine } from "@/lib/founders/rules-engine";
import { MemoryFoundersStore } from "@/lib/founders/memory-store";
import { PostgresFoundersStore } from "@/lib/founders/postgres-store";

let defaultEngine: AccountBoundRulesEngine | null = null;

export function getDefaultFoundersRulesEngine(): AccountBoundRulesEngine {
  if (!defaultEngine) {
    const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
    if (dbUrl) {
      try {
        const { Pool } = require("pg");
        defaultEngine = new AccountBoundRulesEngine(new PostgresFoundersStore(new Pool({ connectionString: dbUrl })));
        return defaultEngine;
      } catch (err) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("Failed to initialize durable PostgresFoundersStore in production: " + (err as Error).message);
        }
      }
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("Durable PostgresFoundersStore requires DATABASE_URL in production. In-memory fallback is prohibited.");
    }
    defaultEngine = new AccountBoundRulesEngine(new MemoryFoundersStore());
  }
  return defaultEngine;
}

export function setDefaultFoundersRulesEngine(engine: AccountBoundRulesEngine | null): void {
  defaultEngine = engine;
}
