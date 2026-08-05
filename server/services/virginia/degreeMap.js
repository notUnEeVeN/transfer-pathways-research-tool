/**
 * Parse a Transfer Virginia program map into the project's canonical
 * requirement tree.
 *
 * Source: `/degrees/ajax/degree-map/<instGUID>/<degreeGUID>/<inst>/<degree>`,
 * which returns `{ html }` holding the rules engine's own AST serialised as
 * nested divs. The class names are node types, not styling:
 *
 *   .requirement            a requirement node; nests
 *     .requirement-entry      its header row
 *       .td_req_cat             the requirement / category name
 *       .td_req_cred            credits required
 *     .rule-descr             the leaf rule, when the node has no children
 *       .RULE.STRING.COURSE     a course rule
 *       .RULE.GROUP             a nested rule group
 *       .rule-descr-form        one course code
 *       .group-combinator       AND / OR between siblings
 *       .FILTER.NUMERIC.CUM_GPA a GPA filter
 *
 * The rule sentences come from a closed grammar, not prose — 4 templates
 * across the whole corpus — which is what makes this parseable at all:
 *
 *   Earn N credits by completing courses from the following Course:
 *   Earn N credits by completing courses from the following Course list:
 *   Earn N credits: Complete the following / Use the following rules
 *   This requires a minimum GPA of N
 *
 * Every node carries its own credit figure against a stated program total, so
 * the tree self-validates: `creditReconciliation()` reports the leaf sum
 * against the stated total rather than assuming they agree.
 */
const cheerio = require('cheerio');

const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** Requirements satisfied by standing, not by taking a course. */
const ADMIN_TITLE = /residency|GPA|grade point|application (to|for) grad|academic standing|total credit|minimum credit|course grad req/i;
const codeForm = (s) => clean(s).replace(/\s+/g, '').toUpperCase();

/** `Earn 3 credits …` -> 3. Null when the sentence states no figure. */
function creditsFromRule(text) {
  const m = /Earn\s+([\d.]+)\s+credits?/i.exec(text || '');
  return m ? Number(m[1]) : null;
}

/**
 * Whether a course rule is a choice or a required set.
 *
 * "…from the following Course:" names one course. "…Course list:" offers
 * several. A group-combinator of AND between the items means all of them are
 * required together (the 8-credit `CHM 111 and PHY 241` shape), which is the
 * distinction between an `and` course_conjunction and separate `or` options.
 */
function ruleConjunction($, $rule) {
  const combinators = $rule.find('.group-combinator').map((_, el) => clean($(el).text()).toUpperCase()).get();
  if (combinators.length && combinators.every((c) => c === 'AND')) return 'and';
  if (/Course list:/i.test(clean($rule.text()))) return 'or';
  return combinators.includes('OR') ? 'or' : 'and';
}

/** The receiver options for one leaf rule. */
function optionsForRule($, $rule, keyOf) {
  const codes = [...new Set($rule.find('.rule-descr-form')
    .map((_, el) => codeForm($(el).text())).get()
    .filter((c) => /^[A-Z]{2,5}\d{2,4}[A-Z]?$/.test(c)))];
  if (!codes.length) return { options: [], options_conjunction: 'or', codes };

  if (ruleConjunction($, $rule) === 'and') {
    // One option that requires every listed course together.
    return {
      options: [{
        course_ids: codes.map((c) => keyOf(c).id),
        course_conjunction: 'and',
        course_keys: codes.map((c) => keyOf(c).key),
      }],
      options_conjunction: 'and',
      codes,
    };
  }
  // Each course independently satisfies the rule.
  return {
    options: codes.map((c) => ({
      course_ids: [keyOf(c).id],
      course_conjunction: 'and',
      course_keys: [keyOf(c).key],
    })),
    options_conjunction: 'or',
    codes,
  };
}

/**
 * Walk the `.requirement` tree into plain nodes.
 * A node is a leaf when it has no child `.requirement`; its rule then holds the
 * courses. Only *direct* children are followed — the header row repeats its
 * parent's title, and descending into it would double every node.
 */
