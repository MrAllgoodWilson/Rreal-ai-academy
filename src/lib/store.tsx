"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ALL_LESSONS, ALL_TRACKS, getLessonRef, lessonsForTrack, registerTracks, type Track } from "@/lib/curriculum";
import { applyActivity, dayKey, levelForXp, streakMultiplier, type StreakState } from "@/lib/gamification";
import { BADGES, newlyEarned, type BadgeStats } from "@/lib/badges";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/config";

/* ───────────────────────── Types ───────────────────────── */

export interface Account {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar: string;
  createdAt: string;
}

export interface Certificate {
  token: string;
  code: string;
  title: string;
  trackId: string;
  name: string;
  issuedAt: string;
  score: number;
}

export interface PortfolioItem {
  id: string;
  kind: "prompt" | "video" | "reflection";
  title: string;
  content: string;
  score?: number;
  createdAt: string;
}

export interface Onboarding {
  done: boolean;
  goal?: string;
  placementLevel: number;
  dailyMinutes: number;
}

export interface Progress {
  xp: number;
  completed: Record<string, { at: string; score: number; perfect: boolean }>;
  streak: StreakState;
  badges: Record<string, string>;
  certificates: Certificate[];
  xpByDay: Record<string, number>;
  bestPromptScore: number;
  voiceSessions: number;
  studioSaves: number;
  reviewsDone: number;
  portfolio: PortfolioItem[];
  onboarding: Onboarding;
  dailyGoalXp: number;
}

export interface Subscription {
  status: "none" | "trialing" | "active" | "past_due" | "canceled";
  plan?: "monthly" | "annual" | "team";
  trialEndsAt?: string;
}

export type Celebration =
  | { kind: "lesson"; title: string; xp: number; bonus: number }
  | { kind: "badge"; badgeId: string }
  | { kind: "level"; level: number }
  | { kind: "streak"; days: number }
  | { kind: "certificate"; title: string };

type Result = { ok: true; message?: string; demoLink?: string } | { ok: false; error: string };

const freshProgress = (): Progress => ({
  xp: 0,
  completed: {},
  streak: { current: 0, longest: 0, lastActive: null, freezes: 1 },
  badges: {},
  certificates: [],
  xpByDay: {},
  bestPromptScore: 0,
  voiceSessions: 0,
  studioSaves: 0,
  reviewsDone: 0,
  portfolio: [],
  onboarding: { done: false, placementLevel: 1, dailyMinutes: 10 },
  dailyGoalXp: 100,
});

/* ───────────────────────── Local persistence (Demo mode + offline cache) ───────────────────────── */

const K = {
  accounts: "rreal.v1.accounts",
  session: "rreal.v1.session",
  user: (id: string) => `rreal.v1.user.${id}`,
};

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode */
  }
};

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

type StoredAccount = Account & { passwordHash: string; salt: string };
type UserBlob = { account: Account; progress: Progress; subscription: Subscription };

/* ───────────────────────── Validation ───────────────────────── */

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export function passwordProblems(pw: string) {
  const issues: string[] = [];
  if (pw.length < 10) issues.push("at least 10 characters");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) issues.push("upper and lower case letters");
  if (!/\d/.test(pw)) issues.push("a number");
  return issues;
}

/* ───────────────────────── Context ───────────────────────── */

