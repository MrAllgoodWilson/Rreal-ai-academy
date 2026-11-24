import { describe, expect, it } from "vitest";
import { ALL_TRACKS, lessonsForTrack, lockReason } from "@/lib/curriculum";
import { gradePrompt } from "@/lib/prompt-grader";

const track = ALL_TRACKS.find((t) => t.id === "c-claude-mastery")!;
const refs = lessonsForTrack("c-claude-mastery");
const lessons = refs.map((r) => r.lesson);

describe("Claude.ai complete guide course", () => {
  it("is a standalone, self-paced course with 24 stable, prefixed lessons", () => {
    expect(track).toBeDefined();
    expect(track.kind).toBe("course");
    expect(track.weeks).toHaveLength(1);
    expect(lessons).toHaveLength(24);
    expect(new Set(lessons.map((l) => l.id)).size).toBe(24);
    for (const l of lessons) expect(l.id.startsWith("cm-")).toBe(true);
    expect(lessons[0].id).toBe("cm-welcome");
    expect(lessons[23].id).toBe("cm-playbook");
  });

  it("gives every lesson one four-option quiz, one prompt lab and 4–7 blocks, with sane timing", () => {
    for (const l of lessons) {
      expect(l.blocks.length).toBeGreaterThanOrEqual(4);
      expect(l.blocks.length).toBeLessThanOrEqual(7);
      const quiz = l.blocks.filter((b) => b.type === "quiz");
      expect(quiz).toHaveLength(1);
      const q = quiz[0];
      if (q.type !== "quiz") throw new Error("unreachable");
      expect(q.options).toHaveLength(4);
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.explanation.length).toBeGreaterThan(20);
      expect(new Set(q.options).size).toBe(4);
      expect(l.blocks.filter((b) => b.type === "prompt-lab")).toHaveLength(1);
      expect(l.minutes).toBeGreaterThanOrEqual(6);
      expect(l.minutes).toBeLessThanOrEqual(14);
      expect(l.xp).toBeGreaterThanOrEqual(50);
    }
  });

  it("spreads the correct quiz answer across positions (no always-B pattern)", () => {
    const answers = lessons.map((l) => {
      const q = l.blocks.find((b) => b.type === "quiz");
      return q && q.type === "quiz" ? q.answer : -1;
    });
    expect(new Set(answers).size).toBeGreaterThanOrEqual(2);
  });

  it("states independence from Anthropic and points learners to official sources", () => {
    const first = JSON.stringify(lessons[0]);
    expect(first).toMatch(/independent and are not part of Anthropic/);
    expect(JSON.stringify(lessons)).toMatch(/Anthropic's (current|own)/);
  });

  it("keeps practice safe: no real secrets, no guarantees, and fictional or placeholder practice", () => {
    const text = JSON.stringify(lessons);
    expect(text).not.toMatch(/sk_live_|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(text).not.toMatch(/\bguarantee[sd]?\b(?! the|d)/i);
    expect(text).not.toMatch(/\$\d/); // no prices: plan prices and limits change and are not taught here
    expect(text).toMatch(/made-up|fictional|placeholder/i);
  });

  it("includes a safety and a verification lesson", () => {
    const safety = lessons.find((l) => l.id === "cm-safety");
    expect(safety).toBeDefined();
    expect(JSON.stringify(safety)).toMatch(/verify|check/i);
    expect(JSON.stringify(safety)).toMatch(/password/i);
  });

  it("every prompt lab can be passed offline with a well-formed answer (no paid API needed)", () => {
    for (const l of lessons) {
      const lab = l.blocks.find((b) => b.type === "prompt-lab");
      if (!lab || lab.type !== "prompt-lab") throw new Error("missing lab");
      expect(lab.minScore).toBeGreaterThanOrEqual(55);
      expect(lab.minScore).toBeLessThanOrEqual(80);
      // A model answer built from the lab's own goal text plus the rubric ingredients must be able to clear the bar.
      const answer = `You are a helpful assistant for my small business. ${lab.goal} Write the result as a table with 5 rows, under 150 words, for example: "Item - reason". Avoid jargon and do not invent facts.`;
      expect(gradePrompt(answer).score).toBeGreaterThanOrEqual(lab.minScore);
    }
  });

  it("is open to members from lesson 1 and unlocks in order", () => {
    expect(lockReason("cm-welcome", {}, { subscribed: true })).toBeNull();
    expect(lockReason("cm-first-chat", {}, { subscribed: true })).toBe("prerequisite");
    expect(lockReason("cm-first-chat", { "cm-welcome": true }, { subscribed: true })).toBeNull();
    expect(lockReason("cm-welcome", {}, { subscribed: false })).toBe("subscription");
  });
});
