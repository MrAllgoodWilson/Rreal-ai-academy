import { defineConfig } from "vitest/config";
import path from "node:path";

/** Real-Postgres route proofs. Not part of `npm test`: needs the disposable local stack (see docs/FOUNDERS_MIGRATIONS.md). */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: { environment: "node", include: ["tests/**/*.pgint.ts"], testTimeout: 60000, hookTimeout: 60000, fileParallelism: false },
});
