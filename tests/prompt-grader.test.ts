import { describe, expect, it } from "vitest";
import { gradePrompt } from "@/lib/prompt-grader";

describe("Prompt Quality Score", () => {
  it("scores vague prompts low", () => expect(gradePrompt("write about dogs").score).toBeLessThan(30));
  it("scores empty as 0", () => expect(gradePrompt("").score).toBe(0));
  it("scores R.E.A.L. prompts high", () => {
    const g = gradePrompt('You are a friendly pet-care writer. Write a 120-word Instagram caption for my new dog-walking business in Austin. Upbeat tone, max 2 emojis, for example: "Paws up, Austin!" End with a question to drive comments.');
    expect(g.score).toBeGreaterThanOrEqual(90);
    expect(g.grade).toBe("S");
  });
  it("explains what is missing", () => {
    const g = gradePrompt("Write a blog post about coffee");
    expect(g.criteria.find((c) => c.id === "role")?.passed).toBe(false);
    expect(g.criteria.find((c) => c.id === "task")?.passed).toBe(true);
  });
});
