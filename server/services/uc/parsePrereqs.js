/**
 * Pull courses and their REAL published prerequisites out of a UC catalogue page.
 *
 * This replaces prerequisite inference. The previous approach projected a shared
 * concept template ("cs_2_oop requires cs_1") onto every institution, which is a
 * statistical stand-in: it cannot know that UC San Diego's CSE 12 accepts
 * "CSE 8B or CSE 11", nor that CSE 100 wants discrete maths and data structures
 * and a systems course. Catalogues state all of that on the course's own page,
 * so it is read rather than modelled.
 *
 * Prerequisite prose is written as an AND of ORs — conjuncts separated by "and",
 * alternatives within a conjunct by "or" — which is how every UC phrases it:
 *
 *   "CSE 21 or MATH 154 or MATH 158 and CSE 12 and CSE 15L or CSE 29"
 *     -> [[CSE 21, MATH 154, MATH 158], [CSE 12], [CSE 15L, CSE 29]]
 *
 * Clauses that name no course at all ("consent of instructor", "senior
 * standing") yield nothing, which is correct: they are not course gates.
 */

// A course code. The prefix may be more than one word — Irvine has "BIO SCI",
// "I&C SCI" and "SOC SCI", UCLA has "COM SCI" and "ENGR ECE" — and reading only
// the last word turns "BIO SCI 97" into "SCI 97", which resolves to nothing.
// The trailing guard stops "MATH 15A" being read out of "MATH 15AB", and no
// boundary is required before the digits so "CSE100" also matches.
const CODE = /\b((?:[A-Z&]{1,4}\s+)?[A-Z&]{2,6})\s*(\d{1,3}[A-Z]{0,2})(?![\dA-Za-z])/g;

// Words that can precede a code in prose and must never be read as part of the
// prefix: "…two courses from MATH 20A" is MATH 20A, not "FROM MATH" 20A.
const NOT_A_PREFIX = new Set([
  'AND', 'OR', 'THE', 'FROM', 'WITH', 'FOR', 'ALL', 'ONE', 'TWO', 'OF', 'IN',
  'ANY', 'BOTH', 'PLUS', 'TO', 'AT', 'BY', 'PER', 'SEE', 'NOT', 'A', 'AN',
]);

/** Normalise a captured prefix + number into "PREFIX NUMBER". */
function joinCode(prefix, number) {
  const words = String(prefix).trim().split(/\s+/);
  if (words.length > 1 && NOT_A_PREFIX.has(words[0].toUpperCase())) words.shift();
  return `${words.join(' ')} ${number}`;
}

const stripTags = (html) => String(html)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#8217;|&rsquo;/g, "'")
  .replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Split a prerequisite clause into an AND of ORs of course codes.
 * @returns {string[][]} one inner array per conjunct
 */
function parseRequisiteClause(text) {
  if (!text) return [];
  // Prerequisite prose runs until the first sentence that is no longer about
  // prerequisites — "; restricted to undergraduates", "Students may not receive
  // credit for both …". Cutting there keeps unrelated course mentions out.
  const clause = String(text).split(/;|\.\s+(?=[A-Z])/)[0];
  const codesIn = (text) => {
    const found = [];
    let m;
    CODE.lastIndex = 0;
    while ((m = CODE.exec(text)) !== null) found.push(joinCode(m[1], m[2]));
    return found;
  };
  const groups = [];
  for (const conjunct of clause.split(/\s+and\s+/i)) {
    // Commas are ambiguous in catalogue prose. "CSE 5J, or CSE 12" lists
    // alternatives; "CSE 12, CSE 15L and MATH 20A" lists requirements. Read a
    // comma as OR only where the conjunct also says "or", and otherwise treat
    // each comma-separated item as its own requirement.
    if (/\bor\b/i.test(conjunct)) {
      const alternatives = codesIn(conjunct);
      if (alternatives.length) groups.push([...new Set(alternatives)]);
    } else {
      for (const part of conjunct.split(/,/)) {
        const alternatives = codesIn(part);
        if (alternatives.length) groups.push([...new Set(alternatives)]);
      }
    }
  }
  return groups;
}

