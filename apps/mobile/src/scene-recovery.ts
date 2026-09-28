export type ScenePhase = "loading" | "rendering";
export const SCENE_ATTEMPT_KEY = "kusiy.native-room-attempt.v1";

export function sceneAttempt(
  fingerprint: string,
  phase: ScenePhase,
  at = Date.now(),
) {
  return JSON.stringify({ fingerprint, phase, at });
}

/** A process kill cannot be caught by React. A recent unfinished attempt lets
 * the next launch keep Inicio usable and offer a deliberate retry. */
export function interruptedScenePhase(
  raw: string | null,
  fingerprint: string,
  now = Date.now(),
): ScenePhase | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const attempt = value as Record<string, unknown>;
    if (
      attempt.fingerprint !== fingerprint ||
      (attempt.phase !== "loading" && attempt.phase !== "rendering") ||
      typeof attempt.at !== "number" ||
      !Number.isFinite(attempt.at) ||
      now - attempt.at < 0 ||
      now - attempt.at > 60 * 60 * 1000
    )
      return null;
    return attempt.phase;
  } catch {
    return null;
  }
}
