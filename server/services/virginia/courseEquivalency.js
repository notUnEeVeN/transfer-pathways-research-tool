/**
 * Virginia course-level equivalencies, from `/course/<GUID>` detail pages.
 *
 * Each page is one *(college, course)* record and carries a server-rendered
 * "Where Will This Course Transfer?" table: one row per institution that
 * accepts the course, with the identifier it lands as, its title, any notes,
 * and a 2-Year/4-Year level tag. No JavaScript, no token, no pagination — the
 * whole table is in the HTML.
 *
 * Two properties decide how this gets crawled:
 *
 * 1. **Equivalencies key on the VCCS common course, not the sending college.**
 *    Four sending colleges' CSC221 pages returned byte-identical four-year
 *    mappings (17 institutions, same target identifiers). So one page per
 *    distinct course code is enough, and the sending-college dimension comes
 *    from the 2-Year rows instead. `crossCheck` below is what keeps that claim
 *    honest as the corpus grows rather than assuming it from four samples.
 *
 * 2. **The 2-Year rows are the supply signal.** They name every college whose
 *    catalog carries the same course, which is what `courseSupply.js` spent 586
 *    requests deriving from Solr facets. Same answer, already on the page.
 */
const cheerio = require('cheerio');

const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** `CSC221: Introduction to …` -> `{ code, title }`. */
function splitHeading(text) {
  const m = /^([A-Za-z]{2,5}\s?-?\s?\d{2,4}[A-Za-z]?)\s*[::]\s*(.*)$/.exec(clean(text));
  if (!m) return { code: null, title: clean(text) || null };
  return { code: m[1].replace(/[\s-]/g, '').toUpperCase(), title: clean(m[2]) || null };
}

/**
 * A labelled card value in the Overview panel. The label sits in
 * `.card-header .title-header`; the value is the rest of the card's text, so it
 * is read by subtraction rather than by a positional selector that would break
 * on the cards that carry an extra "Estimate" link.
 */
function cardValue($, label) {
  const header = $('.card-header .title-header').filter((_, el) => clean($(el).text()) === label).first();
  if (!header.length) return null;
  const card = header.closest('.card, .card-header').parent();
  const whole = clean(card.text());
  const rest = clean(whole.replace(new RegExp(`^${label}`), ''));
  // The affordance labels are stripped without word boundaries: the DOM does
  // not guarantee whitespace between a value and the link that follows it, so
  // `3.0Estimate` is a shape this has to survive.
  const v = clean(rest.replace(/Estimate/g, '').replace(/Check Course Schedules/g, ''));
  return v || null;
}

const LEVELS = { '2-year': 'two_year', '4-year': 'four_year' };

/**
 * Parse one `/course/<GUID>` page.
 *
 * `equivalencies[].level` is normalised to `two_year` / `four_year`; anything
 * else is kept verbatim under `level_raw` so an unrecognised tag shows up in
 * validation instead of being silently dropped into one of the two buckets.
 */
function parseCoursePage(html, { url = null } = {}) {
  const $ = cheerio.load(html);
  $('script, style').remove();

  const div = $('.course-div').first();
  const heading = clean(div.find('.Courses-name').first().text()) || clean($('h4').first().text());
  const { code, title } = splitHeading(heading);

  const equivalencies = [];
  const unknownLevels = [];
  $('#courses-equivalencies-table table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((__, td) => clean($(td).text())).get();
    if (cells.length < 5) return;
    const [institution, identifier, name, notes, levelRaw] = cells;
    if (!institution) return;
    const level = LEVELS[levelRaw.toLowerCase()] || null;
    if (!level) unknownLevels.push(levelRaw);
    equivalencies.push({
      institution,
      identifier: identifier || null,
      name: name || null,
      notes: notes || null,
      level,
      level_raw: levelRaw || null,
    });
  });

  const creditsRaw = cardValue($, 'Credits');
  const credits = creditsRaw != null && /^\d+(\.\d+)?$/.test(creditsRaw) ? Number(creditsRaw) : null;

  return {
    source_url: url,
    code,
    title,
    institution: clean(div.find('.participatingname').first().text()) || null,
    description: clean(div.find('.instdescr').first().text()) || null,
    credits,
    credits_raw: creditsRaw,
    department: cardValue($, 'Department'),
    equivalencies,
    stats: {
      rows: equivalencies.length,
      two_year: equivalencies.filter((e) => e.level === 'two_year').length,
      four_year: equivalencies.filter((e) => e.level === 'four_year').length,
      with_notes: equivalencies.filter((e) => e.notes).length,
      unknown_levels: unknownLevels,
    },
  };
}

/** `/courses?query=CSC221` -> the course-detail GUIDs it lists. */
function parseCourseSearch(html) {
  const $ = cheerio.load(html);
  const ids = [];
  $('a[href^="/course/"]').each((_, a) => {
    const m = /^\/course\/([A-F0-9]{20,})$/i.exec($(a).attr('href') || '');
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  });
  return ids;
}

/** The query form the course search matches exactly (`CSC 221` is fuzzy). */
const queryForm = (code) => String(code ?? '').replace(/\s+/g, '').toUpperCase();

/**
 * Compare the four-year mappings of several renderings of the same course code.
 * Returns the agreed set plus any disagreement, so a course whose equivalencies
 * turn out to depend on the sending college is reported rather than averaged.
 */
function crossCheck(parsed) {
  const usable = parsed.filter((p) => p && p.code);
  if (usable.length < 2) return { checked: usable.length, consistent: true, conflicts: [] };
  const keyed = usable.map((p) => {
    const m = new Map();
    for (const e of p.equivalencies) if (e.level === 'four_year') m.set(e.institution, e.identifier);
    return { institution: p.institution, map: m };
  });
  const [base, ...rest] = keyed;
  const conflicts = [];
  for (const other of rest) {
    for (const [inst, id] of other.map) {
      if (!base.map.has(inst)) conflicts.push({ type: 'extra', institution: inst, in: other.institution, identifier: id });
      else if (base.map.get(inst) !== id) {
        conflicts.push({ type: 'differs', institution: inst, base: base.map.get(inst), other: id, in: other.institution });
      }
    }
    for (const [inst, id] of base.map) {
      if (!other.map.has(inst)) conflicts.push({ type: 'missing', institution: inst, in: other.institution, identifier: id });
    }
  }
  return { checked: usable.length, consistent: conflicts.length === 0, conflicts };
}

module.exports = {
  parseCoursePage,
  parseCourseSearch,
  splitHeading,
  cardValue,
  queryForm,
  crossCheck,
};