/** Pull the prerequisite sentence out of a course description. */
function requisiteTextFrom(description) {
  const m = /Prerequisites?\s*:?\s*(.*)$/is.exec(String(description || ''));
  return m ? m[1] : '';
}

/**
 * UC San Diego — catalog.ucsd.edu.
 * `<p class="course-name">CSE 100. Advanced Data Structures (4)</p>` followed by
 * `<p class="course-descriptions">… Prerequisites: …</p>`.
 */
function parseUcsd(html) {
  const out = [];
  const re = /<p class="course-name">(.*?)<\/p>\s*<p class="course-descriptions">(.*?)<\/p>/gs;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = stripTags(m[1]);
    // San Diego appends a curriculum tag after the units on many upper-division
    // courses — "CSE 120. Operating Systems Principles (4) Tag: Systems" — so the
    // units must not be anchored to the end of the line.
    const head = /^([A-Z]{2,5}\s*\d{1,3}[A-Z]{0,2})\.\s*(.*?)\s*\(([^)]*)\)\s*(?:Tag:.*)?$/.exec(name);
    if (!head) continue;
    const description = stripTags(m[2]);
    out.push({
      code: head[1].replace(/\s+/g, ' ').trim(),
      title: head[2],
      units: head[3],
      requires: parseRequisiteClause(requisiteTextFrom(description)),
      requisite_text: requisiteTextFrom(description).split(/;|\.\s+(?=[A-Z])/)[0] || null,
    });
  }
  return out;
}

/**
 * CourseLeaf — UC Davis, UC Irvine. Course blocks carry a title line and one or
 * more description/extra paragraphs.
 */
