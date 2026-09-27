import type { Memory } from "./types";

export function memoryOriginLabel(memory: Memory) {
  const origin = memory.origin === "COMPANION"
    ? "Guardado desde tu conversación"
    : memory.origin === "MANUAL" ? "Agregado por vos" : "Recuerdo anterior sin origen registrado";
  return memory.origin === "COMPANION" && memory.updated_by === "USER"
    ? `${origin} · editado por vos` : origin;
}
