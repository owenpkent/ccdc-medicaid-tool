/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/* Base-relative paths of the vendored decode assets, injected by vite.config.ts
 * from scripts/vendor-assets.mjs (the same helper scripts/vendor-ocr.mjs uses to
 * decide where to copy them). They carry the installed package versions, so an
 * upgrade changes the URL and the service worker cannot serve stale bytes.
 * Read them through src/lib/vendor-assets.ts, not directly. */
declare const __VENDOR_TESSERACT_PATH__: string;
declare const __VENDOR_ZXING_PATH__: string;
