/* Profile schema: the single source of truth for the personal archive.
 *
 * Ported from CDASS Enroll (src/schema.js). The section list drives both the
 * capture/review UI (v0.2) and the PDF field mappings in lib/fill/forms/. The
 * field set here is the proven CDASS attendant set (identity, address,
 * contact, payment, work, I-9, W-4).
 *
 * TODO (v0.2, with CCDC input): add the Medicaid archive sections named in
 * docs/form-fill-engine.md step 3: household members, income sources and
 * amounts, exemption category and evidence, renewal dates.
 */

export type FieldType =
  "text" | "date" | "ssn" | "phone" | "email" | "select" | "checkbox" | "money" | "signature";

export interface ProfileField {
  key: string;
  label: string;
  type: FieldType;
  /** Cleared by scrubSensitive (SSN, DOB, bank and ID document numbers). */
  sensitive?: boolean;
  default?: string | boolean;
  /** Narrow input hint for the UI. */
  width?: "s";
  placeholder?: string;
  options?: ReadonlyArray<readonly [string, string]>;
  /** Runs when a checkbox toggles; returns the keys it changed. */
  onToggle?: (p: Profile) => string[];
}

export interface ProfileSection {
  id: string;
  title: string;
  note?: string;
  disableIf?: (p: Profile) => boolean;
  fields: ProfileField[];
}

/** The attendant/applicant. Text-ish fields are strings; flags are booleans. */
export interface Profile {
  id: string;
  first: string;
  middle: string;
  last: string;
  maidenOrPrevious: string;
  dob: string;
  ssn: string;
  gender: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  municipality: string;
  mailingSame: boolean;
  mailStreet: string;
  mailStreet2: string;
  mailCity: string;
  mailState: string;
  mailZip: string;
  email: string;
  cellPhone: string;
  otherPhone: string;
  allowText: string;
  contactPreference: string;
  primaryLanguage: string;
  bestContactTimes: string;
  directDeposit: boolean;
  sameAccountAllMembers: boolean;
  accountType: string;
  bankName: string;
  routing: string;
  account: string;
  paperPayStub: boolean;
  directoryOptIn: string;
  pplId: string;
  relationship: string;
  liveIn: string;
  relationToEmployer: string;
  fullTimeStudent: boolean;
  primaryJob: boolean;
  rateStandardCdass: string;
  rateEmergencyCdass: string;
  citizenship: string;
  uscisNumber: string;
  workAuthExpiration: string;
  i94Number: string;
  foreignPassport: string;
  dlNumber: string;
  dlState: string;
  dlExpiration: string;
  passportNumber: string;
  passportExpiration: string;
  filingStatus: string;
  multipleJobs: boolean;
  childrenCredit: string;
  otherDependentsCredit: string;
  otherIncome: string;
  deductions: string;
  extraWithholding: string;
}

