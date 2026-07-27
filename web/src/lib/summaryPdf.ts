/* One-page printable summary (optional output).
 *
 * Builds a small PDF the reader can save, print, or hand to a family member or
 * advocate. pdf-lib is dynamically imported so it only enters the bundle when a
 * summary is actually generated. Everything is built and downloaded locally; no
 * upload, consistent with the rest of the tool.
 *
 * Helvetica (WinAnsi) covers English and Spanish text, including accented
 * characters and inverted punctuation. We sanitize a few "smart" punctuation
 * marks to their plain equivalents to stay safely within that encoding.
 */
import type { PDFFont } from "pdf-lib";
// Static, unlike pdf-lib above: the download helper is a few lines with no
// dependencies of its own, and the fill flow already imports it statically, so
// a dynamic import here cannot split it into its own chunk. It would only earn
// a bundler warning.
import { downloadPdfBytes } from "./download";
import type { LetterClassification } from "./rules";

export interface SummaryStrings {
  title: string;
  typeHeading: string;
  deadlineHeading: string;
  meaningHeading: string;
  doNothingHeading: string;
  actionsHeading: string;
  disclaimer: string;
  /** Pre-formatted deadline line (date + days, or the "check the letter" note). */
  deadlineText: string;
  /** "Translation pending review" note; included only when set (unreviewed Spanish). */
  translationPending?: string;
}

function sanitize(s: string): string {
  return s
    .replace(/…/g, "...")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildSummaryPdf(
  c: LetterClassification,
  s: SummaryStrings,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 54;
  const maxWidth = 612 - margin * 2;
  const navy = rgb(0.1, 0.21, 0.36);
  const ink = rgb(0.06, 0.09, 0.16);
  const gray = rgb(0.28, 0.33, 0.41);
  let y = 792 - margin;

  const draw = (text: string, f: PDFFont, size: number, color = ink, lead = 1.35) => {
    for (const line of wrap(text, f, size, maxWidth)) {
      if (y < margin + size) return; // one page only; stop if we run out of room
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= size * lead;
    }
  };
  const gap = (n: number) => {
    y -= n;
  };
  const heading = (text: string) => {
    gap(8);
    draw(text, bold, 12, navy);
    gap(1);
  };

  draw(s.title, bold, 18, navy);
  gap(6);

  // Honesty caveat for unreviewed Spanish, kept near the top since a reader may
  // only glance at the first lines before handing the page to someone else.
  if (s.translationPending) {
    draw(s.translationPending, font, 9, gray);
    gap(4);
  }

  heading(s.typeHeading);
  draw(c.label, font, 12);

  heading(s.deadlineHeading);
  draw(s.deadlineText, font, 12);

  heading(s.meaningHeading);
  draw(c.plainLanguageSummary, font, 11);

  heading(s.doNothingHeading);
  draw(c.doNothingConsequence, font, 11);

  heading(s.actionsHeading);
  for (const a of c.nextActions) {
    draw(`- ${a.label}: ${a.detail}`, font, 11);
    gap(2);
  }

  // Disclaimer, anchored toward the bottom.
  y = Math.min(y, margin + 60);
  gap(10);
  draw(s.disclaimer, font, 9, gray);

  return doc.save();
}

/** Build and trigger a local download of the one-page summary. */
export async function downloadSummaryPdf(
  c: LetterClassification,
  s: SummaryStrings,
  fileName = "coverage-compass-summary.pdf",
): Promise<void> {
  const bytes = await buildSummaryPdf(c, s);
  downloadPdfBytes(bytes, fileName);
}
