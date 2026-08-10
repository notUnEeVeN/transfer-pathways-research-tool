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
const HTML_DOCUMENT = /^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i;

const CONFIGURED_ANCHOR_KEYS = [
  'requirements_start_anchor',
  'requirements_end_anchor',
];

const normalizeEvidenceText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * The exact registry fields that define a configured PDF window.
 *
 * Capture stores a hash of this value beside the page. Changing an anchor or
 * cited page range therefore invalidates the old cache instead of silently
 * reusing evidence collected under a different source contract.
 */
function configuredWindowContract(options = {}) {
  const config = options && typeof options === 'object' ? options : {};
  const configured = CONFIGURED_ANCHOR_KEYS.some((key) => Object.prototype.hasOwnProperty.call(config, key));
  if (!configured) return null;
  return JSON.stringify({
    requirements_start_anchor: normalizeEvidenceText(config.requirements_start_anchor) || null,
    requirements_end_anchor: normalizeEvidenceText(config.requirements_end_anchor) || null,
    program_identity_start_anchor: normalizeEvidenceText(config.program_identity_start_anchor) || null,
    program_identity_anchors: Array.isArray(config.program_identity_anchors)
      ? config.program_identity_anchors.map(normalizeEvidenceText).filter(Boolean)
      : [],
    program_pdf_pages: Array.isArray(config.program_pdf_pages) ? config.program_pdf_pages : null,
    program_printed_pages: Array.isArray(config.program_printed_pages) ? config.program_printed_pages : null,
  });
}

const failedWindow = (reason, extra = {}) => ({
  text: '',
  found: false,
  start: null,
  end: null,
  start_page: null,
  end_page: null,
  lines: 0,
  reason,
  ...extra,
});

/** A two-number inclusive page range, or a source-contract error. */
function pageRange(value, key) {
  if (value == null) return { range: null, error: null };
  if (!Array.isArray(value) || value.length !== 2
    || !value.every((n) => Number.isInteger(n) && n > 0)
    || value[0] > value[1]) {
    return { range: null, error: `${key} must be an ascending two-page inclusive range` };
  }
  return { range: value, error: null };
}

/**
 * Preserve PDF page identity while presenting the rest of the parser with a
 * flat sequence of lines. `pdftotext` separates pages with form-feed bytes.
 */
function pagedLines(raw) {
  return String(raw).split('\f').flatMap((pageText, pageIndex) => pageText.split('\n').map((line) => ({
    text: clean(line),
    normalized: normalizeEvidenceText(line),
    page: pageIndex + 1,
  })));
}

const anchorCandidates = (lines, anchor) => {
  const needle = normalizeEvidenceText(anchor);
  if (!needle) return [];
  const matches = [];
  lines.forEach((line, index) => {
    if (line.normalized.includes(needle)) matches.push({ anchor: needle, index, page: line.page, text: line.text.trim() });
  });
  return matches;
};

const inside = (page, range) => !range || (page >= range[0] && page <= range[1]);

/**
 * Cut a registry-pinned program out of a whole-catalog PDF.
 *
 * This path intentionally has no generic-heading fallback. Camp's current A.S.
 * follows a discontinued Computer Science teachout in the same PDF, so finding
 * "Computer Science" and some courses is not enough to establish degree
 * identity. Both requirement anchors, every configured identity anchor, and
 * the cited PDF/printed-page evidence must agree or the result is empty.
 */
