/* Deadline extraction.
 *
 * Pure functions. Given the text of a letter, find the date the reader has to
 * act by, and how many days are left. The discipline here is the same one that
 * governs the whole tool: never assert a date we cannot point to in the letter.
 *
 * We only treat a date as the deadline when it sits next to a deadline word
 * ("by", "no later than", "due", Spanish "antes del", "fecha límite", ...). A
 * date floating elsewhere in the letter (the mailing date, a date of birth, a
 * case-opened date) is ignored. When nothing qualifies, we say so and let the
 * caller fall back to the rule's typical window as *informational* text rather
 * than inventing a specific date.
 */

export interface DeadlineResult {
  /** ISO calendar date (YYYY-MM-DD) of the deadline, or null if none was found. */
  deadlineISO: string | null;
  /** Whole days from `now` until the deadline (negative if already past), or null. */
  daysUntilDeadline: number | null;
  /** True only when the date was found in the letter text (not estimated). */
  foundInLetter: boolean;
}

export interface ExtractDeadlineOptions {
  /** Reference "today". Defaults to the current date. Injected in tests. */
  now?: Date;
}

// Month name -> 1-based month number, English and Spanish, including common
// abbreviations. Keys are diacritic-stripped and lowercased to match normalize().
//
// Left unformatted on purpose, as is STATE_NAMES in fill/forms/i9.ts. Reading
// this as a table is the point: Prettier gives every key its own line, which
// turns 10 scannable rows into 40 and buries the English/Spanish split that the
// comments below mark.
// prettier-ignore
const MONTHS: Record<string, number> = {
  // English
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
  // Spanish (diacritics already stripped: diciembre stays, but no accents here)
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const MONTH_ALTERNATION = Object.keys(MONTHS).join("|");

// Deadline trigger words/phrases, English and Spanish (diacritic-stripped).
const DEADLINE_KEYWORDS = [
  "no later than",
  "by no later than",
  "due by",
  "due date",
  "due on",
  "due",
  "respond by",
  "reply by",
  "return by",
  "submit by",
  "postmarked by",
  "deadline",
  "must respond by",
  "respond no later than",
  "respond before",
  "reply before",
  "submit before",
  "return before",
  "you have until",
  // Termination anchors: the date coverage ends is the date a termination letter
  // is really about, so surface it as "the date in the letter". Kept specific so
  // an enrollment/effective date is not mistaken for an action deadline.
  "end on",
  "ends on",
  "ending on",
  "will end on",
  "terminate on",
  "coverage ends",
  "coverage will end",
  // Spanish
  "a mas tardar",
  "antes del",
  "fecha limite",
  "vence el",
  "vence",
  "fecha de vencimiento",
  "responder antes del",
  "debe responder antes",
  "terminara el",
  "termina el",
  "su cobertura terminara",
];

// Bare triggers that read as deadlines only when a date follows immediately:
// "by June 30, 2026", "para el 30 de junio de 2026", "hasta el 15 de agosto".
// These words appear constantly in non-deadline prose ("reviewed by John
// Smith", "para el condado"), so unlike the phrase keywords above they get a
// near-zero window where triggers are collected. The word boundary and the
// required whitespace keep "baby" or "nearby" from firing.
const TIGHT_TRIGGERS = /\b(?:by|para el|hasta el)\s+/g;

/** Lowercase and strip diacritics so "Renovación" and "renovacion" compare equal. */
export function normalize(text: string): string {
  // Strip combining diacritical marks (U+0300-U+036F) after NFD decomposition.
  const combiningMarks = new RegExp("[\\u0300-\\u036f]", "g");
  return text.normalize("NFD").replace(combiningMarks, "").toLowerCase();
}

interface DateMatch {
  index: number; // position in the normalized string
  year: number;
  month: number; // 1-based
  day: number;
}

interface Trigger {
  pos: number; // position just after the trigger text, where the date usually sits
  min: number; // how far before `pos` a date may start and still belong to it
  max: number; // how far after `pos` a date may start and still belong to it
}

function valid(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Reject impossible days per month (leap-year aware).
  const daysInMonth = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] ?? 31);
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function fourDigitYear(raw: string): number {
  const n = Number(raw);
  if (raw.length <= 2) return 2000 + n; // "26" -> 2026
  return n;
}

