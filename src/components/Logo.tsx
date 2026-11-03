import Link from "next/link";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--neon))" />
          <stop offset="1" stopColor="rgb(var(--violet))" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#lg)" />
      <path d="M13 29V11h8.2c4 0 6.3 2.1 6.3 5.4 0 2.4-1.3 4.1-3.4 4.8L28 29h-4.6l-3.4-7.3H17V29h-4zm4-10.6h4c1.6 0 2.5-.8 2.5-2s-.9-2-2.5-2h-4v4z" fill="rgb(var(--bg))" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-base font-bold tracking-tight sm:gap-2.5 sm:text-lg" aria-label="Rreal AI Academy home">
      <LogoMark />
      <span>
        Rreal <span className="text-neon">AI</span>
        <span className="hidden min-[400px]:inline"> Academy</span>
      </span>
    </Link>
  );
}
