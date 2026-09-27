import { expect, it } from "vitest";
import {
  characterIds,
  companionVoiceProfile,
  companionVoiceProfiles,
} from "../packages/domain/src/index";

it("provides a safe device voice profile for every companion", () => {
  expect(Object.keys(companionVoiceProfiles).sort()).toEqual(
    [...characterIds].sort(),
  );
  for (const id of characterIds) {
    const voice = companionVoiceProfile(id);
    expect(voice.language).toBe("es-AR");
    expect(voice.rate).toBeGreaterThanOrEqual(0.8);
    expect(voice.rate).toBeLessThanOrEqual(1.1);
    expect(voice.pitch).toBeGreaterThanOrEqual(0.8);
    expect(voice.pitch).toBeLessThanOrEqual(1.2);
    expect(voice.voiceOffset).toBeGreaterThanOrEqual(0);
  }
});
