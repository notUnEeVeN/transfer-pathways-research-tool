import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NSU_CUMULATIVE_GPA_SOURCE_TEXT,
  SELECTED_PREREQUISITE_EVIDENCE,
  SOURCE_RECEIPTS,
  evaluateNorfolkStateAdministrativePolicy,
  evaluateNorfolkStateResidencyPolicy,
  exactNsuTree,
  norfolkStateCoverageSelection,
  norfolkStateFigureSelection,
  norfolkStateSciencePairs,
  nsuProofTreeFingerprint,
} from './norfolkStateConstraintProofs';
import {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { evaluateVirginiaResidencyTransferPolicy } from './virginiaResidencyTransferCaps';
import { assemblePathway } from './pathwayComplexity';
import { buildDegreeGroups } from '../degreeSlots';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { getMajor } from '../../config/majors';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const ROOT = path.resolve(__dirname, '../..');
const COMPOSED_PATH = path.join(
  ROOT, '.va-catalogs/composed/norfolk-state-university.json',
);
const REVIEW_PATH = path.join(
  ROOT, '.va-catalogs/research/va-university-prerequisite-review.json',
);
const sourcePath = (suffix) => path.join(
  ROOT, `.va-catalogs/pages/norfolk-state-university__${suffix}.txt`,
);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const acceptedSource = () => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === 'va:uni:norfolk-state-university'
));

function buildFinalProjection() {
  const sourcePlan = cachedAcceptedSourcePlan();
  const degrees = sourcePlan.documents.filter((document) => (
    document.kind === 'degree' && document.status === 'extracted'
  ));
  const configuredIds = Object.keys(getMajor('va-cs').programs).map(Number);
  const universities = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'four_year' && configuredIds.includes(row.id)
  ));
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const institutions = [college, ...universities].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  const supply = {
    course_id: courseIdFor('CSC299'),
    course_key: 'va:CSC299',
    code: 'CSC299',
    title: 'NSU final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: universities.map((row) => ({
      institution: row.name,
      identifier: 'NO_MATCH_299',
    })),
  };
  return buildProjection({
    courses: [supply], degrees, asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9217);
}

function findRule(doc, kind) {
  for (const [groupIndex, group] of (doc.requirement_groups || []).entries()) {
    const constraint = (group.analysis_constraints || []).find((entry) => entry.kind === kind);
    if (constraint) return { group, groupIndex, constraint };
  }
  return null;
}

function blockers(audit, figure) {
  return [
    ...audit.active_rules.filter((row) => (
      !row.supported && row.affected_figures.includes(figure)
    )),
    ...audit.unit_audit.filter((row) => (
      row.blocking && row.affected_figures.includes(figure)
    )),
  ].map((row) => `${row.path}|${row.kind}`).sort();
}

function campusCatalog(doc) {
  const ucCatalog = new Map();
  const ucCodeByParent = new Map();
  for (const group of doc.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        const body = receiver.receiving || {};
        const codes = String(receiver.code_seen || body.code || '')
          .split(/\s*\+\s*/).filter(Boolean);
        const ids = body.kind === 'series' ? body.parent_ids || [] : [body.parent_id];
        ids.forEach((id, index) => {
          if (!Number.isInteger(Number(id)) || !codes[index]) return;
          ucCodeByParent.set(Number(id), codes[index]);
          ucCatalog.set(codes[index], {
            id: `uc:nsu:${codes[index]}`,
            units: Number(body.units) / ids.length,
          });
        });
      }
    }
  }
  return { ucCatalog, ucCodeByParent };
}

