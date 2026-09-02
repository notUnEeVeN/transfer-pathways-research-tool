import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  UVA_WISE_BOUNDARY_CONTRACT,
  UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
  UVA_WISE_CLOSURE_COURSE_RECORDS,
  UVA_WISE_DIRECT_COURSE_RECORDS,
  UVA_WISE_GE_HTML_SHA256,
  UVA_WISE_PROGRAM_HTML_SHA256,
  UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
  UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  expectedCourseUrl,
  extractUvaWiseCourseEntry,
  sha256,
  verifyUvaWiseDiscovery,
  verifyUvaWiseRetainedEntryDiscovery,
} = require('./uvaWiseAcalogPrerequisiteAcquisition');

const programHtml = fs.readFileSync(new URL(
  '../../.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__program.html',
  import.meta.url,
), 'utf8');
const geHtml = fs.readFileSync(new URL(
  '../../.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__ge.html',
  import.meta.url,
), 'utf8');

function page({
  code = 'CSC 2180',
  title = 'Data Structures',
  credits = '4',
  body = '<strong>Prerequisites</strong><br> CSC 1180 and MTH 1110 with a C or better<br><strong>Course Frequency:</strong><br> Fall, Spring',
  duplicate = '',
} = {}) {
  return `<!doctype html><html><body>
    <span id="acalog-catalog-name">2026-2027 UVA Wise Catalog</span>
    <table><tr><td class="block_content"><div class="help_block">HELP</div>
      <h1 id="course_preview_title">${code}&nbsp;-&nbsp;${title}</h1><hr>
      <strong>Credit(s)</strong> <strong>${credits}</strong><br><br>
      Official description.<br><br>${body}${duplicate}
      <br><hr><div>Back to Top</div>
    </td></tr></table>
  </body></html>`;
}

