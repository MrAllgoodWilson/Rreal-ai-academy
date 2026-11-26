import { beforeEach, describe, expect, it, vi } from "vitest";

let n = 0;
const st = { uid: "u0", member: "user" as "user" | "demo" | "anon", sent: [] as { to: string; subject: string; html: string }[], sendOk: true };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-auth", async () => {
  const { NextResponse } = await import("next/server");
  return { getMember: async () => st.member === "demo" ? { demo: true } : st.member === "anon" ? { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) } : { demo: false, member: { user: { id: st.uid, email: "learner@example.test" } } } };
});
vi.mock("@/lib/email", () => ({ sendEmail: async (to: string, subject: string, html: string) => (st.sent.push({ to, subject, html }), st.sendOk) }));

const { POST } = await import("@/app/api/refund-request/route");
const call = (body: unknown, headers: Record<string, string> = {}) => POST(new Request("https://rreal.test/api/refund-request", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const good = { kind: "first_charge", details: "I signed up by mistake yesterday.", purchasedOn: "2026-11-25" };
beforeEach(() => { st.uid = `u${++n}`; st.member = "user"; st.sent = []; st.sendOk = true; });

describe("POST /api/refund-request", () => {
  it("emails the request to support and answers 202; it never refunds anything", async () => {
    const r = await call(good);
    expect(r.status).toBe(202);
    expect(st.sent).toHaveLength(1);
    expect(st.sent[0].subject).toMatch(/Refund request/);
    expect(st.sent[0].html).toContain("learner@example.test");
  });
  it("401 when signed out, 501 in demo mode", async () => {
    st.member = "anon"; expect((await call(good)).status).toBe(401);
    st.member = "demo"; expect((await call(good)).status).toBe(501);
    expect(st.sent).toHaveLength(0);
  });
  it("refuses a cross-site request", async () => {
    expect((await call(good, { origin: "https://evil.test" })).status).toBe(403);
    expect(st.sent).toHaveLength(0);
  });
  it("400 on invalid input and on a body that is not JSON", async () => {
    expect((await call({ kind: "gift", details: "long enough details" })).status).toBe(400);
    expect((await call("not json")).status).toBe(400);
  });
  it("escapes HTML in what the learner typed", async () => {
    await call({ ...good, details: "<script>alert(1)</script> please refund me" });
    expect(st.sent[0].html).not.toContain("<script>");
    expect(st.sent[0].html).toContain("&lt;script&gt;");
  });
  it("503 with a direct email address when the message could not be sent", async () => {
    st.sendOk = false;
    const r = await call(good);
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain("@");
  });
  it("rate-limits a learner to 3 requests an hour", async () => {
    st.member = "user";
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await call(good)).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});
