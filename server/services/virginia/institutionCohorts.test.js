import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  EXTERNAL_RECEIVER_COHORT_ID,
  OTHER_FOUR_YEAR_COHORT_ID,
  PRIMARY_COHORT_ID,
  canonicalInstitutionIdentity,
  cohortSummary,
  mergeInstitutionRows,
  sourceNamesForInstitution,
} = require('./institutionCohorts');

describe('Virginia institution cohorts', () => {
  it('defines the exact 15-school SCHEV public cohort', () => {
    expect(cohortSummary()[PRIMARY_COHORT_ID]).toMatchObject({
      institution_count: 15,
      primary: true,
      authority: 'State Council of Higher Education for Virginia',
    });

    const rows = mergeInstitutionRows([]);
    expect(rows).toHaveLength(15);
    expect(rows.every((row) => row.cohort === PRIMARY_COHORT_ID)).toBe(true);
    expect(rows.map((row) => row.name)).toContain('University of Virginia');
    expect(rows.map((row) => row.name)).toContain('Virginia Military Institute');
    const refreshed = mergeInstitutionRows(rows);
    expect(refreshed.find((row) => row.name === 'University of Virginia')).toMatchObject({
      corpus_present: false, course_count: 0, receives_count: 0,
    });
  });

  it('canonicalizes public and rename aliases without duplicate rows', () => {
    const rows = mergeInstitutionRows([
      { _id: 'va:inst:virginia-tech', name: 'Virginia Tech', level: 'four_year', receives_count: 2 },
      {
        _id: 'va:inst:virginia-polytechnic-institute-and-state-university',
        name: 'Virginia Polytechnic Institute and State University', level: 'four_year', receives_count: 3,
      },
      { _id: 'va:inst:batten-university', name: 'Batten University', level: 'four_year', receives_count: 4 },
      {
        _id: 'va:inst:virginia-wesleyan-university',
        name: 'Virginia Wesleyan University', level: 'four_year', receives_count: 5,
      },
    ]);

    const tech = rows.filter((row) => row.institution_slug
      === 'virginia-polytechnic-institute-and-state-university');
    expect(tech).toHaveLength(1);
    expect(tech[0]).toMatchObject({
      cohort: PRIMARY_COHORT_ID,
      receives_count: 5,
      corpus_alias_rows: 2,
    });
    expect(tech[0].source_names).toEqual(expect.arrayContaining([
      'Virginia Tech', 'Virginia Polytechnic Institute and State University',
    ]));

    const wesleyan = rows.filter((row) => row.institution_slug === 'virginia-wesleyan-university');
    expect(wesleyan).toHaveLength(1);
    expect(wesleyan[0]).toMatchObject({ cohort: OTHER_FOUR_YEAR_COHORT_ID, receives_count: 9 });
  });

  it('keeps external receivers unscoped instead of calling them Virginia private schools', () => {
    const [external] = mergeInstitutionRows([
      { _id: 'va:inst:george-washington-university', name: 'George Washington University', level: 'four_year' },
    ], { includePrimaryMissing: false });
    expect(external.cohort).toBe(EXTERNAL_RECEIVER_COHORT_ID);
    expect(external.registry_present).toBe(false);
  });

  it('resolves public display aliases to one owner and all corpus source names', () => {
    expect(canonicalInstitutionIdentity('UVA Wise')).toMatchObject({
      slug: 'the-university-of-virginia-s-college-at-wise',
      name: "The University of Virginia's College at Wise",
    });
    expect(sourceNamesForInstitution('Virginia Tech')).toEqual(expect.arrayContaining([
      'Virginia Polytechnic Institute and State University', 'Virginia Tech',
    ]));
  });
});
