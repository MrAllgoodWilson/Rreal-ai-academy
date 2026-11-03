"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export default function VerifyLookup() {
  const [value, setValue] = useState("");
  const router = useRouter();
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <ShieldCheck className="mx-auto h-16 w-16 text-neon" aria-hidden="true" />
      <h1 className="mt-4 text-center font-display text-3xl font-bold">Verify a Rreal credential</h1>
      <p className="mt-2 text-center text-muted">Paste the verification link or token from the certificate (or scan its QR code).</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const token = value.trim().split("/verify/").pop()!;
          if (token) router.push(`/verify/${encodeURIComponent(token)}`);
        }}
      >
        <label htmlFor="token" className="label">Verification link or token</label>
        <input id="token" className="input font-mono text-sm" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…/verify/eyJ2Ijox…" required />
        <button className="btn-primary w-full">Verify</button>
      </form>
    </div>
  );
}
