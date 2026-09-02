import { describe, expect, it } from 'vitest';
import {
  canonicalCourseCode,
  courseIdFor,
  courseKeyFor,
  courseIdentityForNamespace,
  courseRowMatchesIdentity,
  institutionCourseIdentity,
  institutionCourseIdFor,
  institutionCourseKeyFor,
  parentIdForLanding,
  parseCourseKey,
  sharedCourseIdentity,
} from './courseIdentity';

const RBC = 'va:cc:richard-bland-college';

describe('Virginia course identities', () => {
  it('preserves the existing deterministic ids', () => {
    expect(courseIdFor('CSC221')).toBe(1059498355);
    expect(courseIdFor('CS108')).toBe(1144834976);
    expect(courseIdFor('ITE119')).toBe(1091780518);
    expect(canonicalCourseCode('ITE119')).toBe('ITE119');
  });

  it('normalizes printed separators before minting an id', () => {
    expect(canonicalCourseCode('cs - 108')).toBe('CS108');
    expect(courseIdFor('CS 108')).toBe(courseIdFor('CS108'));
    expect(courseKeyFor('CS 108')).toBe('va:CS108');
  });

  it('supports concrete catalog courses with a two-letter suffix', () => {
    expect(canonicalCourseCode('CIS 231WX')).toBe('CIS231WX');
    expect(courseIdFor('CIS 231WX')).toBeTypeOf('number');
    expect(courseKeyFor('CIS 231WX')).toBe('va:CIS231WX');
  });

  it.each(['MATH251', 'PHYS201', 'PHYS202'])(
    'separates Richard Bland %s from a same-code VCCS or university course',
    (code) => {
      const local = institutionCourseIdentity(RBC, code);
      const shared = sharedCourseIdentity(code);
      expect(local).toMatchObject({
        code,
        course_id: institutionCourseIdFor(RBC, code),
        course_key: institutionCourseKeyFor(RBC, code),
        institution_id: RBC,
        identity_scope: 'institution_local',
        identity_contract: 'owner_plus_course_id',
        vccs_master_applicable: false,
      });
      expect(local.course_id).not.toBe(shared.course_id);
      expect(local.course_key).not.toBe(shared.course_key);
      expect(parseCourseKey(local.course_key)).toEqual(local);
      expect(parseCourseKey(shared.course_key)).toEqual(shared);
    },
  );

  it('resolves a namespace explicitly and requires matching row ownership', () => {
    const namespace = {
      kind: 'institution_local',
      institution_id: RBC,
      vccs_master_applicable: false,
      identity_contract: 'owner_plus_course_id',
      scoped_key_format: `${RBC}:<code>`,
    };
    const local = courseIdentityForNamespace('MATH251', namespace);
    expect(courseRowMatchesIdentity(local, local)).toBe(true);
    expect(courseRowMatchesIdentity({
      ...local,
      institution_id: 'va:uni:james-madison-university',
      title: 'Database Queries',
    }, local)).toBe(false);
    expect(courseRowMatchesIdentity(sharedCourseIdentity('MATH251'), local)).toBe(false);
  });

  it.each(['TRNS1XX', 'MATHElective', 'CS----', 'PE118+', 'XXXX0000', 'ELEC000']) (
    'does not mint an id for the non-course target %s',
    (identifier) => {
      expect(courseIdFor(identifier)).toBeNull();
      expect(courseKeyFor(identifier)).toBeNull();
    },
  );

  it('does not expose course-shaped transfer and elective buckets as parent ids', () => {
    expect(parentIdForLanding({ identifier: 'ART900', name: 'Art Elective (TR)' })).toBeNull();
    expect(parentIdForLanding({ identifier: 'ACC200T', name: 'Transfer Accounting Course' })).toBeNull();
    expect(parentIdForLanding({ identifier: 'GENED100', name: 'General Education' })).toBeNull();
    expect(parentIdForLanding({ identifier: 'NOCR999', name: 'No Credit' })).toBeNull();
    expect(parentIdForLanding({ identifier: 'CSCI020', name: 'Collegiate Credit Only' })).toBeNull();
    expect(parentIdForLanding({ identifier: 'CSCI040', name: 'Major Credit Only' })).toBeNull();
    expect(parentIdForLanding({ identifier: 'CS108', name: 'Introduction to Computing' }))
      .toBe(1144834976);
  });
});