interface Ctx {
  ready: boolean;
  demo: boolean;
  user: Account | null;
  progress: Progress;
  subscription: Subscription;
  subscribed: boolean;
  level: ReturnType<typeof levelForXp>;
  todayXp: number;
  celebrations: Celebration[];
  dismissCelebration: () => void;
  signUp: (i: { email: string; username: string; password: string; displayName: string; referralCode?: string }) => Promise<Result>;
  signIn: (i: { identifier: string; password: string }) => Promise<Result>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<Result>;
  updatePassword: (password: string, demoEmail?: string) => Promise<Result>;
  recoverUsername: (email: string) => Promise<Result>;
  updateProfile: (p: Partial<Pick<Account, "displayName" | "avatar">>) => void;
  completeLesson: (lessonId: string, score: number) => void;
  recordPromptScore: (score: number) => void;
  bump: (field: "voiceSessions" | "studioSaves" | "reviewsDone") => void;
  addPortfolio: (item: Omit<PortfolioItem, "id" | "createdAt">) => void;
  removePortfolio: (id: string) => void;
  addCertificate: (c: Certificate) => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
  setDailyGoal: (xp: number) => void;
  startTrial: (plan: Subscription["plan"]) => void;
  /** Bumps whenever custom/community courses are added to the catalog */
  catalogVersion: number;
  customCourses: (Track & { status?: string; mine?: boolean })[];
  addCustomCourse: (t: Track) => void;
  cancelSubscription: () => void;
  resetProgress: () => void;
}

