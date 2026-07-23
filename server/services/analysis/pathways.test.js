import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startInMemoryMongo } from '../../test/mongoHarness';
import {
  coverageData, requirementComparisonData, creditLossData, choiceCostData,
  categoryGapsData, complexityData, timeToDegreeData, agreementsExportData,
  receiversExportData, _settingsMajors, _canonicalCsPrograms,
  _normalizedAssistRequirementStructure, _assistRequirementDemand,
  _selectCanonicalAssistTemplate,
} from './pathways';
import { getMajor } from '../../config/majors';

let mongo;
let db;

const recv = (options, { status = 'articulated', hash = 'h', parentId = 1, oc = 'or' } = {}) => ({
  receiving: { kind: 'course', parent_id: parentId },
  articulation_status: status,
  not_articulated_reason: status === 'articulated' ? null : 'NoCourseArticulated',
  options,
  options_conjunction: oc,
  hash_id: hash,
});
const opt = (ids, cc = 'and') => ({ course_ids: ids, course_conjunction: cc });
// "Complete all listed" — the ASSIST parser stores section_advisement = the
// receiver count for that (agreements.py), so a genuinely-missing receiver
// leaves the choose-N minimum unmet. (A null advisement would mean "any one".)
const oneGroup = (receivers, isRequired = true) => [{
  is_required: isRequired, group_conjunction: 'And', group_advisement: null,
  group_unit_advisement: null,
  sections: [{ section_advisement: receivers.length, unit_advisement: null, receivers }],
}];

