# Architecture

Coverage Compass is built on a proven engine. The local-first, schema-driven
form-autofill engine that powers the sibling project **CDASS Enroll**
(https://github.com/owenpkent/cdass-enroll) is the foundation here, not a future
borrow. CDASS Enroll is a working proof of concept: a local-only web app that
fills the Colorado CDASS/PPL attendant enrollment packet from documents the
applicant already holds, with no server and no data leaving the browser. Coverage
Compass adopts that engine as the write side and builds an accessible,
advocate-supported shell around it for three Medicaid life events: Reporting,
Reapplication, and Appeals.

The system is two parts:

1. **The engine** (proven in CDASS Enroll, headless and framework-agnostic): the
   schema/profile, the capture/extraction pipeline, and the fill layer.
2. **The Coverage Compass shell** (new, built around the engine): the accessible
   React + React Aria UI, the read-side notice triage, the advocate-editable rule
   library, advocate-in-the-loop review, and the personal archive in IndexedDB.

This document covers both. A companion document,
[`form-fill-engine.md`](form-fill-engine.md), gives the file-by-file mapping and
the step plan for the write side.

## Constraints, in priority order

1. **Privacy.** No user data leaves the device. Ever. No exceptions. See `privacy.md`.
2. **Accessibility.** WCAG 2.2 AA is the floor. See `accessibility.md`.
3. **Reach.** Has to run on a 2019 Chromebook, an older Android phone, and a library PC.
4. **Auditability.** Anyone (including CCDC) should be able to read the code and verify the privacy claims.
5. **Maintainability by a small volunteer team.** Boring stack > clever stack.

The engine satisfies the first constraint by architecture: it is local-only with
zero runtime network, proven in CDASS Enroll today. The shell exists to satisfy
the second: accessibility is the non-negotiable floor for disabled users, and the
React Aria primitives ship WCAG behaviors by default. Because the engine is
headless, it composes with the accessible shell unchanged.

## Stack

- **Build:** Vite
- **Language:** TypeScript (strict)
- **UI:** React 18+
- **Accessible primitives:** [React Aria Components](https://react-spectrum.adobe.com/react-aria/) (the most accessible UI primitives library available; Adobe-maintained)
- **PDF parsing (read side):** [pdf.js](https://mozilla.github.io/pdf.js/) (Mozilla; runs entirely client-side)
- **PDF form filling (write side):** [pdf-lib](https://pdf-lib.js.org/) (pure client-side; proven in CDASS Enroll). pdf.js reads incoming letters and supporting documents; pdf-lib fills official forms. The two coexist in the browser with no server.
- **OCR (photos of paper letters and documents):** [tesseract.js](https://tesseract.projectnaptha.com/) (WASM; client-side)
- **Barcode / MRZ capture (where useful for identity):** [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (PDF417/AAMVA and passport MRZ; client-side, proven in CDASS Enroll)
- **Storage:** IndexedDB via [idb](https://github.com/jakearchibald/idb) (local-only; no sync)
- **i18n:** [Format.js / react-intl](https://formatjs.io/) (English + Spanish from v0.1)
- **Testing:** Vitest + @testing-library/react + axe-core
- **Linting:** ESLint + eslint-plugin-jsx-a11y + Prettier
- **Hosting:** static site on Netlify or GitHub Pages, with Subresource Integrity on all assets

Explicit non-choices:
- No Tailwind in v0.1. Plain CSS with custom properties; revisit if it slows velocity.
- No state library. React state + context until proven inadequate.
- No client-side routing in v0.1 (single-page flow). Add react-router if v0.2 needs it.
- No analytics, no telemetry, no error reporting service. Period.

## The engine (proven in CDASS Enroll)

This is the write side, and it exists today. CDASS Enroll is a working,
in-use proof of concept that fills a 28-page PPL attendant packet plus the IRS
W-4 (and an optional standalone I-9) from documents the applicant already holds.
The engine is a small stack of layers; only the per-form mapping changes per
form. These layers are what Coverage Compass adopts.

```
   Documents (ID, SS card,         Captured-once profile      Manual entry / import
   award letters, tax forms)       (entered or scanned once)  (anything not captured)
   barcode + MRZ + OCR
            \                          |                        /
             \                         |                       /
              ------------>  Person / household profile  <-----
                            (one schema, the source of truth)
                                       |
                         Per-form field mapping module
                       (literal PDF field names -> values)
                                       |
                    Fill the official template's form fields
                      (AcroForm, never flattened, editable)
                                       |
                         Local download (no upload)
```

The layers, in order:

- **Schema (source of truth).** One schema declares sections and fields with
  types (text, date, SSN, money, select, checkbox). Both the input UI and the
  fill mappings derive from it, so the data model grows without touching
  rendering code. Adding a field is one schema entry plus one line in the
  relevant mapping.
- **Capture / extraction.** A pipeline reads structured and semi-structured
  documents and falls back to OCR, all behind a verify-everything review step:
  - **Structured and exact:** the PDF417 barcode on a US driver's license is the
    DMV's own AAMVA record (decoded with zxing-wasm). Prefer it whenever a
    structured source exists.
  - **Semi-structured with validation:** a passport's machine-readable zone is two
    fixed-format lines with check digits; the parser validates each check digit
    and flags failures rather than filling a wrong number.
  - **Unstructured OCR, best-effort:** Social Security cards, the front of a
    license, and (for Coverage Compass) award letters and tax forms are read with
    tesseract.js, using image enhancement, a digits-only pass for numbers,
    tolerant parsing, and plausibility checks, plus a user-guided crop. OCR is a
    convenience; the stored profile is the source of truth and manual entry always
    remains available.
- **Fill layer (pure functions over pdf-lib).** One flat mapping module per form
  revision maps exact PDF field names to profile values. Tolerant helpers mean a
  missing or renamed field degrades to a logged warning, not a crash. Layout eras
  are detected by probing for a known field.
- **Exact, editable output.** The real template is loaded, its form fields are
  filled, and it is saved **without flattening**, so the result is byte-for-byte
  the same form: same pages, same live fields, with values filled in. The person
  (or a CCDC advocate) can still correct any field in a normal PDF reader before
  printing. Two rules hold the line on correctness:
  - **Signatures are never fabricated.** The app places only a signature image the
    signer supplies; every other party's signature line stays blank.
  - **Fact-asserting checkboxes are gated on unambiguous data.** A live-in
    relationship, an age threshold, a tax status: only checked when the stored
    data unambiguously supports it. Anything uncertain is left for the human.
- **Local download.** The filled bytes are handed to the browser as a download.
  Nothing is uploaded.
- **Exact-copy smoke test.** A regression test reloads the output and asserts the
  page count and field count match the blank template, proving it stayed an exact,
  editable copy.

**This is proven today.** In CDASS Enroll the layers above are implemented in
vanilla JavaScript: `src/schema.js`, `src/extract/*`, `src/fill/*`, `src/store.js`,
and `tests/smoke.mjs`, with OCR/WASM assets vendored to disk and a
Content-Security-Policy that blocks runtime network. Coverage Compass keeps every
one of these properties; it changes only the rendering and storage shells.

## The Coverage Compass shell (built around the engine)

The shell is what is new. It wraps the headless engine in an accessible,
plain-language, advocate-supported product for disabled Coloradans. The shell has
four parts.

- **Accessible UI (React + React Aria).** The whole app is WCAG 2.2 AA at
  minimum, screen-reader-first, keyboard-only, in English and Spanish from v0.1.
  React Aria Components ship the accessible behaviors by default. No accessibility
  overlays or widgets. This is why the shell is React and not the POC's vanilla
  JS: accessibility is the floor, and the engine is headless, so it composes with
  the accessible shell unchanged.
- **Read side: notice triage.** This is the entry point. A person drops in a
  letter from the state; pdf.js and tesseract.js read it, the rules engine
  classifies the letter type, extracts the deadline, and the app explains it in
  plain language. Classification and explanations come from an advocate-editable
  per-state YAML rule library (below). The rules engine is a pure TypeScript
  function: extracted text in, structured classification, deadline, and
  recommended actions out.
- **Advocate-in-the-loop review.** Anything that will reach a government agency
  routes through a CCDC advocate first. Never direct-to-state. The engine fills
  and the person reviews; an advocate reviews before submission; the person signs
  by hand.
- **Personal archive (IndexedDB).** The engine's capture-once profile is persisted
  on the device via IndexedDB. The archive (award letters, waiver paperwork, tax
  returns, diagnosis letters, the captured profile values) is durable, not
  single-session, and serves all three Medicaid life events. Carry-forward
  pre-fill uses last year's archive to pre-populate this year's renewal and the
  CDASS care-hours worksheet (the IHSS Care Plan), turning a long yearly form into
  a review-and-correct step. See [`form-fill-engine.md`](form-fill-engine.md).

## Integration model

**Decided: adopt the engine as a headless TypeScript module now.** The CDASS
Enroll engine moves into the Coverage Compass web app as a headless module, for
example `web/src/lib/engine/` with `schema`, `extract`, and `fill` submodules.
The CDASS Enroll modules port verbatim where they are pure. This matches the
whitepaper's portability note: the fill layer is pure functions over pdf-lib
(load a template, set named fields, save without flattening) with no UI coupling,
so the schema and the per-form mappings port directly (vanilla JS to TypeScript);
only the rendering and storage shells differ.

**Future option, explicitly not now: a shared package (monorepo).** Extracting
the engine into a standalone package consumed by both CDASS Enroll and Coverage
Compass is a reasonable future step, but only once a second consumer justifies the
overhead. For now, adopting the engine as an in-repo TypeScript module keeps
friction low and avoids premature shared-package machinery.

## Proven vs new

A clear line, because it sets expectations honestly.

**Proven today (in the CDASS Enroll POC), adopted as-is:**
- Local-only, zero-runtime-network architecture.
- In-browser OCR (tesseract.js) with image enhancement and verification.
- Capture-once profile driven by a single schema.
- Document extraction: AAMVA barcode (zxing-wasm), passport MRZ, OCR with
  plausibility checks.
- Filling official PDFs into exact, still-editable copies (pdf-lib, no flatten).
- Conservative attestation gating; signatures never fabricated.
- Privacy hygiene: retention auto-clear, scrub-after-generate, vendored OCR/WASM
  assets, Content-Security-Policy.
- Exact-copy smoke-test verification.

**New for Coverage Compass, built in the shell:**
- Notice triage (read side): classify the letter, extract the deadline, explain
  it in plain language.
- Advocate-editable per-state YAML rule library.
- Advocate-in-the-loop review before anything reaches the state.
- WCAG 2.2 AA accessibility and English/Spanish from day one.
- Medicaid-specific schema growth: household composition, income sources and
  amounts, exemption category and evidence, renewal dates, and the CDASS
  care-hours worksheet (the IHSS Care Plan).
- Carry-forward pre-fill across years (review-and-correct instead of re-entry).

The driver's-license PDF417 path is not central to Medicaid packets, though the
OCR methodology around it carries over for award letters and tax documents.

## Data flow

The read side classifies an incoming letter and explains it:

```
   user
     |
     v
+-----------+    +-----------+    +-----------+    +-----------+
| dropzone  | -> | pdf.js or | -> | rules     | -> | render    |
| (file or  |    | tesseract |    | engine    |    | summary   |
|  photo)   |    | (in-browser)   | (rules/co)|    |           |
+-----------+    +-----------+    +-----------+    +-----------+
                                       ^
                                       |
                                  YAML rule files
                                  bundled at build
```

The write side fills official PDFs from the archive (the engine):

```
   documents / scans                       manual typing
        |                                        |
   web/src/lib/extract/*  (OCR, barcode, MRZ, verify)
        |                                        |
        \                                        /
         personal archive (schema in web/src/lib/profile/schema.ts)
                          |
                 IndexedDB via idb (local-only)
                          |
            review-and-generate UI (React + React Aria)
                          |
            web/src/lib/fill/forms/<form>.ts  (flat mapping)
                          |
            web/src/lib/fill/fillForm.ts  (pdf-lib, no flatten)
                          |
                 browser download (Blob URL)
```

All boxes run in the user's browser. There is no server. The rules engine is a
pure TypeScript function; the fill layer is pure functions over pdf-lib. Anything
bound for the state passes through advocate review first.

## Module layout

```
web/src/
|-- main.tsx                  app entry
|-- App.tsx                   top-level layout and routing
|-- styles.css                global CSS with focus, motion, contrast rules
|-- components/
|   |-- LetterDropzone.tsx    drag-drop + file picker + camera
|   |-- LetterSummary.tsx     plain-language summary view
|   |-- DeadlineCard.tsx      large prominent deadline display
|   `-- NextActions.tsx       1-3 concrete next actions
|-- lib/
|   |-- pdf.ts                pdf.js wrapper (read side)
|   |-- ocr.ts               tesseract.js wrapper (read side; the scanner keeps its own worker)
|   |-- rules.ts             loads rules/co/*.yaml; classification logic
|   |-- deadline.ts          deadline extraction
|   |-- plainLanguage.ts     explanation strings keyed by letter type
|   |-- profile/
|   |   `-- schema.ts        the archive shape (the engine's source of truth)
|   |-- extract/             capture pipeline ported from CDASS Enroll
|   |   |-- scanner.ts       orchestration: enhance, shared OCR worker, digit pass
|   |   |-- aamva.ts         AAMVA PDF417 (zxing-wasm)
|   |   |-- mrz.ts           passport MRZ with check digits
|   |   |-- ssncard.ts       Social Security card OCR
|   |   |-- dlfront.ts       license-front OCR fallback
|   |   |-- packet2026.ts    carry-forward import from a filled packet
|   |   `-- ...              award-letter / tax-form readers (future)
|   `-- fill/                the write side (pure functions over pdf-lib)
|       |-- util.ts          tolerant pdf-lib helpers (missing field warns)
|       |-- fillForm.ts      load template, set fields, save without flatten
|       `-- forms/<form>.ts  one flat mapping per form revision
`-- i18n/
    |-- en.json
    `-- es.json
```

The `lib/extract` and `lib/fill` trees are the headless engine adopted from CDASS
Enroll. They are pure and UI-free, so the React components and the IndexedDB store
sit above them without coupling.

## Rule library

State rules live in `rules/co/` as YAML, separate from the web app. The schema is
intentionally simple so a non-developer (a CCDC advocate) can read and propose
edits via PR. This is part of the shell, not the engine.

- `rules/co/letter-types.yaml`: classification patterns and plain-language strings per letter type.
- `rules/co/exemptions.yaml`: exemption categories, required evidence, citations.
- `rules/co/deadlines.yaml`: appeal windows, renewal windows, redetermination windows.

The web app imports these at build time. Updating rules means a PR and a redeploy.
This is intentional. It keeps a CCDC attorney in the loop on rule changes.

## Build and deploy

- `npm run build` produces a static bundle in `web/dist/`.
- Reproducible builds: lockfile committed, Node version pinned via `.nvmrc`, deterministic build flags.
- Subresource Integrity hashes generated automatically for all bundled assets.
- OCR/WASM assets (tesseract worker/core and model, zxing WASM) are vendored with
  the bundle, as in CDASS Enroll, so the page never fetches them at runtime.
- Deploy target is a static host (Netlify or GitHub Pages). No backend, no serverless functions.
- Releases are tagged and signed.

## Performance budget

- First Contentful Paint < 1.5s on a 2019 Chromebook over a slow 4G connection.
- Time to Interactive < 3s on the same.
- Total JS bundle (gzipped) < 250 KB for v0.1.
- pdf.js, tesseract.js, and pdf-lib are loaded only when needed (lazy import), so
  the write-side engine adds nothing to the read-side first load.

## Open architectural questions

- Should rules be authored in YAML or in a dedicated little-language? YAML is the v0.1 answer.
- Should the rules engine be rule-based, ML-based, or both? Rule-based for v0.1. Reconsider when we have 50+ real sample letters and can see the failure modes.
- Should we expose a CLI for batch processing letters (for CCDC staff who handle volume)? Out of scope for v0.1; consider for v0.2.
- When does a second consumer justify extracting the engine into a shared package
  (the monorepo option)? Not now; revisit if a third tool wants the same engine.
- Does the archive need passphrase encryption at rest (WebCrypto)? Acceptable to
  defer while the threat model is a single user's own device; revisit if the
  assumption changes. See `privacy.md`.