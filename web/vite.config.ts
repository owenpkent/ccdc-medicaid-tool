import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes("/vendor/"),
            handler: "CacheFirst",
            options: {
              cacheName: "ocr-assets",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 90 },
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
        // Function form so React is actually isolated. The object form let Rollup
        // hoist react/react-dom into the aria chunk (shared dependency), leaving
        // an empty "react" chunk and coupling React's cache lifetime to aria.
        // pdfjs-dist, tesseract.js, and pdf-lib are dynamically imported, so they
        // get their own lazy chunks without being named here.
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react";
          }
          if (
            id.includes("react-aria-components") ||
            id.includes("@react-aria/") ||
            id.includes("@react-stately/") ||
            id.includes("@react-types/") ||
            id.includes("@internationalized/")
          ) {
            return "aria";
          }
          if (id.includes("react-intl") || id.includes("@formatjs/")) {
            return "intl";
          }
          return undefined;
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