describe('canonical ASSIST template selection', () => {
  const agreement = (groups) => ({ requirement_groups: groups });

  it('normalizes after exclusions and measures true receiver-slot demand', () => {
    const groups = [
      ...oneGroup([
        recv([], { hash: 'kept', parentId: 1 }),
        recv([], { hash: 'excluded', parentId: 2 }),
      ]),
      ...oneGroup([recv([], { hash: 'recommended', parentId: 3 })], false),
    ];
    // The parsed advisement still says 2, but exclusion leaves one available
    // receiver, so the true capped demand is one.
    const normalized = _normalizedAssistRequirementStructure(
      groups, (receiver) => receiver.hash_id === 'excluded'
    );

    expect(normalized).toHaveLength(1);
    expect(normalized[0].sections[0].receivers.map((receiver) => receiver.hash_id))
      .toEqual(['kept']);
    expect(_assistRequirementDemand(normalized)).toBe(1);
  });

  it('breaks demand and structure ties deterministically regardless of input order', () => {
    const demandOneA = agreement(oneGroup([
      recv([], { hash: 'one-a', parentId: 11 }),
    ]));
    const demandOneB = agreement(oneGroup([
      recv([], { hash: 'one-b', parentId: 12 }),
    ]));
    const demandTwoA = agreement(oneGroup([
      recv([], { hash: 'two-a1', parentId: 21 }),
      recv([], { hash: 'two-a2', parentId: 22 }),
    ]));
    const demandTwoB = agreement(oneGroup([
      recv([], { hash: 'two-b1', parentId: 23 }),
      recv([], { hash: 'two-b2', parentId: 24 }),
    ]));
    const fingerprintA = _selectCanonicalAssistTemplate([demandOneA]).structureFingerprint;
    const fingerprintB = _selectCanonicalAssistTemplate([demandOneB]).structureFingerprint;
    const expectedFingerprint = [fingerprintA, fingerprintB].sort()[0];
    const candidates = [demandTwoB, demandOneB, demandTwoA, demandOneA];

    const forward = _selectCanonicalAssistTemplate(candidates);
    const reverse = _selectCanonicalAssistTemplate([...candidates].reverse());

    // Demand frequencies tie 2–2, so the smaller true demand wins. Its two
    // structures also tie 1–1, so fingerprint—not source order—decides.
    expect(forward.nativeDemand).toBe(1);
    expect(forward.structureFingerprint).toBe(expectedFingerprint);
    expect(reverse).toEqual(forward);
  });
});

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('pathways_test');

  // Two UC agreements at School 1 for CC 10 and CC 20, one CSU untouched.
  await db.collection('assist_agreements').insertMany([
    {
      uc_school: 'UC Test', uc_school_id: 1,
      community_college: 'CC Alpha', community_college_id: 10,
      major: 'Computer Science B.S.',
      requirement_groups: oneGroup([
        recv([opt(['calcA'])], { hash: 'r-calc', parentId: 101 }),           // calculus, 1 course
        recv([opt(['cs1a', 'cs1b'])], { hash: 'r-cs1', parentId: 102 }),     // intro programming, 2 courses
        recv([opt(['reco'])], { hash: 'r-reco', parentId: 103 }),            // will be curation-excluded
      ]),
    },
    {
      uc_school: 'UC Test', uc_school_id: 1,
      community_college: 'CC Beta', community_college_id: 20,
      major: 'Computer Science B.S.',
      requirement_groups: oneGroup([
        recv([opt(['calcB'])], { hash: 'r-calc', parentId: 101 }),
        recv([], { status: 'not_articulated', hash: 'r-cs1', parentId: 102 }), // missing intro programming
      ]),
    },
    {
      uc_school: 'UC Other', uc_school_id: 2,
      community_college: 'CC Alpha', community_college_id: 10,
      major: 'Computer Science B.S.',
      requirement_groups: oneGroup([
        recv([opt(['calcA'])], { hash: 'r-calc2', parentId: 101 }), // shares calcA with School 1
        recv([opt(['ds1'])], { hash: 'r-ds', parentId: 104 }),
      ]),
    },
    {
      // Choose-1-of-2 with an unarticulated alternative — the phantom-blocker
      // case the fix targets: articulate 1 of the 2 and the campus minimum is met.
      uc_school: 'UC Choose', uc_school_id: 3,
      community_college: 'CC Gamma', community_college_id: 30,
      major: 'Computer Science B.S.',
      requirement_groups: [{
        is_required: true, group_conjunction: 'And', group_advisement: null, group_unit_advisement: null,
        sections: [{
          section_advisement: 1, unit_advisement: null, receivers: [
            recv([opt(['calcG'])], { hash: 'r-choose-art', parentId: 201 }),
            recv([], { status: 'not_articulated', hash: 'r-choose-unart', parentId: 202 }),
          ],
        }],
      }],
    },
  ]);
  await db.collection('assist_courses').insertMany([
    { course_id: 'calcA', units: 5, community_college_id: 10, side: 'sending' },
    { course_id: 'cs1a', units: 3, community_college_id: 10, side: 'sending',
      concept: 'prog_1', concept_source: 'llm_session_v1', concept_confidence: 1 },
    { course_id: 'cs1b', units: 3, community_college_id: 10, side: 'sending',
      concept: 'prog_2', concept_source: 'llm_session_v1', concept_confidence: 1 },
    { course_id: 'calcB', units: 4, community_college_id: 20, side: 'sending' },
    { course_id: 'ds1', units: 4, community_college_id: 10, side: 'sending' },
    {
      course_id: 'ge1', units: 3, community_college_id: 10, side: 'sending',
      uc_transferable: true, igetc_area: ['1A'], prefix: 'ENGL', number: '1A',
    },
    { course_id: 'calcG', units: 4, community_college_id: 30, side: 'sending' },
  ]);

  // Curation: categories, an exclusion, calendars/tuition, prereqs, an ADT.
  await db.collection('curated_mappings').insertMany([
    { _id: 'course_category:101', kind: 'course_category', course_id: 'university:101', category: 'calculus', broad: 'math' },
    { _id: 'course_category:102', kind: 'course_category', course_id: 'university:102', category: 'intro_programming', broad: 'computing' },
    { _id: 'course_category:104', kind: 'course_category', course_id: 'university:104', category: 'data_structures', broad: 'computing' },
    { _id: 'receiver_override:r-reco', kind: 'receiver_override', receiver_hash: 'r-reco', exclude: true },
  ]);
  await db.collection('assist_institutions').insertMany([
    { _id: 'uc:1', source_id: 1, kind: 'university', academic_calendar: 'quarter', tuition_per_credit_usd: 100 },
    { _id: 'uc:2', source_id: 2, kind: 'university', academic_calendar: 'semester' },
    { _id: 'cc:10', source_id: 10, kind: 'community_college', district: 'North', region: 'Bay', counties_served: ['Alpha'] },
    { _id: 'cc:20', source_id: 20, kind: 'community_college', district: 'North', region: 'Bay', counties_served: ['Alpha', 'Beta'] },
    { _id: 'cc:30', source_id: 30, kind: 'community_college', district: 'South', region: 'Bay', counties_served: ['Gamma'] },
  ]);
  await db.collection('curated_requirements').insertMany([
    {
      _id: 'transfer_minimum:uct-calc-a', kind: 'transfer_minimum', school_id: 1, school: 'UC Test', uc_code: 'UCT',
      group_id: 'Calc', set_id: 'A', source_order: 0,
      receiving_code: 'CALC', parent_ids: [101], matched: true,
    },
    {
      _id: 'transfer_minimum:uco-alt-a', kind: 'transfer_minimum', school_id: 2, school: 'UC Other', uc_code: 'UCO',
      group_id: 'Either', set_id: 'A', source_order: 0,
      receiving_code: 'MISSING', parent_ids: [], matched: false,
    },
    {
      _id: 'transfer_minimum:uco-alt-b', kind: 'transfer_minimum', school_id: 2, school: 'UC Other', uc_code: 'UCO',
      group_id: 'Either', set_id: 'B', source_order: 1,
      receiving_code: 'DS', parent_ids: [104], matched: true,
    },
    {
      _id: 'degree:1', kind: 'degree', school_id: 1, school: 'UC Test',
      program: 'Computer Science B.S.', total_units: 120,
      requirement_groups: [
        {
          title: 'Lower-division major preparation', tier: 'transferable',
          sections: [{
            section_advisement: 2,
            receivers: [
              { receiving: { kind: 'course', parent_id: 101 } },
              { receiving: { kind: 'course', parent_id: 102 } },
            ],
          }],
        },
        {
          title: 'Reading & Composition', tier: 'breadth',
          sections: [{
            section_advisement: 1, ge_areas: ['1A'],
            receivers: [{
              receiving: { kind: 'ge_area', code: 'R1A', name: 'Reading & Composition A' },
              ge_areas: ['1A'],
            }],
          }],
        },
        {
          title: 'American History & Institutions', tier: 'transferable',
          sections: [{
            section_advisement: 1,
            receivers: [{
              receiving: { kind: 'ge_area', code: 'AHI', name: 'American History & Institutions' },
              assume_satisfiable: true,
            }],
          }],
        },
        {
          title: 'Upper-division coursework', tier: 'nontransferable',
          sections: [{
            section_advisement: 2,
            unit_advisement: 12,
            receivers: [
              { receiving: { kind: 'requirement', name: 'Upper-division slot 1' } },
              { receiving: { kind: 'requirement', name: 'Upper-division slot 2' } },
            ],
          }],
        },
      ],
    },
    { _id: 'prereq_concept:prog_1', kind: 'prereq_concept', legacy_id: 'prog_1',
      slug: 'prog_1', name: 'Programming I', discipline: 'cs', requires: [] },
    { _id: 'prereq_concept:prog_2', kind: 'prereq_concept', legacy_id: 'prog_2',
      slug: 'prog_2', name: 'Programming II', discipline: 'cs', requires: ['prog_1'] },
  ]);
  await db.collection('curated_requirements').insertMany([
    {
      _id: 'associate_degree:10:CS ADT', kind: 'associate_degree', institution_id: 'cc:10',
      community_college_id: 10, name: 'CS ADT',
      course_ids: ['cc:calcA', 'cc:cs1a', 'cc:cs1b', 'cc:ge1'], units: null,
    },
  ]);
}, 60_000);

