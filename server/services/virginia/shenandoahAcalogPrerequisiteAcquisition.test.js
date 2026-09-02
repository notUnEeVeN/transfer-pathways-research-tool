import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
  SHENANDOAH_COURSE_CATALOG_HTML_SHA256,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_PROGRAM_HTML_SHA256,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  expectedCourseUrl,
  expectedFilterDiscoveryUrl,
  extractShenandoahCourseEntry,
  extractShenandoahFilteredDiscovery,
  verifyShenandoahCourseCatalogFilterForm,
  verifyShenandoahProgramDiscovery,
} = require('./shenandoahAcalogPrerequisiteAcquisition');

const programHtml = fs.readFileSync(new URL(
  '../../.va-catalogs/pages/shenandoah-university__program.html', import.meta.url,
), 'utf8');
const courseCatalogHtml = fs.readFileSync(new URL(
  '../../.va-catalogs/pages/shenandoah-university__course_catalog.html', import.meta.url,
), 'utf8');

function page({
  code = 'CSC 122',
  title = 'Introduction to Computer Programming II',
  credits = '3',
  body = 'Official description.',
  requisite = 'Earned grade of “C-” or better in CSC-121',
  extra = '',
} = {}) {
  return `<!doctype html><html><body>
    <span id="acalog-catalog-name">2025-2026 Undergraduate Catalog</span>
    <table><tr><td class="block_content"><div class="help_block">HELP</div>
      <h1 id="course_preview_title">${code}&nbsp;${title}</h1>
      <p>${body}<br>Credit(s): ${credits}<br>
      ${requisite == null ? '' : `Prerequisite(s): ${requisite}<br>`}</p>
      ${extra}<div>Back to Top</div>
    </td></tr></table>
  </body></html>`;
}

