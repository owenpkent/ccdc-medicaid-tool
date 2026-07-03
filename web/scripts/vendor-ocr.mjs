// Vendor the OCR and barcode runtime assets (tesseract.js worker, WASM cores,
// language data, and the zxing-wasm barcode reader) from node_modules into
// web/public/vendor so the page never fetches them from a CDN at runtime. This
// is what makes the "zero third-party network" privacy promise hold for the
// photo-OCR and document-scan paths: every byte tesseract and zxing need is
// served from our own origin (and cached for offline by the service worker).
//
// The copied files are gitignored. They are reproducible from the pinned
// lockfile, so a fresh clone runs `npm install` then this script (wired into the
// predev/prebuild npm hooks) and gets identical assets.
//
// Run: node scripts/vendor-ocr.mjs
import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const nm = resolve(web, "node_modules");
const out = resolve(web, "public", "vendor", "tesseract");
const tessdataOut = resolve(out, "tessdata");
const zxingOut = resolve(web, "public", "vendor", "zxing");

const force = process.argv.includes("--force");

// Cheap skip: if the assets are already in place, don't recopy ~27 MB on every
// `npm run dev`. Pass --force to refresh after upgrading the OCR packages.
const sentinels = [
  resolve(out, "worker.min.js"),
  resolve(tessdataOut, "eng.traineddata.gz"),
  resolve(zxingOut, "zxing_reader.wasm"),
];
if (!force && sentinels.every((f) => existsSync(f))) {
  console.log("tesseract assets already vendored (pass --force to refresh)");
  process.exit(0);
}

// Fresh each run so a removed/renamed upstream file never lingers.
rmSync(out, { recursive: true, force: true });
rmSync(zxingOut, { recursive: true, force: true });
mkdirSync(tessdataOut, { recursive: true });
mkdirSync(zxingOut, { recursive: true });

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

console.log(`Vendored tesseract assets into ${out} and zxing into ${zxingOut}`);
