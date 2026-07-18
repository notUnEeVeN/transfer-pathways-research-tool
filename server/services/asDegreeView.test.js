import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  asDegreeOverview, asDegreeAvailability, asDegreesExportData,
  asDegreeDetail, duplicateLocalComputingIds, templateRequiredSlots,
} = cjs('./asDegreeView');

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

// The concept template used across tests: 5 required slots (across 4
// is_required groups — core_mathematics holds 2 sections/slots — one slot is
// an OR-slot with 2 alternatives, ['calc_2', 'linear_alg']), plus a
// non-required science group and a slot-less GE group — both of which must
// NOT count toward the required set.
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

// Mirrors the real cs_ast template's "List B science" pattern
// (scripts/data/as_degree_template.json): a required choose-one slot with 3
// alternatives, alongside a couple required single-concept slots. 3 required
// slots total.
const CHOOSE_ONE_TEMPLATE = {
  _id: 'as_degree_template:ast_like', kind: 'as_degree_template', slug: 'ast_like',
  groups: [
    { group_id: 'core_programming', label: 'Programming core', is_required: true,
      sections: [{ section_advisement: null, unit_advisement: null, slots: [{ concepts: ['cs_1'] }] }] },
    { group_id: 'core_discrete', label: 'Discrete', is_required: true,
      sections: [{ section_advisement: null, unit_advisement: null, slots: [{ concepts: ['discrete_math'] }] }] },
    { group_id: 'science_elective', label: 'List B science (choose one)', is_required: true,
      sections: [{ section_advisement: 1, unit_advisement: null,
        slots: [{ concepts: ['bio_cell_molec', 'gen_chem_1', 'phys_em'] }] }] },
  ],
};

async function seedChooseOne() {
  await db.collection('assist_institutions').insertOne(
    { _id: 'cc:3', kind: 'community_college', source_id: 3, name: 'Foothill College' });
  await db.collection('curated_requirements').insertMany([
    CHOOSE_ONE_TEMPLATE,
    { _id: 'as_degree:3:covers_bio', kind: 'as_degree', community_college_id: 3, college_id: 'cc:3',
      degree_type: 'ast', major_slug: 'cs', template_ref: 'as_degree_template:ast_like', status: 'found',
      degree_title_seen: 'Computer Science for Transfer, A.S.-T.', catalog_url: 'https://z',
      catalog_year: '2025-2026', unit_system: 'semester', total_units: 60,
      verification: { verified: false },
      // covers the choose-one science slot via bio_cell_molec -> all 3 slots satisfied.
      covered_concepts: ['cs_1', 'discrete_math', 'bio_cell_molec'],
      requirement_groups: [] },
    { _id: 'as_degree:3:no_science', kind: 'as_degree', community_college_id: 3, college_id: 'cc:3',
      degree_type: 'ast_alt', major_slug: 'cs', template_ref: 'as_degree_template:ast_like', status: 'found',
      degree_title_seen: 'Computer Science for Transfer, A.S.-T. (alt)', catalog_url: 'https://z2',
      catalog_year: '2025-2026', unit_system: 'semester', total_units: 60,
      verification: { verified: false },
      // covers neither cs_1/discrete_math advanced pieces nor any science alternative.
      covered_concepts: ['cs_1', 'discrete_math'],
      requirement_groups: [] },
  ]);
}

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
      // covers 4 of the template's 5 required slots -> coverage_pct 80,
      // missing the calc_2/linear_alg choose-one slot.
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
      // covers only 1 of 5 required slots -> coverage_pct 20.
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
    // covers 4 of the template's 5 required slots (see CONCEPT_TEMPLATE)
    expect(hancock.coverage_pct).toBe(80);
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
    // covers only 1 of 5 required slots
    expect(ast.coverage_pct).toBe(20);
  });

  it('filters the overview to one stable degree_type cohort', async () => {
    await seed();
    const result = await asDegreeOverview(db, { degreeType: 'ast' });
    expect(result.params).toEqual({ degree_type: 'ast' });
    expect(result.n).toBe(1);
    expect(result.rows.map((row) => row.degree_type)).toEqual(['ast']);
  });
});

