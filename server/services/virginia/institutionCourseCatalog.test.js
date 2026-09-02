import { describe, expect, it } from 'vitest';
import { institutionCourseIdentity, sharedCourseIdentity } from './courseIdentity';
import {
  documentCourseCatalog,
  institutionCourseCatalog,
} from './institutionCourseCatalog';

const owner = 'va:cc:richard-bland-college';
const namespace = {
  kind: 'institution_local',
  institution_id: owner,
  vccs_master_applicable: false,
  identity_contract: 'owner_plus_course_id',
  scoped_key_format: `${owner}:<code>`,
};
const option = (...codes) => ({
  course_ids: codes.map((code) => institutionCourseIdentity(owner, code).course_id),
  course_keys: codes.map((code) => institutionCourseIdentity(owner, code).course_key),
});
const sharedOption = (...codes) => ({
  course_ids: codes.map((code) => sharedCourseIdentity(code).course_id),
  course_keys: codes.map((code) => sharedCourseIdentity(code).course_key),
});

describe('Virginia institution-local course catalog', () => {
  it('takes units only from an unambiguous single-course source section', () => {
    const rows = institutionCourseCatalog({
      codes: ['MATH251', 'CSCI222', 'MATH254'],
      courseTitles: {
        MATH251: 'Calculus I', CSCI222: 'Programming II', MATH254: 'Discrete Mathematics',
      },
      namespace,
      requirementGroups: [{ source_refs: ['major'], sections: [
        {
          section_advisement: 1, unit_advisement: 4, unit_advisement_max: 4,
          source_refs: ['major'], receivers: [{ options: [option('MATH251')] }],
        },
        {
          section_advisement: 1, unit_advisement: 7, unit_advisement_max: 8,
          source_refs: ['major'], receivers: [{ options: [option('CSCI222', 'MATH254')] }],
        },
      ] }],
    });
    expect(rows.find((row) => row.code === 'MATH251')).toMatchObject({
      title: 'Calculus I', units: 4, min_units: 4, max_units: 4,
      unit_evidence: 'single_course_source_section', source_refs: ['major'],
    });
    expect(rows.find((row) => row.code === 'MATH254')).toMatchObject({
      units: null, unit_evidence: 'not_individually_stated',
    });
  });

  it('does not emit local rows without an explicit local namespace', () => {
    expect(institutionCourseCatalog({ codes: ['CSC221'] })).toEqual([]);
  });
});

describe('Virginia document-named course catalog', () => {
  it('uses explicit per-course evidence without dividing a bundled route', () => {
    const rows = documentCourseCatalog({
      codes: ['CSCI222', 'MATH254'],
      courseTitles: { CSCI222: 'Programming II', MATH254: 'Linear Algebra' },
      requirementGroups: [{ source_refs: ['major'], sections: [{
        section_advisement: 1,
        unit_advisement: 7,
        source_refs: ['major'],
        receivers: [{ options: [sharedOption('CSCI222', 'MATH254')] }],
      }] }],
      unitEvidence: [
        { code: 'CSCI222', units: 4, source_refs: ['major'] },
        { code: 'MATH254', units: 3, source_refs: ['major'] },
      ],
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CSCI222', units: 4, unit_evidence: 'single_course_source_section',
      }),
      expect.objectContaining({
        code: 'MATH254', units: 3, unit_evidence: 'single_course_source_section',
      }),
    ]));
  });

  it('prefers an explicit course-credit row over a variable-credit requirement menu', () => {
    const rows = documentCourseCatalog({
      codes: ['MTH283'],
      courseTitles: { MTH283: 'Probability and Statistics' },
      requirementGroups: [{ source_refs: ['major'], sections: [{
        section_advisement: 1,
        unit_advisement: 3,
        unit_advisement_max: 4,
        receivers: [{ options: [sharedOption('MTH283')] }],
      }] }],
      unitEvidence: [{
        code: 'MTH283', units: 3, source_refs: ['general_education'],
      }],
    });

    expect(rows).toEqual([expect.objectContaining({
      code: 'MTH283',
      units: 3,
      min_units: 3,
      max_units: 3,
      unit_evidence: 'single_course_source_section',
      unit_observations: [3],
      unit_max_observations: [3],
      source_refs: ['general_education', 'major'],
    })]);
  });

  it('does not copy a requirement-slot total onto every alternative course', () => {
    const rows = documentCourseCatalog({
      codes: ['MTH245', 'MTH264'],
      courseTitles: { MTH245: 'Statistics I', MTH264: 'Calculus II' },
      requirementGroups: [{ source_refs: ['major'], sections: [{
        section_advisement: 1,
        unit_advisement: 4,
        unit_advisement_max: 4,
        receivers: [{ options: [sharedOption('MTH264'), sharedOption('MTH245')] }],
      }] }],
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'MTH245', units: null, unit_evidence: 'not_individually_stated',
      }),
      expect.objectContaining({
        code: 'MTH264', units: null, unit_evidence: 'not_individually_stated',
      }),
    ]));
  });

  it('emits a source-backed VCCS identity when the transfer registry has no course row', () => {
    const rows = documentCourseCatalog({
      codes: ['MTH283'],
      courseTitles: { MTH283: 'Probability and Statistics' },
      requirementOwnerId: 'va:cc:northern-virginia-community-college',
      sourceDocumentId: 'va:as:northern-virginia-community-college:cs',
      sourceRefs: ['major'],
      requirementGroups: [{ source_refs: ['major'], sections: [{
        section_advisement: 1,
        unit_advisement: 3,
        // A missing max is not numeric zero; it safely falls back to the
        // section minimum for this one-course source statement.
        unit_advisement_max: null,
        source_refs: ['major'],
        receivers: [{ options: [sharedOption('MTH283')] }],
      }] }],
    });

    expect(rows).toEqual([expect.objectContaining({
      code: 'MTH283',
      course_id: sharedCourseIdentity('MTH283').course_id,
      course_key: 'va:MTH283',
      institution_id: 'va:vccs',
      identity_scope: 'vccs_shared',
      identity_contract: 'vccs_master_course_code',
      vccs_master_applicable: true,
      requirement_owner_id: 'va:cc:northern-virginia-community-college',
      source_document_id: 'va:as:northern-virginia-community-college:cs',
      identity_source: 'degree_document',
      title: 'Probability and Statistics',
      units: 3,
      min_units: 3,
      max_units: 3,
      unit_evidence: 'single_course_source_section',
      unit_observations: [3],
      unit_max_observations: [3],
      source_refs: ['major'],
    })]);
  });

  it('keeps conflicting source-section units unresolved for a shared course', () => {
    const result = documentCourseCatalog({
      codes: ['CSC221'],
      courseTitles: { CSC221: 'Introduction to Problem Solving and Programming' },
      requirementOwnerId: 'va:cc:example-community-college',
      requirementGroups: [
        { source_refs: ['major'], sections: [{
          section_advisement: 1, unit_advisement: 3, unit_advisement_max: 3,
          receivers: [{ options: [sharedOption('CSC221')] }],
        }] },
        { source_refs: ['alternate'], sections: [{
          section_advisement: 1, unit_advisement: 4, unit_advisement_max: 4,
          receivers: [{ options: [sharedOption('CSC221')] }],
        }] },
      ],
    });

    expect(result).toEqual([expect.objectContaining({
      code: 'CSC221',
      units: null,
      min_units: null,
      max_units: null,
      unit_evidence: 'conflicting_source_sections',
      unit_observations: [3, 4],
      unit_max_observations: [3, 4],
      source_refs: ['alternate', 'major'],
    })]);
  });
});
