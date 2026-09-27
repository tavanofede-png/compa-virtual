import type { AIProvider } from "@compa/server";
import { chunkPages, extractDocument, type PageText } from "./extract";

export interface MaterialWorkStore {
  event(type: string, data?: Record<string, unknown>): Promise<void>;
  pages(): Promise<PageText[]>;
  chunks(): Promise<{ id: string; content: string; embedding: unknown }[]>;
}

// Text is durable before OCR/embeddings. Page and vector checkpoints survive retries.
export async function runMaterialPipeline(
  buffer: Buffer, mime: string, store: MaterialWorkStore,
  getAI: () => Promise<AIProvider | null>, signal: AbortSignal,
) {
  const checkpoint = async (page: PageText, ordinal: number) => {
    signal.throwIfAborted();
    await store.event("PAGE", { ...page, needs_ocr: Boolean(page.needs_ocr), ordinal });
  };
  const progress = async (phase: "EXTRACTING" | "OCR", completed: number, total: number) => {
    signal.throwIfAborted();
    await store.event("PROGRESS", { phase, completed, total });
  };
  let pages = await extractDocument(buffer, mime, null, {
    signal, checkpoints: await store.pages(), onPage: checkpoint, onProgress: progress,
  });
  const saveText = async () => {
    signal.throwIfAborted();
    if (pages.some((page) => page.text.trim())) await store.event("TEXT", {
      chunks: chunkPages(pages), complete: !pages.some((page) => page.needs_ocr), page_count: pages.length,
    });
  };
  await saveText();
  if (pages.some((page) => page.needs_ocr)) {
    const ai = await getAI();
    if (!ai) {
      await store.event("UNAVAILABLE", { error: pages.some((page) => page.text.trim())
        ? "El texto disponible se conservó. Falta habilitar OCR para leer las páginas escaneadas."
        : "El original está disponible. Falta habilitar OCR para leer esta imagen o PDF escaneado." });
      return;
    }
    const guarded = { ...ai, ocr: async (data: string) => {
      signal.throwIfAborted();
      const current = await getAI();
      if (!current) throw Error("OCR_UNAVAILABLE");
      return current.ocr(data);
    } } satisfies AIProvider;
    pages = await extractDocument(buffer, mime, guarded, {
      signal, checkpoints: pages, onPage: checkpoint, onProgress: progress,
    });
    await saveText();
  }
  chunkPages(pages); // Empty native documents never become READY.
  const chunks = await store.chunks();
  const missing = chunks.filter((chunk) => chunk.embedding === null);
  for (let start = 0; start < missing.length; start += 24) {
    signal.throwIfAborted();
    const ai = await getAI();
    if (!ai) {
      await store.event("UNAVAILABLE", { error: "El texto ya está disponible. La búsqueda avanzada podrá prepararse cuando la IA esté habilitada." });
      return;
    }
    await store.event("PROGRESS", { phase: "INDEXING", completed: chunks.length - missing.length + start, total: chunks.length });
    const batch = missing.slice(start, start + 24);
    const vectors = await ai.embed(batch.map((chunk) => chunk.content));
    signal.throwIfAborted();
    if (vectors.length !== batch.length || vectors.some((vector) => vector.length !== 1536 || vector.some((value) => !Number.isFinite(value))))
      throw Error("INVALID_EMBEDDINGS");
    await store.event("VECTORS", { chunks: batch.map((chunk, index) => ({ id: chunk.id, embedding: vectors[index] })) });
    await store.event("PROGRESS", { phase: "INDEXING", completed: Math.min(chunks.length, chunks.length - missing.length + start + batch.length), total: chunks.length });
  }
  await store.event("DONE");
}
