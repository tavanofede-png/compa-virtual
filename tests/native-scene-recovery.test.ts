import { describe, expect, it } from "vitest";
import {
  interruptedScenePhase,
  sceneAttempt,
} from "../apps/mobile/src/scene-recovery";

describe("recuperación de escena nativa", () => {
  it("detecta un cierre reciente al cargar o dibujar la misma habitación", () => {
    expect(
      interruptedScenePhase(
        sceneAttempt("room-a", "loading", 100),
        "room-a",
        150,
      ),
    ).toBe("loading");
    expect(
      interruptedScenePhase(
        sceneAttempt("room-a", "rendering", 100),
        "room-a",
        150,
      ),
    ).toBe("rendering");
  });

  it("no bloquea otra habitación ni un intento antiguo o inválido", () => {
    const attempt = sceneAttempt("room-a", "rendering", 100);
    expect(interruptedScenePhase(attempt, "room-b", 150)).toBeNull();
    expect(interruptedScenePhase(attempt, "room-a", 3_600_101)).toBeNull();
    expect(interruptedScenePhase("{", "room-a", 150)).toBeNull();
    expect(interruptedScenePhase(null, "room-a", 150)).toBeNull();
  });
});
