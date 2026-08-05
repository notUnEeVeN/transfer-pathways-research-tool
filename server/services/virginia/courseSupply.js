/**
 * Virginia supply side: which colleges actually offer a given VCCS course.
 *
 * Transfer Virginia's course search is Solr-backed and exposes an
 * `institutionName` facet. Two things about it decide the whole approach:
 *
 * 1. **The query must be the concatenated code.** `query=CSC 223` is fuzzy — it
 *    returns CSC222 alongside CSC223 and the facet counts both, so using it as a
 *    supply signal inflates every college's inventory with adjacent course
 *    numbers. `query=CSC223` matches exactly. Verified: 10/10 exact rows and 21
 *    facet institutions, against 44 for the spaced form.
 *
 * 2. **Read the facet, not the rows.** Result rows are paginated behind a
 *    JavaScript pager, so page one shows ten of them. Solr computes facets over
 *    the entire result set, so the institution facet is complete on page one —
 *    which is why this needs 586 requests rather than thousands.
 *
 * The result is an exact join: guides name VCCS codes, colleges use the same
 * codes, so "can this college satisfy this requirement" is set membership
 * rather than an inference about equivalence.
 */
const cheerio = require('cheerio');

const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** `ENG 111` -> `ENG111`, the form the search matches exactly. */
const queryForm = (code) => String(code ?? '').replace(/\s+/g, '').toUpperCase();

/** A VCCS community college, as opposed to a four-year in the same facet. */
const isCommunityCollege = (name) => /community college|college of/i.test(name)
  && !/university/i.test(name);

/**
 * Institutions in the `institutionName` facet, with their match counts.
 * @returns {{name: string, count: number}[]}
 */
function parseInstitutionFacet(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('.facet').each((_, el) => {
    const $el = $(el);
    const link = $el.find('[data-facet-value]').first();
    const name = clean(link.attr('data-facet-value') || link.text());
    if (!name) return;
    const raw = clean($el.find('.facet-count').first().text());
    const count = Number((/\((\d+)\)/.exec(raw) || [])[1] || 0);
    out.push({ name, count });
  });
  return out;
}

/**
 * Result rows actually shown on the page: exact code + institution. Only the
 * first page is present, so this is a *verification* sample for the facet, not
 * the supply set itself.
 */
function parseResultRows(html) {
  const $ = cheerio.load(html);
  const text = clean($('body').text());
  const out = [];
  const re = /\b([A-Z]{2,4}\d{3}[A-Z]?)\s+([^|]{3,80}?)\s+((?:[A-Z][\w'&.-]*\s?){1,6}(?:Community College|University|College))\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ code: m[1], title: clean(m[2]), institution: clean(m[3]) });
  }
  return out;
}

/**
 * Which institutions offer one course code.
 *
 * `verified` reports whether every result row visible on page one carried the
 * requested code. A false value means the query was not exact after all and the
 * facet cannot be trusted for that code — surfaced rather than silently used.
 */
async function supplyForCode(client, code) {
  const q = queryForm(code);
  const html = await client.get(`/courses?query=${encodeURIComponent(q)}`);
  if (!html) return { code, ok: false, reason: 'fetch_failed', institutions: [] };

  const rows = parseResultRows(html);
  const facet = parseInstitutionFacet(html);
  const offCode = rows.filter((r) => r.code !== q);
  const colleges = facet.filter((f) => isCommunityCollege(f.name)).map((f) => f.name);

  return {
    code,
    ok: true,
    verified: rows.length > 0 && offCode.length === 0,
    sample_rows: rows.length,
    off_code_rows: offCode.length,
    institutions: facet.map((f) => f.name),
    community_colleges: colleges,
  };
}

module.exports = {
  supplyForCode,
  parseInstitutionFacet,
  parseResultRows,
  queryForm,
  isCommunityCollege,
};
