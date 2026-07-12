# Coverage Compass *(working title)*

[![CI](https://github.com/owenpkent/coverage-compass/actions/workflows/ci.yml/badge.svg)](https://github.com/owenpkent/coverage-compass/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/owenpkent/coverage-compass?color=blue)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![good first issues](https://img.shields.io/github/issues/owenpkent/coverage-compass/good%20first%20issue?color=7057ff&label=good%20first%20issues)](https://github.com/owenpkent/coverage-compass/contribute)
![Accessibility: WCAG 2.2 AA](https://img.shields.io/badge/a11y-WCAG_2.2_AA-success)
![Privacy: local-only](https://img.shields.io/badge/privacy-local--only%2C_no_server-informational)
![Status: demo live](https://img.shields.io/badge/status-v0.1_demo_live-brightgreen)

A free, open source tool to help disabled Coloradans keep their Medicaid when Colorado's new work-reporting rules take effect in 2027. Built with [CCDC](https://ccdconline.org/) (Colorado Cross-Disability Coalition) as the design partner.

**Status:** a live demonstration is up at **[coverage-compass-6ky.pages.dev](https://coverage-compass-6ky.pages.dev)**. Drop a PDF or photo of a letter, paste its text, or click one of the built-in fictional example letters, and the app reads it on your device, classifies it against the Colorado rule library, and explains it in plain language with the deadline and next steps, in English or Spanish, in light or dark mode. The write side is in too, as an early preview: the proven [CDASS Enroll](https://github.com/owenpkent/cdass-enroll) form-fill engine is ported into the app, and the demo can fill the real 22-page CDASS/PPL attendant packet, including starting from a previously filled packet and copying its typed answers forward for review (the carry-forward pattern Medicaid renewals will reuse). The filled packet is then shown on screen to review and, optionally, sign before it downloads, instead of a blind download. Saving anything is strictly opt-in and local; a privacy-guard test fails the build if any code ever touches storage outside the one audited module. The demo sits behind a click-through release, with in-app Terms of Use and Privacy Notice pages (drafts, pending legal review). It passes 117 unit tests, automated accessibility checks, and a production build. The rule content and Spanish still need CCDC and native-speaker review before this is more than a demo. First public version targeted August 2026, before the state begins mailing notification letters.

**This README is a partner brief.** [CCDC](https://ccdconline.org/) (lived expertise, member trust, advocate review) is the confirmed partner and the on-the-ground organization that closes the loop. The brief exists to invite two more organizations into the build alongside CCDC: [Code for America](https://codeforamerica.org/) (safety-net civic tech, multi-state reusability) and [Anthropic](https://www.anthropic.com/) (responsible AI patterns for the parts of the tool that need them). Code for America and Anthropic already have a public-benefits collaboration.

## What's happening in Colorado

Starting January 2027, Coloradans on Medicaid will have to either work 80 hours a month or prove they qualify for an exemption. Common exemptions include SSDI, HCBS waivers, LTSS, the Medicaid Buy-In program, and "medically frail" status.

Most CCDC members already qualify. The danger is not the rule itself. The danger is the paperwork. When Arkansas tried something similar in 2018, thousands of people lost coverage not because they failed the rule, but because they could not prove their exemption in time. The state did not get the right paperwork by the right date. That is what this tool is built to prevent.

The schedule that drives every other date in this project:

| Date | Event |
|---|---|
| June 2026 | Final CMS guidance expected |
| August 2026 | HCPF begins mailing notification letters |
| January 2027 | First impact wave: new applications and renewals must comply |

## What the tool does

A privacy-local document organizer for three Medicaid life events. The same personal archive (Social Security award letters, HCBS waiver paperwork, tax returns, diagnosis letters, work hours if applicable) serves all three.

Coverage Compass is built in two parts. The first is a proven engine: a local-first, zero-runtime-network form-autofill engine that is a working proof of concept today in [CDASS Enroll](https://github.com/owenpkent/cdass-enroll). It is the foundation, not a future borrow. The engine is headless and framework-agnostic. One schema is the source of truth, a capture pipeline fills the profile from documents the person already holds (AAMVA barcode via zxing-wasm, passport MRZ, tesseract.js OCR, all verify-everything), and a fill layer of pure functions over pdf-lib maps profile values to exact PDF field names and saves the official template without flattening, so the output is an exact, still-editable copy that downloads locally. Signatures are never fabricated, attestation checkboxes are gated on unambiguous data, and a smoke test reloads the output to confirm it stayed an exact copy. The second part is the new Coverage Compass shell built around the engine: the accessible UI, the read side (notice triage), and the personal archive. The same engine is shared with CDASS Enroll. See [`docs/architecture.md`](docs/architecture.md) and [`docs/form-fill-engine.md`](docs/form-fill-engine.md).

1. **Reporting.** Ongoing proof you still qualify. For the small minority who must work, that means 80-hour-per-month attestation. For the majority on an exemption, it means periodic re-attestation that the exemption still applies.
2. **Reapplication.** Renewals (typically every 12 months) and new applications. The heaviest practical lift for CCDC's constituency, and where procedural disenrollment usually happens. These forms re-ask the same facts every year and can run dozens of pages, including the CDASS care-hours worksheet that itemizes attendant-care minutes per task. The tool stores your answers once and pre-fills next year's renewal from what you already filed, so a yearly 80-page form becomes a review-and-correct step. The same pre-fill can help a CCDC advocate or county caseworker prepare the form with a member.
3. **Appeals.** If a denial, termination, or care reduction arrives, the tool runs a short structured interview and drafts an appeal. The draft routes to a CCDC advocate for review before it is filed. It does not replace a CCDC advocate or an attorney.

The entry point is a notice-triage step: drop a letter from HCPF or PEAK, get a plain-language summary, the deadline, and a pointer to which of the three flows applies.

Full v0.1 product spec: [`docs/spec-v0.1.md`](docs/spec-v0.1.md). UI mockups: [`docs/ui-brainstorm.md`](docs/ui-brainstorm.md) (fourteen static HTML mockups grouped by the three events plus triage, openable in a browser).

## Why three partners

The problem does not fit cleanly inside any one of these organizations. It needs all three.

### [CCDC](https://ccdconline.org/): lived expertise, member trust, advocate-in-the-loop

CCDC owns the Colorado rules. Exemption categories, deadlines, letter patterns, and plain-language explanations live in flat YAML files that an advocate can read and propose edits on without writing code. CCDC also owns the appeals review step: every appeal draft routes through a CCDC advocate before the state sees it. That keeps the tool firmly inside the unauthorized-practice-of-law boundary and keeps disabled Coloradans hearing from a person they already trust.

What CCDC brings: institutional home, advocate review, 10 to 20 anonymized sample letters from the archive (under data terms CCDC sets) to train and verify the v0.1 classifier, and the ability to put this in members' hands.

Current status: confirmed partner. The scoping conversation with CCDC's appeals and advocacy staff has happened; the working brief is [`docs/pitch-ccdc.md`](docs/pitch-ccdc.md) (with [`docs/pitch-ccdc-email.md`](docs/pitch-ccdc-email.md)). The author is a CCDC member. Active work with CCDC: rule-content review, the first 10 to 20 anonymized sample letters to validate the classifier, and a named advocate reviewer for `rules/**`.

### [Code for America](https://codeforamerica.org/): safety-net civic tech, methodology, reusability

CfA's Safety Net Innovation Lab and the GetCalFresh lineage have spent a decade learning what works when civic tech meets public benefits administration. CfA also already maintains [`work-requirements-self-advocacy-tool`](https://github.com/codeforamerica/work-requirements-self-advocacy-tool) (North Carolina, SNAP). The pattern overlap with this project is high; the lane is different (Medicaid, disability-rooted, privacy-local, advocate-in-the-loop). The cleanest outcome is shared infrastructure across states rather than parallel rebuilds.

What CfA brings: a decade of safety-net product methodology, brigade volunteers (Code for Denver / Code for Colorado if active), pointers to counterpart coalitions in other states, and a likely path to lifting the engine into other H.R. 1 states as their deadlines arrive.

Current status: pitch drafted ([`docs/pitch-cfa.md`](docs/pitch-cfa.md)). Not yet sent.

### [Anthropic](https://www.anthropic.com/): responsible AI for the parts that need it

Most of v0.1 is rule-based, not AI. Letter classification, deadline extraction, and exemption matching run from the YAML rule library, deterministically, in the user's browser. That choice is deliberate: privacy by architecture beats privacy by policy when the threat model includes the state itself.

The later phases have parts where careful LLM use is the right answer:

- **Plain-language library** (v0.1 and ongoing). Producing 6th-grade-reading-level explanations of new letter types as HCPF introduces them. Author writes, Claude proposes, a CCDC advocate signs off. The artifact ships statically; the model is not in the user's runtime.
- **Appeal drafter** (v0.3, Q1 2027). Proposing a first draft from a structured interview, which a CCDC advocate edits before it reaches the state. The model never touches member data without advocate oversight.
- **Evaluation and red-teaming.** The classifier and the draft generator both need adversarial testing for the ways they fail on real disability casework. This is the exact methodology the existing CfA + Anthropic public-benefits collaboration already practices.

What Anthropic brings: model access for the advocate-side workflows above, the human-in-the-loop pattern the existing CfA partnership is built on, and amplification when the engine is ready to be lifted into other states.

Current status: pitch drafted ([`docs/pitch-anthropic.md`](docs/pitch-anthropic.md)). Direct outreach, in parallel with CfA.

## Non-negotiable constraints

These do not change regardless of who joins.

- **Privacy by architecture.** Everything runs in the user's browser. No server, no accounts, no telemetry. Documents never leave the device. Threat model: [`docs/privacy.md`](docs/privacy.md).
- **Accessibility is the floor, not a feature.** WCAG 2.2 AA, screen-reader-first, keyboard-only flows. English and Spanish from day one. Standard and testing approach: [`docs/accessibility.md`](docs/accessibility.md).
- **6th-grade plain language.** Enforced in CI before user-facing copy lands.
- **Advocate-in-the-loop for appeals.** The tool drafts; CCDC files. No direct-to-state path.
- **Open source.** Licensed under Apache 2.0 ([`LICENSE`](LICENSE), reasoning in [`LICENSE-DECISION.md`](LICENSE-DECISION.md)). Anyone can audit exactly what the tool does, including the partners listed above.

## What's already done

The write side is proven, not planned. It runs today in [CDASS Enroll](https://github.com/owenpkent/cdass-enroll), a working proof of concept that fills the Colorado CDASS/PPL attendant enrollment packet from documents the applicant already holds. Coverage Compass adopts that engine as a headless TypeScript module rather than rebuilding it.

Proven today (in CDASS Enroll, adopted as-is):

- Local-only, zero-runtime-network architecture, with in-browser OCR.
- The capture-once schema and profile that is the single source of truth.
- Document extraction (AAMVA barcode, passport MRZ, tesseract.js OCR), all behind a verify-everything review step.
- Filling official PDFs into exact, still-editable copies (pure functions over pdf-lib, never flattened).
- Conservative attestation gating: signatures are never fabricated, fact-asserting checkboxes are checked only on unambiguous data.
- Privacy hygiene: retention auto-clear, scrub-after-generate, vendored OCR and WASM assets, a Content-Security-Policy that blocks runtime network.
- An exact-copy smoke test that reloads the output and asserts page and field counts match the blank template.

New for Coverage Compass (the shell around the engine):

- **The read side (notice triage), built and tested.** On-device PDF text extraction (pdf.js) and photo OCR (tesseract.js, with the worker, WASM, and English/Spanish language data vendored to our own origin), a deterministic classifier over the advocate-editable YAML rule library, and a plain-language result with a prominent deadline, the do-nothing consequence, and concrete next actions. English and Spanish via react-intl, an optional downloadable one-page PDF summary, offline support via a service worker, and a production Content-Security-Policy that blocks any third-party network. Covered by unit, accessibility (axe-core), and lint checks plus a green build.
- **The write side, ported and live in the demo (early preview).** The engine now runs inside Coverage Compass: the schema, tolerant fill helpers, and the CDASS/PPL packet mapping fill the real 22-page official form behind a check-every-answer review at the demo's `#fill` view; a previously filled packet can be imported to pre-fill the form (carry-forward); the filled packet is then shown on screen to review and optionally sign before download; and the capture pipeline scans a driver's license barcode, license front, passport, or Social Security card on-device to fill the matching fields. A clearly-fictional example person and a scannable example ID let the whole flow be demonstrated without anyone's real documents. The opt-in personal archive persists only through one audited IndexedDB module, enforced by a privacy-guard test.
- Full scoping documentation: architecture, privacy threat model, accessibility standard, roadmap anchored to the Colorado timeline, glossary, Colorado rules reference.
- Prior-art survey across roughly 50 sources ([`research/prior-art.md`](research/prior-art.md)).
- CCDC confirmed as the partner organization (scoping conversation held); pitches to Code for America and Anthropic drafted.
- Rule library seeded for Colorado: five letter types (now bilingual, driving the classifier) and eight exemption categories. All entries marked "verify with CCDC" until reviewed.
- Fourteen static HTML mockups exploring UI archetypes across all three events plus the triage entry ([`docs/ui-brainstorm.md`](docs/ui-brainstorm.md)).

Still ahead: CCDC review of the rule content and 10 to 20 real anonymized Colorado letters to validate the classifier, native-speaker review of the Spanish, manual NVDA/VoiceOver/keyboard testing, a 6th-grade reading-level check in CI, hardening the demo deployment (SRI, reproducible build, legal review of the release wording), advocate-in-the-loop review, the Medicaid-specific schema growth (household, income, exemption category and evidence, renewal dates, the CDASS care-hours worksheet which is the IHSS Care Plan), and extending carry-forward pre-fill from the CDASS packet to Medicaid renewals.

Full snapshot: [`PROJECT-STATUS.md`](PROJECT-STATUS.md).

## Other tools this same pattern could power

The Medicaid tool is the first application of a reusable kit: a privacy-local document archive, a per-state YAML rule library an advocate can edit without writing code, a plain-language explainer, a headless document-extraction and PDF form-fill engine (the foundation Coverage Compass is built on, proven in a sibling project, [CDASS Enroll](https://github.com/owenpkent/cdass-enroll), and shared with it), an advocate-in-the-loop review step for anything that gets sent to a government agency, and a WCAG 2.2 AA accessible UI. Once that kit exists, other tools CCDC members need become much cheaper to build. A short list, in rough order of pattern fit:

- **ADA Title II / III complaint drafter.** Structured intake walks a member through what happened, drafts a complaint to DOJ or the Colorado Civil Rights Division, routes to a CCDC advocate before filing. Same advocate-in-the-loop pattern as Medicaid appeals.
- **Reasonable accommodation request generator (housing and employment).** Drafts Fair Housing Act accommodation requests to landlords or ADA accommodation requests to employers from a short interview. The personal document archive carries over.
- **Olmstead / community-based services self-advocacy tool.** Helps members request community-based alternatives to institutional placement, with letter templates, deadline tracking, and a plain-language rights primer.
- **Paratransit and accessible-transit complaint tracker.** Logs RTD Access-a-Ride denials, late pickups, and accessibility failures over time, then generates an FTA complaint when a pattern emerges. The data stays on the user's device.
- **Benefits stack visualizer.** Shows how SSDI, SSI, Medicaid, SNAP, Section 8, and CDASS interact when income or hours change, so members can stress-test a decision (taking a job, moving, marrying) before they make it. Read-only, no PII required.
- **IEP / 504 prep tool.** Helps parents and adult students organize evaluations, prior plans, and proposed accommodations into a meeting packet, with plain-language explanations of procedural rights.
- **SOAR-style SSI / SSDI application helper.** Document checklist, deadline reminders, and a structured interview that an advocate can review before submission.

These are not commitments. They are evidence that the architecture is general, and an open question for CCDC: if Medicaid is not the right first tool, or if a second tool should start in parallel, the same volunteer time and the same partner conversations can point at any of them. The Medicaid tool is the proposed first build because the January 2027 deadline is what makes it urgent.

## The ask

**For CCDC (confirmed partner).** The working relationship is already underway. The live items are the rule-content review, the first anonymized sample letters to validate the classifier, a named advocate reviewer for `rules/**`, and the appeals review step. Working brief: [`docs/pitch-ccdc.md`](docs/pitch-ccdc.md).

**For Code for America.** Thirty minutes to check pattern overlap with the existing `work-requirements-self-advocacy-tool`, surface any in-flight work on Medicaid administrative burden or H.R. 1 prep, and connect with counterpart coalitions in other states. Agenda: [`docs/pitch-cfa.md`](docs/pitch-cfa.md).

**For Anthropic.** Thirty to forty-five minutes on model access and methodology for the advocate-side LLM workflows (plain-language library, appeal drafter, evaluation), and how this coordinates with the existing CfA collaboration. Agenda: [`docs/pitch-anthropic.md`](docs/pitch-anthropic.md).

No funding ask from any of the three. The build is volunteer time.

## How to engage

- File an issue or open a discussion on this repository.
- Reach the author on [LinkedIn](https://www.linkedin.com/in/owenpkent).

## Who is building it

Owen Kent, a CCDC member and software engineer. Volunteer work. No funding ask, no revenue model.

## What's in this repository

```
.
|-- README.md                  this file (partner brief)
|-- PROJECT-STATUS.md          single-page snapshot of where the project stands
|-- CHANGELOG.md               what has changed and when
|-- CONTRIBUTING.md            how to get involved
|-- CODE_OF_CONDUCT.md         community standards
|-- SECURITY.md                how to report a security concern
|-- LICENSE                    legal terms (Apache 2.0)
|-- LICENSE-DECISION.md        why Apache 2.0 (decided)
|-- NOTICE                     third-party attributions
|-- docs/                      plain-language and technical documentation
|   |-- brainstorm.md          why this project exists
|   |-- spec-v0.1.md           what the first version does (notice triage)
|   |-- spec-v0.2.md           reapplication: pre-fill renewals from your archive
|   |-- roadmap.md             dates and milestones, tied to the CO rollout
|   |-- architecture.md        how the tool is built
|   |-- form-fill-engine.md    the proven CDASS Enroll engine (the write side) and how it is adopted
|   |-- privacy.md             what we do and don't collect, and why
|   |-- accessibility.md       accessibility standard and testing approach
|   |-- ui-brainstorm.md       fourteen HTML mockups across three events plus triage, with trade-offs
|   |-- mockups/               openable static HTML mockups (drop into a browser)
|   |-- glossary.md            plain definitions of SSDI, HCBS, CDASS, LTSS, PEAK, etc.
|   |-- colorado-rules.md      Colorado exemption categories, deadlines, and sources
|   |-- outreach.md            CCDC and Code for America contact plan
|   |-- pitch-ccdc.md          working brief for the CCDC partnership (was the original pitch)
|   |-- pitch-ccdc-email.md    paste-able working-relationship emails for the CCDC contact
|   |-- pitch-cfa.md           one-page pitch for Code for America
|   |-- pitch-anthropic.md     one-page pitch for Anthropic
|   `-- formfest-2026-application.md  FormFest 2026 session proposal (paste-ready)
|-- web/                       the web app itself
|-- rules/                     per-state rule libraries (plain text, reviewable)
|   `-- co/                    Colorado
|-- research/                  anonymized samples and prior-art notes (not published)
|-- scripts/                   helper scripts for maintainers
`-- .github/                   issue and pull request templates
```

## For developers

Architecture, privacy threat model, accessibility standard, roadmap, and contribution notes live in [`docs/`](docs/). Start with [`docs/architecture.md`](docs/architecture.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Apache 2.0. See [`LICENSE`](LICENSE) for the full terms and [`LICENSE-DECISION.md`](LICENSE-DECISION.md) for the reasoning. Copyright Owen Kent and Coverage Compass contributors. Contributions are inbound equals outbound: anything you contribute is licensed under Apache 2.0 per its section 5. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
