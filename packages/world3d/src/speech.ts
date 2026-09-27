import * as T from "three";

export type SpeechAnimator = {
  setSpeaking(value: boolean): void;
  update(delta: number): boolean;
  dispose(): void;
};

type MouthTarget = { object: T.Object3D; scale: T.Vector3 };

/** Animates the authored mouth/smile pieces already present in each model. */
export function createSpeechAnimator(avatar: T.Object3D): SpeechAnimator {
  const targets: MouthTarget[] = [];
  avatar.traverse((object) => {
    const material =
      object instanceof T.Mesh
        ? Array.isArray(object.material)
          ? object.material.map((entry) => entry.name).join(" ")
          : (object.material?.name ?? "")
        : "";
    if (/mouth|smile|lip/i.test(object.name + " " + material))
      targets.push({ object, scale: object.scale.clone() });
  });
  let speaking = false;
  let amount = 0;
  let elapsed = 0;
  return {
    setSpeaking(value) {
      speaking = value;
    },
    update(delta) {
      elapsed += delta;
      const previous = amount;
      amount = T.MathUtils.damp(
        amount,
        speaking ? 1 : 0,
        speaking ? 13 : 9,
        delta,
      );
      const syllable = 0.28 + 0.72 * Math.abs(Math.sin(elapsed * 12.5));
      for (const entry of targets) {
        entry.object.scale.x = entry.scale.x * (1 - amount * syllable * 0.05);
        entry.object.scale.y = entry.scale.y * (1 + amount * syllable * 0.72);
        entry.object.scale.z = entry.scale.z * (1 + amount * syllable * 0.04);
      }
      return (
        targets.length > 0 &&
        (speaking || amount > 0.002 || Math.abs(previous - amount) > 0.0001)
      );
    },
    dispose() {
      for (const entry of targets) entry.object.scale.copy(entry.scale);
      targets.length = 0;
    },
  };
}
