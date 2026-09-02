import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  stampDegreeCategories,
  stripStamps,
} from './normalizeDegreeCategories';

describe('pure degree category stamping', () => {
  it('adds the shared taxonomy without changing source-authored fields', () => {
    const degree = {
      _id: 'va:degree:test',
      requirement_groups: [
        {
          title: 'Major requirements',
          source_refs: ['catalog'],
          sections: [{
            requirement_kind: 'unit-accounting',
            unit_advisement: 3,
            receivers: [],
          }],
        },
        {
          title: 'Elective credits to reach the 120-credit total',
          units_fill: true,
          sections: [{ unit_advisement: 6, receivers: [] }],
        },
      ],
    };
    const before = structuredClone(degree);

    const result = stampDegreeCategories(degree);

    expect(degree).toEqual(before);
    expect(stripStamps(result.doc)).toEqual(before);
    expect(result.doc.requirement_groups.map((group) => group.category)).toEqual([
      'unit-accounting', 'electives',
    ]);
    expect(result.doc.requirement_groups[0].sections[0].category).toBe('unit-accounting');
    expect(result.tally).toEqual({ 'unit-accounting': 1, electives: 1 });
  });

  it('uses unit majority and canonical tie order for a mixed group', () => {
    const degree = {
      _id: 'va:degree:mixed',
      requirement_groups: [{
        title: 'Mixed block',
        sections: [
          {
            unit_advisement: 3,
            receivers: [{ receiving: { kind: 'ge_area', area: 'area-1' } }],
          },
          { tier: 'nontransferable', unit_advisement: 3 },
        ],
      }],
    };

    const result = stampDegreeCategories(degree);

    expect(result.doc.requirement_groups[0].category).toBe('general-education');
    expect(result.mixedGroups).toEqual([{
      doc: 'va:degree:mixed',
      group: 'Mixed block',
      categories: ['general-education', 'upper-division'],
    }]);
  });

  it('preserves Date values and proves additive-only changes with type fidelity', () => {
    const updatedAt = new Date('2026-08-25T12:34:56.789Z');
    const curatedAt = new Date('2026-08-24T01:02:03.004Z');
    const degree = {
      _id: 'va:degree:typed',
      updated_at: updatedAt,
      provenance: { curated_at: curatedAt },
      verification: { verified_at: updatedAt },
      requirement_groups: [{
        title: 'Major requirements',
        sections: [{ tier: 'nontransferable', unit_advisement: 3, receivers: [] }],
      }],
    };

    const result = stampDegreeCategories(degree);

    expect(result.doc).not.toBe(degree);
    expect(result.doc.updated_at).toBeInstanceOf(Date);
    expect(result.doc.provenance.curated_at).toBeInstanceOf(Date);
    expect(result.doc.verification.verified_at).toBeInstanceOf(Date);
    expect(result.doc.updated_at.getTime()).toBe(updatedAt.getTime());
    expect(result.doc.provenance.curated_at.getTime()).toBe(curatedAt.getTime());
    expect(result.doc.verification.verified_at.getTime()).toBe(updatedAt.getTime());
    expect(stripStamps(result.doc)).toEqual(degree);
  });

  it('refuses a standalone Virginia write before contacting MongoDB', () => {
    const script = path.resolve(__dirname, 'normalizeDegreeCategories.js');
    const result = spawnSync(process.execPath, [script, '--state=va', '--apply'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MONGO_URI: 'mongodb://127.0.0.1:1/would-fail-if-contacted',
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing a separate non-atomic VA write');
    expect(result.stderr).not.toMatch(/ECONNREFUSED|MongoServerSelectionError/);
  });
});
