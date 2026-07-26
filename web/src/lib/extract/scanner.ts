/* Document scanning entry points for the fill flow (the capture side of the
 * engine, ported from CDASS Enroll src/extract/scanner.js).
 *
 * All decoding happens in this browser via WASM served from this app's own
 * origin: zxing-wasm (PDF417 license barcodes) from /vendor/zxing and
 * tesseract.js (OCR) from /vendor/tesseract, both vendored by
 * scripts/vendor-ocr.mjs and addressed through lib/vendor-assets.ts (which pins
 * the URLs to the installed package versions). No image ever leaves the machine.
 *
 * Both engines are dynamically imported so the fill view's first paint pays
 * nothing for them; they load when a document is actually scanned.
 */
import { parseAamva, type IdFields } from "./aamva";
import { parseMrz } from "./mrz";
import { parseSsnCard } from "./ssncard";
import { parseLicenseFront } from "./dlfront";
import { TESSERACT_VENDOR, ZXING_WASM_URL } from "../vendor-assets";

export interface ScanResult {
  fields: IdFields;
  /** Human-readable provenance, e.g. "Driver's license barcode". */
  source: string;
}

type ZxingReader = typeof import("zxing-wasm/reader");
let zxingPromise: Promise<ZxingReader> | null = null;
function getZxing(): Promise<ZxingReader> {
  zxingPromise ??= import("zxing-wasm/reader").then((z) => {
    z.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? ZXING_WASM_URL : prefix + path,
      },
    });
    return z;
  });
  return zxingPromise;
}

/* Unlike the read side's one-shot OCR (lib/ocr.ts), the scanner keeps its
 * worker alive: people scan several small documents in a row, and reloading
 * the language model for each would make every scan pay seconds of startup.
 * The model lives in memory only; cacheMethod: "none" keeps tesseract from
 * persisting it, same as lib/ocr.ts (see docs/privacy.md). */
type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;
let workerPromise: Promise<TesseractWorker> | null = null;
function getOcrWorker(): Promise<TesseractWorker> {
  workerPromise ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker("eng", 1, {
      workerPath: `${TESSERACT_VENDOR}/worker.min.js`,
      corePath: `${TESSERACT_VENDOR}/`,
      langPath: `${TESSERACT_VENDOR}/tessdata`,
      cacheMethod: "none",
    }),
  );
  return workerPromise;
}

async function ocr(input: Blob | HTMLCanvasElement): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(input as Parameters<TesseractWorker["recognize"]>[0]);
  return data.text ?? "";
}

// A pass constrained to digits and separators. Tesseract reads numbers far more
// reliably when it cannot try to fit letters, which matters for the SSN. The
// whitelist is cleared afterwards so the shared worker stays general-purpose.
async function ocrDigits(input: Blob | HTMLCanvasElement): Promise<string> {
  const worker = await getOcrWorker();
  await worker.setParameters({ tessedit_char_whitelist: "0123456789 -" });
  try {
    const { data } = await worker.recognize(input as Parameters<TesseractWorker["recognize"]>[0]);
    return data.text ?? "";
  } finally {
    await worker.setParameters({ tessedit_char_whitelist: "" });
  }
}

// ---- image preprocessing -------------------------------------------------
// Phone photos of small cards are often too low-resolution or low-contrast for
// reliable OCR / barcode decoding. Upscaling and converting to high-contrast
// grayscale improves both. Each scanner tries the original first (so a good
// photo is never made worse) and falls back to this enhanced version.

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read the image file."));
      img.src = URL.createObjectURL(file);
    });
  }
}

