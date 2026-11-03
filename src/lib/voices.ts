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
