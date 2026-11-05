import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn(), signIn: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: () => ({ rpc: m.rpc, auth: { admin: { createUser: m.create } } }), getSupabaseServer: async () => ({ auth: { signInWithPassword: m.signIn } }) }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "fixture", rateLimit: () => ({ ok: true }) }));
import { POST } from "@/app/api/auth/signup/route";
const user = "11111111-1111-4111-8111-111111111111";
const code = "a".repeat(32);
const call = (referralCode?: string) => POST(new Request("https://example.test/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "learner@example.test", username: "learner_fixture", password: "FixturePassword123", displayName: "Fixture learner", referralCode }) }));
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("REFERRALS_ENABLED", "true");
  m.create.mockResolvedValue({ data: { user: { id: user } }, error: null });
  m.signIn.mockResolvedValue({ error: null });
  m.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("referral signup capture", () => {
  it("binds the explicit code to the newly created server identity before signin/payment", async () => {
    expect((await call(code)).status).toBe(200);
    expect(m.rpc).toHaveBeenCalledWith("referral_attribute_at_signup", { p_user: user, p_code: code });
    expect(m.rpc.mock.invocationCallOrder[1]).toBeLessThan(m.signIn.mock.invocationCallOrder[0]);
  });
  it("does not fabricate referral attribution without an explicit code or while disabled", async () => {
    await call(); expect(m.rpc).toHaveBeenCalledTimes(1);
    vi.stubEnv("REFERRALS_ENABLED", "false"); await call(code); expect(m.rpc).toHaveBeenCalledTimes(2);
  });
  it("preserves the created account and reports pending attribution on database failure", async () => {
    m.rpc.mockImplementation(async (name: string) => name === "username_available" ? { data: true, error: null } : { data: null, error: { code: "fixture_failure" } });
    const response = await call(code);
    expect(await response.json()).toMatchObject({ ok: true, signedIn: true, referralPending: true });
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it("rejects an executable/malformed code before creating an account", async () => {
    expect((await call("javascript:alert(1)")).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
});
