import mammoth from "mammoth";
import sharp from "sharp";
import yauzl from "yauzl";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { AIProvider } from "@compa/server";
export interface PageText {
  label: string;
  text: string;
  needs_ocr?: boolean;
}
export interface ExtractionOptions {
  signal?: AbortSignal;
  checkpoints?: PageText[];
  onPage?: (page: PageText, ordinal: number) => Promise<void>;
  onProgress?: (phase: "EXTRACTING" | "OCR", completed: number, total: number) => Promise<void>;
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
  ai: AIProvider | null,
  options: ExtractionOptions = {},
): Promise<PageText[]> {
  const alive = () => options.signal?.throwIfAborted();
  const keep = async (page: PageText, ordinal: number) => {
    alive();
    if (page.text.length > 250000) throw new RecoverableDocumentError("Una sección es demasiado extensa. Dividí el material en archivos más pequeños.");
    await options.onPage?.(page, ordinal);
    return page;
  };
  alive();
  if (buffer.length > 25 * 1024 * 1024)
    throw new RecoverableDocumentError("El archivo supera 25 MB.");
  if (mime === "text/plain") {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
    catch { throw new RecoverableDocumentError("Guardá el texto con codificación UTF-8 y volvé a subirlo."); }
    if (text.includes("\0"))
      throw new RecoverableDocumentError(
        "El texto tiene un formato no compatible.",
      );
    return [await keep({ label: "Texto · sección 1", text, needs_ocr: false }, 0)];
  }
  if (mime.includes("wordprocessingml")) {
    if (buffer.subarray(0, 2).toString() !== "PK")
      throw new RecoverableDocumentError("El archivo no es un DOCX válido.");
    await safeZip(buffer);
    const result = await mammoth.extractRawText({ buffer });
    const sections = result.value.split(/\n\s*\n/);
    if (sections.length > 2000) throw new RecoverableDocumentError("El DOCX tiene demasiadas secciones. Dividilo.");
    const pages: PageText[] = [];
    for (let i = 0; i < sections.length; i++) {
      pages.push(await keep({ label: "Sección " + (i + 1), text: sections[i], needs_ocr: false }, i));
    }
    return pages;
  }
  if (mime.startsWith("image/")) {
    let actual;
    try { actual = await sharp(buffer, { limitInputPixels: 36000000 }).metadata(); }
    catch { throw new RecoverableDocumentError("La imagen está dañada o supera el límite de 36 megapíxeles. Subí una copia más pequeña."); }
    if (!["jpeg", "png", "webp"].includes(actual.format ?? ""))
      throw new RecoverableDocumentError("Formato de imagen no compatible.");
    const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[mime];
    if (expected !== actual.format) throw new RecoverableDocumentError("El contenido no coincide con el formato de la imagen.");
    const cached = options.checkpoints?.[0];
    if (cached && !cached.needs_ocr) return [cached];
    if (!ai) return [await keep({ label: "Imagen 1", text: "", needs_ocr: true }, 0)];
    await options.onProgress?.("OCR", 0, 1);
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
    alive();
    const result = await ai.ocr("data:image/png;base64," + image.toString("base64"));
    const text = result.pages.map((page) => page.text).join("\n").trim();
    if (!text) throw new RecoverableDocumentError("No encontramos texto legible. Subí una imagen más clara.");
    const page = await keep({ label: "Imagen 1", text, needs_ocr: false }, 0);
    await options.onProgress?.("OCR", 1, 1);
    return [page];
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
        alive();
        const saved = options.checkpoints?.[n - 1];
        if (saved && !saved.needs_ocr) {
          pages.push(saved);
          await options.onProgress?.("EXTRACTING", n, doc.numPages);
          continue;
        }
        const page = await doc.getPage(n),
          content = await page.getTextContent();
        let text = content.items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" ")
          .trim();
        const needsOCR = text.length < 40;
        if (needsOCR && ai) {
          await options.onProgress?.("OCR", n - 1, doc.numPages);
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
        if (needsOCR && ai && !text.trim())
          throw new RecoverableDocumentError(
            "La página " + n + " no se puede leer. Subí una copia más clara.",
          );
        pages.push(await keep({ label: "Página " + n, text, needs_ocr: needsOCR && !ai }, n - 1));
        await options.onProgress?.(needsOCR && ai ? "OCR" : "EXTRACTING", n, doc.numPages);
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
  for (const [pageIndex, page] of pages.entries()) {
    const clean = page.text.trim();
    if (!clean) continue;
    for (let start = 0; start < clean.length; start += 1600) {
      chunks.push({
        // Stable ordinals preserve citations when a previously scanned page is recovered.
        ordinal: pageIndex * 1000 + Math.floor(start / 1600),
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
