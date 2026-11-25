import { describe, expect, it } from "vitest";
import { CLOUD_VOICES, DEFAULT_CLOUD_VOICE, PREMIUM_VOICES, cloudVoiceById } from "@/lib/voices";

describe("voice catalog", () => {
  it("has unique ids across cloud and ElevenLabs voices", () => {
    const ids = [...CLOUD_VOICES, ...PREMIUM_VOICES].map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("offers both genders in English and Spanish", () => {
    for (const lang of ["en", "es"] as const)
      for (const g of ["female", "male"] as const) expect(CLOUD_VOICES.some((v) => v.lang === lang && v.gender === g)).toBe(true);
  });
  it("defaults exist and match their language; ids encode lang and speaker", () => {
    for (const lang of ["en", "es"] as const) expect(cloudVoiceById(DEFAULT_CLOUD_VOICE[lang])?.lang).toBe(lang);
    for (const v of CLOUD_VOICES) expect(v.id).toBe(`cf:${v.lang}:${v.speaker}`);
    expect(cloudVoiceById("21m00Tcm4TlvDq8ikWAM")).toBeUndefined();
  });
});
