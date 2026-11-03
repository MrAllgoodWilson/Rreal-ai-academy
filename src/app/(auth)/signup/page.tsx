"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, Field, FormAlert, PasswordField } from "@/components/AuthCard";
import { USERNAME_RE, useAcademy } from "@/lib/store";

export default function SignupPage() {
  const { signUp, user, ready } = useAcademy();
  const router = useRouter();
  const [f, setF] = useState({ displayName: "", username: "", email: "", password: "", agree: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/onboarding");
  }, [ready, user, router]);

  const usernameErr = f.username && !USERNAME_RE.test(f.username) ? "3–20 characters: letters, numbers, underscores." : undefined;

  return (
    <AuthCard
      title="Create your account"
      subtitle="Week 1 is free. No credit card."
      footer={
        <>
          Already have an account? <Link href="/login" className="font-semibold text-neon hover:underline">Sign in</Link>
        </>
      }
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.agree) return setError("Please accept the Terms and Privacy Policy to continue.");
          setBusy(true);
          setError("");
          const r = await signUp(f);
          setBusy(false);
          if (!r.ok) setError(r.error);
          else if (r.message) setNotice(r.message);
        }}
      >
        {error && <FormAlert kind="error">{error}</FormAlert>}
        {notice && <FormAlert kind="success">{notice}</FormAlert>}
        <Field id="displayName" label="Your name" hint="Shown on your certificates — use your real name." autoComplete="name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required />
        <Field id="username" label="Username" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.trim() })} error={usernameErr} required />
        <Field id="email" label="Email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <PasswordField id="new-password" label="Password" value={f.password} onChange={(password) => setF({ ...f, password })} autoComplete="new-password" showStrength />
        <div className="flex items-start gap-3">
          <input id="agree" type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} className="mt-1 h-5 w-5 accent-[rgb(var(--neon))]" />
          <label htmlFor="agree" className="text-sm text-muted">
            I agree to the <Link href="/terms" className="text-neon underline">Terms</Link> and <Link href="/privacy" className="text-neon underline">Privacy Policy</Link>.
          </label>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy || !f.email || !f.username || !f.password || !f.displayName}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
