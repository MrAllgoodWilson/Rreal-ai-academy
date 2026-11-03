import { describe, expect, it } from "vitest";
import { credentialCode, signCertificate, verifyCertificate } from "@/lib/certificates/server";
import { linkedInAddUrl } from "@/lib/certificates/shared";

describe("certificate signing", () => {
  it("round-trips a valid credential", () => {
    const { token, payload } = signCertificate({ n: "Ana Lopez", t: "foundations", s: 95 });
    const v = verifyCertificate(token);
    expect(v.valid).toBe(true);
    if (v.valid) expect(v.payload).toEqual(payload);
    expect(credentialCode(payload)).toMatch(/^RRAI-\d{4}-[0-9A-F]{8}$/);
  });
  it("rejects a tampered name", () => {
    const { token } = signCertificate({ n: "Ana Lopez", t: "foundations", s: 95 });
    const [body, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    forged.n = "Mallory";
    const forgedToken = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
    expect(verifyCertificate(forgedToken).valid).toBe(false);
  });
  it("rejects garbage", () => {
    expect(verifyCertificate("nope").valid).toBe(false);
    expect(verifyCertificate("a.b").valid).toBe(false);
  });
  it("builds a LinkedIn add-to-profile URL", () => {
    const url = new URL(linkedInAddUrl({ title: "Rreal Certified: AI Foundations", token: "abc.def", code: "RRAI-2026-ABCDEF12", issued: "2026-11-03T00:00:00Z" }));
    expect(url.hostname).toBe("www.linkedin.com");
    expect(url.searchParams.get("startTask")).toBe("CERTIFICATION_NAME");
    expect(url.searchParams.get("certId")).toBe("RRAI-2026-ABCDEF12");
    expect(url.searchParams.get("certUrl")).toContain("/verify/abc.def");
  });
});
