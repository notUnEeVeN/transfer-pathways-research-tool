import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cjs = createRequire(import.meta.url);
const {
  COMBINED_FIELDS,
  ROW_FIELDS,
  buildMultiCampusSnapshot,
  clearMultiCampusSnapshotCache,
  loadMultiCampusSnapshot,
  validateMultiCampusSnapshot,
} = cjs('./pathwaySnapshot');

const temporaryDirectories = [];
afterEach(async () => {
  clearMultiCampusSnapshotCache();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.promises.rm(directory, { recursive: true, force: true })));
});

const targets = [
  { school_id: 10, school: 'UC Alpha', major: 'Alpha CS', program: 'Alpha CS' },
  { school_id: 20, school: 'UC Beta', major: 'Beta CS', program: 'Beta CS' },
];
const collegeRows = [
  { source_id: 2, name: 'Semester College' },
  { source_id: 40, name: 'Quarter College' },
];
const colleges = collegeRows.map((college) => ({
  community_college_id: college.source_id,
  community_college: college.name,
  unit_system: college.source_id === 40 ? 'quarter' : 'semester',
  calendar_source: 'test',
}));
const context = {
  targets,
  colleges: collegeRows,
  sourceFingerprint: 'a'.repeat(64),
  calendarForCollege: (id) => id === 40 ? 'quarter' : 'semester',
};

function combined(seed) {
  return Object.fromEntries(COMBINED_FIELDS.map((field, index) => [
    field,
    field.endsWith('complete') ? true : seed + index,
  ]));
}

function combination(mask) {
  return {
    mask,
    school_ids: targets.filter((_, index) => mask & (1 << index)).map((target) => target.school_id),
    summary: { colleges_total: 2, mean_distinct_courses: mask + 10 },
    calendar_groups: [{ unit_system: 'semester', n: 1 }],
    rows: colleges.map((_, index) => ({
      status: 'optimal',
      plan_status: 'optimal',
      prerequisite_status: 'complete',
      schedule_status: 'optimal',
      warnings: index ? ['Second warning'] : ['First warning'],
      strict_complete_mask: mask,
      combined: combined(mask + index),
    })),
    method: { id: 'joint_major_preparation_v2', term_objective: 'test' },
    global_warnings: ['Global warning'],
  };
}

function snapshot(load = 15, generatedAt = '2026-07-21T12:00:00.000Z') {
  return buildMultiCampusSnapshot({
    context,
    combinations: new Map([[1, combination(1)], [2, combination(2)], [3, combination(3)]]),
    semesterLoad: load,
    quarterLoad: load,
    generatedAt,
  });
}

describe('multi-campus snapshot packing', () => {
  it('normalizes repeated identities and packs aligned rows into fixed-width tuples', () => {
    const result = snapshot();

    expect(result.default_load_profile).toBe('s15-q15');
    expect(result.row_fields).toEqual(ROW_FIELDS);
    expect(result.warnings).toEqual(['First warning', 'Global warning', 'Second warning']);
    expect(result.colleges.map((college) => college.unit_system)).toEqual(['semester', 'quarter']);
    expect(Object.keys(result.load_profiles['s15-q15'].combinations)).toEqual(['1', '2', '3']);
    const row = result.load_profiles['s15-q15'].combinations['3'].rows[0];
    expect(row).toHaveLength(ROW_FIELDS.length);
    expect(row[ROW_FIELDS.indexOf('warning_indices')]).toEqual([0]);
    expect(row[ROW_FIELDS.indexOf('strict_complete_mask')]).toBe(3);
    expect(row[ROW_FIELDS.indexOf('combined.distinct_courses')]).toBe(3);
    expect(result.artifact_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects missing combinations, malformed tuple widths, and invalid strict masks', () => {
    const missing = structuredClone(snapshot());
    delete missing.load_profiles['s15-q15'].combinations['2'];
    expect(() => validateMultiCampusSnapshot(missing)).toThrow(/expected 3 nonempty combinations/);

    const short = structuredClone(snapshot());
    short.load_profiles['s15-q15'].combinations['1'].rows[0].pop();
    expect(() => validateMultiCampusSnapshot(short)).toThrow(/must match row_fields/);

    const badMask = structuredClone(snapshot());
    const strictIndex = ROW_FIELDS.indexOf('strict_complete_mask');
    badMask.load_profiles['s15-q15'].combinations['1'].rows[0][strictIndex] = 2;
    expect(() => validateMultiCampusSnapshot(badMask)).toThrow(/invalid strict_complete_mask/);
  });
});

describe('multi-campus snapshot store', () => {
  it('reloads an atomically replaced artifact at the same path', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pathway-snapshot-'));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'snapshot.json');
    const first = snapshot(15, '2026-07-21T12:00:00.000Z');
    await fs.promises.writeFile(filePath, JSON.stringify(first));
    expect((await loadMultiCampusSnapshot(filePath)).default_load_profile).toBe('s15-q15');

    const second = snapshot(12, '2026-07-21T12:01:00.000Z');
    const replacement = path.join(directory, 'replacement.json');
    await fs.promises.writeFile(replacement, JSON.stringify(second));
    await fs.promises.rename(replacement, filePath);

    const reloaded = await loadMultiCampusSnapshot(filePath);
    expect(reloaded.default_load_profile).toBe('s12-q12');
    expect(reloaded.artifact_fingerprint).not.toBe(first.artifact_fingerprint);
  });
});
