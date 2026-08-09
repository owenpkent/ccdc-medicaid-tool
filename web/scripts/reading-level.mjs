// Reading-level (plain-language) check for the English member-facing strings.
//
// Plain language is a hard product constraint: docs/spec-v0.1.md requires all
// copy to sit at or below a 6th-grade Flesch-Kincaid level. This script scores
// the English strings a member actually reads on a classified notice, which
// today means `plain_language.en` and `do_nothing_consequence.en` in
// rules/co/letter-types.yaml.
//
// Run it with `npm run check:reading-level` from web/. It reports by default
// and exits 0 even when a string is over target, so a contributor is never
// blocked by prose that predates the check. Pass --strict to exit 1 instead;
// that is the switch to flip once the existing copy is under target.
//
// No network, no new dependencies: js-yaml is already a devDependency here
// (scripts/gen-rules.mjs uses it), and the scoring is plain arithmetic below.
//
// Scope and limits, so nobody reads more into a number than it carries:
//   - English only. Flesch-Kincaid is calibrated on English; scoring Spanish
//     with it produces a meaningless figure. Spanish needs a Spanish formula
//     (Fernandez-Huerta or Szigriszt-Pazos) and a native-speaker review, which
//     is issue #8's territory, not this check's.
//   - Syllable counting is a heuristic (vowel groups with a silent-e trim).
//     It is right on ordinary prose and can miss on unusual words. Acronyms
//     are the known blind spot: "CCDC" scores as 1 syllable but is read aloud
//     as 4, so copy heavy with acronyms scores easier than it reads.
//   - The scale has no floor. Very short words in very short sentences can
//     score near 0 or below, which means "simpler than the formula measures",
//     not "broken".
//   - The formula rewards short words and short sentences. It cannot tell you
//     whether the copy is *correct* or *kind*, only whether it is dense. A
//     human still reads every string.
//   - UI chrome in src/ (react-intl messages) is not covered yet. Extending
//     this to those strings is worth doing once the extraction is settled.
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// js-yaml 5 is ESM-only and has no default export; `load` is a named export.
import { load } from "js-yaml";

// Target grade from docs/spec-v0.1.md ("at or below 6th grade Flesch-Kincaid").
const GRADE_TARGET = 6;

const strict = process.argv.includes("--strict");
// GitHub Actions sets CI and understands `::warning ...` annotation lines.
const onActions = process.env.GITHUB_ACTIONS === "true";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const src = resolve(repoRoot, "rules", "co", "letter-types.yaml");
const srcLabel = relative(repoRoot, src).split("\\").join("/");

const raw = readFileSync(src, "utf8");
const rawLines = raw.split(/\r?\n/);
const doc = load(raw);
if (!doc || typeof doc !== "object" || !doc.types) {
  throw new Error(`Unexpected rules YAML shape in ${src}`);
}

// Words, with leading and trailing punctuation stripped. A token counts only
// if it still holds a letter, so a bare "-" or "(" is not scored as a word.
function words(text) {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => /\p{L}/u.test(t));
}

// Sentence terminators followed by whitespace or end of string. Requiring the
// boundary keeps "colorado.gov/peak" and "(303) 839-1775" from splitting.
function countSentences(text) {
  const ends = text.match(/[.!?]+(?=\s|$)/g);
  return Math.max(1, ends ? ends.length : 1);
}

// Vowel-group syllable heuristic: drop a silent trailing "e" (but not the "le"
// in "little"), ignore a leading "y", then count runs of vowels. Every word
// scores at least 1.
function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Flesch-Kincaid grade level.
function gradeLevel(text) {
  const w = words(text);
  if (w.length === 0) return null;
  const sentences = countSentences(text);
  const syllables = w.reduce((sum, word) => sum + countSyllables(word), 0);
  const grade = 0.39 * (w.length / sentences) + 11.8 * (syllables / w.length) - 15.59;
  return {
    grade: Math.round(grade * 10) / 10,
    words: w.length,
    sentences,
    syllables,
  };
}

