import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_RECEIPT_SHA256,
  REAL_PAIR_NAMED_ELIGIBILITY,
  ROUTE_CODES,
  ROUTE_IDS,
  exactCarrier,
  newRiverVariableCategoryNegativeProof,
  newRiverVirginiaTechAgreementFingerprint,
  newRiverVirginiaTechFigure34PairProof,
  newRiverVirginiaTechFigure34Readiness,
} from './newRiverConstraintProofs';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import {
  courseIdFor,
  institutionCourseIdFor,
} from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { readinessForProjectedFigures } from '../virginia/publicationReadiness';

const require = createRequire(import.meta.url);
const { startInMemoryMongo } = require('../../test/mongoHarness');
const { transferCreditRateData } = require('./transferCreditRate');

const NEW_RIVER_ID = 'va:as:new-river-community-college:cs';
const VIRGINIA_TECH_ID =
  'va:degree:virginia-polytechnic-institute-and-state-university:cs';
const VIRGINIA_TECH_OWNER = 'va:uni:9230';

function source(id) {
  return structuredClone(cachedAcceptedSourcePlan().documents.find((row) => row._id === id));
}

function option(code, id) {
  return {
    course_ids: [id],
    course_keys: [`va:${code}`],
    course_conjunction: 'and',
  };
}

function receiver({ code, parentId, id, articulated = true, note = null, units = 3 }) {
  return {
    articulation_status: articulated ? 'articulated' : 'not_articulated',
    not_articulated_reason: null,
    options: articulated ? [option(code === 'CS2505' ? 'CSC205' : 'MTH266', id)] : [],
    options_conjunction: 'or',
    hash_id: null,
    tier: null,
    course_level: null,
    cc_articulable: null,
    overlap_key: null,
    note,
    receiving: { kind: 'course', parent_id: parentId, units },
    code_seen: code,
    human_review: null,
  };
}

function section({ label = null, course, alternate }) {
  return {
    section_advisement: 1,
    unit_advisement: 3,
    unit_advisement_max: 3,
    label_seen: label,
    tier: 'transferable',
    course_level: label ? 'mixed' : 'lower_division',
    cc_articulable: true,
    source_refs: ['major', 'course_catalog'],
    note: null,
    overlap_key: null,
    human_review: null,
    analysis_constraints: [],
    assume_satisfiable: false,
    receivers: [course, alternate],
  };
}

function agreement() {
  const sections = Array.from({ length: 6 }, () => ({ receivers: [] }));
  sections[1] = section({
    course: receiver({
      code: 'CS2505',
      parentId: institutionCourseIdFor(VIRGINIA_TECH_OWNER, 'CS2505'),
      id: 1072566431,
    }),
    alternate: receiver({
      code: 'ECE2564',
      parentId: institutionCourseIdFor(VIRGINIA_TECH_OWNER, 'ECE2564'), id: null,
      articulated: false, note: 'Published substitution for CS 2505.',
    }),
  });
  sections[5] = section({
    label: 'Linear algebra slot',
    course: receiver({
      code: 'MATH2114',
      parentId: institutionCourseIdFor(VIRGINIA_TECH_OWNER, 'MATH2114'),
      id: 1032049332,
    }),
    alternate: receiver({
      code: 'MATH2405H',
      parentId: institutionCourseIdFor(VIRGINIA_TECH_OWNER, 'MATH2405H'),
      id: null, units: 5,
      articulated: false,
      note: 'Conditional honors substitution; must pair with MATH 2406H to receive the combined substitution.',
    }),
  });
  return {
    _id: 'va:agreement:9230:9311',
    university_id: 'va:uni:virginia-polytechnic-institute-and-state-university',
    college_id: 'va:cc:new-river-community-college',
    uc_school_id: 9230,
    community_college_id: 9311,
    university_name: 'Virginia Polytechnic Institute and State University',
    college_name: 'New River Community College',
    major: 'Computer Science, B.S.',
    state: 'va',
    source: 'derived from Transfer Virginia course equivalencies × published degree requirements',
    pairing: 'course-equivalency-join',
    derived_from: {
      degree_id: 'va:degree:virginia-polytechnic-institute-and-state-university:cs',
      supply_edges: 185,
    },
    articulated_receivers: 13,
    considered_receivers: 36,
    requirement_groups: [{
      title: 'Degree Core Requirements',
      is_required: true,
      group_conjunction: 'And',
      requirement_layer: 'major',
      tier: 'transferable',
      course_level: 'mixed',
      cc_articulable: true,
      source_refs: ['major', 'course_catalog'],
      note: null,
      overlap_key: null,
      human_review: null,
      analysis_constraints: [{
        kind: 'honors_math_substitution_and_free_credit_adjustment',
        status: 'evaluator_not_implemented',
        description: 'MATH 2405H may independently replace MATH 2114. If MATH 2406H is used, it must be paired with MATH 2405H; the ten-credit pair replaces MATH 2114, MATH 2204, and four free-elective credits. Exact surplus-credit adjustment for the standalone five-credit MATH 2405H option is not published as a separate rule.',
      }],
      stated_credits: '24',
      distinct_course_ids_across_sections: false,
      sections,
    }],
  };
}