/** Find every parseable date in normalized text, with its position. */
function findDates(norm: string): DateMatch[] {
  const out: DateMatch[] = [];

  // 1) Numeric M/D/Y (US ordering): 6/30/2026, 06-30-26, 6.30.2026
  const numeric = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;
  for (const m of norm.matchAll(numeric)) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = fourDigitYear(m[3] ?? "");
    if (valid(year, month, day)) out.push({ index: m.index ?? 0, year, month, day });
  }

  // 2) English long form: June 30, 2026 / Jun 30 2026 / June 30th, 2026
  const enLong = new RegExp(
    `\\b(${MONTH_ALTERNATION})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
    "g",
  );
  for (const m of norm.matchAll(enLong)) {
    const month = MONTHS[m[1] ?? ""] ?? 0;
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (valid(year, month, day)) out.push({ index: m.index ?? 0, year, month, day });
  }

  // 3) Spanish long form: 30 de junio de 2026
  const esLong = new RegExp(
    `\\b(\\d{1,2})\\s+de\\s+(${MONTH_ALTERNATION})\\s+de\\s+(\\d{4})\\b`,
    "g",
  );
  for (const m of norm.matchAll(esLong)) {
    const day = Number(m[1]);
    const month = MONTHS[m[2] ?? ""] ?? 0;
    const year = Number(m[3]);
    if (valid(year, month, day)) out.push({ index: m.index ?? 0, year, month, day });
  }

  return out;
}

function toISO(d: DateMatch): string {
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

/** Whole days between two calendar dates, computed in UTC to dodge DST/TZ drift. */
function daysBetween(fromISO: string, toISODate: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISODate.split("-").map(Number);
  const a = Date.UTC(fy ?? 0, (fm ?? 1) - 1, fd ?? 1);
  const b = Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1);
  return Math.round((b - a) / 86_400_000);
}

function todayISO(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Find the action deadline in a letter. Returns the date and days remaining only
 * when a date sits next to a deadline word; otherwise foundInLetter is false.
 */
export function extractDeadline(
  text: string,
  options: ExtractDeadlineOptions = {},
): DeadlineResult {
  const now = options.now ?? new Date();
  const norm = normalize(text);
  const dates = findDates(norm);

  if (dates.length === 0) {
    return { deadlineISO: null, daysUntilDeadline: null, foundInLetter: false };
  }

  // Window (in characters) within which a date "belongs to" a phrase keyword.
  const WINDOW = 40;

  // Locate every deadline trigger: phrase keywords get the generous window,
  // bare triggers ("by", "para el", "hasta el") require the date immediately.
  const triggers: Trigger[] = [];
  for (const kw of DEADLINE_KEYWORDS) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(kw, from);
      if (at === -1) break;
      // Record the position just after the keyword (where the date usually sits).
      triggers.push({ pos: at + kw.length, min: -4, max: WINDOW });
      from = at + kw.length;
    }
  }
  for (const m of norm.matchAll(TIGHT_TRIGGERS)) {
    triggers.push({ pos: (m.index ?? 0) + m[0].length, min: 0, max: 2 });
  }

  // Pick the date closest to any keyword, requiring the keyword to come shortly
  // before the date (how deadlines actually read: "respond by <date>"). On an
  // equal distance, prefer a date that follows the keyword over one before it,
  // which is deterministic regardless of the order dates were found in.
  let best: DateMatch | null = null;
  let bestAbs = Infinity;
  let bestSigned = -Infinity;
  for (const d of dates) {
    for (const t of triggers) {
      const distance = d.index - t.pos;
      if (distance < t.min || distance > t.max) continue;
      const absD = Math.abs(distance);
      const better =
        best === null || absD < bestAbs || (absD === bestAbs && distance >= 0 && bestSigned < 0);
      if (better) {
        best = d;
        bestAbs = absD;
        bestSigned = distance;
      }
    }
  }

  if (!best) {
    return { deadlineISO: null, daysUntilDeadline: null, foundInLetter: false };
  }

  const deadlineISO = toISO(best);
  const daysUntilDeadline = daysBetween(todayISO(now), deadlineISO);
  return { deadlineISO, daysUntilDeadline, foundInLetter: true };
}