describe('Shenandoah exact Acalog prerequisite acquisition', () => {
  it('pins fourteen program identities while keeping filter-discovered courses off obsolete links', () => {
    const codes = Object.entries(SHENANDOAH_DIRECT_COURSE_RECORDS)
      .filter(([, record]) => !record.discovery_contract)
      .map(([code]) => code);
    const result = verifyShenandoahProgramDiscovery(programHtml, codes);
    expect(result).toMatchObject({ verified: true, issues: [] });
    expect(result.links).toHaveLength(14);
    expect(result.links).toEqual(expect.arrayContaining(codes.map((courseCode) => (
      expect.objectContaining({
        course_code: courseCode,
        catoid: 33,
        coid: SHENANDOAH_DIRECT_COURSE_RECORDS[courseCode].coid,
        title: SHENANDOAH_DIRECT_COURSE_RECORDS[courseCode].title,
      })
    ))));
    expect(verifyShenandoahProgramDiscovery(programHtml, ['ENG101', 'FYS101']).issues)
      .toEqual(['ENG101:unsupported_target', 'FYS101:unsupported_target']);
    expect(SHENANDOAH_PROGRAM_HTML_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS).toBe(120);
  });

  it('pins the retained current filter form and bounds one exact filtered identity', () => {
    expect(verifyShenandoahCourseCatalogFilterForm(courseCatalogHtml))
      .toEqual({ verified: true, issues: [] });
    expect(SHENANDOAH_COURSE_CATALOG_HTML_SHA256).toMatch(/^[a-f0-9]{64}$/);
    const filtered = `<!doctype html><html><body>
      <span id="acalog-catalog-name">2025-2026 Undergraduate Catalog</span>
      <form id="course_search">
        <select name="filter[27]"><option value="ENG" selected>ENG</option></select>
        <input name="filter[29]" value="101">
      </form>
      <a href="preview_course_nopop.php?catoid=33&amp;coid=60001"
         onclick="showCourse('33', '60001', this, 'receipt')">ENG 101 Composition</a>
    </body></html>`;
    expect(extractShenandoahFilteredDiscovery(filtered, 'ENG101', {
      finalUrl: expectedFilterDiscoveryUrl('ENG101'),
    })).toMatchObject({
      verified: true,
      issues: [],
      link: { course_code: 'ENG101', title: 'Composition', catoid: 33, coid: 60001 },
    });
    expect(extractShenandoahFilteredDiscovery(
      filtered.replace('value="101"', 'value="102"'), 'ENG101', {
        finalUrl: expectedFilterDiscoveryUrl('ENG101'),
      },
    ).issues).toContain('echoed_exact_filter');
    expect(extractShenandoahFilteredDiscovery(
      filtered.replaceAll('60001', '60002'), 'ENG101', {
        finalUrl: expectedFilterDiscoveryUrl('ENG101').replace('filter%5B29%5D=101', 'filter%5B29%5D=102'),
      },
    ).issues).toEqual(expect.arrayContaining(['filter_url:filter[29]']));
  });

  it('bounds a unique complete entry and its terminal structured prerequisite field', () => {
    const result = extractShenandoahCourseEntry(page(), 'CSC122', {
      finalUrl: expectedCourseUrl('CSC122'),
    });
    expect(result).toMatchObject({
      verified: true,
      issues: [],
      missing: [],
      entries: [{
        course_code: 'CSC122',
        catoid: 33,
        coid: 55149,
        title: 'Introduction to Computer Programming II',
        published_units: { credit_hours_min: 3, credit_hours_max: 3 },
        formal_corequisite_marker_count: 0,
      }],
    });
    const entry = result.entries[0];
    const clause = entry.required_requisite_clause;
    expect(clause).toMatchObject({
      receipt_contract: SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
      kind: 'prerequisite',
      label: 'Prerequisite(s)',
      raw: 'Earned grade of “C-” or better in CSC-121',
      boundary_terminal: 'closing_p_after_unique_terminal_prerequisite_parenthetical_marker',
    });
    expect(entry.raw_entry_text.slice(clause.relative_start, clause.relative_end))
      .toBe(clause.raw);
    expect(entry.raw_entry_text.slice(
      clause.statement_relative_start,
      clause.statement_relative_start + clause.label.length + 1,
    )).toBe('Prerequisite(s):');
    expect(entry.raw_entry_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.raw_entry_html_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(SHENANDOAH_BOUNDARY_CONTRACT).toContain('exact_catoid_coid');
  });

  it('retains structural silence and constraint prose without manufacturing none', () => {
    const result = extractShenandoahCourseEntry(page({
      code: 'CSC 121',
      title: 'Introduction to Computer Programming I',
      body: 'No previous programming experience is required.',
      requisite: null,
    }), 'CSC121', { finalUrl: expectedCourseUrl('CSC121') });
    expect(result).toMatchObject({ verified: true, issues: [] });
    expect(result.entries[0].required_requisite_clause).toBeNull();
    expect(result.entries[0].raw_entry_text).toContain('experience is required');
    expect(result.entries[0]).not.toHaveProperty('none');
  });

  it('does not let an informal narrative marker replace the structured field', () => {
    const result = extractShenandoahCourseEntry(page({
      body: 'Prerequisite: CSC 121 appears only in narrative prose.',
      requisite: 'CSC 121',
    }), 'CSC122', { finalUrl: expectedCourseUrl('CSC122') });
    expect(result).toMatchObject({ verified: true, issues: [] });
    expect(result.entries[0].required_requisite_clause.raw).toBe('CSC 121');
  });

  it('retains display-wrapped text through the terminal structured field boundary', () => {
    const result = extractShenandoahCourseEntry(page({
      code: 'MATH 102',
      title: 'Precalculus',
      requisite: 'Math 101 or assignment<br> through the Math Placement Test.',
    }), 'MATH102', { finalUrl: expectedCourseUrl('MATH102') });
    expect(result).toMatchObject({ verified: true, issues: [] });
    expect(result.entries[0].required_requisite_clause).toMatchObject({
      raw: 'Math 101 or assignment through the Math Placement Test.',
      boundary_terminal: 'closing_p_after_unique_terminal_prerequisite_parenthetical_marker',
    });
  });

  it('fails closed on URL, catalog, coid, title, credits, heading, or clause-boundary drift', () => {
    expect(extractShenandoahCourseEntry(page(), 'CSC122', {
      finalUrl: 'https://catalog.su.edu/preview_course_nopop.php?catoid=33&coid=1',
    }).issues).toContain('course_url_identity');
    expect(extractShenandoahCourseEntry(
      page().replace('2025-2026 Undergraduate Catalog', '2026-2027 Undergraduate Catalog'),
      'CSC122', { finalUrl: expectedCourseUrl('CSC122') },
    ).issues).toContain('catalog_label');
    expect(extractShenandoahCourseEntry(page({ title: 'Changed' }), 'CSC122', {
      finalUrl: expectedCourseUrl('CSC122'),
    }).issues).toContain('exact_course_title');
    expect(extractShenandoahCourseEntry(page({ credits: 'variable' }), 'CSC122', {
      finalUrl: expectedCourseUrl('CSC122'),
    }).issues).toContain('published_credits');
    expect(extractShenandoahCourseEntry(page({
      extra: '<h1 id="course_preview_title">CSC 122 Introduction to Computer Programming II</h1>',
    }), 'CSC122', { finalUrl: expectedCourseUrl('CSC122') }).issues)
      .toContain('unique_exact_course_heading');
    const duplicateMarker = page({
      extra: 'Prerequisite(s): CSC 210<br>',
    });
    expect(extractShenandoahCourseEntry(duplicateMarker, 'CSC122', {
      finalUrl: expectedCourseUrl('CSC122'),
    }).issues).toContain('unique_structured_prerequisite_marker');
    expect(extractShenandoahCourseEntry(page({
      requisite: null,
      extra: 'Prerequisite(s): Earned grade of “C-” or better in CSC-121<br>',
    }), 'CSC122', {
      finalUrl: expectedCourseUrl('CSC122'),
    }).issues).toContain('structured_prerequisite_closing_p_boundary');
  });

  it('detects any retained discovery byte or exact-coid mutation', () => {
    expect(verifyShenandoahProgramDiscovery(`${programHtml} `, ['CSC122']).issues)
      .toContain('program_html_sha256');
    const tampered = programHtml.replace("showCourse('33', '55149'", "showCourse('33', '1'");
    expect(verifyShenandoahProgramDiscovery(tampered, ['CSC122']).issues)
      .toEqual(expect.arrayContaining(['program_html_sha256', 'CSC122:program_link_identity']));
  });
});