/** The Member (care recipient) and employer of record. */
export interface Employer {
  memberFirst: string;
  memberLast: string;
  memberPplId: string;
  memberMedicaidId: string;
  employerFirst: string;
  employerLast: string;
  employerTitle: string;
  businessName: string;
  businessAddress: string;
  ein: string;
  /** PNG data URL, uploaded once by the employer; empty means "sign by hand". */
  signature: string;
}

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    id: "name",
    title: "Name",
    fields: [
      { key: "first", label: "First name", type: "text" },
      { key: "middle", label: "Middle name", type: "text" },
      { key: "last", label: "Last name", type: "text" },
      { key: "maidenOrPrevious", label: "Maiden or previous last name", type: "text" },
    ],
  },
  {
    id: "personal",
    title: "Personal details",
    fields: [
      { key: "dob", label: "Date of birth", type: "date", sensitive: true },
      { key: "ssn", label: "Social Security Number", type: "ssn", sensitive: true },
      {
        key: "gender",
        label: "Gender",
        type: "select",
        options: [
          ["", ""],
          ["male", "Male"],
          ["female", "Female"],
          ["undisclosed", "Prefer not to disclose"],
        ],
      },
    ],
  },
  {
    id: "address",
    title: "Home address (where they live, no PO Box)",
    fields: [
      { key: "street", label: "Street", type: "text" },
      { key: "street2", label: "Apt / Ste / Unit", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "text", width: "s" },
      { key: "zip", label: "ZIP code", type: "text", width: "s" },
      { key: "county", label: "County", type: "text" },
      { key: "municipality", label: "Municipality", type: "text" },
      {
        key: "mailingSame",
        label: "Mailing address is the same",
        type: "checkbox",
        default: true,
        // Unchecking means mail goes elsewhere than the home/license address.
        // Seed the mailing fields from the home address (when still empty) so
        // the user edits only what differs instead of retyping the whole thing.
        onToggle: (p) => {
          if (p.mailingSame || p.mailStreet || p.mailCity || p.mailZip) return [];
          p.mailStreet = p.street;
          p.mailStreet2 = p.street2;
          p.mailCity = p.city;
          p.mailState = p.state;
          p.mailZip = p.zip;
          return ["mailStreet", "mailStreet2", "mailCity", "mailState", "mailZip"];
        },
      },
    ],
  },
  {
    id: "mailing",
    title: "Mailing address",
    note: 'Mail goes to the home address while "Mailing address is the same" is checked above. Uncheck it to send mail elsewhere; these fields then unlock pre-filled from the home address, so you change only what differs.',
    disableIf: (p) => p.mailingSame,
    fields: [
      { key: "mailStreet", label: "Address", type: "text" },
      { key: "mailStreet2", label: "Apt / Ste / Unit", type: "text" },
      { key: "mailCity", label: "City", type: "text" },
      { key: "mailState", label: "State", type: "text", width: "s" },
      { key: "mailZip", label: "ZIP code", type: "text", width: "s" },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    fields: [
      { key: "email", label: "Email", type: "email" },
      { key: "cellPhone", label: "Cell phone", type: "phone" },
      { key: "otherPhone", label: "Home or other phone", type: "phone" },
      {
        key: "allowText",
        label: "PPL may text the cell number",
        type: "select",
        options: [
          ["", ""],
          ["yes", "Yes"],
          ["no", "No"],
        ],
      },
      {
        key: "contactPreference",
        label: "Preferred contact method",
        type: "select",
        options: [
          ["", ""],
          ["email", "Email"],
          ["cell", "Cell phone"],
          ["home", "Home phone"],
          ["mail", "Mail"],
        ],
      },
      { key: "primaryLanguage", label: "Primary language", type: "text", placeholder: "English" },
      { key: "bestContactTimes", label: "Best times to contact", type: "text" },
    ],
  },
  {
    id: "payment",
    title: "Payment",
    fields: [
      {
        key: "directDeposit",
        label: "Direct deposit to bank account",
        type: "checkbox",
        default: true,
      },
      {
        key: "sameAccountAllMembers",
        label: "Use the same account for all Members they work for",
        type: "checkbox",
      },
      {
        key: "accountType",
        label: "Account type",
        type: "select",
        options: [
          ["", ""],
          ["checking", "Checking"],
          ["savings", "Savings"],
        ],
      },
      { key: "bankName", label: "Banking institution name", type: "text", sensitive: true },
      { key: "routing", label: "Routing number", type: "text", sensitive: true },
      { key: "account", label: "Account number", type: "text", sensitive: true },
      { key: "paperPayStub", label: "Mail paper pay stubs (no internet access)", type: "checkbox" },
      {
        key: "directoryOptIn",
        label: "List in the Attendant directory",
        type: "select",
        options: [
          ["", ""],
          ["yes", "Yes"],
          ["no", "No"],
        ],
      },
    ],
  },
  {
    id: "work",
    title: "Work details",
    fields: [
      { key: "pplId", label: "Attendant PPL ID (if assigned)", type: "text" },
      {
        key: "relationship",
        label: "Relationship to the Member",
        type: "select",
        options: [
          ["", ""],
          ["spouse", "Spouse"],
          ["parent", "Parent"],
          ["relative", "Other relative"],
          ["nonrelative", "Non-relative"],
        ],
      },
      {
        key: "liveIn",
        label: "Living situation (EVV attestation)",
        type: "select",
        options: [
          ["", ""],
          ["fullTime", "Lives with the Member 7 days a week (no other home)"],
          ["extended", "Lives with the Member for an extended period"],
          ["doesNotLive", "Does not live with the Member"],
        ],
      },
      {
        key: "relationToEmployer",
        label: "Relation to the employer (tax exemptions)",
        type: "select",
        options: [
          ["", ""],
          ["spouse", "Spouse of the employer"],
          ["parent", "Parent of the employer"],
          ["child", "Child of the employer"],
          ["none", "Not spouse, parent, or child of the employer"],
        ],
      },
      { key: "fullTimeStudent", label: "Full-time student", type: "checkbox" },
      {
        key: "primaryJob",
        label: "This household/respite job is their primary job",
        type: "checkbox",
      },
    ],
  },
  {
    id: "rates",
    title: "Pay rates (CDASS, $/hour)",
    fields: [
      {
        key: "rateStandardCdass",
        label: "Standard rate (per attendant)",
        type: "money",
        placeholder: "e.g. 18",
      },
      {
        key: "rateEmergencyCdass",
        label: "Emergency rate",
        type: "money",
        default: "45",
        placeholder: "45",
      },
    ],
  },
  {
    id: "i9",
    title: "I-9 work authorization",
    fields: [
      {
        key: "citizenship",
        label: "Citizenship / immigration status",
        type: "select",
        options: [
          ["", ""],
          ["citizen", "U.S. citizen"],
          ["national", "Noncitizen national of the U.S."],
          ["lpr", "Lawful permanent resident"],
          ["alien", "Noncitizen authorized to work"],
        ],
      },
      {
        key: "uscisNumber",
        label: "USCIS / A-Number (if LPR or authorized)",
        type: "text",
        sensitive: true,
      },
      {
        key: "workAuthExpiration",
        label: "Work authorization expiration",
        type: "date",
        sensitive: true,
      },
      { key: "i94Number", label: "Form I-94 admission number", type: "text", sensitive: true },
      {
        key: "foreignPassport",
        label: "Foreign passport number and country",
        type: "text",
        sensitive: true,
      },
    ],
  },
  {
    id: "iddocs",
    title: "Identity documents (auto-filled from scans)",
    fields: [
      { key: "dlNumber", label: "Driver's license number", type: "text", sensitive: true },
      { key: "dlState", label: "License state", type: "text", width: "s" },
      { key: "dlExpiration", label: "License expiration", type: "date", sensitive: true },
      { key: "passportNumber", label: "U.S. passport number", type: "text", sensitive: true },
      { key: "passportExpiration", label: "Passport expiration", type: "date", sensitive: true },
    ],
  },
  {
    id: "w4",
    title: "W-4 withholding",
    fields: [
      {
        key: "filingStatus",
        label: "Filing status",
        type: "select",
        options: [
          ["", ""],
          ["single", "Single or married filing separately"],
          ["joint", "Married filing jointly / qualifying surviving spouse"],
          ["hoh", "Head of household"],
        ],
      },
      { key: "multipleJobs", label: "Step 2(c): two jobs total, similar pay", type: "checkbox" },
      { key: "childrenCredit", label: "Step 3: qualifying children credit ($)", type: "money" },
      { key: "otherDependentsCredit", label: "Step 3: other dependents credit ($)", type: "money" },
      { key: "otherIncome", label: "Step 4(a): other income ($)", type: "money" },
      { key: "deductions", label: "Step 4(b): deductions ($)", type: "money" },
      {
        key: "extraWithholding",
        label: "Step 4(c): extra withholding per period ($)",
        type: "money",
      },
    ],
  },
];

