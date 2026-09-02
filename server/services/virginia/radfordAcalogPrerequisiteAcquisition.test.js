import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_CLOSURE_COURSE_RECORDS,
  RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  RADFORD_DIRECT_COURSE_RECORDS,
  RADFORD_PROGRAM_HTML_SHA256,
  expectedCourseUrl,
  extractRadfordCourseEntry,
  sha256,
  verifyRadfordProgramDiscovery,
  verifyRadfordRetainedEntryDiscovery,
} = require('./radfordAcalogPrerequisiteAcquisition');

const programHtml = fs.readFileSync(new URL(
  '../../.va-catalogs/pages/radford-university__program.html', import.meta.url,
), 'utf8');

function page({
  code = 'CS 220',
  title = 'Principles of Computer Science II (GE)',
  credits = '(4)',
  body = '<strong>Prerequisites:</strong> CS 120.<br>Description.',
  duplicate = '',
} = {}) {
  return `<!doctype html><html><body>
    <span id="acalog-catalog-name" class="no_display">2026-2027 University Academic Catalog</span>
    <table><tr><td class="block_content"><div class="help_block">HELP</div>
      <h1 id="course_preview_title">${code}&nbsp;-&nbsp;${title}</h1>
      <p><strong>Credits:</strong> ${credits}<hr>${body}</p>
      ${duplicate}<br><hr><div>Back to Top</div>
    </td></tr></table>
  </body></html>`;
}

