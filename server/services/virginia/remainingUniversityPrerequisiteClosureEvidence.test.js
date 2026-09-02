import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildExactVirginiaParentMap,
  compileValidatedVirginiaFormulaCorpora,
} from '../analysis/pathwayComplexity';
import {
  EVIDENCE_PATH,
  EXISTING_CONTRACT_ACCOUNTING,
  TARGET_KEYS,
  buildEvidence,
  defaultReadFile,
  evidenceIssues,
} from './remainingUniversityPrerequisiteClosureEvidence';

const artifact = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));

const row = (courseKey) => artifact.facts.target_rows.find((item) => (
  item.course_key === courseKey
));

const dependencyRow = (ownerNamespace, code, sourceUrl) => ({
  course_key: `${ownerNamespace}:${code}`,
  owner_namespace: ownerNamespace,
  status: 'none',
  source: 'institution_catalog',
  source_url: sourceUrl,
  source_bundle_hash: 'a'.repeat(64),
  raw_requisites: null,
  groups: [],
});

const formulaCompilerRow = (evidenceRow) => ({
  course_key: evidenceRow.course_key,
  owner_namespace: evidenceRow.owner_namespace,
  status: 'parsed',
  source: 'institution_catalog',
  source_url: evidenceRow.source.official_url,
  source_bundle_hash: 'a'.repeat(64),
  raw_requisites: evidenceRow.raw_requisites,
  groups: evidenceRow.groups,
});

const vccs = {
  course_key: 'va:CSC100',
  owner_namespace: 'va:vccs',
  status: 'none',
  source: 'vccs_master_course_file',
  source_url: 'https://courses.vccs.edu/courses/CSC100',
  raw_requisites: null,
  groups: [],
};

function compileFormula(courseKey, dependencyCodes) {
  const target = row(courseKey);
  const universityRows = [
    formulaCompilerRow(target),
    ...dependencyCodes.map((code) => dependencyRow(
      target.owner_namespace, code, target.source.official_url,
    )),
  ];
  return compileValidatedVirginiaFormulaCorpora({
    communityCollegeRows: [vccs],
    universityRows,
    requiredCommunityCollegeKeys: [vccs.course_key],
    requiredUniversityKeys: [target.course_key],
  });
}

