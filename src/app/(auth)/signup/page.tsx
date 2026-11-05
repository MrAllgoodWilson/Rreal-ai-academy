"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, Field, FormAlert, PasswordField } from "@/components/AuthCard";
import { useI18n } from "@/lib/i18n";
import { rememberReferral, forgetReferral, validReferralCode } from "@/lib/referrals-client";
import { USERNAME_RE, useAcademy } from "@/lib/store";

export default function SignupPage() {
  const { lang } = useI18n();
  const { signUp, user, ready } = useAcademy();
  const router = useRouter();
  const [f, setF] = useState({ displayName: "", username: "", email: "", password: "", referralCode: "", agree: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/subscribe");
  }, [ready, user, router]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_REFERRALS_ENABLED !== "true") return;
    const code = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase() || "";
    if (validReferralCode(code)) { rememberReferral(code); setF((current) => ({ ...current, referralCode: code })); }
  }, []);

  const usernameErr = f.username && !USERNAME_RE.test(f.username) ? "3–20 characters: letters, numbers, underscores." : undefined;

  return (
    <AuthCard
      title="Create your account"
      subtitle="Every course and tool for $1/month. Cancel anytime."
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
          if (f.referralCode) rememberReferral(f.referralCode); else forgetReferral();
          const r = await signUp({ ...f, referralCode: f.referralCode || undefined });
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
        {process.env.NEXT_PUBLIC_REFERRALS_ENABLED === "true" && <div>
          <Field id="referralCode" label={lang === "es" ? "Código de referido (opcional)" : "Referral code (optional)"} autoComplete="off" value={f.referralCode} onChange={(event) => setF({ ...f, referralCode: event.target.value.trim().toLowerCase() })} />
          <p className="mt-1 text-sm text-muted">{lang === "es" ? "La persona que te invitó puede ganar créditos de proyectos por referidos con pagos válidos. El precio de tu membresía no cambia." : "The person who invited you may earn project credits after qualifying paid referrals. Your membership price is unchanged."}</p>
        </div>}
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
