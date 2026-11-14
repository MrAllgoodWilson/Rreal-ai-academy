import { describe, expect, it } from "vitest";
import { ADVERTISING_ENABLED, ADVERTISING_PLACEMENTS, advertisingAllowed, type AdvertisingPlacement } from "../src/lib/advertising-policy";
const placement: AdvertisingPlacement = { id: "fixture-public-resource", paths: ["/resources/example", "/checkout", "/dashboard/resources/example", "/auth/login"], status: "reviewed", publisherApproved: true, founderActivationApproved: true, disclosureApproved: true, requiresConsent: true };
const context = { enabled: true, authenticated: false, paidContent: false, childDirected: false, consentGranted: true };
describe("advertising placement gates", () => {
  it("ships disabled with no approved inventory", () => { expect(ADVERTISING_ENABLED).toBe(false); expect(ADVERTISING_PLACEMENTS).toHaveLength(0); expect(advertisingAllowed("/resources/example", placement)).toBe(false); });
  it("requires explicit approvals and consent", () => {
    expect(advertisingAllowed("/resources/example", placement, context)).toBe(true);
    for (const patch of [{ status: "draft" as const }, { publisherApproved: false }, { founderActivationApproved: false }, { disclosureApproved: false }]) expect(advertisingAllowed("/resources/example", { ...placement, ...patch }, context)).toBe(false);
    expect(advertisingAllowed("/resources/example", placement, { ...context, consentGranted: false })).toBe(false);
  });
  it("protects sensitive and paid routes even when mistakenly listed", () => {
    for (const path of ["/checkout", "/dashboard/resources/example", "/auth/login"]) expect(advertisingAllowed(path, placement, context)).toBe(false);
    for (const patch of [{ authenticated: true }, { paidContent: true }, { childDirected: true }]) expect(advertisingAllowed("/resources/example", placement, { ...context, ...patch })).toBe(false);
  });
  it("refuses unknown context and ambiguous route spellings", () => {
    expect(advertisingAllowed("/resources/example", placement, { enabled: true })).toBe(false);
    for (const path of ["/unknown", "//resources/example", "/%72esources/example", "/resources/../checkout", "/resources/example?paid=true", "/resources/example#checkout"]) expect(advertisingAllowed(path, placement, context)).toBe(false);
  });
});
