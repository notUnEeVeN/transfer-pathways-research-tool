import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { validateUniversityPrerequisiteReview } from './universityPrerequisiteReview';
import {
  requiredUniversityCourseKeys,
  validateVirginiaFigure6PrerequisiteCorpus,
} from './pathwayComplexityPrerequisites';
import {
  TARGET_CODES as VSU_ENGLISH_TARGET_CODES,
  projectionRowIssues as vsuEnglishProjectionRowIssues,
} from './virginiaStateEnglishPrerequisiteEvidence';
import {
  CONTRACT as VSU_PREREQUISITE_CLOSURE_CONTRACT,
  resolutionRowIssues as vsuPrerequisiteClosureResolutionRowIssues,
} from './virginiaStatePrerequisiteClosureEvidence';
import {
  CONTRACT as NSU_PREREQUISITE_CLOSURE_CONTRACT,
  resolutionRowIssues as nsuPrerequisiteClosureResolutionRowIssues,
} from './norfolkStatePrerequisiteClosureEvidence';
import {
  CONTRACT as VCU_PREREQUISITE_CLOSURE_CONTRACT,
  SAFE_CODES as VCU_SAFE_CODES,
  TARGET_CODES as VCU_TARGET_CODES,
  WEAK_CODES as VCU_WEAK_CODES,
  vcuPrerequisiteResolutionRowIssues,
} from './vcuPrerequisiteClosureEvidence';
import {
  CONTRACT as SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
  DECISIONS as SMALL_UNIVERSITY_DECISIONS,
  TARGET_KEYS as SMALL_UNIVERSITY_TARGET_KEYS,
  artifactIssues as smallUniversityArtifactIssues,
  resolutionRowIssues as smallUniversityPrerequisiteResolutionRowIssues,
} from './smallUniversityPrerequisiteClosureEvidence';
import {
  CONTRACT as UNIVERSITY_PREREQUISITE_TAIL_CONTRACT,
  DECISIONS as UNIVERSITY_PREREQUISITE_TAIL_DECISIONS,
  TARGET_KEYS as UNIVERSITY_PREREQUISITE_TAIL_KEYS,
  loadUniversityPrerequisiteTailControl,
  resolutionRowIssues as universityPrerequisiteTailResolutionRowIssues,
  universityPrerequisiteTailControlSummary,
} from './universityPrerequisiteTailClosureEvidence';
import {
  CONTRACT as RADFORD_RMC_TAIL_CONTRACT,
  TARGET_KEYS as RADFORD_RMC_TAIL_KEYS,
  evidenceIssues as radfordRmcTailEvidenceIssues,
  evidenceSummary as radfordRmcTailEvidenceSummary,
  loadEvidenceArtifact as loadRadfordRmcTailEvidence,
  resolutionRowIssues as radfordRmcTailResolutionRowIssues,
} from './radfordRandolphMaconPrerequisiteTailEvidence';
import {
  CONTRACT as REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT,
  TARGET_KEYS as REMAINING_UNIVERSITY_PREREQUISITE_KEYS,
  resolutionRowIssues as remainingUniversityPrerequisiteResolutionRowIssues,
} from './remainingUniversityPrerequisiteClosureEvidence';
import {
  CONTRACT as VCU_EGMN_PREREQUISITE_CONTRACT,
  TARGET_KEYS as VCU_EGMN_PREREQUISITE_KEYS,
  resolutionRowIssues as vcuEgmnPrerequisiteResolutionRowIssues,
} from './vcuEgmnOutsideScopePrerequisiteEvidence';
import {
  CONTRACT as RADFORD_UVA_WISE_RECURSIVE_PREREQUISITE_CONTRACT,
  TARGET_KEYS as RADFORD_UVA_WISE_RECURSIVE_KEYS,
  resolutionRowIssues as radfordUvaWiseRecursiveResolutionRowIssues,
} from './radfordUvaWiseRecursivePrerequisiteEvidence';
import {
  CONTRACT as FIGURE6_NONCOURSE_DISPOSITION_CONTRACT,
  STRUCTURAL_NONE_KIND as FIGURE6_NONCOURSE_STRUCTURAL_NONE_KIND,
  figure6NonCourseDispositionResolutionRowIssues,
} from './figure6NonCoursePrerequisiteDisposition';

const require = createRequire(import.meta.url);
const { buildFromArtifacts } = require('../../scripts/va/buildUniversityPrerequisiteReview');

const read = (relative) => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const scope = read('../../.va-catalogs/research/va-university-prerequisite-scope.json');
const candidates = read('../../.va-catalogs/research/va-university-prerequisite-candidates.json');
const artifact = read('../../.va-catalogs/research/va-university-prerequisite-review.json');
const smallUniversityEvidence = read(
  '../../.va-catalogs/research/va-small-university-prerequisite-closure-evidence.json',
);
const universityPrerequisiteTailControl = loadUniversityPrerequisiteTailControl();
const radfordRmcTailEvidence = loadRadfordRmcTailEvidence();

