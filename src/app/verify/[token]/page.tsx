import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { credentialCode, credentialTitle, fingerprint, verifyCertificate } from "@/lib/certificates/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verify credential", robots: { index: false } };

async function revocationStatus(token: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return { revoked: false, registered: null as boolean | null };
  const { data } = await admin.rpc("certificate_status", { p_token_hash: fingerprint(token) }).maybeSingle<{ revoked_at: string | null }>();
  return { revoked: !!data?.revoked_at, registered: !!data };
}

export default async function VerifyPage({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  let result: ReturnType<typeof verifyCertificate>;
  try {
    result = verifyCertificate(token);
  } catch {
    result = { valid: false, reason: "Verification is temporarily unavailable. Please try again later." };
  }
  const status = result.valid ? await revocationStatus(token) : null;
  const ok = result.valid && !status?.revoked;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/" className="mb-10 flex items-center justify-center gap-2 font-display text-lg font-bold"><LogoMark /> Rreal AI Academy</Link>
      <div className={`glass p-8 text-center ${ok ? "shadow-glow" : ""}`}>
        {ok ? <ShieldCheck className="mx-auto h-20 w-20 text-lime" aria-hidden="true" /> : <ShieldAlert className="mx-auto h-20 w-20 text-danger" aria-hidden="true" />}
        <h1 className="mt-4 font-display text-3xl font-bold">{ok ? "Verified credential" : status?.revoked ? "Credential revoked" : "Could not verify"}</h1>
        {result.valid ? (
          <>
            <p className="mt-2 text-muted">{ok ? "This credential is authentic and was issued by Rreal AI Academy." : "This credential was issued by Rreal AI Academy but has since been revoked."}</p>
            <dl className="mt-8 grid gap-4 text-left sm:grid-cols-2">
              {[
                ["Recipient", result.payload.n],
                ["Credential", credentialTitle(result.payload.t, result.payload.ti)],
                ["Type", result.payload.a ? "Accredited credential" : "Rreal Certified (issued by Rreal AI Academy)"],
                ...(result.payload.a ? [["Accredited partner", `${result.payload.a.p} · ${result.payload.a.b}${result.payload.a.id ? ` #${result.payload.a.id}` : ""}`], ["Continuing education units", `${result.payload.a.ceu} CEU`]] : []),
                ["Issued", new Date(result.payload.i).toLocaleDateString("en-US", { dateStyle: "long" })],
                ["Credential ID", credentialCode(result.payload)],
                ...(result.payload.s ? [["Score", `${result.payload.s}%`]] : []),
                ["Signature", "HMAC-SHA256 ✓"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-raised/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-muted">{k}</dt>
                  <dd className="mt-1 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
              <CheckCircle2 className="h-4 w-4 text-lime" aria-hidden="true" /> Fingerprint {fingerprint(token).slice(0, 16)}…
            </p>
            <p className="mt-2 text-center text-xs"><a className="text-neon underline" href={`/api/credentials/${encodeURIComponent(token)}`}>Open Badges 3.0 (JSON-LD)</a></p>
          </>
        ) : (
          <p className="mt-3 text-muted">{result.reason}</p>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Employers: <Link href="/verify" className="text-neon underline">verify another credential</Link>
      </p>
    </div>
  );
}
