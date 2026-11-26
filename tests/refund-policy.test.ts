import { describe, expect, it } from "vitest";
import { REFUND_POLICY, validateRefundRequest, withinWindow } from "@/lib/refund-policy";

const days = (n: number) => new Date(Date.UTC(2026, 10, 26) - n * 86_400_000);
const now = new Date(Date.UTC(2026, 10, 26));

describe("refund windows", () => {
  it("first monthly charge: inside 7 days, outside after", () => {
    expect(withinWindow("first_charge", days(0), now)).toBe(true);
    expect(withinWindow("first_charge", days(REFUND_POLICY.firstChargeDays), now)).toBe(true);
    expect(withinWindow("first_charge", days(REFUND_POLICY.firstChargeDays + 1), now)).toBe(false);
  });
  it("credit pack: inside 14 days, outside after", () => {
    expect(withinWindow("credit_pack", days(14), now)).toBe(true);
    expect(withinWindow("credit_pack", days(15), now)).toBe(false);
  });
  it("duplicate or erroneous charges and 'other' are always reviewed", () => {
    expect(withinWindow("duplicate_charge", days(400), now)).toBe(true);
    expect(withinWindow("other", days(400), now)).toBe(true);
  });
  it("a purchase date in the future is never inside a window", () => {
    expect(withinWindow("first_charge", days(-3), now)).toBe(false);
  });
});

describe("validateRefundRequest", () => {
  const good = { kind: "first_charge", details: "I signed up by mistake yesterday.", purchasedOn: "2026-11-25" };
  it("accepts a good request", () => expect(validateRefundRequest(good)).toEqual({ ok: true, value: good }));
  it("rejects a missing or unknown kind", () => {
    expect(validateRefundRequest({ ...good, kind: "gift" }).ok).toBe(false);
    expect(validateRefundRequest({ details: good.details }).ok).toBe(false);
  });
  it("rejects too-short and too-long details", () => {
    expect(validateRefundRequest({ ...good, details: "short" }).ok).toBe(false);
    expect(validateRefundRequest({ ...good, details: "x".repeat(2001) }).ok).toBe(false);
  });
  it("rejects a malformed date but allows none", () => {
    expect(validateRefundRequest({ ...good, purchasedOn: "yesterday" }).ok).toBe(false);
    expect(validateRefundRequest({ kind: good.kind, details: good.details }).ok).toBe(true);
  });
  it("rejects non-objects", () => {
    expect(validateRefundRequest(null).ok).toBe(false);
    expect(validateRefundRequest("text").ok).toBe(false);
  });
});
