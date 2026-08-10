/* Carry-forward import: read a previously filled CDASS/PPL Attendant Packet
 * (2026) and recover the typed answers into the profile.
 *
 * This is the reverse of lib/fill/forms/packet2026.ts. It only works for
 * forms filled digitally (the typed values live in the PDF's AcroForm); a
 * printed-and-handwritten or scanned copy has no field values to read, and
 * the caller should say so honestly rather than guess.
 *
 * Everything recovered is a *suggestion*: the UI must route the result
 * through the check-every-answer review, never straight to generate.
 *
 * pdf-lib is imported dynamically, like everywhere else in the fill layer,
 * so it stays in its own lazy chunk.
 */
import type { PDFForm } from "pdf-lib";
import type { Profile, Employer } from "../profile/schema";

export interface PacketImport {
  profile: Partial<Profile>;
  employer: Partial<Employer>;
  /** How many values were recovered. Below ~3 the PDF is probably not this form. */
  count: number;
}

/* Tolerant readers: a missing or renamed field reads as empty, never throws. */

function text(form: PDFForm, name: string): string {
  try {
    return form.getTextField(name).getText()?.trim() ?? "";
  } catch {
    return "";
  }
}

function checked(form: PDFForm, name: string): boolean {
  try {
    return form.getCheckBox(name).isChecked();
  } catch {
    return false;
  }
}

/** "06/30/2026" -> "2026-06-30"; anything else passes through unchanged. */
function isoFromDate(us: string): string {
  const m = us.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return us;
  return `${m[3]}-${(m[1] ?? "").padStart(2, "0")}-${(m[2] ?? "").padStart(2, "0")}`;
}

function digits(v: string): string {
  return v.replace(/\D/g, "");
}

/** Rejoin per-digit boxes "<prefix> 1".."<prefix> N". */
function joinDigits(form: PDFForm, prefix: string, count: number): string {
  let out = "";
  for (let i = 1; i <= count; i++) out += text(form, `${prefix} ${i}`);
  return out;
}

/** "Morgan Example" -> ["Morgan", "Example"]; middle words join the last name's left side. */
function splitFirstLast(full: string): [string, string] {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0] ?? "", ""];
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

function put<T extends object>(target: Partial<T>, key: keyof T, value: string | boolean): number {
  if (value === "" || value === false) return 0;
  (target as Record<string, string | boolean>)[key as string] = value;
  return 1;
}

