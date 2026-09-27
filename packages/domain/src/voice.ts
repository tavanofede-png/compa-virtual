import type { CharacterId } from "./companions";

export type CompanionVoiceProfile = {
  language: "es-AR";
  rate: number;
  pitch: number;
  voiceOffset: number;
};

const calm = {
  language: "es-AR",
  rate: 0.9,
  pitch: 1,
  voiceOffset: 0,
} as const;

/** Device TTS profiles. Clients resolve the closest installed Spanish voice. */
export const companionVoiceProfiles: Record<
  CharacterId,
  CompanionVoiceProfile
> = {
  nova: { ...calm, rate: 0.88, pitch: 1.08, voiceOffset: 0 },
  jay: { ...calm, rate: 1.03, pitch: 0.96, voiceOffset: 1 },
  milo: { ...calm, rate: 0.98, pitch: 1.02, voiceOffset: 2 },
  zoe: { ...calm, rate: 0.94, pitch: 1.11, voiceOffset: 3 },
  sky: { ...calm, rate: 0.96, pitch: 1.07, voiceOffset: 4 },
  harper: { ...calm, rate: 0.9, pitch: 0.94, voiceOffset: 5 },
  river: { ...calm, rate: 0.87, pitch: 0.98, voiceOffset: 6 },
  aria: { ...calm, rate: 1.05, pitch: 1.06, voiceOffset: 7 },
  lux: { ...calm, rate: 1, pitch: 1.12, voiceOffset: 8 },
  finn: { ...calm, rate: 1.06, pitch: 0.93, voiceOffset: 9 },
  elise: { ...calm, rate: 0.89, pitch: 1.09, voiceOffset: 10 },
  kai: { ...calm, rate: 1.01, pitch: 0.91, voiceOffset: 11 },
  noa: { ...calm, rate: 0.88, pitch: 0.97, voiceOffset: 12 },
  rem: { ...calm, rate: 0.97, pitch: 1.05, voiceOffset: 13 },
  sage: { ...calm, rate: 0.86, pitch: 0.92, voiceOffset: 14 },
  orion: { ...calm, rate: 1.02, pitch: 0.99, voiceOffset: 15 },
};

export function companionVoiceProfile(id?: CharacterId): CompanionVoiceProfile {
  return companionVoiceProfiles[id ?? "milo"];
}
