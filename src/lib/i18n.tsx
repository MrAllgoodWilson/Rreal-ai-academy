"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "es";

/**
 * UI strings. Course content is translated on demand by /api/translate (Claude) and cached
 * server-side, so every course — including AI-generated ones — is available in both languages.
 */
const DICT = {
  en: {
    "nav.dashboard": "Dashboard", "nav.learn": "Learn", "nav.courses": "Courses", "nav.playbooks": "Playbooks", "nav.coach": "Coach", "nav.sandbox": "Sandbox",
    "nav.studio": "Studio", "nav.leagues": "Leagues", "nav.create": "Create a course", "nav.review": "Daily Review", "nav.badges": "Badges",
    "nav.certificates": "Certificates", "nav.portfolio": "Portfolio", "nav.connections": "Connections & Plugins", "nav.settings": "Settings", "nav.signout": "Sign out",
    "nav.signin": "Sign in", "nav.join": "Join for $1/mo", "nav.a11y": "Accessibility settings (Alt+A)", "nav.lang": "Español",
    "skip": "Skip to main content",
    "auth.welcome": "Welcome back", "auth.welcomeSub": "Sign in to keep your streak alive.", "auth.identifier": "Email or username", "auth.password": "Password",
    "auth.forgotPassword": "Forgot password?", "auth.forgotUsername": "Forgot username?", "auth.signin": "Sign in", "auth.signingIn": "Signing in…",
    "auth.newHere": "New here?", "auth.create": "Create your account", "auth.createSub": "Full access to every course for $1/month. Cancel anytime.",
    "auth.name": "Your name", "auth.nameHint": "Shown on your certificates — use your real name.", "auth.username": "Username", "auth.email": "Email",
    "auth.agree": "I agree to the Terms and Privacy Policy.", "auth.createBtn": "Create account", "auth.creating": "Creating account…", "auth.haveAccount": "Already have an account?",
    "auth.resetTitle": "Reset your password", "auth.resetSub": "We'll email you a secure, one-time reset link.", "auth.accountEmail": "Account email", "auth.sendReset": "Send reset link",
    "auth.back": "Back to sign in", "auth.fuTitle": "Forgot your username?", "auth.fuSub": "Enter your account email and we'll send your username to it.", "auth.fuBtn": "Email my username",
    "auth.newPassword": "Choose a new password", "auth.updatePassword": "Update password",
    "dash.morning": "Good morning", "dash.afternoon": "Good afternoon", "dash.evening": "Good evening", "dash.continue": "Continue learning", "dash.start": "Start lesson",
    "dash.goal": "Daily goal", "dash.toGo": "XP to go", "dash.crushed": "Crushed it today! 🎉", "dash.streak": "day streak", "dash.best": "best", "dash.week": "This week",
    "dash.program": "Mastery Program", "dash.myCourses": "My courses", "dash.practice": "Practice", "dash.badges": "Recent badges", "dash.viewAll": "View all",
    "dash.atRisk": "Your streak ends at midnight! One lesson keeps it alive.", "dash.save": "Save my streak", "dash.level": "Level", "dash.lessons": "lessons",
    "dash.noCourses": "You haven't started a standalone course yet.", "dash.browse": "Browse courses", "dash.stats": "Your progress",
    "learn.title": "Course catalog", "learn.sub": "The 8-week Mastery Program plus standalone courses from Dummy to Expert — and courses created by learners like you.",
    "learn.program": "Rreal AI Mastery Program (8 weeks)", "learn.courses": "Standalone courses", "learn.community": "Community courses", "learn.all": "All levels",
    "learn.lessons": "lessons", "learn.cert": "Certificate", "learn.createCta": "Don't see what you need? Ask the AI to build a course for you.",
    "lesson.continue": "Continue", "lesson.back": "Back", "lesson.finish": "Finish lesson", "lesson.check": "Check answer", "lesson.correct": "Correct!", "lesson.tryAgain": "Not quite — try again.",
    "lesson.listen": "Listen", "lesson.stop": "Stop", "lesson.askCoach": "Ask Coach", "lesson.locked": "Finish the previous lesson first", "lesson.paywall": "Members only",
    "lesson.translating": "Translating…",
    "pay.title": "One price. Everything included.", "pay.sub": "Every course, every tool, every certificate — $1 per month. Cancel anytime.", "pay.cta": "Join for $1/month",
    "pay.active": "Your membership is active", "pay.required": "Complete your membership to unlock your dashboard and courses.",
    "common.save": "Save", "common.loading": "Loading…", "common.cancel": "Cancel", "common.delete": "Delete", "common.copy": "Copy", "common.open": "Open", "common.level": "Level",
  },
  es: {
    "nav.dashboard": "Panel", "nav.learn": "Aprender", "nav.courses": "Cursos", "nav.playbooks": "Guías", "nav.coach": "Coach", "nav.sandbox": "Laboratorio",
    "nav.studio": "Estudio", "nav.leagues": "Ligas", "nav.create": "Crear un curso", "nav.review": "Repaso diario", "nav.badges": "Insignias",
    "nav.certificates": "Certificados", "nav.portfolio": "Portafolio", "nav.connections": "Conexiones y plugins", "nav.settings": "Ajustes", "nav.signout": "Cerrar sesión",
    "nav.signin": "Iniciar sesión", "nav.join": "Únete por $1/mes", "nav.a11y": "Ajustes de accesibilidad (Alt+A)", "nav.lang": "English",
    "skip": "Saltar al contenido principal",
    "auth.welcome": "Bienvenido de nuevo", "auth.welcomeSub": "Inicia sesión para mantener tu racha.", "auth.identifier": "Correo o usuario", "auth.password": "Contraseña",
    "auth.forgotPassword": "¿Olvidaste tu contraseña?", "auth.forgotUsername": "¿Olvidaste tu usuario?", "auth.signin": "Iniciar sesión", "auth.signingIn": "Iniciando sesión…",
    "auth.newHere": "¿Eres nuevo?", "auth.create": "Crea tu cuenta", "auth.createSub": "Acceso completo a todos los cursos por $1 al mes. Cancela cuando quieras.",
    "auth.name": "Tu nombre", "auth.nameHint": "Aparece en tus certificados — usa tu nombre real.", "auth.username": "Usuario", "auth.email": "Correo electrónico",
    "auth.agree": "Acepto los Términos y la Política de privacidad.", "auth.createBtn": "Crear cuenta", "auth.creating": "Creando cuenta…", "auth.haveAccount": "¿Ya tienes cuenta?",
    "auth.resetTitle": "Restablece tu contraseña", "auth.resetSub": "Te enviaremos un enlace seguro de un solo uso.", "auth.accountEmail": "Correo de la cuenta", "auth.sendReset": "Enviar enlace",
    "auth.back": "Volver a iniciar sesión", "auth.fuTitle": "¿Olvidaste tu usuario?", "auth.fuSub": "Escribe el correo de tu cuenta y te enviaremos tu usuario.", "auth.fuBtn": "Enviar mi usuario",
    "auth.newPassword": "Elige una nueva contraseña", "auth.updatePassword": "Actualizar contraseña",
    "dash.morning": "Buenos días", "dash.afternoon": "Buenas tardes", "dash.evening": "Buenas noches", "dash.continue": "Sigue aprendiendo", "dash.start": "Empezar lección",
    "dash.goal": "Meta diaria", "dash.toGo": "XP restantes", "dash.crushed": "¡Meta cumplida hoy! 🎉", "dash.streak": "días de racha", "dash.best": "mejor", "dash.week": "Esta semana",
    "dash.program": "Programa de Maestría", "dash.myCourses": "Mis cursos", "dash.practice": "Practicar", "dash.badges": "Insignias recientes", "dash.viewAll": "Ver todo",
    "dash.atRisk": "¡Tu racha termina a medianoche! Una lección la mantiene viva.", "dash.save": "Salvar mi racha", "dash.level": "Nivel", "dash.lessons": "lecciones",
    "dash.noCourses": "Aún no has empezado un curso independiente.", "dash.browse": "Ver cursos", "dash.stats": "Tu progreso",
    "learn.title": "Catálogo de cursos", "learn.sub": "El Programa de Maestría de 8 semanas más cursos independientes de Principiante total a Experto — y cursos creados por estudiantes como tú.",
    "learn.program": "Programa de Maestría en IA Rreal (8 semanas)", "learn.courses": "Cursos independientes", "learn.community": "Cursos de la comunidad", "learn.all": "Todos los niveles",
    "learn.lessons": "lecciones", "learn.cert": "Certificado", "learn.createCta": "¿No encuentras lo que buscas? Pide a la IA que cree un curso para ti.",
    "lesson.continue": "Continuar", "lesson.back": "Atrás", "lesson.finish": "Terminar lección", "lesson.check": "Comprobar", "lesson.correct": "¡Correcto!", "lesson.tryAgain": "Casi — inténtalo de nuevo.",
    "lesson.listen": "Escuchar", "lesson.stop": "Detener", "lesson.askCoach": "Preguntar al Coach", "lesson.locked": "Termina primero la lección anterior", "lesson.paywall": "Solo para miembros",
    "lesson.translating": "Traduciendo…",
    "pay.title": "Un precio. Todo incluido.", "pay.sub": "Todos los cursos, herramientas y certificados — $1 al mes. Cancela cuando quieras.", "pay.cta": "Únete por $1/mes",
    "pay.active": "Tu membresía está activa", "pay.required": "Completa tu membresía para desbloquear tu panel y tus cursos.",
    "common.save": "Guardar", "common.loading": "Cargando…", "common.cancel": "Cancelar", "common.delete": "Eliminar", "common.copy": "Copiar", "common.open": "Abrir", "common.level": "Nivel",
  },
} as const;

