const fs = require('node:fs');
const {
  DEFAULT_EVIDENCE,
} = require('./southwestVccsPrerequisiteEvidence');
const {
  cachePathForRow,
  captureReceipt,
  extractCourseFragment,
  loadAndValidateCapture,
} = require('./southwestCourseLeafCapture');

const artifact = JSON.parse(fs.readFileSync(DEFAULT_EVIDENCE, 'utf8'));
const byCode = new Map(artifact.rows.map((row) => [row.code, row]));

describe('Southwest exact CourseLeaf response capture', () => {
  it('reproduces every committed response and single-course-fragment receipt', () => {
    const expected = {
      ENG249: {
        source_response_sha256: 'd191460ec575408ba34dfc6000d0373aae654fa73ee54cbd1340f9dfeddacc09',
        source_response_bytes: 71015,
        course_fragment_html_sha256: 'b1eb5513e31eaebd5dae500d3770ac0c8e228b296cf0b480292815067a2bf19e',
      },
      ENG268: {
        source_response_sha256: '070f7a8bc42fd4e991284dcf708dd9df15c637b1b745764ebbab73e9bed643a1',
        source_response_bytes: 70684,
        course_fragment_html_sha256: 'bb3e4ed9b4f432127cff149b4069a126cd31a95767c6b025f2ba4026aff1fc99',
      },
      PHI102: {
        source_response_sha256: 'e84ae9af17aa950e1430e746212f14c6f7e2338042bb3ebf04df492c15ef3a0f',
        source_response_bytes: 70310,
        course_fragment_html_sha256: '9106c24d941673e0f0c3e90314010a57c7b61bd541cd9e7a0bddd3a53242afe2',
      },
    };
    for (const [code, row] of byCode) {
      expect(loadAndValidateCapture(row)).toMatchObject(expected[code]);
      expect(row.source_capture.extracted_entry_sha256).toBe(row.raw_entry_sha256);
    }
  });

  it('rejects a modified course fragment even if the surrounding page remains valid', () => {
    const row = byCode.get('PHI102');
    const body = fs.readFileSync(cachePathForRow(row), 'utf8')
      .replace('Lecture 3 hours per week.', 'Prerequisite(s): PHI 101. Lecture 3 hours per week.');
    expect(() => captureReceipt(body, row)).toThrow(/not byte-derived/);
  });

  it('rejects an unbounded response containing more than one course fragment', () => {
    const row = byCode.get('ENG268');
    const body = fs.readFileSync(cachePathForRow(row), 'utf8');
    const { fragmentHtml } = extractCourseFragment(body, row);
    expect(() => captureReceipt(`${body}${fragmentHtml}`, row)).toThrow(/one exact course fragment/);
  });

  it('rejects a response from a different catalog edition', () => {
    const row = byCode.get('ENG249');
    const body = fs.readFileSync(cachePathForRow(row), 'utf8')
      .replace(
        '<span class="acalog_catalog_name">2026-2027 Catalog</span>',
        '<span class="acalog_catalog_name">2025-2026 Catalog</span>',
      );
    expect(() => captureReceipt(body, row)).toThrow(/catalog edition changed/);
  });
});
