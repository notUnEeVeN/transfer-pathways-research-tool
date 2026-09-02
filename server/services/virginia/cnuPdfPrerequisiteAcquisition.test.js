import { describe, expect, it } from 'vitest';
import {
  CNU_COLUMN_GEOMETRY,
  columnForBounds,
  extractCnuCompoundMemberRequisites,
  extractCnuPdfEntries,
  parsePublishedHeading,
  possibleCourseHeading,
  publishedUnits,
  sha256,
} from './cnuPdfPrerequisiteAcquisition';

const TITLE = 'Christopher Newport University: Undergraduate Catalog 2025-26';
const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function block({ xMin = 50, xMax = 280, yMin = 100, yMax = 180, lines }) {
  return `<block xMin="${xMin}" yMin="${yMin}" xMax="${xMax}" yMax="${yMax}">${lines.map((line, lineIndex) => (
    `<line xMin="${xMin}" yMin="${yMin + lineIndex * 12}" xMax="${xMax}" yMax="${yMin + lineIndex * 12 + 10}">${line.split(/\s+/).map((word, wordIndex) => (
      `<word xMin="${xMin + wordIndex}" yMin="${yMin}" xMax="${xMin + wordIndex + 1}" yMax="${yMin + 10}">${escapeXml(word)}</word>`
    )).join('')}</line>`
  )).join('')}</block>`;
}

function bbox(pages, title = TITLE) {
  return `<html><head><title>${escapeXml(title)}</title></head><body><doc>${pages.map((blocks) => (
    `<page width="602.503" height="787.5"><flow>${blocks.join('')}</flow></page>`
  )).join('')}</doc></body></html>`;
}

function extract(pages, targetCodes, overrides = {}) {
  const pdfBytes = Buffer.from('exact fixture PDF bytes');
  return extractCnuPdfEntries({
    pdfBytes,
    bboxHtml: bbox(pages),
    pdfInfoText: `Title: ${TITLE}\nPages: ${pages.length}\nTagged: yes\n`,
    targetCodes,
    catalogYear: '2025-2026',
    expectedPdfSha256: sha256(pdfBytes),
    expectedTitle: TITLE,
    expectedPageCount: pages.length,
    ...overrides,
  });
}