export type TKey = keyof (typeof DICT)["en"];
const KEY = "rreal.v1.lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
}
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved === "en" || saved === "es") setLangState(saved);
      else if (navigator.language?.toLowerCase().startsWith("es")) setLangState("es");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch {}
  }, [lang]);
  const t = useCallback((k: TKey) => DICT[lang][k] ?? DICT.en[k] ?? k, [lang]);
  return <I18nContext.Provider value={{ lang, setLang: setLangState, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n must be used inside <I18nProvider>");
  return c;
}

/** BCP-47 tags for speech recognition / synthesis */
export const SPEECH_LANG: Record<Lang, string> = { en: "en-US", es: "es-US" };

const memCache = new Map<string, unknown>();

/**
 * Returns `content` translated into the current language (Spanish via /api/translate, cached).
 * Falls back to the original while loading or if translation is unavailable.
 */
export function useTranslated<T>(key: string, content: T): { value: T; translating: boolean } {
  const { lang } = useI18n();
  const cacheKey = `${lang}:${key}`;
  const [value, setValue] = useState<T>(() => (lang === "en" ? content : ((memCache.get(cacheKey) as T) ?? content)));
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (lang === "en") {
      setValue(content);
      return;
    }
    const hit = memCache.get(cacheKey) ?? (() => {
      try {
        const raw = localStorage.getItem(`rreal.tr.${cacheKey}`);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    })();
    if (hit) {
      memCache.set(cacheKey, hit);
      setValue(hit as T);
      return;
    }
    let cancelled = false;
    setTranslating(true);
    fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, lang, content }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.content) return;
        memCache.set(cacheKey, j.content);
        try {
          localStorage.setItem(`rreal.tr.${cacheKey}`, JSON.stringify(j.content));
        } catch {}
        setValue(j.content as T);
      })
      .catch(() => {})
      .finally(() => !cancelled && setTranslating(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { value, translating };
}
