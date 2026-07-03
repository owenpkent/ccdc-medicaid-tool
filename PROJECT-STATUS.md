# Project status

**Snapshot date:** 2026-07-03
**Phase:** v0.1 Notice Triage (read side implemented and tested; live demo deployed; pending CCDC content review, native Spanish review, and manual screen-reader testing)
**Working title:** Coverage Compass

This is a single-page snapshot of where the project stands. For detail, follow the links into `docs/` and `research/`.

## At a glance

- **Goal:** help disabled Coloradans keep their Medicaid when Colorado's work-reporting requirements take effect in 2027, and help CCDC advocates draft appeals when something goes wrong.
- **Partner:** [Colorado Cross-Disability Coalition](https://ccdconline.org/) (confirmed; institutional home and advocate-in-the-loop).
- **Built by:** one volunteer software engineer (CCDC member). No funding ask, no revenue model.
- **Architecture:** Coverage Compass is now re-architected around the proven **CDASS Enroll** engine: a local-first, zero-runtime-network form-autofill engine that is a working proof of concept today. The engine is the foundation, not a future borrow. See [`docs/architecture.md`](docs/architecture.md) and [`docs/form-fill-engine.md`](docs/form-fill-engine.md).
- **License:** decided. Apache 2.0 (see [`LICENSE`](LICENSE) and [`LICENSE-DECISION.md`](LICENSE-DECISION.md)).
- **Status:** the v0.1 read side (notice triage) is now implemented in `web/` and works locally: drop a PDF or photo (or paste text), and the app reads it on-device, classifies it against the Colorado rule library, and explains it in plain language with the deadline and next steps, in English or Spanish. It passes unit tests, automated accessibility checks, lint, and a production build. What remains before release is content (CCDC review of the rules, real Colorado sample letters, native Spanish review) and verification (manual NVDA/VoiceOver/keyboard passes). A **live demonstration deployment** is up at [coverage-compass-6ky.pages.dev](https://coverage-compass-6ky.pages.dev) behind a bilingual click-through release (session-only, wording pending CCDC legal review), with four clearly-fictional example letters so the flow can be shown without any real document, light/dark mode, and in-app bilingual Terms of Use and Privacy Notice pages carrying the demo's waiver and release language (draft, pending CCDC counsel review). The **write side is ported and working as an early preview**: the CDASS Enroll engine lives in `web/src/lib` (schema, tolerant fill helpers, per-form mappings), the demo's `#fill` view fills the real CDASS/PPL attendant packet end to end behind a check-every-answer review, a previously filled packet can be imported to pre-fill the form (carry-forward), and the personal archive persists only through one audited, strictly opt-in IndexedDB module, enforced by a privacy-guard test. The document-library design is specced in [`docs/document-library.md`](docs/document-library.md) with its first registry entry live in `rules/co/forms/`. A data-access proposal to HCPF is drafted ([`docs/proposal-hcpf-data-access.md`](docs/proposal-hcpf-data-access.md)), gated on CCDC review.
- **First ship target:** v0.1 (notice triage) in August 2026, before HCPF starts sending work-requirement letters.

## What this is

A free, open-source web app that organizes a disabled Coloradan's Medicaid evidence once and reuses it across three events: reporting (ongoing proof of qualifying status), reapplication (renewals and new applications), and appeals. Everything runs entirely in the user's browser. No server, no account, no telemetry.

The system is two parts:

1. **The engine (proven in CDASS Enroll).** A local-first, zero-runtime-network form-autofill engine. One schema is the source of truth; a capture pipeline fills the profile from documents the person already holds (AAMVA barcode via zxing-wasm, passport MRZ, tesseract.js OCR, all verify-everything); a fill layer of pure functions over pdf-lib maps profile values to exact PDF field names and saves the official template's AcroForm without flattening, producing an exact, still-editable copy that downloads locally. Signatures are never fabricated, attestation checkboxes are gated on unambiguous data, and an exact-copy smoke test reloads the output and asserts page and field counts match the blank template. This is the write side, and it works today.
2. **The Coverage Compass shell (new, built around the engine).** An accessible WCAG 2.2 AA React + React Aria UI in English and Spanish; read-side notice triage using pdf.js plus tesseract.js against an advocate-editable per-state YAML rule library; advocate-in-the-loop review; and a personal archive persisted in IndexedDB.

Across the three events:

- **Reporting.** 80-hour-per-month attestation for the work-required minority; periodic exemption re-attestation for the majority.
- **Reapplication.** Annual renewals and new applications. The heaviest practical lift for CCDC's constituency, and where procedural disenrollment usually happens. This is the engine's natural home: carry-forward pre-fill turns an 80-page yearly form into a review-and-correct step.
- **Appeals.** Denial / termination / care-reduction letter in, structured interview, draft appeal out. Routes through a CCDC advocate before it reaches the state.

Entry point is notice triage: drop an HCPF or PEAK letter, get a plain-language summary, the deadline, and a pointer to which flow applies.

Full framing: [`docs/brainstorm.md`](docs/brainstorm.md). MVP scope: [`docs/spec-v0.1.md`](docs/spec-v0.1.md). The write side in detail: [`docs/form-fill-engine.md`](docs/form-fill-engine.md).

## The deadline that drives everything

The Colorado rollout schedule, from [`docs/colorado-rules.md`](docs/colorado-rules.md):

| Date | Event |
|---|---|
| June 2026 | Final CMS guidance expected |
| August 2026 | HCPF begins sending notification letters |
| January 2027 | First impact wave: new applications and renewals must comply |

The roadmap in [`docs/roadmap.md`](docs/roadmap.md) is anchored to these dates. Slipping them means missing the wave of people who get their first notification letter.

## What's done

### v0.0 Foundation checklist (from roadmap)

- [x] Brainstorm and direction (2026-05-11)
- [x] Scaffold repo
- [x] CCDC outreach pitch drafted ([`docs/pitch-ccdc.md`](docs/pitch-ccdc.md), [`docs/pitch-ccdc-email.md`](docs/pitch-ccdc-email.md))
- [x] CfA outreach pitch drafted ([`docs/pitch-cfa.md`](docs/pitch-cfa.md))
- [x] Anthropic outreach pitch drafted ([`docs/pitch-anthropic.md`](docs/pitch-anthropic.md))
- [x] Prior-art survey ([`research/prior-art.md`](research/prior-art.md))
- [x] License decision: Apache 2.0 ([`LICENSE`](LICENSE), [`LICENSE-DECISION.md`](LICENSE-DECISION.md))
- [x] Re-architecture around the proven CDASS Enroll engine ([`docs/architecture.md`](docs/architecture.md), [`docs/form-fill-engine.md`](docs/form-fill-engine.md))
- [x] CCDC confirmed as partner organization
- [x] Scoping conversation with CCDC appeals/advocacy staff
- [ ] CfA pitch sent
- [ ] Anthropic pitch sent
- [ ] First 10 anonymized sample letters from CCDC
- [ ] Plain-language review process established with CCDC

### The engine, proven in the sibling proof of concept

The write side is not a plan. It is a working proof of concept in **CDASS Enroll** ([github.com/owenpkent/cdass-enroll](https://github.com/owenpkent/cdass-enroll)), a local-only web app that fills the Colorado CDASS/PPL attendant enrollment packet (a 28-page PPL packet plus IRS W-4, optional standalone I-9) from documents the applicant already holds. Its approach is written up in its [white paper](https://github.com/owenpkent/cdass-enroll/blob/master/docs/whitepaper.md).

Proven today in that proof of concept, adopted as-is:

- Local-only, zero-runtime-network architecture.
- In-browser OCR (tesseract.js) with image enhancement and verification.
- Capture-once profile driven by a single schema.
- Document extraction: AAMVA barcode (zxing-wasm), passport MRZ, OCR with plausibility checks, all verify-everything.
- Filling official PDFs into exact, still-editable copies (pdf-lib, no flatten).
- Conservative attestation gating; signatures never fabricated.
- Privacy hygiene: retention auto-clear, scrub-after-generate, vendored OCR/WASM assets, Content-Security-Policy.
- Exact-copy smoke-test verification.

The integration model is decided: adopt the engine into the Coverage Compass web app as a headless TypeScript module now (porting the pure CDASS Enroll modules verbatim into `web/src/lib`). Extracting it into a shared monorepo package is an explicit future-only option, once a second consumer justifies the overhead.

### Documentation produced

- Architecture and stack, re-framed around the proven engine ([`docs/architecture.md`](docs/architecture.md))
- Form-fill engine plan: the write side, file-by-file ([`docs/form-fill-engine.md`](docs/form-fill-engine.md))
- Privacy posture and threat model ([`docs/privacy.md`](docs/privacy.md))
- Accessibility standard ([`docs/accessibility.md`](docs/accessibility.md))
- Glossary of Colorado Medicaid terms ([`docs/glossary.md`](docs/glossary.md))
- Colorado rules reference ([`docs/colorado-rules.md`](docs/colorado-rules.md))
- v0.1 product spec ([`docs/spec-v0.1.md`](docs/spec-v0.1.md))
- Outreach plan ([`docs/outreach.md`](docs/outreach.md))
- Three partner pitches and an email template (above; the CCDC pitch is now a working brief for the partnership)
- Prior-art survey of ~50 sources (above)
- UI brainstorm write-up and fourteen static HTML mockups grouped by the three events plus the triage entry ([`docs/ui-brainstorm.md`](docs/ui-brainstorm.md), [`docs/mockups/`](docs/mockups/))
- Hygiene files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, `CHANGELOG.md`

### Code

- **Read side (v0.1 notice triage) implemented in `web/`.** End to end: file or photo or pasted text in, on-device extraction (pdf.js for PDFs with the worker bundled local; tesseract.js for photos with the worker, WASM cores, and English/Spanish language data vendored to our own origin), deterministic classification against the rule library, and a plain-language result with a prominent deadline, do-nothing consequence, and next actions. English and Spanish via react-intl. Optional one-page PDF summary via pdf-lib. Installable/offline via a service worker. A production Content-Security-Policy blocks any third-party network. Covered by unit tests (classifier, deadline extractor), automated axe-core accessibility tests, a flat-config jsx-a11y lint, and a green production build.
- **The engine (the write side) is ported into `web/src/lib` (2026-07-01/02).** From the proven CDASS Enroll modules: `lib/profile/schema.ts` (the archive schema; Medicaid sections still to come with CCDC), `lib/fill/util.ts` (tolerant pdf-lib helpers), `lib/fill/forms/` (the CDASS/PPL Attendant Packet 2026 with its embedded I-9), and `lib/extract/packet2026.ts` (carry-forward: reads the typed answers back out of a previously filled packet). The blank official template ships in `web/public/forms/` with a registry entry in `rules/co/forms/`; exact-copy and round-trip tests run against the real 22-page PDF. The `#fill` view (early preview, behind the consent gate) does edit, check-every-answer review, then generate-and-download; the archive (`lib/archive.ts`) is the single audited storage module, opt-in only, with a privacy-guard test enforcing that nothing else ever touches storage. Capture is ported too (2026-07-02): license-barcode (zxing-wasm), license-front, passport-MRZ, and Social Security card scans fill the form on-device in `lib/extract`, and a fictional example person plus a committed scannable example ID make the flow demonstrable without real documents. Still ahead: the Medicaid schema sections, the first Medicaid form mapping, and Spanish field labels.
- Rule library in place (`rules/co/`). `letter-types.yaml` is now bilingual and drives the classifier via build-time codegen; `exemptions.yaml` and `deadlines.yaml` await the v0.2 flows. All entries remain flagged "verify with CCDC" until reviewed.

## What's next

### Immediate (the rest of June into July 2026)

1. **Move the CCDC work forward.** CCDC is on as the partner organization and the scoping conversation has happened. The live items are the rule-content review, the first 10 to 20 anonymized sample letters to validate the classifier, and a named advocate reviewer for `rules/**`. Plan in [`docs/outreach.md`](docs/outreach.md).
2. **Send the CfA pitch.** The prior-art survey makes one specific ask load-bearing: talk to the team behind [`codeforamerica/work-requirements-self-advocacy-tool`](https://github.com/codeforamerica/work-requirements-self-advocacy-tool) before duplicating screener content.
3. **Done (2026-07-01/02): the engine is ported into the shell.** Schema, tolerant fill helpers, the CDASS packet mapping with embedded I-9, carry-forward import, the `#fill` preview UI, the opt-in archive, and now the capture pipeline (license barcode, license front, passport MRZ, Social Security card, all decoded on-device) are all in `web/src/lib` and live in the demo, with a fictional example person and scannable example ID for demonstrations. The follow-on work is content: the Medicaid schema sections (with CCDC), the first Medicaid form mapping (needs the real form), and Spanish field labels.
4. **Convert prior-art findings into rule-library seed content.** NHeLP's Technical Guide, Justice in Aging's seven principles, AAPD's plain-language explainer, and the SHVS medical-frailty toolkit are the highest-value inputs.

### v0.1 Notice Triage (target August 2026)

Drop-a-letter, get-a-summary. **The read side is built:** pdf.js plus tesseract.js read the letter on-device and a deterministic classifier matches it against the advocate-editable YAML rule library and explains it in plain language, with the deadline and next steps, in English or Spanish. What remains before it ships, against the acceptance criteria in [`docs/spec-v0.1.md`](docs/spec-v0.1.md): CCDC review of the rule content, 10 to 20 real anonymized Colorado letters to validate the classifier, native-speaker review of the Spanish, manual NVDA/VoiceOver/keyboard passes, a 6th-grade reading-level check in CI, and a deploy. Ships before HCPF begins mailing.

### v0.2 Exemption Packet (target November 2026 to January 2027)

Document classifier + decision tree + packet generator. The write side here is not invented; it adopts the proven engine and maps it to the Medicaid forms (the Medicaid-specific schema growth, the Colorado form mappings, tax-document reading, and the exemption-packet assembly). Ships before the January 2027 impact wave. See [`docs/form-fill-engine.md`](docs/form-fill-engine.md).

### v0.3 Appeal Draft (target Q1 2027)

Denial-letter classifier + structured interview + draft appeal routed to a CCDC advocate. Ships in time for the first wave of disenrollments.

## Outreach status

| Org | Status | Next step |
|---|---|---|
| CCDC | Confirmed partner. Scoping conversation held. Owen is a member. | Rule-content review, first anonymized sample letters, and a named advocate reviewer for `rules/**`. |
| Code for America | Pitch drafted, scoped to Safety Net Innovation Lab and Colorado brigade. | Send. Open with the `work-requirements-self-advocacy-tool` overlap question. |
| Anthropic | Pitch drafted, scoped to the existing CfA public-benefits collaboration. | Send directly, in parallel with CfA. Reference the CfA partnership as context, not as a gate. |
| HCPF | Data-access proposal drafted 2026-07-02 ([`docs/proposal-hcpf-data-access.md`](docs/proposal-hcpf-data-access.md)): notice-template inventory, Patient Access API registration, optional PEAK Pro advocate access. Research in [`research/state-data-access.md`](research/state-data-access.md). CCDC owns the HCPF relationship. | CCDC reviews the proposal and decides whether to carry it. Meanwhile: join the Member Correspondence Improvements stakeholder meetings and use HCPF's published sample notices as classifier fixtures. |
| Stanford Legal Design Lab | Outreach plan referenced an "OCR notice translator." Survey did not find a specific shipped project matching. | Treat as methodological prior art unless the Lab confirms otherwise. |

Contact log lives in [`docs/outreach.md`](docs/outreach.md) (currently empty).

## Prior-art posture

Full survey: [`research/prior-art.md`](research/prior-art.md). The short version:

- **Closest direct analogue:** CfA's `work-requirements-self-advocacy-tool` (active, NC-only, SNAP-only, hosted Rails). Pattern overlap is high; lane is different.
- **Substantive backbone:** NHeLP's November 2025 Technical Guide to Reduce Procedural Terminations.
- **Appeal template starting point:** Justice in Aging's February 2026 letter with seven mitigation principles.
- **Exemption-evidence reference:** SHVS medical-frailty toolkit with ICD-10 / CPT crosswalk.
- **Proven internal foundation:** the CDASS Enroll engine, a working local-first form-autofill proof of concept that Coverage Compass is architected around.
- **Complementary Colorado neighbor (added 2026-07-01):** MyFriendBen, the Denver-born open-source benefits screener (prospective "what could I get"; no notice, exemption, or appeals functionality and no H.R.1 product as of 2026-07-01). Strongest candidate upstream referral partner: 211 Colorado, Denver Human Services, HCPF, and Colorado Digital Service relationships. Its rules engine, PolicyEngine, is encoding the H.R.1 work-requirement rules with statutory citations, a candidate cross-check oracle for our exemption rules. See `research/prior-art.md` section 2.10.
- **Clear gap:** No one has shipped a Medicaid-specific, client-side, advocate-in-the-loop tool with an advocate-readable rules library. That is this project's lane. Reconfirmed 2026-07-01 against MyFriendBen and PolicyEngine; exemption *screening* is commoditizing, exemption *demonstration* (our lane) remains open, and an unanswered March 2026 feature request in MyFriendBen's tracker shows live demand for it.

## Open questions and decisions pending

Open items to settle with CCDC, our partner.

1. Is procedural disenrollment the right focus for CCDC's advocacy team, or is there a higher-priority bottleneck?
2. Would CCDC use the tool internally (advocate productivity), put it in members' hands directly, or both?
3. Is the appeals-drafting feature comfortable to CCDC given UPL concerns, with the output explicitly routed through a CCDC advocate?
4. Is there a license-compatibility question with the CfA `work-requirements-self-advocacy-tool` (listed as "Other" / NOASSERTION)? Coverage Compass is Apache 2.0.
5. Which Colorado HCBS waivers count for the exemption? (EBD, SLS, CES, CIH, CMHS, BI, DD, CHCBS need confirmation.)
6. Is the "medically frail" determination automatic from existing diagnosis data, or does it require fresh documentation?
7. Spanish from day one is committed. What other languages should v0.1 plan for?
8. Which real Colorado form does the write side map first (a Medicaid renewal/redetermination form, the exemption-packet cover form, or the CDASS care-hours worksheet, the IHSS Care Plan)?

Full set of open questions: [`research/prior-art.md`](research/prior-art.md) section 5.

## Known risks

- **Schedule risk.** With CCDC confirmed as partner and the scoping conversation held, the August 2026 ship target now depends on the rule-content review and the first sample letters landing soon. Each week of delay compresses build time.
- **Validation and content risk.** The read side is built and deployed as a demo, but its rule content is unreviewed by CCDC, the classifier is not yet validated against real Colorado letters, the Spanish is machine-drafted, and a manual screen-reader pass remains. The write side is ported and fills the CDASS packet, but its UI is an English-only preview, unreviewed by CCDC, and no Medicaid form is mapped yet. The August target now depends on the CCDC review and the sample-letter validation landing on schedule, not on the build.
- **Sample-letter dependency.** v0.1 acceptance criteria require correctly classifying real Colorado letters. We need 10 to 20 anonymized samples from CCDC. Without them, the classifier is unverified.
- **Stack drift.** Tesseract.js, pdf.js, and pdf-lib are heavy. The architecture target is < 250 KB gzipped bundle and < 3s TTI on a 2019 Chromebook. As of the v0.1 read-side build, pdf.js, tesseract.js, and pdf-lib are each lazy-loaded into their own chunks, so the initial JS is roughly 110 KB gzipped (entry plus React Aria plus react-intl), within budget. TTI on real low-end hardware still needs measuring.
- **Form-revision drift.** The fill layer maps exact PDF field names per form revision. Colorado can re-issue a form with renamed fields. The engine degrades a missing or renamed field to a logged warning rather than a crash, and the exact-copy smoke test guards regressions, but each new form revision needs a fresh field dump and mapping.
- **CfA collision.** If CfA quietly builds a Medicaid version of their tool before we ship, we should reconsider the lane. Phase 2 outreach is partly to surface this.
- **Reading-level enforcement.** The 6th-grade Flesch-Kincaid target is a hard project rule, not a wish. Need a working CI tool before user-facing copy lands.

## How to help

- **Disabled Coloradans** with Medicaid experience: tell us what breaks in the renewal or appeals process.
- **CCDC staff or advocates:** the rule-content review and the first anonymized sample letters are the unblockers.
- **Civic-tech volunteers (Code for America, brigade):** code, accessibility testing, plain-language review.
- **Spanish reviewers:** native speakers for translation review.
- **Plain-language writers:** review the 6th-grade-reading-level constraint.

Contributions are licensed under Apache 2.0 (inbound equals outbound). See [`CONTRIBUTING.md`](CONTRIBUTING.md).

Contact: [LinkedIn](https://www.linkedin.com/in/owenpkent) or open an issue / discussion on this repository.

## Document map

If you're new to the repo and reading top-down:

1. [`README.md`](README.md): what this is (non-technical).
2. This file: where the project stands.
3. [`docs/brainstorm.md`](docs/brainstorm.md): why the project exists.
4. [`docs/spec-v0.1.md`](docs/spec-v0.1.md): what the first version does.
5. [`docs/ui-brainstorm.md`](docs/ui-brainstorm.md): fourteen HTML mockups across the three events plus triage, with working recommendations.
6. [`docs/architecture.md`](docs/architecture.md): the two-part system (the engine plus the shell).
7. [`docs/form-fill-engine.md`](docs/form-fill-engine.md): the proven write side, file by file.
8. [`docs/roadmap.md`](docs/roadmap.md): when each phase ships.
9. [`docs/outreach.md`](docs/outreach.md): who we need to talk to.
10. [`research/prior-art.md`](research/prior-art.md): what already exists.
11. [`docs/privacy.md`](docs/privacy.md), [`docs/accessibility.md`](docs/accessibility.md): two of the non-negotiable constraints.
12. [`CONTRIBUTING.md`](CONTRIBUTING.md): how to get involved.
13. [`CHANGELOG.md`](CHANGELOG.md): what changed recently.