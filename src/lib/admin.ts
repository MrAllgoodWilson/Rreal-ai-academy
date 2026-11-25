import "server-only";
import type { User } from "@supabase/supabase-js";

/** Admins are configured by email in ADMIN_EMAILS (comma-separated). */
export const isAdmin = (user: Pick<User, "email"> | null | undefined) => {
  const list = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!user?.email && list.includes(user.email.toLowerCase());
};