const AcademyContext = createContext<Ctx | null>(null);

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Account | null>(null);
  const [progress, setProgress] = useState<Progress>(freshProgress);
  const [subscription, setSubscription] = useState<Subscription>({ status: "none" });
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [customCourses, setCustomCourses] = useState<(Track & { status?: string; mine?: boolean })[]>([]);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  /* Load session */
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      const id = read<string | null>(K.session, null);
      if (id) {
        const blob = read<UserBlob | null>(K.user(id), null);
        if (blob) {
          setUser(blob.account);
          setProgress({ ...freshProgress(), ...blob.progress });
          setSubscription(blob.subscription);
        }
      }
      setReady(true);
      return;
    }
    const hydrate = async () => {
      const { data } = await sb.auth.getUser();
      if (!data.user) {
        setUser(null);
        setReady(true);
        return;
      }
      const cached = read<UserBlob | null>(K.user(data.user.id), null);
      if (cached) {
        setUser(cached.account);
        setProgress({ ...freshProgress(), ...cached.progress });
        setSubscription(cached.subscription);
      }
      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        if (res.ok) {
          const server = (await res.json()) as UserBlob;
          setUser(server.account);
          setProgress({ ...freshProgress(), ...server.progress });
          setSubscription(server.subscription);
        }
      } catch {
        /* offline — keep cache */
      }
      setReady(true);
    };
    hydrate();
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") hydrate();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* Load AI-generated + community courses into the catalog */
  useEffect(() => {
    if (!ready) return;
    const apply = (list: (Track & { status?: string; mine?: boolean })[]) => {
      registerTracks(list);
      setCustomCourses(list);
      setCatalogVersion((v) => v + 1);
    };
    if (isDemoMode) {
      if (user) apply(read<Track[]>(`rreal.v1.custom.${user.id}`, []).map((t) => ({ ...t, mine: true, status: "private" })));
      return;
    }
    fetch("/api/courses", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => apply(j.courses ?? []))
      .catch(() => {});
  }, [ready, user]);

  /* Persist */
  useEffect(() => {
    if (!ready || !user) return;
    write(K.user(user.id), { account: user, progress, subscription } satisfies UserBlob);
  }, [ready, user, progress, subscription]);

  /* Debounced sync of non-authoritative state (portfolio, counters, onboarding) in Supabase mode */
  useEffect(() => {
    if (isDemoMode || !ready || !user) return;
    const t = setTimeout(() => {
      fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: { ...progress, completed: undefined, xp: undefined, streak: undefined, certificates: undefined } }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, user, progress]);

  const celebrate = useCallback((...c: Celebration[]) => setCelebrations((q) => [...q, ...c]), []);

  /** Recompute badges after any progress mutation */
  const withBadges = useCallback(
    (p: Progress): Progress => {
      const tracksCompleted = ALL_TRACKS.filter((t) => lessonsForTrack(t.id).every((r) => p.completed[r.lesson.id])).map((t) => t.id);
      const stats: BadgeStats = {
        lessonsCompleted: Object.keys(p.completed).length,
        xp: p.xp,
        streak: p.streak.current,
        tracksCompleted,
        bestPromptScore: p.bestPromptScore,
        voiceSessions: p.voiceSessions,
        studioSaves: p.studioSaves,
        portfolioCount: p.portfolio.length,
        perfectLessons: Object.values(p.completed).filter((c) => c.perfect).length,
        certificates: p.certificates.length,
        reviewsDone: p.reviewsDone,
      };
      const earned = newlyEarned(stats, p.badges);
      if (!earned.length) return p;
      const now = new Date().toISOString();
      setTimeout(() => celebrate(...earned.map((b) => ({ kind: "badge" as const, badgeId: b.id }))), 0);
      return { ...p, badges: { ...p.badges, ...Object.fromEntries(earned.map((b) => [b.id, now])) } };
    },
    [celebrate],
  );

  const mutate = useCallback((fn: (p: Progress) => Progress) => setProgress((p) => withBadges(fn(p))), [withBadges]);

  /* ───── Auth ───── */

  const loadLocalUser = (id: string) => {
    const blob = read<UserBlob | null>(K.user(id), null);
    if (!blob) return;
    write(K.session, id);
    setUser(blob.account);
    setProgress({ ...freshProgress(), ...blob.progress });
    setSubscription(blob.subscription);
  };

  const signUp: Ctx["signUp"] = async ({ email, username, password, displayName, referralCode }) => {
    email = email.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) return { ok: false, error: "Username must be 3–20 letters, numbers or underscores." };
    const issues = passwordProblems(password);
    if (issues.length) return { ok: false, error: `Password needs ${issues.join(", ")}.` };
    const sb = getSupabaseBrowser();
    if (sb) {
      // Preferred: server creates a confirmed account and signs in (no email round-trip).
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, username, password, displayName, referralCode }) });
      if (res.status !== 501) {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: json.error ?? "Couldn't create your account." };
        await sb.auth.refreshSession();
        return json.signedIn ? { ok: true } : { ok: true, message: "Account created. Please sign in." };
      }
      const { data: available, error: rpcErr } = await sb.rpc("username_available", { p_username: username });
      if (rpcErr) return { ok: false, error: "Couldn't check that username. Try again." };
      if (!available) return { ok: false, error: "That username is taken. Try another." };
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: displayName }, emailRedirectTo: `${location.origin}/subscribe` },
      });
      if (error) return { ok: false, error: error.message };
      if (!data.session) return { ok: true, message: "Check your email to confirm your account, then sign in." };
      if (process.env.NEXT_PUBLIC_REFERRALS_ENABLED === "true" && referralCode) await sb.rpc("referral_attribute", { p_code: referralCode });
      return { ok: true };
    }
    const accounts = read<StoredAccount[]>(K.accounts, []);
    if (accounts.some((a) => a.email === email)) return { ok: false, error: "An account with that email already exists. Try signing in." };
    if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return { ok: false, error: "That username is taken. Try another." };
    const salt = crypto.randomUUID();
    const account: Account = { id: crypto.randomUUID(), email, username, displayName: displayName || username, avatar: "🦊", createdAt: new Date().toISOString() };
    write(K.accounts, [...accounts, { ...account, salt, passwordHash: await sha256(salt + password) }]);
    write(K.user(account.id), { account, progress: freshProgress(), subscription: { status: "none" } } satisfies UserBlob);
    loadLocalUser(account.id);
    return { ok: true };
  };

  const signIn: Ctx["signIn"] = async ({ identifier, password }) => {
    identifier = identifier.trim();
    const generic = { ok: false as const, error: "That username/email and password don't match." };
    if (getSupabaseBrowser()) {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error ?? generic.error };
      await getSupabaseBrowser()!.auth.refreshSession();
      return { ok: true };
    }
    const accounts = read<StoredAccount[]>(K.accounts, []);
    const id = identifier.toLowerCase();
    const acc = accounts.find((a) => a.email === id || a.username.toLowerCase() === id);
    if (!acc || (await sha256(acc.salt + password)) !== acc.passwordHash) return generic;
    loadLocalUser(acc.id);
    return { ok: true };
  };

  const signOut = async () => {
    const sb = getSupabaseBrowser();
    if (sb) await sb.auth.signOut();
    try {
      localStorage.removeItem(K.session);
    } catch {}
    setUser(null);
    setProgress(freshProgress());
    setSubscription({ status: "none" });
  };

  const requestPasswordReset: Ctx["requestPasswordReset"] = async (email) => {
    email = email.trim().toLowerCase();
    const msg = "If an account exists for that email, a reset link is on its way. It expires in 1 hour.";
    const sb = getSupabaseBrowser();
    if (sb) {
      const res = await fetch("/api/auth/reset-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      if (res.status === 501) await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
      return { ok: true, message: msg };
    }
    const exists = read<StoredAccount[]>(K.accounts, []).some((a) => a.email === email);
    return { ok: true, message: msg, demoLink: exists ? `/reset-password?demo=${encodeURIComponent(email)}` : undefined };
  };

  const updatePassword: Ctx["updatePassword"] = async (password, demoEmail) => {
    const issues = passwordProblems(password);
    if (issues.length) return { ok: false, error: `Password needs ${issues.join(", ")}.` };
    const sb = getSupabaseBrowser();
    if (sb) {
      const { error } = await sb.auth.updateUser({ password });
      return error ? { ok: false, error: "This reset link is invalid or expired. Request a new one." } : { ok: true };
    }
    const accounts = read<StoredAccount[]>(K.accounts, []);
    const acc = accounts.find((a) => a.email === demoEmail?.toLowerCase());
    if (!acc) return { ok: false, error: "This reset link is invalid or expired. Request a new one." };
    acc.salt = crypto.randomUUID();
    acc.passwordHash = await sha256(acc.salt + password);
    write(K.accounts, accounts);
    return { ok: true };
  };

  const recoverUsername: Ctx["recoverUsername"] = async (email) => {
    email = email.trim().toLowerCase();
    const msg = "If an account exists for that email, we've sent your username to it.";
    if (getSupabaseBrowser()) {
      await fetch("/api/auth/forgot-username", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      return { ok: true, message: msg };
    }
    const acc = read<StoredAccount[]>(K.accounts, []).find((a) => a.email === email);
    return { ok: true, message: acc ? `${msg} (Demo mode — no email is sent. Your username is: ${acc.username})` : msg };
  };

  const updateProfile: Ctx["updateProfile"] = (p) => {
    setUser((u) => (u ? { ...u, ...p } : u));
    const sb = getSupabaseBrowser();
    if (sb && user) sb.from("profiles").update({ display_name: p.displayName, avatar: p.avatar }).eq("id", user.id).then(() => {});
    if (!sb && user) {
      const accounts = read<StoredAccount[]>(K.accounts, []);
      write(K.accounts, accounts.map((a) => (a.id === user.id ? { ...a, ...p } : a)));
    }
  };

  /* ───── Learning ───── */

  const completeLesson: Ctx["completeLesson"] = (lessonId, score) => {
    const ref = getLessonRef(lessonId);
    if (!ref) return;
    const p = progressRef.current;
    const firstTime = !p.completed[lessonId];
    const today = dayKey();
    const streak = applyActivity(p.streak, today);
    const base = firstTime ? ref.lesson.xp : Math.round(ref.lesson.xp * 0.2); // replay = review XP
    const total = Math.round(base * streakMultiplier(streak.current));
    const prevLevel = levelForXp(p.xp).level;
    const newLevel = levelForXp(p.xp + total).level;

    mutate((prev) => ({
      ...prev,
      xp: prev.xp + total,
      xpByDay: { ...prev.xpByDay, [today]: (prev.xpByDay[today] ?? 0) + total },
      streak: { current: streak.current, longest: streak.longest, lastActive: streak.lastActive, freezes: streak.freezes + (streak.extended && streak.current % 7 === 0 ? 1 : 0) },
      completed: {
        ...prev.completed,
        [lessonId]: { at: prev.completed[lessonId]?.at ?? new Date().toISOString(), score: Math.max(score, prev.completed[lessonId]?.score ?? 0), perfect: score >= 100 || !!prev.completed[lessonId]?.perfect },
      },
    }));

    const c: Celebration[] = [{ kind: "lesson", title: ref.lesson.title, xp: total, bonus: total - base }];
    if (streak.extended && streak.current > 1) c.push({ kind: "streak", days: streak.current });
    if (newLevel > prevLevel) c.push({ kind: "level", level: newLevel });
    celebrate(...c);

    if (!isDemoMode) {
      fetch("/api/progress/complete", { method: "POST", headers: { "content-type": "application/json", "x-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone }, body: JSON.stringify({ lessonId, score }) }).catch(() => {});
    }
  };

  const value: Ctx = {
    ready,
    demo: isDemoMode,
    user,
    progress,
    subscription,
    subscribed: subscription.status === "active" || subscription.status === "trialing",
    level: levelForXp(progress.xp),
    todayXp: progress.xpByDay[dayKey()] ?? 0,
    celebrations,
    dismissCelebration: () => setCelebrations((q) => q.slice(1)),
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    recoverUsername,
    updateProfile,
    completeLesson,
    recordPromptScore: (score) => mutate((p) => (score > p.bestPromptScore ? { ...p, bestPromptScore: score } : p)),
    bump: (field) => mutate((p) => ({ ...p, [field]: p[field] + 1 })),
    addPortfolio: (item) => mutate((p) => ({ ...p, portfolio: [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...p.portfolio] })),
    removePortfolio: (id) => mutate((p) => ({ ...p, portfolio: p.portfolio.filter((x) => x.id !== id) })),
    addCertificate: (cert) => {
      mutate((p) => ({ ...p, certificates: [cert, ...p.certificates.filter((c) => c.trackId !== cert.trackId)] }));
      celebrate({ kind: "certificate", title: cert.title });
    },
    setOnboarding: (o) => {
      mutate((p) => ({ ...p, onboarding: { ...p.onboarding, ...o } }));
      const sb = getSupabaseBrowser();
      if (sb && user && o.placementLevel) sb.from("profiles").update({ placement_level: o.placementLevel }).eq("id", user.id).then(() => {});
    },
    setDailyGoal: (xp) => mutate((p) => ({ ...p, dailyGoalXp: xp })),
    startTrial: (plan) => {
      const ends = new Date(Date.now() + 7 * 86_400_000).toISOString();
      setSubscription({ status: "trialing", plan, trialEndsAt: ends });
    },
    cancelSubscription: () => setSubscription({ status: "canceled" }),
    catalogVersion,
    customCourses,
    addCustomCourse: (t) => {
      registerTracks([t]);
      setCustomCourses((c) => [{ ...t, mine: true, status: "private" }, ...c.filter((x) => x.id !== t.id)]);
      setCatalogVersion((v) => v + 1);
      if (isDemoMode && user) write(`rreal.v1.custom.${user.id}`, [t, ...read<Track[]>(`rreal.v1.custom.${user.id}`, []).filter((x) => x.id !== t.id)]);
    },
    resetProgress: () => setProgress(freshProgress()),
  };

  return <AcademyContext.Provider value={value}>{children}</AcademyContext.Provider>;
}

export function useAcademy() {
  const ctx = useContext(AcademyContext);
  if (!ctx) throw new Error("useAcademy must be used inside <AcademyProvider>");
  return ctx;
}

export const TOTAL_LESSONS = ALL_LESSONS.length;
export const TOTAL_BADGES = BADGES.length;
