"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAcademy } from "@/lib/store";

/** Opt in/out of friendly "pick up where you left off" emails. */
export function NudgePrefs() {
  const { user, demo } = useAcademy();
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (demo || !user) return setOn(true);
    const sb = getSupabaseBrowser();
    sb?.from("profiles").select("nudges_enabled").eq("id", user.id).maybeSingle().then(({ data }) => setOn(data?.nudges_enabled ?? true));
  }, [demo, user]);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    if (!demo && user) {
      const { error } = (await getSupabaseBrowser()?.from("profiles").update({ nudges_enabled: next }).eq("id", user.id)) ?? {};
      if (error) {
        setOn(!next);
        return setMsg("Couldn't save. Please try again.");
      }
    }
    setMsg(next ? "Reminders on. We'll check in if you go quiet for a few days." : "Reminders off.");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">If you step away for a few days, we&apos;ll send one short, friendly email (at most once a week) with the next lesson waiting for you.</p>
      <button type="button" role="switch" aria-checked={!!on} disabled={on === null} onClick={toggle} className={`btn-ghost min-h-[44px] ${on ? "border-neon" : ""}`}>
        {on ? "Reminder emails: On" : "Reminder emails: Off"}
      </button>
      <p className="text-sm text-muted" role="status" aria-live="polite">{msg}</p>
    </div>
  );
}
