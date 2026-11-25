"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, FormAlert, PasswordField } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";

function ResetForm() {
  const { updatePassword } = useAcademy();
  const router = useRouter();
  const params = useSearchParams();
  const demoEmail = params.get("demo") ?? undefined;
  const tokenHash = params.get("token_hash");

  // Links from our own reset email carry a one-time token: exchange it for a session first.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb || !tokenHash) return;
    sb.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
      if (error) setError("This reset link is invalid or expired. Request a new one.");
    });
  }, [tokenHash]);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <AuthCard title="Choose a new password" footer={<Link href="/login" className="text-neon hover:underline">Back to sign in</Link>}>
      {done ? (
        <div className="space-y-4">
          <FormAlert kind="success">Password updated. You can sign in with your new password.</FormAlert>
          <button className="btn-primary w-full" onClick={() => router.push("/login")}>Go to sign in</button>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw !== confirm) return setError("Passwords don't match.");
            setBusy(true);
            const r = await updatePassword(pw, demoEmail);
            setBusy(false);
            if (r.ok) setDone(true);
            else setError(r.error);
          }}
        >
          {error && <FormAlert kind="error">{error}</FormAlert>}
          <PasswordField id="new-password" label="New password" value={pw} onChange={setPw} autoComplete="new-password" showStrength />
          <PasswordField id="confirm-password" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <button className="btn-primary w-full" disabled={busy || !pw || !confirm}>{busy ? "Saving…" : "Update password"}</button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
