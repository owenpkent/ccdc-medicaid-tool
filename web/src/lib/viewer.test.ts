import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";

import { stampSignatures } from "./viewer";

// A minimal 1x1 transparent PNG.
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function blankPdf(width = 200, height = 300): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);
  return doc.save();
}

describe("stampSignatures", () => {
  it("returns the input unchanged when there are no signatures", async () => {
    const bytes = await blankPdf();
    expect(await stampSignatures(bytes, [])).toBe(bytes);
  });

  it("stamps a signature and keeps a valid, still-loadable PDF", async () => {
    const bytes = await blankPdf();
    const out = await stampSignatures(bytes, [
      { page: 1, dataUrl: PNG_1x1, x: 0.1, y: 0.8, w: 0.3, h: 0.1 },
    ]);

    expect(out.length).toBeGreaterThan(0);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
