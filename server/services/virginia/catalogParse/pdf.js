/**
 * Cut one program out of a whole-catalog PDF.
 *
 * Two Virginia institutions publish no per-program page at all: the catalog is
 * a single 200-page PDF. `pdftotext -layout` turns that into 12,000 lines
 * containing every program the college offers, and handing that to the
 * requirement parser produces a "degree" of 566 courses — every course in the
 * catalog, attributed to Computer Science.
 *
 * So the program has to be located and cut out first. The cut is made on the
 * catalog's own section headings, and it is deliberately conservative: if the
 * end of the section cannot be found, the window is capped rather than run on,
 * because over-reading silently invents requirements while under-reading merely
 * loses some and shows up in the credit reconciliation.
 */

/**
 * How a catalog titles its Computer Science section.
 *
 * Three forms across the corpus: `Computer Science Program` (Virginia
 * Highlands), `Associate of Science (AS) in Computer Science` (the award line),
 * and `Computer Science, major` (Eastern Mennonite). The trailing comma form
 * matters — without it EMU's section is never found and the reader falls back
 * to the entire 200-page catalog.
 */
const CS_HEADING = new RegExp([
  '^(computer\\s+science(\\s+(program|major|department))?',
  '|computer\\s+science\\s*,\\s*major',
  '|associate\\s+of\\s+(science|arts)[^\\n]{0,40}\\bcomputer\\s+science',
  '|bachelor\\s+of\\s+(science|arts)[^\\n]{0,40}\\bcomputer\\s+science)\\s*$',
].join(''), 'i');

/**
 * The start of some *other* program's section — where our window ends.
 *
 * `<Something> Program` on a line of its own is how these catalogs open a
 * section. The award lines are included because a college that lists two
 * degrees under one program heading separates them that way.
 */
const OTHER_PROGRAM = /^(?!computer\s+science)([A-Z][\w&',. -]{2,48})\s+Program\s*$/;
const OTHER_AWARD = /^associate\s+of\s+(applied\s+)?(science|arts)\b(?!.*computer\s+science)/i;
/** `Computer Science, minor` — the next section in a catalog that lists by award. */
const OTHER_SECTION = /^(?!computer\s+science\s*,\s*major)([A-Z][\w&',. -]{2,48})\s*,\s*(major|minor|teaching endorsement|concentration)\b/i;

/** Running heads and folios repeated on every page. */
const PAGE_FURNITURE = [
  /^\d{4}-\d{4}\s+COLLEGE\s+CATALOG\b/i,
  /^SCHOOL\s+OF\s+[A-Z& ]+$/,
  /^\s*\d{1,4}\s*$/,
  /^page\s+\d+\s*(of\s+\d+)?$/i,
];

/** Longest a program section is allowed to be, in lines. */
const MAX_WINDOW = 220;

const clean = (s) => String(s ?? '').replace(/\s+$/, '');

/**
 * Narrow whole-catalog text to the Computer Science program.
 *
 * Returns `{ text, found, start, end, reason }`. When the heading cannot be
 * located the original text comes back with `found: false`, so the caller can
 * report "not found in the PDF" rather than parsing the whole catalog.
 */
function narrowToProgram(rawText, { heading = CS_HEADING, maxWindow = MAX_WINDOW } = {}) {
  const lines = String(rawText || '').split('\n').map(clean);

  // The last match, not the first: a catalog names its programs in the table of
  // contents and the index before it describes them, and both come earlier.
  // The described section is the one with courses under it.
  let start = -1;
  let bestScore = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (!heading.test(lines[i].trim())) continue;
    // Score by how many course codes follow within the next 80 lines; the
    // table-of-contents entry has none.
    const window = lines.slice(i, i + 80).join('\n');
    const score = new Set(window.match(/[A-Z]{2,5}\s?\d{3,4}(?![\dA-Za-z])/g) || []).size;
    if (score > bestScore) { bestScore = score; start = i; }
  }
  if (start < 0 || bestScore < 4) {
    return { text: rawText, found: false, start: null, end: null, reason: 'no Computer Science section with courses found' };
  }

  let end = Math.min(lines.length, start + maxWindow);
  for (let i = start + 6; i < end; i += 1) {
    const line = lines[i].trim();
    if (OTHER_PROGRAM.test(line) || OTHER_AWARD.test(line) || OTHER_SECTION.test(line)) { end = i; break; }
  }

  const body = lines.slice(start, end).filter((l) => !PAGE_FURNITURE.some((re) => re.test(l.trim())));
  return {
    text: body.join('\n'),
    found: true,
    start,
    end,
    lines: body.length,
    reason: end === start + maxWindow ? 'window capped — no following program heading found' : null,
  };
}

module.exports = { narrowToProgram, CS_HEADING };