export async function importPacket2026(bytes: ArrayBuffer | Uint8Array): Promise<PacketImport> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const form = doc.getForm();

  const p: Partial<Profile> = {};
  const emp: Partial<Employer> = {};
  let n = 0;

  // ---- Name: prefer the I-9's split fields; fall back to splitting the
  // packet's combined name field.
  const i9First = text(form, "First Name Given Name");
  const i9Last = text(form, "Last Name (Family Name)");
  if (i9First || i9Last) {
    n += put(p, "first", i9First);
    n += put(p, "last", i9Last);
    n += put(p, "middle", text(form, "Employee Middle Initial (if any)"));
  } else {
    const full = text(form, "Attendant Name: first, middle and last");
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      n += put(p, "first", parts[0] ?? "");
      n += put(p, "last", parts[parts.length - 1] ?? "");
      n += put(p, "middle", parts.slice(1, -1).join(" "));
    } else {
      n += put(p, "first", full);
    }
  }
  n += put(p, "maidenOrPrevious", text(form, "Attendant maiden or previous name"));
  n += put(p, "dob", isoFromDate(text(form, "Attendant date of birth")));
  n += put(p, "ssn", digits(text(form, "Attendant Social Security Number")));

  // ---- Address and contact ----
  n += put(p, "street", text(form, "Attendant physical address, not PO Box"));
  n += put(p, "street2", text(form, "Attendant physical address 2 Apt Ste or other"));
  n += put(p, "city", text(form, "Attendant physical address city"));
  n += put(p, "state", text(form, "Attendant physical address State"));
  n += put(p, "zip", text(form, "Attendant physical address Zip Code"));
  n += put(p, "county", text(form, "Attendant physical address county"));

  const mailStreet = text(form, "Attendant mailing address not PO Box");
  if (
    checked(form, "Check the box if the address where you live is the same as your mailing address")
  ) {
    p.mailingSame = true;
  } else if (mailStreet) {
    p.mailingSame = false;
    n += put(p, "mailStreet", mailStreet);
    n += put(p, "mailStreet2", text(form, "Attendant mailing address 2 Apt Ste or other"));
    n += put(p, "mailCity", text(form, "Attendant mailing address city"));
    n += put(p, "mailState", text(form, "Attendant mailing address State"));
    n += put(p, "mailZip", text(form, "Attendant mailing address Zip Code"));
  }

  n += put(p, "email", text(form, "Attendant email"));
  n += put(p, "cellPhone", text(form, "Attendant cell phone"));
  n += put(p, "otherPhone", text(form, "Attendant home or other phone"));
  n += put(p, "primaryLanguage", text(form, "Attendant primary language"));
  n += put(p, "bestContactTimes", text(form, "Best contact times for the attendant"));
  if (checked(form, "The attendant prefers to be contacted by email"))
    n += put(p, "contactPreference", "email");
  else if (checked(form, "The attendant prefers to be contacted by cell phone"))
    n += put(p, "contactPreference", "cell");
  else if (checked(form, "The attendant prefers to be contacted by home phone"))
    n += put(p, "contactPreference", "home");
  else if (checked(form, "The attendant prefers to be contacted by mail"))
    n += put(p, "contactPreference", "mail");
  if (checked(form, "Do you want PPL to text you: Yes")) n += put(p, "allowText", "yes");
  else if (checked(form, "Do you want PPL to text you: No")) n += put(p, "allowText", "no");

  // ---- Relationship to the Member ----
  if (checked(form, "Spouse")) n += put(p, "relationship", "spouse");
  else if (checked(form, "Parent")) n += put(p, "relationship", "parent");
  else if (checked(form, "Other Relative")) n += put(p, "relationship", "relative");
  else if (checked(form, "NonRelative")) n += put(p, "relationship", "nonrelative");

  // ---- Payment ----
  if (checked(form, "Direct Deposit to Bank Account or Third Party Money App")) {
    p.directDeposit = true;
    if (checked(form, "Checking Account")) n += put(p, "accountType", "checking");
    else if (checked(form, "Savings Account")) n += put(p, "accountType", "savings");
    n += put(p, "bankName", text(form, "Bank or money app name"));
    n += put(p, "routing", joinDigits(form, "Routing number", 9));
    n += put(p, "account", joinDigits(form, "Account number", 13));
  } else if (checked(form, "Payment by Paper Check")) {
    p.directDeposit = false;
  }
  if (checked(form, "Send my pay stub in the mail")) n += put(p, "paperPayStub", true);

  // ---- Work, rates ----
  n += put(p, "pplId", text(form, "Attendant PPL ID"));
  n += put(p, "rateStandardCdass", text(form, "CDASS Standard Rate"));
  n += put(p, "rateEmergencyCdass", text(form, "CDASS Emergency Rate"));

  // ---- Tax-exemption attestations -> relation to employer ----
  if (checked(form, "I am the spouse of the employer")) n += put(p, "relationToEmployer", "spouse");
  else if (checked(form, "I am the parent of the employer"))
    n += put(p, "relationToEmployer", "parent");
  else if (
    checked(
      form,
      "I am the biological or legally adopted child of the employer and I am under the age of 21",
    )
  )
    n += put(p, "relationToEmployer", "child");
  else if (checked(form, "I am not the spouse parent or child of the employer"))
    n += put(p, "relationToEmployer", "none");
  if (checked(form, "I am under 18 years old and I am a fulltime student"))
    n += put(p, "fullTimeStudent", true);

  // ---- EVV live-in attestation (the packet only distinguishes "live-in") ----
  if (checked(form, "Livein Caregiver Enter the shared residential address then skip to section 7"))
    n += put(p, "liveIn", "fullTime");

  // ---- I-9: citizenship and identity documents ----
  if (checked(form, "CB_1")) n += put(p, "citizenship", "citizen");
  else if (checked(form, "CB_2")) n += put(p, "citizenship", "national");
  else if (checked(form, "CB_3")) n += put(p, "citizenship", "lpr");
  else if (checked(form, "CB_4")) n += put(p, "citizenship", "alien");
  n += put(
    p,
    "uscisNumber",
    text(form, "3 A lawful permanent resident Enter USCIS or ANumber") ||
      text(form, "USCIS ANumber"),
  );
  n += put(p, "workAuthExpiration", isoFromDate(text(form, "Exp Date mmddyyyy")));
  n += put(p, "i94Number", text(form, "Form I94 Admission Number"));
  n += put(p, "foreignPassport", text(form, "Foreign Passport Number and Country of IssuanceRow1"));
  n += put(p, "passportNumber", text(form, "Document Number 0 (if any)"));
  n += put(p, "passportExpiration", isoFromDate(text(form, "Expiration Date if any")));
  n += put(p, "dlNumber", text(form, "List B Document Number 1"));
  n += put(p, "dlExpiration", isoFromDate(text(form, "List B Expiration Date 1")));

  // ---- Member and employer ----
  const [memberFirst, memberLast] = splitFirstLast(text(form, "Member Name: first and last"));
  n += put(emp, "memberFirst", memberFirst);
  n += put(emp, "memberLast", memberLast);
  n += put(emp, "memberPplId", text(form, "Member PPL ID"));
  n += put(emp, "memberMedicaidId", text(form, "Medicaid ID"));
  const [employerFirst, employerLast] = splitFirstLast(text(form, "Employer Name: first and last"));
  n += put(emp, "employerFirst", employerFirst);
  n += put(emp, "employerLast", employerLast);
  n += put(emp, "businessName", text(form, "Employers Business or Org Name"));
  n += put(emp, "businessAddress", text(form, "Employers Business or Org Address"));

  return { profile: p, employer: emp, count: n };
}
