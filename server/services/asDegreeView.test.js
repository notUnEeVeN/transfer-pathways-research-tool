import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { asDegreeOverview, asDegreeDetail } = cjs('./asDegreeView');

let mongo; let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('as_degree_view_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const receiver = (courseId) => ({
  receiving: null, articulation_status: 'articulated', not_articulated_reason: null,
  options: [{ course_ids: [courseId], course_conjunction: 'and', course_keys: [`cc:${courseId}`] }],
  options_conjunction: 'and', hash_id: null,
});

async function seed() {
  await db.collection('assist_institutions').insertMany([
    { _id: 'cc:110', kind: 'community_college', source_id: 110, name: 'Allan Hancock College' },
    { _id: 'cc:2', kind: 'community_college', source_id: 2, name: 'Evergreen Valley College' },
  ]);
  await db.collection('assist_courses').insertMany([
    { _id: 'cc:101', course_id: 101, prefix: 'CS', number: '111', title: 'Programming I', units: 4, concept: 'cs_1' },
    { _id: 'cc:102', course_id: 102, prefix: 'CS', number: '112', title: 'Programming II', units: 4, concept: 'cs_2_oop' },
  ]);
  await db.collection('curated_requirements').insertMany([
    { _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs',
      groups: [
        { group_id: 'core_programming', label: 'Programming core', sections: [] },
        { group_id: 'ge_humanities', label: 'GE: Humanities', ge_area: 'humanities', sections: [] },
        { group_id: 'electives', label: 'Electives', units_fill: true },
      ] },
    { _id: 'as_degree:110:cs', kind: 'as_degree', community_college_id: 110, college_id: 'cc:110',
      major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'found',
      degree_title_seen: 'Computer Science, A.S.', catalog_url: 'https://x', catalog_year: '2025-2026',
      unit_system: 'semester', total_units: 60,
      verification: { verified: false },
      requirement_groups: [
        { group_id: 'core_programming', template_group: 'core_programming', source: 'extracted',
          confidence: 0.6, label_seen: 'Core', is_required: true,
          sections: [{ section_advisement: null, unit_advisement: null,
            receivers: [receiver(101), receiver(102)] }],
          unresolved_courses_seen: [{ course_code_seen: 'CS 199' }] },
        { group_id: 'ge_humanities', template_group: 'ge_humanities', source: 'template_default', confidence: null },
        { group_id: 'ethics', template_group: null, source: 'extracted', confidence: 1,
          label_seen: 'Computer Ethics', is_required: true,
          sections: [{ section_advisement: null, unit_advisement: 3, receivers: [receiver(101)] }] },
      ] },
    { _id: 'as_degree:2:cs', kind: 'as_degree', community_college_id: 2, college_id: 'cc:2',
      major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'none_found',
      catalog_url: 'https://y', catalog_year: '2025-2026' },
  ]);
}

describe('asDegreeOverview', () => {
  it('rolls up provenance, confidence, deviations, and flags per college', async () => {
    await seed();
    const { template, rows } = await asDegreeOverview(db);
    expect(template._id).toBe('as_degree_template:cs');
    expect(rows).toHaveLength(2);
    const hancock = rows.find((r) => r.college_id === 'cc:110');
    expect(hancock.college_name).toBe('Allan Hancock College');
    expect(hancock.source_counts).toEqual({ extracted: 2, template_default: 1, curated: 0 });
    expect(hancock.confidence_min).toBe(0.6);
    expect(hancock.unresolved_count).toBe(1);
    // 4 + 4 units from the all-required section, + 3 from the unit_advisement section
    expect(hancock.units_accounted).toBe(11);
    expect(hancock.deviations).toEqual({ missing_groups: ['electives'], extra_groups: ['ethics'] });
    expect(hancock.flags).toEqual(
      expect.arrayContaining(['template_default_groups', 'low_confidence', 'unresolved_courses', 'units_mismatch']));
    const evergreen = rows.find((r) => r.college_id === 'cc:2');
    expect(evergreen.status).toBe('none_found');
    expect(evergreen.flags).toEqual([]);
  });
});

describe('asDegreeDetail', () => {
  it('returns the doc with joined course details and deviations', async () => {
    await seed();
    const detail = await asDegreeDetail(db, 'cc:110');
    expect(detail.college_name).toBe('Allan Hancock College');
    expect(detail.courses_by_id['cc:101']).toEqual(
      { code: 'CS 111', title: 'Programming I', units: 4, concept: 'cs_1' });
    expect(detail.deviations.extra_groups).toEqual(['ethics']);
    expect(await asDegreeDetail(db, 'cc:999')).toBe(null);
  });
});
