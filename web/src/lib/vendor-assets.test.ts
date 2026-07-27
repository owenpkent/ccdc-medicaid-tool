/// <reference types="node" />
// Node types referenced here only: this test reads node_modules and public/.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { PDFJS_STANDARD_FONTS_URL, TESSERACT_VENDOR, ZXING_WASM_URL } from "./vendor-assets";
import { vendorPaths } from "../../scripts/vendor-assets.mjs";

/* Guards the fix for the stale-vendored-asset crash.
 *
 * The service worker caches /vendor/ CacheFirst for 90 days. If the URL of a
 * wasm binary survives an upgrade of its package, a returning user gets new
 * JavaScript glue driving an old binary, which throws "memory access out of
 * bounds" mid-scan and is shown to them as that raw string. So the URL must
 * carry the installed version, and it must be the same path the copier wrote.
 *
 * These checks also prove the build-time injection is actually wired: without
 * the `define` in vite.config.ts, importing ./vendor-assets throws. */

const WEB = resolve(process.cwd());

function installedVersion(pkg: string): string {
  const file = resolve(WEB, "node_modules", pkg, "package.json");
  return JSON.parse(readFileSync(file, "utf8")).version as string;
}

describe("vendored runtime asset URLs", () => {
  it("point at the paths scripts/vendor-ocr.mjs writes", () => {
    // The copier and the app derive their paths from one helper. This fails if
    // the injection is dropped, points somewhere else, or goes stale against
    // what is installed (the config reads node_modules at load time).
    const paths = vendorPaths();
    expect(TESSERACT_VENDOR).toBe(`${import.meta.env.BASE_URL}${paths.tesseract}`);
    expect(ZXING_WASM_URL).toBe(`${import.meta.env.BASE_URL}${paths.zxing}/zxing_reader.wasm`);
    expect(PDFJS_STANDARD_FONTS_URL).toBe(`${import.meta.env.BASE_URL}${paths.pdfjsFonts}/`);
  });

  it("carry the installed package versions, so an upgrade changes the URL", () => {
    expect(ZXING_WASM_URL).toContain(`/zxing/${installedVersion("zxing-wasm")}-`);
    expect(TESSERACT_VENDOR).toContain(`/tesseract/${installedVersion("tesseract.js")}-`);
    expect(PDFJS_STANDARD_FONTS_URL).toContain(`/pdfjs-fonts/${installedVersion("pdfjs-dist")}-`);
  });

  it("end the standard-font directory in a slash, which pdf.js requires", () => {
    // pdf.js concatenates a file name onto standardFontDataUrl and throws
    // "Invalid factory url: ... must include trailing slash" without it, which
    // would break the on-screen review-and-sign preview outright.
    expect(PDFJS_STANDARD_FONTS_URL.endsWith("/")).toBe(true);
  });

  it("digests every contributing package, not just the one in the version", () => {
    // tesseract.js-core and the language models ship bytes of their own and can
    // move without tesseract.js moving, so the directory segment ends in a hash
    // of the whole set. Losing that hash would let those upgrades go unnoticed.
    const paths = vendorPaths();
    for (const dir of [paths.tesseract, paths.zxing, paths.pdfjsFonts]) {
      const segments = dir.split("/");
      expect(segments[segments.length - 1]).toMatch(/-[0-9a-f]{8}$/);
    }
  });

  it("stay same-origin (no CDN, no absolute URL)", () => {
    for (const url of [TESSERACT_VENDOR, ZXING_WASM_URL, PDFJS_STANDARD_FONTS_URL]) {
      expect(url).not.toMatch(/^[a-z]+:/i);
      expect(url).not.toMatch(/^\/\//);
      expect(url.startsWith(import.meta.env.BASE_URL)).toBe(true);
    }
  });

  it("resolve to files that exist once the assets are vendored", () => {
    // public/vendor is gitignored and pretest does not run vendor:ocr, so this
    // only asserts when a dev or build run has populated it (in CI it is absent
    // at test time and the check is skipped). When it is present, a copy left
    // over from an older package version means the app would 404 on its wasm.
    const paths = vendorPaths();
    if (!existsSync(resolve(WEB, "public", "vendor"))) return;
    const wanted = [
      `${paths.zxing}/zxing_reader.wasm`,
      `${paths.tesseract}/worker.min.js`,
      `${paths.tesseract}/tessdata/eng.traineddata.gz`,
      // ZapfDingbats: the checkbox glyph font, the one the preview needs most.
      `${paths.pdfjsFonts}/FoxitDingbats.pfb`,
    ];
    const missing = wanted.filter((p) => !existsSync(resolve(WEB, "public", p)));
    expect(missing, "public/vendor is stale; run `npm run vendor:ocr`").toEqual([]);
  });
});