afterAll(async () => { await mongo.stop(); });

const P = { scope: 'uc', majorContains: 'computer science' };

describe('coverageData', () => {
  it('counts required receivers minus curation exclusions', async () => {
    const rows = await coverageData(db, db, P);
    const alpha = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha.receivers_required).toBe(2); // r-reco excluded
    expect(alpha.receivers_articulated).toBe(2);
    expect(alpha.fully_articulated).toBe(true);
    expect(alpha.community_college_district).toBe('North');
    expect(alpha.community_college_counties).toEqual(['Alpha']);
    const beta = rows.find((r) => r.community_college_id === 20);
    expect(beta.pct_articulated).toBe(50);
    expect(beta.fully_articulated).toBe(false);
  });

  it('honors choose-N: an unarticulated alternative does not block when the minimum is met', async () => {
    const rows = await coverageData(db, db, P);
    const gamma = rows.find((r) => r.community_college_id === 30 && r.school_id === 3);
    // section_advisement=1 (choose 1 of 2) → the true minimum is 1, and it articulates,
    // so coverage is 100% of the minimum (not the naive 1/2 receiver count).
    expect(gamma.pct_articulated).toBe(100);
    expect(gamma.fully_articulated).toBe(true);
  });

  it('groups by district/county using best-of articulation across member colleges', async () => {
    const districtRows = await coverageData(db, db, { ...P, groupBy: 'district' });
    const district = districtRows.find((r) => r.row_group_label === 'North' && r.school_id === 1);
    expect(district.community_college_ids).toEqual([10, 20]);
    expect(district.receivers_required).toBe(2);
    expect(district.receivers_articulated).toBe(2);
    expect(district.fully_articulated).toBe(true);

    const countyRows = await coverageData(db, db, { ...P, groupBy: 'county' });
    const betaCounty = countyRows.find((r) => r.row_group_label === 'Beta' && r.school_id === 1);
    expect(betaCounty.community_college_ids).toEqual([20]);
    expect(betaCounty.pct_articulated).toBe(50);
  });

  it('uses the systemwide canonical template even in a district containing only an outlier', async () => {
    const major = 'Canonical Template Audit B.S.';
    const agreements = [
      {
        _id: 'canonical-template:a', uc_school: 'UC Canonical', uc_school_id: 901,
        community_college: 'Canonical College A', community_college_id: 9011,
        major,
        requirement_groups: oneGroup([
          recv([opt(['canonical-a'])], { hash: 'canonical-core', parentId: 9101 }),
        ]),
      },
      {
        _id: 'canonical-template:b', uc_school: 'UC Canonical', uc_school_id: 901,
        community_college: 'Canonical College B', community_college_id: 9012,
        major,
        requirement_groups: oneGroup([
          recv([], {
            status: 'not_articulated', hash: 'canonical-core', parentId: 9101,
          }),
        ]),
      },
      {
        _id: 'canonical-template:outlier', uc_school: 'UC Canonical', uc_school_id: 901,
        community_college: 'Outlier College', community_college_id: 9013,
        major,
        requirement_groups: oneGroup([
          recv([opt(['outlier-a'])], { hash: 'outlier-a', parentId: 9201 }),
          recv([opt(['outlier-b'])], { hash: 'outlier-b', parentId: 9202 }),
        ]),
      },
    ];
    const institutions = [
      { _id: 'cc:9011', source_id: 9011, kind: 'community_college',
        name: 'Canonical College A', district: 'Canonical District A', counties_served: ['A'] },
      { _id: 'cc:9012', source_id: 9012, kind: 'community_college',
        name: 'Canonical College B', district: 'Canonical District B', counties_served: ['B'] },
      { _id: 'cc:9013', source_id: 9013, kind: 'community_college',
        name: 'Outlier College', district: 'Outlier District', counties_served: ['C'] },
    ];

    await db.collection('assist_agreements').insertMany(agreements);
    await db.collection('assist_institutions').insertMany(institutions);
    try {
      const selected = _selectCanonicalAssistTemplate(agreements);
      expect(selected.nativeDemand).toBe(1);
      expect(selected.requirementGroups[0].sections[0].receivers
        .map((receiver) => receiver.hash_id)).toEqual(['canonical-core']);

      const rows = await coverageData(db, db, {
        majorContains: 'Canonical Template Audit', groupBy: 'district',
      });
      const canonical = rows.find((row) => row.row_group_label === 'Canonical District A');
      const outlier = rows.find((row) => row.row_group_label === 'Outlier District');

      expect(canonical).toMatchObject({
        receivers_required: 1,
        receivers_articulated: 1,
        pct_articulated: 100,
        fully_articulated: true,
      });
      // The two articulated outlier hashes are not part of the canonical UC
      // structure. The absent canonical-core identity stays unarticulated.
      expect(outlier).toMatchObject({
        receivers_required: 1,
        receivers_articulated: 0,
        pct_articulated: 0,
        fully_articulated: false,
      });

      await expect(coverageData(db, db, {
        majorSlug: 'cs',
        majorPrograms: {
          901: [major],
          902: ['Missing Configured Program B.S.'],
        },
        groupBy: 'district',
        requireCompleteDistrictMatrix: true,
      })).rejects.toMatchObject({
        code: 'incomplete_coverage_matrix',
        statusCode: 409,
        missingTemplates: ['uc|902|Missing Configured Program B.S.'],
      });
    } finally {
      await db.collection('assist_agreements').deleteMany({
        _id: { $in: agreements.map((agreementRow) => agreementRow._id) },
      });
      await db.collection('assist_institutions').deleteMany({
        _id: { $in: institutions.map((institution) => institution._id) },
      });
    }
  });

  it('can evaluate curated paper requirements instead of all ASSIST-required receivers', async () => {
    const rows = await coverageData(db, db, { ...P, requirements: 'paper' });
    const beta = rows.find((r) => r.community_college_id === 20 && r.school_id === 1);
    expect(beta.requirements).toBe('paper');
    expect(beta.receivers_required).toBe(1);
    expect(beta.receivers_articulated).toBe(1);
    expect(beta.fully_articulated).toBe(true); // r-cs1 is missing, but not in the curated hard set.

    const alphaOther = rows.find((r) => r.community_college_id === 10 && r.school_id === 2);
    expect(alphaOther.requirement_groups_required).toBe(1);
    expect(alphaOther.requirement_groups_satisfied).toBe(1);
    expect(alphaOther.fully_articulated).toBe(true); // alternative set B is satisfied.
  });

  it('reports a per-group verdict so course-level figures can see which demand fails', async () => {
    const rows = await coverageData(db, db, { ...P, requirements: 'paper' });

    const beta = rows.find((r) => r.community_college_id === 20 && r.school_id === 1);
    expect(beta.requirement_groups).toEqual([
      { group_id: 'Calc', satisfied: true, receivers_required: 1, receivers_articulated: 1 },
    ]);

    const alphaOther = rows.find((r) => r.community_college_id === 10 && r.school_id === 2);
    expect(alphaOther.requirement_groups.every((g) => g.satisfied)).toBe(true);
    expect(alphaOther.requirement_groups).toHaveLength(alphaOther.requirement_groups_required);
  });

  it('uses modeled graduation units as primary coverage while retaining requirement slots', async () => {
    const rows = await coverageData(db, db, { ...P, requirements: 'degree' });

    // Degree mode is a complete matrix, including a college with no agreement
    // for this campus. Its universally satisfiable AHI slot still counts.
    expect(rows).toHaveLength(3);
    const alpha = rows.find((r) => r.community_college_id === 10);
    expect(alpha).toMatchObject({
      requirements: 'degree',
      requirements_source: 'curated_requirements.degree',
      degree_requirements_total: 6,
      degree_requirements_with_equivalent: 4,
      receivers_required: 6,
      receivers_articulated: 4,
      pct_degree_requirements: 66.7,
      degree_requirement_slots_total: 6,
      degree_requirement_slots_with_equivalent: 4,
      pct_degree_requirement_slots: 66.7,
      degree_unit_system: 'quarter',
      degree_units_stated_minimum: 120,
      degree_units_modeled_total: 28,
      degree_units_with_equivalent: 16,
      pct_degree_units: 57.1,
      pct_articulated: 57.1,
      fully_articulated: false,
    });
    expect(alpha.degree_requirements_by_tier).toMatchObject({
      transferable: { total: 3, covered: 3 },
      breadth: { total: 1, covered: 1 },
      nontransferable: { total: 2, covered: 0 },
    });

    // Course types partition the same slots, so they always re-sum to the total.
    const types = alpha.degree_requirements_by_course_type;
    expect(Object.keys(types).sort()).toEqual(['computing', 'math', 'non_stem', 'science']);
    expect(Object.values(types).reduce((sum, t) => sum + t.total, 0))
      .toBe(alpha.degree_requirement_slots_total);
    expect(Object.values(types).reduce((sum, t) => sum + t.covered, 0))
      .toBe(alpha.degree_requirement_slots_with_equivalent);

    const beta = rows.find((r) => r.community_college_id === 20);
    expect(beta).toMatchObject({
      receivers_required: 6,
      receivers_articulated: 2,
      pct_degree_requirement_slots: 33.3,
      degree_units_with_equivalent: 8,
      pct_articulated: 28.6,
    });
    const gamma = rows.find((r) => r.community_college_id === 30);
    expect(gamma).toMatchObject({
      receivers_required: 6,
      receivers_articulated: 1,
      pct_degree_requirement_slots: 16.7,
      degree_units_with_equivalent: 4,
      pct_articulated: 14.3,
    });
  });

  it('pools degree equivalencies across colleges for district rows', async () => {
    const rows = await coverageData(db, db, { ...P, requirements: 'degree', groupBy: 'district' });
    const north = rows.find((r) => r.row_group_label === 'North');
    expect(north.community_college_ids).toEqual([10, 20]);
    expect(north).toMatchObject({
      receivers_required: 6,
      receivers_articulated: 4,
      pct_degree_requirement_slots: 66.7,
      pct_articulated: 57.1,
    });
  });
});

