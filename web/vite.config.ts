import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { vendorPaths } from "./scripts/vendor-assets.mjs";

// Where scripts/vendor-ocr.mjs put the OCR, barcode, and pdf.js font assets for
// the versions installed right now. Injected below so the app requests exactly
// those bytes.
// Read at config load, so `vite build`, `vite dev`, and vitest (same config) all
// agree with node_modules and cannot drift from it.
const vendor = vendorPaths();

// Content-Security-Policy that enforces the privacy promise: no script, fetch,
// frame, or connection may reach any origin other than our own. `connect-src
// 'self'` is what blocks data exfiltration; the vendored OCR/PDF assets are
// same-origin, so they still load. Injected at build time only, so it never
// interferes with the Vite dev server's HMR websocket.
//
// `frame-ancestors` and `report-uri` are ignored in a <meta> CSP; the static
// host should also send this policy (plus `frame-ancestors 'none'`) as a real
// response header. See docs/privacy.md.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'none'",
].join("; ");

function injectCsp(): Plugin {
  // The response-header policy adds frame-ancestors, which a <meta> CSP cannot
  // enforce. Built from the same CSP constant so the two cannot drift.
  const headerCsp = `${CSP}; frame-ancestors 'none'`;
  return {
    name: "coverage-compass:inject-csp",
    apply: "build",
    // Structured tag injection (order-independent, cannot silently no-op the way
    // a string replace on "</head>" could if plugin ordering changed).
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
          injectTo: "head-prepend",
        },
      ];
    },
    // Emit a Netlify/Cloudflare Pages `_headers` file so a header-capable host
    // sends the real policy, including frame-ancestors and clickjacking headers.
    // GitHub Pages ignores this (it cannot set custom headers); see docs/privacy.md.
    generateBundle() {
      const headers = [
        "/*",
        `  Content-Security-Policy: ${headerCsp}`,
        "  X-Frame-Options: DENY",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: no-referrer",
        "",
      ].join("\n");
      this.emitFile({ type: "asset", fileName: "_headers", source: headers });
    },
  };
}

export default defineConfig({
  // Relative base so the app works whether served from a domain root or a
  // project subpath (e.g. GitHub Pages /coverage-compass/).
  base: "./",
  // Build-time constants, not hand-maintained ones: src/lib/vendor-assets.ts
  // turns these into the URLs the app fetches. See scripts/vendor-assets.mjs for
  // why the paths carry versions (stale CacheFirst wasm crashes the scanner).
  define: {
    __VENDOR_TESSERACT_PATH__: JSON.stringify(vendor.tesseract),
    __VENDOR_ZXING_PATH__: JSON.stringify(vendor.zxing),
    __VENDOR_PDFJS_FONTS_PATH__: JSON.stringify(vendor.pdfjsFonts),
  },
  plugins: [
    react(),
    injectCsp(),
    VitePWA({
      registerType: "autoUpdate",
      // We register the service worker ourselves in main.tsx (via the virtual
      // module) so there is no inline script for the CSP to forbid.
      injectRegister: false,
      includeAssets: ["icon.svg", "icon-maskable.svg"],
      manifest: {
        name: "Coverage Compass",
        short_name: "Coverage Compass",
        description:
          "A private, local tool that explains letters from Colorado Medicaid (Health First Colorado).",
        lang: "en",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1a365d",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the app shell so PDF and paste-text triage work fully offline.
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,webmanifest}"],
        // The vendored OCR, barcode, and pdf.js font assets (~40 MB) are NOT
        // precached: that would bloat first load on a slow connection. They are
        // runtime-cached on first use below, so photo-OCR and the on-screen
        // preview also work offline after the first use.
        globIgnores: ["**/vendor/**"],
        // pdf.js's worker chunk can exceed the 2 MB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // All vendored runtime assets: tesseract (OCR), zxing (barcodes),
            // and the pdf.js standard fonts (on-screen preview).
            // CacheFirst on purpose: offline scanning is a product requirement,
            // and revalidating 40 MB on every scan is not an option. Serving
            // stale bytes is prevented by the URL, not by the handler. The paths
            // carry the installed package versions (scripts/vendor-assets.mjs),
            // so an upgraded build asks for a URL this cache has never seen.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes("/vendor/"),
            handler: "CacheFirst",
            options: {
              cacheName: "ocr-assets",
              // maxEntries must clear what ONE version can request, or the
              // cache thrashes and offline decode breaks on every reload.
              // Ceiling for one version, counting every file that can be
              // requested (not every file vendored):
              //   12 tesseract  1 worker + 3 core variants x 3 files
              //                 (js, wasm, wasm.js) + 2 language models
              //    1 zxing      zxing_reader.wasm
              //   14 pdf.js     the standard font binaries (10 .pfb + 4 .ttf).
              //                 The 2 LICENSE files ship for attribution and
              //                 are never fetched. In practice pdf.js asks for
              //                 only Symbol and ZapfDingbats, because it
              //                 substitutes system fonts for the rest.
              //   -- = 27
              // 32 leaves 5 slots of headroom so the new set can land during an
              // upgrade. The previous version's entries are then the least
              // recently used, so they are evicted instead of accumulating
              // another ~40 MB.
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // SW is built for production; the dev server stays plain.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      output: {
        // `codeSplitting` is rolldown's native grouping API. The older
        // `manualChunks` function is still accepted but no longer isolates
        // React: rolldown left a stub "react" chunk and hoisted react and
        // react-dom's real bodies into the aria chunk (shared dependency),
        // coupling React's cache lifetime to aria. Groups are matched in
        // order, first match wins, so the exact node_modules/react/ match
        // runs before the broader aria patterns.
        // pdfjs-dist, tesseract.js, and pdf-lib are dynamically imported, so they
        // get their own lazy chunks without being named here.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: "aria",
              test: /node_modules[\\/](react-aria-components|@react-aria[\\/]|@react-stately[\\/]|@react-types[\\/]|@internationalized[\\/])/,
            },
            {
              name: "intl",
              test: /node_modules[\\/](react-intl|@formatjs[\\/])/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
