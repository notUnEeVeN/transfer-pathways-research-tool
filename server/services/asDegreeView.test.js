import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { asDegreeOverview, asDegreeDetail, templateRequiredConcepts } = cjs('./asDegreeView');

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

// The concept template used across tests: 6 required concepts (across 4
// is_required groups, one of which has an OR-slot flattened to 2 concepts),
// plus a non-required science group and a slot-less GE group — both of
// which must NOT count toward the required set.
const CONCEPT_TEMPLATE = {
  _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs',
  groups: [
    { group_id: 'core_programming', label: 'Programming core', is_required: true,
      sections: [{ section_advisement: null, unit_advisement: null, slots: [{ concepts: ['cs_1'] }] }] },
    { group_id: 'core_architecture', label: 'Architecture', is_required: true,
      sections: [{ section_advisement: null, unit_advisement: null, slots: [{ concepts: ['comp_arch_assembly'] }] }] },
    { group_id: 'core_discrete', label: 'Discrete', is_required: true,
      sections: [{ section_advisement: null, unit_advisement: null, slots: [{ concepts: ['discrete_math'] }] }] },
    { group_id: 'core_mathematics', label: 'Calculus', is_required: true,
      sections: [
        { section_advisement: null, unit_advisement: null, slots: [{ concepts: ['calc_1'] }] },
        { section_advisement: 1, unit_advisement: null, slots: [{ concepts: ['calc_2', 'linear_alg'] }] },
      ] },
    { group_id: 'science_option', label: 'Science (optional)', is_required: false,
      sections: [{ section_advisement: 1, unit_advisement: null, slots: [{ concepts: ['phys_mech', 'gen_chem_1'] }] }] },
    { group_id: 'ge_humanities', label: 'GE: Humanities', ge_area: 'humanities', is_required: true,
      sections: [{ section_advisement: null, unit_advisement: 3, slots: [] }] },
    { group_id: 'electives', label: 'Electives', units_fill: true },
  ],
};

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
    CONCEPT_TEMPLATE,
    { _id: 'as_degree:110:local_cs_as', kind: 'as_degree', community_college_id: 110, college_id: 'cc:110',
      degree_type: 'local_cs_as', major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'found',
      degree_title_seen: 'Computer Science, A.S.', catalog_url: 'https://x', catalog_year: '2025-2026',
      unit_system: 'semester', total_units: 60,
      verification: { verified: false },
      // covers 4 of the template's 6 required concepts -> coverage_pct 67,
      // missing calc_2 and linear_alg.
      covered_concepts: ['cs_1', 'comp_arch_assembly', 'discrete_math', 'calc_1'],
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
    { _id: 'as_degree:110:ast', kind: 'as_degree', community_college_id: 110, college_id: 'cc:110',
      degree_type: 'ast', major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'found',
      degree_title_seen: 'Computer Science for Transfer, A.S.-T.', catalog_url: 'https://x-ast',
      catalog_year: '2025-2026', unit_system: 'semester', total_units: 60,
      verification: { verified: false },
      // covers only 1 of 6 required concepts -> coverage_pct 17.
      covered_concepts: ['cs_1'],
      requirement_groups: [
        { group_id: 'core_programming', template_group: 'core_programming', source: 'extracted',
          confidence: 0.9, label_seen: 'Core', is_required: true,
          sections: [{ section_advisement: null, unit_advisement: null,
            receivers: [receiver(101)] }] },
      ] },
    { _id: 'as_degree:110:local_computing', kind: 'as_degree', community_college_id: 110, college_id: 'cc:110',
      degree_type: 'local_computing', major_slug: 'cis', template_ref: null, status: 'found',
      degree_title_seen: 'Computer Information Systems, A.S.', catalog_url: 'https://x-cis',
      catalog_year: '2025-2026', unit_system: 'semester', total_units: 60,
      verification: { verified: false },
      covered_concepts: ['cs_1'],
      requirement_groups: [
        { group_id: 'core', template_group: null, source: 'extracted', confidence: 0.8, label_seen: 'Core',
          is_required: true,
          sections: [{ section_advisement: null, unit_advisement: null, receivers: [receiver(101)] }] },
      ] },
    { _id: 'as_degree:2:local_cs_as', kind: 'as_degree', community_college_id: 2, college_id: 'cc:2',
      degree_type: 'local_cs_as', major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'none_found',
      catalog_url: 'https://y', catalog_year: '2025-2026' },
  ]);
}

