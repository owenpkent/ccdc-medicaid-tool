# Form-fill engine (the write side)

Coverage Compass reads and it writes. The read side takes a state notice and
explains it. The write side is this: it produces completed, official PDFs from
the person's archive, on their device, with no network. This document describes
that engine as it exists in this repository today, and what is still ahead of it.

The engine is **headless and framework-agnostic**: pure functions over pdf-lib,
driven by one schema, with no UI coupling. That is why the accessible React
shell wraps it unchanged, and why the same code fills a CDASS enrollment packet
today and a Medicaid renewal tomorrow.

Two areas of the product stand on it:

- **Exemption Packet:** the "packet template generator (PDF output)" item on the
  [roadmap](roadmap.md).
- **Reapplication:** renewals and new applications are, mechanically, filling
  Colorado's Medicaid forms from the archive.

> **Lineage.** The pattern was first proven in
> [CDASS Enroll](https://github.com/owenpkent/cdass-enroll), a local-first
> form-autofill tool by the same author, and written up in its
> [white paper](https://github.com/owenpkent/cdass-enroll/blob/master/docs/whitepaper.md).
> That project is where the approach was validated against a real 28-page packet.
> The engine here is a TypeScript implementation of the same ideas, and the two
> codebases have since diverged; this one is self-contained and carries features
> the original does not (carry-forward import, the privacy guard, on-screen
> review and sign). Neither depends on the other at build or run time.

## Pre-population: fill this year from last year

Reapplication is not only filling a blank form once. It is filling the *same*
form again every year with mostly the same facts. Colorado's renewal and
redetermination packets can run dozens of pages, and CDASS participants also
maintain a care-hours worksheet (the IHSS Care Plan) that itemizes
attendant-care minutes per task and is redone on reassessment. Most of that
content does not change year to year.

So the archive is durable, not single-session. Once a person's evidence and
answers are captured, the engine pre-fills next year's renewal and care-hours
worksheet from the prior filing, and the person (or a CCDC advocate) reviews and
corrects only what changed. An 80-page yearly form becomes a review-and-correct
step.

The mechanism already works: `lib/extract/packet2026.ts` reads a previously
filled packet back into a profile, and the round-trip test proves it. Renewal
carry-forward reuses that path once Medicaid forms have mappings.

The same pre-fill extends to caseworkers: a CCDC advocate or county eligibility
worker can prepare the forms with a member from the member's archive, on the
member's device, with no data leaving it.

## What the engine provides

- A **schema** (`lib/profile/schema.ts`) that is the single source of truth for
  every field; the input UI and the form mappings both derive from it. It is the
  same object as the personal archive.
- A **capture layer** (`lib/extract/`) that fills the profile from documents the
  person already holds: the AAMVA PDF417 barcode on a driver's license or state
  ID (zxing-wasm), a passport's machine-readable zone with check-digit
  validation, license-front OCR, and Social Security card OCR with a digits-only
  second pass, behind shared image enhancement. Everything it produces passes
  through the check-every-answer review.
- A **fill layer** (`lib/fill/`): one flat mapping module per form (literal PDF
  field name to value), plus tolerant helpers so a missing or renamed field
  degrades to a logged warning rather than a crash.
- A **carry-forward importer** (`lib/extract/packet2026.ts`) that reverse-maps a
  filled PDF back into the profile.
- An **output discipline**: fill the real template's AcroForm with pdf-lib and
  never flatten, so the result is an exact, still-editable copy. Signatures are
  never fabricated, and fact-asserting checkboxes are only checked when the data
  unambiguously supports them.
- **Regression tests** that reload the output and assert the page and field
  counts match the blank template, proving it stayed an exact editable copy.

### Reading the ID barcode

The barcode path is the one capture route that cannot silently hand you a wrong
value: PDF417 carries error correction, so it either decodes correctly or not at
all. It is also the one with the most non-obvious failure modes, and it has
shipped broken. **[`id-barcode.md`](id-barcode.md) is the full contract**: the
payload format with spec citations, the three defects it has produced, the
measured limits of what a photo can decode, and a recipe for diagnosing a scan
that will not read. Read it before touching `lib/extract/aamva.ts`.

## Why pdf.js and pdf-lib both

Coverage Compass reads PDFs with pdf.js and writes them with **pdf-lib**. pdf.js
stays for reading incoming letters, supporting documents, and the on-screen
review; pdf-lib does the form filling and the signature overlay. Both run
client-side under Apache 2.0, with no server involved. All pdf-lib imports in
the fill layer are dynamic, so the lazy-chunk discipline holds and a first paint
pays nothing for them.

## Where each piece lives

| Module | Does |
| --- | --- |
| `web/src/lib/profile/schema.ts` | The archive shape; single source of truth for every field |
| `web/src/lib/extract/aamva.ts` | AAMVA barcode payload to fields (see [`id-barcode.md`](id-barcode.md)) |
| `web/src/lib/extract/scanner.ts` | Capture entry points; image enhancement; lazy zxing/tesseract |
| `web/src/lib/extract/{mrz,ssncard,dlfront}.ts` | Passport MRZ, SSN card, license front |
| `web/src/lib/extract/packet2026.ts` | Carry-forward: a filled PDF back into a profile |
| `web/src/lib/fill/util.ts` | Tolerant pdf-lib helpers; a renamed field warns, never crashes |
| `web/src/lib/fill/forms/*.ts` | One flat mapping per form (field name to value) |
| `web/src/lib/fill/fillForm.ts` | Load, fill, save without flattening |
| `web/src/lib/archive.ts` | The single audited storage module (IndexedDB, opt-in) |
| `web/src/components/FormFill.tsx` | The schema-driven UI, review phase, and generate |
| `web/public/forms/` | Blank official templates only. Never a filled copy |
| `rules/co/forms/*.yaml` | Document-library registry entries for each form |

## Status and what is next

**Shipped.** The engine fills a real official form end to end: the CDASS/PPL
Attendant Enrollment Packet 2026 with its embedded I-9, from a schema-driven UI,
behind a check-every-answer review, with capture from ID documents, carry-forward
import, on-screen review and signing, and a local download of an exact editable
copy. The archive persists opt-in through one audited storage module. The
exact-copy test fills the real 28-page template with fictional data and proves
every page and live field survives.

**Next**, in rough order:

1. **Medicaid schema sections** (needs CCDC input): household members, income
   sources and amounts, exemption category and evidence, renewal dates.
2. **The first Colorado Medicaid form**: obtain a renewal or redetermination
   form, the exemption-packet cover form, or the IHSS Care Plan care-hours
   worksheet. Keep the blank template in the repo; never commit a filled copy.
   Dump its field names with pypdf and write the flat mapping. Gate any
   attestation checkbox on unambiguous data.
3. **Tax-document reading** (W-2, 1099-NEC, Schedule C, Schedule SE) on top of
   the existing capture pipeline, for income evidence.
4. **Exemption-packet assembly**: cover letter and labeled exhibits. pdf-lib can
   build a PDF from scratch, which is beyond the fill pattern and genuinely new.
5. **CCDC review** of the fill preview, and Spanish field labels (the schema's
   labels are English-only today, and the preview says so).

**Deliberately not now: a shared package.** Extracting the engine into a
standalone package is a reasonable future step, but only once a second consumer
in this repo justifies the overhead. An in-repo module keeps friction low and
avoids premature shared-package machinery.

## Constraint alignment

- **Privacy.** pdf-lib runs entirely in the browser. No server, no change to the
  threat model in [privacy.md](privacy.md). Capture decodes on-device with WASM
  served from our own origin. The [privacy guard test](../web/src/privacy-guard.test.ts)
  enforces it rather than trusting it.
- **Accessibility.** The engine is headless, so the accessible React and React
  Aria shell wraps it unchanged and meets the WCAG 2.2 AA floor like the rest of
  the app.
- **Advocate-in-the-loop.** The engine fills; the person (and where the flow
  requires it, a CCDC advocate) reviews before anything reaches the state.
  Signatures are by hand or explicitly drawn, never fabricated.
- **Plain language.** The engine produces no user-facing prose; the surrounding
  copy follows the 6th-grade rule.