describe('canonical CS pins', () => {
  it('are the cs entry programs from the majors config', () => {
    expect(_canonicalCsPrograms).toEqual(getMajor('cs').programs);
  });

  it('preserve the stored trailing space in the Merced program name', () => {
    expect(_canonicalCsPrograms[144]).toEqual(['COMPUTER SCIENCE AND ENGINEERING, B.S. ']);
  });

  it('cover exactly the nine figure campuses with one program each', () => {
    expect(Object.keys(_canonicalCsPrograms).map(Number).sort((a, b) => a - b))
      .toEqual([7, 46, 79, 89, 117, 120, 128, 132, 144]);
    expect(Object.values(_canonicalCsPrograms).every((programs) => programs.length === 1)).toBe(true);
  });
});

describe('settingsMajors compatibility alias', () => {
  afterAll(async () => {
    // Leave no working-dataset selection behind for the other suites.
    await db.collection('settings').deleteOne({ _id: 'app' });
  });

  it('ignores the retired mutable selection and always returns canonical CS', async () => {
    await db.collection('settings').replaceOne(
      { _id: 'app' },
      {
        _id: 'app',
        visible_pairs: [
          { school_id: 79, major: 'Computer Science, B.A.' }, // retired alternative, ignored
          { school_id: 99999, major: 'Not A Figure Campus' }, // ignored: outside the nine campuses
        ],
      },
      { upsert: true }
    );

    const byCampus = await _settingsMajors(db);

    // The old settings choice cannot reintroduce a noncanonical program.
    expect(byCampus.get(79)).toEqual(['Electrical Engineering & Computer Sciences, B.S.']);
    expect(byCampus.get(89)).toEqual(_canonicalCsPrograms[89]);
    expect(byCampus.has(99999)).toBe(false);
    expect([...byCampus.keys()].sort((a, b) => a - b))
      .toEqual(Object.keys(_canonicalCsPrograms).map(Number).sort((a, b) => a - b));
  });

  it('returns the same canonical mapping when no setting exists', async () => {
    await db.collection('settings').deleteOne({ _id: 'app' });
    const byCampus = await _settingsMajors(db);
    expect(byCampus.get(79)).toEqual(_canonicalCsPrograms[79]);
  });
});

