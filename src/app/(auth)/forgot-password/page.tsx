"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, Field, FormAlert } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAcademy();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ message?: string; demoLink?: string } | null>(null);

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a secure, one-time reset link." footer={<Link href="/login" className="text-neon hover:underline">Back to sign in</Link>}>
      {done ? (
        <div className="space-y-4">
          <FormAlert kind="success">{done.message}</FormAlert>
          {done.demoLink && (
            <p className="text-sm text-muted">
              Demo mode — email is disabled. <Link href={done.demoLink} className="font-semibold text-neon underline">Open your reset link</Link>
            </p>
          )}
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await requestPasswordReset(email);
            setBusy(false);
            if (r.ok) setDone({ message: r.message, demoLink: r.demoLink });
          }}
        >
          <Field id="email" label="Account email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn-primary w-full" disabled={busy || !email}>{busy ? "Sending…" : "Send reset link"}</button>
          <p className="text-center text-sm text-muted">
            Don’t remember your username? <Link href="/forgot-username" className="text-neon underline">Recover it</Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
