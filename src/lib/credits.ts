/** Credit packs (one-time Stripe Payment Links). Owner decision 2026-11-04: $1/mo forever + packs; $9.99 per custom course. */
export type CreditKind = "video" | "course";

export interface CreditPack {
  id: string;
  kind: CreditKind;
  qty: number;
  price: string;
  title: string;
  blurb: string;
  url: string;
  paymentLinkId: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "course-1", kind: "course", qty: 1, price: "$9.99", title: "Create Your Own Course", blurb: "Your AI coach builds a complete course on any topic you choose, saved to your library.", url: "https://buy.stripe.com/aFa00kc3373a8VQf4wcQU0a", paymentLinkId: "plink_1UXs2rK68Pw0CGHvZWYnxfFx" },
  { id: "video-5", kind: "video", qty: 5, price: "$4.99", title: "5 AI Video Credits", blurb: "Render 5 real AI video clips in the Studio.", url: "https://buy.stripe.com/bJecN67MNevCfkee0scQU0b", paymentLinkId: "plink_1UXs2tK68Pw0CGHvQjKXPZCA" },
  { id: "video-20", kind: "video", qty: 20, price: "$14.99", title: "20 AI Video Credits", blurb: "Best value for creators: 20 renders.", url: "https://buy.stripe.com/4gM9AU9UV1IQ6NI6y0cQU0c", paymentLinkId: "plink_1UXs2vK68Pw0CGHvdeWFWTbX" },
];

export const packByPaymentLink = (id: string | null | undefined) => CREDIT_PACKS.find((p) => p.paymentLinkId === id);

/** Adds the learner's id (and email) so the webhook knows whose wallet to credit. */
export function buyUrl(pack: CreditPack, userId: string, email?: string) {
  const u = new URL(pack.url);
  u.searchParams.set("client_reference_id", userId);
  if (email) u.searchParams.set("prefilled_email", email);
  return u.toString();
}
