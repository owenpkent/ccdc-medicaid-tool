# Contributing

This project is for disabled Coloradans and the advocates at [CCDC](https://ccdconline.org/). Contributions should serve that goal first.

You do not need to be a programmer to help. Some of the most valuable contributions are a sample letter, a sentence rewritten in plainer language, a screen-reader bug report, or a correction to a Medicaid rule. There is a path below for each of those, and a path for code too.

## Your first contribution (quickstart)

Pick the path that fits you. None of these require writing code.

1. Read the short [Code of Conduct](CODE_OF_CONDUCT.md). It is the one rule for everyone here.
2. Find something to work on:
   - Browse the [good first issues](https://github.com/owenpkent/coverage-compass/labels/good%20first%20issue) for small, well-scoped starting points.
   - Or just open an issue with the matching template below. You do not have to wait for permission to report a problem.
3. For non-code help (a sample letter, plain-language fix, accessibility report, translation note, rule correction), see [How to contribute non-code](#how-to-contribute-non-code). Most of these are a single issue.
4. For code, see [Develop the web app](#develop-the-web-app) and [The fork, branch, and pull-request workflow](#the-fork-branch-and-pull-request-workflow).

If anything below is unclear, that is a documentation bug. Open an issue and we will fix it.

## Who we want to hear from

- Disabled Coloradans with experience navigating Medicaid, appeals, work-requirement notifications, HCBS waivers, or the Buy-In program. Your lived experience is the single most valuable input to this project.
- CCDC staff, especially appeals and advocacy.
- Code for America volunteers.
- Developers experienced with accessibility (real accessibility, not "we passed Lighthouse").
- Plain-language writers.
- Spanish speakers (and eventually other-language speakers) for translation review.

## How to contribute non-code

Each of these has a matching issue template at [New issue](https://github.com/owenpkent/coverage-compass/issues/new/choose).

- **Sample letters.** If you have a Medicaid notice you're willing to share (anonymized: blot out name, address, case number, anything identifying) we want it. It teaches the letter classifier and the plain-language strings. Use the **Anonymized sample letter** template. Do not paste or attach the letter in the public issue; the template explains the private follow-up. See the anonymization checklist in [`research/README.md`](research/README.md).
- **Plain-language review.** If you read a draft summary and it's unclear, confusing, or condescending, tell us. Use the **Plain-language feedback** template.
- **Accessibility review.** If you use a screen reader, voice control, switch access, eye tracking, or any assistive tech, please try the app and tell us what breaks. Use the **Accessibility issue** template. We treat these as high priority.
- **Translation review.** Especially Spanish. The bar is "a native speaker reviewed this," not "we ran it through a translator." Use the **Plain-language feedback** template and pick the language.
- **Policy / legal review.** If you're a CCDC attorney or advocate and you see something in the per-state rule library (`rules/co/`) that's wrong, file an issue or a PR. See [Rule-library contributions](#rule-library-contributions-a-first-class-non-code-path) below.
- **Feature ideas.** Use the **Feature request** template. Check [`docs/roadmap.md`](docs/roadmap.md) first to see if it's already planned.

## How to contribute code

Coverage Compass is a 100 percent client-side web app. It is built around a proven form-fill engine (see [The shared form-fill engine](#the-shared-form-fill-engine)) and a new accessible shell on top of it. Before you write code:

1. Read [`docs/architecture.md`](docs/architecture.md), [`docs/privacy.md`](docs/privacy.md), and [`docs/accessibility.md`](docs/accessibility.md). These are non-negotiable constraints, not suggestions.
2. Open an issue before you write code, especially for anything that changes a privacy or accessibility property. A small discussion up front saves a rejected PR later.
3. Follow [Develop the web app](#develop-the-web-app) to get it running.
4. Follow [The fork, branch, and pull-request workflow](#the-fork-branch-and-pull-request-workflow) to submit.

## Develop the web app

The app lives in [`web/`](web/). Run every command below from that directory unless noted.

### Node and npm versions

Use **Node 22.22.2 or newer** and **npm 12 or newer**. Both are required in `web/package.json` (`"node": ">=22.22.2"`, `"npm": ">=12"`), and the Node version is also pinned in [`web/.nvmrc`](web/.nvmrc). `web/.npmrc` sets `engine-strict=true`, so a version below either floor fails at `npm install` with a clear message instead of breaking something subtle later. If you use `nvm`:

```bash
cd web
nvm use
npm install -g npm@12   # Node 22 still ships npm 11
```

The npm floor is about lockfile fidelity, not features. `web/package-lock.json` carries `libc` entries, which npm reads to pick musl or glibc builds of optional platform-specific packages. npm 11 and older drop them silently on any write, which buries a one-line dependency bump in about 84 lines of unrelated deletions. Node 22.22.2 is the oldest Node that npm 12 accepts, so the two floors line up exactly.

### Commands

These are the exact scripts defined in [`web/package.json`](web/package.json). Do not guess at others.

```bash
npm install        # install dependencies

npm run dev        # start the Vite dev server (open http://localhost:5173)
npm run build      # type-check (tsc --noEmit) then build for production with Vite
npm run preview    # serve the production build locally

npm run test       # run Vitest once (includes axe-core a11y checks; use before opening a PR)
npm run test:watch # run Vitest in watch mode while developing

npm run lint       # ESLint with eslint-plugin-jsx-a11y; warnings fail the run
npm run format     # Prettier write across src
```

Before you open a PR, make sure both of these pass:

```bash
npm run test
npm run lint
```

These are the same checks CI runs, so passing them locally means a green PR.

### Continuous integration

Every push and pull request to `main` runs two GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`): lint, the full Vitest suite, and a production build on Node 22.
- **CodeQL** (`.github/workflows/codeql.yml`): GitHub's static security analysis for JavaScript/TypeScript, with results in the repository's Security tab.

Dependency updates arrive as weekly Dependabot PRs (`.github/dependabot.yml`). Minor and patch updates to the `web/` dev/build toolchain are grouped into a single PR, and React ships with `react-dom` and both type packages in one PR so their peer ranges stay consistent. Major updates come one package at a time, because batching them produced PRs that could not install (one package's new major violating another's peer range). Treat a Dependabot PR like any other: it must pass CI before merge.

### Where things live

See [`web/README.md`](web/README.md) for the source layout, the stack, and the deliberate "non-obvious choices" (plain CSS, no router yet, strict TypeScript). Read it before adding a dependency or a new pattern.

## The fork, branch, and pull-request workflow

1. **Fork** the repository to your own account, then clone your fork.
2. **Branch** off `main`. Use a short, descriptive name, for example `fix/dropzone-focus-trap` or `docs/contributing-quickstart`.
3. **Make one focused change.** Keep pull requests small. A small PR gets reviewed fast and is easy to reason about for privacy and accessibility. If you find yourself doing two things, make two PRs.
4. **Run the checks** above (`npm run test` and `npm run lint`) and fix anything they flag. Accessibility regressions block PRs.
5. **Write a clear commit message.** A short summary line in the imperative mood (for example, "Fix focus trap in letter dropzone"), then a blank line, then a few sentences of why if it is not obvious. No em dashes (use periods, colons, commas, or parentheses).
6. **Open the pull request** against `main`. The pull-request template will ask you to confirm the privacy, accessibility, rule-library, test, and documentation impacts. Fill out the sections that apply.
7. **Respond to review.** Maintainers and CCDC reviewers may ask questions, especially on anything that touches privacy, accessibility, or Medicaid rules. That back-and-forth is normal and welcome.

First time using Git or GitHub? That is fine. Open the kind of issue that fits your contribution and a maintainer can help you through the rest, or do the work in the GitHub web editor.

## Rule-library contributions (a first-class non-code path)

The per-state rule library lives in [`rules/co/`](rules/co/) as plain YAML: letter classifications, deadlines, and exemption categories. These files are advocate-editable on purpose. Correcting or improving them is a first-class contribution, and you do not need to touch the app code to do it.

If you are a CCDC advocate, attorney, or anyone who knows the rules better than the file does:

- Edit the YAML directly (in a PR) or open an issue describing the correction.
- Cite a source for every fact you add or change: HCPF, CMS, statute, regulation, or a named CCDC reviewer.
- Rule changes are reviewed by a CCDC advocate or attorney before they ship.

The pull-request template has a dedicated "Rule library changes" section to make this easy.

## The shared form-fill engine

The write side of Coverage Compass (capturing a profile from documents the person already holds, then filling official PDF forms exactly and still-editable) is a proven engine shared with the [CDASS Enroll](https://github.com/owenpkent/cdass-enroll) proof of concept. It is adopted as a headless TypeScript module ported into [`web/src/lib`](web/src/lib), not a future plan. See [`docs/form-fill-engine.md`](docs/form-fill-engine.md) for how it works and how it is integrated.

Practical note for contributors: when you change the pure engine modules (the schema, capture, or fill logic), keep them framework-agnostic so they stay compatible with CDASS Enroll. The engine's exact-copy smoke test must keep passing: signatures are never fabricated, attestation checkboxes stay gated on unambiguous data, and the saved PDF stays editable (never flattened).

## Rules of the road

- **No new dependencies without review.** A new npm package is a new trust boundary.
- **No network calls except where explicitly justified.** This is the privacy core. No server, no accounts, no telemetry, no analytics.
- **No analytics, telemetry, or error reporting that leaves the device.** Ever.
- **No `eval` or dynamic code execution.**
- **Accessibility regressions block PRs.** Automated a11y tests (axe-core) plus manual screen-reader testing must pass.
- **Plain language: 6th grade Flesch-Kincaid.** Verified by an automated reading-level check.
- **No PII, ever, in the repo.** Sample letters must be anonymized. Only blank form templates belong here, never filled copies or real data. This rule applies to sample letters, test fixtures, screenshots, and template content alike.
- **No em dashes in any written copy.** Use periods, colons, commas, or parentheses.

## How your contribution is licensed

Coverage Compass is licensed under the **Apache License 2.0** (see [`LICENSE`](LICENSE) and [`LICENSE-DECISION.md`](LICENSE-DECISION.md)).

Contributions are inbound equals outbound: when you submit a contribution, you agree it is licensed under the same Apache 2.0 terms as the project, per Section 5 of that license. No separate contributor license agreement (CLA) is required.

A `Signed-off-by` line (the [Developer Certificate of Origin](https://developercertificate.org/)) is **optional and welcome but not required**. If you want to add one, commit with `git commit -s`. We keep this friction low on purpose so that non-engineer contributors are not blocked.

## Community and project files

- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md): Contributor Covenant 2.1, with a project-specific addendum about the disability community as the priority audience. It applies to everyone, everywhere in the project.
- [`SECURITY.md`](SECURITY.md): how to report a security or privacy vulnerability. Do **not** open a public issue for these; follow the responsible-disclosure process there.
- [`SUPPORT.md`](SUPPORT.md): where to get help. For help with your own Medicaid case, contact CCDC at (303) 839-1775 or [ccdconline.org](https://ccdconline.org/); this is a software project, not a legal-help line. For open-ended questions about the project, use [Discussions](https://github.com/owenpkent/coverage-compass/discussions).

## Issue templates

When you open a [new issue](https://github.com/owenpkent/coverage-compass/issues/new/choose), pick the template that fits:

- **Bug report** ([`bug_report.yml`](.github/ISSUE_TEMPLATE/bug_report.yml)): something is broken or behaving incorrectly.
- **Accessibility issue** ([`accessibility_issue.yml`](.github/ISSUE_TEMPLATE/accessibility_issue.yml)): the app is hard or impossible to use with your assistive technology, keyboard, or other access need. High priority.
- **Plain-language feedback** ([`plain_language_feedback.yml`](.github/ISSUE_TEMPLATE/plain_language_feedback.yml)): a string or screen is unclear, confusing, condescending, or wrong (English, Spanish, or other).
- **Anonymized sample letter** ([`sample_letter.yml`](.github/ISSUE_TEMPLATE/sample_letter.yml)): you have a Medicaid letter (anonymized) that could help train the classifier.
- **Feature request** ([`feature_request.yml`](.github/ISSUE_TEMPLATE/feature_request.yml)): suggest a new feature or improvement.

When you open a pull request, the [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) will guide you through the privacy, accessibility, rule-library, test, and documentation checks.