describe('requirementComparisonData', () => {
  it('lists the website minimum and only the courses ASSIST adds on top', async () => {
    const cmp = await requirementComparisonData(db, db, {
      schoolId: 1, major: 'Computer Science B.S.', communityCollegeId: 10,
    });
    // Website hard-minimum is just calculus (parent 101), which Alpha articulates.
    expect(cmp.website).toMatchObject({ required: 1, articulated: 1, pct: 100, fully: true });
    // ASSIST asks for calculus + intro programming (r-reco is curation-excluded).
    expect(cmp.assist).toMatchObject({ required: 2, articulated: 2, pct: 100, fully: true });
    // Intro programming (102) is the one course ASSIST adds beyond the website min.
    expect(cmp.assist_extra).toBe(1);
    expect(cmp.assist_extra_articulated).toBe(1);
    expect(cmp.net_courses).toBe(1); // ASSIST minimum is one course larger
    // Website list: calculus, flagged as also in the ASSIST minimum.
    const calc = cmp.website_requirements.find((r) => r.parent_id === 101);
    expect(calc).toMatchObject({ articulated: true, in_assist: true });
    // Extra list: a single required course (intro programming), articulated via cs1a + cs1b.
    expect(cmp.assist_extra_groups).toHaveLength(1);
    const g = cmp.assist_extra_groups[0];
    expect(g.choose).toBe(1);
    expect(g.options).toHaveLength(1);
    expect(g.options[0].parent_id).toBe(102);
    expect(g.options[0].cc_options[0]).toHaveLength(2);
  });

  it('choose-N covered by the website minimum is not counted as an extra', async () => {
    // The UCB shape: a "choose 1 of {A(in website), B}" section is already
    // satisfied by the website course A, so B is NOT an extra requirement.
    await db.collection('assist_agreements').insertOne({
      uc_school: 'UC Choose2', uc_school_id: 5,
      community_college: 'CC Delta', community_college_id: 40,
      major: 'Computer Science B.S.',
      requirement_groups: [{
        is_required: true, group_conjunction: 'And', group_advisement: null, group_unit_advisement: null,
        sections: [{
          section_advisement: 1, unit_advisement: null, receivers: [
            recv([opt(['calcD'])], { hash: 'r-in-web', parentId: 301 }),          // in the website min
            recv([], { status: 'not_articulated', hash: 'r-extra', parentId: 302 }), // an unchosen alternative
          ],
        }],
      }],
    });
    await db.collection('assist_courses').insertOne({ course_id: 'calcD', units: 4, community_college_id: 40, side: 'sending' });
    await db.collection('curated_requirements').insertOne({
      _id: 'transfer_minimum:uch2-a', kind: 'transfer_minimum', school_id: 5, school: 'UC Choose2', uc_code: 'UCH2',
      group_id: 'G', set_id: 'A', source_order: 0, receiving_code: 'CALC', parent_ids: [301], matched: true,
    });

    const cmp = await requirementComparisonData(db, db, {
      schoolId: 5, major: 'Computer Science B.S.', communityCollegeId: 40,
    });
    expect(cmp.website).toMatchObject({ required: 1, articulated: 1, fully: true });
    expect(cmp.assist).toMatchObject({ required: 1, articulated: 1, fully: true });
    // The website course 301 satisfies the choose-1 → nothing extra, no false gap.
    expect(cmp.assist_extra).toBe(0);
    expect(cmp.assist_extra_groups).toEqual([]);
  });

  it('ships full catalog rows (title + units) for both sides of every emitted row', async () => {
    await db.collection('assist_agreements').insertOne({
      uc_school: 'UC Rich', uc_school_id: 7,
      community_college: 'CC Zeta', community_college_id: 60,
      major: 'Computer Science B.S.',
      // Numeric course_id, as stored in the real catalog (the CC enrichment
      // resolves ids via Number()).
      requirement_groups: oneGroup([recv([opt([9001])], { hash: 'r-rich', parentId: 501 })]),
    });
    await db.collection('assist_courses').insertMany([
      { course_id: 9001, units: 5, community_college_id: 60, side: 'sending',
        prefix: 'MATH', number: '1A', title: 'Calculus I' },
      { parent_id: 501, side: 'receiving', prefix: 'MATH', number: '16A',
        title: 'Analytic Geometry and Calculus', min_units: 3, max_units: 3 },
    ]);
    await db.collection('curated_requirements').insertOne({
      _id: 'transfer_minimum:ucr-a', kind: 'transfer_minimum', school_id: 7, school: 'UC Rich', uc_code: 'UCR',
      group_id: 'G', set_id: 'A', source_order: 0, receiving_code: 'CALC', parent_ids: [501], matched: true,
    });

    const cmp = await requirementComparisonData(db, db, {
      schoolId: 7, major: 'Computer Science B.S.', communityCollegeId: 60,
    });
    // The row's uc_code is upgraded to the authoritative catalog code, and the
    // full receiving row rides in university_courses for the ledger to render.
    expect(cmp.website_requirements[0].uc_code).toBe('MATH 16A');
    expect(cmp.university_courses[501]).toMatchObject({
      prefix: 'MATH', number: '16A', title: 'Analytic Geometry and Calculus', min_units: 3, max_units: 3,
    });
    // cc_options carries the code; cc_courses resolves it to title + units.
    expect(cmp.website_requirements[0].cc_options).toEqual([['MATH 1A']]);
    expect(cmp.cc_courses['MATH 1A']).toMatchObject({
      prefix: 'MATH', number: '1A', title: 'Calculus I', units: 5,
    });
  });

  it('finds the agreement when the stored major has trailing whitespace', async () => {
    // Some ASSIST program names are stored with a trailing space (e.g. UC
    // Merced's CSE B.S.); the caller sends the trimmed name, so the lookup
    // must not depend on an exact string match or the ASSIST side goes empty.
    await db.collection('assist_agreements').insertOne({
      uc_school: 'UC Space', uc_school_id: 6,
      community_college: 'CC Epsilon', community_college_id: 50,
      major: 'Computer Science B.S. ', // trailing space, as stored
      requirement_groups: oneGroup([recv([opt(['calcE'])], { hash: 'r-sp', parentId: 401 })]),
    });
    await db.collection('assist_courses').insertOne({ course_id: 'calcE', units: 4, community_college_id: 50, side: 'sending' });

    const cmp = await requirementComparisonData(db, db, {
      schoolId: 6, major: 'Computer Science B.S.', communityCollegeId: 50, // trimmed
    });
    expect(cmp.assist.required).toBe(1); // agreement found despite the trailing space
    expect(cmp.assist.fully).toBe(true);
  });
});

