/// <reference types="node" />
// Node types referenced here only: this test reads barcode images, and the
// decoder's own wasm, from disk.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { readBarcodes, prepareZXingModule } from "zxing-wasm/reader";
import { parseAamva, AAMVA_READ_OPTIONS } from "./aamva";
import { EXAMPLE_LICENSE_AAMVA } from "../../fixtures/examplePerson";

/* Decode -> parse, end to end, on real PDF417 images.
 *
 * idparsers.test.ts feeds parseAamva hand-written text with real newlines, and
 * the decoder is exercised nowhere. That gap is exactly where two shipped bugs
 * lived: both halves were correct in isolation and the seam between them was
 * not covered, so a scan that decoded perfectly still filled one junk field.
 * These tests own that seam. All data is fictional (Jane Doe).
 */

/* Hand zxing its wasm off the local disk, before anything here decodes.
 *
 * Skip this and zxing falls through to its default locateFile, which returns
 * https://fastly.jsdelivr.net/npm/zxing-wasm@<version>/dist/reader/zxing_reader.wasm.
 * Three things are wrong with that. It makes `npm test` download from a
 * third-party CDN in a project whose headline invariant is that nothing ever
 * leaves this machine. It breaks offline and air-gapped CI, where the suite
 * aborts with "both async and sync fetching of the wasm failed". And it means
 * these tests decode whatever jsDelivr serves rather than the binary the app
 * actually ships, so their passing says nothing about the vendored asset.
 *
 * `wasmBinary` (raw bytes) rather than a `locateFile` override, because it
 * sidesteps URL resolution entirely: emscripten compiles the bytes it is handed
 * and never asks fetch or XHR for anything. A file:// URL would still have to
 * survive jsdom's fetch, which does not serve local files.
 *
 * The bytes come from node_modules, not from public/vendor/zxing. Both hold the
 * same file (scripts/vendor-ocr.mjs copies one to the other), but `pretest` runs
 * only `gen:rules`, never `vendor:ocr`, and public/vendor is gitignored, so on a
 * fresh clone or a test-only CI job it does not exist. node_modules is there the
 * moment `npm install` finishes. Resolved through the package's own
 * "./reader/zxing_reader.wasm" export rather than a hand-written dist path, so a
 * hoisted or pnpm-shaped tree still finds it.
 */
const ZXING_READER_WASM = createRequire(import.meta.url).resolve(
  "zxing-wasm/reader/zxing_reader.wasm",
);

function readerWasm(): ArrayBuffer {
  // Copied into a standalone ArrayBuffer. readFileSync hands back a Buffer that
  // may be a view into a larger pooled allocation, and `.buffer` on that is the
  // pool, not the file.
  const file = readFileSync(ZXING_READER_WASM);
  const bytes = new ArrayBuffer(file.byteLength);
  new Uint8Array(bytes).set(file);
  return bytes;
}

prepareZXingModule({ overrides: { wasmBinary: readerWasm() } });

/* Nothing in this file may reach the network, and this is what enforces it.
 *
 * The one line above is easy to lose in a refactor, and losing it is silent on
 * any machine that has network: jsDelivr answers, every test below still passes,
 * and the suite quietly goes back to decoding a downloaded binary instead of the
 * one we ship. Only an offline machine would notice, which is not where these
 * tests usually run.
 *
 * So fetch is refused for the whole file rather than inside a single test. That
 * makes the wiring above load bearing everywhere: drop it and every decode here
 * fails, on a laptop and in CI alike, instead of failing only where nobody is
 * looking. It records as well as refuses, so the guard at the end of the file
 * can name the URL that was reached for rather than leaving the next reader with
 * emscripten's "both async and sync fetching of the wasm failed".
 *
 * A plain assignment, not vi.stubGlobal: a stub is undone by the `unstubGlobals`
 * config flag, and a guard a config flag can switch off is not a guard. Vitest
 * isolates module state per file, so this reaches no other suite.
 */
const networkAttempts: string[] = [];
globalThis.fetch = ((input: unknown) => {
  const url =
    typeof input === "string"
      ? input
      : String((input as { url?: string }).url ?? input);
  networkAttempts.push(url);
  return Promise.reject(
    new Error(`barcode.test.ts refused a network request: ${url}`),
  );
}) as unknown as typeof fetch;

const dl = () =>
  readFileSync(
    resolve(process.cwd(), "public/examples/example-license-barcode.png"),
  );
