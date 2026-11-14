import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Shared, durable fixed-window limiter (migration 0013). Counters live in Postgres, so a limit holds across
 * instances and restarts. Keys are stored only as SHA-256 hashes.
 *
 *   "ok"          - within the limit (this call was counted)
 *   "limited"     - over the limit
 *   "unavailable" - the limiter could not be consulted. Callers guarding anything billable, privileged or
 *                   abusable MUST refuse; they must never continue unthrottled.
 *
 * Demo mode (no database configured at all) has nothing billable or privileged to protect and keeps the
 * per-process limiter so the offline experience still works.
 */
export type LimitResult = "ok" | "limited" | "unavailable";

/** The network address reported by the platform edge. X-Forwarded-For is caller-supplied and deliberately ignored. */
export const edgeAddress = (req: Request) => req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";

const databaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function durableLimit(scope: string, subject: string, limit: number, windowMs: number): Promise<LimitResult> {
  if (!databaseConfigured()) return rateLimit(`${scope}:${subject}`, limit, windowMs).ok ? "ok" : "limited";
  const admin = getSupabaseAdmin();
  if (!admin) return "unavailable";
  try {
    const key = createHash("sha256").update(`${scope}\u0000${subject}`).digest("hex");
    const { data, error } = await admin.rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)) });
    if (error || typeof data !== "boolean") return "unavailable";
    return data ? "ok" : "limited";
  } catch {
    return "unavailable";
  }
}
