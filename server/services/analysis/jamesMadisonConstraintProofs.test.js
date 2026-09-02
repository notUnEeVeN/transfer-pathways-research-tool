import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import {
  JMU_CUMULATIVE_GPA_SOURCE_TEXT,
  JMU_MAJOR_GPA_SOURCE_TEXT,
  JMU_PROOF_TREE_SHA256,
  evaluateJmuAdministrativePolicy,
  exactJmuTree,
  jmuProofTreeFingerprint,
} from './jamesMadisonConstraintProofs';
import { canonicalSourceContract } from './canonicalSourceContract';
import { projectInstitutionReceivingGroups } from '../virginia/courseIdentity';

const COMPOSED = path.resolve(
  __dirname,
  '../../.va-catalogs/composed/james-madison-university.json',
);
const GRADUATION_SOURCE = path.resolve(
  __dirname,
  '../../.va-catalogs/pages/james-madison-university__graduation.txt',
);
const KINDS = [
  'minimum_course_number_distribution',
  'correlated_variable_major_and_elective_units',
];

const rawDocument = () => JSON.parse(fs.readFileSync(COMPOSED, 'utf8'));
const projectedDocument = () => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === 'va:uni:james-madison-university'
));
const canonicalDocument = () => {
  const projected = structuredClone(projectedDocument());
  return {
    ...projected,
    _id: 'degree:9213:va-cs',
    institution_id: 'va:uni:9213',
    school_id: 9213,
    state: 'va',
    va_requirement_status: 'extracted',
    va_requirement_id: 'va:degree:james-madison-university:cs',
    analysis_contract: canonicalSourceContract(),
    requirement_groups: projectInstitutionReceivingGroups(
      projected.requirement_groups,
      'va:uni:9213',
    ),
  };
};

const rules = (doc) => auditFourYearDocument(doc).active_rules.filter((row) => (
  KINDS.includes(row.kind)
));

const rule = (doc, kind) => rules(doc).find((row) => row.kind === kind);

function expectBothBlocked(doc, reason = null) {
  const evaluated = rules(doc);
  expect(evaluated).toHaveLength(2);
  expect(evaluated.every((row) => row.supported === false)).toBe(true);
  if (reason) expect(evaluated.every((row) => reason.test(row.reason))).toBe(true);
}

