const { codePattern } = require('./normalize');

/**
 * Decide whether a parsed requirement tree may be trusted into the database.
 *
 * The rule this file exists to enforce: **a parse that cannot be checked does
 * not get imported.** The previous Virginia collector had no such gate, so a
 * page it half-read and a page it read perfectly produced documents that looked
 * identical downstream — one flat group of course codes, no signal that
 * anything had been lost. Every check below either passes with evidence or
 * routes the institution to a hand read.
 *
 * Checks are graded, not boolean:
 *
 *   fail   the tree is wrong or unverifiable — hand-read it
 *   warn   worth a human's eye, but the tree is still usable
 *   pass   checked and fine
 */

/**
 * Where a code sits in the page text: `exact`, `ambiguous`, or `absent`.
 *
 * Only `absent` is evidence of invention, and that distinction carries the
 * whole check. Extracted text glues neighbouring cells together, so a genuine
 * `CSC 472` worth 3 credits prints as `CSC 4723D Game Programming` — the code
 * is right there, but a scanner reading only text cannot tell `CSC 472` + `3`
 * from a four-digit `CSC 4723`. The markup already settled it; treating the
 * ambiguity as a fabricated course would reject a correct parse for a
 * whitespace artefact, and treating it as clean would hide the one case this
 * check exists to catch.
 */
function locateCode(code, text) {
  const pattern = codePattern(code);
  if (!pattern) return 'absent';
  if (pattern.test(text)) return 'exact';

  // A lecture-plus-lab pair prints as `CSC 170& 170L`: the prefix is stated
  // once, for both. The parser restores it, so the full code is correct but was
  // never printed in that form.
  const bare = /^[A-Z]{2,5}(\d{3,4}[A-Z])$/.exec(code);
  if (bare && new RegExp(`(?:^|[^A-Za-z\\d])${bare[1]}(?!\\d)`).test(text)) return 'exact';

  const m = /^([A-Z]{2,5})(\d{3,4}[A-Z]?)$/.exec(code);
  if (m && new RegExp(`${m[1]}\\s?[-–—]?\\s?${m[2]}`).test(text)) return 'ambiguous';
  return 'absent';
}

/** Back-compat boolean: the code is on the page in some readable form. */
const codeAppearsIn = (code, text) => locateCode(code, text) !== 'absent';

const allRows = (tree) => (tree.groups || []).flatMap((g) => (g.sections || []).flatMap((s) => s.rows || []));
const allCodes = (tree) => [...new Set(allRows(tree).flatMap((r) => (r.codes || []).map((c) => c.code)))];

/** Credit range the parsed groups add up to. */
function creditSpan(tree) {
  let min = 0;
  let max = 0;
  let stated = 0;
  for (const g of tree.groups || []) {
    if (g.credits) { min += g.credits.min; max += g.credits.max; stated += 1; }
  }
  return { min, max, groups_with_credits: stated };
}

/**
 * Validate one parsed tree against the text it came from.
 *
 * `sourceText` is the captured page. `knownCodes` is the set of codes that
 * resolve in the course registry — supplied only for community colleges, since
 * VCCS shares one numbering system and four-year codes have no registry to
 * check against.
 */
