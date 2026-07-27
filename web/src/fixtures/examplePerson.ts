/* A clearly-fictional example person for demonstrating the fill flow without
 * typing dozens of fields or handling anyone's real documents. Same demo
 * discipline as fixtures/exampleLetters.ts: everything here is made up, and
 * the fictional markers are load-bearing (SSN 123-45-6789 is the canonical
 * fake, the phone is in the reserved 555-01xx fiction range, the email is on
 * example.com). Loading it never touches storage; it only fills the on-screen
 * form, and the check-every-answer review still stands before any PDF.
 */
import type { Profile, Employer } from "../lib/profile/schema";

export const EXAMPLE_PERSON_PROFILE: Partial<Profile> = {
  first: "Jane",
  middle: "Marie",
  last: "Doe",
  dob: "1986-06-06",
  ssn: "123-45-6789",
  gender: "female",
  street: "1234 Main St",
  city: "Denver",
  state: "CO",
  zip: "80203",
  county: "Denver",
  email: "jane.doe@example.com",
  cellPhone: "303-555-0123",
  allowText: "yes",
  contactPreference: "email",
  primaryLanguage: "English",
  directDeposit: true,
  accountType: "checking",
  bankName: "Example Bank",
  routing: "123456789",
  account: "000123456789",
  directoryOptIn: "no",
  relationship: "nonrelative",
  liveIn: "doesNotLive",
  relationToEmployer: "none",
  primaryJob: true,
  rateStandardCdass: "18",
  rateEmergencyCdass: "45",
  citizenship: "citizen",
  dlNumber: "123456789",
  dlState: "CO",
  dlExpiration: "2030-09-30",
};

export const EXAMPLE_PERSON_EMPLOYER: Partial<Employer> = {
  memberFirst: "Riley",
  memberLast: "Roe",
  memberPplId: "1234567",
  memberMedicaidId: "A123456",
  employerFirst: "Riley",
  employerLast: "Roe",
  employerTitle: "Employer",
  // The signature is deliberately absent: signatures are never fabricated.
};

/* The AAMVA payload encoded in the committed sample barcode image
 * (public/examples/example-license-barcode.png), which the "scan the example
 * ID" demo feeds through the real PDF417 decode path. Same fictional Jane Doe
 * as above.
 *
 * This is the single source of truth for that image: `npm run gen:example-barcode`
 * regenerates the PNG from it, and barcode.test.ts asserts the committed PNG
 * still decodes to exactly this string, so the two cannot drift apart.
 *
 * The header must stay byte-exact, and the control characters are the reason.
 * AAMVA D.12.3 fixes the first four characters of every compliant symbol as
 * "@", LF, RS (0x1e), CR (0x0d), and those non-printables are what make zxing
 * classify the payload as Binary rather than Text. Only Binary content gets
 * escaped under zxing's default "HRI" text mode, which is precisely the bug
 * AAMVA_READ_OPTIONS exists to avoid. A sample without them decodes as Text,
 * hides that whole class of bug, and stops representing a real card. */
export const EXAMPLE_LICENSE_AAMVA = [
  // "@" LF RS CR "ANSI ": D.12.3 fixes the first four characters, and the
  // non-printables are what make zxing classify the payload as Binary.
  "@\n\x1e\rANSI 636020090002DL00410278ZC03190008DLDAQ123456789",
  "DCSDOE",
  "DACJANE",
  "DADMARIE",
  "DBD08242015",
  "DBB06061986",
  "DBA09302030",
  "DBC2",
  "DAU068 in",
  "DAG1234 MAIN ST",
  "DAIDENVER",
  "DAJCO",
  "DAK802030000  ",
].join("\n");
