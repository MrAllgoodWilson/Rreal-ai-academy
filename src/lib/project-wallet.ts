import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PROJECT_RATE_CARD, projectWalletEnabled, validProjectRate, type ProjectFundingKind } from "@/lib/project-wallet-policy";

export class ProjectWalletUnavailable extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function admin(): SupabaseClient {
  if (!projectWalletEnabled()) throw new ProjectWalletUnavailable("Project wallet is disabled.");
  const client = getSupabaseAdmin();
  if (!client) throw new ProjectWalletUnavailable("Project wallet is unavailable.");
  return client;
}
async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error || data === null) throw new ProjectWalletUnavailable("Project wallet operation could not be confirmed.");
  return data as T;
}
/** No browser-provided credits, provider estimate or price is accepted here. */
export async function quoteProject(userId: string, feature: string) {
  if (!uuid.test(userId)) throw new ProjectWalletUnavailable("Invalid member.");
  const rate = PROJECT_RATE_CARD[feature];
  if (!rate || !validProjectRate(rate)) throw new ProjectWalletUnavailable("This project has no approved, costed offer yet.");
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const quoteId = await rpc<string>(admin(), "project_wallet_quote", {
    p_user: userId, p_feature: rate.feature, p_rate_version: rate.version,
    p_credits: rate.credits, p_max_cost_cents: rate.maxProviderCostCents, p_expires_at: expiresAt,
    p_retail_cents: rate.retailCents, p_net_funding_cents: rate.netFundingCents, p_reserve_cents: rate.reserveCents, p_minimum_contribution_cents: rate.minimumContributionCents,
  });
  return { quoteId, feature: rate.feature, version: rate.version, allowanceUnits: rate.credits, priceCents: rate.retailCents, expiresAt };
}
/** Server-only future adapter. Caller must authenticate ownership and validate user consent. */
export async function reserveProject(userId: string, quoteId: string, fundingKind: ProjectFundingKind, requestKey: string) {
  if (!uuid.test(userId) || !uuid.test(quoteId) || !["purchased", "referral"].includes(fundingKind) || !requestKey || requestKey.length > 200) {
    throw new ProjectWalletUnavailable("Invalid reservation.");
  }
  return rpc<string>(admin(), "project_wallet_reserve", { p_user: userId, p_quote: quoteId, p_kind: fundingKind, p_request_key: requestKey });
}
/** Provider adapters must know actual final cost; unknown/running jobs stay reserved. */
export async function finishProject(jobId: string, release: boolean, actualCostCents: number) {
  if (!uuid.test(jobId) || !Number.isSafeInteger(actualCostCents) || actualCostCents < 0 || (release && actualCostCents !== 0)) {
    throw new ProjectWalletUnavailable("Unverified project cost.");
  }
  // Finishing must be possible after disabling new jobs. Never silently release running work.
  const client = getSupabaseAdmin();
  if (!client) throw new ProjectWalletUnavailable("Project wallet is unavailable.");
  return rpc<boolean>(client, "project_wallet_finish", { p_job: jobId, p_release: release, p_actual_cost_cents: actualCostCents });
}