async function enhanceCanvas(
  file: Blob,
  { target = 2000, upscaleOnly = false } = {},
): Promise<HTMLCanvasElement> {
  const bmp = await loadBitmap(file);
  const longest = Math.max(bmp.width, bmp.height) || 1;
  let scale = target / longest;
  if (upscaleOnly) scale = Math.max(1, scale);
  scale = Math.min(scale, 3);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not read the image file.");
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  grayContrast(img.data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Grayscale plus a contrast stretch to the full 0-255 range.
function grayContrast(d: Uint8ClampedArray): void {
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g =
      (0.299 * (d[i] as number) + 0.587 * (d[i + 1] as number) + 0.114 * (d[i + 2] as number)) | 0;
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    const v = (((d[i] as number) - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// ---- scanners ------------------------------------------------------------

// Decode a PDF417 from any input zxing accepts (Blob/ImageData), trying two
// binarizers (LocalAverage for uneven light, GlobalHistogram for even light).
async function decodePdf417(input: Blob) {
  const { readBarcodes } = await getZxing();
  for (const binarizer of ["LocalAverage", "GlobalHistogram"] as const) {
    const results = await readBarcodes(input, {
      formats: ["PDF417"],
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      maxNumberOfSymbols: 1,
      binarizer,
    });
    const hit = results.find((r) => r.isValid && r.text);
    if (hit) return hit;
  }
  return null;
}

function licenseResult(text: string): ScanResult {
  const fields = parseAamva(text);
  if (!fields) throw new Error("Barcode decoded but it does not look like license data.");
  return { fields, source: "Driver's license barcode" };
}

/**
 * Scan the BACK of a driver's license (the PDF417 barcode).
 * Returns {fields, source} or throws with a friendly message.
 */
export async function scanLicense(imageFile: Blob): Promise<ScanResult> {
  const enhanced = await enhanceCanvas(imageFile, { target: 2600, upscaleOnly: true }).catch(
    () => null,
  );
  const enhancedBlob = enhanced ? await canvasToBlob(enhanced) : null;
  for (const input of [imageFile, enhancedBlob]) {
    if (!input) continue;
    const hit = await decodePdf417(input);
    if (hit) return licenseResult(hit.text);
  }
  throw new Error(
    "No barcode found. Get closer so the barcode fills the frame, tap to focus until the bars are sharp, and avoid glare. Or type the license details in by hand.",
  );
}

/**
 * OCR the FRONT of a driver's license for the date of birth and address (the
 * fields the barcode would give, when the barcode won't scan). Best-effort:
 * front layouts vary by state, so the result must be verified.
 */
export async function scanLicenseFront(imageFile: Blob): Promise<ScanResult> {
  const input = (await enhanceCanvas(imageFile).catch(() => null)) ?? imageFile;
  const text = await ocr(input);
  const fields = parseLicenseFront(text);
  if (fields) return { fields, source: "Driver's license front (OCR)" };
  throw new Error(
    noTextOr(
      text,
      "Couldn't read the date of birth or address from the front. Retake straight on, filling the frame, with no glare. You may need to type some fields.",
    ),
  );
}

/** Scan the photo page of a passport (reads the MRZ lines at the bottom). */
export async function scanPassport(imageFile: Blob): Promise<ScanResult> {
  const input = (await enhanceCanvas(imageFile).catch(() => null)) ?? imageFile;
  const text = await ocr(input);
  const fields = parseMrz(text);
  if (fields) return { fields, source: "Passport MRZ" };
  throw new Error(
    noTextOr(
      text,
      "Could not read the passport MRZ (the two <<< lines). Retake straight-on with the whole page in frame and even lighting.",
    ),
  );
}

/** Scan a Social Security card. */
export async function scanSsnCard(imageFile: Blob): Promise<ScanResult> {
  const input = (await enhanceCanvas(imageFile).catch(() => null)) ?? imageFile;
  // Normal pass for the name, digits-only pass for the number; search both.
  const text = (await ocr(input)) + "\n" + (await ocrDigits(input));
  const fields = parseSsnCard(text);
  if (fields) return { fields, source: "Social Security card" };
  throw new Error(
    noTextOr(
      text,
      "Could not find an SSN in the image. Make sure the nine digits are sharp and fill the frame, or just type them into the SSN field.",
    ),
  );
}

function noTextOr(text: string, fallback: string): string {
  return text.replace(/\s/g, "").length <= 3
    ? "OCR read no text from the image. The photo may be blank or unreadable; try retaking it."
    : fallback;
}
