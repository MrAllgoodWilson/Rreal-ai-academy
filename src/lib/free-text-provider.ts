import "server-only";
import { z } from "zod";
import { evaluateGroqFreePolicy, type GroqFreePolicy } from "@/lib/free-text-provider-policy";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const Input = z.object({
  requestId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  subjectId: z.string().uuid(),
  feature: z.enum(["coach", "sandbox"]),
  system: z.string().min(1).max(2000),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }).strict()).min(1).max(10),
  maxOutputTokens: z.number().int().min(1).max(512),
}).strict();
export type FreeTextInput = z.infer<typeof Input>;
export type QuotaClaim = { requestId: string; subjectId: string; policyId: string; accountBindingId: string; model: string; feature: string; inputTokenUpperBound: number; maxOutputTokens: number; policyExpiresAt: string };
export interface VerifiedFreeQuotaAllocator {
  /** MUST atomically reserve both global account/model and per-member limits, with unique single-use requestId. */
  reserve: (claim: QuotaClaim, policy: GroqFreePolicy) => Promise<{ acquired: true; id: string } | null>;
  /** Keep unknown provider outcomes consumed/pending until reconciled; never assume zero usage after a timeout. */
  finish: (id: string, state: "succeeded" | "provider_rejected" | "unknown", usage?: { inputTokens: number; outputTokens: number }) => Promise<void>;
}
export interface FreeTextCredential { apiKey: string; accountBindingId: string; billingOwner: "academy" | "member"; memberId?: string }
export interface FreeFeatureAuthorization { approved: true; subjectId: string; feature: "coach" | "sandbox"; expiresAt: string }
const failed = (code: string) => ({ ok: false, code, paidFallback: false } as const);

async function readSmallJson(response: Response) {
  if (!response.body) throw new Error("empty");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 65_536) { await reader.cancel(); throw new Error("oversized"); }
      parts.push(item.value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { joined.set(part, at); at += part.byteLength; }
  return JSON.parse(new TextDecoder().decode(joined)) as unknown;
}

/** Optional unbilled-quota boundary ONLY; unconfigured by default and intentionally NOT routed from paid feature APIs. */
export async function completeWithVerifiedGroqFreeAllocation(options: {
  input: unknown;
  policy?: unknown;
  credential?: FreeTextCredential;
  authorization?: FreeFeatureAuthorization;
  allocator?: VerifiedFreeQuotaAllocator;
  fetcher?: typeof fetch;
  now?: number;
}) {
  const parsed = Input.safeParse(options.input);
  if (!parsed.success) return failed("free_provider_invalid_request");
  const input = parsed.data;
  const now = options.now ?? Date.now();
  const eligibility = evaluateGroqFreePolicy(options.policy, input.subjectId, now);
  if (!eligibility.allowed) return failed(eligibility.reason);
  const policy = eligibility.policy;
  const auth = options.authorization;
  if (!auth?.approved || auth.subjectId !== input.subjectId || auth.feature !== input.feature || !Number.isFinite(Date.parse(auth.expiresAt)) || Date.parse(auth.expiresAt) <= now) return failed("free_feature_not_authorized");
  const key = options.credential;
  if (!key?.apiKey.trim() || key.accountBindingId !== policy.accountBindingId || key.billingOwner !== policy.billingOwner || (policy.billingOwner === "member" && key.memberId !== input.subjectId)) return failed("free_provider_credential_binding_missing");
  const bytes = new TextEncoder().encode(input.system + input.messages.map((m) => m.content).join("")).byteLength;
  if (bytes > policy.maxInputBytes || input.messages.length > policy.maxMessages || input.maxOutputTokens > policy.maxOutputTokens) return failed("free_provider_request_limit");
  if (!options.allocator) return failed("free_quota_allocator_unconfigured");
  // Conservative byte-level upper bound plus chat framing. Actual provider usage is reconciled below.
  const claim: QuotaClaim = { requestId: input.requestId, subjectId: input.subjectId, policyId: policy.id, accountBindingId: policy.accountBindingId, model: policy.model, feature: input.feature, inputTokenUpperBound: bytes + (input.messages.length + 1) * 64 + 128, maxOutputTokens: input.maxOutputTokens, policyExpiresAt: policy.expiresAt };
  if (claim.inputTokenUpperBound > policy.dailyInputTokensAllocated || claim.maxOutputTokens > policy.dailyOutputTokensAllocated) return failed("free_quota_unavailable");
  let reservation: { acquired: true; id: string } | null;
  try { reservation = await options.allocator.reserve(claim, policy); } catch { return failed("free_quota_reservation_failed"); }
  if (!reservation?.acquired || !reservation.id) return failed("free_quota_unavailable");
  const finish = async (state: "succeeded" | "provider_rejected" | "unknown", usage?: { inputTokens: number; outputTokens: number }) => {
    try { await options.allocator!.finish(reservation!.id, state, usage); return true; } catch { return false; }
  };
  // The fixed endpoint cannot be changed to a paid provider or a caller-supplied URL. Never follow credential-bearing redirects.
  let response: Response;
  try {
    response = await (options.fetcher || fetch)(ENDPOINT, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${key.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: policy.model, messages: [{ role: "system", content: input.system }, ...input.messages], max_completion_tokens: input.maxOutputTokens, stream: false }),
    });
  } catch {
    await finish("unknown");
    return failed("free_provider_unavailable_no_fallback");
  }
  if (!response.ok) {
    if (!(await finish("provider_rejected"))) return failed("free_quota_reconciliation_required");
    return failed(response.status === 429 ? "free_provider_rate_limited_no_fallback" : "free_provider_rejected_no_fallback");
  }
  try {
    const output = await readSmallJson(response) as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
    const text = output.choices?.[0]?.message?.content;
    const prompt = output.usage?.prompt_tokens;
    const completion = output.usage?.completion_tokens;
    if (typeof text !== "string" || !text.trim() || text.length > 16_000 || !Number.isSafeInteger(prompt) || Number(prompt) < 0 || !Number.isSafeInteger(completion) || Number(completion) < 0 || Number(prompt) > claim.inputTokenUpperBound || Number(completion) > claim.maxOutputTokens) throw new Error("unverified output usage");
    if (!(await finish("succeeded", { inputTokens: Number(prompt), outputTokens: Number(completion) }))) return failed("free_quota_reconciliation_required");
    return { ok: true, text: text.trim(), provider: "groq", model: policy.model, billing: "verified_free_allocation", paidFallback: false } as const;
  } catch {
    await finish("unknown");
    return failed("free_provider_response_unverified_no_fallback");
  }
}
