import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ getMember: vi.fn(), spendCredit: vi.fn(), refundCredit: vi.fn(), startVideo: vi.fn(), readByok: vi.fn(), insert: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ getMember: m.getMember, spendCredit: m.spendCredit, refundCredit: m.refundCredit }));
vi.mock("@/lib/video", () => ({ videoConfigured: () => true, startVideo: m.startVideo }));
vi.mock("@/lib/byok-server", () => ({ readByok: m.readByok }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "fixture", rateLimit: () => ({ ok: true }) }));
import { POST } from "@/app/api/video/render/route";
const request = () => new Request("https://example.test/api/video/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "A fictional city skyline at sunset" }) });
beforeEach(() => {
  vi.resetAllMocks();
  m.single.mockResolvedValue({ data: { id: "render-fixture" }, error: null });
  m.insert.mockReturnValue({ select: () => ({ single: m.single }) });
  m.getMember.mockResolvedValue({ demo: false, member: { user: { id: "fixture-user" }, sb: { from: () => ({ insert: m.insert }) } } });
  m.readByok.mockReturnValue({});
  m.spendCredit.mockResolvedValue(true);
  m.startVideo.mockResolvedValue({ id: "provider-fixture" });
});
describe("no free Academy-funded project renders", () => {
  it("does not call the paid provider when no purchased credit is available", async () => {
    m.spendCredit.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(402);
    expect(m.startVideo).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("requires a purchased credit even for the member's first render", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(m.spendCredit).toHaveBeenCalledTimes(1);
    expect(m.spendCredit.mock.invocationCallOrder[0]).toBeLessThan(m.startVideo.mock.invocationCallOrder[0]);
  });
  it("does not double charge the Academy wallet when using a member-owned provider", async () => {
    m.readByok.mockReturnValue({ replicate: "fixture-member-provider" });
    expect((await POST(request())).status).toBe(200);
    expect(m.spendCredit).not.toHaveBeenCalled();
    expect(m.startVideo).toHaveBeenCalledWith("A fictional city skyline at sunset", "fixture-member-provider");
  });
  it("restores the purchased credit when the provider rejects the job", async () => {
    m.startVideo.mockResolvedValue({ error: "Fixture rejection" });
    expect((await POST(request())).status).toBe(502);
    const ref = m.spendCredit.mock.calls[0][2];
    expect(m.refundCredit).toHaveBeenCalledWith("fixture-user", "video", ref);
    expect(m.insert).not.toHaveBeenCalled();
  });
});