function unitMap() {
  return new Map(ROUTE_IDS.map((id) => [id, 3]));
}

function pairProof(overrides = {}) {
  return newRiverVirginiaTechFigure34PairProof({
    associateDocument: source(NEW_RIVER_ID),
    bachelorDocument: source(VIRGINIA_TECH_ID),
    agreements: [agreement()],
    directlyEligible: new Set(ROUTE_IDS),
    unitsById: unitMap(),
    ...overrides,
  });
}

function finalProjection() {
  const plan = cachedAcceptedSourcePlan();
  const degree = plan.documents.find((document) => document._id === VIRGINIA_TECH_ID);
  const asDegree = plan.documents.find((document) => document._id === NEW_RIVER_ID);
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9230);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9311);
  const institutions = [college, university].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  const supplies = [
    { code: 'CSC205', title: 'Computer Organization', target: 'CS2505' },
    { code: 'MTH266', title: 'Linear Algebra', target: 'MATH2114' },
  ].map((row) => ({
    course_id: courseIdFor(row.code),
    course_key: `va:${row.code}`,
    code: row.code,
    title: row.title,
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: row.target }],
  }));
  return buildProjection({
    courses: supplies,
    degrees: [degree],
    asDegrees: [asDegree],
    institutions,
  });
}

function withHumanReceipt(document) {
  const reviewed = structuredClone(document);
  reviewed.verification = {
    verified: true,
    stale: false,
    verified_at: '2026-08-24T00:00:00.000Z',
    verified_by: 'independent_reviewer',
    verified_by_label: 'Independent reviewer',
  };
  return reviewed;
}

function fileSha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sendingRowsFor(document) {
  const unitsById = new Map(ROUTE_IDS.map((id) => [id, 3]));
  for (const group of document.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiverRow of section.receivers || []) {
        for (const optionRow of receiverRow.options || []) {
          const ids = optionRow.course_ids || [];
          const units = Number(section.unit_advisement) / Math.max(1, ids.length);
          for (const id of ids) {
            if (Number.isFinite(units) && units > 0 && !unitsById.has(id)) {
              unitsById.set(id, units);
            }
          }
        }
      }
    }
  }
  return [...unitsById].map(([courseId, units]) => ({
    _id: `va:sending:${courseId}`,
    side: 'sending',
    state: 'va',
    course_id: courseId,
    units,
    min_units: units,
    max_units: units,
    uc_transferable: true,
  }));
}

