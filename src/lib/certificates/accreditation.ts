import "server-only";

/**
 * Two kinds of credentials:
 *  - "rreal": Rreal Certified — issued by Rreal AI Academy itself (a certificate of completion/competency).
 *  - "accredited": co-issued with an accredited partner (school, CE provider) — e.g. continuing-education units (CEUs).
 * Accredited issuance turns on ONLY when a real partner agreement exists and these env vars are set:
 *   ACCREDITATION_PARTNER        e.g. "Example Community College"
 *   ACCREDITING_BODY             e.g. "IACET" or the school's regional accreditor
 *   ACCREDITATION_PROVIDER_ID    partner/provider number shown on certificates
 *   ACCREDITED_TRACKS            comma-separated track/course ids, or "all"
 *   CEU_PER_HOUR                 default 0.1 (1 CEU = 10 contact hours)
 */
export interface Accreditation {
  partner: string;
  body: string;
  providerId?: string;
  ceu: number;
}

export function accreditationFor(trackId: string, minutes: number): Accreditation | null {
  const partner = process.env.ACCREDITATION_PARTNER;
  const body = process.env.ACCREDITING_BODY;
  const list = (process.env.ACCREDITED_TRACKS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!partner || !body || !(list.includes("all") || list.includes(trackId))) return null;
  const perHour = Number(process.env.CEU_PER_HOUR ?? 0.1);
  return { partner, body, providerId: process.env.ACCREDITATION_PROVIDER_ID, ceu: Math.round((minutes / 60) * perHour * 10) / 10 };
}
