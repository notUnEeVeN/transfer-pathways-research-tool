import { describe, expect, it } from 'vitest';
import {
  extractLongwoodBannerEntries,
} from './longwoodBannerCourseAcquisition';

const page = (entries) => `<!doctype html><html><head>
  <link rel="canonical" href="https://www.longwood.edu/site-assets/courses-from-banner/">
  </head><body><main>${entries}</main></body></html>`;
const entry = (code, title, description) => `<div class="course-listing-fade">
  <p><strong>${code}</strong>. ${title}</p>
  <p><span class="trunccourse">${description}</span></p></div>`;

describe('Longwood first-party Banner course acquisition', () => {
  it('binds exact unique entries while preserving prerequisite silence', () => {
    const result = extractLongwoodBannerEntries(page([
      entry('ENGL165', 'Writing and Research', 'A writing course. 3 credits.'),
      entry('ENGL319', 'Technical Writing', 'Prerequisite: ENGL 165. 3 credits.'),
      entry('MATH250', 'Introduction to Linear Algebra', 'Prerequisites: MATH 175 or MATH 261. 3 credits.'),
      entry('MATH261', 'Calculus I', 'Prerequisite: MATH 164 with a C- or better. 4 credits.'),
    ].join('')), ['ENGL165', 'ENGL319', 'MATH250', 'MATH261']);
    expect(result).toMatchObject({ verified: true, issues: [], missing: [] });
    expect(result.entries[0].raw_entry_text).toBe(
      'ENGL165. Writing and Research A writing course. 3 credits.',
    );
    expect(result.entries[0].raw_entry_text).not.toMatch(/prerequisite/i);
    expect(result.entries[2].published_units).toMatchObject({
      kind: 'published_fixed_credits', credit_hours_min: 3, credit_hours_max: 3,
    });
  });

  it('fails closed on duplicate entries, missing units, and page identity drift', () => {
    const duplicate = entry('MATH250', 'One', 'Prerequisite: MATH 175. 3 credits.')
      + entry('MATH250', 'Two', 'Prerequisite: MATH 261. 3 credits.');
    expect(extractLongwoodBannerEntries(page(duplicate), ['MATH250']))
      .toMatchObject({ verified: false, missing: ['MATH250'] });
    expect(extractLongwoodBannerEntries(
      page(entry('MATH250', 'One', 'Prerequisite: MATH 175.')), ['MATH250'],
    )).toMatchObject({ verified: false, missing: ['MATH250'] });
    expect(extractLongwoodBannerEntries(
      page(entry('MATH250', 'One', 'Prerequisite: MATH 175. 3 credits.'))
        .replace('/site-assets/courses-from-banner/', '/site-assets/other/'),
      ['MATH250'],
    )).toMatchObject({ verified: false, issues: ['canonical_banner_path'] });
  });

  it('bounds the four deterministic resident Perspective entries without inferring formulas', () => {
    const result = extractLongwoodBannerEntries(page([
      entry('MATH301', 'Applied Statistics', 'Prerequisites: MATH 171 with a grade of C- or better and completion of FHBS pillar. 3 credits.'),
      entry('PSYC335', 'Psychology of Belief', 'Pre-requisites: Completion of FHBS pillar. 3 credits.'),
      entry('RELI301', 'Elements of World Religion', 'Pre-requisites: Completion of FGLO Pillar. 3 credits.'),
      entry('SPAN320', 'Integrated Inquiry Cult & Lang', 'Prerequisite: SPAN 212 or an appropriate placement score. 3 credits.'),
    ].join('')), ['MATH301', 'PSYC335', 'RELI301', 'SPAN320']);
    expect(result).toMatchObject({ verified: true, issues: [], missing: [] });
    expect(result.entries.map((row) => row.course_code)).toEqual([
      'MATH301', 'PSYC335', 'RELI301', 'SPAN320',
    ]);
    expect(result.entries.every((row) => row.published_units.credit_hours_min === 3))
      .toBe(true);
  });
});