describe('remaining university prerequisite closure evidence', () => {
  it('replays the de-duplicated ten-row artifact at its pinned fixed point', () => {
    expect(buildEvidence()).toEqual(artifact);
    expect(evidenceIssues(artifact)).toEqual([]);
    expect(artifact.facts.target_rows.map((item) => item.course_key).sort())
      .toEqual(TARGET_KEYS);
    expect(artifact.summary).toEqual({
      residual_target_rows: 10,
      exact_complete_entry_rows: 10,
      safe_zero_course_edge_rows: 7,
      exact_formula_rows: 3,
      runtime_ready_formula_rows: 0,
      direct_rows: 6,
      recursive_closure_rows: 3,
      induced_recursive_closure_rows: 1,
      outside_scope_rows: 0,
      new_blocked_reference_rows: 2,
      externally_owned_accounting_rows: 9,
      adversarial_conflict_rows: 2,
    });
  });

  it('closes only the seven exact VCU population/enrollment rows as zero course edge', () => {
    const rows = artifact.facts.target_rows.filter((item) => (
      item.disposition === 'safe_zero_course_edge'
    ));
    expect(rows).toHaveLength(7);
    expect(rows.map((item) => item.course_key).sort()).toEqual([
      'va:uni:9229:CLSE101',
      'va:uni:9229:EGRE101',
      'va:uni:9229:ENGR395',
      'va:uni:9229:HONR230',
      'va:uni:9229:HONR240',
      'va:uni:9229:UNIV101',
      'va:uni:9229:UNIV191',
    ]);
    expect(rows.every((item) => (
      item.literal_no_requirement_statement === false
      && item.incoming_course_edge_count === 0
      && item.content_accounting.source_content_discarded === false
      && item.preserved_signals.every((signal) => signal.figure6_h_g_effect === false)
    ))).toBe(true);
    expect(row('va:uni:9229:CLSE101')).toMatchObject({
      marker_control: {
        entry_required_requisite_marker_count: 1,
        same_source_positive_control: true,
      },
      preserved_signals: [{
        kind: 'program_and_class_enrollment_prerequisite',
        classification: 'population_enrollment_restriction_zero_course_edge',
      }],
    });
  });

  it('preserves all three exact formulas without claiming runtime readiness', () => {
    expect(row('va:uni:9219:CS322')).toMatchObject({
      source_formula_status: 'exact',
      runtime_ready: false,
      groups: [{
        paths: [
          { all_of: [{ course_key: 'va:uni:9219:CS220', minimum_grade: 'C' },
            { course_key: 'va:uni:9219:MATH171' }] },
          { all_of: [{ course_key: 'va:uni:9219:CS220', minimum_grade: 'C' },
            { course_key: 'va:uni:9219:MATH169' }] },
          { all_of: [{ course_key: 'va:uni:9219:CS220', minimum_grade: 'C' },
            { course_key: 'va:uni:9219:MATH151' }] },
        ],
      }],
    });
    expect(row('va:uni:9214:SPAN212')).toMatchObject({
      runtime_blockers: [
        'recursive_reference_formula_ambiguous',
        'non_course_condition_binding_required',
      ],
      groups: [{ paths: [
        { all_of: [{ course_key: 'va:uni:9214:SPAN211' }] },
        { all_of: [{
          type: 'non_course', condition: 'appropriate_spanish_placement_score',
        }] },
      ] }],
    });
    expect(row('va:uni:9213:MATH233')).toMatchObject({
      scope_role: 'induced_recursive_closure',
      runtime_blockers: ['non_course_condition_binding_required'],
      preserved_signals: [{
        kind: 'prior_credit_exclusion', excluded_course_codes: ['MATH232', 'MATH235'],
      }],
      groups: [{ paths: [
        { all_of: [{ course_key: 'va:uni:9213:MATH155' }] },
        { all_of: [{ course_key: 'va:uni:9213:MATH156' }] },
        { all_of: [{
          type: 'non_course', condition: 'appropriate_jmu_math_placement_score',
          threshold_published: false,
        }] },
      ] }],
    });
  });

  it('records both newly exposed course blockers and the exact JMU induction', () => {
    expect(artifact.facts.new_blocked_references).toMatchObject([
      {
        required_by_course_key: 'va:uni:9219:CS322',
        course_key: 'va:uni:9219:MATH151',
        blocker: 'no_retained_exact_owner_course_entry',
      },
      {
        required_by_course_key: 'va:uni:9214:SPAN212',
        course_key: 'va:uni:9214:SPAN211',
        blocker: 'implicit_comma_boolean_formula_not_source_grouped',
      },
    ]);
    expect(artifact.facts.induction_receipt).toMatchObject({
      upstream_course_key: 'va:uni:9213:MATH234',
      upstream_disposition_owned_elsewhere: true,
      exact_reference_course_key: 'va:uni:9213:MATH233',
      minimum_grade: 'C-',
      owner_contract: EXISTING_CONTRACT_ACCOUNTING.university_tail.contract,
      owner_contract_facts_sha256:
        EXISTING_CONTRACT_ACCOUNTING.university_tail.facts_sha256,
    });
  });

  it('keeps conflicting CHEM1014 and MATH111 interpretations blocked', () => {
    expect(artifact.facts.conflict_reconciliations).toEqual([
      expect.objectContaining({
        course_key: 'va:uni:9230:CHEM1014',
        disposition: 'blocked_underspecified_required_knowledge',
        raw: 'Mathematical problem solving skills required for success in general chemistry.',
      }),
      expect.objectContaining({
        course_key: 'va:uni:9233:MATH111',
        disposition: 'blocked_unnamed_required_lab_corequisite',
        raw: 'Concurrent enrollment in Math 111 calculus lab required.',
      }),
    ]);
  });

  it('reproduces the production closure and non-course runtime blockers', () => {
    const cs = compileFormula('va:uni:9219:CS322', ['CS220', 'MATH169', 'MATH171']);
    expect(cs.ready).toBe(false);
    expect(cs.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'prerequisite_formula_closure_missing' }),
    ]));
    const span = compileFormula('va:uni:9214:SPAN212', []);
    expect(span.ready).toBe(false);
    expect(span.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'prerequisite_formula_closure_missing' }),
    ]));

    const math = compileFormula('va:uni:9213:MATH233', ['MATH155', 'MATH156']);
    expect(math.ready).toBe(true);
    const graph = buildExactVirginiaParentMap({
      compiledCorpora: math.corpora,
      pathwayCourseKeys: ['va:CSC100', 'va:uni:9213:MATH233', 'va:uni:9213:MATH155'],
    });
    expect(graph.ready).toBe(false);
    expect(graph.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'non_course_formula_path_unresolved' }),
    ]));
  });

  it('fails closed on retained source, candidate, or disposition drift', () => {
    const sourcePath =
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__honr.html';
    expect(() => buildEvidence({
      readFile(relative) {
        const bytes = defaultReadFile(relative);
        return relative === sourcePath
          ? Buffer.concat([bytes, Buffer.from(' ')]) : bytes;
      },
    })).toThrow(/source_bytes|source_sha256/);

    const candidatesPath = 'research/va-university-prerequisite-candidates.json';
    expect(() => buildEvidence({
      readFile(relative) {
        const bytes = defaultReadFile(relative);
        if (relative !== candidatesPath) return bytes;
        const changed = JSON.parse(bytes.toString('utf8'));
        changed.candidates.find((item) => item.course_key === 'va:uni:9219:CS322')
          .source.raw_entry_text += ' ';
        return Buffer.from(JSON.stringify(changed));
      },
    })).toThrow(/CS322:candidate/);

    const changed = structuredClone(artifact);
    changed.facts.target_rows.find((item) => item.course_key === 'va:uni:9229:CLSE101')
      .disposition = 'exact_formula_runtime_blocked';
    expect(evidenceIssues(changed)).toEqual(expect.arrayContaining([
      'facts_sha256_replay', 'zero_edge_partition',
    ]));
  });
});
