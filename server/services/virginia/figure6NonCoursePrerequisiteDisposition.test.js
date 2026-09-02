import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCKED_COURSE_KEYS,
  FIGURE6_CONSTRUCT,
  REQUIRED_KNOWLEDGE_BLOCKER,
  SAFE_COURSE_KEYS,
  TARGET_COURSE_KEYS,
  resolveFigure6NonCoursePrerequisiteDisposition,
} from './figure6NonCoursePrerequisiteDisposition';
import {
  buildOldDominionPrerequisiteMarkerControlFromCandidates,
} from './oldDominionPrerequisiteClosureEvidence';
import { adaptExactRequisiteRow } from './pathwayComplexityPrerequisites';

const CANDIDATES_PATH = path.resolve(
  __dirname, '../../.va-catalogs/research/va-university-prerequisite-candidates.json',
);

const clone = (value) => JSON.parse(JSON.stringify(value));

function inputs() {
  const artifact = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
  const candidates = artifact.candidates.filter((row) => (
    ['bridgewater-college', 'old-dominion-university'].includes(row.slug)
  ));
  return {
    candidates,
    control: buildOldDominionPrerequisiteMarkerControlFromCandidates(candidates),
  };
}

function candidateByKey(candidates, courseKey) {
  return candidates.find((row) => row.course_key === courseKey);
}

