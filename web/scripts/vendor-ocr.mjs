// Vendor the runtime assets our PDF, OCR, and barcode libraries fetch at run
// time (tesseract.js worker, WASM cores, language data, the zxing-wasm barcode
// reader, and pdf.js's standard PDF fonts) from node_modules into
// web/public/vendor so the page never fetches them from a CDN at runtime. This
// is what makes the "zero third-party network" privacy promise hold for the
// photo-OCR, document-scan, and on-screen-preview paths: every byte tesseract,
// zxing, and pdf.js need is served from our own origin (and cached for offline
// by the service worker).
//
// The copied files are gitignored. They are reproducible from the pinned
// lockfile, so a fresh clone runs `npm install` then this script (wired into the
// predev/prebuild npm hooks) and gets identical assets.
//
// The destination directories carry the installed package versions (see
// scripts/vendor-assets.mjs). Upgrading a package therefore moves the bytes to a
// URL the service worker has never cached, which is what stops a returning user
// from pairing new JavaScript glue with a 90-day-old cached wasm binary.
//
// Run: node scripts/vendor-ocr.mjs
import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { vendorPaths } from "./vendor-assets.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const nm = resolve(web, "node_modules");
const paths = vendorPaths();
const out = resolve(web, "public", paths.tesseract);
const tessdataOut = resolve(out, "tessdata");
const zxingOut = resolve(web, "public", paths.zxing);
const fontsOut = resolve(web, "public", paths.pdfjsFonts);

const force = process.argv.includes("--force");

// Drop every version directory except the current one (and any pre-versioning
// files left at the old flat locations). Without this, each upgrade would leave
// another ~40 MB in public/vendor and ship it all in dist/.
function pruneOldVersions(dir, keep) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === keep) continue;
    rmSync(resolve(dir, entry), { recursive: true, force: true });
    console.log(`Removed stale vendored assets: ${resolve(dir, entry)}`);
  }
}
pruneOldVersions(dirname(out), basename(out));
pruneOldVersions(dirname(zxingOut), basename(zxingOut));
pruneOldVersions(dirname(fontsOut), basename(fontsOut));

// Cheap skip: if this version's assets are already in place, don't recopy ~40 MB
// on every `npm run dev`. The check is version-aware, so upgrading a package
// refreshes the copy on its own; --force is only for a corrupted copy.
const sentinels = [
  resolve(out, "worker.min.js"),
  resolve(tessdataOut, "eng.traineddata.gz"),
  resolve(zxingOut, "zxing_reader.wasm"),
  resolve(fontsOut, "FoxitDingbats.pfb"),
];
if (!force && sentinels.every((f) => existsSync(f))) {
  console.log(`tesseract assets already vendored at ${out} (pass --force to refresh)`);
  process.exit(0);
}

// Fresh each run so a removed/renamed upstream file never lingers.
rmSync(out, { recursive: true, force: true });
rmSync(zxingOut, { recursive: true, force: true });
rmSync(fontsOut, { recursive: true, force: true });
mkdirSync(tessdataOut, { recursive: true });
mkdirSync(zxingOut, { recursive: true });
mkdirSync(fontsOut, { recursive: true });

function copy(from, to) {
  if (!existsSync(from)) {
    throw new Error(
      `Missing vendor source: ${from}\nRun \`npm install\` first so the asset packages are present.`,
    );
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

// tesseract.js worker (classic worker script, loaded same-origin).
copy(resolve(nm, "tesseract.js/dist/worker.min.js"), resolve(out, "worker.min.js"));

// WASM cores. tesseract.js v7 is LSTM-only; ship the three variants it may pick
// (plain LSTM, SIMD-LSTM, and relaxed-SIMD-LSTM for Safari) plus their loaders.
const coreVariants = ["lstm", "simd-lstm", "relaxedsimd-lstm"];
const coreRoot = resolve(nm, "tesseract.js-core");
for (const v of coreVariants) {
  for (const ext of ["js", "wasm", "wasm.js"]) {
    const name = `tesseract-core-${v}.${ext}`;
    copy(resolve(coreRoot, name), resolve(out, name));
  }
}

// Language models (gzipped traineddata). 4.0.0 = the "fast" models: smaller
// download, accurate enough for printed agency letters. English + Spanish.
copy(
  resolve(nm, "@tesseract.js-data/eng/4.0.0/eng.traineddata.gz"),
  resolve(tessdataOut, "eng.traineddata.gz"),
);
copy(
  resolve(nm, "@tesseract.js-data/spa/4.0.0/spa.traineddata.gz"),
  resolve(tessdataOut, "spa.traineddata.gz"),
);

// zxing-wasm reader (PDF417 barcode decoding for driver's licenses, used by
// the fill flow's document scanner in lib/extract/scanner.ts).
copy(
  resolve(nm, "zxing-wasm/dist/reader/zxing_reader.wasm"),
  resolve(zxingOut, "zxing_reader.wasm"),
);

// pdf.js standard PDF fonts (~800 KB). pdf.js fetches these at render time for
// any font a PDF names but does not embed. Without them the on-screen
// review-and-sign preview warns "Ensure that the `standardFontDataUrl` API
// parameter is provided" and falls back to a system font, which on most
// machines means the checkbox glyph font (ZapfDingbats) is missing entirely.
// Copy the whole directory, licenses included: it is small, the exact set
// pdf.js may ask for changes between releases, and the LICENSE files are the
// attribution the Foxit and Liberation fonts require.
const fontsSrc = resolve(nm, "pdfjs-dist/standard_fonts");
if (!existsSync(fontsSrc)) {
  throw new Error(
    `Missing vendor source: ${fontsSrc}\nRun \`npm install\` first so pdfjs-dist is present.`,
  );
}
for (const name of readdirSync(fontsSrc)) {
  if (!statSync(resolve(fontsSrc, name)).isFile()) continue;
  copy(resolve(fontsSrc, name), resolve(fontsOut, name));
}

console.log(
  `Vendored tesseract assets into ${out}, zxing into ${zxingOut}, pdf.js fonts into ${fontsOut}`,
);
