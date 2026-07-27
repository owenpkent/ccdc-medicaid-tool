# Reading the barcode on a driver's license or state ID

The fastest, most accurate way to fill someone's name, address, and date of
birth is to not type them. The back of every US driver's license and state ID
carries a PDF417 barcode holding those fields as exact, machine-readable text
with error correction. Coverage Compass decodes it on the device, in the
browser, with no network.

This document is the whole contract: the payload format, the traps that broke it
in production, the measured limits of what a photo can decode, and how to
reproduce any of it. Read it before changing anything in
`web/src/lib/extract/aamva.ts` or the barcode path of
`web/src/lib/extract/scanner.ts`.

**Primary source.** AAMVA *DL/ID Card Design Standard*, section D.12 ("Data
encoding structures"). It is copyright AAMVA and is not redistributed in this
repo; download it from [aamva.org](https://www.aamva.org/) if you need to check
a claim below. Every citation here is to that section.

---

## The payload

A compliant symbol is a **file header**, a list of **subfile designators**, then
the **subfiles** that carry the data. Here is a real Colorado state ID's header,
with the ID number masked, exactly as it decodes:

```
<RS><CR>ANSI 636020100102ID00410259ZC03000010IDDAQ#########
```

Broken apart:

| Bytes | Field | Example | Notes |
| --- | --- | --- | --- |
| 1 | Compliance indicator | `@` | Always the first character (D.12.3) |
| 1 | Data element separator | `LF` (0x0a) | Also separates every element |
| 1 | Record separator | `RS` (0x1e) | Third character, always present |
| 1 | Segment terminator | `CR` (0x0d) | Fourth character |
| 5 | File type | `ANSI ` | Trailing space is part of it |
| 6 | Issuer ID (IIN) | `636020` | Colorado |
| 2 | AAMVA version | `10` | |
| 2 | Jurisdiction version | `01` | |
| 2 | Number of entries | `02` | How many subfile designators follow |
| 10 each | Subfile designators | `ID00410259`, `ZC03000010` | type(2) + offset(4) + length(4) |
| 2 | Subfile type | `ID` | Each subfile *restates* its type here |
| rest | Elements | `DAQ` + value, `LF`, `DCS` + value, ... | One per line |

Two consequences fall out of this, and both have bitten:

1. **The first element has no line of its own.** It trails the subfile type on
   the header line. Every other element starts a line.
2. **The subfile type is `DL` or `ID`.** `DL` for a driver's license, `ID` for a
   non-driver state ID (D.12.4). Jurisdictions add their own subfiles as `Z` plus
   the first letter of the jurisdiction, so `ZC` is Colorado's. We read none of
   those.

Elements we use: `DAQ` ID number, `DCS` last, `DAC` first, `DAD` middle, `DBB`
date of birth, `DBA` expiration, `DAG` street, `DAI` city, `DAJ` state, `DAK`
ZIP. Dates are `MMDDCCYY` in the US and `CCYYMMDD` in Canada, which
`aamvaDate()` disambiguates.

---

## Trap 1: the phantom `DDA` (state IDs lose their ID number)

**Symptom.** A state ID scans, fills name, address and date of birth, and
silently omits the ID number. Driver's licenses are perfect.

**Cause.** The subfile type runs straight into the first element with no
separator. On a driver's license that spells `DLDAQ`; on a state ID it spells
**`IDDAQ`**. Now look one character in:

```
I D D A Q 1 2 3 ...
  ^^^^^          "DDA" is a real AAMVA element ID (compliance type)
    ^^^^^        "DAQ" is the element that is actually there
```

Any code that searches for element IDs at arbitrary offsets finds `DDA` first,
one character early. Because an element's value runs to the end of its line, that
phantom `DDA` swallows `DAQ` and the entire ID number with it. A driver's
license is immune only by luck: `DLD` happens not to be a valid element ID.

**Fix.** Anchor element IDs where the spec puts them, never search for them.
`elementStart()` returns 0 for a normal line, and on the header line returns the
offset just past the subfile type. See `aamva.ts`.

**Why it survived.** Every fixture was a driver's license. This affects **every
state ID in the country**, and it is not a Colorado quirk. `state-id-barcode.png`
now covers it.

---

## Trap 2: zxing's default text mode mangles the separators

**Symptom.** A perfect decode fills exactly one field: the ID number, whose
value is the entire barcode payload.

**Cause.** zxing has a `textMode` option that defaults to **`HRI`** (Human
Readable Interpretation). Under HRI, control characters are rendered as literal
placeholders, so a newline arrives as the four characters `<LF>`. AAMVA
separates every element with a real `LF` (D.12.3), so under the default the whole
payload collapses onto one line and every element after the first is absorbed
into the first one's value:

```
Plain: "...DLDAQ123456789\nDCSDOE\nDACJANE\n..."   -> 11 fields
HRI:   "...DLDAQ123456789<LF>DCSDOE<LF>DACJANE..." -> 1 junk field
```

**Fix.** `AAMVA_READ_OPTIONS` in `aamva.ts` pins `textMode: "Plain"`. It lives
beside the parser that requires it, not at the call site, so the contract is
testable without importing the browser-only scanner.

### The subtlety that hid it: Text vs Binary content

zxing only escapes under HRI when it classifies the content as `Binary`. It
classifies on the presence of control characters. So:

| Payload | contentType | Under HRI |
| --- | --- | --- |
| Real card (has `@`, `LF`, `RS`, `CR` per D.12.3) | `Binary` | escaped, **breaks** |
| A sample missing `RS`/`CR` | `Text` | untouched, works fine |

The old demo barcode omitted `RS` and `CR`. It therefore decoded as `Text`, the
demo worked, and every real card failed. **A sample barcode that is not
byte-compliant with D.12.3 does not represent a real card and will hide this
entire class of bug.** `example-license-barcode.png` is now compliant, and
`barcode.test.ts` asserts it is `Binary`.

---

## Trap 3: soft photos need sharpening, not upscaling

**Symptom.** "No barcode found" on a photo that looks perfectly readable.

**Measured, on a real 1553px state ID photo** whose PDF417 sits at ~1.3 pixels
per module (the theoretical floor is ~2):

| Preprocessing | Decodes? |
| --- | --- |
| Raw | no |
| Upscale x2 | no |
| Contrast stretch (autocontrast) | no |
| Otsu threshold | no |
| **Unsharp mask, no upscale** | **yes** |
| Unsharp + upscale | yes |

Sharpening is the only thing that matters here, and the app had every step
except sharpening. Phone optics and JPEG leave the bars soft but *intact*, and an
unsharp mask restores the edges. `unsharp()` in `scanner.ts` runs after the
grayscale/contrast pass.

**Do not use synthetic blur to evaluate this.** Gaussian blur destroys
information by construction and nothing recovers it, so a synthetic test will
tell you sharpening is useless. Real softness is recoverable. This distinction
cost a wrong conclusion once already.

**Sharpness beats resolution.** A sharp photo decodes with the whole card at
~900px; a blurred one fails at 1800px. The user-facing advice is "tap to focus
and hold still", not "get closer".

---

## Fixtures and how to regenerate them

All fixture data is the fictional Jane Doe, per the repo's no-PII rule.

| File | Card type | Purpose |
| --- | --- | --- |
| `web/public/examples/example-license-barcode.png` | Driver's license (`DL`) | Ships with the app; the "Scan the example ID" demo fetches and decodes it |
| `web/src/fixtures/state-id-barcode.png` | State ID (`ID`) | Test only. Covers trap 1, which a `DL` fixture cannot see |

The demo image is **generated, never hand-made**:

```bash
cd web && npm run gen:example-barcode
```

`EXAMPLE_LICENSE_AAMVA` in `src/fixtures/examplePerson.ts` is the single source
of truth; the script renders it with zxing's writer (the same library that reads
it back, so no extra dependency). `barcode.test.ts` asserts the committed PNG
still decodes to exactly that string, so the image and the payload cannot drift.

---

## Diagnosing "it will not scan"

Work in this order. Steps 1-2 cost seconds and answer most reports.

1. **Is it decodable at all?** Crop to the barcode and try a matrix: scales 1-3,
   binarizers `LocalAverage` and `GlobalHistogram`, with and without an unsharp
   mask. If something decodes and the app does not, that is our bug.
2. **Measure pixels per module.** Take a scanline across the barcode, run-length
   encode it, and look at the narrowest run. Below ~2px, no amount of code helps
   and the honest answer is "retake it in focus".
3. **Check the content type.** `readBarcodes(...)` returns `contentType`. A real
   card must be `Binary`. If a fixture reads `Text`, that fixture is not
   compliant and is lying to you.
4. **Look at the element IDs, not the values.** Print the code at the start of
   each line and the value's *length*. Never print the values: these are real
   identity documents.
5. **Confirm the seam.** Decode -> parse is where the bugs were. Each half can be
   perfect while the pair is broken.

---

## Rules for changing this code

- **Never print a decoded payload** into a log, a test name, or a bug report. It
  is someone's identity document. Element IDs and value lengths are enough to
  diagnose anything above.
- **Only extract elements a form actually asks for.** The barcode also carries
  sex, height, eye and hair colour, and more. Whatever a parser returns gets
  written into the profile and persisted, so extracting an unused element is a
  privacy cost with no benefit.
- **Test both card types.** A change that passes on a `DL` fixture tells you
  nothing about state IDs, as trap 1 proves.
- **Trust the spec over the sample.** Both traps were invisible because the only
  end-to-end artifact was a non-compliant sample. When they disagree, the sample
  is wrong.
