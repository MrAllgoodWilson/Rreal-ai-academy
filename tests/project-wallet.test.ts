import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ admin: vi.fn(), member: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: m.admin }));
vi.mock("@/lib/server-auth", () => ({ getMember: m.member }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "fixture", rateLimit: () => ({ ok: true }) }));
import { PROJECT_RATE_CARD, projectWalletEnabled, validProjectRate } from "@/lib/project-wallet-policy";
import { quoteProject, finishProject } from "@/lib/project-wallet";
import { POST } from "@/app/api/project-wallet/quote/route";
const user = "10000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("PROJECT_WALLET_ENABLED", ""); m.member.mockResolvedValue({ demo: false, member: { user: { id: user } } }); });
afterEach(() => vi.unstubAllEnvs());
describe("disabled project-wallet foundation", () => {
  it("has no offers or execution permission by default", () => { expect(projectWalletEnabled()).toBe(false); expect(Object.keys(PROJECT_RATE_CARD)).toHaveLength(0); });
  it("refuses unpriced projects before obtaining an admin client", async () => {
    vi.stubEnv("PROJECT_WALLET_ENABLED", "true");
    await expect(quoteProject(user, "website")).rejects.toThrow("no approved");
    expect(m.admin).not.toHaveBeenCalled();
  });
  it("rejects client-supplied price and cost values", async () => {
    const res = await POST(new Request("https://example.test/api/project-wallet/quote", { method: "POST", body: JSON.stringify({ feature: "website", credits: 1, maxProviderCostCents: 0 }) }));
    expect(res.status).toBe(400); expect(m.admin).not.toHaveBeenCalled();
  });
  it("rejects unknown, negative, zero or fractional cost estimates", () => {
    for (const maxProviderCostCents of [NaN, 0, -1, 0.5, Infinity]) expect(validProjectRate({ feature: "website", version: "v1", credits: 1000, retailCents: 1000, netFundingCents: 941, reserveCents: 50, minimumContributionCents: 400, maxProviderCostCents })).toBe(false);
    expect(validProjectRate({ feature: "website", version: "v1", credits: 1000, retailCents: 1000, netFundingCents: 941, reserveCents: 50, minimumContributionCents: 400, maxProviderCostCents: 301 })).toBe(false);
    expect(validProjectRate({ feature: "website", version: "v1", credits: 1000, retailCents: 1000, netFundingCents: 941, reserveCents: 50, minimumContributionCents: 400, maxProviderCostCents: 300 })).toBe(true);
  });
  it("protects net funding after reserve and required contribution, not just gross retail", () => {
    expect(validProjectRate({ feature: "website", version: "v1", credits: 1000, retailCents: 1000, netFundingCents: 200, reserveCents: 50, minimumContributionCents: 100, maxProviderCostCents: 100 })).toBe(false);
    expect(validProjectRate({ feature: "website", version: "v1", credits: 1000, retailCents: 1000, netFundingCents: 200, reserveCents: 50, minimumContributionCents: 100, maxProviderCostCents: 50 })).toBe(true);
  });
  it("refuses unknown or charged failures instead of refunding blindly", async () => {
    await expect(finishProject(user, true, NaN)).rejects.toThrow("Unverified");
    await expect(finishProject(user, true, 1)).rejects.toThrow("Unverified");
    expect(m.admin).not.toHaveBeenCalled();
  });
});
