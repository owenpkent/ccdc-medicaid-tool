/* OCR for photos of paper letters (the read side).
 *
 * Wraps tesseract.js. The library and its WASM core are loaded only when a photo
 * is actually processed (dynamic import + lazy worker), so the read side's first
 * paint pays nothing for OCR.
 *
 * Every asset tesseract needs (worker script, WASM core, language model) is
 * served from our own origin out of /vendor/tesseract, vendored there by
 * scripts/vendor-ocr.mjs. Nothing is fetched from a CDN. That is what keeps the
 * "no third-party network" promise true for the photo path. See docs/privacy.md.
 * The exact (version-bearing) URL comes from lib/vendor-assets.ts.
 */
import type { Locale } from "./rules";
import { TESSERACT_VENDOR as VENDOR } from "./vendor-assets";

export interface OcrProgress {
  /** tesseract status string, e.g. "recognizing text". */
  status: string;
  /** 0..1 progress for the current status. */
  progress: number;
}

export interface OcrOptions {
  locale?: Locale;
  onProgress?: (p: OcrProgress) => void;
  /** Abort signal: terminates the worker if the user cancels. */
  signal?: AbortSignal;
}

/** Thrown when an in-flight OCR run is cancelled via the abort signal. */
export class OcrAbortError extends Error {
  constructor() {
    super("OCR was cancelled.");
    this.name = "OcrAbortError";
  }
}

/**
 * Recognize text in an image (photo or scan) of a letter. Returns the trimmed
 * text. An empty string means tesseract found nothing legible (a blank, very
 * low-quality, or handwritten image); the caller should surface that as a
 * "could not read this photo" message rather than a classification.
 */
export async function extractTextFromImage(
  image: File | Blob,
  options: OcrOptions = {},
): Promise<string> {
  const lang = options.locale === "es" ? "spa" : "eng";
  const { createWorker } = await import("tesseract.js");

  // Always pass a logger (a no-op when no handler was given) so the field is
  // never `undefined` under exactOptionalPropertyTypes.
  const onProgress = options.onProgress ?? (() => {});

  const worker = await createWorker(lang, 1, {
    workerPath: `${VENDOR}/worker.min.js`,
    corePath: `${VENDOR}/`,
    langPath: `${VENDOR}/tessdata`,
    // Do not let tesseract persist the language model to IndexedDB. The vendored
    // model is already same-origin and cached by the service worker, so its own
    // cache is redundant and would violate "nothing persists by default" (see
    // docs/privacy.md). "none" skips both the IndexedDB read and write.
    cacheMethod: "none",
    logger: (m) => onProgress({ status: m.status, progress: m.progress ?? 0 }),
  });

  let aborted = false;
  const onAbort = () => {
    aborted = true;
    void worker.terminate();
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const { data } = await worker.recognize(image);
    return data.text.trim();
  } catch (err) {
    if (aborted || options.signal?.aborted) throw new OcrAbortError();
    throw err;
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    // Terminate exactly once: the abort handler already did it on that path.
    if (!aborted) await worker.terminate();
  }
}
