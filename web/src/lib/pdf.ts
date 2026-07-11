/* PDF text extraction (the read side).
 *
 * Wraps pdf.js. The library is dynamically imported so it lands in its own lazy
 * chunk and never weighs down the first paint. The worker is bundled from our
 * own origin (Vite `?url` import), so no script is fetched from a CDN: pdf.js
 * runs entirely local, which is the whole privacy point.
 */
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

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
 *
 * `isEvalSupported: false` keeps pdf.js from using eval(), which our CSP forbids.
 */
export async function extractTextFromPdf(
  input: File | Blob | ArrayBuffer | Uint8Array,
): Promise<ExtractedText> {
  const pdfjs = await loadPdfjs();
  const data = await toUint8(input);

  // isEvalSupported:false hardens pdf.js against eval() (our CSP forbids eval
  // regardless). The v6 public types omit the field, so attach it via a cast.
  const params = { data, isEvalSupported: false } as Parameters<typeof pdfjs.getDocument>[0];
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
