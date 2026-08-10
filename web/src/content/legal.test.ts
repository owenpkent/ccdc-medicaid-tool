import { describe, it, expect } from "vitest";
import { TERMS, PRIVACY, type LegalDoc } from "./legal";
import { CCDC_PHONE } from "../lib/rules";

/* Guards for the legal documents: full bilingual parity, the load-bearing
 * waiver clause staying present in both languages, and phone-number
 * consistency with the rest of the app. */

const DOCS: Array<[string, LegalDoc]> = [
  ["Terms of Use", TERMS],
  ["Privacy Notice", PRIVACY],
];

function allStrings(doc: LegalDoc): Array<{ where: string; en: string; es?: string }> {
  const out = [
    { where: "title", ...doc.title },
    { where: "intro", ...doc.intro },
  ];
  doc.sections.forEach((s, i) => {
    out.push({ where: `section ${i} heading`, ...s.heading });
    s.paragraphs.forEach((p, j) => out.push({ where: `section ${i} paragraph ${j}`, ...p }));
  });
  return out;
}

describe.each(DOCS)("%s", (_name, doc) => {
  it("has sections and a real ISO updated date", () => {
    expect(doc.sections.length).toBeGreaterThan(0);
    expect(doc.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has non-empty English and Spanish for every string", () => {
    for (const s of allStrings(doc)) {
      expect(s.en.trim(), `${s.where} (en)`).not.toBe("");
      expect((s.es ?? "").trim(), `${s.where} (es)`).not.toBe("");
    }
  });

  it("only ever names the canonical CCDC phone number", () => {
    for (const s of allStrings(doc)) {
      for (const text of [s.en, s.es ?? ""]) {
        for (const phone of text.match(/\(\d{3}\) \d{3}-\d{4}/g) ?? []) {
          expect(phone, s.where).toBe(CCDC_PHONE);
        }
      }
    }
  });
});

describe("Terms of Use waiver clause", () => {
  it("keeps the maximum-permitted-by-law release in both languages", () => {
    const flat = allStrings(TERMS);
    expect(flat.some((s) => /fullest extent permitted by law/i.test(s.en))).toBe(true);
    expect(flat.some((s) => /m[áa]xima medida permitida por la ley/i.test(s.es ?? ""))).toBe(true);
  });

  it("disclaims warranties and caps liability at zero", () => {
    const enText = allStrings(TERMS)
      .map((s) => s.en)
      .join(" ");
    expect(enText).toMatch(/"as is"/i);
    expect(enText).toMatch(/zero dollars \(\$0\)/i);
  });
});
