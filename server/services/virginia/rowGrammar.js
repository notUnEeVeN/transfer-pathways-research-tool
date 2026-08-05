/**
 * The Transfer Virginia requirement grammar.
 *
 * Virginia's guides are hand-authored WYSIWYG tables: the requirement column is
 * prose written by 60+ institutions, not a structured field. Where ARTSYS gave
 * Maryland an explicit tree and ASSIST gave California enums, this has to be
 * read. That makes the grammar the fidelity story for the whole corpus, so this
 * module is deliberately conservative:
 *
 *   - It never guesses. A cell it cannot account for returns
 *     `confidence: 'unparsed'` with the raw text preserved, and the importer
 *     reports it. A requirement that silently vanishes would make every college
 *     look better than it is, which is the one failure mode worth engineering
 *     against.
 *   - It distinguishes what it READ from what it INFERRED. `prefix_carry` and
 *     `slash_alternatives` are shorthand expansions — defensible, but they are
 *     interpretation, and every row records which rules fired so a reviewer can
 *     audit exactly the rows that depended on judgement.
 *
 * Shorthands observed in the corpus and how each is treated:
 *
 *   ENG 111                       one course
 *   ENG 112 or ENG 113            alternatives, both spelled out
 *   SDV 100 or 101                alternatives; the prefix carries (INFERRED)
 *   GOL 105/106/110               alternatives; slash-separated (INFERRED)
 *   MTH 161+162                   a required pair, not a choice
 *   HLT 241 ...; HLT 110 ...      semicolon separates required courses
 *   Any UCGS History              a category slot, no specific course
 *   ... (PHI 220 recommended)     parenthetical advice — NOT a requirement
 */

/**
 * English words that are 2-4 letters and can legitimately sit immediately
 * before a course number in this prose ("...or 101", "take 200"). Matching the
 * code pattern case-insensitively is necessary — several guides write "Art 101"
 * — but without this stoplist "SDV 100 or 101" yields a phantom course "OR 101",
 * fabricating requirements across the corpus.
 */
const NOT_A_PREFIX = new Set([
  'OR', 'AND', 'THE', 'A', 'AN', 'OF', 'TO', 'IN', 'AT', 'ON', 'BY', 'FOR',
  'ALL', 'ANY', 'ONE', 'TWO', 'SEE', 'PER', 'VIA', 'AS', 'IS', 'IF', 'UP',
  'NO', 'MAY', 'CAN', 'TAKE', 'ALSO', 'PLUS', 'WITH', 'FROM', 'MUST', 'THEN',
  'ONLY', 'BOTH', 'EACH', 'THAN', 'THAT', 'THIS', 'ARE', 'BE', 'DO',
]);

/** VCCS course code: 2-4 letter prefix, 3 digits, optional letter suffix. */
const CODE_RE = /\b([A-Za-z]{2,4})\s?-?\s?(\d{3,4}[A-Za-z]?)\b/g;

/** A bare number that inherits the previous prefix ("SDV 100 or 101"). */
const BARE_NUMBER_RE = /(?:^|[^A-Z0-9])(\d{3}[A-Z]?)(?![0-9])/g;

/** "Any UCGS Humanities", "Any approved Social Science", "One Math elective". */
const CATEGORY_RE = new RegExp([
  // "Any UCGS History", "One approved Social Science"
  '\\b(?:any|one|two|three|a|an)\\b[^.;]*?\\b(?:UCGS|approved|elective|general education|gen\\s*ed)\\b[^.;]*',
  // A bare slot: "Electives", "Additional transfer electives", "Free elective"
  '\\b(?:additional|free|general|open|transfer|major|technical|guided)?\\s*electives?\\b[^.;]*',
  // "Additional courses", "Ancillary Courses", "Select one literature course"
  '\\b(?:additional|ancillary|supporting)\\s+courses?\\b[^.;]*',
  '\\bselect\\s+(?:one|two|three|\\d+(?:-\\d+)?)\\b[^.;]*',
  // "<University> General Education Requirements"
  '\\bgeneral education requirements?\\b[^.;]*',
  // Named competency requirements used by the receiving universities.
  '^\\s*(?:capstone|symposium|wellness|internship|practicum|thesis|seminar|colloquium|portfolio'
    + '|experiential learning|foreign language|world languages?|diversity[^.;]*|inclusion[^.;]*'
    + '|non-?western[^.;]*|global[^.;]*|arts? proficiency|writing intensive|oral communication'
    + '|upper-?level[^.;]*|upper-?division[^.;]*|minor|concentration|cognate)\\b[^.;]*',
  '\\b(?:course|courses|credits?)\\s+in\\s+[a-z][^.;]*',
  '\\bcommunication in context[^.;]*',
].join('|'), 'i');

