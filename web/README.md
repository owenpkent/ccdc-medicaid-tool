# web (Coverage Compass)

The client-side web app. See `../docs/architecture.md` for context.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

`npm install` followed by `npm run dev` (or `npm run build`) is all you need: the
`predev` / `prebuild` hooks generate the typed rule module from the YAML
(`gen:rules`) and vendor the OCR and barcode runtime assets (tesseract.js and
zxing-wasm) from `node_modules` into `public/vendor` (`vendor:ocr`). The
vendored assets (~27 MB) are gitignored and reproducible from the lockfile.

## Build

```bash
npm run build
npm run preview
```

## Test

```bash
npm run test         # one-shot (CI-safe)
npm run test:watch   # watch mode
```

## Stack

- Vite + React 18 + TypeScript (strict)
- React Aria Components for accessible primitives (DropZone, FileTrigger, Button)
- react-intl for English/Spanish i18n
- pdf.js for PDF text extraction (client-side, lazy-loaded; worker bundled local)
- tesseract.js for image OCR (client-side, lazy-loaded; worker/WASM/language data vendored)
- zxing-wasm for driver's-license PDF417 barcode decoding (client-side, lazy-loaded; WASM vendored)
- pdf-lib for the optional one-page PDF summary (client-side, lazy-loaded)
- vite-plugin-pwa (Workbox) for offline support
- Vitest + Testing Library + axe-core for tests; ESLint flat config with jsx-a11y

## Layout

```
src/
|-- main.tsx                 entry; mounts providers and registers the service worker
|-- App.tsx                  top-level shell (header, consent gate, hash views, footer)
|-- styles.css               base CSS (no framework); light/dark palettes
|-- i18n/
|   |-- en.json, es.json     message catalogs
|   |-- messages.ts          catalog map + locale detection
|   `-- LocaleProvider.tsx   IntlProvider + locale context (used by the rules engine too)
|-- components/
|   |-- Triage.tsx           orchestrates file/photo/paste/example -> extract -> classify -> result
|   |-- LetterDropzone.tsx   accessible drop-or-pick-or-photo file input
|   |-- LetterSummary.tsx    result view; download + reset
|   |-- DeadlineCard.tsx     prominent deadline with days remaining
|   |-- NextActions.tsx      1-3 next actions with urgency and tel: links
|   |-- LanguageToggle.tsx   English/Spanish switch
|   |-- ThemeToggle.tsx      light/dark switch (session-only, follows system by default)
|   |-- ConsentGate.tsx      click-through release before the tool is usable (session-only)
|   |-- FormFill.tsx         review-and-generate form filler (#fill view, early preview)
|   `-- LegalPage.tsx        renders the Terms of Use / Privacy Notice
|-- content/
|   `-- legal.ts             bilingual Terms of Use + Privacy Notice text (draft, pending counsel)
|-- fixtures/
|   |-- exampleLetters.ts    fictional demo letters with dates generated relative to today
|   `-- examplePerson.ts     fictional example person + the sample-ID barcode payload
|-- lib/
|   |-- archive.ts           the SINGLE audited storage module (IndexedDB, opt-in save)
|   |-- download.ts          local blob-URL download helper
|   |-- profile/schema.ts    profile schema: drives the fill UI and the form mappings
|   |-- fill/util.ts         tolerant pdf-lib helpers (missing field -> warning, not crash)
|   |-- fill/forms/          per-form mappings (CDASS packet 2026, embedded I-9)
|   |-- extract/             capture: document scans (license barcode via zxing-wasm,
|   |                        license front, passport MRZ, SSN card) and carry-forward
|   |                        import of typed answers from a filled packet
|   |-- pdf.ts               pdf.js text extraction (encrypted/invalid PDF handling)
|   |-- ocr.ts               tesseract.js OCR over the vendored assets (read side)
|   |-- deadline.ts          bilingual deadline-date extraction
|   |-- rules.ts             deterministic classifier over the rule library
|   |-- plainLanguage.ts     locale resolution for rule content
|   |-- rules.generated.ts   GENERATED from rules/co/letter-types.yaml (do not edit)
|   |-- format.ts            date / urgency formatting helpers
|   |-- summaryPdf.ts        one-page PDF summary via pdf-lib
|   `-- fill/                write-side groundwork (pdf-lib), adopted from CDASS Enroll
`-- test-setup.ts            Vitest setup

scripts/
|-- gen-rules.mjs            compile rules/co/letter-types.yaml -> src/lib/rules.generated.ts
`-- vendor-ocr.mjs           copy tesseract worker/WASM/language data + zxing WASM into public/vendor
```

## Editing the rules

The rule content lives in `../rules/co/letter-types.yaml` (advocate-editable).
After editing it, run `npm run gen:rules` to regenerate `src/lib/rules.generated.ts`
(this also runs automatically before dev/build/test). Do not edit the generated
file by hand.

## Non-obvious choices

- No Tailwind in v0.1. Plain CSS with custom properties is fast to ship and easier to keep accessible. Revisit if it costs us velocity.
- No state library. React state and context are sufficient for v0.1.
- No client-side routing. Single-page flow until v0.2 needs more; the Terms and Privacy pages are plain hash views (`#terms`, `#privacy`) handled in App, readable before the consent gate is accepted.
- The locale, the theme override, and consent-gate acceptance are held in memory only (no cookie, no localStorage), consistent with "nothing persists by default" in `../docs/privacy.md`.
- OCR and barcode assets are vendored to our own origin and the production CSP sets `connect-src 'self'`, so the photo and document-scan paths make no third-party network request. The host should also send the CSP (plus `frame-ancestors 'none'`) as a real header.
- The fill view's demo affordances (the example person and the scannable example ID at `public/examples/example-license-barcode.png`) are clearly fictional and tested to stay that way (`fixtures/examplePerson.test.ts`).
- `noUncheckedIndexedAccess` is on in tsconfig because the prevented class of bugs is exactly the kind we cannot afford in a tool handling someone's coverage status.

## See also

- `../docs/spec-v0.1.md`
- `../docs/architecture.md`
- `../docs/privacy.md`
- `../docs/accessibility.md`