const stateId = () =>
  readFileSync(resolve(process.cwd(), "src/fixtures/state-id-barcode.png"));

// Bytes, not a Blob: jsdom's Blob has no arrayBuffer(), and readBarcodes takes
// a Uint8Array just as happily. The app passes a real browser Blob.
async function decode(
  png: Buffer,
  options = AAMVA_READ_OPTIONS,
): Promise<string> {
  const results = await readBarcodes(new Uint8Array(png), options);
  const hit = results.find((r) => r.isValid && r.text);
  return hit?.text ?? "";
}

describe("license barcode decode -> parse", () => {
  it("decodes the committed example barcode the demo scans", async () => {
    expect(await decode(dl())).toContain("ANSI ");
  });

  /* The committed PNG is generated from EXAMPLE_LICENSE_AAMVA by
   * `npm run gen:example-barcode`. Asserting the round trip keeps the image and
   * the payload it claims to encode from drifting apart, which is the failure a
   * hand-made image invites. */
  it("round-trips to exactly the payload it is generated from", async () => {
    expect(await decode(dl())).toBe(EXAMPLE_LICENSE_AAMVA);
  });

  /* A real card's symbol is Binary content, not Text: AAMVA D.12.3 fixes the
   * first four characters as "@", LF, RS, CR, and those non-printables are what
   * zxing classifies on. The distinction decides whether the HRI escaping below
   * bites, so a sample that is merely Text would not represent a real card. */
  it("is Binary content, like a real card", async () => {
    const results = await readBarcodes(
      new Uint8Array(dl()),
      AAMVA_READ_OPTIONS,
    );
    expect(results.find((r) => r.isValid)?.contentType).toBe("Binary");
  });

  it("fills every field, not one junk field", async () => {
    const f = parseAamva(await decode(dl()));
    expect(f?.first).toBe("Jane");
    expect(f?.last).toBe("Doe");
    expect(f?.dob).toBe("1986-06-06");
    expect(f?.street).toBe("1234 Main St");
    expect(f?.city).toBe("Denver");
    expect(f?.state).toBe("CO");
    expect(f?.zip).toBe("80203");
    expect(f?.dlNumber).toBe("123456789");
    expect(f?.dlExpiration).toBe("2030-09-30");
  });

  /* zxing's default textMode is "HRI", which renders control characters as
   * literal placeholders, so AAMVA's LF separators arrive as the four
   * characters "<LF>", the payload collapses onto one line, and every element
   * after the first is swallowed into the first one's value. */
  it("reads with textMode Plain, because the zxing default breaks AAMVA", async () => {
    expect(AAMVA_READ_OPTIONS.textMode).toBe("Plain");

    const plain = await decode(dl());
    expect(plain).toContain("\n");

    const hri = await decode(dl(), { ...AAMVA_READ_OPTIONS, textMode: "HRI" });
    expect(hri).not.toContain("\n");
    expect(Object.keys(parseAamva(hri) ?? {})).toHaveLength(1);
  });
});

/* A state ID card, not a driver's license. Per AAMVA D.12.4 its subfile type is
 * "ID", so the payload reads "IDDAQ..." and "DDA" (a valid element ID) starts
 * one character early. Matching element IDs at arbitrary offsets lets that
 * phantom DDA swallow the ID number, since a value runs to end of line. Every
 * state ID in the country hits this; a DL fixture alone cannot see it. */
describe("state ID card (subfile type ID)", () => {
  it("decodes", async () => {
    expect(await decode(stateId())).toContain("ANSI ");
  });

  it("keeps its ID number through the IDDAQ / phantom-DDA trap", async () => {
    const f = parseAamva(await decode(stateId()));
    expect(f?.dlNumber).toBe("123456789");
    expect(f?.last).toBe("Doe");
    expect(f?.dob).toBe("1986-06-06");
  });

  it("does not invent a DDA element from the subfile marker", async () => {
    const f = parseAamva(await decode(stateId()));
    expect(f).not.toHaveProperty("DDA");
    expect(f?.city).toBe("Denver");
    expect(f?.state).toBe("CO");
  });
});

/* Last, so it sees every decode above, and self-sufficient, so it still means
 * something when run alone with -t: the decode it does is itself the one that
 * instantiates the module when this test runs by itself. */
describe("wasm load path", () => {
  it("decodes without ever reaching for the network", async () => {
    expect(await decode(dl())).toContain("ANSI ");
    expect(networkAttempts).toEqual([]);
  });
});
