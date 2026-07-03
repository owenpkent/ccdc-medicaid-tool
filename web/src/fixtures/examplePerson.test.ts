import { describe, it, expect } from "vitest";
import {
  EXAMPLE_PERSON_PROFILE,
  EXAMPLE_PERSON_EMPLOYER,
  EXAMPLE_LICENSE_AAMVA,
} from "./examplePerson";
import { blankProfile, blankEmployer } from "../lib/profile/schema";
import { parseAamva } from "../lib/extract/aamva";

describe("example person fixture", () => {
  it("uses only keys that exist in the profile schema", () => {
    const known = new Set(Object.keys(blankProfile()));
    for (const key of Object.keys(EXAMPLE_PERSON_PROFILE)) {
      expect(known.has(key), `unknown profile key: ${key}`).toBe(true);
    }
  });

  it("uses only keys that exist in the employer schema", () => {
    const known = new Set(Object.keys(blankEmployer()));
    for (const key of Object.keys(EXAMPLE_PERSON_EMPLOYER)) {
      expect(known.has(key), `unknown employer key: ${key}`).toBe(true);
    }
  });

  it("stays unmistakably fictional", () => {
    // The canonical fake SSN, a reserved-for-fiction phone, an example.com email.
    expect(EXAMPLE_PERSON_PROFILE.ssn).toBe("123-45-6789");
    expect(EXAMPLE_PERSON_PROFILE.cellPhone).toMatch(/555-01\d\d$/);
    expect(EXAMPLE_PERSON_PROFILE.email).toMatch(/@example\.com$/);
  });

  it("never fabricates a signature", () => {
    expect(EXAMPLE_PERSON_EMPLOYER).not.toHaveProperty("signature");
  });

  it("keeps the sample barcode payload in sync with the example person", () => {
    // The committed example-license-barcode.png encodes EXAMPLE_LICENSE_AAMVA;
    // this pins the payload to the same fictional identity the demo shows.
    const dl = parseAamva(EXAMPLE_LICENSE_AAMVA);
    expect(dl?.first).toBe(EXAMPLE_PERSON_PROFILE.first);
    expect(dl?.last).toBe(EXAMPLE_PERSON_PROFILE.last);
    expect(dl?.dob).toBe(EXAMPLE_PERSON_PROFILE.dob);
    expect(dl?.dlNumber).toBe(EXAMPLE_PERSON_PROFILE.dlNumber);
  });
});
