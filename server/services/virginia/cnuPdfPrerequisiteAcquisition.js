const crypto = require('node:crypto');
const cheerio = require('cheerio');

const CNU_SLUG = 'christopher-newport-university';
const CNU_PDF_CACHE_PATH = 'pages/christopher-newport-university__course_catalog.pdf';
const CNU_EXPECTED_PDF_SHA256 = '30e4ab16d575d4ab5a966012f37cf6a6b536ffb775d267fccba4f82fcd23d327';
const CNU_EXPECTED_PDF_TITLE = 'Christopher Newport University: Undergraduate Catalog 2025-26';
const CNU_EXPECTED_PAGE_COUNT = 315;
const CNU_BOUNDARY_CONTRACT = 'cnu_pdf_bbox_unique_exact_leading_code_with_published_units_v1';
const CNU_COMPOUND_BOUNDARY_CONTRACT =
  'cnu_pdf_bbox_pinned_compound_heading_course_specific_requisite_v1';
const CNU_COMPOUND_RECEIPT_CONTRACT =
  'cnu_pinned_compound_entry_full_boundary_and_member_clause_receipt_v1';
const CNU_PINNED_COMPOUND_RECEIPTS = Object.freeze([
  Object.freeze({
    heading_text: 'PHYS 151-152. College Physics (3-3-0)',
    compound_course_codes: Object.freeze(['PHYS151', 'PHYS152']),
    raw_entry_sha256: '55e67117fbf3806f58297ca3348114198f431595ca8da3ed70df61d0a5985c7f',
    pdf_page_start: 278,
    pdf_page_end: 279,
    page_column_span: Object.freeze(['278:right', '279:left']),
    member_clauses: Object.freeze({
      PHYS151: Object.freeze({
        label: 'Prerequisites for PHYS 151',
        raw_normalized: 'High school algebra and trigonometry or consent of instructor',
        concurrent_allowed: false,
      }),
      PHYS152: Object.freeze({
        label: 'Prerequisite for PHYS 152',
        raw_normalized: 'PHYS 151',
        concurrent_allowed: false,
      }),
    }),
  }),
  Object.freeze({
    heading_text: 'PHYS 151L-152L. College Physics Laboratory (1-0-3)',
    compound_course_codes: Object.freeze(['PHYS151L', 'PHYS152L']),
    raw_entry_sha256: 'ed83312dc0385e8352454b155caf259b60b3a6e8ebe4ef69e75b0f99870bd412',
    pdf_page_start: 279,
    pdf_page_end: 279,
    page_column_span: Object.freeze(['279:left']),
    member_clauses: Object.freeze({
      PHYS151L: Object.freeze({
        label: 'Pre or Corequisite for PHYS 151L',
        raw_normalized: 'PHYS 151',
        concurrent_allowed: true,
      }),
      PHYS152L: Object.freeze({
        label: 'Pre or Corequisite for PHYS 152L',
        raw_normalized: 'PHYS 152',
        concurrent_allowed: true,
      }),
    }),
  }),
]);
const CNU_PINNED_CODE_DISCREPANCY = Object.freeze({
  target_course_code: 'CPEN371W',
  catalog_entry_course_code: 'CPEN371',
  catalog_entry_heading_text: 'CPEN 371. WI: Computer Ethics (2-2-0)',
  catalog_entry_raw_sha256: 'a837742a9c6abfe3420cbb80399771eca94058f15cfc9644a70a1822bc8255ee',
  catalog_entry_pdf_page: 272,
  exact_target_reference_count: 4,
  exact_target_reference_pages: Object.freeze([270, 271, 272, 277]),
});
const CNU_COLUMN_GEOMETRY = Object.freeze({
  coordinate_space: 'PDF points from pdftotext -bbox-layout',
  page_width: 602.503,
  page_height: 787.5,
  content_y_min_inclusive: 50,
  content_y_max_inclusive: 750,
  gutter: { x_min_exclusive: 300, x_max_exclusive: 302 },
  left: { x_min_inclusive: 25, x_max_inclusive: 300 },
  right: { x_min_inclusive: 302, x_max_inclusive: 577 },
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function catalogYearSeen(text, expectedYear) {
  const match = /^(20\d{2})-(20)?(\d{2})$/.exec(String(expectedYear || ''));
  if (!match) return false;
  const fullEnd = match[3].length === 2 ? `${match[1].slice(0, 2)}${match[3]}` : match[3];
  return String(text || '').includes(`${match[1]}-${fullEnd}`)
    || String(text || '').includes(`${match[1]}-${fullEnd.slice(-2)}`);
}

function parsePdfInfo(text) {
  const result = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (key) result[key] = line.slice(separator + 1).trim();
  }
  return result;
}

function numberAttribute($, element, name) {
  const value = Number($(element).attr(name));
  return Number.isFinite(value) ? value : null;
}

function rounded(value) {
  return Number(Number(value).toFixed(6));
}

function blockLines($, block) {
  return $(block).find('line').map((lineIndex, line) => (
    $(line).find('word').map((wordIndex, word) => $(word).text()).get().join(' ').trim()
  )).get().filter(Boolean);
}

function publishedUnits(value) {
  let match = /^\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)$/i.exec(value);
  if (match) {
    return {
      kind: 'credit_lecture_lab_tuple',
      notation: match[0],
      credit_hours_min: Number(match[1]),
      credit_hours_max: Number(match[1]),
      lecture_hours: Number(match[2]),
      laboratory_hours: Number(match[3]),
    };
  }
  match = /^\(Credits? vary (\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\)$/i.exec(value);
  if (match) {
    return {
      kind: 'published_variable_credit_range',
      notation: match[0],
      credit_hours_min: Number(match[1]),
      credit_hours_max: Number(match[2] || match[1]),
      lecture_hours: null,
      laboratory_hours: null,
    };
  }
  return null;
}

/**
 * CNU prints each course heading at the beginning of a PDF layout block. The
 * title may wrap, but the unit notation appears within the first four lines.
 * Nothing later in a description is allowed to manufacture a heading.
 */
function parsePublishedHeading(lines) {
  const first = String(lines?.[0] || '');
  const leading = /^([A-Z]{2,8})\s+(\d{2,4}[A-Z]?(?:\s*-\s*\d{2,4}[A-Z]?)?)\.\s+/.exec(first);
  if (!leading) return null;
  const unitSource = '\\((?:\\d+(?:\\.\\d+)?-\\d+(?:\\.\\d+)?-\\d+(?:\\.\\d+)?|Credits? vary \\d+(?:\\.\\d+)?(?:-\\d+(?:\\.\\d+)?)?)\\)';
  let headingLines = [];
  let joined = '';
  let unitMatches = [];
  let headingLineCount = 0;
  for (let index = 0; index < Math.min(4, lines.length); index += 1) {
    headingLines.push(lines[index]);
    joined = headingLines.join(' ');
    unitMatches = [...joined.matchAll(new RegExp(unitSource, 'ig'))];
    if (unitMatches.length) {
      headingLineCount = index + 1;
      break;
    }
  }
  if (!unitMatches.length) return null;
  const firstUnit = unitMatches[0];
  const lastUnit = unitMatches.at(-1);
  for (let index = 0; index < unitMatches.length - 1; index += 1) {
    const between = joined.slice(
      unitMatches[index].index + unitMatches[index][0].length,
      unitMatches[index + 1].index,
    );
    if (!/^\s+or\s+$/i.test(between)) return null;
  }
  const afterUnits = joined.slice(lastUnit.index + lastUnit[0].length).trim();
  if (afterUnits && !/^(?:[A-Z]{2,8}\s*)+$/.test(afterUnits)) return null;
  const joinedBeforeUnits = joined.slice(0, firstUnit.index).trim();
  if (/\b(?:pre|co)-?\s*requisite/i.test(joinedBeforeUnits)) return null;
  const titleStart = leading[0].length;
  const title = joinedBeforeUnits.slice(titleStart).trim();
  if (/\b[A-Z]{2,8}\s+-?\s*\d{2,4}[A-Z]?\b/.test(title)) return null;
  const unitOptions = unitMatches.map((match) => publishedUnits(match[0]));
  if (unitOptions.some((units) => !units || units.credit_hours_min < 0
      || units.credit_hours_max < units.credit_hours_min)) return null;
  const units = unitOptions.length === 1 ? unitOptions[0] : {
    kind: 'published_unit_options',
    notation: unitMatches.map((match) => match[0]).join(' or '),
    credit_hours_min: Math.min(...unitOptions.map((row) => row.credit_hours_min)),
    credit_hours_max: Math.max(...unitOptions.map((row) => row.credit_hours_max)),
    lecture_hours: null,
    laboratory_hours: null,
    options: unitOptions,
  };
  const sequence = leading[2].replace(/\s+/g, '');
  const singular = !sequence.includes('-');
  const courseCode = singular ? normalizeCode(`${leading[1]}${sequence}`) : null;
  const compoundCodes = singular ? [] : sequence.split('-')
    .map((number) => normalizeCode(`${leading[1]}${number}`)).filter(Boolean);
  const headingText = joined.slice(0, lastUnit.index + lastUnit[0].length).trim();
  return {
    course_code: courseCode,
    compound_course_codes: compoundCodes,
    heading_text: headingText,
    heading_line_count: headingLineCount,
    title,
    published_units: units,
  };
}

/**
 * A course-shaped leading line is always an entry boundary, even when its
 * title or unit notation is outside the accepted candidate grammar. This is
 * deliberately broader than parsePublishedHeading: an unsupported next
 * heading must stop the preceding entry instead of bleeding into it.
 */
function possibleCourseHeading(lines) {
  return /^([A-Z]{2,8})\s+(\d{2,4}[A-Z]?(?:\s*-\s*\d{2,4}[A-Z]?)?)\.\s+\S/.test(
    String(lines?.[0] || ''),
  );
}

function columnForBounds(xMin, xMax) {
  const { left, right } = CNU_COLUMN_GEOMETRY;
  if (xMin >= left.x_min_inclusive && xMax <= left.x_max_inclusive) return 'left';
  if (xMin >= right.x_min_inclusive && xMax <= right.x_max_inclusive) return 'right';
  return null;
}

function insideContentBounds(yMin, yMax) {
  return yMin >= CNU_COLUMN_GEOMETRY.content_y_min_inclusive
    && yMax <= CNU_COLUMN_GEOMETRY.content_y_max_inclusive;
}

function sourceBlock(row) {
  return {
    pdf_page: row.pdf_page,
    page_block_index: row.page_block_index,
    column: row.column,
    bbox_points: {
      x_min: rounded(row.x_min),
      y_min: rounded(row.y_min),
      x_max: rounded(row.x_max),
      y_max: rounded(row.y_max),
    },
    raw_text_sha256: sha256(row.raw_text),
  };
}

function normalizedWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Extract only course-qualified requisite labels from a shared compound
 * entry. Every member must own exactly one labelled statement. The complete
 * sibling statements remain in raw_entry_text; this receipt identifies which
 * exact source slice applies to each emitted member without splitting or
 * rewriting the shared entry.
 */
function extractCnuCompoundMemberRequisites(rawEntryText, compoundCourseCodes) {
  const text = String(rawEntryText || '');
  const codes = [...new Set(asArray(compoundCourseCodes).map(normalizeCode).filter(Boolean))];
  const marker = /^(Prerequisites?|Pre\s+or\s+Corequisites?)\s+for\s+([A-Z]{2,8}\s+\d{2,4}[A-Z]?):[ \t]*/gim;
  const matches = [...text.matchAll(marker)];
  const receipts = [];
  for (const match of matches) {
    const courseCode = normalizeCode(match[2]);
    if (!codes.includes(courseCode)) continue;
    const start = match.index + match[0].length;
    const period = text.indexOf('.', start);
    if (period < 0) return { verified: false, issues: ['member_statement_period'], receipts: [] };
    const bounded = text.slice(start, period);
    const raw = bounded.trim();
    if (!raw) return { verified: false, issues: ['member_clause_empty'], receipts: [] };
    const relativeStart = start + bounded.indexOf(raw);
    const statementRaw = text.slice(match.index, period + 1);
    receipts.push({
      course_code: courseCode,
      kind: 'prerequisite',
      label: `${match[1].replace(/\s+/g, ' ')} for ${normalizedWhitespace(match[2])}`,
      concurrent_allowed: /^Pre\s+or\s+Corequisite/i.test(match[1]),
      raw,
      raw_normalized: normalizedWhitespace(raw),
      raw_sha256: sha256(raw),
      relative_start: relativeStart,
      relative_end: relativeStart + raw.length,
      statement_relative_start: match.index,
      statement_relative_end: period + 1,
      statement_raw: statementRaw,
      statement_sha256: sha256(statementRaw),
    });
  }
  const byCode = new Map();
  for (const receipt of receipts) {
    const rows = byCode.get(receipt.course_code) || [];
    rows.push(receipt);
    byCode.set(receipt.course_code, rows);
  }
  const issues = [];
  for (const code of codes) {
    if ((byCode.get(code) || []).length !== 1) issues.push(`${code}:member_statement_count`);
  }
  if (receipts.length !== codes.length) issues.push('member_statement_partition');
  return { verified: issues.length === 0, issues, receipts };
}

function pinnedCompoundReceipt(heading, sourceRows) {
  const expected = CNU_PINNED_COMPOUND_RECEIPTS.find((row) => (
    row.heading_text === heading.heading_text
  ));
  if (!expected) return { verified: false, issues: ['unsupported_compound_heading'] };
  const rawEntryText = sourceRows.map((row) => row.raw_text).join('\n\n');
  const pageColumnSpan = [...new Set(sourceRows.map((row) => `${row.pdf_page}:${row.column}`))];
  const memberResult = extractCnuCompoundMemberRequisites(
    rawEntryText, heading.compound_course_codes,
  );
  const issues = [];
  if (JSON.stringify(heading.compound_course_codes)
      !== JSON.stringify(expected.compound_course_codes)) issues.push('compound_course_codes');
  if (sha256(rawEntryText) !== expected.raw_entry_sha256) issues.push('raw_entry_sha256');
  if (sourceRows[0]?.pdf_page !== expected.pdf_page_start
      || sourceRows.at(-1)?.pdf_page !== expected.pdf_page_end) issues.push('page_span');
  if (JSON.stringify(pageColumnSpan) !== JSON.stringify(expected.page_column_span)) {
    issues.push('page_column_span');
  }
  if (!memberResult.verified) issues.push(...memberResult.issues);
  for (const [code, expectedClause] of Object.entries(expected.member_clauses)) {
    const actual = memberResult.receipts.find((row) => row.course_code === code);
    if (!actual || actual.label !== expectedClause.label
        || actual.raw_normalized !== expectedClause.raw_normalized
        || actual.concurrent_allowed !== expectedClause.concurrent_allowed) {
      issues.push(`${code}:member_clause`);
    }
  }
  if (issues.length) return { verified: false, issues };
  const receipt = {
    receipt_contract: CNU_COMPOUND_RECEIPT_CONTRACT,
    heading_text: heading.heading_text,
    compound_course_codes: [...heading.compound_course_codes],
    raw_entry_sha256: expected.raw_entry_sha256,
    pdf_page_start: expected.pdf_page_start,
    pdf_page_end: expected.pdf_page_end,
    page_column_span: [...expected.page_column_span],
    member_requisites: memberResult.receipts,
  };
  return {
    verified: true,
    issues: [],
    raw_entry_text: rawEntryText,
    page_column_span: pageColumnSpan,
    receipt,
    receipt_sha256: sha256(JSON.stringify(receipt)),
  };
}

function extractionFailure(targets, issues, extra = {}) {
  return {
    verified: false,
    issues,
    entries: [],
    ambiguous: [],
    missing: [...targets].sort(),
    compound_heading_rejections: [],
    compound_entry_receipts: [],
    identity_discrepancy_receipts: [],
    geometry_rejections: [],
    ...extra,
  };
}

/**
 * Convert Poppler's bbox-layout XHTML to source-exact CNU course entries.
 *
 * Reading order is page, left column, right column. Only blocks wholly inside
 * one non-overlapping column box participate. A recognized heading begins its
 * own block, has one leading course code (compound headings remain boundaries
 * but cannot satisfy a target), and publishes positive units in its first
 * three lines. Entries end at the next independently recognized heading.
 */
function extractCnuPdfEntries({
  pdfBytes,
  bboxHtml,
  pdfInfoText,
  targetCodes,
  catalogYear,
  expectedPdfSha256 = CNU_EXPECTED_PDF_SHA256,
  expectedTitle = CNU_EXPECTED_PDF_TITLE,
  expectedPageCount = CNU_EXPECTED_PAGE_COUNT,
}) {
  const targets = new Set(asArray(targetCodes).map(normalizeCode).filter(Boolean));
  const issues = [];
  const pdfSha = sha256(pdfBytes || Buffer.alloc(0));
  const bboxSha = sha256(String(bboxHtml || ''));
  const info = parsePdfInfo(pdfInfoText);
  if (pdfSha !== expectedPdfSha256) issues.push('pdf_sha256_mismatch');
  if (info.title !== expectedTitle) issues.push('pdfinfo_title_mismatch');
  if (!catalogYearSeen(info.title, catalogYear)) issues.push('pdfinfo_catalog_year_mismatch');
  if (Number(info.pages) !== expectedPageCount) issues.push('pdfinfo_page_count_mismatch');

  const $ = cheerio.load(String(bboxHtml || ''), { xmlMode: true });
  const pages = $('page').get();
  if ($('title').first().text() !== expectedTitle) issues.push('bbox_title_mismatch');
  if (!catalogYearSeen($('title').first().text(), catalogYear)) issues.push('bbox_catalog_year_mismatch');
  if (pages.length !== expectedPageCount) issues.push('bbox_page_count_mismatch');
  for (const [index, page] of pages.entries()) {
    const width = numberAttribute($, page, 'width');
    const height = numberAttribute($, page, 'height');
    if (width === null || Math.abs(width - CNU_COLUMN_GEOMETRY.page_width) > 0.01
        || height === null || Math.abs(height - CNU_COLUMN_GEOMETRY.page_height) > 0.01) {
      issues.push(`bbox_page_geometry:${index + 1}`);
      break;
    }
  }
  if (issues.length) {
    return extractionFailure(targets, issues, {
      pdf_sha256: pdfSha,
      bbox_layout_sha256: bboxSha,
      pdf_info: info,
      page_count: pages.length,
    });
  }

  const blocks = [];
  for (const [pageIndex, page] of pages.entries()) {
    $(page).find('block').each((pageBlockIndex, block) => {
      const lines = blockLines($, block);
      if (!lines.length) return;
      const xMin = numberAttribute($, block, 'xMin');
      const xMax = numberAttribute($, block, 'xMax');
      const yMin = numberAttribute($, block, 'yMin');
      const yMax = numberAttribute($, block, 'yMax');
      const column = [xMin, xMax, yMin, yMax].every(Number.isFinite)
        ? columnForBounds(xMin, xMax) : null;
      const rawText = lines.join('\n').trim();
      blocks.push({
        pdf_page: pageIndex + 1,
        page_block_index: pageBlockIndex,
        x_min: xMin,
        x_max: xMax,
        y_min: yMin,
        y_max: yMax,
        column,
        lines,
        raw_text: rawText,
        possible_heading: possibleCourseHeading(lines),
        heading: parsePublishedHeading(lines),
      });
    });
  }

  const geometryRejections = blocks.filter((row) => (!row.column
    || !insideContentBounds(row.y_min, row.y_max)) && row.heading?.course_code
    && targets.has(row.heading.course_code)).map((row) => ({
    course_code: row.heading.course_code,
    pdf_page: row.pdf_page,
    page_block_index: row.page_block_index,
    bbox_points: {
      x_min: rounded(row.x_min), y_min: rounded(row.y_min),
      x_max: rounded(row.x_max), y_max: rounded(row.y_max),
    },
    reason: 'heading_block_not_wholly_inside_one_nonoverlapping_content_column',
  }));

  const columnOrder = { left: 0, right: 1 };
  const ordered = blocks.filter((row) => row.column && insideContentBounds(row.y_min, row.y_max))
    .sort((left, right) => (
    left.pdf_page - right.pdf_page
      || columnOrder[left.column] - columnOrder[right.column]
      || left.y_min - right.y_min
      || left.x_min - right.x_min
      || left.page_block_index - right.page_block_index
    ));
  const boundaries = ordered.map((row, index) => row.possible_heading ? { row, index } : null)
    .filter(Boolean);
  const headings = boundaries.filter(({ row }) => row.heading);
  const byCode = new Map();
  const compounds = [];
  const compoundEntryReceipts = [];
  for (const [boundaryIndex, current] of boundaries.entries()) {
    const next = boundaries[boundaryIndex + 1]?.index ?? ordered.length;
    if (!current.row.heading) continue;
    if (!current.row.heading.course_code) {
      const matchedTargets = current.row.heading.compound_course_codes.filter((code) => targets.has(code));
      if (matchedTargets.length) {
        const sourceRows = ordered.slice(current.index, next);
        const result = pinnedCompoundReceipt(current.row.heading, sourceRows);
        if (!result.verified) {
          compounds.push({
            target_course_codes: matchedTargets,
            heading_text: current.row.heading.heading_text,
            pdf_page: current.row.pdf_page,
            column: current.row.column,
            reason: 'compound_heading_did_not_match_pinned_member_receipt',
            receipt_issues: result.issues,
          });
          continue;
        }
        compoundEntryReceipts.push({
          ...result.receipt,
          receipt_sha256: result.receipt_sha256,
          integrated_target_course_codes: matchedTargets,
        });
        for (const code of matchedTargets) {
          const member = result.receipt.member_requisites.find((row) => row.course_code === code);
          const siblings = result.receipt.member_requisites.filter((row) => row.course_code !== code);
          const entry = {
            course_code: code,
            title: current.row.heading.title,
            heading_text: current.row.heading.heading_text,
            heading_line_count: current.row.heading.heading_line_count,
            published_units: current.row.heading.published_units,
            raw_entry_text: result.raw_entry_text,
            raw_entry_sha256: result.receipt.raw_entry_sha256,
            pdf_page_start: result.receipt.pdf_page_start,
            pdf_page_end: result.receipt.pdf_page_end,
            source_blocks: sourceRows.map(sourceBlock),
            page_column_span: result.page_column_span,
            compound_entry: true,
            compound_receipt_contract: CNU_COMPOUND_RECEIPT_CONTRACT,
            compound_receipt_sha256: result.receipt_sha256,
            compound_heading_course_codes: [...current.row.heading.compound_course_codes],
            compound_member_requisite: member,
            compound_sibling_requisites: siblings,
          };
          const rows = byCode.get(code) || [];
          rows.push(entry);
          byCode.set(code, rows);
        }
      }
      continue;
    }
    const sourceRows = ordered.slice(current.index, next);
    const rawEntryText = sourceRows.map((row) => row.raw_text).join('\n\n');
    const entry = {
      course_code: current.row.heading.course_code,
      title: current.row.heading.title,
      heading_text: current.row.heading.heading_text,
      heading_line_count: current.row.heading.heading_line_count,
      published_units: current.row.heading.published_units,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      pdf_page_start: sourceRows[0].pdf_page,
      pdf_page_end: sourceRows.at(-1).pdf_page,
      source_blocks: sourceRows.map(sourceBlock),
      page_column_span: [...new Set(sourceRows.map((row) => `${row.pdf_page}:${row.column}`))],
    };
    const rows = byCode.get(entry.course_code) || [];
    rows.push(entry);
    byCode.set(entry.course_code, rows);
  }

  const geometryCodes = new Set(geometryRejections.map((row) => row.course_code));
  const entries = [];
  const ambiguous = [];
  const missing = [];
  for (const code of [...targets].sort()) {
    const rows = byCode.get(code) || [];
    const rejected = geometryCodes.has(code) ? 1 : 0;
    if (rows.length === 1 && rejected === 0) entries.push(rows[0]);
    else if (rows.length + rejected > 1 || rejected) ambiguous.push({
      course_code: code,
      matching_bounded_headings: rows.length,
      geometry_rejected_headings: rejected,
    });
    else missing.push(code);
  }
  const identityDiscrepancyReceipts = [];
  if (targets.has(CNU_PINNED_CODE_DISCREPANCY.target_course_code)) {
    const sourceRows = byCode.get(CNU_PINNED_CODE_DISCREPANCY.catalog_entry_course_code) || [];
    const targetReferences = [];
    for (const row of blocks) {
      for (const match of row.raw_text.matchAll(/\bCPEN\s+371W\b/g)) {
        targetReferences.push({
          pdf_page: row.pdf_page,
          page_block_index: row.page_block_index,
          raw_text_sha256: sha256(row.raw_text),
          character_index: match.index,
        });
      }
    }
    const source = sourceRows.length === 1 ? sourceRows[0] : null;
    const pages = [...new Set(targetReferences.map((row) => row.pdf_page))];
    const exact = source
      && source.heading_text === CNU_PINNED_CODE_DISCREPANCY.catalog_entry_heading_text
      && source.raw_entry_sha256 === CNU_PINNED_CODE_DISCREPANCY.catalog_entry_raw_sha256
      && source.pdf_page_start === CNU_PINNED_CODE_DISCREPANCY.catalog_entry_pdf_page
      && source.pdf_page_end === CNU_PINNED_CODE_DISCREPANCY.catalog_entry_pdf_page
      && targetReferences.length === CNU_PINNED_CODE_DISCREPANCY.exact_target_reference_count
      && JSON.stringify(pages)
        === JSON.stringify(CNU_PINNED_CODE_DISCREPANCY.exact_target_reference_pages);
    if (exact) identityDiscrepancyReceipts.push({
      receipt_contract: 'cnu_pinned_internal_course_code_discrepancy_v1',
      target_course_code: CNU_PINNED_CODE_DISCREPANCY.target_course_code,
      target_exact_reference_count: targetReferences.length,
      target_exact_reference_pages: pages,
      target_reference_receipts: targetReferences,
      catalog_entry_course_code: source.course_code,
      catalog_entry_heading_text: source.heading_text,
      catalog_entry_raw_sha256: source.raw_entry_sha256,
      catalog_entry_pdf_page_start: source.pdf_page_start,
      catalog_entry_pdf_page_end: source.pdf_page_end,
      resolution_status: 'blocked_no_explicit_source_equivalence_statement',
      reason: 'The pinned catalog prints CPEN 371W in four requirement/requisite references but the sole full course entry is headed CPEN 371. The PDF does not explicitly state that the two codes are aliases.',
    });
  }
  return {
    verified: true,
    issues: [],
    pdf_sha256: pdfSha,
    bbox_layout_sha256: bboxSha,
    pdf_info: info,
    page_count: pages.length,
    geometry_contract: CNU_COLUMN_GEOMETRY,
    classified_block_count: ordered.length,
    rejected_geometry_block_count: blocks.length - ordered.length,
    recognized_heading_count: headings.length,
    possible_boundary_count: boundaries.length,
    boundary_only_heading_count: boundaries.length - headings.length,
    entries,
    ambiguous,
    missing,
    compound_heading_rejections: compounds,
    compound_entry_receipts: compoundEntryReceipts,
    identity_discrepancy_receipts: identityDiscrepancyReceipts,
    geometry_rejections: geometryRejections,
  };
}

module.exports = {
  CNU_BOUNDARY_CONTRACT,
  CNU_COLUMN_GEOMETRY,
  CNU_COMPOUND_BOUNDARY_CONTRACT,
  CNU_COMPOUND_RECEIPT_CONTRACT,
  CNU_EXPECTED_PAGE_COUNT,
  CNU_EXPECTED_PDF_SHA256,
  CNU_EXPECTED_PDF_TITLE,
  CNU_PDF_CACHE_PATH,
  CNU_PINNED_CODE_DISCREPANCY,
  CNU_PINNED_COMPOUND_RECEIPTS,
  CNU_SLUG,
  catalogYearSeen,
  columnForBounds,
  extractCnuPdfEntries,
  extractCnuCompoundMemberRequisites,
  insideContentBounds,
  normalizeCode,
  parsePdfInfo,
  parsePublishedHeading,
  possibleCourseHeading,
  publishedUnits,
  sha256,
};
