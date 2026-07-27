/* PDF text extraction (the read side).
 *
 * Wraps pdf.js. The library is dynamically imported so it lands in its own lazy
 * chunk and never weighs down the first paint. The worker is bundled from our
 * own origin (Vite `?url` import), so no script is fetched from a CDN: pdf.js
 * runs entirely local, which is the whole privacy point.
 */
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { PDFJS_STANDARD_FONTS_URL } from "./vendor-assets";

/**
 * The options every pdf.js document in this app is opened with. One constant so
 * the read side and the on-screen viewer cannot drift apart.
 *
 * - `isEvalSupported: false` keeps pdf.js off eval(), which our CSP forbids.
 * - `standardFontDataUrl` points at our vendored copy of the standard PDF fonts
 *   (scripts/vendor-ocr.mjs). Without it pdf.js warns "Ensure that the
 *   `standardFontDataUrl` API parameter is provided" and then tries to borrow a
 *   system font, which fails for ZapfDingbats (the glyph font PDF checkboxes
 *   use) on machines that do not have it. Both paths translate fonts, so both
 *   set it. Same-origin only: a CDN would break the privacy promise and the CSP.
 *
 * pdf.js v6's public types omit both fields, so callers attach this via a cast.
 */
export const PDFJS_DOCUMENT_OPTIONS = {
  isEvalSupported: false,
  standardFontDataUrl: PDFJS_STANDARD_FONTS_URL,
} as const;

export interface ExtractedText {
  text: string;
  pageCount: number;
}

/** Thrown when a PDF is password-protected and cannot be read without the password. */
export class EncryptedPdfError extends Error {
  constructor() {
    super("This PDF is password protected.");
    this.name = "EncryptedPdfError";
  }
}

/** Thrown when the file is not a readable PDF. */
export class InvalidPdfError extends Error {
  constructor() {
    super("This file is not a readable PDF.");
    this.name = "InvalidPdfError";
  }
}

let workerConfigured = false;

/**
 * Load pdf.js lazily and configure its worker from our own origin exactly once.
 * Exported so the on-screen viewer (lib/viewer.ts) reuses the same worker setup
 * rather than configuring a second one.
 */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerConfigured = true;
  }
  return pdfjs;
}

function toUint8(input: File | Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return Promise.resolve(input);
  if (input instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(input));
  return input.arrayBuffer().then((b) => new Uint8Array(b));
}

/**
 * Extract the text layer from a (digitally generated) PDF. Returns the combined
 * text and the page count. Scanned/image-only PDFs yield little or no text; the
 * caller should fall back to OCR when the result is effectively empty.
 */
export async function extractTextFromPdf(
  input: File | Blob | ArrayBuffer | Uint8Array,
): Promise<ExtractedText> {
  const pdfjs = await loadPdfjs();
  const data = await toUint8(input);

  // See PDFJS_DOCUMENT_OPTIONS. The v6 public types omit these fields, so they
  // are attached via a cast; pdf.js still honors them.
  const params = { data, ...PDFJS_DOCUMENT_OPTIONS } as Parameters<typeof pdfjs.getDocument>[0];
  const task = pdfjs.getDocument(params);
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "PasswordException") {
      throw new EncryptedPdfError();
    }
    throw new InvalidPdfError();
  }

  try {
    const pageCount = doc.numPages;
    const parts: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Text items carry a `str`; marked-content items do not. Treat uniformly.
      const items = content.items as Array<{ str?: string }>;
      const pageText = items.map((it) => it.str ?? "").join(" ");
      parts.push(pageText);
      page.cleanup();
    }
    return { text: parts.join("\n").trim(), pageCount };
  } finally {
    // Destroying the loading task tears down the worker and transport in v6.
    await task.destroy();
  }
}