describe('checked-in Virginia university prerequisite formula review', () => {
  it('is internally exact and remains fail-closed', () => {
    expect(validateUniversityPrerequisiteReview(artifact, { scope, candidates }))
      .toEqual({ valid: true, issues: [] });
    expect(artifact.summary).toEqual({
      active_universities: 16,
      direct_required_rows: 850,
      closure_candidate_rows: 320,
      bounded_candidates_reviewed: 1169,
      parsed: 652,
      none: 171,
      unparsed: 26,
      missing: 1,
      closure_parsed: 190,
      closure_none: 109,
      closure_unparsed: 21,
      promoted_contract_rows: 1122,
      publication_rows: 0,
    });
    expect(artifact.publication_ready).toBe(false);
    expect(artifact.direct_review_rows).toHaveLength(850);
    expect(artifact.closure_review_rows).toHaveLength(320);
    expect(artifact.review_rows).toHaveLength(1170);
    expect(artifact.promoted_rows).toHaveLength(1122);
  });

  it('is the exact fixed-point replay of the retained scope and candidate artifacts', () => {
    expect(buildFromArtifacts()).toEqual(artifact);
  });

  it('integrates only the 18 source-proven Norfolk decisions and preserves all blockers', () => {
    const direct = artifact.direct_review_rows.filter((row) => (
      row.owner_namespace === 'va:uni:9217'
    ));
    const closure = artifact.closure_review_rows.filter((row) => (
      row.owner_namespace === 'va:uni:9217'
    ));
    const exact = [...direct, ...closure].filter((row) => (
      row.review_reason === 'exact_nsu_courseleaf_prerequisite_formula_or_structural_silence'
    ));
    expect(direct).toHaveLength(81);
    expect(closure).toHaveLength(7);
    expect(direct.filter((row) => row.status === 'none')).toHaveLength(36);
    expect(direct.filter((row) => row.status === 'unparsed').map((row) => row.code))
      .toEqual(['CHM221L']);
    expect(exact).toHaveLength(18);
    expect(exact.filter((row) => row.status === 'parsed').map((row) => row.code).sort())
      .toEqual(['MTH105', 'MTH151']);
    expect(exact.filter((row) => row.status === 'none')).toHaveLength(16);
    expect(exact.reduce((total, row) => (
      total + row.ignored_nonrequired_requisites.length
    ), 0)).toBe(12);
    for (const row of exact) {
      expect(nsuPrerequisiteClosureResolutionRowIssues(row)).toEqual([]);
      const proof = row.status === 'none'
        ? row.structural_none_evidence : row.norfolk_state_prerequisite_resolution;
      expect(proof).toMatchObject({
        contract: NSU_PREREQUISITE_CLOSURE_CONTRACT,
        content_accounting: {
          full_entry_retained_as_source_evidence: true,
          every_reviewed_non_prerequisite_signal_preserved: true,
          source_content_discarded: false,
        },
      });
    }
    const sequence = direct.find((row) => row.code === 'CHM221L');
    expect(sequence).toMatchObject({
      status: 'unparsed',
      review_status: 'not_promoted',
      review_reason: 'nsu_chm221l_unnamed_sequence_requirement',
      preserved_sequence_signals: [{
        raw: 'Must be taken in sequence.',
        named_course_codes: [],
        sequence_direction: null,
        required_prerequisite_graph_edge_emitted: false,
      }],
      prerequisite_constraint_blocker_evidence: {
        course_alias_or_direction_inferred: false,
      },
    });
    expect(nsuPrerequisiteClosureResolutionRowIssues(sequence)).toEqual([]);
    expect(artifact.closure.unresolved_outside_direct_scope.filter((key) => (
      key.startsWith('va:uni:9217:')
    ))).toEqual([
      'va:uni:9217:CSC195', 'va:uni:9217:CSC311', 'va:uni:9217:EEN470',
      'va:uni:9217:ENGG101H', 'va:uni:9217:MTH101',
    ]);
  });

  it('integrates only seven exact VCU silence decisions and preserves eleven blockers', () => {
    expect(artifact.vcu_prerequisite_closure_audit).toEqual({
      contract: VCU_PREREQUISITE_CLOSURE_CONTRACT,
      verified: true,
      issues: [],
      inventory_sha256: 'b125f80f4622787d24cda9135b33dbc03cf2c2679c444e92d35ca59e6e20eae6',
      target_rows: 18,
      exact_official_courseblock_rows: 15,
      weak_retained_text_rows: 3,
      safe_structural_none_rows: 7,
      blocked_rows: 11,
      direct: {
        target_rows: 11,
        exact_official_courseblock_rows: 8,
        weak_retained_text_rows: 3,
        safe_structural_none_rows: 3,
        blocked_rows: 8,
      },
      closure: {
        target_rows: 7,
        exact_official_courseblock_rows: 7,
        weak_retained_text_rows: 0,
        safe_structural_none_rows: 4,
        blocked_rows: 3,
      },
      safe_codes: VCU_SAFE_CODES,
      blocked_codes: VCU_TARGET_CODES.filter((code) => !VCU_SAFE_CODES.includes(code)),
      weak_codes: VCU_WEAK_CODES,
    });
    const rows = [...artifact.direct_review_rows, ...artifact.closure_review_rows]
      .filter((row) => row.owner_namespace === 'va:uni:9229'
        && VCU_TARGET_CODES.includes(row.code));
    expect(rows).toHaveLength(18);
    const safe = rows.filter((row) => VCU_SAFE_CODES.includes(row.code));
    expect(safe.map((row) => row.code)).toEqual(VCU_SAFE_CODES);
    expect(safe.every((row) => (
      row.status === 'none'
      && row.review_status === 'promoted_structural_none'
      && row.structural_none_evidence.contract === VCU_PREREQUISITE_CLOSURE_CONTRACT
      && row.structural_none_evidence.literal_none_statement === false
      && row.structural_none_evidence.content_accounting.source_content_discarded === false
      && vcuPrerequisiteResolutionRowIssues(row).length === 0
    ))).toBe(true);
    const priorBlocked = rows.filter((row) => !VCU_SAFE_CODES.includes(row.code));
    expect(priorBlocked).toHaveLength(11);
    const residualPromoted = priorBlocked.filter((row) => (
      REMAINING_UNIVERSITY_PREREQUISITE_KEYS.includes(row.course_key)
    ));
    expect(residualPromoted).toHaveLength(7);
    expect(residualPromoted.every((row) => (
      row.status === 'none'
      && row.review_status === 'promoted_structural_none'
      && row.structural_none_evidence.contract
        === REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT
      && remainingUniversityPrerequisiteResolutionRowIssues(row).length === 0
    ))).toBe(true);
    const blocked = priorBlocked.filter((row) => (
      !REMAINING_UNIVERSITY_PREREQUISITE_KEYS.includes(row.course_key)
    ));
    expect(blocked).toHaveLength(4);
    expect(blocked.every((row) => (
      row.status === 'unparsed'
      && row.review_status === 'not_promoted'
      && row.groups.length === 0
      && row.vcu_prerequisite_closure_audit.contract
        === VCU_PREREQUISITE_CLOSURE_CONTRACT
      && row.vcu_prerequisite_closure_audit.content_accounting.source_content_discarded
        === false
      && vcuPrerequisiteResolutionRowIssues(row).length === 0
    ))).toBe(true);
    expect(blocked.filter((row) => VCU_WEAK_CODES.includes(row.code)).every((row) => (
      row.vcu_prerequisite_closure_audit.source_quality
        === 'retained_normalized_text_only'
      && row.review_evidence.source_response_sha256 == null
      && row.review_evidence.raw_entry_html_sha256 == null
    ))).toBe(true);
    expect(residualPromoted.map((row) => row.code)).toEqual([
      'ENGR395', 'HONR230', 'HONR240', 'UNIV101', 'UNIV191',
      'CLSE101', 'EGRE101',
    ]);
    expect(blocked.find((row) => row.code === 'EGRB102')).toMatchObject({
      review_reason: 'vcu_implicit_comma_boolean_formula_not_source_grouped',
      raw_requisites:
        'Prerequisite: MATH 151, MATH 200, MATH 201 or a satisfactory score on the math placement exam',
    });

    const tampered = structuredClone(artifact);
    tampered.review_rows.find((row) => row.course_key === 'va:uni:9229:ECON205')
      .structural_none_evidence.content_accounting.source_content_discarded = true;
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain('va:uni:9229:ECON205:vcu_prerequisite_closure:structural_none_evidence');
  });

  it('integrates all seventeen exact six-university decisions and preserves three blockers', () => {
    expect(smallUniversityArtifactIssues(smallUniversityEvidence)).toEqual([]);
    expect(SMALL_UNIVERSITY_TARGET_KEYS).toHaveLength(17);
    const decisions = Object.values(SMALL_UNIVERSITY_DECISIONS);
    const targetCourseKeys = decisions.map((row) => row.course_key).sort();
    const rows = artifact.review_rows.filter((row) => (
      targetCourseKeys.includes(row.course_key)
    ));
    expect(rows).toHaveLength(17);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(6);
    expect(rows.filter((row) => row.status === 'parsed')).toHaveLength(8);
    expect(rows.filter((row) => row.status === 'none')).toHaveLength(6);
    expect(rows.filter((row) => row.status === 'unparsed')).toHaveLength(3);
    expect(artifact.direct_review_rows.filter((row) => (
      targetCourseKeys.includes(row.course_key)
    ))).toHaveLength(10);
    expect(artifact.closure_review_rows.filter((row) => (
      targetCourseKeys.includes(row.course_key)
    ))).toHaveLength(7);
    for (const row of rows) {
      expect(smallUniversityPrerequisiteResolutionRowIssues(
        row, smallUniversityEvidence,
      )).toEqual([]);
      const decision = decisions.find((item) => item.course_key === row.course_key);
      expect(row.status).toBe(decision.disposition === 'blocked'
        ? 'unparsed' : decision.disposition);
      if (decision.disposition === 'blocked') {
        expect(row).toMatchObject({
          review_status: 'not_promoted',
          review_reason: 'six_university_exact_source_prerequisite_ambiguity_preserved',
          groups: [],
          prerequisite_constraint_blocker_evidence: {
            contract: SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
            prerequisite_formula_inferred: false,
            structural_none_inferred: false,
            source_content_discarded: false,
          },
        });
      } else {
        const proof = row.status === 'none'
          ? row.structural_none_evidence
          : row.small_university_prerequisite_resolution;
        expect(proof).toMatchObject({
          contract: SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
          content_accounting: {
            full_current_entry_replayed_from_retained_official_bytes: true,
            every_reviewed_constraint_signal_span_preserved: true,
            every_requisite_marker_classified: true,
            source_content_discarded: false,
          },
        });
      }
    }

    const tampered = structuredClone(artifact);
    tampered.review_rows.find((row) => row.course_key === 'va:uni:9224:CSC121')
      .structural_none_evidence.content_accounting.source_content_discarded = true;
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain('va:uni:9224:CSC121:small_university_prerequisite_closure:proof');
  });

  it('integrates the residual, EGMN, and Radford/UVA recursive contracts atomically', () => {
    const remaining = artifact.review_rows.filter((row) => (
      REMAINING_UNIVERSITY_PREREQUISITE_KEYS.includes(row.course_key)
    ));
    expect(remaining).toHaveLength(10);
    expect(remaining.filter((row) => row.status === 'none')).toHaveLength(7);
    expect(remaining.filter((row) => row.status === 'unparsed')).toHaveLength(3);
    expect(remaining.every((row) => (
      remainingUniversityPrerequisiteResolutionRowIssues(row).length === 0
    ))).toBe(true);

    const egmn = artifact.review_rows.filter((row) => (
      VCU_EGMN_PREREQUISITE_KEYS.includes(row.course_key)
    ));
    expect(egmn).toHaveLength(3);
    expect(egmn.filter((row) => row.status === 'none')).toHaveLength(2);
    expect(egmn.find((row) => row.code === 'EGMN102')).toMatchObject({
      status: 'unparsed',
      groups: [],
      prerequisite_constraint_blocker_evidence: {
        contract: VCU_EGMN_PREREQUISITE_CONTRACT,
        partial_course_edges_emitted: false,
      },
    });
    expect(egmn.every((row) => (
      vcuEgmnPrerequisiteResolutionRowIssues(row).length === 0
    ))).toBe(true);

    const radfordUva = artifact.review_rows.filter((row) => (
      RADFORD_UVA_WISE_RECURSIVE_KEYS.includes(row.course_key)
    ));
    expect(radfordUva).toHaveLength(14);
    expect(radfordUva.filter((row) => row.status === 'parsed')).toHaveLength(5);
    expect(radfordUva.filter((row) => row.status === 'unparsed')).toHaveLength(9);
    expect(radfordUva.every((row) => (
      radfordUvaWiseRecursiveResolutionRowIssues(row).length === 0
    ))).toBe(true);
    expect(radfordUva.filter((row) => row.status === 'unparsed').every((row) => (
      row.groups.length === 0
      && row.prerequisite_constraint_blocker_evidence.partial_course_edges_emitted === false
    ))).toBe(true);

    const egre254 = artifact.review_rows.find((row) => (
      row.course_key === 'va:uni:9229:EGRE254'
    ));
    expect(egre254.groups[0].paths.every((formulaPath) => (
      formulaPath.all_of.some((condition) => (
        condition.type === 'non_course'
          && condition.departmental_applicability_required === true
      ))
    ))).toBe(true);
  });

  it('integrates only the two safe tail rows and preserves the reciprocal cycle', () => {
    expect(universityPrerequisiteTailControl.verified).toBe(true);
    expect(artifact.university_prerequisite_tail_closure_audit)
      .toEqual(universityPrerequisiteTailControlSummary(
        universityPrerequisiteTailControl,
      ));
    expect(UNIVERSITY_PREREQUISITE_TAIL_KEYS).toEqual([
      'james-madison-university:MATH234',
      'old-dominion-university:MATH100',
      'william-mary:CSCI141L',
    ]);
    const rows = Object.values(UNIVERSITY_PREREQUISITE_TAIL_DECISIONS).map((decision) => (
      artifact.review_rows.find((row) => row.course_key === decision.course_key)
    ));
    expect(rows.every(Boolean)).toBe(true);
    for (const row of rows) {
      expect(universityPrerequisiteTailResolutionRowIssues(
        row, universityPrerequisiteTailControl,
      )).toEqual([]);
    }
    expect(rows.find((row) => row.code === 'MATH234')).toMatchObject({
      status: 'parsed',
      groups: [{
        kind: 'prerequisite',
        paths: [{ all_of: [{
          course_key: 'va:uni:9213:MATH233',
          minimum_grade: 'C-',
        }] }],
      }],
      ignored_nonrequired_requisites: [{
        kind: 'prior_credit_exclusion',
        excluded_if_credit_for: ['MATH235'],
      }],
      university_prerequisite_tail_resolution: {
        contract: UNIVERSITY_PREREQUISITE_TAIL_CONTRACT,
      },
    });
    expect(rows.find((row) => row.code === 'MATH100')).toMatchObject({
      status: 'none',
      groups: [],
      ignored_nonrequired_requisites: [
        { kind: 'outbound_other_course_prerequisite_noncompletion_description' },
        { kind: 'negative_prior_credit_or_higher_math_qualification_exclusion' },
      ],
      structural_none_evidence: {
        contract: UNIVERSITY_PREREQUISITE_TAIL_CONTRACT,
        graph_effect: {
          added_course_vertices: 0,
          added_prerequisite_edges: 0,
          added_corequisite_edges: 0,
        },
      },
    });
    expect(rows.find((row) => row.code === 'CSCI141L')).toMatchObject({
      status: 'unparsed',
      review_reason: 'reciprocal_corequisite_cycle_rejected_by_production_compiler',
      groups: [],
      preserved_source_formula_groups: [{
        kind: 'corequisite',
        paths: [{ all_of: [{ course_key: 'va:uni:9233:CSCI141' }] }],
      }],
      prerequisite_constraint_blocker_evidence: {
        contract: UNIVERSITY_PREREQUISITE_TAIL_CONTRACT,
        source_formula_status: 'exact',
        production_compiler_issue: 'requisite_graph_cycle',
        formula_dropped_or_rewritten: false,
      },
    });
    expect(artifact.review_rows.find((row) => (
      row.course_key === 'va:uni:9213:MATH233'
    ))).toMatchObject({
      status: 'unparsed',
      review_status: 'not_promoted',
    });
  });

  it('promotes only five exact Radford/Randolph-Macon zero-edge rows and preserves required prior knowledge', () => {
    expect(radfordRmcTailEvidenceIssues(radfordRmcTailEvidence)).toEqual([]);
    expect(artifact.radford_randolph_macon_prerequisite_tail_audit)
      .toEqual(radfordRmcTailEvidenceSummary(radfordRmcTailEvidence));
    expect(RADFORD_RMC_TAIL_KEYS).toEqual([
      'va:uni:9219:ENGL111',
      'va:uni:9221:CSCI111',
      'va:uni:9221:CSCI382',
      'va:uni:9221:CSEC121',
      'va:uni:9221:ENGL185',
      'va:uni:9221:MATH131',
    ]);
    const rows = RADFORD_RMC_TAIL_KEYS.map((courseKey) => (
      artifact.review_rows.find((row) => row.course_key === courseKey)
    ));
    expect(rows.every(Boolean)).toBe(true);
    expect(rows.filter((row) => row.status === 'none')).toHaveLength(5);
    expect(rows.filter((row) => row.status === 'unparsed').map((row) => row.code))
      .toEqual(['MATH131']);
    for (const row of rows) {
      expect(radfordRmcTailResolutionRowIssues(row, radfordRmcTailEvidence)).toEqual([]);
    }
    expect(rows.find((row) => row.code === 'ENGL111')).toMatchObject({
      ignored_nonrequired_requisites: [{ kind: 'mutual_credit_exclusion' }],
      structural_none_evidence: { contract: RADFORD_RMC_TAIL_CONTRACT },
    });
    expect(rows.find((row) => row.code === 'ENGL185')).toMatchObject({
      ignored_nonrequired_requisites: [{
        kind: 'absolute_first_year_timing_constraint',
        figure6_h_g_effect: false,
      }],
    });
    expect(rows.find((row) => row.code === 'CSEC121')).toMatchObject({
      ignored_nonrequired_requisites: [{
        kind: 'course_learning_outcome_not_prior_knowledge',
        knowledge_is_developed_by_course: true,
      }],
    });
    const csci382 = rows.find((row) => row.code === 'CSCI382');
    expect(csci382.source_content_sha256)
      .toBe('449f4a7781f8ec49111bd40442babf1e2384ae963fb36f17ce0711fd47d3e892');
    expect(candidates.candidates.find((row) => row.course_key === csci382.course_key)
      .source.raw_entry_sha256)
      .toBe('071ec8952f8bce1a16d83adec2b145fc934d2c3679f7e3321d994d295b3f9225');
    expect(rows.find((row) => row.code === 'MATH131')).toMatchObject({
      status: 'unparsed',
      review_reason: 'required_prior_knowledge_runtime_binding_unresolved',
      groups: [],
      prerequisite_constraint_blocker_evidence: {
        contract: RADFORD_RMC_TAIL_CONTRACT,
        prerequisite_formula_inferred: false,
        structural_none_inferred: false,
      },
    });

    const tampered = structuredClone(artifact);
    tampered.review_rows.find((row) => row.course_key === 'va:uni:9221:CSCI382')
      .review_evidence.source_response_sha256 = '0'.repeat(64);
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain('va:uni:9221:CSCI382:radford_randolph_macon_tail:source_projection');
  });

  it('records the complete eight-row source-bound rejection audit', () => {
    expect(artifact.strict_formula_rejection_audit).toMatchObject({
      receipt_contract: 'va_university_strict_formula_rejection_source_bound_audit_v1',
      prior_strict_parser_rejected_rows: 8,
      audited_rows: 8,
      newly_promoted_lossless_formula_rows: 5,
      remaining_blocked_rows: 3,
      promoted_keys: [
        'radford-university:MATH171',
        'the-university-of-virginia-s-college-at-wise:CSC2180',
        'virginia-commonwealth-university:BNFO201',
        'virginia-commonwealth-university:EGRE254',
        'virginia-commonwealth-university:ENGR261',
      ],
      blocked_keys: [
        'radford-university:CS322',
        'randolph-macon-college:CSCI311',
        'virginia-polytechnic-institute-and-state-university:CS3704',
      ],
      complete: true,
    });
    expect(artifact.strict_formula_rejection_audit.exact_decisions).toHaveLength(8);
    expect(artifact.review_rows.filter((row) => (
      row.strict_formula_rejection_audit?.source_receipt_valid === true
    ))).toHaveLength(8);
  });

  it('promotes only controlled structural decisions and keeps every other silence/corequisite blocked', () => {
    const controlled = artifact.review_rows.filter((row) => (
      row.review_status === 'promoted_structural_none'
    ));
    expect(controlled).toHaveLength(280);
    const courseleaf = controlled.filter((row) => (
      row.review_reason
        === 'complete_courseleaf_entry_silence_with_same_source_required_marker_control'
    ));
    expect(courseleaf).toHaveLength(130);
    expect(courseleaf.every((row) => (
      row.status === 'none'
      && row.review_evidence.capture_origin === 'official_acquisition'
      && row.review_evidence.source_format === 'courseleaf_courseblock'
      && row.review_evidence.complete_entry_receipt.same_source_positive_control === true
      && row.review_evidence.complete_entry_receipt.entry_required_requisite_marker_count === 0
      && row.review_evidence.complete_entry_receipt.entry_corequisite_marker_count === 0
      && row.review_evidence.complete_entry_receipt.entry_requisite_marker_like_count === 0
      && row.review_evidence.complete_entry_receipt.entry_constraint_like_signal_count === 0
    ))).toBe(true);
    const georgeMason = controlled.filter((row) => (
      row.review_reason
        === 'exact_gmu_complete_entry_no_required_requisite_with_nonrequired_signals_preserved'
    ));
    expect(georgeMason).toHaveLength(15);
    expect(georgeMason.reduce((total, row) => (
      total + row.ignored_nonrequired_requisites.length
    ), 0)).toBe(48);
    expect(georgeMason.every((row) => (
      row.status === 'none'
      && row.structural_none_evidence.literal_none_statement === false
      && row.structural_none_evidence.formal_required_label_audit
        .required_prerequisite_or_corequisite_label_count === 0
      && row.structural_none_evidence.content_accounting
        .every_reviewed_nonrequired_signal_marker_accounted_for === true
      && row.ignored_nonrequired_requisites.every((signal) => (
        signal.required_prerequisite_graph_edge_emitted === false
      ))
    ))).toBe(true);
    const georgeMasonClosure = controlled.filter((row) => (
      row.review_reason
        === 'exact_gmu_recursive_complete_entry_no_required_requisite_with_nonrequired_signals_preserved'
    ));
    expect(georgeMasonClosure).toHaveLength(42);
    expect(georgeMasonClosure.reduce((total, row) => (
      total + row.ignored_nonrequired_requisites.length
    ), 0)).toBe(118);
    expect(georgeMasonClosure.every((row) => (
      row.status === 'none'
      && row.structural_none_evidence.contract
        === 'gmu_recursive_closure_exact_courseleaf_silence_and_missing_reference_audit_v1'
      && row.structural_none_evidence.content_accounting
        .every_reviewed_nonrequired_signal_marker_accounted_for === true
    ))).toBe(true);
    const virginiaState = controlled.filter((row) => (
      row.structural_none_evidence?.contract === VSU_PREREQUISITE_CLOSURE_CONTRACT
    ));
    expect(virginiaState).toHaveLength(19);
    expect(virginiaState.every((row) => (
      row.status === 'none'
      && row.review_reason
        === 'exact_vsu_courseleaf_required_requisite_formula_or_structural_silence'
      && row.structural_none_evidence.content_accounting
        .every_reviewed_corequisite_and_noncourse_signal_preserved === true
      && row.structural_none_evidence.content_accounting.source_content_discarded === false
      && vsuPrerequisiteClosureResolutionRowIssues(row).length === 0
    ))).toBe(true);
    const uvaWise = controlled.filter((row) => (
      row.review_reason
        === 'complete_uva_wise_acalog_entry_silence_with_same_catalog_required_marker_control'
    ));
    expect(uvaWise).toHaveLength(9);
    expect(uvaWise.every((row) => (
      row.status === 'none'
      && row.review_evidence.capture_origin === 'official_uva_wise_acalog_course_page'
      && row.review_evidence.required_requisite_clause === null
      && row.structural_none_evidence.literal_none_statement === false
      && row.structural_none_evidence.marker_control.same_catalog_positive_control === true
      && row.structural_none_evidence.marker_control.exact_complete_entry_count === 31
      && row.structural_none_evidence.marker_control
        .exact_complete_entries_with_required_requisite_marker_count === 20
    ))).toBe(true);
    const bridgewater = controlled.filter((row) => (
      row.review_reason
        === 'complete_bridgewater_cleancatalog_entry_silence_with_same_edition_requisite_marker_controls'
    ));
    expect(bridgewater).toHaveLength(8);
    expect(bridgewater.map((row) => row.code).sort()).toEqual([
      'COMM100', 'CSCI100', 'CSCI101', 'CSCI130',
      'MATH110', 'MATH140', 'MATH141', 'MATH150',
    ]);
    expect(bridgewater.every((row) => (
      row.status === 'none'
      && row.structural_none_evidence.literal_none_statement === false
      && row.structural_none_evidence.marker_control.same_edition_positive_controls === true
      && row.structural_none_evidence.marker_control.exact_complete_entry_count === 30
      && row.structural_none_evidence.marker_control
        .exact_complete_entries_with_prerequisite_field_count === 20
      && row.structural_none_evidence.marker_control
        .exact_complete_entries_with_corequisite_field_count === 1
    ))).toBe(true);
    const virginiaTechCurrent = controlled.filter((row) => (
      row.review_reason
        === 'complete_current_virginia_tech_graduate_cs_entry_silence_with_same_page_pre_controls'
    ));
    expect(virginiaTechCurrent).toHaveLength(1);
    expect(virginiaTechCurrent[0]).toMatchObject({
      code: 'CS5104',
      status: 'none',
      catalog_year: null,
      review_evidence: {
        source_format: 'virginia_tech_current_graduate_cs_heading_entry',
        catalog_edition_claimed: false,
      },
      structural_none_evidence: {
        literal_none_statement: false,
        marker_control: {
          exact_complete_entry_present: true,
          same_page_positive_control: true,
          source_bounded_entry_count: 56,
          source_entries_with_pre_marker_count: 43,
          source_pre_marker_count: 46,
          missing_search_result_used: false,
        },
      },
    });
    const shenandoah = controlled.filter((row) => (
      row.review_reason
        === 'complete_shenandoah_acalog_entry_silence_with_same_catalog_required_marker_control'
    ));
    expect(shenandoah.map((row) => row.code).sort())
      .toEqual(['ENG101', 'INT101', 'MATH101']);
    expect(shenandoah.every((row) => (
      row.status === 'none'
      && row.structural_none_evidence.literal_none_statement === false
      && row.structural_none_evidence.marker_control.exact_complete_entry_count === 19
      && row.structural_none_evidence.marker_control
        .exact_complete_entries_with_required_requisite_marker_count === 14
    ))).toBe(true);
    const vcu = controlled.filter((row) => (
      row.structural_none_evidence?.contract === VCU_PREREQUISITE_CLOSURE_CONTRACT
    ));
    expect(vcu).toHaveLength(7);
    expect(vcu.every((row) => vcuPrerequisiteResolutionRowIssues(row).length === 0))
      .toBe(true);
    const exactNonCourse = controlled.filter((row) => (
      row.structural_none_evidence?.contract === FIGURE6_NONCOURSE_DISPOSITION_CONTRACT
    ));
    expect(exactNonCourse.map((row) => row.course_key)).toEqual([
      'va:uni:9205:CL100', 'va:uni:9205:CL150', 'va:uni:9218:CS115',
      'va:uni:9218:OEAS110N', 'va:uni:9218:OEAS111N', 'va:uni:9218:OEAS126N',
    ]);
    expect(exactNonCourse.every((row) => (
      row.structural_none_evidence.kind === FIGURE6_NONCOURSE_STRUCTURAL_NONE_KIND
      && row.structural_none_evidence.content_accounting.source_content_discarded === false
      && row.retained_non_prerequisite_signals.length > 0
      && figure6NonCourseDispositionResolutionRowIssues(row).length === 0
    ))).toBe(true);
    expect(artifact.review_rows.filter((row) => (
      row.review_reason === 'no_explicit_required_requisite_statement'
    ))).toHaveLength(1);
    expect(artifact.direct_review_rows.filter((row) => (
      row.review_reason === 'corequisite_statement_does_not_prove_no_prerequisite'
    ))).toHaveLength(0);
    expect(artifact.review_rows.some((row) => row.review_status === 'promoted_explicit_none'))
      .toBe(false);

    const arab325 = artifact.review_rows.find((row) => (
      row.slug === 'george-mason-university' && row.code === 'ARAB325'
    ));
    expect(arab325.review_evidence).toMatchObject({
      capture_origin: 'official_acquisition',
      source_format: 'courseleaf_courseblock',
      boundary_contract: 'unique_courseblock_exact_leading_code_with_published_units',
      courseblock_index: expect.any(Number),
      complete_entry_receipt: {
        receipt_contract:
          'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1',
      },
    });
  });

  it('integrates nine safe finite resolutions and preserves all nine remaining blockers', () => {
    const safe = {
      'va:uni:9206:ENGL123':
        'complete_cnu_pdf_entry_silence_with_same_pdf_prerequisite_positive_control',
      'va:uni:9218:CS121G':
        'complete_odu_courseleaf_entry_silence_with_same_response_prerequisite_positive_control',
      'va:uni:9218:CS222':
        'complete_odu_courseleaf_entry_silence_with_same_response_prerequisite_positive_control',
      'va:uni:9205:CL100':
        'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect',
      'va:uni:9205:CL150':
        'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect',
      'va:uni:9218:CS115':
        'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect',
      'va:uni:9218:OEAS110N':
        'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect',
      'va:uni:9218:OEAS111N':
        'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect',
      'va:uni:9218:OEAS126N':
        'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect',
    };
    for (const [key, reason] of Object.entries(safe)) {
      expect(artifact.direct_review_rows.find((row) => row.course_key === key)).toMatchObject({
        status: 'none',
        review_status: 'promoted_structural_none',
        review_reason: reason,
        structural_none_evidence: { literal_none_statement: false },
      });
    }
    const blockedKeys = [
      'va:uni:9214:CMSC140', 'va:uni:9214:CMSC160',
      'va:uni:9214:CMSC161', 'va:uni:9214:CMSC483',
      'va:uni:9214:CTZN110', 'va:uni:9214:ENGL165',
      'va:uni:9214:MATH171', 'va:uni:9214:MATH175',
      'va:uni:9218:OEAS106N',
    ];
    const blocked = blockedKeys.map((key) => (
      artifact.direct_review_rows.find((row) => row.course_key === key)
    ));
    expect(blocked).toHaveLength(9);
    expect(blocked.every((row) => (
      row?.status === 'unparsed'
      && row.review_status === 'not_promoted'
      && row.prerequisite_constraint_blocker_evidence
    ))).toBe(true);
    expect(blocked.find((row) => row.code === 'CMSC160').preserved_corequisite_groups[0]
      .paths[0].all_of.map((condition) => condition.code)).toEqual(['CMSC161']);
    expect(blocked.find((row) => row.code === 'CMSC161').preserved_corequisite_groups[0]
      .paths.map((path) => path.all_of.map((condition) => condition.code)))
      .toEqual([['CMSC160'], ['CMSC162']]);
    expect(blocked.find((row) => row.code === 'OEAS106N')
      .retained_non_prerequisite_signals.map((signal) => signal.kind))
      .toEqual(['required_prior_knowledge', 'required_course_component']);
    expect(artifact.direct_review_rows.find((row) => row.code === 'CS115')
      .retained_non_prerequisite_signals.map((signal) => signal.kind))
      .toEqual(['intended_audience', 'required_course_component', 'prior_credit_exclusion']);

    const cnuTampered = structuredClone(artifact);
    cnuTampered.review_rows.find((row) => row.course_key === 'va:uni:9206:ENGL123')
      .structural_none_evidence.marker_control.positive_control_sha256 = '0'.repeat(64);
    expect(validateUniversityPrerequisiteReview(cnuTampered, { scope, candidates }).issues)
      .toContain('va:uni:9206:ENGL123:cnu_engl123_resolution:marker_control');

    const oduTampered = structuredClone(artifact);
    oduTampered.review_rows.find((row) => row.course_key === 'va:uni:9218:CS121G')
      .structural_none_evidence.marker_control.positive_control_sha256 = '0'.repeat(64);
    expect(validateUniversityPrerequisiteReview(oduTampered, { scope, candidates }).issues)
      .toContain('va:uni:9218:CS121G:odu_closure_resolution:marker_control');
  });

  it('preserves raw entry and clause evidence for every promoted row', () => {
    for (const row of artifact.promoted_rows) {
      expect(row).toMatchObject({
        source: 'institution_catalog',
        review_status: expect.stringMatching(/^promoted_/),
        review_evidence: {
          raw_entry_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          raw_entry_text: expect.any(String),
          entry_character_start: expect.any(Number),
          entry_character_end: expect.any(Number),
        },
        source_evidence: {
          kind: 'official_course_entry',
          raw_text: expect.any(String),
          content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        source_content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        source_bundle_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      if (row.status === 'parsed'
          && row.course_key !== 'va:uni:9217:CSC295'
          && !row.virginia_tech_remaining_prerequisite_resolution
          && !row.virginia_state_prerequisite_resolution
          && !row.small_university_prerequisite_resolution
          && !row.university_prerequisite_tail_resolution) {
        expect(row.review_evidence.clauses.length).toBeGreaterThan(0);
      } else if (row.course_key === 'va:uni:9217:CSC295') {
        expect(row.review_evidence.clauses).toEqual([]);
        expect(row.norfolk_state_csc295_resolution).toBeTruthy();
      } else if (row.virginia_tech_remaining_prerequisite_resolution) {
        expect(row.review_evidence.clauses).toEqual([]);
        expect(row.virginia_tech_remaining_prerequisite_resolution.proof).toBeTruthy();
      } else if (row.virginia_state_prerequisite_resolution) {
        expect(vsuPrerequisiteClosureResolutionRowIssues(row)).toEqual([]);
      } else if (row.small_university_prerequisite_resolution) {
        expect(smallUniversityPrerequisiteResolutionRowIssues(
          row, smallUniversityEvidence,
        )).toEqual([]);
      } else if (row.university_prerequisite_tail_resolution) {
        expect(universityPrerequisiteTailResolutionRowIssues(
          row, universityPrerequisiteTailControl,
        )).toEqual([]);
      } else expect(row.review_status).toBe('promoted_structural_none');
      expect(row.owner_namespace).toMatch(/^va:uni:\d+$/);
    }
  });

  it('rejects tampering with a promoted CourseLeaf silence receipt', () => {
    const tampered = structuredClone(artifact);
    const source = tampered.review_rows.find((row) => (
      row.review_reason
        === 'complete_courseleaf_entry_silence_with_same_source_required_marker_control'
    ));
    for (const rows of [
      tampered.review_rows, tampered.direct_review_rows,
      tampered.closure_review_rows, tampered.promoted_rows,
    ]) {
      const row = rows.find((candidate) => candidate.course_key === source.course_key);
      if (row) row.review_evidence.complete_entry_receipt.same_source_positive_control = false;
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${source.course_key}:courseleaf_marker_control`);
  });

  it('emits strict-contract rows whose only corpus failures are known coverage and closure gaps', () => {
    const report = validateVirginiaFigure6PrerequisiteCorpus({
      universityRows: artifact.promoted_rows,
      requiredUniversityKeys: requiredUniversityCourseKeys(scope),
      adapterIntegrated: true,
    });
    expect(report.ready).toBe(false);
    expect(new Set(report.issues.map((issue) => issue.code))).toEqual(new Set([
      'prerequisite_corpus_missing',
      'required_course_requisite_missing',
      'prerequisite_formula_closure_missing',
    ]));
    expect(report.issues.filter((issue) => (
      issue.code === 'required_course_requisite_missing'
    ))).toHaveLength(27);
  });

  it('reports recursive closure gaps rather than treating parsed direct rows as complete', () => {
    expect(artifact.closure).toMatchObject({
      complete: false,
      formula_reference_keys: 709,
      resolved_promoted_keys: 633,
      unresolved_reference_keys: 76,
      unresolved_unparsed_direct_keys: 11,
      unresolved_unparsed_closure_keys: 20,
      unresolved_missing_direct_keys: 1,
      unresolved_outside_direct_scope_keys: 44,
    });
    expect(artifact.closure.unresolved_reference_keys).toBe(
      artifact.closure.unresolved_unparsed_direct_keys
      + artifact.closure.unresolved_unparsed_closure_keys
      + artifact.closure.unresolved_missing_direct_keys
      + artifact.closure.unresolved_outside_direct_scope_keys,
    );
  });

  it('retains every VSU English-major conditional while projecting only the exact CS scope', () => {
    const rows = artifact.direct_review_rows.filter((row) => (
      row.owner_namespace === 'va:uni:9231'
      && VSU_ENGLISH_TARGET_CODES.includes(row.code)
    ));
    expect(rows.map((row) => row.code).sort())
      .toEqual([...VSU_ENGLISH_TARGET_CODES].sort());
    for (const row of rows) {
      expect(vsuEnglishProjectionRowIssues(row)).toEqual([]);
      expect(row).toMatchObject({
        status: 'parsed',
        review_status: 'promoted_strict_formula',
        review_reason: 'exact_vsu_cs_scope_english_major_conditional_projection',
      });
      expect(row.groups).toHaveLength(1);
      expect(row.groups[0].paths).toHaveLength(4);
      expect(row.groups[0].paths.flatMap((path) => path.all_of)
        .some((condition) => condition.code === 'ENGL203')).toBe(false);
      const clause = row.review_evidence.clauses[0];
      const proof = row.vsu_english_cs_scope_projection;
      expect(
        `${proof.all_student_prerequisite.raw}${proof.english_major_conditional.raw}`,
      ).toBe(clause.raw);
      expect(row.source_evidence.raw_text).toContain(clause.raw);
      expect(proof.english_major_conditional).toMatchObject({
        required_major: 'English',
        modeled_major: 'Computer Science',
        applicable_to_modeled_degree_scope: false,
        preserved_in_source_evidence: true,
        graph_edge_emitted: false,
        omitted_course_key: 'va:uni:9231:ENGL203',
      });
      expect(proof.content_accounting).toMatchObject({
        accounted_characters: clause.raw.length,
        source_content_discarded: false,
      });
    }

    const tampered = structuredClone(artifact);
    for (const partition of [
      tampered.review_rows,
      tampered.direct_review_rows,
      tampered.promoted_rows,
    ]) {
      const row = partition.find((candidate) => candidate.course_key === rows[0].course_key);
      row.vsu_english_cs_scope_projection.english_major_conditional.graph_edge_emitted = true;
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${rows[0].course_key}:vsu_english_cs_scope_projection:projection_evidence`);
  });

  it('records the exact direct-row parser gains and leaves all unsafe formulas blocked', () => {
    const newlyParsed = {
      'bridgewater-college': [
        'CSCI102', 'CSCI110', 'CSCI131', 'CSCI220', 'CSCI250', 'CSCI261',
        'CSCI320', 'CSCI331', 'CSCI332', 'CSCI341', 'CSCI342', 'CSCI361',
        'CSCI400', 'CSCI461', 'DSA230', 'DSA350',
      ],
      'christopher-newport-university': [
        'CPSC150', 'CPSC250', 'CPSC471', 'CPSC472', 'CPSC495', 'CYBR428',
        'MATH140', 'PCSE495', 'PHYS341', 'PHYS441',
      ],
      'george-mason-university': ['ENGH302', 'GEOL103'],
      'longwood-university': [
        'CMSC360', 'CMSC415', 'CMSC455', 'MATH301', 'PSYC335', 'RELI301',
        'SPAN320',
      ],
      'old-dominion-university': [
        'BIOL121N', 'BIOL122N', 'BIOL123N', 'BIOL124N', 'BIOL136N', 'BIOL137N',
        'BIOL138N', 'BIOL139N', 'CHEM121N', 'CS250', 'CS315', 'CS367', 'CS368',
        'CS481', 'ENGL110C', 'PHYS227N', 'PHYS231N', 'PHYS232N', 'CHEM105N',
        'CS253', 'CS465', 'CS469', 'CS486',
      ],
      'radford-university': ['MATH171'],
      'randolph-macon-college': ['CSCI485'],
      'the-university-of-virginia-s-college-at-wise': [
        'CSC1180', 'CSC2180', 'CSC2300', 'CSC3180', 'CSC3400', 'CSC3710', 'CSC4000',
        'CSC4200', 'CSC4300', 'CSC4350', 'ENG1020', 'FRE1020', 'GER1020',
        'MTH2040', 'MTH2050', 'MTH2180', 'SPA1020', 'STA2180', 'SWE2300', 'CSC4990',
      ],
      'virginia-commonwealth-university': [
        'BIOL151', 'BIOZ151', 'CHEM101', 'CMSC255', 'CMSC256', 'CMSC302', 'CMSC303',
        'CMSC405', 'CMSC436', 'CMSC438', 'CMSC441', 'CMSC451', 'CMSC491', 'MATH200',
        'STAT210', 'STAT212', 'UNIV200',
      ],
      'virginia-state-university': [
        'BIOL121', 'CHEM151', 'CHEM152', 'CHEM154', 'CHEM161', 'CHEM162',
        'CHEM164', 'CSCI101', 'CSCI298',
        'CSCI312', 'CSCI398', 'CSCI400', 'CSCI460', 'CSCI488',
        'CSCI493', 'CSCI495', 'ECON211', 'FREN111', 'FREN212', 'FREN213', 'SPAN111',
        'SPAN212', 'SPAN213', 'STAT380', 'MATH317', 'MATH352', 'ENGL112', 'ENGL113',
      ],
      'virginia-polytechnic-institute-and-state-university': [
        'CS2505', 'CS2506', 'CS3214', 'CS3304', 'CS4104', 'CS4284',
        'CS4634', 'CS4644', 'CS4884', 'CHEM1035', 'CHEM1036', 'CS4704',
        'ECE4504', 'ENGL3804', 'ENGL3814', 'MATH2114', 'MATH1226',
      ],
    };
    expect(Object.values(newlyParsed).flat()).toHaveLength(142);
    for (const [slug, codes] of Object.entries(newlyParsed)) {
      expect(codes.every((code) => artifact.direct_review_rows.some((row) => (
        row.slug === slug
        && row.code === code
        && row.review_status === 'promoted_strict_formula'
        && row.review_reason === 'every_required_clause_character_accounted_for_by_strict_grammar'
      )))).toBe(true);
    }

    const residuals = Object.fromEntries(Object.entries({
      'randolph-macon-college': ['CSCI311'],
    }).map(([slug, codes]) => [slug, [...codes].sort()]));
    const actual = {};
    for (const row of artifact.direct_review_rows.filter((candidate) => (
      candidate.review_reason === 'strict_formula_parser_rejected'
    ))) {
      (actual[row.slug] ||= []).push(row.code);
    }
    for (const codes of Object.values(actual)) codes.sort();
    expect(actual).toEqual(residuals);
    expect(Object.values(actual).flat()).toHaveLength(1);
    expect(actual['christopher-newport-university']).toBeUndefined();
    expect(actual['old-dominion-university']).toBeUndefined();

    const vt = 'virginia-polytechnic-institute-and-state-university';
    const exactResolved = artifact.direct_review_rows.filter((row) => (
      row.slug === vt
      && row.review_reason === 'virginia_tech_exact_courseleaf_semantics_resolved'
    ));
    expect(exactResolved.map((row) => row.code).sort()).toEqual([
      'BIOL1115', 'BIOL1116', 'CS3604', 'MATH1225', 'MATH2534',
    ]);
    expect(exactResolved.every((row) => (
      row.status === 'parsed'
      && row.review_status === 'promoted_strict_formula'
      && row.groups.every((group) => group.flags.includes(
        'virginia_tech_exact_candidate_and_source_fingerprint_v1',
      ))
    ))).toBe(true);

    const exactBlocked = artifact.direct_review_rows.filter((row) => (
      row.slug === vt
      && row.virginia_tech_remaining_prerequisite_resolution?.ready === false
    ));
    expect(exactBlocked.map((row) => row.code).sort()).toEqual([
      'CS4664', 'ENGE4735', 'ENGE4736', 'MATH3414', 'MATH4445',
      'MUS3065', 'MUS3066',
    ]);
    expect(exactBlocked.every((row) => (
      row.status === 'unparsed'
      && row.review_status === 'not_promoted'
      && row.groups.length === 0
    ))).toBe(true);
  });

  it('keeps VSU BIOL 121 same-code lab/lecture components without inventing a graph self-edge', () => {
    const row = artifact.direct_review_rows.find((candidate) => (
      candidate.slug === 'virginia-state-university' && candidate.code === 'BIOL121'
    ));
    expect(row).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      raw_requisites: 'Prerequisite: BIOL 120 Principles of Biology I',
      groups: [expect.objectContaining({
        kind: 'prerequisite',
        paths: [expect.objectContaining({
          all_of: [expect.objectContaining({ code: 'BIOL120' })],
        })],
      })],
    });
    expect(row.groups.flatMap((group) => group.paths)
      .flatMap((path) => path.all_of)
      .some((condition) => condition.course_key === row.course_key)).toBe(false);
    expect(row.internal_component_corequisites).toEqual([
      expect.objectContaining({
        kind: 'same_catalog_code_internal_lecture_laboratory_corequisite',
        course_code: 'BIOL121', component: 'laboratory', graph_edge_emitted: false,
      }),
      expect.objectContaining({
        kind: 'same_catalog_code_internal_lecture_laboratory_corequisite',
        course_code: 'BIOL121', component: 'lecture', graph_edge_emitted: false,
      }),
    ]);
    for (const component of row.internal_component_corequisites) {
      const start = component.source_character_start
        - row.review_evidence.entry_character_start;
      const end = component.source_character_end
        - row.review_evidence.entry_character_start;
      expect(row.review_evidence.raw_entry_text.slice(start, end)).toBe(component.raw);
    }

    const tampered = structuredClone(artifact);
    for (const collection of [
      tampered.review_rows, tampered.direct_review_rows, tampered.promoted_rows,
    ]) {
      collection.find((candidate) => candidate.course_key === row.course_key)
        .internal_component_corequisites[0].component = 'invented';
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${row.course_key}:vsu_biol121_internal_components`);
  });

  it('binds VSU PHYS 106/113 component projections to exact entries without self-edges', () => {
    const rows = Object.fromEntries(artifact.direct_review_rows.filter((candidate) => (
      candidate.slug === 'virginia-state-university'
      && ['PHYS106', 'PHYS113'].includes(candidate.code)
    )).map((row) => [row.code, row]));
    expect(Object.keys(rows).sort()).toEqual(['PHYS106', 'PHYS113']);
    expect(rows.PHYS106).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      review_reason: 'exact_vsu_combined_lecture_laboratory_component_receipt',
      groups: [expect.objectContaining({
        kind: 'prerequisite',
        component_requirement_ids: [
          'lecture_prerequisite_phys105', 'laboratory_prerequisite_phys105',
        ],
        paths: [expect.objectContaining({
          all_of: [expect.objectContaining({ code: 'PHYS105' })],
        })],
      })],
      vsu_physics_combined_component_resolution: expect.objectContaining({
        ready: true,
        receipt_contract: 'vsu_exact_combined_lecture_laboratory_component_entry_v1',
        component_requirements: [
          expect.objectContaining({
            component: 'lecture', kind: 'prerequisite',
            required_course_code: 'PHYS105', graph_edge_emitted: true,
          }),
          expect.objectContaining({
            component: 'laboratory', kind: 'prerequisite',
            required_course_code: 'PHYS105', graph_edge_emitted: false,
            graph_projection: 'coalesced_with_identical_receiver_graph_edge',
          }),
        ],
      }),
    });
    expect(rows.PHYS106.internal_component_corequisites).toBeUndefined();

    expect(rows.PHYS113).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      review_reason: 'exact_vsu_combined_lecture_laboratory_component_receipt',
      groups: [
        expect.objectContaining({
          kind: 'prerequisite',
          paths: [expect.objectContaining({
            all_of: [expect.objectContaining({ code: 'PHYS112' })],
          })],
        }),
        expect.objectContaining({
          kind: 'corequisite',
          paths: [expect.objectContaining({
            all_of: [expect.objectContaining({ code: 'MATH201' })],
          })],
        }),
      ],
      internal_component_corequisites: [expect.objectContaining({
        component: 'laboratory', course_code: 'PHYS113',
        graph_edge_emitted: false,
        component_requirement_id: 'laboratory_corequisite_phys113',
      })],
    });
    const selfRequirement = rows.PHYS113
      .vsu_physics_combined_component_resolution.component_requirements
      .find((row) => row.id === 'laboratory_corequisite_phys113');
    expect(selfRequirement).toMatchObject({
      graph_projection: 'preserved_internal_component_corequisite_without_self_edge',
      graph_edge_emitted: false,
      receiver_graph_edge_identity: null,
    });

    for (const row of Object.values(rows)) {
      expect(row.groups.flatMap((group) => group.paths)
        .flatMap((path) => path.all_of)
        .some((condition) => condition.course_key === row.course_key)).toBe(false);
      const evidence = row.vsu_physics_combined_component_resolution;
      for (const component of [
        ...evidence.component_boundary_evidence,
        ...evidence.component_requirements,
      ]) {
        const start = component.source_character_start
          - row.review_evidence.entry_character_start;
        const end = component.source_character_end
          - row.review_evidence.entry_character_start;
        expect(row.review_evidence.raw_entry_text.slice(start, end)).toBe(component.raw);
      }
    }

    const tampered = structuredClone(artifact);
    for (const collection of [
      tampered.review_rows, tampered.direct_review_rows, tampered.promoted_rows,
    ]) {
      collection.find((candidate) => candidate.course_key === rows.PHYS113.course_key)
        .vsu_physics_combined_component_resolution
        .component_requirements[0].component = 'invented';
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${rows.PHYS113.course_key}:vsu_physics_component_receipt`);
  });

  it('binds the ODU/CNU gains to exact whole-clause grammars and exposes their closure honestly', () => {
    const exactDirect = {
      'christopher-newport-university': [
        'CPSC250', 'CPSC471', 'CPSC472', 'CPSC495', 'MATH140',
        'PCSE495', 'PHYS341', 'PHYS441',
      ],
      'old-dominion-university': [
        'BIOL123N', 'BIOL124N', 'BIOL136N', 'BIOL137N', 'BIOL138N', 'BIOL139N',
        'CHEM121N', 'CS250', 'PHYS227N', 'PHYS232N',
      ],
    };
    for (const [slug, codes] of Object.entries(exactDirect)) {
      for (const code of codes) {
        const row = artifact.direct_review_rows.find((candidate) => (
          candidate.slug === slug && candidate.code === code
        ));
        expect(row).toMatchObject({
          status: 'parsed',
          review_status: 'promoted_strict_formula',
          source_content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        });
        const flag = slug === 'old-dominion-university'
          ? 'odu_exact_whole_clause_formula_roster'
          : 'cnu_exact_whole_clause_formula_roster';
        expect(row.groups.some((group) => group.flags.includes(flag))).toBe(true);
      }
    }

    const math135 = artifact.closure_review_rows.find((row) => (
      row.slug === 'christopher-newport-university' && row.code === 'MATH135'
    ));
    expect(math135).toMatchObject({ status: 'parsed' });
    expect(math135.groups[0].flags).toContain('cnu_exact_whole_clause_formula_roster');

    const math140 = artifact.direct_review_rows.find((row) => (
      row.slug === 'christopher-newport-university' && row.code === 'MATH140'
    ));
    expect(math140.ignored_nonrequired_requisites).toEqual([
      expect.objectContaining({
        kind: 'explicit_embedded_course_preference_not_modeled',
        raw: '(MATH\n132 is preferred)',
        raw_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);

    expect(artifact.closure.resolved).toEqual(expect.arrayContaining([
      'va:uni:9206:CPSC256',
      'va:uni:9218:CHEM120',
      'va:uni:9218:PHYS261N',
    ]));
    expect(artifact.closure.unresolved_unparsed_direct).not.toEqual(expect.arrayContaining([
      'va:uni:9206:CPSC250',
      'va:uni:9206:MATH140',
      'va:uni:9218:CHEM121N',
      'va:uni:9218:CS250',
    ]));
  });

  it('retains the pinned explicit recursive clauses and leaves ambiguous clauses blocked', () => {
    const promotedClosure = {
      'old-dominion-university': [
        'DASC157', 'ECE241', 'ENGN122', 'MATH102M', 'MATH103M', 'MATH162M',
      ],
      'christopher-newport-university': ['MATH135'],
      'randolph-macon-college': ['MATH132'],
      'virginia-commonwealth-university': [
        'BNFO201', 'CHEM100', 'EGRE254', 'ENGR261',
        'MATH139', 'MATH141', 'MATH151', 'MATH310',
      ],
      'radford-university': ['PHYS112', 'PHYS221', 'PHYS222'],
      'the-university-of-virginia-s-college-at-wise': ['MTH1110', 'MTH1210'],
      'virginia-state-university': ['ENGL342'],
      'virginia-polytechnic-institute-and-state-university': [
        'CS3654', 'CS3714', 'CS3754', 'CS3824', 'CS4264', 'ECE2024', 'MATH2114H',
      ],
    };
    expect(Object.values(promotedClosure).flat()).toHaveLength(29);
    for (const [slug, codes] of Object.entries(promotedClosure)) {
      expect(codes.every((code) => artifact.closure_review_rows.some((row) => (
        row.slug === slug
        && row.code === code
        && row.review_status === 'promoted_strict_formula'
      )))).toBe(true);
    }

    expect(artifact.closure_review_rows.filter((row) => (
      row.review_reason === 'strict_formula_parser_rejected'
    )).map((row) => `${row.slug}:${row.code}`)).toEqual([
      'virginia-polytechnic-institute-and-state-university:CS3704',
    ]);
    expect(artifact.closure_review_rows.filter((row) => (
      row.review_reason === 'no_explicit_required_requisite_statement'
    ))).toHaveLength(1);
    expect(artifact.closure_review_rows.filter((row) => (
      row.review_reason === 'corequisite_statement_does_not_prove_no_prerequisite'
    ))).toHaveLength(0);
  });

  it('rejects formula and partition tampering even when superficial counts still match', () => {
    const formulaTampered = structuredClone(artifact);
    const reviewed = formulaTampered.review_rows.find((row) => (
      row.slug === 'old-dominion-university' && row.code === 'CS315'
    ));
    const direct = formulaTampered.direct_review_rows.find((row) => (
      row.course_key === reviewed.course_key
    ));
    const promoted = formulaTampered.promoted_rows.find((row) => (
      row.course_key === reviewed.course_key
    ));
    for (const row of [reviewed, direct, promoted]) {
      row.groups[0].paths[0].all_of[0].minimum_grade = 'A';
    }
    expect(validateUniversityPrerequisiteReview(formulaTampered, { scope, candidates }).issues)
      .toContain(`${reviewed.course_key}:review_replay`);

    const partitionTampered = structuredClone(artifact);
    const partitionRow = partitionTampered.promoted_rows.find((row) => (
      row.slug === 'virginia-state-university' && row.code === 'CSCI101'
    ));
    partitionRow.groups[0].paths[0].all_of[0].condition = 'tampered_major_rule';
    expect(validateUniversityPrerequisiteReview(partitionTampered, { scope, candidates }).issues)
      .toContain(`${partitionRow.course_key}:promoted_row_copy`);
  });

  it('promotes thirteen exact Radford formulas and keeps genuine ambiguity closed', () => {
    const institution = artifact.institution_review.find((row) => (
      row.slug === 'radford-university'
    ));
    expect(institution).toMatchObject({
      direct_required_rows: 15,
      exact_bounded_entry_rows: 15,
      parsed_exact_formulas: 13,
      explicit_none_rows: 1,
      unparsed_review_rows: 1,
      missing_source_entry_rows: 0,
      unparsed_codes: ['CS322'],
      missing_codes: [],
    });
    const rows = artifact.direct_review_rows.filter((row) => (
      row.slug === 'radford-university'
    ));
    expect(rows.filter((row) => row.status === 'parsed').map((row) => row.code).sort())
      .toEqual([
        'CS120', 'CS220', 'CS230', 'CS252', 'CS340', 'CS345',
        'CS350', 'CS370', 'CS390', 'CS411', 'MATH168', 'MATH169', 'MATH171',
      ]);
    expect(rows.every((row) => (
      row.review_evidence.capture_origin === 'official_radford_acalog_course_page'
      && row.review_evidence.source_format === 'radford_acalog_course_page'
      && row.review_evidence.catoid === 62
      && row.review_evidence.robots_crawl_delay_seconds === 120
    ))).toBe(true);
    expect(rows.find((row) => row.code === 'ENGL111')).toMatchObject({
      status: 'none',
      review_reason: 'exact_radford_randolph_macon_zero_course_edge_tail_evidence',
      structural_none_evidence: { contract: RADFORD_RMC_TAIL_CONTRACT },
    });
    expect(rows.find((row) => row.code === 'CS322')).toMatchObject({
      status: 'unparsed',
      review_reason:
        'exact_source_formula_preserved_but_recursive_or_noncourse_runtime_blocked',
      groups: [],
      prerequisite_constraint_blocker_evidence: {
        contract: REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT,
        partial_course_edges_emitted: false,
      },
    });
    expect(rows.find((row) => row.code === 'MATH171')).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      strict_formula_rejection_audit: {
        decision: 'promoted_lossless_formula', source_receipt_valid: true,
      },
      groups: [expect.objectContaining({ paths: expect.arrayContaining([
        expect.objectContaining({ all_of: [expect.objectContaining({
          code: 'MATH138', minimum_grade: 'C',
        })] }),
        expect.objectContaining({ all_of: [expect.objectContaining({
          condition: 'approved_college_level_precalculus_course_including_trigonometry',
          minimum_grade: 'C',
        })] }),
        expect.objectContaining({ all_of: [expect.objectContaining({
          condition: 'passing_score_on_department_approved_mathematics_placement_exam',
        })] }),
      ]) })],
    });
    expect(rows.find((row) => row.code === 'MATH169').ignored_nonrequired_requisites)
      .toEqual([expect.objectContaining({
        kind: 'explicit_encouraged_contact_suffix_not_modeled',
        raw: expect.stringContaining('are encouraged to contact'),
      })]);

    const tampered = structuredClone(artifact);
    const source = tampered.review_rows.find((row) => (
      row.slug === 'radford-university' && row.code === 'MATH168'
    ));
    for (const collection of [
      tampered.review_rows, tampered.direct_review_rows, tampered.promoted_rows,
    ]) {
      const row = collection.find((candidate) => candidate.course_key === source.course_key);
      row.review_evidence.required_requisite_clause.raw_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${source.course_key}:radford_clause_receipt`);
  });

  it('replays every UVA Wise boundary and distinguishes controlled silence from admin constraints', () => {
    const slug = 'the-university-of-virginia-s-college-at-wise';
    const institution = artifact.institution_review.find((row) => row.slug === slug);
    expect(institution).toMatchObject({
      direct_required_rows: 31,
      exact_bounded_entry_rows: 31,
      parsed_exact_formulas: 20,
      explicit_none_rows: 10,
      unparsed_review_rows: 1,
      missing_source_entry_rows: 0,
      no_explicit_required_statement_rows: 0,
      strict_parser_rejected_rows: 0,
      missing_codes: [],
    });
    const rows = artifact.direct_review_rows.filter((row) => row.slug === slug);
    expect(rows.filter((row) => row.status === 'parsed').map((row) => row.code).sort())
      .toEqual([
        'CSC1180', 'CSC2180', 'CSC2300', 'CSC3180', 'CSC3400', 'CSC3710', 'CSC4000',
        'CSC4200', 'CSC4300', 'CSC4350', 'CSC4990', 'ENG1020', 'FRE1020',
        'GER1020', 'MTH2040', 'MTH2050', 'MTH2180', 'SPA1020', 'STA2180', 'SWE2300',
      ]);
    expect(rows.every((row) => (
      row.review_evidence.capture_origin === 'official_uva_wise_acalog_course_page'
      && row.review_evidence.source_format === 'uva_wise_acalog_course_page'
      && row.review_evidence.catalog_year_verified === '2026-2027'
      && row.review_evidence.catoid === 9
      && row.review_evidence.robots_crawl_delay_seconds === 120
      && row.review_evidence.http_exception_contract
        === 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1'
      && new URL(row.source_url).protocol === 'http:'
    ))).toBe(true);

    const structuralNone = [
      'ENG1030', 'FRE1010', 'FRE1030', 'GER1010', 'GER1030', 'SEM1010',
      'SPA1010', 'SPA1030', 'SWE1790',
    ];
    expect(structuralNone.every((code) => rows.some((row) => (
      row.code === code
      && row.status === 'none'
      && row.review_reason
        === 'complete_uva_wise_acalog_entry_silence_with_same_catalog_required_marker_control'
      && row.review_evidence.required_requisite_clause === null
      && row.structural_none_evidence.literal_none_statement === false
    )))).toBe(true);
    expect(rows.find((row) => row.code === 'CSC1010')).toMatchObject({
      status: 'none',
      review_reason: 'exact_six_university_source_bound_prerequisite_resolution',
      structural_none_evidence: {
        contract: SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
      },
    });
    expect(rows.find((row) => row.code === 'ENG1010')).toMatchObject({
      status: 'unparsed',
      review_reason: 'six_university_exact_source_prerequisite_ambiguity_preserved',
      prerequisite_constraint_blocker_evidence: {
        contract: SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
      },
    });
    expect(rows.find((row) => row.code === 'CSC2180')).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      strict_formula_rejection_audit: {
        decision: 'promoted_lossless_formula', source_receipt_valid: true,
      },
      groups: [expect.objectContaining({ paths: [expect.objectContaining({ all_of: [
        expect.objectContaining({ code: 'CSC1180' }),
        expect.objectContaining({ code: 'MTH1110', minimum_grade: 'C' }),
      ] })] })],
    });
    expect(rows.find((row) => row.code === 'CSC4990')).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [expect.objectContaining({ all_of: [
        expect.objectContaining({
          type: 'non_course', authorization_kind: 'permission',
          authorization_authority: 'instructor',
        }),
      ] })] })],
    });
    expect(rows.find((row) => row.code === 'ENG1020').groups[0].paths[0].all_of)
      .toEqual([expect.objectContaining({ code: 'ENG1010' })]);

    const tampered = structuredClone(artifact);
    const source = tampered.review_rows.find((row) => (
      row.slug === slug && row.code === 'ENG1020'
    ));
    for (const collection of [
      tampered.review_rows, tampered.direct_review_rows, tampered.promoted_rows,
    ]) {
      collection.find((row) => row.course_key === source.course_key)
        .review_evidence.required_requisite_clause.raw_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${source.course_key}:uva_wise_clause_receipt`);

    const structuralTampered = structuredClone(artifact);
    const structuralSource = structuralTampered.review_rows.find((row) => (
      row.slug === slug && row.code === 'FRE1010'
    ));
    for (const collection of [
      structuralTampered.review_rows,
      structuralTampered.direct_review_rows,
      structuralTampered.promoted_rows,
    ]) {
      collection.find((row) => row.course_key === structuralSource.course_key)
        .structural_none_evidence.marker_control.population_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(
      structuralTampered, { scope, candidates },
    ).issues).toContain(`${structuralSource.course_key}:uva_wise_structural_none`);
  });

  it('replays exact Shenandoah formulas, controlled silence, and explicit admin blockers', () => {
    const slug = 'shenandoah-university';
    const institution = artifact.institution_review.find((row) => row.slug === slug);
    expect(institution).toMatchObject({
      direct_required_rows: 16,
      exact_bounded_entry_rows: 16,
      parsed_exact_formulas: 14,
      explicit_none_rows: 2,
      unparsed_review_rows: 0,
      missing_source_entry_rows: 0,
      no_explicit_required_statement_rows: 0,
      strict_parser_rejected_rows: 0,
      unparsed_codes: [],
      missing_codes: [],
    });
    const rows = artifact.direct_review_rows.filter((row) => row.slug === slug);
    expect(rows.filter((row) => row.status === 'parsed').map((row) => row.code).sort())
      .toEqual([
        'CSC122', 'CSC210', 'CSC301', 'CSC310', 'CSC403', 'CSC407', 'CSC410',
        'CSC430', 'CSC480', 'FYS101', 'MATH201', 'MATH202', 'MATH209', 'MATH370',
      ]);
    expect(rows.filter((row) => row.review_evidence).every((row) => (
      row.review_evidence.capture_origin === 'official_shenandoah_acalog_course_page'
      && row.review_evidence.source_format === 'shenandoah_acalog_course_page'
      && row.review_evidence.catalog_year_verified === '2025-2026'
      && row.review_evidence.catoid === 33
      && row.review_evidence.robots_crawl_delay_seconds === 120
    ))).toBe(true);
    expect(rows.find((row) => row.code === 'MATH209').groups[0].paths)
      .toEqual([
        expect.objectContaining({ all_of: [expect.objectContaining({ code: 'MATH102' })] }),
        expect.objectContaining({ all_of: [expect.objectContaining({ code: 'MATH201' })] }),
      ]);
    expect(rows.find((row) => row.code === 'CSC122').groups[0].paths[0].all_of[0])
      .toMatchObject({ code: 'CSC121', minimum_grade: 'C-' });
    expect(rows.find((row) => row.code === 'CSC121')).toMatchObject({
      status: 'none',
      review_reason: 'exact_six_university_source_bound_prerequisite_resolution',
      review_evidence: {
        required_requisite_clause: null,
        raw_entry_text: expect.stringContaining('programming experience is required'),
      },
      structural_none_evidence: {
        contract: SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
      },
    });
    expect(artifact.closure.unresolved_unparsed_direct)
      .not.toContain('va:uni:9224:CSC121');
    expect(artifact.closure_review_rows.filter((row) => (
      row.owner_namespace === 'va:uni:9224'
      && ['INT101', 'MATH101', 'MATH102'].includes(row.code)
    )).map((row) => [row.code, row.status])).toEqual([
      ['INT101', 'none'], ['MATH101', 'none'], ['MATH102', 'parsed'],
    ]);
    expect([
      ...artifact.closure.unresolved_unparsed_direct,
      ...artifact.closure.unresolved_unparsed_closure,
      ...artifact.closure.unresolved_missing_direct,
      ...artifact.closure.unresolved_outside_direct_scope,
    ]).not.toContain('va:uni:9224:MATH101');

    const tampered = structuredClone(artifact);
    const source = tampered.review_rows.find((row) => (
      row.slug === slug && row.code === 'CSC210'
    ));
    for (const collection of [
      tampered.review_rows, tampered.direct_review_rows, tampered.promoted_rows,
    ]) {
      collection.find((row) => row.course_key === source.course_key)
        .review_evidence.discovery_response_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${source.course_key}:shenandoah_boundary_receipt`);
  });

  it('parses only exact structured Virginia Tech browser fields beside pinned CS formulas', () => {
    const institution = artifact.institution_review.find((row) => (
      row.slug === 'virginia-polytechnic-institute-and-state-university'
    ));
    expect(institution).toMatchObject({
      direct_required_rows: 121,
      exact_bounded_entry_rows: 120,
      parsed_exact_formulas: 103,
      explicit_none_rows: 10,
      unparsed_review_rows: 7,
      missing_source_entry_rows: 1,
    });
    const exactResolvedCodes = [
      'BIOL1115', 'BIOL1116', 'CS3604', 'MATH1225', 'MATH2534',
    ];
    const parsed = artifact.direct_review_rows.filter((row) => (
      row.slug === institution.slug && row.status === 'parsed'
    ));
    const exactResolved = parsed.filter((row) => (
      row.review_reason === 'virginia_tech_exact_courseleaf_semantics_resolved'
    ));
    expect(exactResolved.map((row) => row.code).sort()).toEqual(exactResolvedCodes);
    expect(exactResolved.every((row) => (
      row.virginia_tech_exact_resolution?.candidate_sha256?.match(/^[0-9a-f]{64}$/)
      && row.virginia_tech_exact_resolution?.source_sha256?.match(/^[0-9a-f]{64}$/)
      && row.virginia_tech_exact_resolution?.source_or_core_content_changed === false
      && row.groups.every((group) => group.flags.includes(
        'virginia_tech_exact_candidate_and_source_fingerprint_v1',
      ))
    ))).toBe(true);

    const retainedParsed = parsed.filter((row) => (
      row.review_evidence.retained_source_contract
      && !exactResolvedCodes.includes(row.code)
      && !row.virginia_tech_remaining_prerequisite_resolution
    ));
    expect(retainedParsed.map((row) => row.code).sort()).toEqual([
      'CS1944', 'CS2064', 'CS2104', 'CS2114', 'CS2144', 'CS2505', 'CS2506',
      'CS3114', 'CS3214', 'CS3304', 'CS4094', 'CS4104', 'CS4114', 'CS4124',
      'CS4134', 'CS4144', 'CS4274', 'CS4284', 'CS4624', 'CS4634', 'CS4644',
      'CS4704', 'CS4884', 'CS4944',
    ]);
    expect(retainedParsed.every((row) => (
      row.review_evidence.retained_source_contract
        === 'retained_official_2026_2027_department_whole_response_and_exact_courseblock_v1'
      && row.review_evidence.source_response_sha256
        === '89225dfa30ddcfdedca1fd6ec6f26b7ea220979589a97d874b69cf98dc95fbc4'
      && row.review_evidence.live_recapture_claim === false
      && row.groups.every((group) => group.flags.includes(
        'virginia_tech_pinned_retained_courseblock_clean_formula_grammar',
      ))
    ))).toBe(true);
    const browserParsed = parsed.filter((row) => (
      row.review_evidence.browser_challenge_contract
      && !exactResolvedCodes.includes(row.code)
      && !row.virginia_tech_remaining_prerequisite_resolution
    ));
    expect(browserParsed).toHaveLength(68);
    expect(browserParsed.every((row) => (
      row.review_evidence.structured_requisite_fields.length > 0
      && row.groups.every((group) => group.flags.includes(
        'virginia_tech_exact_structured_browser_courseleaf_formula_grammar',
      ))
    ))).toBe(true);
    const remainingResolved = parsed.filter((row) => (
      row.virginia_tech_remaining_prerequisite_resolution
    ));
    expect(remainingResolved.map((row) => row.code).sort()).toEqual([
      'COMM2004', 'COMM2014', 'CS1114', 'CS4784', 'ENGE3900',
    ]);
    expect(remainingResolved.every((row) => (
      row.review_reason === 'virginia_tech_exact_remaining_prerequisite_resolved'
      && row.virginia_tech_remaining_prerequisite_resolution.proof
        .source_or_core_content_changed === false
    ))).toBe(true);
    expect(remainingResolved.find((row) => row.code === 'CS1114').groups)
      .toEqual([expect.objectContaining({
        kind: 'corequisite',
        paths: [expect.objectContaining({
          all_of: [expect.objectContaining({
            code: 'MATH1225',
            concurrent_allowed: true,
          })],
        })],
      })]);
    expect(artifact.direct_review_rows.find((row) => (
      row.slug === institution.slug && row.code === 'CS4664'
    ))).toMatchObject({
      status: 'unparsed',
      review_reason: 'virginia_tech_courseleaf_boolean_grouping_not_explicit',
      groups: [],
      virginia_tech_remaining_prerequisite_resolution: {
        applicable: true,
        ready: false,
        issues: ['ambiguous_boolean_grouping'],
      },
    });
    for (const code of ['ENGE4735', 'ENGE4736']) {
      const row = artifact.direct_review_rows.find((candidate) => (
        candidate.slug === institution.slug && candidate.code === code
      ));
      expect(row).toMatchObject({
        status: 'unparsed',
        review_status: 'not_promoted',
        review_reason:
          'virginia_tech_courseleaf_conditional_applicability_not_losslessly_representable',
        groups: [],
        virginia_tech_remaining_prerequisite_resolution: {
          applicable: true,
          ready: false,
          issues: ['conditional_applicability_not_losslessly_representable'],
          proof: {
            prerequisite_route_to_major_mapping_published: false,
            default_branch_published: false,
            universal_corequisite_inferred: false,
            formula_emitted: false,
          },
        },
      });
      expect(artifact.promoted_rows.some((candidate) => candidate.course_key === row.course_key))
        .toBe(false);
    }
    for (const [code, dependency] of [
      ['BIOL1115', 'BIOL1105'],
      ['BIOL1116', 'BIOL1106'],
    ]) {
      const row = exactResolved.find((candidate) => candidate.code === code);
      expect(row).toMatchObject({ status: 'parsed' });
      expect(row.groups[0]).toMatchObject({ kind: 'corequisite' });
      expect(row.groups[0].paths[0].all_of).toEqual([expect.objectContaining({
        code: dependency,
        concurrent_allowed: true,
      })]);
      expect(row.virginia_tech_exact_resolution.proof).toMatchObject({
        corequisite_edge_preserved: true,
        status_none_authorized: false,
      });
    }
    const graded = retainedParsed.find((row) => row.code === 'CS2506');
    expect(graded.groups.every((group) => group.flags.includes(
      'virginia_tech_exact_full_entry_grade_statement',
    ))).toBe(true);
    expect(graded.groups.flatMap((group) => group.paths)
      .flatMap((path) => path.all_of)
      .filter((condition) => ['CS2114', 'CS2505'].includes(condition.code))
      .every((condition) => (
        condition.minimum_grade === 'C'
        && condition.minimum_grade_evidence?.kind === 'exact_full_entry_grade_statement'
      ))).toBe(true);
    expect(artifact.closure_review_rows.find((row) => (
      row.slug === institution.slug && row.code === 'CS4264'
    ))).toMatchObject({ status: 'parsed' });
    const cs4784Closure = artifact.closure_review_rows.filter((row) => (
      row.slug === institution.slug
      && row.virginia_tech_cs4784_recursive_closure_resolution
    ));
    expect(cs4784Closure.map((row) => row.code).sort()).toEqual(['CS3724', 'CS3744']);
    expect(cs4784Closure.every((row) => (
      row.status === 'parsed'
      && row.review_reason === 'virginia_tech_cs4784_recursive_closure_exact_bytes_resolved'
      && row.virginia_tech_cs4784_recursive_closure_resolution.proof
        .source_or_core_content_changed === false
    ))).toBe(true);
    const closureGraded = artifact.closure_review_rows.find((row) => (
      row.slug === institution.slug && row.code === 'CS3824'
    ));
    expect(closureGraded.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({
        code: 'CS3114',
        minimum_grade: 'C',
        minimum_grade_evidence: {
          kind: 'exact_full_entry_grade_statement',
          raw: 'Pre-requisite: Grade of C or better in CS 3114.',
          raw_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      }),
    ]);
    for (const code of ['CS3714', 'CS3754']) {
      const row = artifact.closure_review_rows.find((candidate) => (
        candidate.slug === institution.slug && candidate.code === code
      ));
      expect(row.groups[0].paths.map((path) => path.all_of[0])).toEqual([
        expect.objectContaining({ code: 'CS2114', minimum_grade: 'C' }),
        expect.objectContaining({ code: 'ECE3514', minimum_grade: 'C' }),
      ]);
      expect(row.groups[0].paths.every((path) => (
        path.all_of[0].minimum_grade_evidence?.kind === 'exact_full_entry_grade_statement'
      ))).toBe(true);
    }
    const circuits = artifact.closure_review_rows.find((row) => (
      row.slug === institution.slug && row.code === 'ECE2024'
    ));
    expect(circuits.groups.find((group) => group.kind === 'corequisite').paths[0].all_of)
      .toEqual([
        expect.objectContaining({ code: 'MATH2214', concurrent_allowed: true }),
        expect.objectContaining({ code: 'PHYS2306', concurrent_allowed: true }),
      ]);

    for (const code of ['CEE3014', 'CEE3804']) {
      const standing = artifact.closure_review_rows.find((row) => (
        row.slug === institution.slug && row.code === code
      ));
      expect(standing).toMatchObject({ status: 'parsed' });
      expect(standing.groups[0].paths[0].all_of).toEqual([expect.objectContaining({
        type: 'non_course',
        condition: 'junior_standing_or_higher',
        minimum_class_standing: 'junior',
        outside_entry_requirement_evidence: {
          kind: 'exact_full_entry_requirement_statement',
          raw: expect.stringMatching(/^Pre: Junior [Ss]tanding/),
          raw_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      })]);
    }
    const integratedScience = artifact.closure_review_rows.find((row) => (
      row.slug === institution.slug && row.code === 'ISC2105'
    ));
    expect(integratedScience.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'ISC1106H' }),
      expect.objectContaining({
        type: 'non_course', condition: 'major_in_college_of_science',
        college: 'College of Science',
      }),
      expect.objectContaining({
        type: 'non_course', condition: 'permission_of_instructor',
        authorization_kind: 'permission', authorization_authority: 'instructor',
      }),
    ]);

    const calculusTwo = artifact.direct_review_rows.find((row) => (
      row.slug === institution.slug && row.code === 'MATH1226'
    ));
    expect(calculusTwo.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({
        code: 'MATH1225', minimum_grade: 'C-',
        minimum_grade_evidence: {
          kind: 'exact_full_entry_grade_statement',
          raw: 'Pre: Grade of at least C- in 1225 for 1226.',
          raw_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      }),
    ]);
    expect(calculusTwo.ignored_nonrequired_requisites).toEqual([
      expect.objectContaining({
        kind: 'exact_sibling_course_prerequisite_context_not_applicable_to_current_course',
        applies_to_course_code: 'MATH1225',
        current_course_code: 'MATH1226',
      }),
    ]);

    const currentGraduateCs = artifact.direct_review_rows.filter((row) => (
      row.slug === institution.slug
      && row.review_evidence?.source_format
        === 'virginia_tech_current_graduate_cs_heading_entry'
    ));
    expect(currentGraduateCs.map((row) => row.code)).toEqual(['CS5104', 'CS5114']);
    expect(currentGraduateCs.find((row) => row.code === 'CS5104')).toMatchObject({
      status: 'none',
      review_status: 'promoted_structural_none',
      review_reason:
        'complete_current_virginia_tech_graduate_cs_entry_silence_with_same_page_pre_controls',
      structural_none_evidence: {
        literal_none_statement: false,
        marker_control: {
          missing_search_result_used: false,
          source_entries_with_pre_marker_count: 43,
          source_pre_marker_count: 46,
          positive_control_statement: 'Pre: CS3114',
        },
      },
    });
    expect(currentGraduateCs.find((row) => row.code === 'CS5114')).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      raw_requisites: 'Pre: CS3114',
      groups: [expect.objectContaining({
        paths: [expect.objectContaining({
          all_of: [expect.objectContaining({ code: 'CS3114' })],
        })],
      })],
    });

    const currentGraduateCsTampered = structuredClone(artifact);
    for (const collection of [
      currentGraduateCsTampered.review_rows,
      currentGraduateCsTampered.direct_review_rows,
      currentGraduateCsTampered.promoted_rows,
    ]) {
      collection.find((row) => row.course_key === 'va:uni:9230:CS5104')
        .review_evidence.facts_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(
      currentGraduateCsTampered, { scope, candidates },
    ).issues).toContain('va:uni:9230:CS5104:virginia_tech_graduate_cs_review_receipt');

    const browserRows = artifact.direct_review_rows.filter((row) => (
      row.slug === institution.slug && row.review_evidence?.browser_challenge_contract
    ));
    expect(browserRows).toHaveLength(90);
    expect(browserRows.filter((row) => row.status === 'parsed')).toHaveLength(75);
    expect(browserRows.filter((row) => row.status === 'none')).toHaveLength(9);
    expect(browserRows.filter((row) => row.status === 'unparsed')).toHaveLength(6);
    expect(browserRows.every((row) => (
      row.review_evidence.browser_challenge_receipt.document_responses[0].http_status === 202
      && row.review_evidence.browser_challenge_receipt.document_responses[1].http_status === 200
      && row.review_evidence.robots_receipt.path_allowed === true
      && row.review_evidence.sitemap_discovery_receipt.path_discovered === true
    ))).toBe(true);

    const browserTampered = structuredClone(artifact);
    for (const collection of [browserTampered.review_rows, browserTampered.direct_review_rows]) {
      collection.find((row) => row.course_key === 'va:uni:9230:AOE4434')
        .review_evidence.robots_receipt.path_allowed = false;
    }
    expect(validateUniversityPrerequisiteReview(browserTampered, { scope, candidates }).issues)
      .toContain('va:uni:9230:AOE4434:browser_challenge_receipt');

    const tampered = structuredClone(artifact);
    const source = tampered.review_rows.find((row) => (
      row.slug === institution.slug && row.code === 'CS1944'
    ));
    for (const collection of [
      tampered.review_rows, tampered.direct_review_rows, tampered.promoted_rows,
    ]) {
      collection.find((row) => row.course_key === source.course_key)
        .review_evidence.retained_source_text_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${source.course_key}:virginia_tech_retained_source_receipt`);

    const gradeTampered = structuredClone(artifact);
    for (const collection of [
      gradeTampered.review_rows, gradeTampered.direct_review_rows, gradeTampered.promoted_rows,
    ]) {
      const row = collection.find((candidate) => (
        candidate.slug === institution.slug && candidate.code === 'CS2506'
      ));
      row.groups[0].paths[0].all_of.find((condition) => condition.code === 'CS2114')
        .minimum_grade_evidence.raw_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(gradeTampered, { scope, candidates }).issues)
      .toContain('va:uni:9230:CS2506:review_replay');
  });

  it('replays all exact Bridgewater pages, bounded formulas, and controlled silence', () => {
    const institution = artifact.institution_review.find((row) => (
      row.slug === 'bridgewater-college'
    ));
    expect(institution).toMatchObject({
      direct_required_rows: 29,
      exact_bounded_entry_rows: 29,
      parsed_exact_formulas: 20,
      explicit_none_rows: 9,
      unparsed_review_rows: 0,
      missing_source_entry_rows: 0,
    });
    const promoted = artifact.promoted_rows.filter((row) => (
      row.slug === 'bridgewater-college'
    ));
    expect(promoted).toHaveLength(30);
    expect(promoted.every((row) => (
      row.review_evidence.source_format === 'cleancatalog_course_page'
      && row.review_evidence.edition_response_sha256
        === '705fb1cad1dab47b0e3b55537d7b84ec57e438263bff73425c08712cdf770825'
      && row.review_evidence.edition_catalog_year === row.catalog_year
    ))).toBe(true);
    expect(artifact.direct_review_rows.filter((row) => (
      row.slug === 'bridgewater-college' && ['CL100', 'CL150'].includes(row.code)
    )).every((row) => (
      row.status === 'none'
      && row.review_reason
        === 'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect'
      && row.retained_non_prerequisite_signals.length > 0
      && row.structural_none_evidence.contract
        === FIGURE6_NONCOURSE_DISPOSITION_CONTRACT
    ))).toBe(true);
    expect(artifact.direct_review_rows.find((row) => (
      row.slug === 'bridgewater-college' && row.code === 'DSA350'
    ))).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [
        expect.objectContaining({ all_of: [expect.objectContaining({
          code: 'CSCI130', minimum_grade: 'C',
        })] }),
        expect.objectContaining({ all_of: [expect.objectContaining({
          condition: 'csci130_assessment_exam_catalog_requirement',
          threshold_published: false,
        })] }),
      ] })],
    });

    const tampered = structuredClone(artifact);
    for (const collection of [
      tampered.review_rows, tampered.direct_review_rows, tampered.promoted_rows,
    ]) {
      const row = collection.find((candidate) => (
        candidate.slug === 'bridgewater-college' && candidate.code === 'COMM100'
      ));
      row.structural_none_evidence.marker_control.population_sha256 = '0'.repeat(64);
    }
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain('va:uni:9205:COMM100:bridgewater_structural_none');
  });

  it('binds every promoted CNU formula to the pinned PDF geometry and keeps residuals explicit', () => {
    const institution = artifact.institution_review.find((row) => (
      row.slug === 'christopher-newport-university'
    ));
    expect(institution).toMatchObject({
      direct_required_rows: 46,
      exact_bounded_entry_rows: 46,
      parsed_exact_formulas: 45,
      explicit_none_rows: 1,
      unparsed_review_rows: 0,
      missing_source_entry_rows: 0,
      unparsed_codes: [],
      missing_codes: [],
    });
    const direct = artifact.direct_review_rows.filter((row) => (
      row.slug === 'christopher-newport-university'
    ));
    const closure = artifact.closure_review_rows.filter((row) => (
      row.slug === 'christopher-newport-university'
    ));
    expect(direct.filter((row) => row.status === 'parsed')).toHaveLength(45);
    expect(closure.filter((row) => row.status === 'parsed')).toHaveLength(11);
    expect(closure.filter((row) => row.status === 'unparsed').map((row) => row.code).sort())
      .toEqual([]);
    expect(closure.filter((row) => row.status === 'none').map((row) => row.code))
      .toEqual(['MATH128']);
    expect(direct.filter((row) => row.status === 'none').map((row) => row.code))
      .toEqual(['ENGL123']);
    const promoted = artifact.promoted_rows.filter((row) => (
      row.slug === 'christopher-newport-university'
    ));
    expect(promoted).toHaveLength(58);
    const pdfPromoted = promoted.filter((row) => (
      row.review_evidence.source_format === 'pdf_bbox_columns'
    ));
    expect(pdfPromoted).toHaveLength(57);
    expect(pdfPromoted.every((row) => (
      row.review_evidence.source_format === 'pdf_bbox_columns'
      && row.review_evidence.pdf_sha256
        === '30e4ab16d575d4ab5a966012f37cf6a6b536ffb775d267fccba4f82fcd23d327'
      && row.review_evidence.bbox_layout_sha256
        === '1156fb942db6673f24ea89c2958e3bc8d5e669593d710e4329651f45a6dfc342'
      && row.review_evidence.source_blocks.length > 0
    ))).toBe(true);
    expect(promoted.find((row) => row.code === 'CPEN371W')).toMatchObject({
      status: 'parsed',
      review_evidence: {
        source_format: 'cnu_current_joint_identity_pdf_entry',
        identity_resolution: {
          scope: 'CPEN371W_only',
          broad_suffix_alias_rule_created: false,
        },
      },
    });

    const compounds = direct.filter((row) => (
      ['PHYS151', 'PHYS151L', 'PHYS152', 'PHYS152L'].includes(row.code)
    ));
    expect(compounds.every((row) => (
      row.status === 'parsed'
      && row.review_evidence.compound_entry === true
      && row.review_evidence.raw_entry_text
        .includes(row.review_evidence.compound_member_requisite.statement_raw)
      && row.review_evidence.compound_sibling_requisites.length === 1
      && row.review_evidence.raw_entry_text
        .includes(row.review_evidence.compound_sibling_requisites[0].statement_raw)
    ))).toBe(true);
    const phys151 = compounds.find((row) => row.code === 'PHYS151');
    expect(phys151.groups[0].paths.map((path) => path.all_of)).toEqual([
      [expect.objectContaining({
        type: 'non_course',
        condition: 'high_school_algebra_and_trigonometry',
      })],
      [expect.objectContaining({
        type: 'non_course',
        condition: 'consent_of_instructor',
      })],
    ]);
    for (const [code, prerequisite, concurrentAllowed] of [
      ['PHYS152', 'PHYS151', false],
      ['PHYS151L', 'PHYS151', true],
      ['PHYS152L', 'PHYS152', true],
    ]) {
      const row = compounds.find((candidate) => candidate.code === code);
      expect(row.groups[0].paths[0].all_of).toEqual([
        expect.objectContaining({ code: prerequisite }),
      ]);
      expect(row.groups[0].paths[0].all_of[0].concurrent_allowed)
        .toBe(concurrentAllowed ? true : undefined);
    }

    const tampered = structuredClone(artifact);
    const reviewed = tampered.review_rows.find((row) => row.code === 'PHYS151');
    reviewed.review_evidence.compound_member_requisite.raw_normalized = 'PHYS 999';
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${reviewed.course_key}:review_replay`);
  });

  it('promotes twenty-one exact Longwood formulas while preserving source silence', () => {
    const institution = artifact.institution_review.find((row) => (
      row.slug === 'longwood-university'
    ));
    expect(institution).toMatchObject({
      direct_required_rows: 29,
      exact_bounded_entry_rows: 29,
      parsed_exact_formulas: 21,
      explicit_none_rows: 0,
      unparsed_review_rows: 8,
      missing_source_entry_rows: 0,
      unparsed_codes: [
        'CMSC140', 'CMSC160', 'CMSC161', 'CMSC483',
        'CTZN110', 'ENGL165', 'MATH171', 'MATH175',
      ],
      missing_codes: [],
    });
    const promoted = artifact.promoted_rows.filter((row) => (
      row.slug === 'longwood-university'
    ));
    expect(promoted.map((row) => row.code)).toEqual([
      'CMSC162', 'CMSC201', 'CMSC208', 'CMSC210', 'CMSC242',
      'CMSC262', 'CMSC280', 'CMSC283', 'CMSC360', 'CMSC415',
      'CMSC442', 'CMSC455', 'CMSC461',
      'CTZN410', 'ENGL319', 'MATH250', 'MATH261',
      'MATH301', 'PSYC335', 'RELI301', 'SPAN320',
    ]);
    const math301 = promoted.find((row) => row.code === 'MATH301');
    expect(math301.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'MATH171', minimum_grade: 'C-' }),
      expect.objectContaining({
        type: 'non_course', condition: 'completion_of_fhbs_pillar',
        civitae_pillar: 'FHBS', completion_required: true,
      }),
    ]);
    for (const [code, pillar] of [['PSYC335', 'FHBS'], ['RELI301', 'FGLO']]) {
      expect(promoted.find((row) => row.code === code).groups[0].paths[0].all_of)
        .toEqual([expect.objectContaining({
          type: 'non_course',
          condition: `completion_of_${pillar.toLowerCase()}_pillar`,
          civitae_pillar: pillar,
          completion_required: true,
        })]);
    }
    const span320 = artifact.direct_review_rows.find((row) => (
      row.slug === 'longwood-university' && row.code === 'SPAN320'
    ));
    expect(span320).toMatchObject({
      status: 'parsed',
      review_evidence: { clauses: [expect.objectContaining({
        raw: 'SPAN 212 or an appropriate placement score',
      })] },
      groups: [expect.objectContaining({ paths: [
        expect.objectContaining({ all_of: [expect.objectContaining({ code: 'SPAN212' })] }),
        expect.objectContaining({ all_of: [expect.objectContaining({
          type: 'non_course', condition: 'appropriate_spanish_placement_score',
          threshold_published: false,
        })] }),
      ] })],
    });
    const designation = promoted.find((row) => row.code === 'RELI301')
      .review_evidence.clauses[0].catalog_designation_suffix;
    expect(designation).toMatchObject({
      kind: 'exact_catalog_designation_suffix_outside_requisite_clause',
      raw: 'WI. PGLO.',
      raw_sha256: '0c04c173d9a60c25e0b7823637d20de137204c5e803d329267cb5bfb97b21617',
    });
    expect(promoted.every((row) => (
      ['longwood_department_course_listing', 'longwood_banner_course_listing']
        .includes(row.review_evidence.source_format)
      && row.review_evidence.catalog_context_catoid === 19
      && row.review_evidence.department_page_catalog_year_statement === null
    ))).toBe(true);
    const silent = artifact.direct_review_rows.filter((row) => (
      row.slug === 'longwood-university' && ['CMSC140', 'CMSC483'].includes(row.code)
    ));
    expect(silent.every((row) => (
      row.status === 'unparsed'
      && (row.review_reason.endsWith('prerequisite_absence_not_catalog_edition_bound')
        || row.review_reason === 'unversioned_course_entry_silence_not_catalog_edition_proof')
    ))).toBe(true);
    const recommendations = promoted.flatMap((row) => (
      row.ignored_nonrequired_requisites || []
    ));
    expect(recommendations.map((row) => row.raw).sort()).toEqual([
      'CMSC 162 recommended', 'CMSC 162 recommended', 'MATH 175 recommended',
    ]);
    expect(recommendations.every((row) => (
      row.raw_sha256?.match(/^[a-f0-9]{64}$/)
      && Number.isInteger(row.source_character_start)
      && Number.isInteger(row.source_character_end)
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.promoted_rows.find((candidate) => (
      candidate.review_evidence.source_format === 'longwood_banner_course_listing'
    ));
    const reviewed = tampered.review_rows.find((candidate) => (
      candidate.course_key === row.course_key
    ));
    row.review_evidence.department_page_catalog_year_statement = '2026-2027';
    reviewed.review_evidence.department_page_catalog_year_statement = '2026-2027';
    expect(validateUniversityPrerequisiteReview(tampered, { scope, candidates }).issues)
      .toContain(`${row.course_key}:longwood_banner_catalog_context`);
  });
});
