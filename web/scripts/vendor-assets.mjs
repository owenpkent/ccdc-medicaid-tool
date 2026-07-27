// Where the vendored decode assets live, and the one place that decides it.
//
// scripts/vendor-ocr.mjs copies the bytes to these paths; vite.config.ts injects
// the same paths into the app bundle so the URLs the browser requests always
// point at the bytes that were copied for THAT build.
//
// Why the paths carry a version: the service worker runtime-caches everything
// under /vendor/ CacheFirst for 90 days (vite.config.ts). At a constant URL like
// /vendor/zxing/zxing_reader.wasm, a returning user who scanned anything in the
// last 90 days keeps the OLD wasm binary after we upgrade the package, and the
// new JavaScript glue then drives it into "RuntimeError: memory access out of
// bounds". Moving the bytes to a new URL on every upgrade makes a stale hit
// impossible: the new build asks for a URL that was never cached.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const nm = resolve(web, "node_modules");

// Every package whose bytes end up in the directory. The whole set feeds the
// directory name, not just the headline package: tesseract.js-core or a language
// model can be bumped without tesseract.js moving, and that still changes the
// bytes we serve.
const TESSERACT_PACKAGES = [
  "tesseract.js",
  "tesseract.js-core",
  "@tesseract.js-data/eng",
  "@tesseract.js-data/spa",
];
const ZXING_PACKAGES = ["zxing-wasm"];

function installedVersion(pkg) {
  const file = resolve(nm, pkg, "package.json");
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new Error(`Cannot read ${file}.\nRun \`npm install\` in web/ first.`);
  }
  const version = JSON.parse(raw).version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`No version field in ${file}.`);
  }
  return version;
}

// One path segment that changes whenever any contributing package changes.
// Shape: "<headline version>-<8 hex of the whole version set>". The version is
// there so a human reading a network log or a cache entry can tell what it is;
// the digest is what catches a moving package the version does not mention.
function tag(packages) {
  const pinned = packages.map((p) => `${p}@${installedVersion(p)}`);
  const digest = createHash("sha256").update(pinned.join(";")).digest("hex").slice(0, 8);
  // Semver build metadata ("+build") is not URL-path friendly; keep it readable.
  const headline = installedVersion(packages[0]).replace(/[^A-Za-z0-9.-]/g, "-");
  return `${headline}-${digest}`;
}

/**
 * Base-relative paths (no leading slash, no trailing slash) of the vendored
 * asset directories. The copier joins these onto web/public; the app joins them
 * onto import.meta.env.BASE_URL. Deriving both from this function is what keeps
 * "what we wrote" and "what we request" from drifting apart.
 *
 * @returns {{ tesseract: string, zxing: string }}
 */
export function vendorPaths() {
  return {
    tesseract: `vendor/tesseract/${tag(TESSERACT_PACKAGES)}`,
    zxing: `vendor/zxing/${tag(ZXING_PACKAGES)}`,
  };
}
