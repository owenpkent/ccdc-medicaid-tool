/* URLs for the decode assets we serve from our own origin.
 *
 * tesseract.js (OCR) and zxing-wasm (barcode) need their worker, wasm, and
 * language files at runtime. scripts/vendor-ocr.mjs copies them out of
 * node_modules into web/public, so they are same-origin: nothing is fetched
 * from a CDN, ever (see docs/privacy.md).
 *
 * The directory names carry the installed package versions. vite.config.ts
 * injects them at build time from scripts/vendor-assets.mjs, the same helper the
 * copier uses, so the URL the app requests always matches the bytes that were
 * copied for this build.
 *
 * That versioning is load-bearing, not cosmetic. The service worker caches
 * everything under /vendor/ CacheFirst for 90 days. At a constant URL, upgrading
 * zxing-wasm or tesseract.js would hand a returning user the new JavaScript glue
 * with the old cached wasm binary, and the mismatch throws "memory access out of
 * bounds" in the middle of a scan. A version-bearing URL cannot hit a stale
 * cache entry: it was never requested before, so the cache has nothing to serve.
 */

// Base-aware so the app works under a subpath (e.g. GitHub Pages project sites).
const BASE = import.meta.env.BASE_URL;

/** Directory holding the tesseract worker, wasm cores, and tessdata models. */
export const TESSERACT_VENDOR = `${BASE}${__VENDOR_TESSERACT_PATH__}`;

/** The zxing barcode reader wasm binary. */
export const ZXING_WASM_URL = `${BASE}${__VENDOR_ZXING_PATH__}/zxing_reader.wasm`;
