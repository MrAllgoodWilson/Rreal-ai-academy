"use client";
import { motion } from "framer-motion";

export function ProgressRing({ pct, size = 72, stroke = 7, label, children, color = "rgb(var(--neon))" }: { pct: number; size?: number; stroke?: number; label: string; children?: React.ReactNode; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${pct}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--line))" strokeWidth={stroke} fill="none" opacity={0.6} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * Math.min(100, pct)) / 100 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">{children}</div>
    </div>
  );
}

export function ProgressBar({ pct, label, className = "" }: { pct: number; label: string; className?: string }) {
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-line/50 ${className}`} role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full bg-gradient-to-r from-neon to-violet" initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: 0.9, ease: "easeOut" }} />
    </div>
  );
}