function parseCourseLeaf(html) {
  const out = [];
  // Modern CourseLeaf tags each field with a `detail-*` class rather than one
  // title paragraph: `detail-code`, `detail-title`, `detail-hours_html`, and —
  // where a campus publishes it — `detail-prerequisite`. Davis and Irvine differ
  // only in punctuation and whether units are parenthesised.
  // Split on the course block only. Irvine nests `<div class="courseblockextra">`
  // inside it, and splitting on the shared prefix tore every course in half —
  // the code landed in one fragment and its prerequisites in the next.
  const blocks = html.split(/<div class="courseblock(?!extra)/).slice(1);
  const field = (block, name) => {
    const m = new RegExp(`<span class="[^"]*detail-${name}[^"]*"[^>]*>([\\s\\S]*?)</span>`).exec(block);
    return m ? stripTags(m[1]) : '';
  };
  for (const block of blocks) {
    const code = field(block, 'code').replace(/\.$/, '').replace(/\s+/g, ' ').trim();
    if (!/^[A-Z&][A-Z&\s]{0,11}\s*\d{1,3}[A-Z]{0,2}$/.test(code)) continue;
    const title = field(block, 'title').replace(/^[\u2014-]\s*/, '').replace(/\.$/, '').trim();
    const units = (/([\d.]+)\s*units?/i.exec(field(block, 'hours_html')) || [])[1] || null;
    // Prefer the dedicated prerequisite field; fall back to prose in the body.
    const explicit =
      /<p class="[^"]*detail-prerequisite[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(block)
      // Irvine nests a <span class="label">Prerequisite:</span> inside the
      // field, so the match must run to the span that closes the FIELD — the one
      // followed by the enclosing </div> — not to the label's own closing tag.
      || /<span class="[^"]*detail-prereqs[^"]*"[^>]*>([\s\S]*?)<\/span>\s*(?:&#160;|&nbsp;|\s)*<\/div>/i.exec(block);
    const requisiteText = explicit
      ? stripTags(explicit[1])
        .replace(/^Prerequisites?(\(s\))?:?\s*/i, '')
        // Irvine files advice in the same field. A recommendation is not a gate.
        .replace(/^Recommended:?\s*.*$/i, '')
      : requisiteTextFrom(stripTags(block));
    out.push({
      code,
      title,
      units,
      requires: parseRequisiteClause(requisiteText),
      requisite_text: requisiteText.split(/;|\.\s+(?=[A-Z])/)[0] || null,
    });
  }
  return out;
}

/** UC Santa Cruz — catalog.ucsc.edu renders course entries as headed sections. */
function parseUcsc(html) {
  // Santa Cruz opens each course with
  //   <h2 class="course-name"><a …><span>CSE 12</span> Title</a></h2>
  // and states requirements further down the same section:
  //   <div class="extraFields"><h4>Requirements</h4><p>Prerequisite(s): …</p>
  const out = [];
  const chunks = html.split(/<h2[^>]*class="[^"]*course-name[^"]*"[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const head = /<span>\s*([A-Z]{2,5}\s?\d{1,3}[A-Z]{0,2})\s*<\/span>\s*([\s\S]{0,160}?)<\/a>/.exec(chunk);
    if (!head) continue;
    const req = /Prerequisites?\(s\)?:?([\s\S]{0,1200}?)(?:<\/p>|<h4|<h2)/i.exec(chunk);
    const requisiteText = req ? stripTags(req[1]) : '';
    out.push({
      code: head[1].replace(/\s+/g, ' ').trim(),
      title: stripTags(head[2]),
      units: (/<div class="credits">\s*([\d.]+)/.exec(chunk) || [])[1] || null,
      requires: parseRequisiteClause(requisiteText),
      requisite_text: requisiteText.split(/;|\.\s+(?=[A-Z])/)[0] || null,
    });
  }
  return out;
}

/**
 * Coursedog — UC Santa Barbara. The page ships a JSON payload whose courses
 * carry `requisitesSimple` / `requisites` / `prerequisites`; the freeform text
 * is the reliable common denominator across campuses.
 */
function parseCoursedog(html) {
  const out = [];
  const seen = new Set();
  // Course objects appear inside a large embedded payload; pull them by shape
  // rather than by parsing the whole document.
  const re = /"code"\s*:\s*"([A-Z]{2,5}\s*\d{1,3}[A-Z]{0,2})"[\s\S]{0,4000}?"name"\s*:\s*"([^"]{2,120})"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const code = m[1].replace(/\s+/g, ' ').trim();
    if (seen.has(code)) continue;
    seen.add(code);
    const window = html.slice(m.index, m.index + 6000);
    const freeform = /"requisitesFreeform"\s*:\s*"([^"]*)"/.exec(window)
      || /"prerequisites"\s*:\s*"([^"]*)"/.exec(window);
    const text = freeform ? freeform[1].replace(/\\n/g, ' ') : '';
    out.push({
      code,
      title: m[2],
      units: null,
      requires: parseRequisiteClause(text),
      requisite_text: text ? text.split(/;|\.\s+(?=[A-Z])/)[0] : null,
    });
  }
  return out;
}

const PARSERS = {
  ucsd: parseUcsd,
  courseleaf: parseCourseLeaf,
  ucsc: parseUcsc,
  coursedog: parseCoursedog,
  // Browser-captured pages are saved as rendered HTML, so they reuse whichever
  // static shape the campus renders into.
  'berkeley-guide': parseCourseLeaf,
  ucla: parseCourseLeaf,
  ucr: parseCourseLeaf,
  acalog: parseCourseLeaf,
};

function parseCatalogPage(format, html) {
  const parser = PARSERS[format];
  if (!parser) throw new Error(`no parser for catalogue format "${format}"`);
  return parser(html);
}

module.exports = {
  parseCatalogPage, parseRequisiteClause, requisiteTextFrom, stripTags, joinCode, CODE,
};