function narrowConfiguredProgram(raw, options, contract) {
  const lines = pagedLines(raw);
  const missing = [];
  const evidence = {
    requirements_start: null,
    requirements_end: null,
    program_identity_start: null,
    program_identity_anchors: [],
    pages: null,
  };

  const startAnchor = normalizeEvidenceText(options.requirements_start_anchor);
  const endAnchor = normalizeEvidenceText(options.requirements_end_anchor);
  if (!startAnchor) missing.push({ kind: 'requirements_start_anchor', anchor: null });
  if (!endAnchor) missing.push({ kind: 'requirements_end_anchor', anchor: null });
  if (missing.length) {
    return failedWindow('configured PDF scope requires both requirements_start_anchor and requirements_end_anchor', {
      mode: 'configured_anchors', contract, evidence, missing_evidence: missing,
    });
  }

  const pdfPages = pageRange(options.program_pdf_pages, 'program_pdf_pages');
  const printedPages = pageRange(options.program_printed_pages, 'program_printed_pages');
  if (pdfPages.error || printedPages.error) {
    const reason = pdfPages.error || printedPages.error;
    return failedWindow(`invalid configured PDF page evidence: ${reason}`, {
      mode: 'configured_anchors', contract, evidence,
      missing_evidence: [{ kind: 'page_configuration', reason }],
    });
  }
  if (printedPages.range && !pdfPages.range) {
    return failedWindow('program_printed_pages requires program_pdf_pages for page identity', {
      mode: 'configured_anchors', contract, evidence,
      missing_evidence: [{ kind: 'program_pdf_pages', reason: 'required by program_printed_pages' }],
    });
  }
  if (printedPages.range
    && (printedPages.range[1] - printedPages.range[0] !== pdfPages.range[1] - pdfPages.range[0])) {
    return failedWindow('configured PDF and printed-page ranges must cover the same number of pages', {
      mode: 'configured_anchors', contract, evidence,
      missing_evidence: [{ kind: 'page_configuration', reason: 'PDF/printed page spans differ' }],
    });
  }

  const starts = anchorCandidates(lines, startAnchor);
  if (!starts.length) {
    missing.push({ kind: 'requirements_start_anchor', anchor: startAnchor });
    return failedWindow(`configured requirements_start_anchor not found: "${startAnchor}"`, {
      mode: 'configured_anchors', contract, evidence, missing_evidence: missing,
    });
  }
  const rangedStarts = starts.filter((match) => inside(match.page, pdfPages.range));
  if (!rangedStarts.length) {
    missing.push({ kind: 'requirements_start_anchor_page', anchor: startAnchor, found_pages: starts.map((m) => m.page) });
    return failedWindow(`configured requirements_start_anchor was outside program_pdf_pages ${pdfPages.range.join('-')}`, {
      mode: 'configured_anchors', contract, evidence, missing_evidence: missing,
    });
  }

  // The page range excludes table-of-contents mentions. Prefer its last match
  // in case a running heading repeats the plan title on the same program pages.
  const start = rangedStarts[rangedStarts.length - 1];
  evidence.requirements_start = start;

  const ends = anchorCandidates(lines, endAnchor).filter((match) => match.index > start.index);
  if (!ends.length) {
    missing.push({ kind: 'requirements_end_anchor', anchor: endAnchor });
    return failedWindow(`configured requirements_end_anchor not found after the start anchor: "${endAnchor}"`, {
      mode: 'configured_anchors', contract, evidence, missing_evidence: missing,
    });
  }
  const rangedEnds = ends.filter((match) => inside(match.page, pdfPages.range));
  if (!rangedEnds.length) {
    missing.push({ kind: 'requirements_end_anchor_page', anchor: endAnchor, found_pages: ends.map((m) => m.page) });
    return failedWindow(`configured requirements_end_anchor was outside program_pdf_pages ${pdfPages.range.join('-')}`, {
      mode: 'configured_anchors', contract, evidence, missing_evidence: missing,
    });
  }
  const end = rangedEnds[0];
  evidence.requirements_end = end;

  const identityStartAnchor = normalizeEvidenceText(options.program_identity_start_anchor);
  let identityStart = null;
  if (identityStartAnchor) {
    const matches = anchorCandidates(lines, identityStartAnchor)
      .filter((match) => match.index <= start.index && inside(match.page, pdfPages.range));
    if (!matches.length) {
      missing.push({ kind: 'program_identity_start_anchor', anchor: identityStartAnchor });
    } else {
      identityStart = matches[matches.length - 1];
      evidence.program_identity_start = identityStart;
    }
  }

  const identityAnchors = Array.isArray(options.program_identity_anchors)
    ? options.program_identity_anchors.map(normalizeEvidenceText).filter(Boolean)
    : [];
  const identityFloor = identityStart ? identityStart.index : 0;
  for (const anchor of identityAnchors) {
    const match = anchorCandidates(lines, anchor).find((candidate) => candidate.index >= identityFloor
      && candidate.index <= start.index && inside(candidate.page, pdfPages.range));
    if (!match) missing.push({ kind: 'program_identity_anchor', anchor });
    else evidence.program_identity_anchors.push(match);
  }
  if (missing.length) {
    const names = missing.map((item) => `"${item.anchor}"`).join(', ');
    return failedWindow(`configured program identity evidence not found before requirements: ${names}`, {
      mode: 'configured_anchors', contract, evidence, missing_evidence: missing,
    });
  }

  const folios = [];
  if (pdfPages.range) {
    for (let pdfPage = pdfPages.range[0]; pdfPage <= pdfPages.range[1]; pdfPage += 1) {
      const expectedPrintedPage = printedPages.range
        ? printedPages.range[0] + (pdfPage - pdfPages.range[0])
        : null;
      const printedPageFound = expectedPrintedPage == null
        ? null
        : lines.some((line) => line.page === pdfPage && line.normalized === String(expectedPrintedPage));
      folios.push({
        pdf_page: pdfPage,
        expected_printed_page: expectedPrintedPage,
        printed_page_found: printedPageFound,
      });
      if (printedPageFound === false) {
        missing.push({
          kind: 'printed_page_folio',
          pdf_page: pdfPage,
          expected_printed_page: expectedPrintedPage,
        });
      }
    }
  }
  evidence.pages = {
    configured_pdf_pages: pdfPages.range,
    configured_printed_pages: printedPages.range,
    requirements_start_pdf_page: start.page,
    requirements_end_pdf_page: end.page,
    printed_folios: folios,
  };
  if (missing.length) {
    return failedWindow('configured printed-page evidence was not found on every cited PDF page', {
      mode: 'configured_anchors', contract, evidence, missing_evidence: missing,
    });
  }

  const body = lines.slice(start.index, end.index)
    .map((line) => line.text)
    .filter((line) => !PAGE_FURNITURE.some((re) => re.test(line.trim())));
  return {
    text: body.join('\n'),
    found: true,
    mode: 'configured_anchors',
    contract,
    start: start.index,
    end: end.index,
    start_page: start.page,
    end_page: end.page,
    lines: body.length,
    evidence,
    missing_evidence: [],
    reason: null,
  };
}

