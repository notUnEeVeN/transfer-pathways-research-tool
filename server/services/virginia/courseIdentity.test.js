import { describe, expect, it } from 'vitest';
import {
  canonicalCourseCode, courseIdFor, courseKeyFor, parentIdForLanding,
} from './courseIdentity';

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
