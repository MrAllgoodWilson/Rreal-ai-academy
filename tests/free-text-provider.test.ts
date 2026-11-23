import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateGroqFreePolicy, readGroqFreePolicyConfig, type GroqFreePolicy } from "@/lib/free-text-provider-policy";
import { completeWithVerifiedGroqFreeAllocation, type FreeFeatureAuthorization, type VerifiedFreeQuotaAllocator } from "@/lib/free-text-provider";
const subject = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-11-05T12:00:00Z");
let policy: GroqFreePolicy;
let allocator: VerifiedFreeQuotaAllocator;
const fetcher = vi.fn();
const input = { requestId: "request-fixture-0001", subjectId: subject, feature: "coach" as const, system: "Teach safely.", messages: [{ role: "user" as const, content: "Explain a variable." }], maxOutputTokens: 128 };
const credential = { apiKey: "fixture-key-not-real", accountBindingId: "account-fixture-binding", billingOwner: "academy" as const };
const authorization: FreeFeatureAuthorization = { approved: true, subjectId: subject, feature: "coach", expiresAt: "2026-11-05T12:05:00Z" };
const goodResponse = () => new Response(JSON.stringify({ choices: [{ message: { content: "A variable stores a value." } }], usage: { prompt_tokens: 30, completion_tokens: 8 } }), { status: 200 });
const run = (overrides: Partial<Parameters<typeof completeWithVerifiedGroqFreeAllocation>[0]> = {}) => completeWithVerifiedGroqFreeAllocation({ input, policy, credential, authorization, allocator, fetcher, now, ...overrides });
beforeEach(() => {
  vi.resetAllMocks();
  policy = { enabled: true, id: "verified-policy-v1", provider: "groq", model: "openai/gpt-oss-20b", billingOwner: "academy", accountBindingId: "account-fixture-binding", plan: "free", accountFreePlanVerified: true, paidBillingDisabledVerified: true, commercialUseReview: "approved", modelLicenseReview: "approved", dataProcessingReview: "approved", endUserEligibilityReview: "approved", checkedAt: "2026-11-05T11:00:00Z", expiresAt: "2026-11-06T10:00:00Z", maxInputBytes: 2000, maxMessages: 4, maxOutputTokens: 256, dailyRequestsAllocated: 10, dailyInputTokensAllocated: 10_000, dailyOutputTokensAllocated: 5000, paidFallback: false };
  allocator = { reserve: vi.fn().mockResolvedValue({ acquired: true, id: "quota-fixture" }), finish: vi.fn().mockResolvedValue(undefined) };
  fetcher.mockImplementation(async () => goodResponse());
});
afterEach(() => vi.unstubAllEnvs());
describe("verified-free provider boundary", () => {
  it("defaults closed even when a credential exists", async () => {
    expect(await run({ policy: undefined })).toMatchObject({ ok: false, paidFallback: false });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("FREE_TEXT_PROVIDERS_ENABLED", "false"); expect(readGroqFreePolicyConfig()).toBeNull();
  });
  it("denies unknown/paid tiers, expired reviews, missing commercial approval and unreviewed models before an API call", async () => {
    for (const bad of [{ ...policy, plan: "developer" }, { ...policy, expiresAt: "2026-11-05T11:59:59Z" }, { ...policy, commercialUseReview: "unknown" }, { ...policy, model: "llama-3.3-70b-versatile" }, { ...policy, paidFallback: true }]) expect(await run({ policy: bad })).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a review lasting more than24hours and mismatched member BYOK ownership", async () => {
    expect(evaluateGroqFreePolicy({ ...policy, expiresAt: "2026-11-10T12:00:00Z" }, subject, now).allowed).toBe(false);
    expect(await run({ policy: { ...policy, billingOwner: "member", memberId: "22222222-2222-4222-8222-222222222222" } })).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires feature authorization and an atomic quota allocator independently of the free plan", async () => {
    expect(await run({ authorization: undefined })).toMatchObject({ code: "free_feature_not_authorized" });
    expect(await run({ allocator: undefined })).toMatchObject({ code: "free_quota_allocator_unconfigured" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("enforces input bytes/message count/output limits before reserving or calling", async () => {
    expect(await run({ input: { ...input, messages: [{ role: "user", content: "x".repeat(3000) }] } })).toMatchObject({ ok: false });
    expect(await run({ input: { ...input, maxOutputTokens: 500 } })).toMatchObject({ ok: false });
    expect(allocator.reserve).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("never calls the provider when quota is unavailable or reservation fails", async () => {
    vi.mocked(allocator.reserve).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("fixture budget error"));
    expect(await run()).toMatchObject({ code: "free_quota_unavailable" });
    expect(await run()).toMatchObject({ code: "free_quota_reservation_failed" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("binds the fixed endpoint/model/budget, then reconciles verified usage without paid fallback", async () => {
    expect(await run()).toMatchObject({ ok: true, billing: "verified_free_allocation", paidFallback: false });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(options.redirect).toBe("error");
    expect(JSON.parse(options.body)).toMatchObject({ model: "openai/gpt-oss-20b", max_completion_tokens: 128, stream: false });
    expect(allocator.finish).toHaveBeenCalledWith("quota-fixture", "succeeded", { inputTokens: 30, outputTokens: 8 });
  });
  it("returns429 and network failure without retrying or switching to another provider", async () => {
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 429 })).mockRejectedValueOnce(new Error("fixture timeout"));
    expect(await run()).toMatchObject({ code: "free_provider_rate_limited_no_fallback", paidFallback: false });
    expect(await run()).toMatchObject({ code: "free_provider_unavailable_no_fallback", paidFallback: false });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(allocator.finish).toHaveBeenLastCalledWith("quota-fixture", "unknown", undefined);
  });
  it("will not report successful unmetered output after quota reconciliation fails", async () => {
    vi.mocked(allocator.finish).mockRejectedValueOnce(new Error("fixture store failure"));
    expect(await run()).toMatchObject({ code: "free_quota_reconciliation_required", paidFallback: false });
  });
  it("rejects missing/over-limit provider usage and oversized response bodies", async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }))).mockResolvedValueOnce(new Response("x".repeat(70_000)));
    expect(await run()).toMatchObject({ code: "free_provider_response_unverified_no_fallback" });
    expect(await run()).toMatchObject({ code: "free_provider_response_unverified_no_fallback" });
  });
  it("supports an explicitly verified member-owned free key but never substitutes the Academy key", async () => {
    const memberPolicy = { ...policy, billingOwner: "member", memberId: subject };
    expect(await run({ policy: memberPolicy, credential: { ...credential, billingOwner: "member", memberId: subject } })).toMatchObject({ ok: true });
    expect(await run({ policy: memberPolicy, credential })).toMatchObject({ code: "free_provider_credential_binding_missing" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("relies on single-use allocator claims so concurrent duplicate requests cause one provider call", async () => {
    let claimed = false;
    allocator.reserve = vi.fn(async () => { if (claimed) return null; claimed = true; return { acquired: true as const, id: "once" }; });
    const responses = await Promise.all([run(), run()]);
    expect(responses.filter((r) => r.ok)).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
