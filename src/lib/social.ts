import "server-only";

/**
 * Social publishing via Ayrshare (one integration → TikTok, Instagram, YouTube, Facebook, LinkedIn, X, Pinterest, Threads…).
 * Each learner gets their own Ayrshare "profile"; they link accounts on Ayrshare's secure hosted page (OAuth handled there).
 * Env: AYRSHARE_API_KEY, AYRSHARE_DOMAIN, AYRSHARE_PRIVATE_KEY (PEM; "\n" escapes allowed).
 */
const API = "https://api.ayrshare.com/api";
export const PLATFORMS = ["tiktok", "instagram", "youtube", "facebook", "linkedin", "twitter", "threads", "pinterest"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const socialConfigured = () => Boolean(process.env.AYRSHARE_API_KEY && process.env.AYRSHARE_DOMAIN && process.env.AYRSHARE_PRIVATE_KEY);

async function call<T>(path: string, init: RequestInit & { profileKey?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.AYRSHARE_API_KEY}`, "content-type": "application/json", ...(init.profileKey ? { "Profile-Key": init.profileKey } : {}) },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; status?: string };
  if (!res.ok) throw new Error(json.message || `Social provider error (${res.status})`);
  return json;
}

export const createProfile = (title: string) => call<{ profileKey: string }>("/profiles", { method: "POST", body: JSON.stringify({ title }) });

export const linkUrl = (profileKey: string, redirect?: string) =>
  call<{ url: string }>("/profiles/generateJWT", {
    method: "POST",
    body: JSON.stringify({ domain: process.env.AYRSHARE_DOMAIN, privateKey: (process.env.AYRSHARE_PRIVATE_KEY || "").replace(/\\n/g, "\n"), profileKey, ...(redirect ? { redirect } : {}) }),
  });

export const linkedAccounts = async (profileKey: string) => (await call<{ activeSocialAccounts?: string[] }>("/user", { profileKey })).activeSocialAccounts ?? [];

export const publish = (profileKey: string, p: { post: string; platforms: Platform[]; mediaUrls?: string[]; scheduleDate?: string }) =>
  call<{ id?: string; status?: string; postIds?: unknown[] }>("/post", { method: "POST", profileKey, body: JSON.stringify(p) });
