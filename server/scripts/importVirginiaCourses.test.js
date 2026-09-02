import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const cjs = createRequire(import.meta.url);
const { isVccsSharedInstitution, optionsFrom, toDoc } = cjs('./importVirginiaCourses');
const { courseIdFor } = cjs('../services/virginia/courseIdentity');

describe('Virginia course importer identities', () => {
  it('is dry-run by default and requires one explicit apply flag for Mongo writes', () => {
    expect(optionsFrom([], {})).toMatchObject({ apply: false, dryRun: true });
    expect(optionsFrom([
      '--apply', '--uri', 'mongodb://example.test:27017', '--db', 'va_target',
    ], { MONGO_URI: 'mongodb://environment.test:27017', DB_NAME: 'environment_target' }))
      .toMatchObject({
        apply: true,
        dryRun: false,
        uri: 'mongodb://example.test:27017',
        dbName: 'va_target',
      });
    expect(() => optionsFrom(['--apply', '--dry-run'], {})).toThrow(/mutually exclusive/);
    expect(() => optionsFrom(['--aply'], {})).toThrow(/unknown option/);
  });

  it('preserves multiple receiving courses at one university without duplicate renderings', () => {
    const doc = toDoc('ENV121', [{
      institution: 'Sample Community College',
      guid: 'first',
      source_url: 'https://example.test/ENV121',
      title: 'General Environmental Science I',
      credits: 4,
      credits_raw: '4',
      department: 'Environmental Science',
      description: null,
      equivalencies: [
        {
          level: 'four_year', institution: 'George Mason University',
          // Deliberately reverse lexical order: source order controls the
          // backward-compatible first landing.
          identifier: 'EVPP 109', name: 'Ecosphere II', notes: null,
        },
        {
          level: 'four_year', institution: 'George Mason University',
          identifier: 'EVPP 108', name: 'Ecosphere I', notes: null,
        },
      ],
    }, {
      institution: 'Another Community College',
      guid: 'second',
      source_url: 'https://example.test/ENV121/second',
      title: 'General Environmental Science I',
      credits: 4,
      credits_raw: '4',
      department: 'Environmental Science',
      description: null,
      equivalencies: [{
        // The same target printed without a separator is a duplicate, not a
        // third receiving course.
        level: 'four_year', institution: 'George Mason University',
        identifier: 'EVPP109', name: 'Ecosphere Two', notes: null,
      }],
    }]);

    expect(doc).toMatchObject({
      course_id: courseIdFor('ENV121'),
      course_key: 'va:ENV121',
      institution_id: 'va:vccs',
      identity_scope: 'vccs_shared',
      identity_contract: 'vccs_master_course_code',
      vccs_master_applicable: true,
      sending_eligible: true,
      offered_by: ['Another Community College', 'Sample Community College'],
      counts: { offered_by: 2, four_year: 1, four_year_targets: 2 },
    });
    expect(doc.articulates_to).toEqual([
      expect.objectContaining({
        institution: 'George Mason University',
        identifier: 'EVPP 109',
        parent_id: courseIdFor('EVPP109'),
      }),
      expect.objectContaining({
        institution: 'George Mason University',
        identifier: 'EVPP 108',
        parent_id: courseIdFor('EVPP108'),
      }),
    ]);
  });

  it('does not promote a same-code four-year or Richard Bland page into VCCS supply', () => {
    const parsed = [{
      institution: 'James Madison University',
      guid: 'jmu-math251',
      source_url: 'https://example.test/jmu/MATH251',
      title: 'Database Queries',
      credits: 3,
      credits_raw: '3',
      department: 'Mathematics and Statistics',
      description: null,
      equivalencies: [{
        level: 'two_year', institution: 'Richard Bland College',
        identifier: 'MATH251', name: 'Calculus I', notes: null,
      }],
    }];

    const doc = toDoc('MATH251', parsed);
    expect(doc).toMatchObject({
      code: 'MATH251',
      title: 'Database Queries',
      sending_eligible: false,
      offered_by: [],
      articulates_to: [],
      vccs_renderings: [],
      excluded_identity_evidence: expect.arrayContaining([
        expect.objectContaining({
          institution: 'James Madison University',
          reason: 'four_year_same_code_is_not_vccs_identity',
        }),
        expect.objectContaining({
          institution: 'Richard Bland College',
          reason: 'institution_local_namespace',
        }),
      ]),
    });
  });

  it('keeps mixed code evidence shared only for actual VCCS institutions', () => {
    const doc = toDoc('CSC221', [{
      institution: 'Blue Ridge Community College',
      guid: 'blue-ridge-csc221',
      source_url: 'https://example.test/vccs/CSC221',
      title: 'Introduction to Problem Solving and Programming',
      credits: 3,
      credits_raw: '3',
      department: 'Computer Science',
      description: null,
      equivalencies: [
        {
          level: 'two_year', institution: 'Richard Bland College',
          identifier: 'CSC221', name: 'Computer Programming I', notes: null,
        },
        {
          level: 'two_year', institution: 'Northern Virginia Community College',
          identifier: 'CSC221', name: 'Introduction to Problem Solving and Programming', notes: null,
        },
      ],
    }]);

    expect(doc.sending_eligible).toBe(true);
    expect(doc.offered_by).toEqual([
      'Blue Ridge Community College', 'Northern Virginia Community College',
    ]);
    expect(doc.offered_by).not.toContain('Richard Bland College');
    expect(isVccsSharedInstitution('Richard Bland College')).toBe(false);
  });
});
