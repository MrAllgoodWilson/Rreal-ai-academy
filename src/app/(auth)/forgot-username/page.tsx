"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, Field, FormAlert } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";

export default function ForgotUsernamePage() {
  const { recoverUsername } = useAcademy();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <AuthCard title="Forgot your username?" subtitle="Enter your account email and we'll send your username to it." footer={<Link href="/login" className="text-neon hover:underline">Back to sign in</Link>}>
      {message ? (
        <FormAlert kind="success">{message}</FormAlert>
      ) : (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await recoverUsername(email);
            setBusy(false);
            if (r.ok) setMessage(r.message ?? "");
          }}
        >
          <Field id="email" label="Account email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn-primary w-full" disabled={busy || !email}>{busy ? "Sending…" : "Email my username"}</button>
          <p className="text-center text-sm text-muted">
            Tip: you can also sign in with your email address instead of your username.
          </p>
        </form>
      )}
    </AuthCard>
  );
}