describe('asDegreeAvailability', () => {
  it('distinguishes available, confirmed-none, and offered-but-missing records', async () => {
    await seed();
    const inventory = [
      { community_college_id: 110, college_name: 'Allan Hancock College',
        local_cs_as_exists: true, ast_cs_exists: true,
        local_computing_degrees: [{ name: 'Computer Information Systems', award: 'A.S.' }] },
      { community_college_id: 2, college_name: 'Evergreen Valley College',
        local_cs_as_exists: false, ast_cs_exists: true, local_computing_degrees: [] },
    ];
    const result = await asDegreeAvailability(db, inventory);
    const hancock = result.rows.find((row) => row.college_id === 'cc:110');
    const evergreen = result.rows.find((row) => row.college_id === 'cc:2');
    expect(hancock.types.ast.status).toBe('available');
    expect(hancock.types.local_cs_as.status).toBe('available');
    expect(evergreen.types.ast.status).toBe('data_gap');
    expect(evergreen.types.local_cs_as.status).toBe('confirmed_none');
    expect(result.counts.ast).toMatchObject({ available: 1, data_gap: 1, confirmed_none: 0 });
  });
});

describe('asDegreesExportData', () => {
  it('returns only found CS A.S.-T documents with joined college/course data', async () => {
    await seed();
    const rows = await asDegreesExportData(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      _id: 'as_degree:110:ast', degree_type: 'ast', college_name: 'Allan Hancock College',
    });
    expect(rows[0].courses_by_id['cc:101']).toMatchObject({ code: 'CS 111', units: 4 });
  });
});

describe('duplicateLocalComputingIds', () => {
  it('flags only same-title, same-course local-computing duplicates', () => {
    const local = { _id: 'as_degree:1:local_cs_as', community_college_id: 1,
      degree_type: 'local_cs_as', degree_title_seen: 'Computer Science, A.S.',
      requirement_groups: [{ sections: [{ receivers: [receiver(101)] }] }] };
    const duplicate = { ...local, _id: 'as_degree:1:local_computing', degree_type: 'local_computing' };
    const distinct = { ...local, _id: 'as_degree:2:local_computing', community_college_id: 2,
      degree_type: 'local_computing', degree_title_seen: 'Computer Information Systems, A.S.' };
    expect([...duplicateLocalComputingIds([local, duplicate, distinct])]).toEqual([duplicate._id]);
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
      { course_id: 101, prefix: 'CS', number: '111', code: 'CS 111',
        title: 'Programming I', units: 4, concept: 'cs_1' });
    expect(localCsAs.covered_concepts).toEqual(['cs_1', 'comp_arch_assembly', 'discrete_math', 'calc_1']);
    expect(localCsAs.missing_core_concepts).toEqual(['calc_2', 'linear_alg']);
    expect(localCsAs.coverage_pct).toBe(80);
    const ast = detail.degrees.find((d) => d.degree_type === 'ast');
    expect(ast.doc._id).toBe('as_degree:110:ast');
    expect(ast.courses_by_id['cc:101']).toBeTruthy();
    expect(ast.coverage_pct).toBe(20);
    expect(ast.missing_core_concepts).toEqual(
      ['comp_arch_assembly', 'discrete_math', 'calc_1', 'calc_2', 'linear_alg']);
    const localComputing = detail.degrees.find((d) => d.degree_type === 'local_computing');
    expect(localComputing.covered_concepts).toEqual(['cs_1']);
    expect(localComputing.missing_core_concepts).toEqual([]);
    expect(localComputing.coverage_pct).toBe(null);
    expect(await asDegreeDetail(db, 'cc:999')).toBe(null);
  });
});

describe('choose-one template slots (List B science pattern)', () => {
  it('scores a choose-one slot as satisfied by any covered alternative, excluding its siblings from missing', async () => {
    await seedChooseOne();
    const detail = await asDegreeDetail(db, 'cc:3');
    const coversBio = detail.degrees.find((d) => d.doc._id === 'as_degree:3:covers_bio');
    // 3/3 slots satisfied: cs_1, discrete_math, and the science choose-one
    // via bio_cell_molec — the slot is NOT scored as missing chem/physics.
    expect(coversBio.coverage_pct).toBe(100);
    expect(coversBio.missing_core_concepts).toEqual([]);
    expect(coversBio.missing_core_concepts).not.toContain('gen_chem_1');
    expect(coversBio.missing_core_concepts).not.toContain('phys_em');

    const noScience = detail.degrees.find((d) => d.doc._id === 'as_degree:3:no_science');
    // 2/3 slots satisfied (cs_1, discrete_math); the science slot is
    // uncovered and lists all 3 of its alternatives as ONE missing slot.
    expect(noScience.coverage_pct).toBe(67);
    expect(noScience.missing_core_concepts).toEqual(['bio_cell_molec', 'gen_chem_1', 'phys_em']);
  });
});

