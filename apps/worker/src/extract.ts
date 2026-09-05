import mammoth from "mammoth";
import sharp from "sharp";
import yauzl from "yauzl";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { AIProvider } from "@compa/server";
export interface PageText {
  label: string;
  text: string;
}
export class RecoverableDocumentError extends Error {}
async function safeZip(buffer: Buffer) {
  await new Promise<void>((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip)
        return reject(new RecoverableDocumentError("El DOCX no es válido."));
      let total = 0,
        count = 0;
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        total += entry.uncompressedSize;
        count++;
        if (
          total > 100 * 1024 * 1024 ||
          count > 2000 ||
          entry.uncompressedSize > 25 * 1024 * 1024 ||
          entry.fileName.split("/").includes("..")
        ) {
          zip.close();
          reject(
            new RecoverableDocumentError(
              "El documento es demasiado complejo. Exportalo como PDF o dividilo.",
            ),
          );
          return;
        }
        zip.readEntry();
      });
      zip.readEntry();
    }),
  );
}
export async function extractDocument(
  buffer: Buffer,
  mime: string,
  ai: AIProvider,
): Promise<PageText[]> {
  if (buffer.length > 25 * 1024 * 1024)
    throw new RecoverableDocumentError("El archivo supera 25 MB.");
  if (mime === "text/plain") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (text.includes("\0"))
      throw new RecoverableDocumentError(
        "El texto tiene un formato no compatible.",
      );
    return [{ label: "Texto · sección 1", text }];
  }
  if (mime.includes("wordprocessingml")) {
    if (buffer.subarray(0, 2).toString() !== "PK")
      throw new RecoverableDocumentError("El archivo no es un DOCX válido.");
    await safeZip(buffer);
    const result = await mammoth.extractRawText({ buffer });
    return result.value
      .split(/\n\s*\n/)
      .map((text, i) => ({ label: "Sección " + (i + 1), text }));
  }
  if (mime.startsWith("image/")) {
    const actual = await sharp(buffer, {
      limitInputPixels: 36000000,
    }).metadata();
    if (!["jpeg", "png", "webp"].includes(actual.format ?? ""))
      throw new RecoverableDocumentError("Formato de imagen no compatible.");
    const image = await sharp(buffer, { limitInputPixels: 36000000 })
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    return (
      await ai.ocr("data:image/png;base64," + image.toString("base64"))
    ).pages.map((p, i) => ({ label: "Imagen " + (i + 1), text: p.text }));
  }
  if (mime === "application/pdf") {
    if (!buffer.subarray(0, 1024).toString("latin1").includes("%PDF-"))
      throw new RecoverableDocumentError("El archivo no es un PDF válido.");
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    let doc;
    try {
      doc = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      }).promise;
    } catch {
      throw new RecoverableDocumentError(
        "El PDF está cifrado o dañado. Subí una copia que se pueda abrir.",
      );
    }
    try {
      if (doc.numPages > 100)
        throw new RecoverableDocumentError(
          "Dividí el PDF en archivos de hasta 100 páginas.",
        );
      const pages: PageText[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n),
          content = await page.getTextContent();
        let text = content.items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" ")
          .trim();
        if (text.length < 40) {
          const raw = page.getViewport({ scale: 1 }),
            scale = Math.min(2, 2400 / Math.max(raw.width, raw.height)),
            viewport = page.getViewport({ scale });
          const canvas = createCanvas(
              Math.ceil(viewport.width),
              Math.ceil(viewport.height),
            ),
            context = canvas.getContext("2d");
          await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            canvas: canvas as unknown as HTMLCanvasElement,
            viewport,
          }).promise;
          const result = await ai.ocr(
            "data:image/png;base64," +
              canvas.toBuffer("image/png").toString("base64"),
          );
          text = result.pages.map((x) => x.text).join("\n");
        }
        if (!text.trim())
          throw new RecoverableDocumentError(
            "La página " + n + " no se puede leer. Subí una copia más clara.",
          );
        pages.push({ label: "Página " + n, text });
        page.cleanup();
      }
      return pages;
    } finally {
      await doc.loadingTask.destroy();
    }
  }
  throw new RecoverableDocumentError("Formato no compatible.");
}
export function chunkPages(pages: PageText[]) {
  const chunks: { ordinal: number; label: string; content: string }[] = [];
  for (const page of pages) {
    const clean = page.text.trim();
    if (!clean) continue;
    for (let start = 0; start < clean.length; start += 1600) {
      chunks.push({
        ordinal: chunks.length,
        label: page.label,
        content: clean.slice(start, start + 1800),
      });
      if (chunks.length > 600)
        throw new RecoverableDocumentError(
          "El material es demasiado extenso. Dividilo en partes.",
        );
      if (start + 1800 >= clean.length) break;
    }
  }
  if (!chunks.length)
    throw new RecoverableDocumentError(
      "No encontramos texto legible. Subí una copia más clara.",
    );
  return chunks;
}
