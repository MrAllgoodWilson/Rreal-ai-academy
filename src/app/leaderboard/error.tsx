"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function LeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Leaderboard route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-2xl border border-line bg-surface/80 p-8 shadow-xl">
        <AlertCircle className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
        <h2 className="mt-4 font-display text-xl font-bold text-ink">Leaderboard Unavailable</h2>
        <p className="mt-2 text-sm text-muted">We were unable to load the league table. Your progress and XP are safely saved.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </button>
          <Link href="/dashboard" className="btn-ghost inline-flex items-center justify-center">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
