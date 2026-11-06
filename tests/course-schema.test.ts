import { describe, expect, it } from "vitest";
import { GeneratedCourseSchema, toTrack } from "@/lib/course-schema";
import { PlaybookSchema } from "@/lib/playbook-schema";
import { validPluginUrl } from "@/lib/plugins/dispatch";

const lesson = (n: number) => ({
  title: `Lesson ${n}`,
  summary: "Summary",
  minutes: 8,
  blocks: [
    { type: "text", heading: "Intro", body: "Body text" },
    { type: "quiz", question: "Q?", options: ["a", "b", "c"], answer: 7, explanation: "because" },
  ],
});

describe("AI course validation", () => {
  const raw = { name: "Make Flyers with AI", tagline: "t", outcome: "o", emoji: "🖼️", tools: [{ name: "Canva", why: "design", pricing: "freemium", url: "https://canva.com" }], lessons: [lesson(1), lesson(2), lesson(3)] };
  it("rejects out-of-range quiz answers at the schema level", () => expect(GeneratedCourseSchema.safeParse(raw).success).toBe(false));
  it("accepts valid output and builds safe ids", () => {
    const ok = { ...raw, lessons: raw.lessons.map((l) => ({ ...l, blocks: [l.blocks[0], { ...l.blocks[1], answer: 1 }] })) };
    const g = GeneratedCourseSchema.parse(ok);
    const t = toTrack(g, { level: 2, category: "design", language: "en", suffix: "abc123" });
    expect(t.id).toMatch(/^u-[a-z0-9-]+$/);
    expect(t.kind).toBe("custom");
    const lessons = t.weeks[0].modules[0].lessons;
    expect(lessons).toHaveLength(3);
    expect(lessons[0].blocks[0]).toMatchObject({ type: "keypoints" }); // tools list injected
    expect(lessons.every((l) => /^u-[a-z0-9-]+$/.test(l.id))).toBe(true);
  });
  it("rejects unknown block types", () => {
    const bad = { ...raw, lessons: [{ ...lesson(1), blocks: [{ type: "script", body: "<script>" }, { type: "text", body: "x" }] }, lesson(2), lesson(3)] };
    expect(GeneratedCourseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("playbook validation", () => {
  it("requires tools and steps", () => {
    expect(PlaybookSchema.safeParse({ title: "x", outcome: "y", tools: [], steps: [] }).success).toBe(false);
  });
});

describe("plugin URL allow-list (SSRF guard)", () => {
  it("accepts official hosts", () => {
    expect(validPluginUrl("zapier", "https://hooks.zapier.com/hooks/catch/1/abc")).toBe(true);
    expect(validPluginUrl("slack", "https://hooks.slack.com/services/x")).toBe(true);
    expect(validPluginUrl("discord", "https://discord.com/api/webhooks/1/x")).toBe(true);
    expect(validPluginUrl("make", "https://hook.us1.make.com/abc")).toBe(true);
  });
  it("rejects spoofed, internal and non-https targets", () => {
    expect(validPluginUrl("zapier", "https://hooks.zapier.com.evil.io/x")).toBe(false);
    expect(validPluginUrl("webhook", "https://169.254.169.254/latest")).toBe(false);
    expect(validPluginUrl("webhook", "https://localhost/x")).toBe(false);
    expect(validPluginUrl("webhook", "http://example.com/x")).toBe(false);
    expect(validPluginUrl("webhook", "https://example.com:8443/x")).toBe(false);
    expect(validPluginUrl("webhook", "https://api.example.com/hook")).toBe(true);
  });
});
