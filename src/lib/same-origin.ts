/** Browser mutations need explicit same-origin intent in addition to authenticated cookies. */
export function sameOriginRequest(req: Request): boolean {
  try {
    const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://rrealaiacademy.app").origin;
    return req.headers.get("origin") === expected;
  } catch { return false; }
}
