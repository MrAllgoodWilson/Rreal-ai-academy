"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, Field, FormAlert, PasswordField } from "@/components/AuthCard";
import { useAcademy } from "@/lib/store";

function LoginForm() {
  const { signIn, user, ready } = useAcademy();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(next.startsWith("/") ? next : "/dashboard");
  }, [ready, user, router, next]);

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to keep your streak alive."
      footer={
        <>
          New here? <Link href="/signup" className="font-semibold text-neon hover:underline">Create a free account</Link>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const r = await signIn({ identifier, password });
          setBusy(false);
          if (!r.ok) setError(r.error);
        }}
        noValidate
      >
        {error && <FormAlert kind="error">{error}</FormAlert>}
        <Field id="identifier" label="Email or username" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="text-neon hover:underline">Forgot password?</Link>
          <Link href="/forgot-username" className="text-neon hover:underline">Forgot username?</Link>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy || !identifier || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
