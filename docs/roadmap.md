# Roadmap

Dates are anchored to the [Colorado work-requirements rollout](colorado-rules.md). Slipping these means missing the wave of people who get their first work-requirement letter.

## v0.0 Foundation (May 2026 to July 2026)

- [x] Brainstorm and direction (2026-05-11)
- [x] Scaffold repo
- [x] CCDC outreach pitch drafted (2026-05-11; `docs/pitch-ccdc.md`, `docs/pitch-ccdc-email.md`)
- [x] Survey of prior art (2026-05-11; `research/prior-art.md`)
- [x] CfA outreach pitch drafted (2026-05-11; `docs/pitch-cfa.md`)
- [x] CCDC confirmed as partner organization
- [x] Scoping conversation with CCDC appeals/advocacy staff (see `outreach.md`)
- [ ] CfA pitch sent
- [x] License decision: Apache 2.0 (see `LICENSE` and `LICENSE-DECISION.md`)
- [ ] First 10 anonymized sample letters from CCDC
- [ ] Plain-language review process established with CCDC

**Exit criteria:** CCDC has a named point of contact, scope is validated against real bottleneck, license chosen, at least 10 sample letters in hand.

## v0.1 Notice Triage (target: August 2026)

Ships before the first wave of notification letters goes out from HCPF in August 2026.

- [x] UI brainstorm (2026-05-16; fourteen HTML mockups in `docs/mockups/` across the three events plus triage, summarized in `docs/ui-brainstorm.md`)
- [x] Vite + React + TS app scaffolded
- [x] PDF intake (pdf.js) and image OCR (tesseract.js), with OCR assets vendored to our own origin
- [x] Letter classifier (rule-based, deterministic, generated from the YAML rule library)
- [x] Deadline extraction (bilingual)
- [x] Spanish translation present (react-intl; native-speaker review still pending)
- [x] PWA install + offline mode
- [x] Automated accessibility checks (axe-core) and a jsx-a11y lint gate
- [ ] Plain-language explanation library reviewed by a CCDC advocate
- [ ] Manual screen-reader pass (NVDA, VoiceOver, keyboard-only)
- [ ] 10 to 20 real anonymized Colorado letters to validate the classifier
- [x] 6th-grade reading-level check enforced in CI (blocking as of #64; scores the rule-library strings, not yet UI chrome in `src/`)
- [ ] Hosted on a stable URL with SRI and reproducible build (a demo deployment is live at [coverage-compass-6ky.pages.dev](https://coverage-compass-6ky.pages.dev) since 2026-07-01, behind a click-through release; SRI and the reproducible-build story are still pending)
- [ ] CCDC advocate user test passes

**Exit criteria:** all acceptance criteria in `spec-v0.1.md` pass. The build is done and a demo is deployed; the remaining items are CCDC content review, validation against real letters, native Spanish review, manual screen-reader testing, and hardening the deploy (SRI, reproducible build, legal review of the release wording).

## v0.2 Exemption Packet (target: November 2026 to January 2027)

Ships before the first impact wave on 2027-01-01.

The write side is already proven. The CDASS Enroll proof of concept is a working, local-first form-autofill engine: one schema is the source of truth, a capture pipeline fills the profile from documents the person already holds, and pure functions over pdf-lib map profile values to exact PDF field names and save the official template's AcroForm without flattening, producing an exact, still-editable copy. v0.2 is about adopting and mapping that engine for Medicaid forms, not inventing it. The capture pipeline itself is ported as of 2026-07-02 (license barcode, license front, passport MRZ, and Social Security card, all decoded on-device in the `#fill` preview); the Medicaid-specific document readers below build on it. See [`form-fill-engine.md`](form-fill-engine.md).

- [ ] Document classifier for SSA award letters and waiver enrollment letters
- [ ] Tax-return reader for W-2 / 1099-NEC / Schedule C / Schedule SE (PDF, not IRS API)
- [ ] Exemption decision tree (SSDI -> HCBS -> LTSS -> Buy-In -> medically frail -> caregiver)
- [ ] Packet template generator (PDF output with cover letter and labeled exhibits). The engine adoption is done (2026-07-02): the ported fill layer generates the real CDASS packet in the demo's `#fill` preview, shown for on-screen review and optional signing before download; what remains here is the Medicaid form mappings and the cover-letter/exhibit assembly; see [`form-fill-engine.md`](form-fill-engine.md)
- [ ] Carry-forward pre-fill: keep the archive across years and pre-fill next year's renewal and redetermination from the prior filing, turning a multi-page yearly form into a review-and-correct step. The mechanism shipped 2026-07-02 for the CDASS packet (import a previously filled packet, review, generate); extending it to Medicaid renewals awaits the form mappings
- [ ] CDASS care-hours worksheet pre-fill: carry the itemized minutes-per-task care plan (the IHSS Care Plan) forward from the prior worksheet and the archive
- [ ] Renewal calendar with deadline tracking (IndexedDB, local only)
- [ ] Updated CCDC user test

**Exit criteria:** an SSDI recipient and an HCBS waiver recipient can each generate a usable exemption packet end-to-end, validated by a CCDC advocate.

## v0.3 Appeal Draft (target: Q1 2027)

For the first wave of disenrollments arriving on or after 2027-01-01.

- [x] UI brainstorm (2026-05-16; fourteen HTML mockups in `docs/mockups/` across the three events plus triage, summarized in `docs/ui-brainstorm.md`)
- [ ] Denial/termination letter classifier
- [ ] Short structured interview (cause of denial, what user disagrees with)
- [ ] Appeal letter templates (one per common denial pattern)
- [ ] Output explicitly routed to a CCDC advocate, not direct-to-state
- [ ] UPL disclaimers reviewed by CCDC counsel
- [ ] CCDC advocate intake workflow

**Exit criteria:** CCDC advocates report material time savings on routine procedural-termination appeals.

## Post-MVP backlog

Not committed, not ordered.

- HCBS waiver navigator (`docs/brainstorm.md` idea #6)
- CDASS toolkit (`docs/brainstorm.md` idea #4)
- Procedural-disenrollment incident tracker for CCDC policy advocacy (`docs/brainstorm.md` idea #7)
- Multi-state expansion (start with another state coalition that wants to adopt)
- Caseworker mode: let a CCDC advocate or county caseworker pre-fill and review the same forms with a member, on the member's device
- Tauri desktop wrapper for kiosk use
- Locally-run small LLM for free-form notice translation