const normalizeCode = (prefix, number) => `${prefix.toUpperCase()} ${number.toUpperCase()}`;

/**
 * A table's own summary line ("Pre-Transfer Credits", "TOTAL", "CREDITS
 * PRE-TRANSFER"), not a requirement. These were 41% of the rows the first
 * fidelity pass reported as unparsed, which both inflated the failure rate and
 * inflated the denominator every other rate is measured against.
 */
const SUMMARY_RE = /^\s*(?:total|subtotal|(?:pre|post)-?transfer\s+(?:credits?|hours?)|credits?\s+(?:pre|post)-?transfer|minimum\s+credits?|degree\s+total)\b/i;
const isSummaryRow = (text) => SUMMARY_RE.test(String(text ?? '').trim());

/**
 * Words that mark a parenthetical as illustration or advice rather than the
 * requirement itself. "(e.g., ART 125 Painting…)" sits on a row that already
 * names its real courses; folding it in would add courses the guide explicitly
 * offers as examples.
 */
const ADVISORY_RE = /\b(?:e\.?g\.?|for example|such as|including|recommended|suggested|preferred|prerequisite|optional|if eligible|repeatable)\b/i;

/**
 * Split parentheticals into content that belongs to the requirement and content
 * that does not.
 *
 * The corpus uses parentheses for both, and the distinction changes what the
 * requirement says:
 *
 *   "ENG literature (225,245,246,250,255,258,275)"   the parens ARE the courses
 *   "Humanities (PHI 220 or PHI 227)"                 the parens ARE the choice
 *   "Any UCGS Humanities (PHI 220 recommended)"       advice — not required
 *   "Any UCGS Social Science (not History)"           an exclusion — not a course
 *
 * Anything advisory, and anything naming no course at all, is removed and
 * preserved as a note. The rest is folded back into the requirement text and
 * the `parenthetical_codes` rule is recorded, so every row that depended on
 * this judgement can be pulled out and reviewed.
 */
function stripParentheticals(text) {
  const removed = [];
  let usedParenContent = false;
  const cleaned = String(text ?? '').replace(/\(([^)]*)\)/g, (_, raw) => {
    const inner = raw.trim();
    const namesCourses = /\b[A-Za-z]{2,4}\s?\d{3,4}\b/.test(inner) || /^[\s\d,;/&-]*\d{3,4}[\s\d,;/&-]*$/.test(inner);
    if (!namesCourses || ADVISORY_RE.test(inner)) {
      removed.push(inner);
      return ' ';
    }
    usedParenContent = true;
    return ` ${inner} `;
  });
  return { cleaned, parentheticals: removed, usedParenContent };
}

/**
 * Split on separators that mean "and also complete".
 *
 * `+` joins a required pair ("MTH 161+162"), so it separates conjuncts exactly
 * as `;` does. Reading it as a choice would let one course satisfy a
 * requirement that asks for two — understating what the student must complete,
 * which is the direction of error that matters.
 */
