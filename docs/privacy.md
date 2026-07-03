# Privacy and threat model

## Principle

User data never leaves the device. The browser tab is the trust boundary. Anyone who hosts this app must not be in a position to see user documents, period.

This is non-negotiable. The whole reason the tool can exist is that users trust it not to leak their SSA award letter, denial notice, or tax return. If that ever breaks, the tool is worse than nothing.

## What we collect

Nothing.

- No accounts, no sign-in, no identifiers.
- No analytics. Not Google Analytics, not Plausible, not Fathom, not server logs, nothing.
- No error reporting service. Not Sentry, not Bugsnag, not LogRocket.
- No A/B testing.
- No telemetry of any kind.
- No fonts loaded from a CDN (fonts are self-hosted with the bundle).
- No third-party scripts.

## What we store on the device

By default, nothing persists between sessions. The dropped PDF lives in browser memory while the tab is open and is discarded on close.

The one exception is explicit and user-initiated: the form filler's personal archive. Pressing "Save on this device" stores the entered profile in IndexedDB through the single audited storage module (`web/src/lib/archive.ts`), local-only with no sync, one record, deletable with one button, with a scrub action that clears sensitive fields after generating. Nothing writes to it except that button, and the privacy-guard test keeps it that way. The planned renewal calendar (v0.2) will use the same audited module under the same opt-in rule.

## Threat model

### In scope (must defend against)
- Network adversaries observing requests to/from the app: defended by making no network requests after the initial page load.
- The hosting provider (Netlify, GitHub Pages) trying to read user data: defended by never sending data to the host. The host serves static assets only.
- A future maintainer of the project shipping malicious JS in a release: partially defended by being open source, by Subresource Integrity on all assets, by reproducible builds, and by transparency about releases. Not perfectly defended (see "residual risk" below).
- Someone with brief physical access to the device after the user closes the tab: defended by not persisting anything by default.

### Out of scope (cannot defend against in v0.1)
- A user whose device is already compromised (keylogger, full-device malware).
- A user being shoulder-surfed.
- A subpoena or warrant served on the user directly.
- An adversary with persistent root on the user's machine.

### Residual risk (named openly)
A hosted web app's biggest privacy risk vs. a frozen native binary is that the host could in principle serve malicious JS in a future release. Mitigations:
- Open source on GitHub: anyone can audit the code.
- Subresource Integrity on every asset reference.
- Reproducible builds, with the build process documented in `docs/architecture.md`.
- Signed release tags.
- Optional desktop wrapper (Tauri) later, for users who prefer a frozen binary.

This is the honest tradeoff. We name it instead of hiding it.

## Content-Security-Policy and response headers

The production build ships a Content-Security-Policy. The key directive is
`connect-src 'self'`, which blocks the page from sending anything to a third
party: that is what enforces "no data leaves the device" in the browser, not just
in policy. The OCR, barcode (zxing-wasm), and PDF assets are served from our own
origin, so they still load.

Two delivery details matter:

- The policy is included as a `<meta http-equiv>` tag in the HTML, which covers
  `connect-src`, `script-src`, `worker-src`, and the rest. But a `<meta>` CSP
  cannot enforce `frame-ancestors` (anti-clickjacking). The build also emits a
  `_headers` file (Netlify / Cloudflare Pages format) carrying the full policy
  plus `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and
  `X-Content-Type-Options: nosniff`.
- **GitHub Pages cannot set custom response headers**, so on a GitHub Pages
  deploy the `_headers` file is ignored and `frame-ancestors` is not enforced.
  For any production deploy, prefer a host that honors response headers (Netlify
  or Cloudflare Pages). The clickjacking risk is limited here (no backend, no
  accounts, no cookies, no state-changing server requests), but a UI-redress
  attempt that tricks a user into acting on a framed copy is the residual gap we
  name rather than hide.

## The hosted demonstration (added 2026-07-01)

A demo deployment is live at [coverage-compass-6ky.pages.dev](https://coverage-compass-6ky.pages.dev), on Cloudflare Pages (chosen because it honors the `_headers` file, so the full CSP and `frame-ancestors 'none'` are sent as real response headers).

Two honest notes about hosting that this document's "we collect nothing" principle needs alongside it:

- **We** collect nothing, but the hosting provider's infrastructure sees standard connection metadata (IP address, user agent) whenever a browser downloads the app's static files. That is true of serving any website from any host and is outside our control. No document content is ever in those requests; the CSP forbids the app from sending anything anywhere.
- The demo sits behind a bilingual click-through release, and in-app **Terms of Use** and **Privacy Notice** pages (`#terms`, `#privacy`) state the as-is, no-warranty, waiver-and-release terms in plain language. Both are drafts pending CCDC counsel review. Acceptance of the gate is session-only React state: no cookie, no localStorage, so it reappears every visit.

## What we ask of contributors

- No new dependencies without a deps review (look at the package, its dependency tree, its maintenance status, its license).
- No code that makes network requests except where explicitly justified and documented.
- No code that writes to localStorage, sessionStorage, IndexedDB, or cookies without going through the single audited storage module (`web/src/lib/archive.ts`, whose only write path is the explicit "Save on this device" action). Enforced by a test (`web/src/privacy-guard.test.ts`) that fails the suite if any other source file touches a storage API.
- No `eval`, `Function()`, dynamic script tags, or other code-loading patterns.
- Lint rules will enforce as many of these as possible.

## What we tell users

A privacy summary visible from the landing page:
- "Your documents never leave this device. We don't have a server. We can't see what you upload."
- The in-app Privacy Notice (`#privacy`) for the user-facing version, and this document for the engineering version.
- A link to the GitHub repo for anyone who wants to audit.
