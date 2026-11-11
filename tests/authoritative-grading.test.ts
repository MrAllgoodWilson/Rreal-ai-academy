import { describe, expect, it, vi } from "vitest";

const state = { rpcArgs: null as any };

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({
    rpc: async (name: string, args: any) => {
      state.rpcArgs = { name, args };
      return { data: { xp_awarded: 50 }, error: null };
    },
    auth: {
      getUser: async () => ({ data: { user: { id: "user_test_1" } } }),
    },
  }),
}));

vi.mock("@/lib/plugins/dispatch", () => ({
  dispatchPluginEvent: () => {},
}));

const { POST } = await import("@/app/api/progress/complete/route");

describe("Authoritative Server-Side Lesson & Quiz Grading (R-2 defect fix)", () => {
  it("rejects client-fabricated 100% score when quiz answers are missing", async () => {
    // Lesson 'ai-in-plain-english' has quizzes; client sends score: 100 without answers
    const req = new Request("http://localhost/api/progress/complete", {
      method: "POST",
      body: JSON.stringify({ lessonId: "ai-in-plain-english", score: 100 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Server overrides client score to 0 because no answers were submitted
    expect(state.rpcArgs.args.p_score).toBe(0);
  });

  it("calculates authoritative score from submitted answers", async () => {
    // Submit both correct answers for quizzes in ai-in-plain-english (q-ai-1: 1, q-ai-2: 1)
    const req = new Request("http://localhost/api/progress/complete", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "ai-in-plain-english",
        answers: { "q-ai-1": 1, "q-ai-2": 1 },
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(state.rpcArgs.args.p_score).toBe(100);
  });

  it("calculates partial score when one answer is incorrect", async () => {
    const req = new Request("http://localhost/api/progress/complete", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "ai-in-plain-english",
        answers: { "q-ai-1": 1, "q-ai-2": 0 }, // q-ai-2 is wrong
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(state.rpcArgs.args.p_score).toBe(50);
  });

  it("enforces time-guard on capstone exam", async () => {
    const req = new Request("http://localhost/api/progress/complete", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "capstone-exam",
        score: 100,
        timeSpentSeconds: 2, // Submitted in 2 seconds -> should be rejected
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("too quickly");
  });
});
