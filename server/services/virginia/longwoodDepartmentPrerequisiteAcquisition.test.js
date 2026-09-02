import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractLongwoodComputerScienceEntries,
  publishedCredits,
  verifyLongwoodCatalogContext,
} from './longwoodDepartmentPrerequisiteAcquisition';

const page = (entries) => `<!doctype html><html><head>
  <link rel="canonical" href="https://www.longwood.edu/mathematics/../computerscience/computer-science-course-listing/">
  </head><body><main><h1>Computer Science Course Listing</h1>
  <h2>Computer Science Courses</h2>${entries}</main></body></html>`;
const entry = (code, title, description) => `<div class="course-listing-fade">
  <p><strong>${code}</strong>. ${title}</p>
  <p><span class="trunccourse">${description}</span></p></div>`;

describe('Longwood first-party department prerequisite acquisition', () => {
  it('binds unique full entries and retains fixed, variable, and zero credits', () => {
    const html = page([
      entry('CMSC160', 'Intro Algorithmic Design I', 'Corequisite: CMSC 161. 4 credits.'),
      entry('CMSC283', 'Exper Learn Sem CMSC I', 'Pre-requisite: Sophomore standing or higher. 0 credits.'),
      entry('CMSC292', 'Internship', 'Field experience. 1-18 credits.'),
    ].join(''));
    const result = extractLongwoodComputerScienceEntries(
      html, ['CMSC160', 'CMSC283', 'CMSC292'],
    );
    expect(result).toMatchObject({ verified: true, issues: [], missing: [] });
    expect(result.entries.map((row) => row.published_units)).toEqual([
      expect.objectContaining({
        kind: 'published_fixed_credits', credit_hours_min: 4, credit_hours_max: 4,
      }),
      expect.objectContaining({
        kind: 'published_fixed_credits', credit_hours_min: 0, credit_hours_max: 0,
      }),
      expect.objectContaining({
        kind: 'published_variable_credits', credit_hours_min: 1, credit_hours_max: 18,
      }),
    ]);
    expect(result.entries[0].raw_entry_text).toBe(
      'CMSC160. Intro Algorithmic Design I Corequisite: CMSC 161. 4 credits.',
    );
  });

  it('fails closed on duplicate codes, missing credits, and page identity drift', () => {
    const duplicate = entry('CMSC160', 'One', 'Corequisite: CMSC 161. 4 credits.')
      + entry('CMSC160', 'Two', 'Corequisite: CMSC 161. 4 credits.');
    expect(extractLongwoodComputerScienceEntries(page(duplicate), ['CMSC160']))
      .toMatchObject({ verified: false, missing: ['CMSC160'] });
    expect(extractLongwoodComputerScienceEntries(
      page(entry('CMSC160', 'One', 'Corequisite: CMSC 161.')), ['CMSC160'],
    )).toMatchObject({ verified: false, missing: ['CMSC160'] });
    expect(extractLongwoodComputerScienceEntries(
      page(entry('CMSC160', 'One', 'Corequisite: CMSC 161. 4 credits.'))
        .replace('computer-science-course-listing/', 'other/'),
      ['CMSC160'],
    )).toMatchObject({ verified: false, issues: ['canonical_department_path'] });
  });

  it('does not mistake multiple credit phrases for one published unit field', () => {
    expect(publishedCredits('May transfer 3 credits; this course is 4 credits.')).toBeNull();
  });

  it('proves the retained Acalog catalog year/catoid context independently', () => {
    const retained = fs.readFileSync(
      new URL('../../.va-catalogs/pages/longwood-university__course_catalog.html', import.meta.url),
      'utf8',
    );
    expect(verifyLongwoodCatalogContext(retained, '2026-2027', 19)).toMatchObject({
      verified: true,
      issues: [],
      catalog_year: '2026-2027',
      catoid: 19,
      relevant_context_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(verifyLongwoodCatalogContext(retained, '2025-2026', 19).verified).toBe(false);
    expect(verifyLongwoodCatalogContext(retained, '2026-2027', 17).verified).toBe(false);
  });
});