describe('creditLossData', () => {
  it('solves min courses, joins units, flags many-to-one, normalizes calendars', async () => {
    const rows = await creditLossData(db, db, P);
    const alpha = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha.min_cc_courses).toBe(3);        // calcA + cs1a + cs1b
    expect(alpha.min_cc_units).toBe(11);         // 5 + 3 + 3
    expect(alpha.many_to_one).toBe(1);           // intro programming takes 2 CC courses
    expect(alpha.campus_calendar).toBe('quarter');
    expect(alpha.semester_equiv_required).toBe(1.33); // 2 receivers × 2/3, rounded to 2dp
    expect(alpha.district).toBe('North');
    const beta = rows.find((r) => r.community_college_id === 20);
    expect(beta.receivers_blocked).toBe(1);
  });
});

describe('choiceCostData', () => {
  it('reports incremental courses per added school, reusing overlap', async () => {
    const rows = await choiceCostData(db, db, { ...P, schoolIds: [1, 2] });
    const alpha = rows.find((r) => r.community_college_id === 10);
    const [first, second] = alpha.steps;
    expect(first.additional_courses).toBe(3);  // calcA, cs1a, cs1b
    expect(second.additional_courses).toBe(1); // ds1 only — calcA already taken
    expect(alpha.total_courses).toBe(4);
  });
});

