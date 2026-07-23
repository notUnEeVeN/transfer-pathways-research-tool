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

  it('leaves an already-migrated template alone, so a second apply is a no-op', () => {
    const migrated = [
      { _id: 'as_degree_template:cs_local', slug: 'cs_local', degree_type: 'local_as', major_slug: 'cs' },
      { _id: 'as_degree_template:cs_ast', slug: 'cs_ast', degree_type: 'ast', major_slug: 'cs' },
    ];
    const plan = planMigration([], migrated);
    expect(plan.templates).toEqual([]);
  });

  it('stamps the major on a template with no degree_type instead of aborting', () => {
    const plan = planMigration([degree('110:ast', 'ast')], [
      { _id: 'as_degree_template:cs', slug: 'cs' },
    ]);
    expect(plan.templates).toEqual([{ _id: 'as_degree_template:cs', major_slug: 'cs' }]);
    // the abort used to take the degree rows down with it
    expect(plan.degrees).toHaveLength(1);
  });

  it('still throws on a template whose degree_type is a real unknown value', () => {
    expect(() => planMigration([], [
      { _id: 'as_degree_template:x', slug: 'x', degree_type: 'mystery' },
    ])).toThrow(/unrecognised template degree_type: mystery/);
  });

  it('refuses a row whose community_college_id disagrees with its legacy_id', () => {
    const bad = { ...degree('110:ast', 'ast'), community_college_id: 999 };
    expect(() => planMigration([bad], []))
      .toThrow(/college id disagreement on as_degree:110:ast/);
  });

  it('refuses a row whose college_id disagrees with its legacy_id', () => {
    const bad = { ...degree('110:ast', 'ast'), college_id: 'cc:999' };
    expect(() => planMigration([bad], [])).toThrow(/college id disagreement/);
  });

  it('refuses a row with a missing or non-numeric community_college_id', () => {
    const missing = { ...degree('110:ast', 'ast') };
    delete missing.community_college_id;
    expect(() => planMigration([missing], []))
      .toThrow(/community_college_id is not a number/);
    expect(() => planMigration([{ ...degree('110:ast', 'ast'), community_college_id: 'abc' }], []))
      .toThrow(/community_college_id is not a number/);
  });

  it('rewrites a row that carries major_slug but a stale two-segment id', () => {
    const stale = { ...degree('110:local_cs_as', 'local_cs_as'), major_slug: 'cs' };
    const plan = planMigration([stale], []);
    expect(plan.alreadyMigrated).toBe(0);
    expect(plan.degrees.map((d) => [d.from, d.to])).toEqual([
      ['as_degree:110:local_cs_as', 'as_degree:110:cs:local_as'],
    ]);
    expect(plan.degrees[0].doc.legacy_id).toBe('110:cs:local_as');
    expect(plan.degrees[0].doc.degree_type).toBe('local_as');
  });
});
