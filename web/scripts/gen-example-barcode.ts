/* Regenerates the demo license barcode: public/examples/example-license-barcode.png
 *
 *   npm run gen:example-barcode
 *
 * The image is committed (the "scan the example ID" demo fetches it at runtime,
 * and there is no network), but it is generated, never hand-made, so it cannot
 * drift from the payload it claims to encode. EXAMPLE_LICENSE_AAMVA in
 * src/fixtures/examplePerson.ts is the single source of truth; this script only
 * renders it, and barcode.test.ts asserts the committed PNG still decodes back
 * to exactly that string.
 *
 * Written with zxing-wasm, the same library that reads it back, so no extra
 * dependency and no toolchain outside npm. Run through vite-node so the payload
 * can be imported from TypeScript rather than duplicated here.
 *
 * The payload is passed as bytes, not as a string. It contains the control
 * characters AAMVA D.12.3 requires (LF, RS, CR), and those must survive
 * encoding intact: they are what make a real card's symbol Binary content,
 * which is the whole reason the reader pins textMode "Plain".
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeBarcode } from "zxing-wasm/writer";
import { EXAMPLE_LICENSE_AAMVA } from "../src/fixtures/examplePerson";

const OUT = resolve(
  process.cwd(),
  "public/examples/example-license-barcode.png",
);

const bytes = Uint8Array.from(EXAMPLE_LICENSE_AAMVA, (c) => c.charCodeAt(0));
const { image, error } = await writeBarcode(bytes, {
  format: "PDF417",
  // Roughly a card's aspect: wide and short, like the real thing.
  scale: 3,
  withQuietZones: true,
});

if (error || !image)
  throw new Error(`could not write the barcode: ${error ?? "no image"}`);

writeFileSync(OUT, new Uint8Array(await image.arrayBuffer()));
console.log(
  `wrote ${OUT} (${EXAMPLE_LICENSE_AAMVA.length} chars of AAMVA payload)`,
);
