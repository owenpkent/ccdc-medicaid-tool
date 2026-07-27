// Generate a typed TypeScript module from the advocate-editable rule YAML.
//
// The rules live in rules/co/*.yaml so a CCDC advocate can read and edit them
// without touching app code. The app does not parse YAML at runtime; this build
// step compiles the YAML into src/lib/rules.generated.ts, which the classifier
// imports. Run it via `npm run gen:rules`; it is also wired into predev/prebuild
// and pretest so the generated module is never stale.
//
// Keeping the generated file committed means a fresh clone can typecheck and
// test without first running codegen, and the diff is reviewable.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// js-yaml 5 is ESM-only and has no default export; `load` is a named export.
import { load } from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const repoRoot = resolve(web, "..");
const src = resolve(repoRoot, "rules", "co", "letter-types.yaml");
const out = resolve(web, "src", "lib", "rules.generated.ts");

const doc = load(readFileSync(src, "utf8"));
if (!doc || typeof doc !== "object" || !doc.types) {
  throw new Error(`Unexpected rules YAML shape in ${src}`);
}

// A localized string -> { en, es? }. Tolerates a bare string (treats it as en).
function loc(v) {
  if (v == null) return { en: "" };
  if (typeof v === "string") return { en: v };
  const out = { en: v.en ?? "" };
  if (typeof v.es === "string" && v.es.length > 0) out.es = v.es;
  return out;
}

// A localized string array -> { en: string[], es: string[] }.
function locList(v) {
  const pick = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === "string") : []);
  if (Array.isArray(v)) return { en: pick(v), es: [] };
  return { en: pick(v?.en), es: pick(v?.es) };
}

const rules = Object.entries(doc.types).map(([id, t]) => ({
  id,
  label: loc(t.label),
  priority: Number.isFinite(t.priority) ? t.priority : 50,
  patterns: locList(t.patterns),
  plainLanguage: loc(t.plain_language),
  doNothingConsequence: loc(t.do_nothing_consequence),
  deadline: {
    daysFromNotice:
      t.deadline && Number.isFinite(t.deadline.days_from_notice)
        ? t.deadline.days_from_notice
        : null,
    source: t.deadline?.source ?? "",
  },
  nextActions: (t.next_actions ?? []).map((a) => ({
    label: loc(a.label),
    detail: loc(a.detail),
    urgency: a.urgency ?? "this-month",
  })),
}));

const header = `/* GENERATED FILE - do not edit by hand.
 *
 * Source: rules/co/letter-types.yaml
 * Regenerate: npm run gen:rules  (also runs on predev / prebuild / pretest)
 *
 * Edit the YAML, not this file. The YAML is the advocate-editable source of
 * truth; this module is what the app imports.
 */
`;

const body = `${header}
export const RULES_VERSION = ${JSON.stringify(doc.version ?? "0.0.0")};
export const ES_REVIEWED = ${doc.es_reviewed === true};
export const CCDC_PHONE = ${JSON.stringify(doc.ccdc_phone ?? "")};

export const LETTER_RULES = ${JSON.stringify(rules, null, 2)} as const;
`;

writeFileSync(out, body, "utf8");
console.log(`Generated ${out} from ${src} (${rules.length} letter types)`);
