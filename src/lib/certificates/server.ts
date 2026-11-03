import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getTrack } from "@/lib/curriculum";

/**
 * Rreal Certified credential engine.
 *
 * A credential is a signed token:  base64url(payload) "." base64url(HMAC-SHA256(secret, payload))
 * - Tamper-proof: changing any byte (name, date, track) breaks the signature.
 * - Self-verifying: /verify/[token] works even before a database is connected.
 * - When Supabase is configured the certificate row is also stored so it can be revoked.
 */

export interface CertificatePayload {
  v: 1;
  /** Random credential id (hex) */
  cid: string;
  /** Recipient display name */
  n: string;
  /** Track id, or "master" for the full program */
  t: string;
  /** Issue date ISO */
  i: string;
  /** Exam / completion score 0-100 */
  s: number;
  /** Optional user id */
  u?: string;
}

const MASTER_TITLE = "Rreal Certified AI Professional";

function secret() {
  const s = process.env.CERT_SIGNING_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production" && process.env.RREAL_ALLOW_DEMO_SECRET !== "1") {
    throw new Error("CERT_SIGNING_SECRET must be set (32+ chars) in production.");
  }
  return "rreal-demo-signing-secret-do-not-use-in-production-0001";
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function signCertificate(p: Omit<CertificatePayload, "v" | "cid" | "i"> & { i?: string }) {
  const payload: CertificatePayload = { v: 1, cid: randomBytes(8).toString("hex"), i: p.i ?? new Date().toISOString(), n: p.n, t: p.t, s: p.s, u: p.u };
  const body = b64(JSON.stringify(payload));
  const sig = b64(createHmac("sha256", secret()).update(body).digest());
  return { token: `${body}.${sig}`, payload };
}

export function verifyCertificate(token: string): { valid: true; payload: CertificatePayload } | { valid: false; reason: string } {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return { valid: false, reason: "Malformed credential ID." };
  const expected = createHmac("sha256", secret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return { valid: false, reason: "Malformed signature." };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { valid: false, reason: "Signature does not match. This credential was altered or not issued by Rreal AI Academy." };
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CertificatePayload;
    if (payload.v !== 1) return { valid: false, reason: "Unknown credential version." };
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: "Unreadable credential." };
  }
}

export const credentialTitle = (trackId: string) => (trackId === "master" ? MASTER_TITLE : getTrack(trackId)?.certificateTitle ?? "Rreal Certified");
export const credentialCode = (p: Pick<CertificatePayload, "cid" | "i">) => `RRAI-${p.i.slice(0, 4)}-${p.cid.slice(0, 8).toUpperCase()}`;
export const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");
