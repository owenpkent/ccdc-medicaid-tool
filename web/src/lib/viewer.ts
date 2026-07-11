/* On-screen PDF viewer engine for the review-and-sign step.
 *
 * Storage-free by design (the privacy guard forbids any browser storage API
 * here): everything is in-memory. Rendering reuses the same lazily-loaded,
 * same-origin pdf.js worker as the read side (lib/pdf.ts), with
 * `isEvalSupported: false` to satisfy the CSP. Signature stamping runs through
 * the fill layer's audited `overlaySignature`, and pdf-lib is imported
 * dynamically so it stays in its own lazy chunk.
 */
import type { PDFDocumentLoadingTask, PDFPageProxy } from "pdfjs-dist";

import { overlaySignature } from "./fill/util";
import { loadPdfjs } from "./pdf";

/** A signature the user has placed on a page, in page-relative fractions. */
export interface PlacedSignature {
  /** 1-based page number. */
  page: number;
  /** PNG data URL of the signature image. */
  dataUrl: string;
  /** Fractions of the page (0..1), top-left origin, so they survive zoom. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Open a PDF for rendering. Copies the bytes so the caller's buffer is safe,
 * and returns the loading task (its `.promise` resolves to the document and its
 * `.destroy()` tears everything down). `isEvalSupported: false` is cast in
 * because v6 dropped it from the typed params but pdf.js still honors it; this
 * matches lib/pdf.ts and keeps eval() off, which our CSP requires.
 */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await loadPdfjs();
  const params = { data: bytes.slice(), isEvalSupported: false } as Parameters<
    typeof pdfjs.getDocument
  >[0];
  return pdfjs.getDocument(params);
}

/** Render a page onto a canvas at the given scale (crisp on HiDPI displays). */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const outputScale = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const base = { canvas, viewport };
  const params =
    outputScale !== 1
      ? { ...base, transform: [outputScale, 0, 0, outputScale, 0, 0] }
      : base;
  await page.render(params).promise;
}

/**
 * Stamp the placed signatures into the filled PDF and return the new bytes.
 * Loads with pdf-lib and saves WITHOUT flattening, so the form fields stay live
 * and correctable, matching the fill engine's discipline.
 */
export async function stampSignatures(
  bytes: Uint8Array,
  signatures: PlacedSignature[],
): Promise<Uint8Array> {
  if (signatures.length === 0) return bytes;
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);

  for (const sig of signatures) {
    const pageIndex = sig.page - 1;
    const page = doc.getPage(pageIndex);
    const { width: pw, height: ph } = page.getSize();
    const w = sig.w * pw;
    const h = sig.h * ph;
    const x = sig.x * pw;
    // Normalized rects are top-left origin; PDF user space is bottom-left.
    const y = ph - sig.y * ph - h;
    await overlaySignature(doc, sig.dataUrl, [{ page: pageIndex, x, y, w, h }]);
  }

  return doc.save();
}