// Best-effort line number so an over-target string annotates the right line in
// the PR diff. Matches on a distinctive prefix of the text.
//
// Two letter types can share wording (procedural_termination and
// renewal_request both use "Your Health First Colorado coverage will end on the
// date in the letter."), so a plain first-match search would point every
// duplicate at the first one. Strings are collected in document order, so a
// cursor that only moves forward lands each on its own line.
let lineCursor = 0;
function findLine(text) {
  const needle = text.slice(0, 40);
  let idx = rawLines.findIndex((line, i) => i >= lineCursor && line.includes(needle));
  // Fall back to a full scan if the cursor overshot, so a schema reorder
  // degrades to a slightly wrong line rather than to line 1.
  if (idx === -1) idx = rawLines.findIndex((line) => line.includes(needle));
  if (idx === -1) return 1;
  lineCursor = idx + 1;
  return idx + 1;
}

const FIELDS = [
  ["plain_language", "plain_language.en"],
  ["do_nothing_consequence", "do_nothing_consequence.en"],
];

const results = [];
for (const [typeId, type] of Object.entries(doc.types)) {
  for (const [key, label] of FIELDS) {
    const text = type?.[key]?.en;
    if (typeof text !== "string" || text.trim() === "") continue;
    const scored = gradeLevel(text);
    if (!scored) continue;
    results.push({ typeId, label, text, line: findLine(text), ...scored });
  }
}

if (results.length === 0) {
  console.error(`No English strings found in ${srcLabel}. Has the schema changed?`);
  process.exit(1);
}

const over = results.filter((r) => r.grade > GRADE_TARGET);
const worst = results.reduce((a, b) => (b.grade > a.grade ? b : a));
const mean = results.reduce((sum, r) => sum + r.grade, 0) / results.length;

const pad = (s, n) => String(s).padEnd(n);
const idWidth = Math.max(4, ...results.map((r) => r.typeId.length));
const labelWidth = Math.max(5, ...results.map((r) => r.label.length));

console.log(`Reading level (Flesch-Kincaid) for English strings in ${srcLabel}`);
console.log(`Target: grade ${GRADE_TARGET} or below. Mode: ${strict ? "strict (fails)" : "report only"}.`);
console.log("");
console.log(`  ${pad("type", idWidth)}  ${pad("field", labelWidth)}  grade  words  sentences`);
console.log(`  ${"-".repeat(idWidth)}  ${"-".repeat(labelWidth)}  -----  -----  ---------`);
for (const r of results) {
  const flag = r.grade > GRADE_TARGET ? "  over target" : "";
  const grade = r.grade.toFixed(1).padStart(5);
  console.log(
    `  ${pad(r.typeId, idWidth)}  ${pad(r.label, labelWidth)}  ${grade}  ${String(r.words).padStart(5)}  ${String(r.sentences).padStart(9)}${flag}`,
  );
}
console.log("");
console.log(
  `${results.length} strings scored. ${over.length} over grade ${GRADE_TARGET}. Mean grade ${mean.toFixed(1)}, highest ${worst.grade.toFixed(1)} (${worst.typeId} ${worst.label}).`,
);

if (onActions) {
  for (const r of over) {
    const msg = `${r.typeId} ${r.label} reads at grade ${r.grade.toFixed(1)}, above the target of ${GRADE_TARGET}. Shorter sentences and shorter words bring this down.`;
    console.log(`::warning file=${srcLabel},line=${r.line},title=Reading level above target::${msg}`);
  }
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const rows = results
      .map(
        (r) =>
          `| \`${r.typeId}\` | ${r.label} | ${r.grade.toFixed(1)} | ${r.grade > GRADE_TARGET ? "over target" : "ok"} |`,
      )
      .join("\n");
    const body = [
      `### Reading level (Flesch-Kincaid)`,
      "",
      `Target: grade ${GRADE_TARGET} or below. This check reports and does not fail the build.`,
      "",
      `| Letter type | Field | Grade | Status |`,
      `| --- | --- | --- | --- |`,
      rows,
      "",
      `${over.length} of ${results.length} strings are above grade ${GRADE_TARGET}. Mean ${mean.toFixed(1)}.`,
      "",
    ].join("\n");
    // Appending is the documented contract for the step summary file.
    const { appendFileSync } = await import("node:fs");
    appendFileSync(summaryPath, `${body}\n`, "utf8");
  }
}

if (strict && over.length > 0) {
  console.error(`\nFailing: ${over.length} string(s) above grade ${GRADE_TARGET} and --strict was passed.`);
  process.exit(1);
}
