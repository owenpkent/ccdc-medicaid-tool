# Security and Privacy Policy

This project handles documents that disclose disability, health, and financial
information. We take privacy and security extremely seriously. Our threat model
is in [`docs/privacy.md`](docs/privacy.md).

## Supported versions

| Version | Supported |
|---------|-----------|
| v0.1 (read side, pre-deploy) | Full security response within 7 days |
| v0.1+   | Full security response within 7 days |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security or privacy
vulnerabilities.**

Use GitHub's [private vulnerability reporting][gh-private-vuln] on this
repository to submit a confidential report. We aim to respond within 7 days.

[gh-private-vuln]: https://github.com/owenpkent/coverage-compass/security/advisories/new

Include:

- A description of the issue.
- Steps to reproduce.
- Affected version or commit.
- Any suggested mitigation.
- Whether you'd like to be credited in the fix announcement.

## What counts as a security or privacy issue

In addition to standard web-app vulnerabilities (XSS, dependency
vulnerabilities, supply-chain attacks), the following are considered critical
for this project:

- Any code path that sends user document data off the device.
- Any analytics, telemetry, or error reporting that leaks user information.
- Any storage of user documents without explicit consent.
- Any third-party script or font load that is not bundled with the app.
- Any path that bypasses Subresource Integrity on assets.
- Any path that allows an attacker to substitute the rules library at runtime.
- Any accessibility regression that prevents a screen reader user from using
  a critical flow (we treat this as a privacy issue too: it forces the user
  to disclose to a sighted helper).

## Automated security checks

Every push and pull request to `main` is scanned automatically:

- **CodeQL** (`.github/workflows/codeql.yml`) runs GitHub's static analysis for
  JavaScript/TypeScript (`security-and-quality` suite) on push, PR, and weekly.
  Findings appear in the repository's Security tab.
- **Dependabot** (`.github/dependabot.yml`) opens weekly PRs for vulnerable or
  outdated npm and GitHub Actions dependencies. GitHub's Dependabot alerts flag
  known advisories in the dependency tree.
- **CI** (`.github/workflows/ci.yml`) runs the privacy-guard test on every
  change, so a regression that touches storage outside the one audited module
  fails the build (see [`docs/privacy.md`](docs/privacy.md)).

These are a backstop, not a substitute for the responsible-disclosure process
above. If you find something the automated tools missed, please report it.

## Coordinated disclosure

For confirmed vulnerabilities we will:

1. Acknowledge receipt within 7 days.
2. Provide an estimated timeline for a fix.
3. Coordinate disclosure timing with the reporter.
4. Credit the reporter in the release notes if they want credit.

## Bug bounty

We do not run a paid bounty program. We will publicly thank security reporters
who follow coordinated disclosure.

## Out of scope

- The user's own device being compromised (keyloggers, malware).
- The user being coerced or shoulder-surfed in person.
- Issues in unsupported browsers (we support current Firefox, Chrome, Safari,
  Edge; one major version back).
- Theoretical attacks that require attacker control of the user's network and
  also a separate compromise of certificate authorities.
