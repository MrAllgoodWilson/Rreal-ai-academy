// Independent QA (Claude): F13 [E5/E6] identity-abuse throttling on the current Rreal login route (separate file so its module mocks cannot contaminate the billing tests).
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({ auth: { signInWithPassword: async () => ({ error: { message: "bad" } }) } }), getSupabaseAdmin: () => null }));
describe("login throttling", () => {
  it("F13 30 password guesses against one account with a rotating X-Forwarded-For are rate-limited (limiter must not trust a client-supplied header)", async () => {
    const { POST } = await import("../src/app/api/auth/login/route"); let limited = 0;
    for (let i = 0; i < 30; i++) { const r = await POST(new Request("https://x.test/api/auth/login", { method: "POST", headers: { "x-forwarded-for": `203.0.113.${i}`, "content-type": "application/json" }, body: JSON.stringify({ identifier: "victim@x.test", password: "guess" + i }) })); if (r.status === 429) limited++; }
    expect(limited, "no 429 despite 30 attempts against one account").toBeGreaterThan(0);
  });
  it("F13b control: from ONE fixed address the limiter does stop at 10 attempts", async () => {
    const { POST } = await import("../src/app/api/auth/login/route"); let limited = 0;
    for (let i = 0; i < 15; i++) { const r = await POST(new Request("https://x.test/api/auth/login", { method: "POST", headers: { "x-forwarded-for": "198.51.100.7", "content-type": "application/json" }, body: JSON.stringify({ identifier: "victim@x.test", password: "g" + i }) })); if (r.status === 429) limited++; }
    expect(limited).toBeGreaterThan(0);
  });
});
