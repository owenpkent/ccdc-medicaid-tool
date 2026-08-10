/// <reference types="node" />
// Node types are referenced here only (not in tsconfig "types"): this test
// reads the template from disk, but the app itself must never assume Node.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fillPacket2026 } from "./forms/packet2026";
import { blankProfile, blankEmployer, type Profile, type Employer } from "../profile/schema";

/* The exact-copy regression test from CDASS Enroll, as Vitest: fill the real
 * blank template with obviously-fictional data and prove the output is still
 * an exact, editable copy (same pages, same live fields), values landed where
 * the mapping says, and attestation gates hold. All data below is fake. */

// Vitest's root is web/ (the config lives there), so cwd-relative is stable;
// import.meta.url is not a file:// URL under the jsdom transform.
const TEMPLATE_PATH = resolve(process.cwd(), "public/forms/CO-CDASS-Attendant-Packet-2026.pdf");

function sampleProfile(): Profile {
  const p = blankProfile();
  p.first = "Alex";
  p.middle = "J";
  p.last = "Sample";
  p.dob = "1990-01-15";
  p.ssn = "000000000";
  p.street = "123 Example St";
  p.city = "Denver";
  p.state = "CO";
  p.zip = "80200";
  p.county = "Denver";
  p.email = "alex@example.invalid";
  p.cellPhone = "(000) 000-0000";
  p.contactPreference = "email";
  p.relationship = "nonrelative";
  p.relationToEmployer = "none";
  p.fullTimeStudent = true; // adult DOB above: the under-18 box must stay unchecked
  p.citizenship = "citizen";
  p.dlNumber = "X0000000";
  p.dlState = "CO";
  p.dlExpiration = "2030-01-01";
  p.rateStandardCdass = "18";
  return p;
}

function sampleEmployer(): Employer {
  const e = blankEmployer();
  e.memberFirst = "Morgan";
  e.memberLast = "Example";
  e.memberPplId = "M-000000";
  e.employerFirst = "Morgan";
  e.employerLast = "Example";
  return e;
}

let template: Uint8Array;
let blankPages: number;
let blankFieldCount: number;

beforeAll(async () => {
  template = new Uint8Array(readFileSync(TEMPLATE_PATH));
  const doc = await PDFDocument.load(template);
  blankPages = doc.getPageCount();
  blankFieldCount = doc.getForm().getFields().length;
});

describe("fillPacket2026", () => {
  it("fills the real template and stays an exact, editable copy", async () => {
    const out = await fillPacket2026(template, sampleProfile(), sampleEmployer(), {
      signatureDate: "2026-07-01",
      newService: true,
      firstDay: "2026-07-15",
    });

    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(blankPages);
    const form = doc.getForm();
    // Same live field count: nothing flattened, nothing dropped.
    expect(form.getFields().length).toBe(blankFieldCount);

    // Values landed where the mapping says.
    expect(form.getTextField("Attendant Name: first, middle and last").getText()).toBe(
      "Alex J Sample",
    );
    expect(form.getTextField("Attendant Social Security Number").getText()).toBe("000-00-0000");
    expect(form.getTextField("Attendant signature date").getText()).toBe("07/01/2026");
    expect(form.getCheckBox("NonRelative").isChecked()).toBe(true);
    expect(form.getCheckBox("New Service").isChecked()).toBe(true);
    // I-9 (embedded, pages 19-22) filled through the same call.
    expect(form.getTextField("Last Name (Family Name)").getText()).toBe("Sample");
    expect(form.getCheckBox("CB_1").isChecked()).toBe(true);

    // Attestation gate: profile says full-time student, but the box attests
    // "I am under 18" and the date of birth says adult, so it must stay empty.
    expect(
      form.getCheckBox("I am under 18 years old and I am a fulltime student").isChecked(),
    ).toBe(false);
  });

  it("routes payment by paper check when direct deposit is off", async () => {
    const p = sampleProfile();
    p.directDeposit = false;
    const out = await fillPacket2026(template, p, sampleEmployer(), {
      signatureDate: "2026-07-01",
    });

    const form = (await PDFDocument.load(out)).getForm();
    expect(form.getCheckBox("Payment by Paper Check").isChecked()).toBe(true);
    expect(
      form.getCheckBox("Direct Deposit to Bank Account or Third Party Money App").isChecked(),
    ).toBe(false);
    // No routing digits were spread into the per-digit boxes.
    expect(form.getTextField("Routing number 1").getText() ?? "").toBe("");
  });
});
