import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMajor } from '../../config/majors';
import {
  ACTIVE_UNIVERSITY_COHORT,
  validateUniversityPrerequisiteScope,
} from './universityPrerequisiteScope';
import { requiredUniversityCourseKeys } from './pathwayComplexityPrerequisites';

const artifact = JSON.parse(fs.readFileSync(
  new URL('../../.va-catalogs/research/va-university-prerequisite-scope.json', import.meta.url),
  'utf8',
));

describe('checked-in Virginia university prerequisite collection scope', () => {
  it('is internally complete, owner-scoped, and deliberately fail-closed', () => {
    expect(validateUniversityPrerequisiteScope(artifact)).toEqual({ valid: true, issues: [] });
    expect(artifact.summary).toMatchObject({
      active_universities: 16,
      direct_named_courses: 843,
      deterministic_resident_path_courses: 7,
      required_resident_path_courses: 850,
      checked_in_owner_scoped_rows: 0,
      recursive_closure_courses: null,
    });
    expect(artifact.publication_ready).toBe(false);
    expect(requiredUniversityCourseKeys(artifact)).toHaveLength(850);
    expect(artifact.universities.find((row) => row.slug === 'longwood-university'))
      .toMatchObject({
        deterministic_resident_path_course_count: 7,
        deterministic_resident_path_course_codes: [
          'CMSC360', 'CMSC415', 'CMSC455', 'MATH301', 'PSYC335', 'RELI301', 'SPAN320',
        ],
      });
    expect(new Set(requiredUniversityCourseKeys(artifact).map((key) => (
      key.split(':').slice(0, 3).join(':')
    )))).toEqual(new Set(ACTIVE_UNIVERSITY_COHORT.map((row) => `va:uni:${row.school_id}`)));
  });

  it('covers exactly the configured 16-university Virginia agreement cohort', () => {
    expect(ACTIVE_UNIVERSITY_COHORT.map((row) => String(row.school_id)).sort())
      .toEqual(Object.keys(getMajor('va-cs').programs).sort());
  });
});
