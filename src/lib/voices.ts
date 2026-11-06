/** Coach voice catalog. Premium voices use ElevenLabs (multilingual: English + Spanish); device voices are free fallbacks. */
export type Gender = "female" | "male" | "neutral";

export interface PremiumVoice {
  id: string;
  name: string;
  gender: Gender;
  accent: string;
  style: string;
}

export const PREMIUM_VOICES: PremiumVoice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female", accent: "American", style: "Calm, clear" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", accent: "American", style: "Soft, friendly" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", accent: "American", style: "Warm, upbeat" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", accent: "American", style: "Expressive, youthful" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", accent: "British", style: "Warm, articulate" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", gender: "female", accent: "Swedish-English", style: "Smooth" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male", accent: "American", style: "Deep, confident" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male", accent: "American", style: "Well-rounded" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "male", accent: "American", style: "Deep, narrator" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "male", accent: "American", style: "Young, energetic" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", accent: "British", style: "Warm, mature" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male", accent: "Australian", style: "Casual, natural" },
];

/**
 * Included "cloud" voices: Deepgram Aura-2 on Cloudflare Workers AI. No third-party key needed.
 * id = "cf:<lang>:<speaker>". Genders/accents follow Deepgram's published speaker descriptions; check by ear before marketing them.
 */
export interface CloudVoice extends PremiumVoice {
  lang: "en" | "es";
  speaker: string;
}
const cv = (lang: "en" | "es", speaker: string, name: string, gender: Gender, accent: string, style: string): CloudVoice => ({ id: `cf:${lang}:${speaker}`, lang, speaker, name, gender, accent, style });
export const CLOUD_VOICES: CloudVoice[] = [
  cv("en", "asteria", "Asteria", "female", "American", "Clear, confident"),
  cv("en", "luna", "Luna", "female", "American", "Warm, friendly"),
  cv("en", "athena", "Athena", "female", "British", "Calm, mature"),
  cv("en", "hera", "Hera", "female", "American", "Smooth, professional"),
  cv("en", "orion", "Orion", "male", "American", "Approachable, steady"),
  cv("en", "arcas", "Arcas", "male", "American", "Natural, smooth"),
  cv("en", "apollo", "Apollo", "male", "American", "Confident, casual"),
  cv("en", "zeus", "Zeus", "male", "American", "Deep, trustworthy"),
  cv("es", "celeste", "Celeste", "female", "Colombian", "Clear, friendly"),
  cv("es", "estrella", "Estrella", "female", "Mexican", "Warm, upbeat"),
  cv("es", "selena", "Selena", "female", "Latin American", "Smooth, expressive"),
  cv("es", "carina", "Carina", "female", "Peninsular", "Professional, calm"),
  cv("es", "diana", "Diana", "female", "Peninsular", "Confident, engaging"),
  cv("es", "sirio", "Sirio", "male", "Mexican", "Friendly, steady"),
  cv("es", "javier", "Javier", "male", "Mexican", "Warm, natural"),
  cv("es", "nestor", "Néstor", "male", "Peninsular", "Calm, professional"),
  cv("es", "alvaro", "Álvaro", "male", "Peninsular", "Clear, authoritative"),
];
export const DEFAULT_CLOUD_VOICE: Record<"en" | "es", string> = { en: "cf:en:asteria", es: "cf:es:celeste" };
export const cloudVoiceById = (id: string | undefined | null) => CLOUD_VOICES.find((v) => v.id === id);

/** Resolve an explicit or session-pinned device voice without replacing it if unavailable. */
export function resolveDeviceVoice<T extends { name: string; lang: string }>(voices: T[], lang: "en" | "es", selected = ""): T | undefined {
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (selected) return matching.find((v) => v.name === selected);
  return matching.find((v) => /(natural|neural|samantha|google|aria|jenny|paulina|monica)/i.test(v.name)) ?? matching[0];
}

export const DEFAULT_PREMIUM_VOICE = PREMIUM_VOICES[0].id;
export const isPremiumVoice = (id: string | undefined | null) => !!id && PREMIUM_VOICES.some((v) => v.id === id);

const FEMALE = /(samantha|victoria|karen|moira|tessa|zira|aria|jenny|susan|allison|ava|serena|fiona|kate|monica|paulina|helena|laura|sabina|female|mujer|elena|lucia|google us english$|google uk english female)/i;
const MALE = /(daniel|alex|fred|david|mark|guy|tom|oliver|arthur|aaron|diego|jorge|juan|pablo|carlos|male|hombre|google uk english male)/i;

/** Best-effort gender label for a device voice (browsers don't expose gender). */
export function guessGender(name: string): Gender {
  if (FEMALE.test(name)) return "female";
  if (MALE.test(name)) return "male";
  return "neutral";
}
