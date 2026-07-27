import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { vendorPaths } from "./scripts/vendor-assets.mjs";

// Where scripts/vendor-ocr.mjs put the OCR and barcode assets for the versions
// installed right now. Injected below so the app requests exactly those bytes.
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
        // The vendored OCR assets (~27 MB) are NOT precached: that would bloat
        // first load on a slow connection. They are runtime-cached on first use
        // below, so photo-OCR also works offline after the first photo.
        globIgnores: ["**/vendor/**"],
        // pdf.js's worker chunk can exceed the 2 MB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // All vendored decode assets: tesseract (OCR) and zxing (barcodes).
            // CacheFirst on purpose: offline scanning is a product requirement,
            // and revalidating 27 MB on every scan is not an option. Serving
            // stale bytes is prevented by the URL, not by the handler. The paths
            // carry the installed package versions (scripts/vendor-assets.mjs),
            // so an upgraded build asks for a URL this cache has never seen.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes("/vendor/"),
            handler: "CacheFirst",
            options: {
              cacheName: "ocr-assets",
              // One version's full set is 13 files (worker, 3 core variants x 3
              // files, 2 language models, the zxing wasm), and a single app
              // build only ever requests one version. The small headroom lets
              // the new set land during an upgrade; the previous version's
              // entries are then the least recently used, so they are evicted
              // instead of accumulating another ~27 MB.
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 90 },
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
