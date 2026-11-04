"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Accessibility, Award, BookOpen, Brain, Clapperboard, Compass, Flame, FlaskConical, FolderHeart, Languages, LayoutDashboard, LogOut, Mic, Plug, Settings, Trophy, Wand2, X, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { A11yPanel } from "@/components/A11yPanel";
import { useAcademy } from "@/lib/store";
import { useI18n, type TKey } from "@/lib/i18n";

const NAV: { href: string; label: TKey; icon: typeof BookOpen }[] = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/learn", label: "nav.courses", icon: BookOpen },
  { href: "/playbooks", label: "nav.playbooks", icon: Compass },
  { href: "/coach", label: "nav.coach", icon: Mic },
  { href: "/studio", label: "nav.studio", icon: Clapperboard },
  { href: "/create", label: "nav.create", icon: Wand2 },
];

const MORE: { href: string; label: TKey; icon: typeof BookOpen }[] = [
  { href: "/sandbox", label: "nav.sandbox", icon: FlaskConical },
  { href: "/leaderboard", label: "nav.leagues", icon: Trophy },
  { href: "/review", label: "nav.review", icon: Brain },
  { href: "/achievements", label: "nav.badges", icon: Award },
  { href: "/certificates", label: "nav.certificates", icon: Award },
  { href: "/portfolio", label: "nav.portfolio", icon: FolderHeart },
  { href: "/credits", label: "nav.credits", icon: Zap },
  { href: "/connections", label: "nav.connections", icon: Plug },
  { href: "/settings", label: "nav.settings", icon: Settings },
];

const MOBILE: { href: string; label: TKey; icon: typeof BookOpen }[] = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/learn", label: "nav.courses", icon: BookOpen },
  { href: "/coach", label: "nav.coach", icon: Mic },
  { href: "/playbooks", label: "nav.playbooks", icon: Compass },
  { href: "/studio", label: "nav.studio", icon: Clapperboard },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, progress, level, signOut, demo } = useAcademy();
  const { t, lang, setLang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [a11yOpen, setA11yOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const bare = pathname?.startsWith("/verify");

  useEffect(() => {
    setMenuOpen(false);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setA11yOpen((o) => !o);
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = (href: string) => pathname === href || pathname?.startsWith(href + "/");
  const langToggle = (
    <button type="button" onClick={() => setLang(lang === "en" ? "es" : "en")} className="flex h-11 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold hover:border-neon" aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}>
      <Languages className="h-4 w-4" aria-hidden="true" /> <span aria-hidden="true">{lang === "en" ? "ES" : "EN"}</span>
    </button>
  );

  return (
    <div className="relative flex min-h-screen flex-col">
      <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-[90] rounded-xl bg-neon px-4 py-2 font-semibold text-bg">{t("skip")}</a>
      <div aria-hidden="true" className="aurora pointer-events-none fixed inset-0 -z-10" />
      <div aria-hidden="true" className="bg-grid pointer-events-none fixed inset-x-0 top-0 -z-10 h-[60vh]" />

      {demo && !bare && (
        <div className="border-b border-line/60 bg-violet/10 px-4 py-1.5 text-center text-xs text-muted">
          <strong className="text-violet">Demo mode</strong> — no database connected; data stays in this browser.
        </div>
      )}

      {!bare && (
        <header className="sticky top-0 z-40 border-b border-line/50 bg-bg/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
            <Logo />
            {user && (
              <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active(href) ? "text-ink" : "text-muted hover:text-ink"}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(label)}
                    {active(href) && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-lg bg-raised" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                  </Link>
                ))}
              </nav>
            )}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex">{langToggle}</span>
              <button type="button" onClick={() => setA11yOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-ink hover:border-neon" aria-label={t("nav.a11y")} aria-haspopup="dialog" aria-expanded={a11yOpen}>
                <Accessibility className="h-5 w-5" aria-hidden="true" />
              </button>
              {user ? (
                <>
                  <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold md:flex" aria-label={`${progress.streak.current} day streak`}>
                    <Flame className={`h-4 w-4 text-flame ${progress.streak.current > 0 ? "animate-flicker" : ""}`} aria-hidden="true" />
                    {progress.streak.current}
                  </Link>
                  <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold md:flex" aria-label={`${progress.xp} XP, level ${level.level}`}>
                    <Zap className="h-4 w-4 text-lime" aria-hidden="true" />
                    {progress.xp.toLocaleString()}
                  </Link>
                  <button type="button" onClick={() => setMenuOpen((o) => !o)} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-xl" aria-label="Account menu" aria-expanded={menuOpen} aria-controls="account-menu">
                    {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <span aria-hidden="true">{user.avatar}</span>}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost hidden sm:inline-flex">{t("nav.signin")}</Link>
                  <Link href="/signup" className="btn-primary">{t("nav.join")}</Link>
                </>
              )}
            </div>
          </div>

          <AnimatePresence>
            {user && menuOpen && (
              <motion.div id="account-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass absolute right-4 top-[68px] max-h-[80vh] w-72 overflow-y-auto p-2 shadow-2xl">
                <div className="border-b border-line/60 px-3 py-3">
                  <p className="font-semibold">{user.displayName}</p>
                  <p className="text-sm text-muted">@{user.username}</p>
                </div>
                <nav aria-label="Account">
                  <ul className="py-1">
                    {[...NAV.filter((n) => n.href !== "/dashboard"), ...MORE].map(({ href, label, icon: Icon }) => (
                      <li key={href + label}>
                        <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-raised">
                          <Icon className="h-4 w-4 text-muted" aria-hidden="true" /> {t(label)}
                        </Link>
                      </li>
                    ))}
                    <li className="sm:hidden">
                      <button type="button" onClick={() => setLang(lang === "en" ? "es" : "en")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-raised">
                        <Languages className="h-4 w-4 text-muted" aria-hidden="true" /> {t("nav.lang")}
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={async () => { await signOut(); router.push("/"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-danger hover:bg-raised">
                        <LogOut className="h-4 w-4" aria-hidden="true" /> {t("nav.signout")}
                      </button>
                    </li>
                  </ul>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <AnimatePresence mode="wait">
          <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className={user && !bare ? "pb-24 xl:pb-0" : ""}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {user && !bare && (
        <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-bg/90 backdrop-blur-xl xl:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {MOBILE.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} aria-current={active(href) ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${active(href) ? "text-neon" : "text-muted"}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {t(label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {!bare && (
        <footer className="border-t border-line/50 py-8 text-sm text-muted">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>© {new Date().getFullYear()} Rreal AI Academy.</p>
            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                <li><Link href="/pricing" className="hover:text-ink">Pricing</Link></li>
                <li><Link href="/accessibility" className="hover:text-ink">Accessibility</Link></li>
                <li><Link href="/sponsors" className="hover:text-ink">Sponsors</Link></li>
                <li><Link href="/verify" className="hover:text-ink">Verify a credential</Link></li>
                <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
                <li className="sm:hidden">{langToggle}</li>
              </ul>
            </nav>
          </div>
        </footer>
      )}

      <A11yPanel open={a11yOpen} onClose={() => setA11yOpen(false)} />
    </div>
  );
}