describe('New River receiver-bound Figure 3/4 proof', () => {
  it('binds the exact retained source text and preserves the open categories', () => {
    const program = path.resolve(
      __dirname,
      '../../.va-catalogs/pages/new-river-community-college__program.txt',
    );
    const courseCatalog = path.resolve(
      __dirname,
      '../../.va-catalogs/pages/new-river-community-college__course_catalog.txt',
    );
    expect(fileSha256(program))
      .toBe('9d8cc1f06a98516558d5941210877af3bb5da5d193f0db64be484be9cf4482b7');
    expect(fileSha256(courseCatalog))
      .toBe('cb54ed984f146a4bb3b87d5eaba6bb905b44af8342ecd235e403d06f264185fd');
    const text = fs.readFileSync(program, 'utf8');
    expect(text).toContain('Computer Science - Requirement(s) (3cr) 3 credit(s)');
    expect(text).toContain('Computer Science - Requirement(s) (3-5cr) 3-5 credit(s)');
    expect(text).toContain('Total Minimum Credits: 61-63');
    expect(text).toContain('MTH 161-MTH 162');
    expect(text).toContain('PHY 241-PHY 242');
    expect(text).toContain('CSC 1XX, CSC 205, World Languages');
    // The retained index is explicitly only the first of six pages.  It is
    // not a complete world-language roster and must not be treated as one.
    expect(fs.readFileSync(courseCatalog, 'utf8')).toContain('Page: 1 | 2 | 3 | 4 | 5 | 6');
  });

  it('keeps the universal rule closed across the exact 16-row real-data probe', () => {
    const receipt = newRiverVariableCategoryNegativeProof(source(NEW_RIVER_ID));
    expect(receipt.ready).toBe(false);
    expect(receipt.supported).toBe(false);
    expect(receipt.affected_figures).toEqual(['3', '4']);
    expect(receipt.proof.real_receiver_pair_count).toBe(16);
    expect(receipt.proof.receiver_rows_remaining_closed).toBe(16);
    expect(receipt.proof.receiver_rows_with_pair_bound_lower_floor_witness).toEqual([]);
    expect(receipt.proof.rejected_receiver_row).toBe(9230);
    expect(receipt.proof.rejected_route_reason).toMatch(/CSC 205 requires CSC 215/i);
    expect(receipt.proof.open_categories).toEqual(['CSC 1XX', 'World Languages']);
    expect(REAL_PAIR_NAMED_ELIGIBILITY.map((row) => row.school_id)).toEqual([
      9205, 9206, 9210, 9213, 9214, 9217, 9218, 9219,
      9221, 9224, 9226, 9228, 9229, 9230, 9231, 9233,
    ]);
  });

  it('retracts the apparent six-credit route on the exact official edge condition', () => {
    expect(newRiverVirginiaTechAgreementFingerprint(agreement()))
      .toBe(AGREEMENT_RECEIPT_SHA256);
    const receipt = pairProof();
    expect(receipt.ready).toBe(false);
    expect(receipt.supported).toBe(false);
    expect(receipt.affected_figures).toEqual(['3', '4']);
    expect(receipt.reason).toMatch(/CSC 205.*CSC 215/i);
    expect(receipt.proof).toMatchObject({
      retracted_route_codes: ROUTE_CODES,
      conditional_route_units: 9,
      source_category_maximum_units: 8,
      receiver_bound: true,
      other_receiver_rows_opened: 0,
      figure_6_opened: false,
      prior_positive_capability_retracted: true,
      conditional_edge: {
        sending_code: 'CSC205',
        companion_sending_code: 'CSC215',
        receiving_identifier: 'CS2505',
        source_url:
          'https://www.transfervirginia.org/course/D37A690E1F9411F082AC0242AC15010A',
        notes: expect.stringMatching(/Must take CSC 205 \+ 215/),
      },
    });
    expect(Object.values(receipt.proof.unit_receipts)
      .every((row) => row.credits === 3)).toBe(true);
  });

  it('never resolves the pair constraint, even after an ordinary human receipt', () => {
    const projected = finalProjection();
    const current = projected.asDegrees[0];
    const currentPair = pairProof({
      associateDocument: current,
      bachelorDocument: projected.degrees[0],
    });
    const currentBase = readinessForProjectedFigures(current, {
      label: 'The associate-degree source',
      figures: ['3', '4'],
    });
    const currentAdjusted = newRiverVirginiaTechFigure34Readiness(
      current,
      currentBase,
      currentPair,
    );
    expect(currentAdjusted).toMatchObject({
      ready: false,
      source_pair_figure_capability: false,
      source_pair_figure_ready: false,
      source_pair_resolved_constraint_count: 0,
    });
    expect(currentAdjusted.blockers).toEqual([
      'current_human_verification_required',
      'associate_constraint_evaluator_required',
      'explicit_analysis_ready_projection_required',
    ]);

    const reviewed = withHumanReceipt(current);
    const reviewedPair = pairProof({
      associateDocument: reviewed,
      bachelorDocument: projected.degrees[0],
    });
    const reviewedAdjusted = newRiverVirginiaTechFigure34Readiness(
      reviewed,
      readinessForProjectedFigures(reviewed, {
        label: 'The associate-degree source',
        figures: ['3', '4'],
      }),
      reviewedPair,
    );
    expect(reviewedAdjusted).toMatchObject({
      ready: false,
      blockers: [
        'associate_constraint_evaluator_required',
        'explicit_analysis_ready_projection_required',
      ],
      source_pair_figure_capability: false,
      source_pair_figure_ready: false,
      source_pair_resolved_constraint_count: 0,
    });
  });

  it('has exact accepted-source/final-projection parity for both reviewed trees', () => {
    const projected = finalProjection();
    const sourceReceipt = pairProof();
    const projectionReceipt = pairProof({
      associateDocument: projected.asDegrees[0],
      bachelorDocument: projected.degrees[0],
    });
    expect(sourceReceipt.ready).toBe(false);
    expect(projectionReceipt.ready).toBe(false);
    expect(sourceReceipt.proof.document_style).toBe('accepted_source');
    expect(projectionReceipt.proof.document_style).toBe('final_projection');
    expect(sourceReceipt.proof.bachelor_document_style).toBe('accepted_source');
    expect(projectionReceipt.proof.bachelor_document_style).toBe('final_projection');
    for (const receipt of [sourceReceipt, projectionReceipt]) {
      delete receipt.proof.document_style;
      delete receipt.proof.bachelor_document_style;
    }
    expect(projectionReceipt.proof).toEqual(sourceReceipt.proof);
  });

  it('keeps the current unverified pair excluded with no evaluator capability', async () => {
    const mongo = await startInMemoryMongo();
    try {
      const db = mongo.client.db('new_river_vt_figure34_runtime');
      const projected = finalProjection();
      await db.collection('curated_requirements').insertMany([
        projected.asDegrees[0], projected.degrees[0],
      ]);
      await db.collection('assist_institutions').insertMany(projected.institutions);
      await db.collection('assist_courses').insertMany(
        sendingRowsFor(projected.asDegrees[0]),
      );
      await db.collection('assist_agreements').insertOne(agreement());

      const rows = await transferCreditRateData(db, null, {
        degreeType: 'local_as',
        majorSlug: 'va-cs',
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        community_college_id: 9311,
        school_id: 9230,
        method_status: 'excluded',
        source_figures_ready: false,
        source_pair_figure_capability: false,
        source_pair_figure_ready: false,
        source_pair_figure_capability_rule: null,
        source_conflict_count: 1,
        source_pair_resolved_conflict_count: 0,
        source_pair_unresolved_conflict_count: 1,
      });
      expect(rows[0].source_pair_figure_capability_proof).toBeNull();
      expect(rows[0].method_warning).toMatch(/human verification/i);
      expect(rows[0].rate).toBeNull();
      expect(rows[0].modeled_hours_above_120).toBeNull();
    } finally {
      await mongo.stop();
    }
  }, 60_000);

  it('keeps an otherwise reviewed clone excluded because the conditional edge is unresolved', async () => {
    const mongo = await startInMemoryMongo();
    try {
      const db = mongo.client.db('new_river_vt_figure34_reviewed_runtime');
      const projected = finalProjection();
      const associate = withHumanReceipt(projected.asDegrees[0]);
      const bachelor = withHumanReceipt(projected.degrees[0]);
      await db.collection('curated_requirements').insertMany([associate, bachelor]);
      await db.collection('assist_institutions').insertMany(projected.institutions);
      await db.collection('assist_courses').insertMany(sendingRowsFor(associate));
      await db.collection('assist_agreements').insertOne(agreement());

      const rows = await transferCreditRateData(db, null, {
        degreeType: 'local_as',
        majorSlug: 'va-cs',
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        community_college_id: 9311,
        school_id: 9230,
        method_status: 'excluded',
        source_figures_ready: false,
        source_pair_figure_capability: false,
        source_pair_figure_ready: false,
        source_conflict_count: 1,
        source_pair_resolved_conflict_count: 0,
        source_pair_unresolved_conflict_count: 1,
      });
      expect(rows[0].method_warning).toMatch(/associate_constraint_evaluator_required/i);
      expect(rows[0].rate).toBeNull();
      expect(rows[0].modeled_hours_above_120).toBeNull();
    } finally {
      await mongo.stop();
    }
  }, 60_000);

  it('keeps the pair proof source-only until both exact receiver edges are present', () => {
    const carrier = exactCarrier(source(NEW_RIVER_ID));
    expect(carrier.ready).toBe(true);
    expect(carrier.route_codes).toEqual(['MTH266', 'CSC205']);
    expect(pairProof({ bachelorDocument: null }).ready).toBe(false);
    expect(pairProof({ agreements: [] }).ready).toBe(false);
    expect(pairProof().reason).toMatch(/CSC 205.*CSC 215/i);
  });

  it('fails closed on every source, edge, unit-receipt, identity, or no-reuse mutation', () => {
    const mutations = [
      () => ({ associateDocument: Object.assign(source(NEW_RIVER_ID), {
        total_units_max: 64,
      }) }),
      () => {
        const document = source(NEW_RIVER_ID);
        document.sources[0].sha256 = '0'.repeat(64);
        return { associateDocument: document };
      },
      () => {
        const document = source(NEW_RIVER_ID);
        document.option_sets.computer_science_requirements.named_courses.pop();
        return { associateDocument: document };
      },
      () => {
        const document = source(NEW_RIVER_ID);
        document.requirement_groups[0].sections[0].receivers[0].options[0]
          .course_ids.push(ROUTE_IDS[0]);
        return { associateDocument: document };
      },
      () => {
        const rows = [agreement()];
        rows[0].derived_from.supply_edges = 184;
        return { agreements: rows };
      },
      () => {
        const rows = [agreement()];
        rows[0].requirement_groups[0].sections[1].receivers[0]
          .receiving.parent_id += 1;
        return { agreements: rows };
      },
      () => {
        const rows = [agreement()];
        rows[0].requirement_groups[0].sections[5].receivers[0]
          .options.push(option('MTH266', ROUTE_IDS[0]));
        return { agreements: rows };
      },
      () => {
        const document = source(VIRGINIA_TECH_ID);
        document.requirement_groups[0].sections[1].unit_advisement = 4;
        return { bachelorDocument: document };
      },
      () => {
        const artifact = structuredClone(
          // Use the same complete default artifact, then corrupt only the
          // exact row whose official three-credit receipt is required.
          // eslint-disable-next-line global-require
          require('../../../scripts/data/va_course_requisites.json'),
        );
        artifact.rows.find((row) => row.code === 'CSC205').credits = 4;
        return { requisiteRows: artifact };
      },
    ];
    const baseline = pairProof();
    for (const mutate of mutations) {
      const receipt = pairProof(mutate());
      expect(receipt.ready).toBe(false);
      expect(receipt.reason).not.toBe(baseline.reason);
    }
  });
});