describe('asDegreeOverview', () => {
  it('rolls up provenance, confidence, concept coverage, and flags per college', async () => {
    await seed();
    const { template, rows } = await asDegreeOverview(db);
    expect(template._id).toBe('as_degree_template:cs');
    const hancock = rows.find((r) => r.college_id === 'cc:110' && r.degree_type === 'local_cs_as');
    expect(hancock.college_name).toBe('Allan Hancock College');
    expect(hancock.major_slug).toBe('cs');
    expect(hancock.source_counts).toEqual({ extracted: 2, template_default: 1, curated: 0 });
    expect(hancock.confidence_min).toBe(0.6);
    expect(hancock.unresolved_count).toBe(1);
    // 4 + 4 units from the all-required section, + 3 from the unit_advisement section
    expect(hancock.units_accounted).toBe(11);
    // covers 4 of the template's 6 required concepts (see CONCEPT_TEMPLATE)
    expect(hancock.coverage_pct).toBe(67);
    expect(hancock.missing_core_count).toBe(2);
    expect(hancock.flags).toEqual(
      expect.arrayContaining(['template_default_groups', 'low_confidence', 'unresolved_courses', 'units_mismatch']));
    const evergreen = rows.find((r) => r.college_id === 'cc:2');
    expect(evergreen.status).toBe('none_found');
    expect(evergreen.degree_type).toBe('local_cs_as');
    expect(evergreen.flags).toEqual([]);
  });

  it('resolves coverage_pct null for a degree whose template_ref is null (local_computing)', async () => {
    await seed();
    const { rows } = await asDegreeOverview(db);
    const localComputing = rows.find((r) => r.college_id === 'cc:110' && r.degree_type === 'local_computing');
    expect(localComputing.coverage_pct).toBe(null);
    expect(localComputing.missing_core_count).toBe(0);
  });

  it('yields one row per degree, so a multi-degree college produces one row per degree', async () => {
    await seed();
    const { rows } = await asDegreeOverview(db);
    expect(rows).toHaveLength(4);
    const hancockRows = rows.filter((r) => r.college_id === 'cc:110');
    expect(hancockRows).toHaveLength(3);
    expect(hancockRows.map((r) => r.degree_type).sort()).toEqual(['ast', 'local_computing', 'local_cs_as']);
    const ast = hancockRows.find((r) => r.degree_type === 'ast');
    expect(ast.college_name).toBe('Allan Hancock College');
    expect(ast.degree_title_seen).toBe('Computer Science for Transfer, A.S.-T.');
    // covers only 1 of 6 required concepts
    expect(ast.coverage_pct).toBe(17);
  });
});

describe('asDegreeDetail', () => {
  it('returns all of a college\'s degrees, joined with course details and concept coverage', async () => {
    await seed();
    const detail = await asDegreeDetail(db, 'cc:110');
    expect(detail.college_name).toBe('Allan Hancock College');
    expect(detail.degrees).toHaveLength(3);
    const localCsAs = detail.degrees.find((d) => d.degree_type === 'local_cs_as');
    expect(localCsAs.doc._id).toBe('as_degree:110:local_cs_as');
    expect(localCsAs.courses_by_id['cc:101']).toEqual(
      { code: 'CS 111', title: 'Programming I', units: 4, concept: 'cs_1' });
    expect(localCsAs.covered_concepts).toEqual(['cs_1', 'comp_arch_assembly', 'discrete_math', 'calc_1']);
    expect(localCsAs.missing_core_concepts).toEqual(['calc_2', 'linear_alg']);
    expect(localCsAs.coverage_pct).toBe(67);
    const ast = detail.degrees.find((d) => d.degree_type === 'ast');
    expect(ast.doc._id).toBe('as_degree:110:ast');
    expect(ast.courses_by_id['cc:101']).toBeTruthy();
    expect(ast.coverage_pct).toBe(17);
    expect(ast.missing_core_concepts).toEqual(
      ['comp_arch_assembly', 'discrete_math', 'calc_1', 'calc_2', 'linear_alg']);
    const localComputing = detail.degrees.find((d) => d.degree_type === 'local_computing');
    expect(localComputing.covered_concepts).toEqual(['cs_1']);
    expect(localComputing.missing_core_concepts).toEqual([]);
    expect(localComputing.coverage_pct).toBe(null);
    expect(await asDegreeDetail(db, 'cc:999')).toBe(null);
  });
});

describe('templateRequiredConcepts', () => {
  it('flattens is_required groups\' OR-slots to their union, excluding non-required and slot-less groups', () => {
    const required = templateRequiredConcepts(CONCEPT_TEMPLATE);
    expect([...required].sort()).toEqual(
      ['calc_1', 'calc_2', 'comp_arch_assembly', 'cs_1', 'discrete_math', 'linear_alg'].sort());
    expect(required.has('phys_mech')).toBe(false); // science_option is not required
    expect(required.has('gen_chem_1')).toBe(false);
  });

  it('returns an empty set for a missing or group-less template', () => {
    expect(templateRequiredConcepts(null).size).toBe(0);
    expect(templateRequiredConcepts({ groups: [] }).size).toBe(0);
  });
});
