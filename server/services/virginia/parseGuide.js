/**
 * Transfer Virginia guide HTML -> structured requirements.
 *
 * A guide is a Drupal node whose body holds two hand-authored tables:
 *
 *   TABLE 1  "Complete at a Virginia Community College" | Credits | Course Equivalent | Notes
 *   TABLE 2  "Complete at <University>"                 | Credits | Notes
 *
 * Only table 1 is in scope — table 2 is coursework taken after transfer and
 * says nothing about what a community college can supply.
 *
 * Unlike ARTSYS, Virginia publishes ONE guide for all 23 colleges: the guide is
 * pure demand. There is no per-college rendering and therefore no articulation
 * status to read. Whether a given college can satisfy a row is answered later,
 * by joining these course codes against that college's course listing — the
 * join is exact because guides and colleges both use VCCS numbers.
 *
 * Fidelity is the point of this module, so it reports rather than repairs.
 * Every row carries the rules that fired and a confidence, and any row whose
 * requirement cell yields neither a course code nor a category slot is counted
 * as `unparsed` and kept with its raw text. Silently dropping such a row would
 * shorten the requirement list and make every college look better than it is.
 */
const cheerio = require('cheerio');
const { parseRequirementCell } = require('./rowGrammar');

const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** Header phrasings observed for the community-college table. */
const CC_TABLE_HEADERS = [
  /complete at a virginia community college/i,
  /community college course/i,
];

/** Header phrasing for the post-transfer table, which we skip. */
const UNIVERSITY_TABLE_HEADER = /complete at\s+(?!a virginia community college)/i;

function rowCells($, tr) {
  return $(tr).find('td,th').map((_, td) => clean($(td).text())).get();
}

/** Guide identity: program title, catalog year, VCCS curriculum basis. */
function parseHeader($) {
  const title = clean($('h1').first().text()) || clean($('h2').first().text());
  const body = clean($('body').text());
  const program = (/Bachelor of [^|]*?(?=Catalog Year|Based on VCCS|$)/i.exec(body) || [])[0];
  const catalogYear = (/Catalog Year\s*([0-9]{4}\s*-\s*[0-9]{2,4})/i.exec(body) || [])[1];
  const basis = (/Based on VCCS Curriculum for\s+([A-Z0-9 &,\/-]+?)(?=\s{2}|Complete at|Community College Course|$)/i
    .exec(body) || [])[1];
  return {
    title: title || null,
    program: program ? clean(program) : null,
    catalog_year: catalogYear ? clean(catalogYear) : null,
    vccs_curriculum: basis ? clean(basis) : null,
  };
}

/**
 * Parse a guide page.
 *
 * @param {string} html
 * @param {{slug?: string}} [meta]
 */
function parseGuide(html, { slug = null } = {}) {
  const $ = cheerio.load(html);
  const header = parseHeader($);

  let ccTable = null;
  let universityName = null;
  $('table').each((_, table) => {
    const trs = $(table).find('tr').toArray();
    if (!trs.length) return;
    const head = rowCells($, trs[0]);
    const joined = head.join(' | ');
    if (!ccTable && CC_TABLE_HEADERS.some((re) => re.test(joined))) {
      ccTable = { head, trs: trs.slice(1) };
      return;
    }
    if (!universityName) {
      const m = UNIVERSITY_TABLE_HEADER.exec(joined);
      if (m) universityName = clean(joined.slice(m.index + m[0].length).split('|')[0]);
    }
  });

  const rows = [];
  const stats = {
    rows: 0, course_rows: 0, category_rows: 0, unparsed_rows: 0,
    summary_rows: 0, inferred_rows: 0, codes: 0,
  };

  for (const tr of ccTable?.trs || []) {
    const cells = rowCells($, tr);
    if (!cells.length) continue;
    const [requirement, credits, equivalent, notes] = cells;
    // A row with an empty requirement cell is a spacer or a sub-heading the
    // author left in; it is not a dropped requirement.
    if (!requirement) continue;

    const parsed = parseRequirementCell(requirement);
    // A summary line is part of the table's furniture, not a requirement. It is
    // counted separately and kept out of `rows`, which is the denominator every
    // fidelity rate is reported against.
    if (parsed.kind === 'summary') {
      stats.summary_rows += 1;
      rows.push({ requirement: parsed, credits: clean(credits) || null,
        course_equivalent: clean(equivalent) || null, notes: clean(notes) || null });
      continue;
    }
    stats.rows += 1;
    if (parsed.kind === 'course') stats.course_rows += 1;
    else if (parsed.kind === 'category') stats.category_rows += 1;
    else stats.unparsed_rows += 1;
    if (parsed.confidence === 'inferred') stats.inferred_rows += 1;
    stats.codes += parsed.options.reduce((n, o) => n + o.codes.length, 0);

    rows.push({
      requirement: parsed,
      credits: clean(credits) || null,
      // What the receiving university grants for it — a name, a course code, or
      // "Does not transfer". Kept raw: it is the university's own wording.
      course_equivalent: clean(equivalent) || null,
      notes: clean(notes) || null,
    });
  }

  return {
    slug,
    ...header,
    university_name: universityName,
    has_cc_table: !!ccTable,
    rows,
    stats,
  };
}

module.exports = { parseGuide, parseHeader, CC_TABLE_HEADERS };
