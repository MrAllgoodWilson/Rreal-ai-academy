import { describe, expect, it } from "vitest";
import { PARTNER_PROGRAMS, approvedAffiliateUrl, officialProgramUrl, type PartnerProgram } from "@/lib/partners";
const fixture: PartnerProgram = {
  id: "fixture", name: "Fixture", category: "tool", description: "Test only",
  applicationUrl: "https://vendor.example/apply", officialHosts: ["vendor.example"],
  status: "approved", lastReviewed: "2026-11-05", applicationNote: "Fixture",
  affiliateTrackingUrl: "https://track.vendor.example/real-issued-code", approvedTrackingHosts: ["track.vendor.example"],
};
describe("partner directory approval and destination boundary", () => {
  it("keeps all research entries distinct and prevents prospects from becoming earning links", () => {
    expect(PARTNER_PROGRAMS).toHaveLength(50);
    expect(new Set(PARTNER_PROGRAMS.map((p) => p.id)).size).toBe(50);
    for (const p of PARTNER_PROGRAMS) {
      expect(p.status).toBe("prospect");
      expect(approvedAffiliateUrl(p)).toBeUndefined();
      expect(officialProgramUrl(p)).toMatch(/^https:\/\//);
    }
  });
  it("requires both approval and the vendor-issued URL", () => {
    expect(approvedAffiliateUrl(fixture)).toBe(fixture.affiliateTrackingUrl);
    expect(approvedAffiliateUrl({ ...fixture, status: "prospect" })).toBeUndefined();
    expect(approvedAffiliateUrl({ ...fixture, status: "applied" })).toBeUndefined();
    expect(approvedAffiliateUrl({ ...fixture, affiliateTrackingUrl: undefined })).toBeUndefined();
    expect(approvedAffiliateUrl({ ...fixture, approvedTrackingHosts: [] })).toBeUndefined();
  });
  it.each([
    "http://track.vendor.example/code", "javascript:alert(1)", "//track.vendor.example/code",
    "https://track.vendor.example.evil.example/code", "https://evil.example/?next=https://track.vendor.example",
    "https://track.vendor.example@evil.example/code", "https://user:pass@track.vendor.example/code",
    "https://track.vendor.example:444/code", "not a URL",
  ])("rejects an untrusted or insecure tracking destination: %s", (url) => {
    expect(approvedAffiliateUrl({ ...fixture, affiliateTrackingUrl: url })).toBeUndefined();
  });
  it("validates official information URLs separately from tracking destinations", () => {
    expect(officialProgramUrl(fixture)).toBe("https://vendor.example/apply");
    expect(officialProgramUrl({ ...fixture, applicationUrl: fixture.affiliateTrackingUrl! })).toBeUndefined();
    expect(approvedAffiliateUrl({ ...fixture, affiliateTrackingUrl: fixture.applicationUrl })).toBeUndefined();
  });
});
