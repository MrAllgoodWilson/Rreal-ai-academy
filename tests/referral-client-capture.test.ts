import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturePendingReferral, rememberReferral, forgetReferral } from "@/lib/referrals-client";
let values: Map<string, string>;
const fetcher = vi.fn();
beforeEach(() => {
  values = new Map(); vi.stubEnv("NEXT_PUBLIC_REFERRALS_ENABLED", "true");
  vi.stubGlobal("window", { sessionStorage: { setItem: (k: string, v: string) => values.set(k, v), getItem: (k: string) => values.get(k), removeItem: (k: string) => values.delete(k) } });
  vi.stubGlobal("fetch", fetcher); fetcher.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("referral persistence until attribution", () => {
  it("honors a learner clearing the optional code instead of silently restoring it", () => {
    rememberReferral("a".repeat(32)); forgetReferral(); expect(values.size).toBe(0);
  });
  it("retains a pending code through a network/server failure instead of losing it before payment", async () => {
    rememberReferral("a".repeat(32)); fetcher.mockResolvedValue({ ok: false });
    await expect(capturePendingReferral()).rejects.toThrow(); expect(values.size).toBe(1);
  });
  it("clears a code only after server confirms attribution or immutable prior attribution", async () => {
    rememberReferral("b".repeat(32)); fetcher.mockResolvedValue({ ok: true, json: async () => ({ ok: false }) });
    await capturePendingReferral(); expect(values.size).toBe(0);
  });
  it("does not run tracking while disabled or store malformed values", async () => {
    rememberReferral("not-a-code"); expect(values.size).toBe(0);
    rememberReferral("a".repeat(32)); vi.stubEnv("NEXT_PUBLIC_REFERRALS_ENABLED", "false");
    await capturePendingReferral(); expect(fetcher).not.toHaveBeenCalled();
  });
});
