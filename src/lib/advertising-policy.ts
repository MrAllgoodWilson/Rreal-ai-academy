/** Disabled-by-default placement policy. This module loads no ad scripts and makes no network requests. */
export interface AdvertisingPlacement {
  id: string;
  paths: readonly string[];
  status: "draft" | "reviewed";
  publisherApproved: boolean;
  founderActivationApproved: boolean;
  disclosureApproved: boolean;
  requiresConsent: boolean;
}
export interface AdvertisingContext {
  enabled?: boolean;
  authenticated?: boolean;
  paidContent?: boolean;
  childDirected?: boolean;
  consentGranted?: boolean;
}
export const ADVERTISING_ENABLED = false;
export const ADVERTISING_PLACEMENTS: readonly AdvertisingPlacement[] = [];
const protectedSegments = new Set(["api", "auth", "login", "signup", "checkout", "subscribe", "account", "settings", "dashboard", "admin", "learn", "lesson", "lessons", "coach", "sandbox", "forms"]);
export function advertisingAllowed(path: string, placement: AdvertisingPlacement, context: AdvertisingContext = {}): boolean {
  if (context.enabled !== true || context.authenticated !== false || context.paidContent !== false || context.childDirected !== false) return false;
  if (placement.status !== "reviewed" || !placement.publisherApproved || !placement.founderActivationApproved || !placement.disclosureApproved) return false;
  if (placement.requiresConsent && context.consentGranted !== true) return false;
  // Exact public paths only; reject alternate encodings and URL delimiters rather than guessing route identity.
  if (!path.startsWith("/") || path.startsWith("//") || /[%?\\#]/.test(path) || path.includes("..")) return false;
  const segments = path.toLowerCase().split("/").filter(Boolean);
  if (segments.some(segment => protectedSegments.has(segment))) return false;
  return placement.paths.includes(path);
}
