import { describe, expect, it } from "vitest";
import { referralProgress, referralUrl } from "@/lib/referrals";
const base = { eligible: true, threshold: 20, rewardCents: 1000, holdDays: 30 };
describe("referral presentation boundaries", () => {
  it("shows the next repeatable milestone at 19/20/39/40 qualified learners", () => {
    expect([19, 20, 39, 40].map((qualified) => referralProgress({ ...base, qualified }))).toEqual([
      { complete: 0, towardNext: 19, remaining: 1 }, { complete: 1, towardNext: 0, remaining: 20 },
      { complete: 1, towardNext: 19, remaining: 1 }, { complete: 2, towardNext: 0, remaining: 20 },
    ]);
  });
  it("never treats pending payments as qualified referrals", () => {
    expect(referralProgress({ ...base, qualified: 19, pending: 100 }).complete).toBe(0);
  });
  it("does not put member identifiers or executable values into referral URLs", () => {
    expect(referralUrl("https://rrealaiacademy.app", "a".repeat(32))).toBe(`https://rrealaiacademy.app/r/${"a".repeat(32)}`);
    expect(() => referralUrl("https://rrealaiacademy.app", "javascript:alert(1)")).toThrow();
    expect(() => referralUrl("http://example.com", "a".repeat(32))).toThrow();
  });
});
