/** Client-safe helpers for certificates (no secrets here). */
export const siteUrl = () => (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

export const verifyUrl = (token: string) => `${siteUrl()}/verify/${token}`;

/** LinkedIn "Add license or certification" deep link. */
export function linkedInAddUrl(opts: { title: string; token: string; code: string; issued: string }) {
  const d = new Date(opts.issued);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: opts.title,
    issueYear: String(d.getFullYear()),
    issueMonth: String(d.getMonth() + 1),
    certUrl: verifyUrl(opts.token),
    certId: opts.code,
  });
  const org = process.env.NEXT_PUBLIC_LINKEDIN_ORG_ID;
  if (org) params.set("organizationId", org);
  else params.set("organizationName", "Rreal AI Academy");
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}