describe('UVA Wise exact Acalog prerequisite acquisition', () => {
  it('pins every direct target to the two retained official discovery pages', () => {
    const codes = Object.keys(UVA_WISE_DIRECT_COURSE_RECORDS);
    const result = verifyUvaWiseDiscovery({ programHtml, geHtml }, codes);
    expect(result).toMatchObject({ verified: true, issues: [] });
    expect(result.links).toHaveLength(31);
    expect(result.links).toEqual(expect.arrayContaining(codes.map((courseCode) => (
      expect.objectContaining({
        course_code: courseCode,
        catoid: 9,
        coid: UVA_WISE_DIRECT_COURSE_RECORDS[courseCode].coid,
        title: UVA_WISE_DIRECT_COURSE_RECORDS[courseCode].title,
      })
    ))));
    expect(result.links.find((row) => row.course_code === 'SWE1790').discovery_sources)
      .toEqual(['general_education', 'program']);
    expect(UVA_WISE_PROGRAM_HTML_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(UVA_WISE_GE_HTML_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS).toBe(120);
  });

  it('pins all three recursive identities to exact links in retained official responses', () => {
    for (const [code, record] of Object.entries(UVA_WISE_CLOSURE_COURSE_RECORDS)) {
      const html = fs.readFileSync(new URL(
        `../../.va-catalogs/${record.discovery_cache_path}`, import.meta.url,
      ), 'utf8');
      const result = verifyUvaWiseRetainedEntryDiscovery(html, code);
      expect(result).toMatchObject({
        verified: true,
        issues: [],
        links: [{
          course_code: code,
          catoid: 9,
          coid: record.coid,
          discovery_course_code: record.discovery_course_code,
          discovery_cache_path: record.discovery_cache_path,
          discovery_response_sha256: record.discovery_response_sha256,
        }],
      });
      expect(record.discovery_response_sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT)
      .toContain('hash_pinned_retained_course_entry');
  });

  it('replays every recursive target from hash-bound cache metadata with compliant spacing', () => {
    const captures = [];
    for (const [code, record] of Object.entries(UVA_WISE_CLOSURE_COURSE_RECORDS)) {
      const stem = `../../.va-catalogs/university-prerequisites/raw/the-university-of-virginia-s-college-at-wise/the-university-of-virginia-s-college-at-wise__${code.toLowerCase()}`;
      const html = fs.readFileSync(new URL(`${stem}.html`, import.meta.url), 'utf8');
      const metadata = JSON.parse(fs.readFileSync(new URL(`${stem}.json`, import.meta.url), 'utf8'));
      expect(metadata).toMatchObject({
        requested_url: expectedCourseUrl(code),
        final_url: expectedCourseUrl(code),
        capture_status: 'official_html_captured',
        http_status: 200,
        content_sha256: sha256(Buffer.from(html)),
        target_course_codes: [code],
        robots: { http_status: 200, crawl_delay_seconds: 120 },
      });
      expect(extractUvaWiseCourseEntry(html, code, { finalUrl: metadata.final_url }))
        .toMatchObject({
          verified: true,
          issues: [],
          entries: [{ course_code: code, coid: record.coid, title: record.title }],
        });
      captures.push(metadata);
    }
    captures.sort((a, b) => Date.parse(a.fetched_at) - Date.parse(b.fetched_at));
    for (let index = 1; index < captures.length; index += 1) {
      expect(Date.parse(captures[index].fetched_at) - Date.parse(captures[index - 1].fetched_at))
        .toBeGreaterThanOrEqual(120_000);
    }
  });

  it('fails closed if a retained recursive link receipt changes by one byte', () => {
    const record = UVA_WISE_CLOSURE_COURSE_RECORDS.MTH1210;
    const html = fs.readFileSync(new URL(
      `../../.va-catalogs/${record.discovery_cache_path}`, import.meta.url,
    ), 'utf8');
    const result = verifyUvaWiseRetainedEntryDiscovery(
      html.replace('coid=18337', 'coid=1'), 'MTH1210',
    );
    expect(result.verified).toBe(false);
    expect(result.issues).toContain('discovery_html_sha256');
  });

  it('bounds the exact HTTP-only detail response and prerequisite clause', () => {
    const result = extractUvaWiseCourseEntry(page(), 'CSC2180', {
      finalUrl: expectedCourseUrl('CSC2180'),
    });
    expect(result).toMatchObject({
      verified: true,
      issues: [],
      missing: [],
      entries: [{
        course_code: 'CSC2180',
        catoid: 9,
        coid: 17965,
        title: 'Data Structures',
        published_units: { credit_hours_min: 4, credit_hours_max: 4 },
      }],
    });
    const entry = result.entries[0];
    expect(entry.raw_entry_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.raw_entry_html_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.required_requisite_clause).toMatchObject({
      receipt_contract: UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
      label: 'Prerequisites',
      raw: 'CSC 1180 and MTH 1110 with a C or better',
      boundary_terminal: 'next_br_after_unique_strong_prerequisite_marker_and_first_br',
    });
    const clause = entry.required_requisite_clause;
    expect(entry.raw_entry_text.slice(clause.relative_start, clause.relative_end))
      .toBe(clause.raw);
    expect(entry.raw_entry_text.slice(
      clause.statement_relative_start,
      clause.statement_relative_start + clause.label.length,
    )).toBe(clause.label);
    expect(UVA_WISE_BOUNDARY_CONTRACT).toContain('exact_catoid_coid');
  });

  it('retains complete source silence without manufacturing a no-prerequisite claim', () => {
    const result = extractUvaWiseCourseEntry(page({
      body: '<strong>Course Frequency:</strong><br> Fall, Spring',
    }), 'CSC2180', { finalUrl: expectedCourseUrl('CSC2180') });
    expect(result.verified).toBe(true);
    expect(result.entries[0].required_requisite_clause).toBeNull();
    expect(result.entries[0]).not.toHaveProperty('none');
  });

  it('projects a clause from its unique marker when the code also occurs in the description', () => {
    const result = extractUvaWiseCourseEntry(page({
      code: 'ENG 1020',
      title: 'Composition',
      credits: '3',
      body: 'Students continue work begun in ENG 1010.<br><br><strong>Prerequisites</strong><br> ENG 1010<br><strong>Course Frequency:</strong><br> Spring',
    }), 'ENG1020', { finalUrl: expectedCourseUrl('ENG1020') });
    expect(result).toMatchObject({ verified: true, issues: [] });
    const entry = result.entries[0];
    expect(entry.required_requisite_clause).toMatchObject({ raw: 'ENG 1010' });
    expect(entry.required_requisite_clause.relative_start)
      .toBeGreaterThan(entry.raw_entry_text.indexOf('ENG 1010'));
    expect(entry.raw_entry_text.slice(
      entry.required_requisite_clause.relative_start,
      entry.required_requisite_clause.relative_end,
    )).toBe('ENG 1010');
  });

  it('fails closed on source-byte, protocol, coid, title, credit, and boundary drift', () => {
    expect(verifyUvaWiseDiscovery({ programHtml: `${programHtml} `, geHtml }, ['CSC2180']).issues)
      .toContain('program_html_sha256');
    expect(extractUvaWiseCourseEntry(page(), 'CSC2180', {
      finalUrl: 'https://catalog.uvawise.edu/preview_course_nopop.php?catoid=9&coid=17965',
    }).issues).toContain('course_url_identity');
    expect(extractUvaWiseCourseEntry(page(), 'CSC2180', {
      finalUrl: 'http://catalog.uvawise.edu/preview_course_nopop.php?catoid=9&coid=1',
    }).issues).toContain('course_url_identity');
    expect(extractUvaWiseCourseEntry(page({ title: 'Changed' }), 'CSC2180', {
      finalUrl: expectedCourseUrl('CSC2180'),
    }).issues).toContain('exact_course_title');
    expect(extractUvaWiseCourseEntry(page({ credits: 'unknown' }), 'CSC2180', {
      finalUrl: expectedCourseUrl('CSC2180'),
    }).issues).toContain('published_credits');
    expect(extractUvaWiseCourseEntry(page({
      body: '<strong>Prerequisites</strong><br> CSC 1180 without a terminal boundary',
    }).replaceAll('<br><hr>', '<hr>'), 'CSC2180', {
      finalUrl: expectedCourseUrl('CSC2180'),
    }).issues).toContain('prerequisite_first_br_boundary');
  });
});