describe('templateRequiredSlots', () => {
  it('builds one requirement per section slot in is_required groups, excluding non-required and slot-less groups', () => {
    const slots = templateRequiredSlots(CONCEPT_TEMPLATE);
    expect(slots).toHaveLength(5);
    const slotSets = slots.map((s) => [...s.concepts].sort().join(','));
    expect(slotSets).toEqual(expect.arrayContaining(
      ['cs_1', 'comp_arch_assembly', 'discrete_math', 'calc_1', ['calc_2', 'linear_alg'].sort().join(',')]));
    // science_option is not required, so its concepts never appear in a slot.
    expect(slots.some((s) => s.concepts.includes('phys_mech'))).toBe(false);
    expect(slots.some((s) => s.concepts.includes('gen_chem_1'))).toBe(false);
  });

  it('returns an empty array for a missing or group-less template', () => {
    expect(templateRequiredSlots(null)).toEqual([]);
    expect(templateRequiredSlots({ groups: [] })).toEqual([]);
  });

  it('dedupes identical slots (same concept set, order-insensitive) across different groups', () => {
    const template = {
      groups: [
        { group_id: 'a', is_required: true, sections: [{ slots: [{ concepts: ['x'] }] }] },
        { group_id: 'b', is_required: true, sections: [{ slots: [{ concepts: ['x'] }] }] },
        { group_id: 'c', is_required: true, sections: [{ slots: [{ concepts: ['y', 'z'] }] }] },
        { group_id: 'd', is_required: true, sections: [{ slots: [{ concepts: ['z', 'y'] }] }] },
      ],
    };
    expect(templateRequiredSlots(template)).toHaveLength(2);
  });
});

describe('GE area breakdowns', () => {
  it('counts qualifying courses per Cal-GETC area; local patterns render assumed', async () => {
    await db.collection('assist_institutions').insertOne(
      { _id: 'cc:9', kind: 'community_college', source_id: 9, name: 'Cerro Coso Community College' });
    await db.collection('assist_courses').insertMany([
      { _id: 'cc:901', course_id: 901, side: 'sending', community_college_id: 9, prefix: 'ENGL', number: '1A',
        title: 'Composition', units: 4, uc_transferable: true, calgetc_area: ['1A'] },
      { _id: 'cc:902', course_id: 902, side: 'sending', community_college_id: 9, prefix: 'HIST', number: '10',
        title: 'World History', units: 3, uc_transferable: true, calgetc_area: ['3B', '4'] },
      { _id: 'cc:903', course_id: 903, side: 'sending', community_college_id: 9, prefix: 'PHIL', number: '2',
        title: 'Intro to Philosophy', units: 3, uc_transferable: true, calgetc_area: ['3B'] },
      // Not UC-transferable: excluded from the Cal-GETC counts.
      { _id: 'cc:904', course_id: 904, side: 'sending', community_college_id: 9, prefix: 'BUS', number: '50',
        title: 'Bookkeeping', units: 3, uc_transferable: false, calgetc_area: ['3B'] },
    ]);
    await db.collection('curated_requirements').insertOne(
      { _id: 'as_degree:9:local_cs_as', kind: 'as_degree', community_college_id: 9, college_id: 'cc:9',
        degree_type: 'local_cs_as', major_slug: 'cs', template_ref: null, status: 'found',
        degree_title_seen: 'Computer Science, A.S.', catalog_url: 'https://q', catalog_year: '2025-2026',
        unit_system: 'semester', total_units: 60,
        verification: { verified: false }, covered_concepts: [],
        requirement_groups: [
          { group_id: 'ge_calgetc', template_group: null, source: 'extracted', confidence: 1,
            label_seen: 'General Education (Cal-GETC)', is_required: true, ge_area: 'calgetc',
            sections: [{ section_advisement: null, unit_advisement: 34, receivers: [] }] },
          { group_id: 'ge_local', template_group: null, source: 'extracted', confidence: 1,
            label_seen: 'Local GE', is_required: true, ge_area: 'local_pattern',
            sections: [{ section_advisement: null, unit_advisement: 18, receivers: [] }] },
        ] });

    const detail = await asDegreeDetail(db, 'cc:9');
    const deg = detail.degrees[0];
    const cal = deg.ge_breakdowns.calgetc;
    expect(cal.assumed).toBe(false);
    const byCode = Object.fromEntries(cal.areas.map((a) => [a.code, a.qualifying_count]));
    expect(byCode['1A']).toBe(1);
    expect(byCode['3B']).toBe(2);   // BUS 50 excluded (not UC-transferable)
    expect(byCode['4']).toBe(1);
    expect(byCode['1B']).toBe(0);
    const local = deg.ge_breakdowns.local_pattern;
    expect(local.assumed).toBe(true);
    expect(local.areas.map((a) => a.code)).toEqual(['NS', 'SB', 'H', 'LR', 'M']);
    expect(local.areas.every((a) => a.qualifying_count === null)).toBe(true);
  });
});
