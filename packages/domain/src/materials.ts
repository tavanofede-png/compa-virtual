import type { Material } from "./types";

export function materialIsProcessing(material: Material) {
  return material.status === "QUEUED" || material.status === "PROCESSING" ||
    ["WAITING", "EXTRACTING", "OCR", "INDEXING"].includes(material.processing?.phase ?? "");
}
export function materialCanRetry(material: Material) {
  if (materialIsProcessing(material)) return false;
  return material.status === "FAILED" || material.status === "CANCELLED" ||
    ["FAILED", "UNAVAILABLE", "CANCELLED"].includes(material.indexing_status ?? "");
}
export function materialStatusLabel(material: Material) {
  if (material.status === "UPLOADING") return "Carga sin confirmar · volvé a subir el mismo archivo para continuar";
  const progress = material.processing;
  const amount = progress?.total ? ` (${progress.completed}/${progress.total})` : "";
  if (progress?.phase === "EXTRACTING") return "Extrayendo texto" + amount;
  if (progress?.phase === "OCR") return "Leyendo páginas escaneadas" + amount;
  if (progress?.phase === "INDEXING") return "Texto disponible · preparando búsqueda" + amount;
  if (material.status === "READY") {
    if (progress?.phase === "WAITING") return "Texto disponible · esperando reintento";
    if (material.text_complete === false) return "Texto parcial disponible";
    if (material.indexing_status && material.indexing_status !== "READY") return "Texto disponible · búsqueda avanzada pendiente";
    return "Listo para estudiar";
  }
  if (material.status === "CANCELLED") return "Procesamiento cancelado · original conservado";
  if (material.status === "FAILED") return "No pudimos terminar de leerlo · original conservado";
  if (material.status === "PROCESSING") return "Leyendo el documento…";
  return "En cola para procesar";
}
