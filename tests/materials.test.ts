import { it, expect } from "vitest";
import { chunkPages, extractDocument } from "../apps/worker/src/extract";
import type { AIProvider } from "../packages/server/src/ai";
import { textPdf, textDocx } from "./fixtures";
import { runMaterialPipeline, type MaterialWorkStore } from "../apps/worker/src/pipeline";
import type { PageText } from "../apps/worker/src/extract";
const forbiddenAI: AIProvider = {
  structured: async () => {
    throw Error("unexpected AI");
  },
  embed: async () => {
    throw Error("unexpected AI");
  },
  ocr: async () => {
    throw Error("unexpected OCR");
  },
};
it("extracts real PDF and DOCX bytes and retains source references", async () => {
  const pdf = await extractDocument(
    textPdf("La celula tiene membrana, citoplasma y material genetico."),
    "application/pdf",
    forbiddenAI,
  );
  expect(pdf[0].label).toBe("Página 1");
  expect(pdf[0].text).toContain("citoplasma");
  const docx = await extractDocument(
    textDocx(),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    forbiddenAI,
  );
  expect(docx.filter((p) => p.text.trim()).length).toBe(2);
  expect(chunkPages(docx)[1].label).toBe("Sección 2");
  expect(docx[1].text).toContain("genético");
});
it("chunks text with source labels and rejects empty files", () => {
  const chunks = chunkPages([{ label: "Página 7", text: "abc ".repeat(1000) }]);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((c) => c.label === "Página 7")).toBe(true);
  expect(() => chunkPages([{ label: "Página 1", text: "" }])).toThrow(
    "legible",
  );
});
it("extracts valid UTF-8 text without calling AI and rejects forged PDF/DOCX", async () => {
  const pages = await extractDocument(
    Buffer.from("La célula tiene una membrana."),
    "text/plain",
    forbiddenAI,
  );
  expect(pages[0].text).toContain("membrana");
  await expect(
    extractDocument(Buffer.from("not a PDF"), "application/pdf", forbiddenAI),
  ).rejects.toThrow("PDF");
  await expect(
    extractDocument(
      Buffer.from("not a zip"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      forbiddenAI,
    ),
  ).rejects.toThrow("DOCX");
});

function memoryStore() {
  const pages: PageText[] = [];
  let chunks: { id: string; content: string; embedding: number[] | null }[] = [];
  const events: string[] = [];
  const store: MaterialWorkStore = {
    event: async (type, data = {}) => {
      events.push(type);
      if (type === "PAGE") pages[Number(data.ordinal)] = { label: String(data.label), text: String(data.text), needs_ocr: Boolean(data.needs_ocr) };
      if (type === "TEXT") chunks = (data.chunks as { content: string; ordinal: number }[]).map((chunk) => ({ id: String(chunk.ordinal), content: chunk.content, embedding: chunks.find((old) => old.id === String(chunk.ordinal))?.embedding ?? null }));
      if (type === "VECTORS") for (const value of data.chunks as { id: string; embedding: number[] }[]) chunks.find((chunk) => chunk.id === value.id)!.embedding = value.embedding;
    },
    pages: async () => pages,
    chunks: async () => chunks,
  };
  return { store, pages, events, chunks: () => chunks };
}
it("keeps real PDF text usable when no AI provider is configured", async () => {
  const saved = memoryStore();
  await runMaterialPipeline(textPdf("La celula tiene membrana, citoplasma y material genetico."), "application/pdf", saved.store, async () => null, new AbortController().signal);
  expect(saved.pages[0].text).toContain("citoplasma");
  expect(saved.chunks()[0].content).toContain("membrana");
  expect(saved.events.at(-1)).toBe("UNAVAILABLE");
  expect(saved.events).not.toContain("DONE");
});
it("retains text before an indexing failure and resumes only missing vectors", async () => {
  const saved = memoryStore();
  const file = Buffer.from("Tema uno: " + "La celula tiene membrana. ".repeat(190));
  let fail = true;
  let calls = 0;
  const ai: AIProvider = { ...forbiddenAI, embed: async (input) => {
    calls++;
    if (fail && calls === 1) return input.map(() => Array(1536).fill(0.1));
    if (fail) throw Error("provider unavailable");
    return input.map(() => Array(1536).fill(0.2));
  } };
  // Force a failed call; native extraction and its page checkpoint precede it.
  const failedAI: AIProvider = { ...ai, embed: async () => { throw Error("provider unavailable"); } };
  await expect(runMaterialPipeline(file, "text/plain", saved.store, async () => failedAI, new AbortController().signal)).rejects.toThrow("provider unavailable");
  expect(saved.pages[0].text).toContain("Tema uno");
  expect(saved.chunks().length).toBeGreaterThan(1);
  saved.chunks()[0].embedding = Array(1536).fill(0.1);
  const remaining = saved.chunks().length - 1;
  let embedded = 0; fail = false;
  await runMaterialPipeline(file, "text/plain", saved.store, async () => ({ ...ai, embed: async (input) => { embedded += input.length; return input.map(() => Array(1536).fill(0.2)); } }), new AbortController().signal);
  expect(embedded).toBe(remaining);
  expect(saved.events.at(-1)).toBe("DONE");
});
it("does not call OCR for a completed page checkpoint and stops cancelled extraction", async () => {
  const file = textPdf("short");
  const pages = await extractDocument(file, "application/pdf", forbiddenAI, { checkpoints: [{ label: "Página 1", text: "Texto recuperado por OCR anteriormente.", needs_ocr: false }] });
  expect(pages[0].text).toContain("recuperado");
  const cancelled = new AbortController(); cancelled.abort(Error("cancelled"));
  await expect(extractDocument(file, "application/pdf", null, { signal: cancelled.signal })).rejects.toThrow("cancelled");
});
