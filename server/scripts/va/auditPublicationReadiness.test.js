import { describe, expect, it, vi } from 'vitest';
import {
  applyFigurePublicationGate,
  checkedInFigure6Readiness,
  figure6ReadinessForRows,
  printReport,
} from './auditPublicationReadiness';

describe('Virginia publication audit prerequisite evidence', () => {
  it('prints institution identity failures with their exact path and code', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    printReport({
      verdict: 'fail',
      counts: { associate_degrees: 19, bachelor_degrees: 18, projected_associate_degrees: 19, active_bachelor_templates: 16, agreement_cells: 304 },
      expected: { associate_degrees: 19, bachelor_degrees: 18, active_bachelor_templates: 16, agreement_cells: 304 },
      source_summary: { total: 37, ready: 0, blocked: 37, requires_model_or_evaluator_work: 0, requires_targeted_source_research: 0, requires_human_verification: 0, requires_scope_or_policy_decision: 0 },
      projection_conservation: [], projection_losses: [],
      cohort_failures: [],
      source_accounting: [], source_accounting_failures: [], sources: [],
      identity_cohort: { issues: [{ path: 'institutions[0].name', code: 'institution_registry_name_mismatch', detail: { expected: 'A', actual: 'ZZZ A' } }] },
      figure_readiness: {}, figure_failures: [], course_identity: null,
    });
    expect(log.mock.calls.flat().join('\n'))
      .toContain('identity:institutions[0].name [institution_registry_name_mismatch]');
    log.mockRestore();
  });

  it('binds a post-projection evidence failure into every published paper-figure verdict', () => {
    const report = {
      publishable: true,
      verdict: 'pass',
      publication_by_figure: Object.fromEntries(['1', '3', '4', '6'].map((figure) => [
        figure, { figure, publishable: true, blockers: [] },
      ])),
      paper_figure_failures: [],
    };
    applyFigurePublicationGate(report, {
      ready: false,
      blocker: 'course_unit_evidence_overlay_failed',
    });
    expect(report).toMatchObject({ publishable: false, verdict: 'fail' });
    expect(Object.values(report.publication_by_figure).every((figure) => (
      figure.publishable === false
      && figure.blockers.includes('course_unit_evidence_overlay_failed')
    ))).toBe(true);
    expect(report.paper_figure_failures).toEqual([
      { figure: '1', blockers: ['course_unit_evidence_overlay_failed'] },
      { figure: '3', blockers: ['course_unit_evidence_overlay_failed'] },
      { figure: '4', blockers: ['course_unit_evidence_overlay_failed'] },
      { figure: '6', blockers: ['course_unit_evidence_overlay_failed'] },
    ]);
  });
  it('reports the real checked-in VCCS corpus and university collection scope', () => {
    const report = checkedInFigure6Readiness();

    expect(report).toMatchObject({
      ready: false,
      blocker: 'virginia_figure6_prerequisite_model_unavailable',
      counts: {
        community_college: 189,
        required_community_college: 184,
        university: 0,
        required_university: 850,
        community_college_required_status: {
          parsed: 87,
          none: 97,
          missing: 0,
          unparsed: 0,
        },
      },
    });
    expect(report.issues.map((issue) => issue.code)).toContain('required_course_requisite_missing');
    expect(report.issues.map((issue) => issue.code)).toContain('exact_formula_adapter_not_integrated');
  });

  it('uses supplied collection rows rather than substituting checked-in prerequisite rows', () => {
    const report = figure6ReadinessForRows({
      communityCollegeRows: [],
      universityRows: [],
      adapterIntegrated: true,
    });

    expect(report.counts).toMatchObject({
      community_college: 0,
      required_community_college: 184,
      university: 0,
      required_university: 850,
    });
    expect(report.issues.map((issue) => issue.code)).not.toContain(
      'exact_formula_adapter_not_integrated',
    );
    expect(report.issues.filter((issue) => issue.code === 'prerequisite_corpus_missing'))
      .toHaveLength(2);
  });
});