describe('exact Norfolk State paper-figure proofs', () => {
  it('binds the proof to all six retained official source roles and exact policy text', () => {
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const receipt of SOURCE_RECEIPTS) {
      const suffix = {
        major: 'program', general_education: 'ge', college: 'college',
        college_2: 'college2', policy: 'policy', course_catalog: 'course_catalog',
      }[receipt.id];
      expect(sha(sourcePath(suffix)), receipt.id).toBe(receipt.sha256);
    }

    const program = fs.readFileSync(sourcePath('program'), 'utf8').replace(/\s+/g, ' ');
    const ge = fs.readFileSync(sourcePath('ge'), 'utf8').replace(/\s+/g, ' ');
    expect(program).toContain('Select one Laboratory Science Elective and the corresponding Laboratory');
    expect(program).toContain('Select one Laboratory Science Elective Sequence');
    expect(program).toContain('Major Electives - At least 15 Credit Hours');
    expect(program).toContain('Computer Science or Mathematics Elective (300 level or above) 9');
    const fourthYear = /Fourth Year (.+?) Credits31/.exec(program)?.[1] || '';
    expect(fourthYear).toContain('CSC 498 Computer Science Seminar I 2');
    expect(fourthYear).toContain('Computer Science Electives (300 level or above) 6');
    expect(fourthYear).toContain('Computer Science or Mathematics Elective (300 level or above) 9');
    expect(fourthYear).toContain('Free Elective 3');
    expect(ge).toContain('required to take forty (40) semester hours');
    expect(ge).toContain('minimum of two semesters in residence at Norfolk State University');
    expect(ge).toContain('including all of the courses required by the senior year curriculum');
    expect(ge).toContain(NSU_CUMULATIVE_GPA_SOURCE_TEXT);
  });

  it('retains one whole-tree fingerprint through composition, source, and final projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(nsuProofTreeFingerprint))).toEqual(new Set([
      '62aa82541e3be4e17f1531092501c83628414bd9f1bac464afbbd1afdd06c621',
    ]));
    expect(documents.map((doc) => exactNsuTree(doc))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('binds the deterministic Figure 6 choice to retained official prerequisite entries', () => {
    const review = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
    const rows = new Map(review.review_rows.filter((row) => (
      row.slug === 'norfolk-state-university'
        && Object.hasOwn(SELECTED_PREREQUISITE_EVIDENCE, row.code)
    )).map((row) => [row.code, row]));
    expect(rows.size).toBe(Object.keys(SELECTED_PREREQUISITE_EVIDENCE).length);
    for (const [code, expected] of Object.entries(SELECTED_PREREQUISITE_EVIDENCE)) {
      const row = rows.get(code);
      expect(row.source_content_sha256, code).toBe(expected.sha256);
      const actualPrerequisites = (row.groups || []).flatMap((group) => (
        group.paths || []
      )).flatMap((formulaPath) => formulaPath.all_of || [])
        .filter((condition) => condition.type === 'course')
        .map((condition) => condition.code);
      expect(actualPrerequisites, code).toEqual(expected.prerequisite_codes);
      if (!expected.prerequisite_codes.length) {
        if (row.status === 'none') {
          if (row.review_reason
              === 'exact_nsu_courseleaf_prerequisite_formula_or_structural_silence') {
            expect(row, code).toMatchObject({
              review_status: 'promoted_structural_none',
              structural_none_evidence: {
                kind: 'official_complete_nsu_courseleaf_entry_required_prerequisite_silence',
                contract:
                  'nsu_exact_2025_2026_courseleaf_prerequisite_closure_content_accounting_v1',
                literal_none_statement: false,
                content_accounting: {
                  full_entry_retained_as_source_evidence: true,
                  every_reviewed_non_prerequisite_signal_preserved: true,
                  source_content_discarded: false,
                },
              },
            });
          } else {
            expect(row, code).toMatchObject({
              review_status: 'promoted_structural_none',
              review_reason: 'complete_courseleaf_entry_silence_with_same_source_required_marker_control',
              structural_none_evidence: {
                kind: 'official_complete_entry_structural_silence_with_same_source_positive_control',
                literal_none_statement: false,
                boundary_contract: 'unique_courseblock_exact_leading_code_with_published_units',
                receipt_contract: 'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1',
                marker_control: {
                  entry_required_requisite_marker_count: 0,
                  entry_corequisite_marker_count: 0,
                  entry_requisite_marker_like_count: 0,
                  entry_constraint_like_signal_count: 0,
                  same_source_positive_control: true,
                },
              },
            });
          }
        } else if (code === 'CHM221L') {
          expect(row, code).toMatchObject({
            status: 'unparsed',
            review_status: 'not_promoted',
            review_reason: 'nsu_chm221l_unnamed_sequence_requirement',
            preserved_sequence_signals: [{
              raw: 'Must be taken in sequence.',
              named_course_codes: [],
              sequence_direction: null,
            }],
            prerequisite_constraint_blocker_evidence: {
              course_alias_or_direction_inferred: false,
            },
          });
        } else {
          expect(row, code).toMatchObject({
            status: 'unparsed',
            review_status: 'not_promoted',
            review_reason: 'no_explicit_required_requisite_statement',
          });
        }
      }
    }
    const chemistry = rows.get('CHM221').source_evidence.raw_text;
    expect(chemistry).toContain('High school chemistry is required. Algebra proficiency is required.');
    expect(chemistry).toContain('Prerequisites: Take MTH-153.');
  });

  it('implements every active course/credit rule with exact source-bound receipts', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      for (const kind of [
        'distinct_laboratory_science_sequences',
        'general_education_major_overlap',
        'minimum_major_menu_units',
      ]) {
        const found = findRule(doc, kind);
        expect(evaluateFourYearConstraint(found.constraint, {
          container: found.group,
          document: doc,
          path: `requirement_groups[${found.groupIndex}]`,
        }), `${kind}:${doc._id || doc.slug}`).toMatchObject({
          supported: true,
          evaluator: 'evaluateNorfolkStateConstraint',
        });
      }
      const rules = auditFourYearDocument(doc).active_rules;
      expect(rules.filter((row) => row.kind === 'distinct_course_ids_across_sections'))
        .toEqual([
          expect.objectContaining({ supported: true, evaluator: 'evaluateNorfolkStateStructuralRule' }),
          expect.objectContaining({ supported: true, evaluator: 'evaluateNorfolkStateStructuralRule' }),
        ]);
    }
  });

  it('enumerates six legal science pairs and a distinct prerequisite-closed Figure 6 choice', () => {
    const source = acceptedSource();
    const pairs = norfolkStateSciencePairs(source);
    expect(pairs).toMatchObject({ ready: true });
    expect(pairs.pairs).toHaveLength(6);
    expect(pairs.pairs.every((pair) => pair.first_index !== pair.second_index)).toBe(true);

    expect(norfolkStateFigureSelection(source)).toMatchObject({
      ready: true,
      section_receiver_indices: {
        '1:0': [0],
        '1:1': [2],
        '4:0': [4, 7, 10, 13, 16],
        '4:1': [18],
      },
      selected_science_codes: [
        ['BIO110', 'BIO110L'], ['CHM221', 'CHM221L'],
      ],
      selected_elective_codes: [
        'CSC360', 'CSC373', 'CSC420', 'CSC435', 'CSC466', 'CSC470',
      ],
    });

    const science = source.requirement_groups[1];
    const onlyPhysicsArticulated = new Set(
      science.sections[0].receivers[1].receiving.parent_ids.map(Number),
    );
    const optimized = norfolkStateCoverageSelection(source, onlyPhysicsArticulated);
    expect(optimized).toMatchObject({
      ready: true,
      covered_science_series: 1,
      section_receiver_indices: { '1:0': [0], '1:1': [1] },
    });
    expect(optimized.section_receiver_indices['1:0'])
      .not.toEqual(optimized.section_receiver_indices['1:1']);
  });

  it('uses the exact selection in Figure 1 and Figure 6 and emits no policy vertices', () => {
    const source = acceptedSource();
    const degreeGroups = buildDegreeGroups(source.requirement_groups, {
      sourceDocument: source,
      articulated: new Set(),
    });
    expect(degreeGroups.groups.find((group) => /distinct laboratory-science/.test(group.label)))
      .toMatchObject({ total: 2, covered: 0 });
    expect(degreeGroups.groups.find((group) => /Upper-level Computer Science/.test(group.label)))
      .toMatchObject({ total: 6, covered: 0 });

    const { ucCatalog, ucCodeByParent } = campusCatalog(source);
    const pathway = assemblePathway({
      degree: source,
      asIds: [],
      agreementByParent: new Map(),
      ucCatalog,
      ucCodeByParent,
      ccUnits: new Map(),
    });
    const keys = new Set(pathway.vertices.keys());
    for (const code of [
      'BIO110', 'BIO110L', 'CHM221', 'CHM221L',
      'CSC360', 'CSC373', 'CSC420', 'CSC435', 'CSC466', 'CSC470',
    ]) expect(keys.has(`uc:nsu:${code}`), code).toBe(true);
    for (const code of ['PHY152', 'PHY152L', 'CSC312', 'CSC313', 'CSC314']) {
      expect(keys.has(`uc:nsu:${code}`), code).toBe(false);
    }
    expect([...pathway.vertices.values()].filter((row) => (
      row.kind === 'slot' && Number(row.units) === 0
    ))).toEqual([]);
  });

  it('fails closed on identity, source, ref, roster, unit, accounting, and declaration drift', () => {
    const source = acceptedSource();
    const mutations = [
      (doc) => { doc.school_id = 9217; },
      (doc) => { doc.provenance.source_bundle_hash = '0'.repeat(64); },
      (doc) => { doc.sources[1].role = 'policy'; },
      (doc) => { doc.sources[2].sha256 = '0'.repeat(64); },
      (doc) => { doc.requirement_groups[1].source_refs = ['major']; },
      (doc) => { doc.requirement_groups[1].sections[0].receivers[0].receiving.parent_ids[0] += 1; },
      (doc) => { doc.requirement_groups[1].sections[1].receivers[2].code_seen = 'CHM222 + CHM222L'; },
      (doc) => { doc.requirement_groups[1].sections[0].unit_advisement = 3; },
      (doc) => { doc.requirement_groups[4].distinct_course_ids_across_sections = false; },
      (doc) => { doc.requirement_groups[4].sections[1].receivers[18].receiving.units = 4; },
      (doc) => { doc.requirement_groups[3].sections[0].unit_advisement = 3; },
      (doc) => { doc.unit_audit.laboratory_science_support_units = 7; },
      (doc) => { doc.data_quality_flags[2].severity = 'review'; },
      (doc) => { doc.requirement_groups[1].analysis_constraints.push(
        structuredClone(doc.requirement_groups[1].analysis_constraints[0]),
      ); },
    ];
    for (const mutate of mutations) {
      const doc = structuredClone(source);
      mutate(doc);
      expect(exactNsuTree(doc).supported).toBe(false);
      expect(norfolkStateFigureSelection(doc).ready).toBe(false);
      const audit = auditFourYearDocument(doc);
      expect(audit.active_rules.some((row) => !row.supported)).toBe(true);
    }
  });

  it('resolves the implementation-only flag and exact fourth-year residency on source and projection', () => {
    const source = acceptedSource();
    const projection = buildFinalProjection();
    expect(auditFourYearAnalysisQualityFlags(source)).toEqual([
      expect.objectContaining({ code: 'catalog_edition_lag', resolved_by_exact_evaluator: false }),
      expect.objectContaining({ code: 'courseleaf_curriculum_grid_authority', resolved_by_exact_evaluator: false }),
      expect.objectContaining({
        code: 'cross_section_science_and_elective_distinctness',
        resolved_by_exact_evaluator: true,
        mapped_constraint_kinds: [
          'distinct_course_ids_across_sections',
          'distinct_laboratory_science_sequences',
        ],
      }),
    ]);
    const sourceAudit = auditFourYearDocument(source);
    const projectionAudit = auditFourYearDocument(projection);
    expect(sourceAudit.summary).toMatchObject({
      supported_active_rules: 5,
      blocked_unit_audit_rules: 1,
      blocked_rules_by_figure: { '1': 0, '3': 0, '4': 0, '6': 0 },
      ready_by_figure: { '1': true, '3': true, '4': true, '6': true },
    });
    expect(sourceAudit.unit_audit.find((row) => (
      row.kind === 'minimum_cumulative_gpa'
    ))).toMatchObject({
      evaluator: 'evaluateNorfolkStateAdministrativePolicy',
      disposition: 'source_bound_out_of_scope_administrative_rule',
      supported: false,
      blocking: true,
      paper_impact_proven: true,
      affected_figures: [],
      proof: {
        condition: 'minimum_cumulative_gpa',
        threshold: 2,
        carrier_path: 'requirement_groups[6].sections[0]',
        carrier_units: 0,
        carrier_course_identities: 0,
        prerequisite_edge_change_when_condition_met: 0,
      },
    });
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockers(projectionAudit, figure), `Figure ${figure}`)
        .toEqual(blockers(sourceAudit, figure));
    }

    for (const doc of [loadComposition(), source, projection]) {
      expect(evaluateNorfolkStateAdministrativePolicy(
        doc, 'minimum_cumulative_gpa',
      )).toMatchObject({
        supported: false,
        paper_impact_proven: true,
        affected_figures: [],
        evaluator: 'evaluateNorfolkStateAdministrativePolicy',
      });
      expect(evaluateNorfolkStateResidencyPolicy(doc)).toMatchObject({
        supported: true,
        evaluator: 'evaluateNorfolkStateResidencyPolicy',
        effective_two_year_transfer_cap_units: 89,
        proof: {
          senior_curriculum_units: 31,
          senior_curriculum_components: {
            fixed_major_courses: 7,
            upper_cs_or_math_electives: 15,
            cultural_perspectives: 6,
            free_elective: 3,
          },
          resident_semesters_minimum: 2,
        },
      });
      expect(evaluateVirginiaResidencyTransferPolicy(doc)).toMatchObject({
        supported: true,
        evaluator: 'evaluateNorfolkStateResidencyPolicy',
        effective_two_year_transfer_cap_units: 89,
      });
    }

    const drift = structuredClone(source);
    drift.unit_audit.resident_semesters_minimum = 1;
    expect(evaluateNorfolkStateResidencyPolicy(drift)).toBeNull();
    expect(evaluateVirginiaResidencyTransferPolicy(drift)).toMatchObject({
      supported: false,
      source_policy_id: 'norfolk-state-university',
    });
  });

  it('fails the GPA disposition closed on threshold, carrier, tree, or source drift', () => {
    const source = acceptedSource();
    for (const mutate of [
      (doc) => { doc.unit_audit.minimum_cumulative_gpa = 1.9; },
      (doc) => { doc.requirement_groups[6].sections[0].unit_advisement = 3; },
      (doc) => { doc.requirement_groups[6].sections[0].receivers[0].receiving.name += ' changed'; },
      (doc) => { doc.requirement_groups[6].sections[0].receivers[0].receiving.parent_id = 99; },
      (doc) => { doc.requirement_groups[6].source_refs = ['general_education']; },
      (doc) => { doc.sources[1].sha256 = '0'.repeat(64); },
    ]) {
      const doc = structuredClone(source);
      mutate(doc);
      expect(evaluateNorfolkStateAdministrativePolicy(
        doc, 'minimum_cumulative_gpa',
      )).toBeNull();
    }
  });
});
