import { afterEach, describe, expect, it } from "vitest";
import { emailHash } from "@/lib/founders-closure";
const original = process.env.FOUNDERS_IDENTITY_HMAC_KEY;
afterEach(() => { if (original === undefined) delete process.env.FOUNDERS_IDENTITY_HMAC_KEY; else process.env.FOUNDERS_IDENTITY_HMAC_KEY = original; });
describe("Founders identity tombstone", () => {
  it("normalizes identity and separates server keys", () => {
    process.env.FOUNDERS_IDENTITY_HMAC_KEY = "fixture-key-one-with-at-least-32-bytes";
    const first = emailHash(" Person@Example.test ");
    expect(first).toBe(emailHash("person@example.test"));
    expect(first).toMatch(/^hmac-sha256:v1:[a-f0-9]{64}$/);
    process.env.FOUNDERS_IDENTITY_HMAC_KEY = "fixture-key-two-with-at-least-32-bytes";
    expect(emailHash("person@example.test")).not.toBe(first);
  });
  it("refuses missing or short identity keys", () => {
    delete process.env.FOUNDERS_IDENTITY_HMAC_KEY;
    expect(() => emailHash("person@example.test")).toThrow();
    process.env.FOUNDERS_IDENTITY_HMAC_KEY = "short";
    expect(() => emailHash("person@example.test")).toThrow();
  });
});
