import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const cjs = createRequire(import.meta.url);
const { toDoc } = cjs('./importVirginiaCourses');
const { courseIdFor } = cjs('../services/virginia/courseIdentity');

describe('Virginia course importer identities', () => {
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
});
