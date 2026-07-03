# Form-fill engine (the write side)

Coverage Compass is architected around a proven form-fill engine. The same
write side that powers the sibling project **CDASS Enroll**
(https://github.com/owenpkent/cdass-enroll) is the foundation here, not a future
borrow. CDASS Enroll is a working proof of concept: a local-first,
zero-runtime-network form-autofill engine that fills the Colorado CDASS/PPL
attendant enrollment packet from documents the applicant already holds. Its
approach is written up in its
[white paper](https://github.com/owenpkent/cdass-enroll/blob/master/docs/whitepaper.md).
This engine is the write side of Coverage Compass.

Coverage Compass reads documents today: a person drops in a state letter and the
app classifies it, finds the deadline, and explains it. The write side is the
opposite operation, producing completed official PDFs from the person's archive,
and two areas of the product depend on it.

- **Exemption Packet:** the "packet template generator (PDF output)" item on the
  [roadmap](roadmap.md), built on this engine rather than rebuilt.
- **Reapplication:** renewals and new applications are, mechanically, filling
  Colorado's Medicaid forms from the archive.

The engine is **headless and framework-agnostic**: pure functions over pdf-lib,
schema-driven, with no UI coupling. That is exactly why it composes with the
accessible Coverage Compass shell unchanged. The integration model is decided:
adopt the engine as a headless TypeScript module now (see
[Integration model](#integration-model) below). This document gives the
file-by-file mapping and the step plan for that adoption. The engine itself is
proven; the porting work into this app is still to be done.

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

The same pre-fill extends to caseworkers: a CCDC advocate or county eligibility
worker can prepare the forms with a member from the member's archive, on the
member's device, with no data leaving it. This is an extension of the same
engine, not a separate build.

## What the engine provides

These are the engine's layers, proven in the CDASS Enroll POC and adopted as-is.

- A **schema** that is the single source of truth for every field; the input UI
  and the form mappings both derive from it. This is the same idea as the
  Coverage Compass personal archive.
- A **document extraction** layer: OCR with image enhancement, a digits-only
  pass for numbers, tolerant parsing, plausibility checks, and a user-guided
  crop, all behind a verify-everything review step. Where useful for capturing
  identity, it also reads structured sources: the AAMVA PDF417 barcode on a
  driver's license (zxing-wasm) and a passport's machine-readable zone with
  check-digit validation.
- A **fill layer**: one flat mapping module per form (literal PDF field name to
  value), plus tolerant helpers so a missing or renamed field degrades to a
  logged warning rather than a crash.
- An **output discipline**: fill the real template's AcroForm with pdf-lib and
  never flatten, so the result is an exact, still-editable copy. Signatures are
  never auto-filled, and fact-asserting checkboxes are only checked when the data
  unambiguously supports them.
- A **regression test** that reloads the output and asserts the page count and
  field count match the blank template, proving it stayed an exact editable
  copy.

## The one technical addition to this app

Coverage Compass reads PDFs with pdf.js. Filling PDFs needs a writer, so the
stack adds **pdf-lib** (pure client-side, same privacy posture, proven in CDASS
Enroll). pdf.js stays for reading incoming letters and supporting documents;
pdf-lib does the form filling. The two coexist in the browser with no server
involved. Both run client-side under the Apache 2.0 license.

## Where each piece lands

The engine's modules port into `web/src/lib`. The pure pieces move verbatim;
only the rendering and storage shells differ.

| CDASS Enroll (vanilla JS) | Coverage Compass (TypeScript + React) |
| --- | --- |
| `src/schema.js` | `web/src/lib/profile/schema.ts` (the archive shape) |
| `src/fill/util.js` (tolerant pdf-lib helpers) | `web/src/lib/fill/util.ts` |
| `src/fill/<form>.js` (per-form mappings) | `web/src/lib/fill/forms/<form>.ts` |
| template load + fill + save (no flatten) | `web/src/lib/fill/fillForm.ts` |
| `src/extract/*` (OCR, barcode, MRZ, verification) | extend `web/src/lib/ocr.ts`; add `web/src/lib/extract/*` |
| `localStorage` persistence | IndexedDB via `idb` (already the chosen store) |
| vanilla DOM review/generate UI | React + React Aria components |
| `tests/smoke.mjs` exact-copy guard | Vitest test asserting pages and fields preserved |

The fill layer ports almost verbatim, because it is pure functions over pdf-lib
with no UI coupling. Converting to TypeScript is mostly adding types. The schema
and the per-form mapping modules port directly; only the rendering and storage
shells differ.

## Integration model

**Decided: adopt the engine as a headless TypeScript module now.** The CDASS
Enroll modules move into `web/src/lib` (with `profile`/schema, `extract`, and
`fill` submodules), ported verbatim where they are pure. This matches the
whitepaper's own portability note: the fill layer and per-form mappings port
directly (vanilla JS to TypeScript); only the rendering and storage shells
differ.

**Future option, explicitly not now: a shared package (monorepo).** Extracting
the engine into a standalone package consumed by both CDASS Enroll and Coverage
Compass is a reasonable future step, but only once a second consumer justifies
the overhead. For now, adopting the engine as an in-repo TypeScript module keeps
friction low and avoids premature shared-package machinery.

## Step plan

**Status (2026-07-01): the headless port is in.** Steps 1, 2, 5, 6, and 8 are done
for the first real form: the tolerant helpers live in `web/src/lib/fill/util.ts`,
the schema (CDASS field set; Medicaid additions still to come per step 3) in
`web/src/lib/profile/schema.ts`, the packet and embedded-I-9 mappings in
`web/src/lib/fill/forms/`, the blank CDASS/PPL Attendant Packet 2026 template in
`web/public/forms/` with a registry entry at
`rules/co/forms/cdass-attendant-packet-2026.yaml`, and the exact-copy Vitest test
in `web/src/lib/fill/packet2026.test.ts` passes against the real template.
Steps 9 and 10 followed on the same day: a review-and-generate UI ships as an
early preview at the `#fill` view (`web/src/components/FormFill.tsx`,
schema-driven, edit then check-every-answer review then generate, behind the
same consent gate as triage), and the personal archive persists through the
single audited storage module `web/src/lib/archive.ts` (IndexedDB, strictly
opt-in save, one-button delete, scrub-sensitive after generate).

**Status (2026-07-02): capture is ported (step 7).** The CDASS Enroll capture
pipeline lives in `web/src/lib/extract`: driver's-license PDF417 barcode
decoding (zxing-wasm, WASM vendored to our origin by
`web/scripts/vendor-ocr.mjs`), a license-front OCR fallback, passport MRZ
parsing with check-digit validation, and Social Security card OCR with a
digits-only second pass, behind shared image enhancement. The `#fill` view's
"Scan your documents" section feeds every scanned value through the same
check-every-answer review. For demonstrations without real documents, a
clearly-fictional example person (`web/src/fixtures/examplePerson.ts`) and a
committed scannable example ID
(`web/public/examples/example-license-barcode.png`, a PDF417 encoding the same
fictional identity) exercise the real decode path. Remaining: the Medicaid
schema sections (step 3, needs CCDC input), tax-document reading on top of the
ported capture, CCDC review of the preview, and its Spanish field labels. The
numbered plan below is kept for the record.

1. Add `pdf-lib` to `web/package.json`. Lazy-import it, like pdf.js and
   tesseract.js, so it loads only when a form is generated.
2. Port the tolerant fill helpers to `web/src/lib/fill/util.ts`.
3. Define the archive schema in `web/src/lib/profile/schema.ts`, starting from
   the CDASS field set (identity, address, contact) and adding the Medicaid
   data: household members, income sources and amounts, exemption category and
   evidence, renewal dates.
4. Obtain the first real Colorado form (a Medicaid renewal or redetermination
   form, the exemption-packet cover form, or the CDASS care-hours worksheet,
   which is the IHSS Care Plan). Keep the blank template in the repo; never
   commit a filled copy or real data.
5. Dump its field names with pypdf and write the flat mapping in
   `web/src/lib/fill/forms/<form>.ts`. Gate any attestation checkbox on
   unambiguous data.
6. Implement `fillForm(templateBytes, profile, opts)` in
   `web/src/lib/fill/fillForm.ts`: load with pdf-lib, set fields, save without
   flattening, hand the bytes to a local download. Never auto-fill signatures.
7. Reuse the read side for capture. pdf.js and tesseract.js (already present)
   read award letters, waiver paperwork, and tax forms into the archive; port
   the CDASS parsing and verify-everything review approach.
8. Add a Vitest test that fills the real template and asserts the output keeps
   every page and every live form field (an exact, editable copy).
9. Build the review-and-generate UI as React and React Aria components, meeting
   the WCAG 2.2 AA floor: show every captured value for verification, then
   generate.
10. Persist the archive in IndexedDB and carry over the privacy hygiene
    (retention auto-clear, clear-after-generate).

## Reused vs new

The line is drawn honestly: the engine is proven; the Medicaid-specific work on
top of it is new.

- **Reused (proven in CDASS Enroll, adopted as-is):** the schema-driven model,
  the fill layer and its exact-editable discipline, the conservative attestation
  rule, the OCR-plus-verification methodology, and the exact-copy regression
  test.
- **New for Coverage Compass:** the Medicaid-specific schema additions, the
  Colorado form mappings, tax-document reading (W-2, 1099-NEC, Schedule C,
  Schedule SE), and the exemption-packet cover-letter and labeled-exhibit
  assembly. (pdf-lib can also build a PDF from scratch, which is beyond the fill
  pattern.) Carry-forward pre-fill across years is new here too.
- **Not central here, but ported anyway:** the driver's-license PDF417 barcode
  path. Medicaid packets do not need it for filling, but the engine offers it
  for identity capture (it is the most reliable scan), and porting it brought
  the whole capture pipeline and its OCR methodology along.

## Constraint alignment

- **Privacy.** pdf-lib runs entirely in the browser. No server, no change to the
  threat model in [privacy.md](privacy.md). This preserves the engine's
  local-only, zero-runtime-network posture.
- **Accessibility.** The engine is headless; the review and generate UI must meet
  WCAG 2.2 AA like the rest of the app. Because the engine is headless, the
  accessible React + React Aria shell wraps it unchanged.
- **Advocate-in-the-loop.** The engine fills and the person (and, where the flow
  requires it, a CCDC advocate) reviews before anything reaches the state.
  Signatures are by hand.
- **Plain language.** The engine produces no user-facing prose; the surrounding
  copy follows the 6th-grade rule.