function validateTree(tree, { sourceText = '', knownCodes = null, level = 'community_college' } = {}) {
  const checks = [];
  const add = (severity, name, detail, extra = {}) => checks.push({ severity, name, detail, ...extra });

  const groups = tree.groups || [];
  const rows = allRows(tree);
  const codes = allCodes(tree);
  const codeRows = rows.filter((r) => (r.codes || []).length);
  const categoryRows = rows.filter((r) => !(r.codes || []).length);

  // 1. Nothing may be invented. Every code must be printed on the page.
  const located = codes.map((c) => ({ code: c, where: locateCode(c, sourceText) }));
  const absent = located.filter((c) => c.where === 'absent').map((c) => c.code);
  const ambiguous = located.filter((c) => c.where === 'ambiguous').map((c) => c.code);
  if (absent.length) add('fail', 'codes_not_in_source', `${absent.length} parsed code(s) do not appear in the captured text`, { codes: absent.slice(0, 12) });
  else if (ambiguous.length) add('warn', 'codes_ambiguous', `${ambiguous.length} code(s) appear on the page but run into an adjacent figure in the extracted text`, { codes: ambiguous.slice(0, 12) });
  else add('pass', 'codes_not_in_source', `all ${codes.length} codes appear verbatim in the captured text`);

  // 2. A single group is the exact failure this rewrite exists to fix. It is
  //    legitimate only when the page really does print one undifferentiated
  //    list, which is rare enough to be worth a look every time.
  if (!groups.length) add('fail', 'no_groups', 'no requirement groups parsed');
  else if (groups.length === 1) add('warn', 'single_group', 'only one requirement group — check the page really has no headings');
  else add('pass', 'group_count', `${groups.length} requirement groups`);

  // 3. Enough substance to be a degree.
  if (codes.length < 8 && level === 'community_college') add('fail', 'too_few_courses', `${codes.length} distinct courses is short for an A.S. degree`);
  else if (codes.length < 5) add('warn', 'few_courses', `${codes.length} distinct courses`);
  else add('pass', 'course_count', `${codes.length} distinct courses across ${rows.length} rows`);

  // 4. Credits must reconcile against the degree's own stated total. A range is
  //    a pass when the stated total falls inside it: `7-10` elective credits is
  //    the catalog's own arithmetic, not our uncertainty.
  const span = creditSpan(tree);
  const total = tree.total_credits;
  if (!total) {
    add('warn', 'no_stated_total', 'the page states no total credit figure — nothing to reconcile against');
  } else if (span.groups_with_credits >= 2 && total.min >= span.min - 1 && total.min <= span.max + 1) {
    // The sum lands on the stated total. That is the strongest evidence
    // available that nothing was dropped, and it is worth more than how many
    // headings happened to print a figure — so it is tested first.
    add('pass', 'credits_reconcile', `groups sum to ${span.min}–${span.max}, stated total ${total.raw}`);
  } else if (span.groups_with_credits < groups.length) {
    // Only a sum over *every* group can be compared with the total. Where some
    // headings print no figure, a shortfall is explained by those headings and
    // says nothing about whether the parse dropped anything — Richard Bland
    // prints figures on its general-education blocks and none on its major
    // core, and the missing 26 credits are exactly that core.
    const silent = groups.length - span.groups_with_credits;
    add('warn', 'credits_partial', `groups sum to ${span.min}–${span.max} against a stated ${total.raw}, but ${silent} of ${groups.length} groups print no figure — cannot reconcile`);
  } else {
    // Every group states a figure, so the arithmetic is decisive either way.
    add('fail', 'credits_disagree', `every group states credits and they sum to ${span.min}–${span.max}, but the page states ${total.raw}`, { delta: total.min - span.min });
  }

  // 5. Codes that no longer exist in the registry are usually a misparse
  //    (a page number read as a course number), not a new course.
  if (knownCodes) {
    const unknown = codes.filter((c) => !knownCodes.has(c));
    const ratio = codes.length ? unknown.length / codes.length : 0;
    if (ratio > 0.35) add('fail', 'codes_unresolved', `${unknown.length} of ${codes.length} codes are not in the course registry`, { codes: unknown.slice(0, 12) });
    else if (unknown.length) add('warn', 'codes_unresolved', `${unknown.length} of ${codes.length} codes are not in the course registry`, { codes: unknown.slice(0, 12) });
    else add('pass', 'codes_resolved', `all ${codes.length} codes resolve in the course registry`);
  }

  // 6. A degree of only unenumerated categories tells a reader nothing.
  if (rows.length && codeRows.length === 0) add('fail', 'no_enumerated_courses', 'every row is an unenumerated category');
  else if (categoryRows.length) add('pass', 'categories', `${categoryRows.length} unenumerated requirement(s) kept as categories`);

  const worst = checks.some((c) => c.severity === 'fail') ? 'fail'
    : checks.some((c) => c.severity === 'warn') ? 'warn' : 'pass';

  return {
    verdict: worst,
    needs_hand_read: worst === 'fail',
    checks,
    stats: {
      groups: groups.length,
      sections: groups.reduce((n, g) => n + (g.sections || []).length, 0),
      rows: rows.length,
      course_rows: codeRows.length,
      category_rows: categoryRows.length,
      distinct_courses: codes.length,
      credit_span: span,
      stated_total: total ? total.raw : null,
    },
  };
}

module.exports = { validateTree, codeAppearsIn, locateCode, allCodes, allRows, creditSpan };
