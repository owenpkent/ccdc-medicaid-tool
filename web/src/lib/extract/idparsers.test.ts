import { describe, it, expect } from "vitest";
import { parseAamva } from "./aamva";
import { parseMrz } from "./mrz";
import { parseSsnCard } from "./ssncard";
import { parseLicenseFront } from "./dlfront";
import { EXAMPLE_LICENSE_AAMVA } from "../../fixtures/examplePerson";

/* Ported from the CDASS Enroll smoke test (tests/smoke.mjs): the same
 * synthetic fixtures the proven engine ships with, so a port regression in any
 * parser fails loudly here. All data is fictional. */

describe("parseAamva (driver's license barcode)", () => {
  const dl = parseAamva(EXAMPLE_LICENSE_AAMVA);

  it("parses the name", () => {
    expect(dl).toBeTruthy();
    expect(dl?.first).toBe("Jane");
    expect(dl?.middle).toBe("Marie");
    expect(dl?.last).toBe("Doe");
  });

  it("parses a US MMDDCCYY date of birth to ISO", () => {
    expect(dl?.dob).toBe("1986-06-06");
  });

  it("parses the address and trims the +4-less ZIP", () => {
    expect(dl?.street).toBe("1234 Main St");
    expect(dl?.city).toBe("Denver");
    expect(dl?.state).toBe("CO");
    expect(dl?.zip).toBe("80203");
  });

  it("parses the license number, state, and expiration", () => {
    expect(dl?.dlNumber).toBe("123456789");
    expect(dl?.dlState).toBe("CO");
    expect(dl?.dlExpiration).toBe("2030-09-30");
  });

  it("maps the gender code", () => {
    expect(dl?.gender).toBe("female");
  });

  it("rejects text that is not AAMVA data", () => {
    expect(parseAamva("hello world")).toBeNull();
  });
});

describe("parseMrz (passport TD3)", () => {
  // Valid check digits: number 0, dob 2, expiry 7.
  const mrz = parseMrz(
    "\nP<USADOE<<JANE<MARIE<<<<<<<<<<<<<<<<<<<<<<<<\n5400123450USA8606062F3105157<<<<<<<<<<<<<<04\n",
  );

  it("parses the name", () => {
    expect(mrz?.first).toBe("Jane");
    expect(mrz?.last).toBe("Doe");
  });

  it("keeps the passport number when its check digit passes", () => {
    expect(mrz?.passportNumber).toBe("540012345");
    expect(mrz?.passportNumberUnverified).toBeUndefined();
  });

  it("parses the date of birth and expiry with check digits", () => {
    expect(mrz?.dob).toBe("1986-06-06");
    expect(mrz?.passportExpiration).toBe("2031-05-15");
  });

  it("flags a passport number whose check digit fails as unverified", () => {
    const bad = parseMrz(
      "\nP<USADOE<<JANE<MARIE<<<<<<<<<<<<<<<<<<<<<<<<\n5400123459USA8606062F3105157<<<<<<<<<<<<<<04\n",
    );
    expect(bad?.passportNumber).toBeUndefined();
    expect(bad?.passportNumberUnverified).toBe("540012345");
  });

  it("returns null for text with no MRZ lines", () => {
    expect(parseMrz("a letter about Medicaid renewal")).toBeNull();
  });
});

describe("parseSsnCard", () => {
  it("finds the SSN and the printed name", () => {
    const f = parseSsnCard("SOCIAL SECURITY\n123-45-6789\nJane Marie Doe\nSIGNATURE");
    expect(f?.ssn).toBe("123-45-6789");
    expect(f?.first).toBe("Jane");
    expect(f?.middle).toBe("Marie");
    expect(f?.last).toBe("Doe");
  });

  it("tolerates OCR look-alike characters in the number", () => {
    // l reads as 1, O as 0, S as 5.
    const f = parseSsnCard("l23-45-67SO");
    expect(f?.ssn).toBe("123-45-6750");
  });

  it("rejects implausible SSN groupings (never-issued areas)", () => {
    expect(parseSsnCard("666-12-3456")).toBeNull();
    expect(parseSsnCard("000-12-3456")).toBeNull();
  });
});

describe("parseLicenseFront", () => {
  const front = parseLicenseFront(
    [
      "COLORADO DRIVER LICENSE",
      "DOE JANE MARIE",
      "1234 MAIN ST",
      "DENVER CO 80203",
      "DOB 06/06/1986",
      "4b EXP 09/30/2030",
      "4a ISS 09/30/2021",
    ].join("\n"),
  );

  it("takes the labeled DOB over more recent dates", () => {
    expect(front?.dob).toBe("1986-06-06");
  });

  it("finds the address block", () => {
    expect(front?.street).toBe("1234 Main St");
    expect(front?.city).toBe("Denver");
    expect(front?.state).toBe("CO");
    expect(front?.zip).toBe("80203");
  });

  it("returns null when there is no address or date", () => {
    expect(parseLicenseFront("CLASS C\nEYES BRO\nHGT 5-06")).toBeNull();
  });
});