describe('Radford exact Acalog prerequisite acquisition', () => {
  it('pins all fifteen current-program course identities before detail capture', () => {
    const codes = Object.keys(RADFORD_DIRECT_COURSE_RECORDS);
    const result = verifyRadfordProgramDiscovery(programHtml, codes);
    expect(result).toEqual({
      verified: true,
      issues: [],
      links: expect.arrayContaining(codes.map((code) => expect.objectContaining({
        course_code: code,
        catoid: 62,
        coid: RADFORD_DIRECT_COURSE_RECORDS[code].coid,
        title: RADFORD_DIRECT_COURSE_RECORDS[code].title,
      }))),
    });
    expect(result.links).toHaveLength(15);
    expect(RADFORD_PROGRAM_HTML_SHA256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('pins every recursive identity to an exact link in a retained official response', () => {
    for (const [code, record] of Object.entries(RADFORD_CLOSURE_COURSE_RECORDS)) {
      const html = fs.readFileSync(new URL(
        `../../.va-catalogs/${record.discovery_cache_path}`, import.meta.url,
      ), 'utf8');
      const result = verifyRadfordRetainedEntryDiscovery(html, code);
      expect(result).toMatchObject({
        verified: true,
        issues: [],
        links: [{
          course_code: code,
          catoid: 62,
          coid: record.coid,
          discovery_course_code: record.discovery_course_code,
          discovery_cache_path: record.discovery_cache_path,
          discovery_response_sha256: record.discovery_response_sha256,
        }],
      });
      expect(record.discovery_response_sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT)
      .toContain('hash_pinned_retained_course_entry');
  });

  it('replays every recursive target from hash-bound cache metadata with compliant spacing', () => {
    const captures = [];
    for (const [code, record] of Object.entries(RADFORD_CLOSURE_COURSE_RECORDS)) {
      const stem = `../../.va-catalogs/university-prerequisites/raw/radford-university/radford-university__${code.toLowerCase()}`;
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
      const result = extractRadfordCourseEntry(html, code, { finalUrl: metadata.final_url });
      expect(result).toMatchObject({
        verified: true,
        issues: [],
        entries: [{
          course_code: code,
          coid: record.coid,
          title: record.title,
          formal_requisite_marker_count:
            Number(Boolean(result.entries[0].required_requisite_clause))
            + Number(Boolean(result.entries[0].pre_or_corequisite_clause)),
        }],
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
    const record = RADFORD_CLOSURE_COURSE_RECORDS.CS118;
    const html = fs.readFileSync(new URL(
      `../../.va-catalogs/${record.discovery_cache_path}`, import.meta.url,
    ), 'utf8');
    const result = verifyRadfordRetainedEntryDiscovery(
      html.replace('coid=110599', 'coid=1'), 'CS118',
    );
    expect(result.verified).toBe(false);
    expect(result.issues).toContain('discovery_html_sha256');
  });

  it('bounds one exact full course response with published credits', () => {
    const result = extractRadfordCourseEntry(page(), 'CS220', {
      finalUrl: expectedCourseUrl('CS220'),
    });
    expect(result).toMatchObject({
      verified: true,
      issues: [],
      missing: [],
      entries: [{
        course_code: 'CS220',
        catoid: 62,
        coid: 109002,
        heading_text: 'CS 220 - Principles of Computer Science II (GE)',
        title: 'Principles of Computer Science II (GE)',
        published_units: { credit_hours_min: 4, credit_hours_max: 4 },
      }],
    });
    expect(result.entries[0].raw_entry_text).toContain('Prerequisites: CS 120.');
    expect(result.entries[0].raw_entry_sha256).toMatch(/^[a-f0-9]{64}$/);
    const clause = result.entries[0].required_requisite_clause;
    expect(clause).toMatchObject({
      receipt_contract: RADFORD_CLAUSE_RECEIPT_CONTRACT,
      kind: 'prerequisite',
      label: 'Prerequisites',
      raw: 'CS 120.',
      boundary_terminal: 'first_br_after_unique_strong_prerequisite_marker',
    });
    expect(result.entries[0].raw_entry_text.slice(clause.relative_start, clause.relative_end))
      .toBe(clause.raw);
    expect(result.entries[0].raw_entry_text.slice(
      clause.statement_relative_start,
      clause.statement_relative_start + clause.label.length + 1,
    )).toBe('Prerequisites:');
    expect(clause.raw_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(clause.raw_html_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(RADFORD_BOUNDARY_CONTRACT).toContain('unique_preview_course_record');
  });

  it('replays Acalog punctuation spans without changing clause offsets', () => {
    const body = '<strong>Prerequisite:</strong> CS 118<span>,</span> CS 119<span>,</span> or CS 120 with a grade of “C” or better<span>.</span><br>Description.';
    const result = extractRadfordCourseEntry(page({ body }), 'CS220', {
      finalUrl: expectedCourseUrl('CS220'),
    });
    expect(result.verified).toBe(true);
    const entry = result.entries[0];
    const clause = entry.required_requisite_clause;
    expect(clause.raw).toBe('CS 118, CS 119, or CS 120 with a grade of “C” or better.');
    expect(entry.raw_entry_text.slice(clause.relative_start, clause.relative_end)).toBe(clause.raw);
  });

  it('retains exact Pre- or Corequisites fields instead of misclassifying them as silence', () => {
    for (const [code, expectedRaw] of [
      ['CS118', 'MATH 125 , MATH 138 , MATH 168 , MATH 169 or MATH 171 .'],
      ['CS119', 'MATH 125 , MATH 138 , MATH 168 , MATH 169 , or MATH 171 .'],
    ]) {
      const stem = `../../.va-catalogs/university-prerequisites/raw/radford-university/radford-university__${code.toLowerCase()}`;
      const html = fs.readFileSync(new URL(`${stem}.html`, import.meta.url), 'utf8');
      const metadata = JSON.parse(fs.readFileSync(new URL(`${stem}.json`, import.meta.url), 'utf8'));
      const result = extractRadfordCourseEntry(html, code, { finalUrl: metadata.final_url });
      expect(result).toMatchObject({ verified: true, issues: [] });
      const entry = result.entries[0];
      expect(entry.pre_or_corequisite_clause).toMatchObject({
        receipt_contract: RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT,
        kind: 'pre_or_corequisite',
        label: 'Pre- or Corequisites',
        raw: expectedRaw,
        boundary_terminal: 'first_br_after_unique_strong_pre_or_corequisite_marker',
      });
      const receipt = entry.pre_or_corequisite_clause;
      expect(entry.raw_entry_text.slice(receipt.relative_start, receipt.relative_end))
        .toBe(expectedRaw);
      expect(receipt.raw_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.raw_html_sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('keeps a structurally complete silent entry review-required rather than inferring none', () => {
    const result = extractRadfordCourseEntry(page({ body: 'A first course in composition.' }), 'CS220', {
      finalUrl: expectedCourseUrl('CS220'),
    });
    expect(result.verified).toBe(true);
    expect(result.entries[0].raw_entry_text).not.toMatch(/Prerequisite/i);
    expect(result.entries[0]).not.toHaveProperty('none');
  });

  it('fails closed on URL, title, credits, or duplicate-heading drift', () => {
    expect(extractRadfordCourseEntry(page(), 'CS220', {
      finalUrl: 'https://catalog.radford.edu/preview_course_nopop.php?catoid=62&coid=1',
    }).issues).toContain('course_url_identity');
    expect(extractRadfordCourseEntry(page({ title: 'Changed' }), 'CS220', {
      finalUrl: expectedCourseUrl('CS220'),
    }).issues).toContain('exact_course_title');
    expect(extractRadfordCourseEntry(page({ credits: 'variable' }), 'CS220', {
      finalUrl: expectedCourseUrl('CS220'),
    }).issues).toContain('published_credits');
    expect(extractRadfordCourseEntry(page({
      duplicate: '<h1 id="course_preview_title">CS 220 - Principles of Computer Science II (GE)</h1>',
    }), 'CS220', { finalUrl: expectedCourseUrl('CS220') }).issues)
      .toContain('unique_exact_course_heading');
    expect(extractRadfordCourseEntry(page({
      body: '<strong>Prerequisites:</strong> CS 120. No terminal boundary.',
    }).replaceAll('<br>', ''), 'CS220', { finalUrl: expectedCourseUrl('CS220') }).issues)
      .toContain('prerequisite_first_br_boundary');
    expect(extractRadfordCourseEntry(page({
      body: '<strong>Prerequisites:</strong> CS 120.<strong>Prerequisite:</strong> MATH 100.<br>',
    }), 'CS220', { finalUrl: expectedCourseUrl('CS220') }).issues)
      .toContain('unique_prerequisite_marker');
  });

  it('detects any byte or coid drift in retained program discovery', () => {
    expect(verifyRadfordProgramDiscovery(`${programHtml} `, ['CS220']).issues)
      .toContain('program_html_sha256');
    const tampered = programHtml.replace("showCourse('62', '109002'", "showCourse('62', '1'");
    expect(verifyRadfordProgramDiscovery(tampered, ['CS220']).issues)
      .toEqual(expect.arrayContaining(['program_html_sha256', 'CS220:unique_program_link']));
  });
});
