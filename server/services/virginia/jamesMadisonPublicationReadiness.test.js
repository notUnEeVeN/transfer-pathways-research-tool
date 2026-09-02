import { describe, expect, it } from 'vitest';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { canonicalSourceContract } from '../analysis/canonicalSourceContract';
import { projectInstitutionReceivingGroups } from './courseIdentity';
import { readinessForSourceFigures } from './publicationReadiness';

const projectedJmu = () => {
  const doc = structuredClone(cachedAcceptedSourcePlan().evaluatedDocuments.find((row) => (
    row.institution_id === 'va:uni:james-madison-university'
  )));
  Object.assign(doc, {
    _id: 'degree:9213:va-cs',
    institution_id: 'va:uni:9213',
    school_id: 9213,
    state: 'va',
    va_requirement_status: 'extracted',
    va_requirement_id: 'va:degree:james-madison-university:cs',
    analysis_contract: canonicalSourceContract(),
    requirement_groups: projectInstitutionReceivingGroups(
      doc.requirement_groups,
      'va:uni:9213',
    ),
  });
  doc.verification = {
    verified: true,
    stale: false,
    verified_by: 'test-reviewer',
    verified_at: new Date('2026-08-24T00:00:00Z'),
  };
  // Preserve the historical complete-degree receipt to prove that the
  // figure-specific gate recomputes current evaluator capability.
  doc.acceptance.accepted = true;
  doc.acceptance.ready_for_analysis = false;
  doc.acceptance.analysis_ready = {
    ok: false,
    verdict: 'fail',
    checks: [
      { name: 'analysis_quality_flags', severity: 'fail' },
      { name: 'constraint_support', severity: 'fail' },
    ],
    failed: ['analysis_quality_flags', 'constraint_support'],
  };
  return doc;
};

describe('JMU exact-evaluator quality-flag publication gate', () => {
  it('recognizes both implementation flags without changing the source facts', () => {
    const doc = projectedJmu();
    const beforeFlags = structuredClone(doc.data_quality_flags);
    const readiness = readinessForSourceFigures(doc, { figures: ['1', '3', '4', '6'] });

    expect(doc.data_quality_flags).toEqual(beforeFlags);
    expect(readiness).toMatchObject({
      ready: true,
      complete_degree_ready: false,
      blockers: [],
      analysis_failures: [],
      figure_constraint_blockers: [],
      unresolved_analysis_quality_flags: [],
    });
    expect(readiness.analysis_quality_flag_resolutions).toHaveLength(2);
    expect(readiness.analysis_quality_flag_resolutions.every((flag) => (
      flag.resolved_by_exact_evaluator === true
      && flag.rule_receipts.length === 1
      && flag.rule_receipts[0].supported === true
    ))).toBe(true);
  });

  it('re-closes both the constraint and quality-flag gates on source-ref drift', () => {
    const doc = projectedJmu();
    doc.requirement_groups[9].source_refs = ['major', 'graduation'];
    const readiness = readinessForSourceFigures(doc, { figures: ['1'] });
    expect(readiness).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        'analysis_acceptance_failed',
        'four_year_constraint_evaluator_required',
      ]),
      analysis_failures: ['analysis_quality_flags'],
    });
    expect(readiness.unresolved_analysis_quality_flags).toHaveLength(2);
    expect(readiness.figure_constraint_blockers.map((row) => row.kind)).toEqual([
      'minimum_course_number_distribution',
      'correlated_variable_major_and_elective_units',
    ]);
  });

  it('does not let two resolved mappings hide an additional unknown analysis flag', () => {
    const doc = projectedJmu();
    doc.data_quality_flags.push({
      code: 'future_unmapped_gap',
      severity: 'block_analysis',
      message: 'A future source or evaluator issue.',
    });
    const readiness = readinessForSourceFigures(doc, { figures: ['3', '4'] });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain('analysis_acceptance_failed');
    expect(readiness.unresolved_analysis_quality_flags).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'future_unmapped_gap',
        resolved_by_exact_evaluator: false,
      }),
    ]));
  });

  it('does not supersede a stronger source-authored block severity', () => {
    const doc = projectedJmu();
    doc.data_quality_flags[0].severity = 'block';
    const readiness = readinessForSourceFigures(doc, { figures: ['6'] });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain('analysis_acceptance_failed');
    expect(readiness.unresolved_analysis_quality_flags[0]).toMatchObject({
      code: 'correlated_major_and_elective_ranges',
      severity: 'block',
      resolved_by_exact_evaluator: false,
    });
  });
});
