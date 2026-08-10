/* Rules engine (the read side).
 *
 * Pure function: take the extracted text of a letter, return a structured
 * classification with letter type, a confidence band, a plain-language summary,
 * the deadline, what happens if you do nothing, and concrete next actions.
 *
 * Classification is deliberately rule-based and deterministic: it runs entirely
 * in the browser from the advocate-editable YAML rule library (compiled to
 * rules.generated.ts at build time). No model, no network, no surprises. When
 * we have 50+ real sample letters and can see the failure modes, this is the
 * place to reconsider (see docs/architecture.md, "Open architectural questions").
 */
import { LETTER_RULES, ES_REVIEWED, CCDC_PHONE, RULES_VERSION } from "./rules.generated";
import { extractDeadline, normalize } from "./deadline";
import { pickLocale, type LocalizedString } from "./plainLanguage";

export type Locale = "en" | "es";
export type Urgency = "now" | "this-week" | "this-month";
export type ConfidenceBand = "high" | "medium" | "low";

/** The set of letter type ids defined in the rule library. */
export type LetterTypeId = (typeof LETTER_RULES)[number]["id"];

export interface ResolvedNextAction {
  label: string;
  detail: string;
  urgency: Urgency;
}

export interface LetterClassification {
  /** Matched letter type id, or "unknown" when nothing matched. */
  type: LetterTypeId;
  /** Localized short label for the type. */
  label: string;
  /** 0..1 score; see confidenceBand for the human-facing bucket. */
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** The rule patterns that matched, for transparency ("why this type"). */
  matchedTerms: string[];
  plainLanguageSummary: string;
  doNothingConsequence: string;
  /** ISO date of the deadline if one was found in the letter, else null. */
  deadlineISO: string | null;
  daysUntilDeadline: number | null;
  /** True when the deadline came from the letter text (not estimated). */
  deadlineFoundInLetter: boolean;
  /** The rule's typical response window in days (informational), or null. */
  typicalWindowDays: number | null;
  /** Source/caveat for the deadline window, from the rule. */
  deadlineSourceNote: string;
  nextActions: ResolvedNextAction[];
  /** True when showing Spanish that has not yet been reviewed. */
  translationPending: boolean;
}

export interface ClassifyOptions {
  locale?: Locale;
  /** Reference "today" for days-remaining. Defaults to the current date. */
  now?: Date;
}

export const UNKNOWN_TYPE = "unknown";
export { CCDC_PHONE, RULES_VERSION, ES_REVIEWED };

interface Scored {
  rule: (typeof LETTER_RULES)[number];
  score: number;
  matched: string[];
}

/** Count how many distinct of a rule's patterns (either language) appear. */
function scoreRule(rule: (typeof LETTER_RULES)[number], norm: string): Scored {
  const raw: string[] = [];
  for (const p of [...rule.patterns.en, ...rule.patterns.es]) {
    if (p.length === 0) continue;
    if (norm.includes(normalize(p))) raw.push(p);
  }
  // Count only "maximal" matches: drop any match that is a substring of a longer
  // match from the same rule, so overlapping patterns ("exempt"/"exemption", or
  // "community engagement"/"work and community engagement") count once rather
  // than inflating the score (and the confidence band) off a single phrase.
  const matched = raw.filter((p) => {
    const np = normalize(p);
    return !raw.some(
      (q) => q !== p && normalize(q).length > np.length && normalize(q).includes(np),
    );
  });
  return { rule, score: matched.length, matched };
}

function band(score: number): ConfidenceBand {
  if (score >= 2) return "high";
  if (score === 1) return "medium";
  return "low";
}

function confidenceValue(score: number): number {
  if (score <= 0) return 0;
  return Math.min(0.95, 0.45 + 0.2 * score);
}

function resolveActions(
  actions: ReadonlyArray<{ label: LocalizedString; detail: LocalizedString; urgency: string }>,
  locale: Locale,
): ResolvedNextAction[] {
  return actions.map((a) => ({
    label: pickLocale(a.label, locale),
    detail: pickLocale(a.detail, locale),
    urgency: (a.urgency as Urgency) ?? "this-month",
  }));
}

/**
 * Classify a letter's text. Always returns a result; when nothing matches it is
 * the "unknown" type, which itself carries a safe "call CCDC" next action.
 */
export function classifyLetter(text: string, options: ClassifyOptions = {}): LetterClassification {
  const locale = options.locale ?? "en";
  const norm = normalize(text);

  // Score every rule that has patterns; the patternless "unknown" rule is the
  // fallback. Highest score wins. On a tie, the higher-stakes type (lower
  // `priority` number) wins, so an urgent termination is never hidden behind a
  // benign-looking renewal when a letter contains both vocabularies.
  let best: Scored | null = null;
  for (const rule of LETTER_RULES) {
    if (rule.id === UNKNOWN_TYPE) continue;
    const scored = scoreRule(rule, norm);
    if (scored.score === 0) continue;
    if (
      best === null ||
      scored.score > best.score ||
      (scored.score === best.score && scored.rule.priority < best.rule.priority)
    ) {
      best = scored;
    }
  }

  const chosen =
    best ??
    ({
      rule: LETTER_RULES.find((r) => r.id === UNKNOWN_TYPE) ?? LETTER_RULES[0],
      score: 0,
      matched: [],
    } as Scored);

  const rule = chosen.rule;
  const deadline = extractDeadline(text, options.now ? { now: options.now } : {});

  return {
    type: rule.id,
    label: pickLocale(rule.label, locale),
    confidence: confidenceValue(chosen.score),
    confidenceBand: band(chosen.score),
    matchedTerms: chosen.matched,
    plainLanguageSummary: pickLocale(rule.plainLanguage, locale),
    doNothingConsequence: pickLocale(rule.doNothingConsequence, locale),
    deadlineISO: deadline.deadlineISO,
    daysUntilDeadline: deadline.daysUntilDeadline,
    deadlineFoundInLetter: deadline.foundInLetter,
    typicalWindowDays: rule.deadline.daysFromNotice,
    deadlineSourceNote: rule.deadline.source,
    nextActions: resolveActions(rule.nextActions, locale),
    translationPending: locale === "es" && !ES_REVIEWED,
  };
}
