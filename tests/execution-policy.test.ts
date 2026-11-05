import { beforeEach, describe, expect, it, vi } from "vitest";
import { contributionGate } from "@/lib/execution-policy";
const m = vi.hoisted(() => ({ cfImage: vi.fn(), cfSpeech: vi.fn(), callClaude: vi.fn(), own: false }));
vi.mock("@/lib/cf-ai", () => ({ cfImage: m.cfImage, cfSpeech: m.cfSpeech, cfAiAvailable: async () => true }));
vi.mock("@/lib/claude", () => ({ callClaude: m.callClaude }));
vi.mock("@/lib/server-auth", () => ({ getMember: async () => ({ demo: false, member: { user: { id: "fixture" } } }), takeQuota: async () => null }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "fixture", rateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/byok-server", () => ({ readByok: () => m.own ? { openai: "fixture-key" } : {}, ownsTextAi: (b: { openai?: string }) => Boolean(b.openai) }));
import { POST as image } from "@/app/api/image/route";
import { POST as speech } from "@/app/api/tts/route";
import { POST as coach } from "@/app/api/coach/route";
const req = (body: unknown) => new Request("https://fixture.test", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
beforeEach(() => { vi.clearAllMocks(); m.own = false; });
describe("unfunded provider execution", () => {
  it("never generates an Academy-funded image without a reservation", async () => {
    expect((await image(req({ prompt: "A fictional skyline", style: "poster" }))).status).toBe(503);
    expect(m.cfImage).not.toHaveBeenCalled();
  });
  it("never generates cloud audio without funding", async () => {
    expect((await speech(req({ text: "Hello world", voiceId: "cf:en:asteria" }))).status).toBe(503);
    expect(m.cfSpeech).not.toHaveBeenCalled();
  });
  it("preserves offline learning without making an unfunded live-Coach call", async () => {
    const res = await coach(req({ messages: [{ role: "user", content: "Teach me a clear prompt" }], mode: "chat", lang: "en" }));
    expect(res.status).toBe(200);
    expect((await res.json()).mode).toBe("offline");
    expect(m.callClaude).not.toHaveBeenCalled();
  });
  it("allows the member-owned text provider without charging the Academy", async () => {
    m.own = true; m.callClaude.mockResolvedValue("Fixture reply");
    const res = await coach(req({ messages: [{ role: "user", content: "Teach prompting" }], mode: "chat", lang: "en" }));
    expect((await res.json()).mode).toBe("live");
    expect(m.callClaude).toHaveBeenCalledOnce();
  });
});
describe("contribution risk gate", () => {
  it("fails closed on missing costs rather than assuming free compute", () => {
    expect(contributionGate(13_280_000, [null, 3_000_000], 1_000_000).allowed).toBe(false);
  });
  it("counts a full10-dollar reward liability conservatively", () => {
    expect(contributionGate(13_280_000, [10_000_000, 4_000_000], 0).allowed).toBe(false);
  });
  it("rejects unsafe numeric values and allows only an adequate measured contribution", () => {
    expect(contributionGate(1_000_000, [NaN], 0).allowed).toBe(false);
    expect(contributionGate(13_280_000, [3_000_000, 4_000_000], 2_000_000).allowed).toBe(true);
  });
});