describe('exact Figure 6 non-course prerequisite disposition', () => {
  it('promotes six zero-edge rows and keeps required prior knowledge blocked', () => {
    const { candidates, control } = inputs();
    expect(control).toMatchObject({ verified: true, issues: [] });
    expect(TARGET_COURSE_KEYS).toHaveLength(7);
    expect(SAFE_COURSE_KEYS).toEqual([
      'va:uni:9205:CL100',
      'va:uni:9205:CL150',
      'va:uni:9218:CS115',
      'va:uni:9218:OEAS110N',
      'va:uni:9218:OEAS111N',
      'va:uni:9218:OEAS126N',
    ]);
    expect(BLOCKED_COURSE_KEYS).toEqual(['va:uni:9218:OEAS106N']);

    const resolutions = Object.fromEntries(TARGET_COURSE_KEYS.map((courseKey) => [
      courseKey,
      resolveFigure6NonCoursePrerequisiteDisposition(
        candidateByKey(candidates, courseKey),
        { oldDominionMarkerControl: control },
      ),
    ]));
    expect(Object.entries(resolutions).filter(([, row]) => row.ready)
      .map(([courseKey]) => courseKey)).toEqual(SAFE_COURSE_KEYS);
    for (const courseKey of SAFE_COURSE_KEYS) {
      expect(resolutions[courseKey]).toMatchObject({
        applicable: true,
        ready: true,
        issues: [],
        status: 'none',
        review_status: 'promoted_structural_none',
        structural_none_evidence: {
          literal_none_statement: false,
          graph_effect: {
            added_course_vertices: 0,
            added_prerequisite_edges: 0,
            added_corequisite_edges: 0,
          },
          content_accounting: {
            every_reviewed_signal_accounted_for: true,
            source_content_discarded: false,
          },
        },
      });
    }
    expect(resolutions['va:uni:9218:OEAS106N']).toMatchObject({
      applicable: true,
      ready: false,
      issues: [],
      review_reason: REQUIRED_KNOWLEDGE_BLOCKER,
      blocker_evidence: {
        blocking_signal_kinds: ['required_prior_knowledge'],
      },
    });
  });

  it('retains every timing, audience, component, credit, enrollment, and knowledge signal', () => {
    const { candidates, control } = inputs();
    const expectedKinds = {
      'va:uni:9205:CL100': ['required_first_semester_timing'],
      'va:uni:9205:CL150': [
        'required_first_semester_timing',
        'required_first_semester_timing_restatement',
        'intended_audience',
      ],
      'va:uni:9218:CS115': [
        'intended_audience', 'required_course_component', 'prior_credit_exclusion',
      ],
      'va:uni:9218:OEAS106N': [
        'required_prior_knowledge', 'required_course_component',
      ],
      'va:uni:9218:OEAS110N': ['mutual_credit_exclusion'],
      'va:uni:9218:OEAS111N': ['mutual_credit_exclusion'],
      'va:uni:9218:OEAS126N': ['enrollment_restriction'],
    };
    for (const [courseKey, kinds] of Object.entries(expectedKinds)) {
      const candidate = candidateByKey(candidates, courseKey);
      const result = resolveFigure6NonCoursePrerequisiteDisposition(candidate, {
        oldDominionMarkerControl: control,
      });
      expect(result.retained_non_prerequisite_signals.map((row) => row.kind)).toEqual(kinds);
      const proof = result.ready
        ? result.structural_none_evidence : result.blocker_evidence;
      expect(proof.retained_non_prerequisite_signals.map((row) => row.kind)).toEqual(kinds);
      expect(proof.signal_dispositions.map((row) => row.kind)).toEqual(kinds);
      for (const signal of result.retained_non_prerequisite_signals) {
        expect(candidate.source.raw_entry_text.slice(
          signal.relative_start, signal.relative_end,
        )).toBe(signal.raw);
      }
    }
  });

  it('uses the course-edge construct without claiming eligibility or scheduling completion', () => {
    expect(FIGURE6_CONSTRUCT).toMatchObject({
      metric: 'curricular_analytics_structural_complexity_h_of_g',
      vertices: 'selected_curriculum_courses',
      edges: 'required_prerequisite_and_corequisite_dependencies',
      fail_closed_dimension: 'unresolved_required_prior_knowledge',
    });
    const { candidates, control } = inputs();
    const honors = resolveFigure6NonCoursePrerequisiteDisposition(
      candidateByKey(candidates, 'va:uni:9218:OEAS126N'),
      { oldDominionMarkerControl: control },
    );
    expect(honors.structural_none_evidence.inference_boundary)
      .toMatch(/does not waive or satisfy scheduling.*enrollment.*course-selection rules/i);
    expect(honors.structural_none_evidence.retained_non_prerequisite_signals[0])
      .toMatchObject({
        kind: 'enrollment_restriction',
        required_population: 'Honors College students',
        prerequisite_effect: false,
      });
  });

  it('survives the existing Figure 6 row adapter without dropping retained signals', () => {
    const { candidates, control } = inputs();
    for (const courseKey of SAFE_COURSE_KEYS) {
      const result = resolveFigure6NonCoursePrerequisiteDisposition(
        candidateByKey(candidates, courseKey),
        { oldDominionMarkerControl: control },
      );
      const adapted = adaptExactRequisiteRow({
        course_key: courseKey,
        owner_namespace: courseKey.split(':').slice(0, 3).join(':'),
        source: 'institution_catalog',
        raw_requisites: null,
        groups: [],
        ...result,
      });
      expect(adapted.status).toBe('none');
      expect(adapted.groups).toEqual([]);
      expect(adapted.retained_non_prerequisite_signals)
        .toEqual(result.retained_non_prerequisite_signals);
      expect(adapted.structural_none_evidence)
        .toEqual(result.structural_none_evidence);
    }
  });

  it('fails closed on candidate bytes, edition receipts, marker controls, or signal drift', () => {
    const { candidates, control } = inputs();
    const bridgewater = clone(candidateByKey(candidates, 'va:uni:9205:CL100'));
    bridgewater.source.raw_entry_text = bridgewater.source.raw_entry_text
      .replace('required first-semester', 'optional first-semester');
    expect(resolveFigure6NonCoursePrerequisiteDisposition(bridgewater, {
      oldDominionMarkerControl: control,
    })).toMatchObject({ applicable: true, ready: false, issues: expect.any(Array) });

    const odu = clone(candidateByKey(candidates, 'va:uni:9218:OEAS110N'));
    odu.source.raw_entry_text = odu.source.raw_entry_text
      .replace('cannot receive credit', 'may receive credit');
    expect(resolveFigure6NonCoursePrerequisiteDisposition(odu, {
      oldDominionMarkerControl: control,
    })).toMatchObject({ applicable: true, ready: false, issues: expect.any(Array) });

    const changedControl = clone(control);
    changedControl.receipt.entries.OEAS126N.safe_structural_none = true;
    expect(resolveFigure6NonCoursePrerequisiteDisposition(
      candidateByKey(candidates, 'va:uni:9218:OEAS126N'),
      { oldDominionMarkerControl: changedControl },
    )).toMatchObject({ applicable: true, ready: false, issues: expect.any(Array) });
  });

  it('never broadens the policy to a neighboring exact catalog entry', () => {
    const { candidates, control } = inputs();
    const neighbor = candidates.find((row) => row.course_key === 'va:uni:9218:OEAS108N');
    expect(resolveFigure6NonCoursePrerequisiteDisposition(neighbor, {
      oldDominionMarkerControl: control,
    })).toEqual({ applicable: false, ready: false, issues: [] });
  });
});
