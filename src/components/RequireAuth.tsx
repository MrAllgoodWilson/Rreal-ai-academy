"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAcademy } from "@/lib/store";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAcademy();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(path ?? "/dashboard")}`);
  }, [ready, user, router, path]);
  if (!ready || !user)
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-neon" aria-hidden="true" />
        <span className="sr-only">Loading your academy…</span>
      </div>
    );
  return <>{children}</>;
}

/** Signed in AND an active $1/month membership. Otherwise → /subscribe. */
export function RequireMember({ children }: { children: ReactNode }) {
  const { ready, user, subscribed } = useAcademy();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path ?? "/dashboard")}`);
    else if (!subscribed) router.replace(`/subscribe?next=${encodeURIComponent(path ?? "/dashboard")}`);
  }, [ready, user, subscribed, router, path]);
  if (!ready || !user || !subscribed)
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-neon" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  return <>{children}</>;
}
