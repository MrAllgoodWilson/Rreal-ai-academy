import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { assertDisposableTarget, need } from "./pgint-helpers";
import { getFoundersPool, resetFoundersWiringForTests, withFoundersAccountLock } from "../src/lib/founders-engine";
let admin: Pool;
beforeAll(async () => { admin = new Pool({ connectionString: need("HW_PG_ADMIN_URL") }); await assertDisposableTarget(admin); });
afterAll(async () => { await resetFoundersWiringForTests(); await admin.end(); });
describe("same-process lock-pool saturation", () => {
  it("ten overlapping accounts can perform data work while holding advisory locks", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => withFoundersAccountLock("rreal", `pool-proof-${index}`, async () => {
      const response = await getFoundersPool().query("select $1::int as n, pg_sleep(0.02)", [index]);
      return response.rows[0].n;
    })));
    expect(results).toEqual(Array.from({ length: 10 }, (_, index) => index));
  }, 15000);
  it("one account remains serialized inside the process", async () => {
    let active = 0;
    let maximum = 0;
    await Promise.all(Array.from({ length: 8 }, () => withFoundersAccountLock("rreal", "one-account-proof", async () => {
      active++; maximum = Math.max(active, maximum);
      await getFoundersPool().query("select pg_sleep(0.01)");
      active--;
    })));
    expect(maximum).toBe(1);
  }, 15000);
});
