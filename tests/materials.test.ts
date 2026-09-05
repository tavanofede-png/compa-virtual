import { it, expect } from "vitest";
import { chunkPages, extractDocument } from "../apps/worker/src/extract";
import type { AIProvider } from "../packages/server/src/ai";
import { textPdf, textDocx } from "./fixtures";
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
