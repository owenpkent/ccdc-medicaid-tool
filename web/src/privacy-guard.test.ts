/// <reference types="node" />
// Node types referenced here only: this test scans the source tree.
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, it, expect } from "vitest";

/* Privacy guard: docs/privacy.md promises that nothing persists by default and
 * that all storage goes through ONE audited module (lib/archive.ts). Promises
 * rot; this test does not. It fails the suite the moment any source file uses
 * a browser storage API outside the audited module, or anything other than the
 * explicit save button calls saveArchive. */

const SRC = resolve(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const sourceFiles = walk(SRC)
  .map((f) => f.replace(/\\/g, "/"))
  .filter(
    (f) =>
      /\.(ts|tsx)$/.test(f) &&
      !/\.test\.[tj]sx?$/.test(f) &&
      !f.endsWith("/test-setup.ts") &&
      !f.endsWith("/test-utils.tsx"),
  );

describe("privacy guard (nothing persists by default)", () => {
  it("scans a plausible number of source files", () => {
    // If the walk breaks, the checks below would pass vacuously.
    expect(sourceFiles.length).toBeGreaterThan(20);
  });

  it("uses no browser storage API outside the audited archive module", () => {
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      const code = readFileSync(f, "utf8");
      const isArchive = f.endsWith("lib/archive.ts");
      if (/\b(localStorage|sessionStorage)\s*[.[]/.test(code))
        offenders.push(`${f}: localStorage/sessionStorage`);
      if (/document\.cookie/.test(code)) offenders.push(`${f}: document.cookie`);
      if (!isArchive && /\bindexedDB\b/.test(code))
        offenders.push(`${f}: indexedDB outside lib/archive.ts`);
      if (/\bcaches\s*\.\s*open\b/.test(code)) offenders.push(`${f}: CacheStorage`);
    }
    expect(offenders).toEqual([]);
  });

  it("lets only the explicit save button call saveArchive", () => {
    const callers = sourceFiles.filter((f) => {
      const code = readFileSync(f, "utf8");
      return /\bsaveArchive\s*\(/.test(code);
    });
    // The module itself (declaration) and the one explicit user action.
    expect(callers.sort()).toEqual(
      sourceFiles
        .filter((f) => f.endsWith("lib/archive.ts") || f.endsWith("components/FormFill.tsx"))
        .sort(),
    );
  });

  it("keeps tesseract's model cache disabled", () => {
    // Both tesseract entry points: the read side's OCR and the fill flow's
    // document scanner.
    for (const name of ["lib/ocr.ts", "lib/extract/scanner.ts"]) {
      const f = sourceFiles.find((p) => p.endsWith(name));
      expect(f, name).toBeTruthy();
      expect(readFileSync(f as string, "utf8")).toMatch(/cacheMethod:\s*"none"/);
    }
  });
});
