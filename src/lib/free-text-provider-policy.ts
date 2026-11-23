import { z } from "zod";

/** A key is a credential, never evidence of an unbilled allocation. All fields come from trusted server records. */
export const GroqFreePolicySchema = z.object({
  enabled: z.literal(true),
  id: z.string().min(8).max(100),
  provider: z.literal("groq"),
  model: z.literal("openai/gpt-oss-20b"),
  billingOwner: z.enum(["academy", "member"]),
  memberId: z.string().uuid().optional(),
  accountBindingId: z.string().min(8).max(200),
  plan: z.literal("free"),
  accountFreePlanVerified: z.literal(true),
  paidBillingDisabledVerified: z.literal(true),
  commercialUseReview: z.literal("approved"),
  modelLicenseReview: z.literal("approved"),
  dataProcessingReview: z.literal("approved"),
  endUserEligibilityReview: z.literal("approved"),
  checkedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  maxInputBytes: z.number().int().min(256).max(8000),
  maxMessages: z.number().int().min(1).max(10),
  maxOutputTokens: z.number().int().min(1).max(512),
  dailyRequestsAllocated: z.number().int().min(1),
  dailyInputTokensAllocated: z.number().int().min(1),
  dailyOutputTokensAllocated: z.number().int().min(1),
  paidFallback: z.literal(false),
}).strict();
export type GroqFreePolicy = z.infer<typeof GroqFreePolicySchema>;

export function evaluateGroqFreePolicy(value: unknown, subjectId: string, now: number = Date.now()) {
  const result = GroqFreePolicySchema.safeParse(value);
  if (!result.success) return { allowed: false, reason: "free_provider_unconfigured_or_unapproved" } as const;
  const p = result.data;
  const checked = Date.parse(p.checkedAt);
  const expires = Date.parse(p.expiresAt);
  if (!Number.isFinite(now) || checked > now || expires <= now || expires <= checked || expires - checked > 86_400_000) return { allowed: false, reason: "free_provider_review_expired_or_invalid" } as const;
  if ((p.billingOwner === "member" && p.memberId !== subjectId) || (p.billingOwner === "academy" && p.memberId)) return { allowed: false, reason: "free_provider_identity_mismatch" } as const;
  return { allowed: true, policy: p } as const;
}

/** This only reads non-secret configuration; it does not read a provider key or enable a provider. */
export function readGroqFreePolicyConfig(): unknown {
  if (process.env.FREE_TEXT_PROVIDERS_ENABLED !== "true") return null;
  try { return JSON.parse(process.env.GROQ_FREE_POLICY_JSON || "null"); } catch { return null; }
}