export const EMPLOYER_SECTIONS: ProfileSection[] = [
  {
    id: "member",
    title: "Member (person receiving care)",
    fields: [
      { key: "memberFirst", label: "Member first name", type: "text" },
      { key: "memberLast", label: "Member last name", type: "text" },
      { key: "memberPplId", label: "Member PPL ID", type: "text" },
      { key: "memberMedicaidId", label: "Member Medicaid ID (EVV exemption form)", type: "text" },
    ],
  },
  {
    id: "employer",
    title: "Employer of record",
    fields: [
      { key: "employerFirst", label: "Employer first name", type: "text" },
      { key: "employerLast", label: "Employer last name", type: "text" },
      { key: "employerTitle", label: "Employer title", type: "text", placeholder: "Employer" },
      { key: "businessName", label: "Business or organization name (I-9 / W-4)", type: "text" },
      {
        key: "businessAddress",
        label: "Business address (street, city, state, ZIP)",
        type: "text",
      },
      { key: "ein", label: "EIN (W-4)", type: "text" },
      {
        key: "signature",
        label: "Employer signature (uploaded once, placed on the employer signature lines)",
        type: "signature",
      },
    ],
  },
];

/* The blanks are built from the section lists so the schema stays the single
 * source of truth; the casts are safe because every Profile/Employer key is
 * defined by exactly those lists. */

export function blankProfile(): Profile {
  const p: Record<string, string | boolean> = { id: crypto.randomUUID() };
  for (const s of PROFILE_SECTIONS)
    for (const f of s.fields)
      p[f.key] = f.type === "checkbox" ? (f.default ?? false) : (f.default ?? "");
  return p as unknown as Profile;
}

export function blankEmployer(): Employer {
  const e: Record<string, string> = {};
  for (const s of EMPLOYER_SECTIONS) for (const f of s.fields) e[f.key] = "";
  return e as unknown as Employer;
}

/**
 * Blank out every field marked sensitive (SSN, DOB, bank and ID document
 * numbers). Name, address, contact, and rates stay so the profile remains
 * useful as a record. Returns the keys that were cleared.
 */
export function scrubSensitive(profile: Profile): string[] {
  const cleared: string[] = [];
  const p = profile as unknown as Record<string, string | boolean>;
  for (const s of PROFILE_SECTIONS)
    for (const f of s.fields)
      if (f.sensitive && p[f.key]) {
        p[f.key] = "";
        cleared.push(f.key);
      }
  return cleared;
}

export function displayName(p: Profile): string {
  const n = [p.first, p.last].filter(Boolean).join(" ");
  return n || "(unnamed employee)";
}