function splitRequired(text) {
  return text.split(/;|•|\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
}

/**
 * One conjunct -> its alternative course codes.
 * Returns { codes, rules } where `rules` names every inference that fired.
 */
function alternativesFor(chunk, carryPrefix = null) {
  const rules = [];
  const codes = [];
  const seen = new Set();
  const push = (code, rule) => {
    if (seen.has(code)) return;
    seen.add(code);
    codes.push(code);
    if (rule && !rules.includes(rule)) rules.push(rule);
  };

  // Explicit codes first; the last prefix seen becomes the carry candidate.
  // `carryPrefix` seeds it from an earlier conjunct, because splitting
  // "MTH 161+162" orphans the bare 162 from the prefix that governs it.
  let lastPrefix = carryPrefix;
  let match;
  CODE_RE.lastIndex = 0;
  const spans = [];
  while ((match = CODE_RE.exec(chunk)) !== null) {
    const prefix = match[1].toUpperCase();
    if (NOT_A_PREFIX.has(prefix)) continue;
    lastPrefix = prefix;
    push(normalizeCode(match[1], match[2]), 'explicit_code');
    spans.push([match.index, match.index + match[0].length]);
  }
  if (!codes.length && !carryPrefix) return { codes, rules, lastPrefix };

  // Slash alternatives: "GOL 105/106/110" — the numbers after a slash inherit
  // the prefix of the code immediately before it.
  const slash = /\b([A-Za-z]{2,4})\s?(\d{3,4}[A-Za-z]?)((?:\s?\/\s?\d{3,4}[A-Za-z]?)+)/gi;
  let sm;
  while ((sm = slash.exec(chunk)) !== null) {
    if (NOT_A_PREFIX.has(sm[1].toUpperCase())) continue;
    for (const n of sm[3].split('/').map((s) => s.trim()).filter(Boolean)) {
      push(normalizeCode(sm[1], n), 'slash_alternatives');
    }
  }

  // Prefix carry: a bare 3-digit number outside every matched code span, in a
  // cell that already named a prefix. "SDV 100 or 101".
  const inSpan = (i) => spans.some(([a, b]) => i >= a && i < b);
  BARE_NUMBER_RE.lastIndex = 0;
  let bm;
  while ((bm = BARE_NUMBER_RE.exec(chunk)) !== null) {
    const at = bm.index + bm[0].indexOf(bm[1]);
    if (inSpan(at) || !lastPrefix) continue;
    // Credit figures also appear as bare numbers, but never 3-digit, so a
    // 3-digit bare number in a requirement cell is a course number.
    push(normalizeCode(lastPrefix, bm[1]), 'prefix_carry');
  }

  return { codes, rules, lastPrefix };
}

/**
 * Parse one requirement cell.
 *
 * @param {string} raw the sending-column text
 * @returns {{
 *   raw: string, kind: 'course'|'category'|'unparsed',
 *   options: {codes: string[]}[], conjunction: 'and'|'or',
 *   category: string|null, parentheticals: string[],
 *   rules: string[], confidence: 'read'|'inferred'|'unparsed',
 * }}
 */
function parseRequirementCell(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (isSummaryRow(text)) {
    return {
      raw: text, kind: 'summary', options: [], conjunction: 'or', category: null,
      parentheticals: [], rules: ['summary_row'], confidence: 'read',
    };
  }
  const base = {
    raw: text,
    kind: 'unparsed',
    options: [],
    conjunction: 'or',
    category: null,
    parentheticals: [],
    rules: [],
    confidence: 'unparsed',
  };
  if (!text) return base;

  const { cleaned, parentheticals, usedParenContent } = stripParentheticals(text);
  base.parentheticals = parentheticals;

  const conjuncts = splitRequired(cleaned);
  const options = [];
  const rules = [];
  // A bare subject token with no number of its own ("ENG literature (225,…)")
  // is the prefix the parenthesised numbers belong to. Gated on the row having
  // actually contributed parenthesised codes: without that gate it also fires
  // on free text, turning "CPSC course numbered 300 or higher" — a level rule,
  // not a course — into a fabricated "CPSC 300".
  const bare = usedParenContent ? /^\s*([A-Za-z]{2,4})\b(?!\s?\d{3,4})/.exec(cleaned) : null;
  let carry = bare && !NOT_A_PREFIX.has(bare[1].toUpperCase()) ? bare[1].toUpperCase() : null;
  for (const chunk of conjuncts) {
    const { codes, rules: chunkRules, lastPrefix } = alternativesFor(chunk, carry);
    if (lastPrefix) carry = lastPrefix;
    if (!codes.length) continue;
    options.push({ codes });
    for (const r of chunkRules) if (!rules.includes(r)) rules.push(r);
  }

  if (options.length) {
    // Several conjuncts separated by ';' are all required; one conjunct listing
    // several codes is a choice among them.
    const conjunction = options.length > 1 ? 'and' : 'or';
    if (usedParenContent && !rules.includes('parenthetical_codes')) rules.push('parenthetical_codes');
    const inferred = rules.some((r) => (
      r === 'prefix_carry' || r === 'slash_alternatives' || r === 'parenthetical_codes'
    ));
    return {
      ...base,
      kind: 'course',
      options,
      conjunction,
      rules,
      confidence: inferred ? 'inferred' : 'read',
    };
  }

  // No course code anywhere: a category slot ("Any UCGS History") is a real
  // requirement the guide states without naming a course, and must be kept —
  // dropping it would understate what the student has to complete.
  const category = CATEGORY_RE.exec(cleaned);
  if (category) {
    return {
      ...base,
      kind: 'category',
      category: category[0].replace(/\s+/g, ' ').trim(),
      rules: ['category_slot'],
      confidence: 'read',
    };
  }

  return base;
}

module.exports = {
  NOT_A_PREFIX,
  isSummaryRow,
  parseRequirementCell,
  stripParentheticals,
  alternativesFor,
  splitRequired,
  CODE_RE,
};
