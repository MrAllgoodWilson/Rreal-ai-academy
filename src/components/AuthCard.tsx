"use client";

import { useState, type ReactNode, type InputHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { passwordProblems } from "@/lib/store";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-[80vh] place-items-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass w-full max-w-md p-8 shadow-glow">
        <LogoMark className="mx-auto mb-4 h-12 w-12" />
        <h1 className="text-center font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 border-t border-line/60 pt-6 text-center text-sm text-muted">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function Field({ id, label, hint, error, ...rest }: { id: string; label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={id} className="input" aria-invalid={!!error} aria-describedby={describedBy} {...rest} />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, showStrength, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; showStrength?: boolean; autoComplete: string }) {
  const [show, setShow] = useState(false);
  const issues = passwordProblems(value);
  const strength = value ? 3 - issues.length + (value.length >= 14 ? 1 : 0) : 0;
  const labels = ["Too weak", "Weak", "Okay", "Strong", "Excellent"];
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} name={id} type={show ? "text" : "password"} className="input pr-12" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required aria-describedby={showStrength ? `${id}-strength` : undefined} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {showStrength && (
        <div id={`${id}-strength`} className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? (strength >= 3 ? "bg-lime" : strength === 2 ? "bg-flame" : "bg-danger") : "bg-line/60"}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            {value ? labels[Math.max(0, Math.min(4, strength))] : "Use 10+ characters with upper & lower case and a number."}
            {value && issues.length > 0 && ` — needs ${issues.join(", ")}`}
          </p>
        </div>
      )}
    </div>
  );
}

export function FormAlert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl border p-3 text-sm ${kind === "error" ? "border-danger/60 bg-danger/10 text-ink" : "border-lime/60 bg-lime/10 text-ink"}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${kind === "error" ? "text-danger" : "text-lime"}`} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
