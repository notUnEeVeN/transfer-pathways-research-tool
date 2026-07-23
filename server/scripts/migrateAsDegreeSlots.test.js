import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { planMigration } = cjs('./migrateAsDegreeSlots');

const degree = (legacyId, degreeType) => ({
  _id: `as_degree:${legacyId}`, legacy_id: legacyId, kind: 'as_degree',
  community_college_id: 110, college_id: 'cc:110', degree_type: degreeType,
});

describe('planMigration', () => {
  it('rewrites each legacy type onto its slot under the cs major', () => {
    const plan = planMigration([
      degree('110:ast', 'ast'),
      degree('110:local_cs_as', 'local_cs_as'),
      degree('110:local_computing', 'local_computing'),
    ], []);
    expect(plan.degrees.map((d) => [d.from, d.to])).toEqual([
      ['as_degree:110:ast', 'as_degree:110:cs:ast'],
      ['as_degree:110:local_cs_as', 'as_degree:110:cs:local_as'],
      ['as_degree:110:local_computing', 'as_degree:110:cs:local_other'],
    ]);
    expect(plan.degrees[1].doc.degree_type).toBe('local_as');
    expect(plan.degrees[1].doc.major_slug).toBe('cs');
    expect(plan.degrees[1].doc.legacy_id).toBe('110:cs:local_as');
  });

  it('is idempotent — an already-migrated row is left alone', () => {
    const plan = planMigration([
      { _id: 'as_degree:110:cs:ast', legacy_id: '110:cs:ast', kind: 'as_degree',
        community_college_id: 110, college_id: 'cc:110',
        degree_type: 'ast', major_slug: 'cs' },
    ], []);
    expect(plan.degrees).toEqual([]);
    expect(plan.alreadyMigrated).toBe(1);
  });

  it('rewrites template degree_type in place without changing template ids', () => {
    const plan = planMigration([], [
      { _id: 'as_degree_template:cs_local', slug: 'cs_local', degree_type: 'local_cs_as' },
      { _id: 'as_degree_template:cs_ast', slug: 'cs_ast', degree_type: 'ast' },
    ]);
    expect(plan.templates).toEqual([
      { _id: 'as_degree_template:cs_local', degree_type: 'local_as', major_slug: 'cs' },
      { _id: 'as_degree_template:cs_ast', degree_type: 'ast', major_slug: 'cs' },
    ]);
  });

  it('throws on an unrecognised legacy type rather than guessing', () => {
    expect(() => planMigration([degree('110:mystery', 'mystery')], []))
      .toThrow(/unrecognised degree_type: mystery/);
  });
});