describe('exact James Madison paper-figure constraint proofs', () => {
  it('binds the composition and canonical projection to one complete source-tree fingerprint', () => {
    const raw = rawDocument();
    const projected = projectedDocument();
    const canonical = canonicalDocument();
    expect(jmuProofTreeFingerprint(raw)).toBe(JMU_PROOF_TREE_SHA256);
    expect(jmuProofTreeFingerprint(projected)).toBe(JMU_PROOF_TREE_SHA256);
    expect(jmuProofTreeFingerprint(canonical)).toBe(JMU_PROOF_TREE_SHA256);
    const graduation = fs.readFileSync(GRADUATION_SOURCE, 'utf8');
    expect(graduation).toContain(JMU_CUMULATIVE_GPA_SOURCE_TEXT);
    expect(graduation).toContain(JMU_MAJOR_GPA_SOURCE_TEXT);

    for (const doc of [raw, projected, canonical]) {
      expect(exactJmuTree(doc)).toMatchObject({
        supported: true,
        proof: { source_tree_sha256: JMU_PROOF_TREE_SHA256 },
      });
      expect(rules(doc)).toEqual([
        expect.objectContaining({
          kind: 'minimum_course_number_distribution',
          supported: true,
          proof: expect.objectContaining({
            selected_category_slots: 3,
            category_receiver_count: 3,
            above_332_slots: 2,
            canonical_units: 9,
            requirement_role: 'named_major_requirement',
          }),
        }),
        expect.objectContaining({
          kind: 'correlated_variable_major_and_elective_units',
          supported: true,
          proof: expect.objectContaining({
            canonical_major_units: 49,
            maximum_major_units: 52,
            fixed_ge_and_bs_units: 44,
            canonical_elective_units: 27,
            minimum_elective_units: 24,
            canonical_degree_units: 120,
            maximum_major_path_degree_units: 120,
            correlated_delta_units: 3,
            requirement_role: 'elective_capacity',
          }),
        }),
      ]);
    }
  });

  it('proves both GPA declarations are exact zero-course administrative gates', () => {
    for (const doc of [rawDocument(), projectedDocument(), canonicalDocument()]) {
      for (const [kind, carrierPath] of [
        ['minimum_cumulative_gpa', 'requirement_groups[10].sections[1]'],
        ['minimum_major_gpa', 'requirement_groups[10].sections[5]'],
      ]) {
        expect(evaluateJmuAdministrativePolicy(doc, kind)).toMatchObject({
          supported: false,
          paper_impact_proven: true,
          affected_figures: [],
          evaluator: 'evaluateJmuAdministrativePolicy',
          proof: {
            condition: kind,
            threshold: 2,
            carrier_path: carrierPath,
            carrier_units: 0,
            carrier_course_identities: 0,
            course_selection_change_when_condition_met: 0,
            credit_unit_change_when_condition_met: 0,
            prerequisite_edge_change_when_condition_met: 0,
          },
        });
      }
      const gpaRows = auditFourYearDocument(doc).unit_audit.filter((row) => (
        ['minimum_cumulative_gpa', 'minimum_major_gpa'].includes(row.kind)
      ));
      expect(gpaRows).toEqual([
        expect.objectContaining({
          kind: 'minimum_cumulative_gpa',
          evaluator: 'evaluateJmuAdministrativePolicy',
          disposition: 'source_bound_out_of_scope_administrative_rule',
          blocking: true,
          paper_impact_proven: true,
          affected_figures: [],
        }),
        expect.objectContaining({
          kind: 'minimum_major_gpa',
          evaluator: 'evaluateJmuAdministrativePolicy',
          disposition: 'source_bound_out_of_scope_administrative_rule',
          blocking: true,
          paper_impact_proven: true,
          affected_figures: [],
        }),
      ]);
    }
  });

  it('fails the GPA disposition closed on threshold, carrier, tree, or receipt drift', () => {
    for (const mutate of [
      (doc) => { doc.unit_audit.minimum_cumulative_gpa = 1.9; },
      (doc) => { doc.requirement_groups[10].sections[1].units = 3; },
      (doc) => { doc.requirement_groups[10].sections[5].receivers[0].name += ' changed'; },
      (doc) => { doc.requirement_groups[10].sections[1].receivers[0].kind = 'course'; },
      (doc) => { doc.requirement_groups[10].source_refs = ['policy']; },
    ]) {
      const doc = rawDocument();
      mutate(doc);
      expect(exactJmuTree(doc).supported).toBe(false);
      expect(evaluateJmuAdministrativePolicy(doc, 'minimum_cumulative_gpa')).toBeNull();
      expect(evaluateJmuAdministrativePolicy(doc, 'minimum_major_gpa')).toBeNull();
    }
    const projected = projectedDocument();
    projected.sources[4].sha256 = '0'.repeat(64);
    expect(evaluateJmuAdministrativePolicy(projected, 'minimum_cumulative_gpa'))
      .toBeNull();
  });

  it('fails closed on course count, section-unit, and receiver-unit drift', () => {
    const count = rawDocument();
    count.requirement_groups[1].sections[0].select = 2;
    expectBothBlocked(count, /requirement tree changed/);

    const sectionUnits = rawDocument();
    sectionUnits.requirement_groups[1].sections[0].units = 8;
    expectBothBlocked(sectionUnits, /requirement tree changed/);

    const receiverUnits = rawDocument();
    receiverUnits.requirement_groups[1].sections[0].receivers[2].units = 4;
    expectBothBlocked(receiverUnits, /requirement tree changed/);
  });

  it('fails closed on labels, category identities, codes, and semantic roles', () => {
    const label = rawDocument();
    label.requirement_groups[1].title = 'Upper CS electives';
    expectBothBlocked(label, /requirement tree changed/);

    const category = rawDocument();
    category.requirement_groups[1].sections[0].receivers[1].name = 'Any upper CS course';
    expectBothBlocked(category, /requirement tree changed/);

    const code = rawDocument();
    code.requirement_groups[1].sections[0].receivers[1].code = 'JMU-CS-ELECTIVE-300-B';
    expectBothBlocked(code, /requirement tree changed/);

    const role = rawDocument();
    role.requirement_groups[1].requirement_layer = 'ge_college';
    expectBothBlocked(role, /requirement tree changed/);

    const carrier = rawDocument();
    carrier.requirement_groups[1].sections[0].receivers[0].kind = 'course';
    expectBothBlocked(carrier, /requirement tree changed/);
  });

  it('fails closed when either longer major option or its course identity drifts', () => {
    const calculusUnits = rawDocument();
    calculusUnits.requirement_groups[3].sections[0].receivers[1].units = 5;
    expectBothBlocked(calculusUnits, /requirement tree changed/);

    const calculusSeries = rawDocument();
    calculusSeries.requirement_groups[3].sections[0].receivers[1].codes[1] = 'MATH233';
    expectBothBlocked(calculusSeries, /requirement tree changed/);

    const statistics = rawDocument();
    statistics.requirement_groups[4].sections[0].receivers.push({
      kind: 'course', code: 'MATH319', units: 4,
    });
    expectBothBlocked(statistics, /requirement tree changed/);
  });

  it('fails closed on any canonical or long-path accounting drift', () => {
    for (const [field, value] of [
      ['canonical_major_units', 50],
      ['major_units_maximum', 53],
      ['canonical_university_elective_units', 26],
      ['university_elective_units_minimum', 25],
      ['modeled_units', 121],
    ]) {
      const doc = rawDocument();
      doc.unit_audit[field] = value;
      expectBothBlocked(doc, /requirement tree changed/);
    }

    const capacity = rawDocument();
    capacity.requirement_groups[9].sections[0].units = 26;
    capacity.requirement_groups[9].sections[0].receivers[0].units = 26;
    expectBothBlocked(capacity, /requirement tree changed/);
  });

  it('fails closed on constraint status, wording, source refs, or attachment drift', () => {
    const status = rawDocument();
    status.requirement_groups[1].analysis_constraints[0].status = 'supported';
    expect(rule(status, KINDS[0])).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/constraint declaration changed/),
    });

    const unresolved = rawDocument();
    unresolved.requirement_groups[1].analysis_constraints[0].status
      = 'unresolved_source_language';
    expect(rule(unresolved, KINDS[0])).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/cannot be superseded/),
    });

    const wording = rawDocument();
    wording.requirement_groups[9].analysis_constraints[0].description += ' Revised.';
    expect(rule(wording, KINDS[1])).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/constraint declaration changed/),
    });

    const refs = rawDocument();
    refs.requirement_groups[9].source_refs = ['major', 'graduation'];
    expectBothBlocked(refs, /requirement tree changed/);

    const attachment = rawDocument();
    const [constraint] = attachment.requirement_groups[1].analysis_constraints.splice(0, 1);
    attachment.requirement_groups[2].analysis_constraints = [constraint];
    expectBothBlocked(attachment);
  });

  it('fails closed on projected source receipt, capture status, and parent-id drift', () => {
    const bundle = projectedDocument();
    bundle.provenance.source_bundle_hash = '0'.repeat(64);
    expectBothBlocked(bundle, /source-bundle hash changed/);

    const source = projectedDocument();
    source.sources[0].sha256 = '0'.repeat(64);
    expectBothBlocked(source, /source receipt changed/);

    const capture = projectedDocument();
    capture.capture_layers.major.status = 'partial';
    expectBothBlocked(capture, /capture status/);

    const parent = projectedDocument();
    parent.requirement_groups[3].sections[0].receivers[0].receiving.parent_id += 1;
    expectBothBlocked(parent, /deterministic JMU course identity/);

    const options = projectedDocument();
    options.requirement_groups[3].sections[0].receivers[0].options.push({ course_ids: [1] });
    expectBothBlocked(options, /empty projected option shape/);
  });

  it('fails closed on the shared projection identity, source link, or analysis contract', () => {
    const id = canonicalDocument();
    id.school_id = 9999;
    expectBothBlocked(id, /verified JMU composition or its exact canonical projection/);

    const link = canonicalDocument();
    link.va_requirement_id = 'va:degree:lookalike-university:cs';
    expectBothBlocked(link, /projection link or canonical analysis contract changed/);

    const contract = canonicalDocument();
    contract.analysis_contract.boolean_semantics = 'label_inferred';
    expectBothBlocked(contract, /projection link or canonical analysis contract changed/);
  });

  it('cannot be invoked against a lookalike institution or detached container', () => {
    const identity = rawDocument();
    identity.slug = 'lookalike-university';
    expectBothBlocked(identity, /verified JMU composition/);

    const detached = rawDocument();
    detached.requirement_groups[1] = structuredClone(detached.requirement_groups[1]);
    const constraint = detached.requirement_groups[1].analysis_constraints[0];
    expect(evaluateFourYearConstraint(constraint, {
      container: structuredClone(detached.requirement_groups[1]),
      document: detached,
      path: 'requirement_groups[1]',
    })).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/must remain attached/),
    });
  });

  it('supersedes only the two exact implementation flags with active proof receipts', () => {
    const rows = auditFourYearAnalysisQualityFlags(rawDocument());
    expect(rows).toEqual([
      expect.objectContaining({
        code: 'correlated_major_and_elective_ranges',
        severity: 'block_analysis',
        resolved_by_exact_evaluator: true,
        mapped_constraint_kinds: ['correlated_variable_major_and_elective_units'],
        rule_receipts: [expect.objectContaining({
          supported: true,
          exact_active_rule_count: 1,
          proof: expect.objectContaining({ source_tree_sha256: JMU_PROOF_TREE_SHA256 }),
        })],
      }),
      expect.objectContaining({
        code: 'upper_cs_elective_number_constraint',
        severity: 'block_analysis',
        resolved_by_exact_evaluator: true,
        mapped_constraint_kinds: ['minimum_course_number_distribution'],
        rule_receipts: [expect.objectContaining({
          supported: true,
          exact_active_rule_count: 1,
          proof: expect.objectContaining({ source_tree_sha256: JMU_PROOF_TREE_SHA256 }),
        })],
      }),
    ]);
  });

  it('never supersedes stronger, unmapped, duplicated, or drifted quality flags', () => {
    const stronger = rawDocument();
    stronger.data_quality_flags[0].severity = 'block';
    expect(auditFourYearAnalysisQualityFlags(stronger)[0]).toMatchObject({
      blocking_analysis: true,
      resolved_by_exact_evaluator: false,
      reason: expect.stringMatching(/severity block cannot be superseded/),
    });

    const unknown = rawDocument();
    unknown.data_quality_flags.push({
      code: 'future_quality_gap', severity: 'block_analysis', message: 'Unknown gap.',
    });
    expect(auditFourYearAnalysisQualityFlags(unknown).at(-1)).toMatchObject({
      resolved_by_exact_evaluator: false,
      mapped_constraint_kinds: [],
    });

    const duplicate = rawDocument();
    duplicate.requirement_groups[2].analysis_constraints = [structuredClone(
      duplicate.requirement_groups[1].analysis_constraints[0],
    )];
    expect(auditFourYearAnalysisQualityFlags(duplicate)[1]).toMatchObject({
      resolved_by_exact_evaluator: false,
      rule_receipts: [expect.objectContaining({ exact_active_rule_count: 2 })],
    });

    const drift = rawDocument();
    drift.requirement_groups[9].source_refs = ['major'];
    expect(auditFourYearAnalysisQualityFlags(drift)[0]).toMatchObject({
      resolved_by_exact_evaluator: false,
      rule_receipts: [expect.objectContaining({ supported: false })],
    });
  });
});
