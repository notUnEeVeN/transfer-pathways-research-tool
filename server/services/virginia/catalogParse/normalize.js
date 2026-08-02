/**
 * Shared vocabulary for reading a Virginia catalog page.
 *
 * Every parser in this directory produces the same neutral tree, so these are
 * the pieces they must agree on: what a course code looks like, what a credit
 * figure looks like, and which sentences are instructions rather than content.
 */

/**
 * A course code as printed.
 *
 * Deliberately not anchored with `\b` on the left. Catalog text runs together
 * — `Credits: 3CSC 221` — and `\b` never matches between a digit and a letter,
 * so an anchored pattern silently drops codes. That bug is why one college
 * previously read as 2 courses instead of 16.
 *
 * Four-digit numbers are included because four-year institutions use them
 * (`CS 1114`, `ENGL 1105`); VCCS is uniformly three.
 */
const CODE = /([A-Z]{2,5})\s?[-–—]?\s?(\d{3,4}[A-Z]?)(?![\dA-Za-z])/g;

/**
 * Match one known code against arbitrary page text.
 *
 * Shared by the validator so "does this code appear on the page?" uses exactly
 * the same notion of a code as the parsers do. The separator is optional and
 * may be a hyphen: `ENG111`, `ENG 111` and `ENGL - 101` are all one code.
 */
function codePattern(code) {
  const m = /^([A-Z]{2,5})(\d{3,4}[A-Z]?)$/.exec(String(code || ''));
  if (!m) return null;
  return new RegExp(`${m[1]}\\s?[-–—]?\\s?${m[2]}(?!\\d)`);
}

/** The separator between a prefix and its number, as printed. */
const CODE_SEP = '\\s?[-–—]?\\s?';

/** Prefixes Acalog concatenates onto the next code from a preceding cell. */
const GLUED_PREFIX = /^(CR|CE|III|II|I)(?=[A-Z]{2,5}\d{3,4}[A-Z]?$)/;

/** Letter sequences that match CODE but are never course codes. */
const NOT_A_CODE = /^(HELP|BOX|FF|ROOM|SUITE|PHONE|FAX|ISBN|USC|VA|PO|GPA|FAQ|HTTP|HTTPS|WWW)\d/;