describe('CNU official PDF prerequisite acquisition', () => {
  it('uses page/column order to keep a cross-column continuation in one exact entry', () => {
    const result = extract([[
      block({ lines: ['CPSC 100. First Course (3-3-0)', 'Prerequisite: MATH 100 and'] }),
      block({ xMin: 330, xMax: 560, yMin: 100, lines: ['MATH 101.', 'Description.'] }),
      block({ xMin: 330, xMax: 560, yMin: 220, lines: ['CPSC 200. Second Course (Credits vary 1-3)', 'Prerequisite: CPSC 100.'] }),
    ]], ['CPSC100', 'CPSC200']);
    expect(result).toMatchObject({ verified: true, issues: [], missing: [], ambiguous: [] });
    expect(result.entries.map((row) => row.course_code)).toEqual(['CPSC100', 'CPSC200']);
    expect(result.entries[0]).toMatchObject({
      published_units: { credit_hours_min: 3, credit_hours_max: 3 },
      page_column_span: ['1:left', '1:right'],
      source_blocks: [{ column: 'left' }, { column: 'right' }],
    });
    expect(result.entries[0].raw_entry_text).toContain('MATH 100 and\n\nMATH 101.');
    expect(result.entries[0].raw_entry_text).not.toContain('CPSC 200');
    expect(result.entries[1].published_units).toMatchObject({
      kind: 'published_variable_credit_range', credit_hours_min: 1, credit_hours_max: 3,
    });
  });

  it('rejects duplicate exact headings instead of choosing one', () => {
    const result = extract([[
      block({ lines: ['CPSC 100. First Copy (3-3-0)', 'Prerequisite: MATH 100.'] }),
      block({ xMin: 330, xMax: 560, lines: ['CPSC 100. Second Copy (3-3-0)', 'Prerequisite: MATH 101.'] }),
    ]], ['CPSC100']);
    expect(result.entries).toEqual([]);
    expect(result.ambiguous).toEqual([{
      course_code: 'CPSC100', matching_bounded_headings: 2, geometry_rejected_headings: 0,
    }]);
  });

  it('rejects a gutter-crossing heading and a heading without published units', () => {
    const gutter = extract([[
      block({ xMin: 280, xMax: 330, lines: ['CPSC 100. Cross Column (3-3-0)'] }),
    ]], ['CPSC100']);
    expect(gutter.entries).toEqual([]);
    expect(gutter.geometry_rejections).toEqual([
      expect.objectContaining({ course_code: 'CPSC100' }),
    ]);
    expect(gutter.ambiguous).toEqual([
      expect.objectContaining({ course_code: 'CPSC100', geometry_rejected_headings: 1 }),
    ]);

    const noUnits = extract([[
      block({ lines: ['CPSC 100. No Published Unit Label', 'Mentions CPSC 200 (3-3-0) later in prose.'] }),
    ]], ['CPSC100']);
    expect(noUnits.entries).toEqual([]);
    expect(noUnits.missing).toEqual(['CPSC100']);
  });

  it('uses unsupported course-shaped headings as boundaries so they cannot bleed into an accepted entry', () => {
    const result = extract([[
      block({ lines: ['CPSC 100. Accepted Course (3-3-0)', 'Prerequisite: MATH 100.'] }),
      block({ yMin: 220, lines: ['CPSC 175. Unsupported Units', 'Prerequisite: MATH 999.'] }),
      block({ yMin: 340, lines: ['CPSC 200. Next Accepted Course (3-3-0)'] }),
    ]], ['CPSC100', 'CPSC175', 'CPSC200']);
    expect(result.entries.map((row) => row.course_code)).toEqual(['CPSC100', 'CPSC200']);
    expect(result.missing).toEqual(['CPSC175']);
    expect(result).toMatchObject({
      possible_boundary_count: 3,
      recognized_heading_count: 2,
      boundary_only_heading_count: 1,
    });
    expect(result.entries[0].raw_entry_text).not.toContain('CPSC 175');
    expect(result.entries[0].raw_entry_text).not.toContain('MATH 999');
  });

  it('keeps compound sequence headings as boundaries but not singular candidates', () => {
    const result = extract([[
      block({ lines: ['PHYS 151-152. College Physics (3-3-0)', 'Prerequisite for PHYS 152: PHYS 151.'] }),
      block({ lines: ['PHYS 201. University Physics (3-3-0)', 'Prerequisite: MATH 140.'], yMin: 240 }),
    ]], ['PHYS151', 'PHYS152', 'PHYS201']);
    expect(result.entries.map((row) => row.course_code)).toEqual(['PHYS201']);
    expect(result.missing).toEqual(['PHYS151', 'PHYS152']);
    expect(result.compound_heading_rejections).toEqual([
      expect.objectContaining({ target_course_codes: ['PHYS151', 'PHYS152'] }),
    ]);
  });

  it('partitions only exact course-qualified member clauses inside a shared entry', () => {
    const raw = [
      'PHYS 151-152. College Physics (3-3-0)',
      'Prerequisites for PHYS 151: High school algebra and',
      '',
      'trigonometry or consent of instructor.',
      'Prerequisite for PHYS 152: PHYS 151.',
      'Shared description.',
    ].join('\n');
    const result = extractCnuCompoundMemberRequisites(raw, ['PHYS151', 'PHYS152']);
    expect(result).toMatchObject({ verified: true, issues: [] });
    expect(result.receipts).toEqual([
      expect.objectContaining({
        course_code: 'PHYS151',
        label: 'Prerequisites for PHYS 151',
        raw_normalized: 'High school algebra and trigonometry or consent of instructor',
        concurrent_allowed: false,
      }),
      expect.objectContaining({
        course_code: 'PHYS152',
        label: 'Prerequisite for PHYS 152',
        raw: 'PHYS 151',
        concurrent_allowed: false,
      }),
    ]);
    for (const receipt of result.receipts) {
      expect(raw.slice(receipt.relative_start, receipt.relative_end)).toBe(receipt.raw);
      expect(raw.slice(receipt.statement_relative_start, receipt.statement_relative_end))
        .toBe(receipt.statement_raw);
    }
    expect(extractCnuCompoundMemberRequisites(raw, ['PHYS151', 'PHYS152', 'PHYS153']))
      .toMatchObject({ verified: false });
  });

  it('fails the whole extraction closed on source hash, edition, or geometry drift', () => {
    const pages = [[block({ lines: ['CPSC 100. First Course (3-3-0)'] })]];
    const result = extract(pages, ['CPSC100'], {
      expectedPdfSha256: '0'.repeat(64),
      pdfInfoText: 'Title: Christopher Newport University: Undergraduate Catalog 2024-25\nPages: 1\n',
    });
    expect(result.verified).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.missing).toEqual(['CPSC100']);
    expect(result.issues).toEqual(expect.arrayContaining([
      'pdf_sha256_mismatch', 'pdfinfo_title_mismatch', 'pdfinfo_catalog_year_mismatch',
    ]));

    const geometryDrift = extract(pages, ['CPSC100'], {
      bboxHtml: bbox(pages).replace('width="602.503"', 'width="603.503"'),
    });
    expect(geometryDrift).toMatchObject({
      verified: false,
      entries: [],
      missing: ['CPSC100'],
      issues: ['bbox_page_geometry:1'],
    });

    const bboxEditionDrift = extract(pages, ['CPSC100'], {
      bboxHtml: bbox(pages, 'Christopher Newport University: Undergraduate Catalog 2024-25'),
    });
    expect(bboxEditionDrift.verified).toBe(false);
    expect(bboxEditionDrift.issues).toEqual(expect.arrayContaining([
      'bbox_title_mismatch', 'bbox_catalog_year_mismatch',
    ]));
  });

  it('recognizes only explicit CNU unit notations and non-overlapping columns', () => {
    expect(parsePublishedHeading(['CPSC 150. Intro', 'Programming (3-3-0)'])).toMatchObject({
      course_code: 'CPSC150', heading_line_count: 2,
    });
    expect(parsePublishedHeading(['CPSC 150. Intro without units'])).toBeNull();
    expect(possibleCourseHeading(['CPSC 150. Intro without units'])).toBe(true);
    expect(possibleCourseHeading(['Prerequisite: CPSC 150.'])).toBe(false);
    expect(publishedUnits('(0-0-4)')).toMatchObject({ credit_hours_min: 0, laboratory_hours: 4 });
    expect(publishedUnits('(Credits vary 1-3)')).toMatchObject({ credit_hours_min: 1, credit_hours_max: 3 });
    expect(publishedUnits('(three credits)')).toBeNull();
    expect(columnForBounds(50, 299)).toBe('left');
    expect(columnForBounds(303, 560)).toBe('right');
    expect(columnForBounds(299, 303)).toBeNull();
    expect(CNU_COLUMN_GEOMETRY.left.x_max_inclusive)
      .toBeLessThan(CNU_COLUMN_GEOMETRY.right.x_min_inclusive);
  });
});