/**
 * Narrow whole-catalog text to the Computer Science program.
 *
 * Returns `{ text, found, start, end, reason }`. Failure always returns an
 * empty `text`: callers may still report why the window was absent, but can no
 * longer accidentally feed the entire catalog (or an HTML error page saved as
 * `.pdf`) into the degree parser.
 */
function narrowToProgram(rawText, options = {}) {
  const config = options && typeof options === 'object' ? options : {};
  const { heading = CS_HEADING, maxWindow = MAX_WINDOW } = config;
  const raw = String(rawText || '');
  if (!raw.trim()) {
    return failedWindow('PDF text is empty');
  }
  if (HTML_DOCUMENT.test(raw.slice(0, 2048))) {
    return failedWindow('response is HTML, not extracted PDF text');
  }

  const contract = configuredWindowContract(config);
  if (contract) return narrowConfiguredProgram(raw, config, contract);

  const lines = raw.split('\n').map(clean);

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
    return failedWindow('no Computer Science section with courses found');
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
    mode: 'generic_heading',
    contract: null,
    start,
    end,
    start_page: null,
    end_page: null,
    lines: body.length,
    evidence: null,
    missing_evidence: [],
    reason: end === start + maxWindow ? 'window capped — no following program heading found' : null,
  };
}

module.exports = { narrowToProgram, configuredWindowContract, CS_HEADING };
