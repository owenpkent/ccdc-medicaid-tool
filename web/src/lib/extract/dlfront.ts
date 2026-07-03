/* Best-effort extraction from OCR of the FRONT of a US driver's license.
 * License fronts are not standardized across states, so this is heuristic and
 * every value must be verified. It pulls the date of birth and the address; the
 * name is read more reliably from the Social Security card and is left to that.
 *
 * Ported from CDASS Enroll (src/extract/dlfront.js).
 */
import { titleCase, type IdFields } from "./aamva";

export function parseLicenseFront(ocrText: string): IdFields | null {
  const out: Record<string, string> = {};
  const lines = ocrText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Date of birth: the earliest plausible date on the card. Issue and expiry
  // dates are more recent, so the oldest is the birth date; a line that says
  // DOB/BIRTH wins outright.
  const dates: Array<{ iso: string; yy: number; labeled: boolean }> = [];
  for (const line of lines) {
    for (const m of line.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/g)) {
      const mm = +(m[1] as string);
      const dd = +(m[2] as string);
      const yy = +(m[3] as string);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900 || yy > 2100) continue;
      dates.push({ iso: `${yy}-${pad(mm)}-${pad(dd)}`, yy, labeled: /DOB|BIRTH/i.test(line) });
    }
  }
  if (dates.length) {
    const labeled = dates.find((d) => d.labeled);
    out.dob = (labeled ?? dates.reduce((a, b) => (b.yy < a.yy ? b : a))).iso;
  }

  // Address: find the "City ST 12345" line; the numbered line just above it is
  // the street.
  for (let i = 1; i < lines.length; i++) {
    const m = (lines[i] as string).match(/^(.*?)[, ]+([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/);
    const city = m && (m[1] as string).replace(/[^A-Za-z .'-]/g, "").trim();
    if (m && city) {
      out.city = titleCase(city);
      out.state = m[2] as string;
      out.zip = m[3] as string;
      if (/\d/.test(lines[i - 1] as string)) out.street = titleCase(lines[i - 1]);
      break;
    }
  }

  return Object.keys(out).length ? (out as IdFields) : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