describe('categoryGapsData', () => {
  it('rolls missing articulation up per school × category', async () => {
    const rows = await categoryGapsData(db, db, P);
    const introAtSchool1 = rows.find((r) => r.school_id === 1 && r.category === 'intro_programming');
    expect(introAtSchool1.ccs_with_requirement).toBe(2);
    expect(introAtSchool1.ccs_missing_articulation).toBe(1); // CC Beta
    expect(introAtSchool1.pct_missing).toBe(50);
    const calcAtSchool1 = rows.find((r) => r.school_id === 1 && r.category === 'calculus');
    expect(calcAtSchool1.ccs_missing_articulation).toBe(0);
  });
});

describe('complexityData', () => {
  it('computes delay/blocking over the curated prereq graph', async () => {
    const rows = await complexityData(db, db, P);
    const alpha = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha.n_courses).toBe(3);
    expect(alpha.n_prereq_edges).toBe(1); // cs1a → cs1b
    expect(alpha.max_delay).toBe(2);      // chain cs1a → cs1b
    const cs1b = alpha.per_course.find((c) => c.key === 'cc:cs1b');
    const cs1a = alpha.per_course.find((c) => c.key === 'cc:cs1a');
    expect(cs1b.delay).toBe(2);
    expect(cs1a.blocking).toBe(1);
  });
});

