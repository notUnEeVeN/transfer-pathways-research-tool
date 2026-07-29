/**
 * The ARTSYS group-header grammar.
 *
 * ASSIST states its choose-N semantics as enum combinations
 * (`NFromArea` + `amountUnitType` + `toAmountDeterminer`), so the California
 * parser had to reconstruct the rule. ARTSYS states them in English, already
 * resolved by a human — the work here is reading a small, closed vocabulary
 * rather than reverse-engineering a grammar.
 *
 * Measured on a 60-guide random sample (docs/state-expansion-feasibility.md
 * §3.5): 17 constructs, 27 co-occurring combinations, 0.2% of group headers
 * matching nothing, and exactly one new construct across the final 20 guides.
 * The set below is that vocabulary. `parseGroupRule` returns `matched: false`
 * for anything outside it so the importer can surface drift instead of quietly
 * inventing a requirement — see `unmatchedHeaders` in the import report.
 *
 * A header carries two kinds of number and they are NOT interchangeable:
 *   - a course count  ("complete the following 11 requirements")  -> group_advisement
 *   - a credit figure ("33 credits")                              -> see below
 * On a course-count group the credit figure is descriptive (the sum of the
 * listed courses), not a constraint, so it is recorded as `stated_credits` and
 * never as `group_unit_advisement`. Only a group whose rule is stated purely in
 * credits ("take 6 credits", "Electives 12 credits") gets a real unit
 * advisement. Conflating the two would turn a 33-credit description into a
 * 33-unit requirement and silently inflate every degree.
 */

const WORD_NUMBERS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
});

/** `"3"` / `"three"` -> 3; anything else -> null. */
function toNumber(token) {
  if (token == null) return null;
  const raw = String(token).trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return WORD_NUMBERS[raw] ?? null;
}

const NUM = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)';

// Ordered: the first course-count rule that matches wins. Ordering matters in
// exactly one place — `complete_one_of` must be tried before the looser
// `take_N_from_list`, because "complete one of these courses" would otherwise
// be read as a bare "one course" with no choose-from semantics.
const COUNT_RULES = Object.freeze([
  { key: 'complete_following_N', re: new RegExp(`complete the following ${NUM} requirements?`, 'i'), count: 1 },
  { key: 'complete_one_of', re: /complete (?:one|1) of (?:these|the following)/i, fixed: 1 },
  { key: 'take_one_of', re: /take (?:one|1) of the following/i, fixed: 1 },
  { key: 'complete_N_courses_from', re: new RegExp(`complete ${NUM} courses? from`, 'i'), count: 1 },
  { key: 'select_N_courses', re: new RegExp(`select ${NUM} courses?`, 'i'), count: 1 },
  { key: 'take_N_courses_from', re: new RegExp(`take ${NUM} courses? (?:from|in)\\b`, 'i'), count: 1 },
  { key: 'take_N_from_list', re: new RegExp(`take ${NUM} (?:[a-z:& ]{0,24}?)courses?`, 'i'), count: 1 },
  { key: 'complete_all', re: /complete all of the courses/i, all: true },
]);

// Distribution constraints. These map onto the same fields the California
// parser derives for ASSIST's NFromArea patterns, so the eligibility engine
// needs no new branch: `group_min_distinct_sections` (at least K areas must
// contribute) and `group_max_distinct_sections` (completion may span at most K).
const DISTRIBUTION_RULES = Object.freeze([
  {
    key: 'from_K_different',
    re: new RegExp(`from (?:at least )?${NUM} different (?:categor|disciplin|area)`, 'i'),
    apply: (m, out) => { out.group_min_distinct_sections = toNumber(m[1]); },
  },
  {
    key: 'each_from_different',
    re: /each from a different (?:categor|disciplin|area)/i,
    // "take N courses, 1 each from a different category" — the course count is
    // already captured above; this says those N must come from N distinct
    // sections, so the minimum equals the count.
    apply: (m, out) => { out.group_min_distinct_sections = out.group_advisement ?? null; },
  },
  {
    key: 'N_from_K_groups',
    re: new RegExp(`${NUM} courses? from ${NUM} of the following groups`, 'i'),
    apply: (m, out) => {
      out.group_advisement = toNumber(m[1]);
      out.group_min_distinct_sections = toNumber(m[2]);
    },
  },
  {
    key: 'up_to_N',
    re: new RegExp(`up to ${NUM} (?:of these )?courses?`, 'i'),
    apply: (m, out) => { out.group_max_courses = toNumber(m[1]); },
  },
  {
    key: 'no_double_count',
    re: /no course may double count/i,
    apply: (m, out) => { out.no_double_count = true; },
  },
]);

const CREDIT_RANGE_RE = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*credits?/i;
const CREDIT_RE = /(\d+(?:\.\d+)?)\s*credits?/i;
const GRADE_RE = /(?:with an?|grade of)\s*['"“”]?([A-D])['"“”]?\s*(?:grade\s*)?or better/i;

/**
 * Read one group header.
 *
 * @param {string} header raw text of the `.req-header` block
 * @returns {{
 *   label: string, matched: boolean, constructs: string[],
 *   group_advisement: number|null, group_unit_advisement: number|null,
 *   group_min_distinct_sections: number|null, group_max_distinct_sections: number|null,
 *   group_max_courses: number|null, stated_credits: {min:number,max:number}|null,
 *   min_grade: string|null, no_double_count: boolean,
 * }}
 */
function parseGroupRule(header) {
  const text = String(header ?? '').replace(/\s+/g, ' ').trim();
  const out = {
    label: text,
    matched: false,
    constructs: [],
    group_advisement: null,
    group_unit_advisement: null,
    group_min_distinct_sections: null,
    group_max_distinct_sections: null,
    group_max_courses: null,
    stated_credits: null,
    min_grade: null,
    no_double_count: false,
    complete_all: false,
  };
  if (!text) return out;

  for (const rule of COUNT_RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    out.constructs.push(rule.key);
    if (rule.all) out.complete_all = true;
    else if (rule.fixed != null) out.group_advisement = rule.fixed;
    else out.group_advisement = toNumber(m[rule.count]);
    break;
  }

  for (const rule of DISTRIBUTION_RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    out.constructs.push(rule.key);
    rule.apply(m, out);
  }

  const range = CREDIT_RANGE_RE.exec(text);
  const single = range ? null : CREDIT_RE.exec(text);
  if (range) {
    out.stated_credits = { min: Number(range[1]), max: Number(range[2]) };
    out.constructs.push('credit_range');
  } else if (single) {
    out.stated_credits = { min: Number(single[1]), max: Number(single[1]) };
    out.constructs.push('N_credits');
  }

  // Credits become a real constraint only when nothing states a course count.
  if (out.group_advisement == null && !out.complete_all && out.stated_credits) {
    out.group_unit_advisement = out.stated_credits.min;
    out.constructs.push('unit_advisement_from_credits');
  }

  const grade = GRADE_RE.exec(text);
  if (grade) {
    out.min_grade = grade[1].toUpperCase();
    out.constructs.push('grade_min');
  }

  out.matched = out.group_advisement != null
    || out.group_unit_advisement != null
    || out.complete_all
    || out.constructs.length > 0;
  return out;
}

module.exports = { parseGroupRule, toNumber, WORD_NUMBERS };
