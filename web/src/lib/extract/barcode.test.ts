/// <reference types="node" />
// Node types referenced here only: this test reads barcode images from disk.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { readBarcodes } from "zxing-wasm/reader";
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