/** `ENG 111` / `ENG111` / `eng 111` -> `ENG111`. */
function normCode(raw) {
  return String(raw || '')
    .replace(/\s*[-–—]\s*/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(GLUED_PREFIX, '');
}

/** Every course code in a string, in printed order, de-duplicated. */
function codesIn(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text || '').matchAll(CODE)) {
    const code = normCode(`${m[1]}${m[2]}`);
    if (NOT_A_CODE.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** True when the string carries at least one course code. */
const hasCode = (text) => codesIn(text).length > 0;

/**
 * A credit figure as printed: `3`, `7-10`, `1-5`, `15/16`.
 *
 * `min` is what the requirement always costs and `max` what it can cost. The
 * pair is kept rather than collapsed because a range is information — a degree
 * that reconciles at its minimum and not its maximum is correctly parsed.
 */
function parseCredits(raw) {
  const s = String(raw || '').replace(/\s/g, '');
  const m = /^(\d+(?:\.\d+)?)(?:[-–—/](\d+(?:\.\d+)?))?$/.exec(s);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] == null ? min : Number(m[2]);
  return { min, max, raw: String(raw).trim() };
}

/** `Credits: 3` — the label-first credit form, used on rows as well as headings. */
const LABELLED_CREDITS = /\b(?:credits?|semester\s+hours?|credit\s+hours?)\s*:\s*(\d+(?:[-–]\d+)?)/i;

/**
 * The credit figure a heading states, from its last parenthetical.
 *
 * The last one, not the first: `Transfer Electives (Prerequisites if needed)
 * (7-10)` puts a prose aside where a naive reader expects the number.
 */
function creditsFromHeading(line) {
  const parens = [...String(line || '').matchAll(/\(([^()]*)\)/g)];
  for (let i = parens.length - 1; i >= 0; i -= 1) {
    // No `\b` before the unit: catalogs print `(6cr)` with no space, and a
    // left word boundary never matches between `6` and `c`, so an anchored
    // pattern leaves "6cr" unparsed and the heading reads as creditless. The
    // right-hand `\b` still protects words that merely contain the letters
    // (`Microcomputer` keeps its `cr`).
    const inner = parens[i][1].replace(/(cr|crs|credits?|credit\s*hours?|semester\s*hours?|s\.?h\.?|hrs?|units?)\b\.?/gi, '').trim();
    const parsed = parseCredits(inner);
    if (parsed && parsed.max <= MAX_PLAUSIBLE_CREDITS) return { credits: parsed, at: parens[i].index, matched: parens[i][0] };
  }
  const bare = /(?:^|\s)(\d+(?:[-–]\d+)?)\s*(?:cr|credits?|credit\s*hours?|semester\s*hours?|s\.?h\.?)\b/i.exec(String(line || ''));
  if (bare) {
    const parsed = parseCredits(bare[1]);
    if (parsed && parsed.max <= MAX_PLAUSIBLE_CREDITS) return { credits: parsed, at: bare.index, matched: bare[0] };
  }
  // The label-first form, `… Credits: 3`. Central Virginia prints it on every
  // row; the number follows the word, so the patterns above cannot see it.
  const labelled = LABELLED_CREDITS.exec(String(line || ''));
  if (labelled) {
    const parsed = parseCredits(labelled[1]);
    if (parsed && parsed.max <= MAX_PLAUSIBLE_CREDITS) return { credits: parsed, at: labelled.index, matched: labelled[0] };
  }
  return null;
}

/** Heading text with its credit parenthetical removed. */
function headingTitle(line) {
  const found = creditsFromHeading(line);
  let text = String(line || '');
  if (found) text = text.slice(0, found.at) + text.slice(found.at + found.matched.length);
  return text
    .replace(/\s+/g, ' ')
    // Removing `6 Credit` from `Required Courses: 6 Credit Hours` leaves the
    // unit stranded on the end of the title.
    .replace(/[:\s]*\b(credit\s*hours?|credits?|hours?|hrs?|units?)\s*$/i, '')
    .replace(/[:•\-–—\s]+$/, '')
    .trim();
}

/**
 * Instruction sentences — the ones that say how many of the following to take.
 *
 * `Choose any two courses (6cr) from the options below`, `Select one of the
 * following`, `Complete 3 credits`. These carry the advisement figure and must
 * never be mistaken for a requirement row.
 */
const INSTRUCTION = /^\s*(choose|select|complete|take|earn|pick|students?\s+(must|will|should)|one\s+of\s+the\s+following|any\s+(one|two|three))\b/i;

const WORD_NUMBER = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * How many items an instruction asks for, and in what unit.
 *
 * Returns `{ courses }` for a count of courses and `{ credits }` for a credit
 * figure, because the schema stores them in different fields — a group that
 * wants 6 credits is not a group that wants 6 courses.
 */
function parseInstruction(line) {
  const s = String(line || '');
  if (!INSTRUCTION.test(s)) return null;
  const out = { text: s.replace(/\s+/g, ' ').trim() };

  const credit = /(\d+(?:[-–]\d+)?)\s*(?:cr\b|credits?|credit\s*hours?|semester\s*hours?)/i.exec(s);
  if (credit) out.credits = parseCredits(credit[1]);

  const countDigit = /\b(?:choose|select|complete|take|pick)\s+(?:any\s+)?(\d+)\b(?!\s*(?:cr|credits?|credit))/i.exec(s);
  const countWord = /\b(?:choose|select|complete|take|pick)\s+(?:any\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.exec(s);
  if (countDigit) out.courses = Number(countDigit[1]);
  else if (countWord) out.courses = WORD_NUMBER[countWord[1].toLowerCase()];
  else if (/\b(one\s+of\s+the\s+following|either)\b/i.test(s)) out.courses = 1;

  // "selections must be from two different categories" — a spread constraint
  // across the group's sections, which the schema stores separately from the
  // count because the two are independently binding.
  const spread = /from\s+(\d+|one|two|three|four|five)\s+different\s+(?:categor|area|discipline|subject|department|field|group)/i.exec(s);
  if (spread) {
    const n = WORD_NUMBER[spread[1].toLowerCase()] ?? Number(spread[1]);
    if (Number.isInteger(n) && n > 0) out.distinct_sections = n;
  }

  return out;
}

/**
 * Where the requirements stop and the suggested schedule begins.
 *
 * Acalog pages routinely print a term-by-term plan after the requirements. It
 * restates the same courses, so parsing past this line double-counts the whole
 * degree — the single most expensive mistake available on these pages.
 */
const PLAN_OF_STUDY = /^\s*(suggested\s+(scheduling|sequence|plan)|sample\s+(schedule|plan|sequence)|plan\s+of\s+study|recommended\s+(course\s+)?sequence|program\s+of\s+study\s+sequence|course\s+sequence|semester\s+by\s+semester|first\s+year\s*$)/i;

/**
 * The line that states the degree's own total.
 *
 * Both orders occur: `Total Minimum Credits - 60` and `Program Total 60-64`.
 * Missing the second leaves the degree with no total to reconcile against and
 * turns the line into a spurious requirement group.
 */
const TOTAL_LINE = new RegExp([
  '\\btotal\\s*(?:minimum\\s*|program\\s*|degree\\s*|required\\s*)?',
  '(?:credits?|credit\\s*hours?|semester\\s*hours?|hours?)\\b\\s*(?:required)?\\s*[:\\-–—]?\\s*(\\d+(?:[-–]\\d+)?)',
  // `Program Total: 60-64 Credits` — number first, unit after. The qualifier
  // is required so a bare `Total 16-17` under a term table still reads as that
  // term's subtotal rather than as the whole degree.
  '|^\\s*(?:program|degree|curriculum)\\s+total\\s*[:\\-–—]?\\s*(\\d+(?:[-–]\\d+)?)\\s*(?:credits?|credit\\s*hours?|semester\\s*hours?)?\\s*$',
  // `Semester Hours: 48` — how Eastern Mennonite states a degree's size, in the
  // header block above the requirement groups.
  '|^\\s*semester\\s+hours?\\s*:\\s*(\\d+(?:[-–]\\d+)?)\\s*$',
].join(''), 'i');

/**
 * Largest number that can plausibly be a credit figure on a heading.
 *
 * Catalogs print the state program code next to the award — `Computer Science
 * Degree, AS 246` — and 246 is not 246 credits. Anything past a full bachelor's
 * degree is an identifier that happens to be a number.
 */
const MAX_PLAUSIBLE_CREDITS = 140;

/** Requirements met by standing rather than by taking a course. */
const ADMINISTRATIVE = /residency|cumulative\s+gpa|grade\s+point\s+average|application\s+(to|for)\s+grad|academic\s+standing|minimum\s+grade\s+of/i;

module.exports = {
  CODE,
  LABELLED_CREDITS,
  NOT_A_CODE,
  INSTRUCTION,
  PLAN_OF_STUDY,
  TOTAL_LINE,
  ADMINISTRATIVE,
  MAX_PLAUSIBLE_CREDITS,
  CODE_SEP,
  codePattern,
  normCode,
  codesIn,
  hasCode,
  parseCredits,
  creditsFromHeading,
  headingTitle,
  parseInstruction,
};
