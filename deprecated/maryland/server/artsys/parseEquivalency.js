/**
 * ARTSYS detail-modal HTML -> course units, catalog text, and prerequisite prose.
 *
 * The guide page carries reliable RECEIVING units but almost no sending units,
 * because the sending side is rendered as a bare course label. Both are
 * available one level down, on two modals the guide links to:
 *
 *   /equivalencies/<id>?modal=true          one articulation, both sides
 *   /equivalencies/courses/<id>?modal=true  one course
 *
 * Two different quantities live on the equivalency modal and they are NOT the
 * same thing:
 *   - "Credits: 4.0" under the sending course — the course's own credit value
 *   - "Minimum/Maximum credits: 3.0" in the summary — the credit AWARDED on
 *     transfer, a property of the articulation
 * A college course worth 4 credits routinely transfers as 3. Storing the
 * awarded figure as the course's units would understate what a student takes
 * and overstate what they receive, so the two are kept apart: course units land
 * on the course document, awarded credits on the articulation option.
 *
 * Prerequisites are prose inside the catalog description ("PREREQUISITE: A
 * grade of C or better in CMSC 140"). They are extracted verbatim and the
 * course codes mentioned are listed, but nothing here resolves them to course
 * ids or decides what the rule means — that is curation, and inventing it
 * automatically would put unreviewed data in the same shape as hand-verified
 * work. Rows land as `needs_review` for exactly that reason.
 */
const cheerio = require('cheerio');

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const num = (s) => {
  const m = /(\d+(?:\.\d+)?)/.exec(String(s ?? ''));
  return m ? Number(m[1]) : null;
};

/** Course codes as they appear in catalog prose: `CMSC 140`, `MATH181`. */
const COURSE_CODE_RE = /\b([A-Z]{2,5})\s?-?\s?(\d{3}[A-Z]?)\b/g;

/**
 * Pull prerequisite / corequisite prose out of a catalog description.
 * Returns nulls rather than guessing when the description states no rule.
 */
function extractRequisites(description) {
  const text = clean(description);
  if (!text) return { prerequisite_text: null, corequisite_text: null, mentioned_codes: [] };

  // "PRE- or COREQUISITE:" names both at once; capture to the next sentence-ish
  // boundary rather than to the end, so a long description does not swallow
  // unrelated prose into the rule.
  const grab = (re) => {
    const m = re.exec(text);
    if (!m) return null;
    const tail = text.slice(m.index + m[0].length);
    const stop = tail.search(/(?:\.\s+[A-Z])|(?:\bPRE-?\s*(?:OR\s*CO)?REQUISITE)|(?:\bCOREQUISITE)/i);
    return clean(stop > 0 ? tail.slice(0, stop + 1) : tail) || null;
  };

  const prerequisite = grab(/\bPRE-?\s*REQUISITE[S]?\s*:?\s*/i)
    || grab(/\bPRE-?\s*OR\s*CO-?REQUISITE[S]?\s*:?\s*/i);
  const corequisite = grab(/\bCO-?REQUISITE[S]?\s*:?\s*/i);

  const scope = [prerequisite, corequisite].filter(Boolean).join(' ');
  const codes = [];
  let m;
  COURSE_CODE_RE.lastIndex = 0;
  while ((m = COURSE_CODE_RE.exec(scope)) !== null) {
    const code = `${m[1]}${m[2]}`;
    if (!codes.includes(code)) codes.push(code);
  }

  return {
    prerequisite_text: prerequisite,
    corequisite_text: corequisite,
    mentioned_codes: codes,
  };
}

/**
 * Parse `/equivalencies/<id>?modal=true`.
 *
 * @returns {{
 *   from:string|null, to:string|null, effective:string|null,
 *   counts_as:string|null, awarded_min_units:number|null, awarded_max_units:number|null,
 *   min_grade:string|null, restricted_to_major:string|null,
 *   sending:object[], receiving:object[],
 * }}
 */
function parseEquivalencyModal(html) {
  const $ = cheerio.load(html);
  const summary = {};
  $('ul.summary li').each((_, el) => {
    const $li = $(el);
    const labels = $li.find('span.uppercase').map((__, s) => clean($(s).text())).get();
    const values = $li.find('span').filter((__, s) => !($(s).attr('class') || '').includes('uppercase'))
      .map((__, s) => clean($(s).text())).get();
    labels.forEach((label, i) => { summary[label.replace(/:$/, '')] = values[i] ?? null; });
  });

  const heading = clean($('h2').first().text());
  const fromTo = /From\s+(.*?)\s+To\s+(.*)$/i.exec(heading);

  // Each side renders its courses as <h2>code - title</h2> + Credits + <p>desc.
  const side = (index) => {
    const column = $('div.flex.flex-wrap > div').eq(index);
    const out = [];
    column.find('h2').each((_, el) => {
      const $h = $(el);
      const label = clean($h.text());
      if (!label) return;
      const block = $h.parent();
      const credits = num(clean(block.find('li').first().text()));
      const description = clean(block.find('p').first().text());
      const dash = /^(.+?)\s+-\s+(.*)$/.exec(label);
      out.push({
        code: dash ? clean(dash[1]) : label,
        title: dash ? clean(dash[2]) : null,
        units: credits,
        description: description || null,
        ...extractRequisites(description),
      });
    });
    return out;
  };

  return {
    from: fromTo ? clean(fromTo[1]) : null,
    to: fromTo ? clean(fromTo[2]) : null,
    effective: summary['Effective during'] ?? null,
    counts_as: summary['Counts as'] ?? null,
    awarded_min_units: num(summary['Minimum credits']),
    awarded_max_units: num(summary['Maximum credits']),
    min_grade: summary['Minimum Grade required'] || null,
    restricted_to_major: summary['Restricted to Major'] || null,
    sending: side(0),
    receiving: side(1),
  };
}

/**
 * Parse `/equivalencies/courses/<id>?modal=true`. The header block is
 * `<h4>institution</h4><h2>code - title</h2>`; the receiving side of an
 * equivalency modal carries no credits row, which is why sending units come
 * from here or from the sending column rather than from the receiving one.
 */
function parseCourseModal(html) {
  const $ = cheerio.load(html);
  const institution = clean($('h4').first().text());
  const label = clean($('h2').first().text());
  const body = clean($('body').text());
  const creditsMatch = /Credits:\s*(\d+(?:\.\d+)?)/i.exec(body);
  const descMatch = /Course Description\s*(.*?)\s*Credits:/is.exec(body);
  const description = descMatch ? clean(descMatch[1]) : null;
  const dash = /^(.+?)\s+-\s+(.*)$/.exec(label);
  return {
    institution: institution || null,
    code: dash ? clean(dash[1]) : label || null,
    title: dash ? clean(dash[2]) : null,
    units: creditsMatch ? Number(creditsMatch[1]) : null,
    description,
    ...extractRequisites(description),
  };
}

module.exports = { parseEquivalencyModal, parseCourseModal, extractRequisites };
