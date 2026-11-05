/** Internal feature-allowance units. Not cash, redeemable value or provider tokens. */
export type ProjectFundingKind = "purchased" | "referral";
export interface ProjectRate {
  feature: string;
  version: string;
  credits: number;
  maxProviderCostCents: number;
  retailCents: number;
  netFundingCents: number;
  reserveCents: number;
  minimumContributionCents: number;
}
/** Empty until the owner approves scope and representative provider benchmarks. */
export const PROJECT_RATE_CARD: Readonly<Record<string, ProjectRate>> = Object.freeze({});
export const projectWalletEnabled = () => process.env.PROJECT_WALLET_ENABLED === "true";
export function validProjectRate(rate: ProjectRate): boolean {
  return /^[a-z0-9][a-z0-9:_-]{0,79}$/.test(rate.feature)
    && rate.version.trim().length > 0 && rate.version.length <= 80
    && Number.isSafeInteger(rate.credits) && rate.credits > 0
    && Number.isSafeInteger(rate.maxProviderCostCents) && rate.maxProviderCostCents > 0
    && Number.isSafeInteger(rate.retailCents) && rate.retailCents > 0
    && Number.isSafeInteger(rate.netFundingCents) && rate.netFundingCents > 0 && rate.netFundingCents <= rate.retailCents
    && Number.isSafeInteger(rate.reserveCents) && rate.reserveCents >= 0
    && Number.isSafeInteger(rate.minimumContributionCents) && rate.minimumContributionCents > 0
    && rate.maxProviderCostCents <= rate.netFundingCents - rate.reserveCents - rate.minimumContributionCents
    && rate.maxProviderCostCents <= Math.floor(rate.retailCents * 0.30);
}