describe('receiversExportData', () => {
  it('flattens one row per receiver with agreement + group context and raw options', async () => {
    const rows = await receiversExportData(db, db, P);
    const alpha = rows.filter((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha).toHaveLength(3); // includes the curation-excluded one — exports are raw
    const calc = alpha.find((r) => r.hash_id === 'r-calc');
    expect(calc.kind).toBe('course');
    expect(calc.parent_ids).toEqual([101]);
    expect(calc.is_required).toBe(true);
    expect(calc.articulation_status).toBe('articulated');
    expect(calc.options[0].course_ids).toEqual(['calcA']);
    const missing = rows.find((r) => r.community_college_id === 20 && r.hash_id === 'r-cs1');
    expect(missing.articulation_status).toBe('not_articulated');
    expect(missing.n_options).toBe(0);
  });

  it('honors the visibility pair scope', async () => {
    const rows = await receiversExportData(db, db, {
      ...P, visiblePairs: [{ school_id: 2, major: 'Computer Science B.S.' }],
    });
    expect(rows.every((r) => r.school_id === 2)).toBe(true);
  });
});

describe('timeToDegreeData', () => {
  it('computes the transfer credit rate + costed lost units for curated ADTs', async () => {
    const rows = await timeToDegreeData(db, db, P);
    const adt = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(adt.assoc_degree).toBe('CS ADT');
    expect(adt.assoc_degree_units).toBe(14);   // 5+3+3+3
    expect(adt.transferable_units).toBe(11);   // ge1 doesn't map
    expect(adt.transfer_credit_rate_pct).toBeCloseTo(78.6, 1);
    expect(adt.lost_units).toBe(3);
    expect(adt.est_lost_cost_usd).toBe(300);
  });
});

describe('exact configured major isolation', () => {
  beforeAll(async () => {
    await db.collection('assist_institutions').insertMany([
      {
        _id: 'uc:79', source_id: 79, kind: 'university', name: 'UC Berkeley',
        academic_calendar: 'semester',
      },
      {
        _id: 'cc:70', source_id: 70, kind: 'community_college', name: 'Scope College',
        district: 'Scope District', region: 'Bay', counties_served: ['Scope'],
      },
    ]);
    await db.collection('assist_courses').insertMany([
      { course_id: 'scope-extra', units: 4, community_college_id: 70, side: 'sending' },
      { parent_id: 701, side: 'receiving', prefix: 'EECS', number: '16A', min_units: 4, max_units: 4 },
      { parent_id: 702, side: 'receiving', prefix: 'CSE', number: '8A', min_units: 4, max_units: 4 },
    ]);
    await db.collection('assist_agreements').insertMany([
      {
        _id: 'scope:canonical-cs', uc_school: 'UC Berkeley', uc_school_id: 79,
        community_college: 'Scope College', community_college_id: 70,
        major: 'Electrical Engineering & Computer Sciences, B.S.',
        requirement_groups: oneGroup([
          recv([], { status: 'not_articulated', hash: 'scope-canonical', parentId: 701 }),
        ]),
      },
      {
        _id: 'scope:extra-cs', uc_school: 'UC Berkeley', uc_school_id: 79,
        community_college: 'Scope College', community_college_id: 70,
        major: 'Computer Science, B.A.',
        requirement_groups: oneGroup([
          recv([opt(['scope-extra'])], { hash: 'scope-extra', parentId: 701 }),
        ]),
      },
      {
        _id: 'scope:bio', uc_school: 'UC Berkeley', uc_school_id: 79,
        community_college: 'Scope College', community_college_id: 70,
        major: 'Molecular and Cell Biology, B.A.',
        requirement_groups: oneGroup([
          recv([opt(['scope-extra'])], { hash: 'scope-bio', parentId: 701 }),
        ]),
      },
      {
        _id: 'scope:econ', uc_school: 'UC Berkeley', uc_school_id: 79,
        community_college: 'Scope College', community_college_id: 70,
        major: 'Economics, B.A.',
        requirement_groups: oneGroup([
          recv([opt(['scope-extra'])], { hash: 'scope-econ', parentId: 701 }),
        ]),
      },
    ]);
    await db.collection('curated_requirements').insertMany([
      {
        _id: 'degree:scope:cs', kind: 'degree', major_slug: 'cs', school_id: 79,
        school: 'UC Berkeley', program: 'Electrical Engineering & Computer Sciences, B.S.',
        requirement_groups: oneGroup([{ receiving: { kind: 'course', parent_id: 701 } }]),
      },
      {
        _id: 'degree:scope:cs-mislabeled', kind: 'degree', major_slug: 'cs', school_id: 79,
        school: 'UC Berkeley', program: 'Computer Science, B.A.',
        requirement_groups: oneGroup([{ receiving: { kind: 'course', parent_id: 701 } }]),
      },
      {
        // Legacy CS templates predate major_slug and use catalog-facing labels
        // that differ from their ASSIST program pin.
        _id: 'degree:scope:cs-legacy', kind: 'degree', school_id: 7,
        school: 'UC San Diego', program: 'Computer Science, B.S. (CS26)',
        requirement_groups: oneGroup([{ receiving: { kind: 'course', parent_id: 702 } }]),
      },
      {
        _id: 'degree:scope:bio', kind: 'degree', major_slug: 'bio', school_id: 79,
        school: 'UC Berkeley', program: 'Molecular and Cell Biology, B.A.',
        requirement_groups: oneGroup([{ receiving: { kind: 'course', parent_id: 701 } }]),
      },
      {
        _id: 'degree:scope:econ', kind: 'degree', major_slug: 'econ', school_id: 79,
        school: 'UC Berkeley', program: 'Economics, B.A.',
        requirement_groups: oneGroup([{ receiving: { kind: 'course', parent_id: 701 } }]),
      },
    ]);
  });

  it('majorSlug=cs resolves inside the service and excludes other and variant programs', async () => {
    const rows = await agreementsExportData(db, db, { majorSlug: 'cs' });
    expect(rows.map((row) => row._id)).toEqual(['scope:canonical-cs']);

    // The explicit legacy substring remains available and demonstrates why a
    // configured slug must not silently degrade to it.
    const legacy = await agreementsExportData(db, db, { majorContains: 'computer science' });
    expect(legacy.map((row) => row._id)).toContain('scope:extra-cs');
  });

  it.each(['paper', 'settings'])('%s compatibility pin cannot restore an extra CS program', async (pin) => {
    const rows = await coverageData(db, db, { majorSlug: 'cs', pin });
    const scoped = rows.filter((row) => row.community_college_id === 70);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]).toMatchObject({
      school_id: 79,
      major: 'Electrical Engineering & Computer Sciences, B.S.',
      receivers_articulated: 0,
    });
  });

  it('choice cost deterministically uses the configured canonical program', async () => {
    const rows = await choiceCostData(db, db, { majorSlug: 'cs', schoolIds: [79] });
    const scopeCollege = rows.find((row) => row.community_college_id === 70);
    expect(scopeCollege.steps).toEqual([{
      school_id: 79,
      school: 'UC Berkeley',
      has_agreement: true,
      additional_courses: 0,
      blocked_receivers: 1,
    }]);
    expect(scopeCollege.total_courses).toBe(0);
  });

  it('the per-college comparison does not pool articulation from a sibling CS program', async () => {
    const comparison = await requirementComparisonData(db, db, {
      schoolId: 79,
      major: 'Electrical Engineering & Computer Sciences, B.S.',
      communityCollegeId: 70,
    });
    expect(comparison.assist).toMatchObject({ required: 1, articulated: 0, fully: false });
  });

  it('degree coverage isolates CS templates and exact CS articulation rows', async () => {
    const rows = await coverageData(db, db, {
      majorSlug: 'cs', requirements: 'degree',
    });
    expect([...new Set(rows.map((row) => row.degree_template_id))].sort()).toEqual([
      'degree:scope:cs',
      'degree:scope:cs-legacy',
    ]);
    const berkeley = rows.find((row) =>
      row.degree_template_id === 'degree:scope:cs' && row.community_college_id === 70);
    // The extra CS, Biology, and Economics agreements all articulate parent
    // 701. Exact pair scoping keeps all three from inflating this CS cell.
    expect(berkeley).toMatchObject({
      degree_requirements_total: 1,
      degree_requirements_with_equivalent: 0,
      pct_degree_requirement_slots: 0,
    });
  });
});
