const fs = require('node:fs');
const path = require('node:path');
const {
  VIRGINIA_TECH_CS_EXPECTED_COURSEBLOCK_COUNT,
  VIRGINIA_TECH_CS_HTML_CACHE_PATH,
  VIRGINIA_TECH_CS_HTML_SHA256,
  VIRGINIA_TECH_CS_TEXT_CACHE_PATH,
  VIRGINIA_TECH_CS_TEXT_SHA256,
  verifyVirginiaTechCsRetainedSource,
} = require('./virginiaTechCourseLeafPrerequisiteAcquisition');

const CACHE = path.resolve(__dirname, '../../.va-catalogs');
const read = (relative) => fs.readFileSync(path.join(CACHE, relative));

describe('Virginia Tech retained official CS subject prerequisite source', () => {
  it('replays the pinned whole response and all exact courseblock headings', () => {
    const result = verifyVirginiaTechCsRetainedSource({
      htmlBytes: read(VIRGINIA_TECH_CS_HTML_CACHE_PATH),
      textBytes: read(VIRGINIA_TECH_CS_TEXT_CACHE_PATH),
    });
    expect(result).toMatchObject({
      verified: true,
      issues: [],
      html_sha256: VIRGINIA_TECH_CS_HTML_SHA256,
      text_sha256: VIRGINIA_TECH_CS_TEXT_SHA256,
      courseblock_count: VIRGINIA_TECH_CS_EXPECTED_COURSEBLOCK_COUNT,
    });
    expect(result.exact_course_codes).toHaveLength(VIRGINIA_TECH_CS_EXPECTED_COURSEBLOCK_COUNT);
    expect(result.exact_course_codes).toContain('CS1114');
    expect(result.exact_course_codes).toContain('CS4944');
    expect(result.exact_course_codes).not.toContain('CS5104');
    expect(result.exact_course_codes).not.toContain('CS5114');
  });

  it('fails closed on either whole-response or normalized-text tampering', () => {
    const html = read(VIRGINIA_TECH_CS_HTML_CACHE_PATH);
    const text = read(VIRGINIA_TECH_CS_TEXT_CACHE_PATH);
    expect(verifyVirginiaTechCsRetainedSource({
      htmlBytes: Buffer.concat([html, Buffer.from(' ')]),
      textBytes: text,
    })).toMatchObject({ verified: false, issues: expect.arrayContaining(['html_sha256']) });
    expect(verifyVirginiaTechCsRetainedSource({
      htmlBytes: html,
      textBytes: Buffer.concat([text, Buffer.from(' ')]),
    })).toMatchObject({ verified: false, issues: expect.arrayContaining(['text_sha256']) });
  });
});
