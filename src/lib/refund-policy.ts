/**
 * Refund policy as data, so the public page, the Settings section, the request route and the tests all read the same numbers.
 * Modelled on common practice among online-learning platforms (researched 2026-11-26): monthly subscriptions are cancel-anytime with no
 * prorated refunds (Codecademy, DataCamp, Skillshare, Udemy, Coursera Plus monthly); one-time purchases get a short window (Coursera 7 days,
 * Udemy 30 days); duplicate or erroneous charges and legal rights are always honoured. NOT legal advice: have counsel review before launch.
 */
export const REFUND_POLICY = {
  /** One good-will refund of the first monthly charge if asked within this many days (a $1 refund costs less than a dispute fee). */
  firstChargeDays: 7,
  /** Unused credits from a credit pack can be refunded within this many days of purchase. */
  creditPackDays: 14,
  /** We answer every request within this many business days. */
  replyBusinessDays: 3,
  /** After approval the money normally reaches the original payment method in this time. */
  processingBusinessDays: "5 to 10",
  supportEmail: "support@rrealaiacademy.app",
} as const;

export type RefundKind = "first_charge" | "credit_pack" | "duplicate_charge" | "other";
export const REFUND_KINDS: { value: RefundKind; label: string; labelEs: string }[] = [
  { value: "first_charge", label: "My first monthly membership charge", labelEs: "Mi primer cargo mensual de membresía" },
  { value: "credit_pack", label: "A credit pack I have not used", labelEs: "Un paquete de créditos que no he usado" },
  { value: "duplicate_charge", label: "I was charged twice or by mistake", labelEs: "Me cobraron dos veces o por error" },
  { value: "other", label: "Something else", labelEs: "Otra cosa" },
];

const DAY = 86_400_000;

/** Whether a request still falls inside the self-service window. A "no" is not a final refusal: a person still reads every request. */
export function withinWindow(kind: RefundKind, purchasedAt: Date, now: Date = new Date()): boolean {
  const days = (now.getTime() - purchasedAt.getTime()) / DAY;
  if (days < 0 || Number.isNaN(days)) return false;
  if (kind === "first_charge") return days <= REFUND_POLICY.firstChargeDays;
  if (kind === "credit_pack") return days <= REFUND_POLICY.creditPackDays;
  return true; // duplicate/erroneous charges and "other" are always reviewed by a person
}

export interface RefundRequestInput { kind: RefundKind; details: string; purchasedOn?: string }
export type RefundValidation = { ok: true; value: RefundRequestInput } | { ok: false; error: string };

export function validateRefundRequest(body: unknown): RefundValidation {
  if (!body || typeof body !== "object") return { ok: false, error: "Send a JSON body." };
  const b = body as Record<string, unknown>;
  const kind = b.kind as RefundKind;
  if (!REFUND_KINDS.some((k) => k.value === kind)) return { ok: false, error: "Choose what the refund is for." };
  const details = typeof b.details === "string" ? b.details.trim() : "";
  if (details.length < 10) return { ok: false, error: "Tell us a little more (at least 10 characters)." };
  if (details.length > 2000) return { ok: false, error: "Please keep details under 2000 characters." };
  let purchasedOn: string | undefined;
  if (b.purchasedOn !== undefined && b.purchasedOn !== "") {
    if (typeof b.purchasedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.purchasedOn) || Number.isNaN(Date.parse(b.purchasedOn))) return { ok: false, error: "Use the date format YYYY-MM-DD." };
    purchasedOn = b.purchasedOn;
  }
  return { ok: true, value: { kind, details, purchasedOn } };
}