function walk($, el, keyOf, depth = 0) {
  const $el = $(el);
  const entry = $el.children('.requirement-entry').first();
  const title = clean(entry.find('.td_req_cat').first().text()) || null;
  const creditsRaw = clean(entry.find('.td_req_cred').first().text());
  const credits = /^[\d.]+$/.test(creditsRaw) ? Number(creditsRaw) : null;

  const children = $el.children('.requirement').map((_, c) => walk($, c, keyOf, depth + 1)).get();
  if (children.length) return { title, credits, depth, children, leaf: false };

  const $rule = $el.children('.rule-descr').first();
  const ruleText = clean($rule.text());
  const { options, options_conjunction, codes } = optionsForRule($, $rule, keyOf);
  return {
    title,
    credits: credits ?? creditsFromRule(ruleText),
    depth,
    children: [],
    leaf: true,
    rule_text: ruleText || null,
    min_gpa: (() => {
      const m = /minimum GPA of ([\d.]+)/i.exec(ruleText || '');
      return m ? Number(m[1]) : null;
    })(),
    options,
    options_conjunction,
    codes,
  };
}

/**
 * Parse a degree map.
 *
 * `keyOf(code)` maps a VCCS code to `{ id, key }` — the numeric id and
 * namespaced key the canonical schema stores. Injected rather than derived here
 * so the id policy lives in one place (the import script).
 *
 * Returns `{ deferred: true }` for the maps the portal has not published, which
 * it answers with a stub page rather than an error.
 */
function parseDegreeMap(json, { keyOf = (c) => ({ id: c, key: `va:${c}` }) } = {}) {
  const html = typeof json === 'string' ? json : (json?.html || '');
  if (/expected in a future release/i.test(html)) return { deferred: true, groups: [], stats: {} };

  const $ = cheerio.load(html);
  $('script, style').remove();

  const roots = $('.program-map .requirement').filter((_, el) => !$(el).parents('.requirement').length);
  const nodes = roots.map((_, el) => walk($, el, keyOf)).get();

  // The top of the tree repeats the program itself two or three times (degree
  // title, award, program name) before the real requirement groups begin.
  // Descend through single-child wrappers to the first node that actually
  // branches, so the groups are the requirement groups and not the wrappers.
  let top = nodes.filter((n) => n.title || n.children.length);
  while (top.length === 1 && top[0].children.length) top = top[0].children;

  const leaves = [];
  (function collect(list) {
    for (const n of list) (n.leaf ? leaves.push(n) : collect(n.children));
  })(top);

  // Administrative requirements — residency, cumulative GPA, application to
  // graduate — are leaves with no courses that restate the *program's* whole
  // credit figure. Summing them triples a 60-credit degree, so they are
  // classified out of the course-credit total and kept as their own kind. They
  // are still requirements; they are just not satisfied by taking a course.
  // Three kinds, and the distinction decides the credit sum:
  //   course        — an explicit course list; counts.
  //   unenumerated  — a credit-bearing requirement with no list ("12 credits of
  //                   300-level electives"). Real, consumes credits, counts —
  //                   but nothing to join on, so it is flagged for the hand
  //                   verifier rather than silently treated as satisfied.
  //   administrative— residency / GPA / standing. Restates the *program* total
  //                   with no courses; counting it triples the degree.
  for (const l of leaves) {
    const admin = l.min_gpa != null
      || ADMIN_TITLE.test(l.title || '') || ADMIN_TITLE.test(l.rule_text || '');
    l.kind = l.codes.length ? 'course' : admin ? 'administrative' : 'unenumerated';
  }
  // Both course and unenumerated requirements consume credits toward the total.
  const courseLeaves = leaves.filter((l) => l.kind === 'course' || l.kind === 'unenumerated');

  const stated = (() => {
    const scan = (list) => { for (const n of list) { if (n.credits) return n.credits; } return null; };
    return scan(nodes) ?? scan(nodes.flatMap((n) => n.children));
  })();

  return {
    deferred: false,
    groups: top,
    stats: {
      groups: top.length,
      leaves: leaves.length,
      course_leaves: leaves.filter((l) => l.kind === 'course').length,
      administrative: leaves.filter((l) => l.kind === 'administrative').length,
      courses: new Set(leaves.flatMap((l) => l.codes)).size,
      // Course credits only — see the classification note above.
      leaf_credits: courseLeaves.reduce((s, l) => s + (l.credits || 0), 0),
      stated_total: stated,
      unenumerated: leaves.filter((l) => l.kind === 'unenumerated').length,
    },
  };
}

/**
 * Leaf credits against the program's stated total. Reported, never corrected —
 * a mismatch means the tree was misread and should be looked at by hand, which
 * is the one check this source gives us for free.
 */
function creditReconciliation(parsed) {
  const { leaf_credits: leaf, stated_total: stated } = parsed.stats || {};
  if (stated == null) return { ok: null, reason: 'no stated total', leaf, stated };
  return { ok: Math.abs(leaf - stated) <= 1, leaf, stated, delta: leaf - stated };
}

module.exports = { parseDegreeMap, creditReconciliation, walk, creditsFromRule, ruleConjunction };
