import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_FACTS_SHA256,
  TARGET_KEYS,
  buildUniversityPrerequisiteTailControl,
  resolveUniversityPrerequisiteTailCandidate,
} from './universityPrerequisiteTailClosureEvidence';
import { productionCycleProbe } from '../../scripts/va/checkUniversityPrerequisiteTailClosure';

const ROOT = path.resolve(__dirname, '../../.va-catalogs');

function inputs() {
  const raw = path.join(ROOT, 'university-prerequisites/raw');
  const candidates = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'research/va-university-prerequisite-candidates.json'), 'utf8',
  )).candidates;
  return {
    candidates,
    source: {
      jmuMathHtml: fs.readFileSync(path.join(
        raw, 'james-madison-university/james-madison-university__math.html',
      ), 'utf8'),
      oduMathHtml: fs.readFileSync(path.join(
        raw, 'old-dominion-university/old-dominion-university__math.html',
      ), 'utf8'),
      wmCsciHtml: fs.readFileSync(path.join(
        raw, 'william-mary/william-mary__csci.html',
      ), 'utf8'),
    },
  };
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const candidateFor = (candidates, key) => candidates.find((row) => (
  `${row.slug}:${row.course_code}` === key
));

describe('university prerequisite tail closure evidence', () => {
  it('replays all three exact current entries and same-response controls', () => {
    const { source } = inputs();
    const control = buildUniversityPrerequisiteTailControl(source);
    expect(control).toMatchObject({
      verified: true,
      issues: [],
      facts_sha256: EXPECTED_FACTS_SHA256,
      facts: {
        dispositions: {
          'james-madison-university:MATH234': 'parsed',
          'old-dominion-university:MATH100': 'none',
          'william-mary:CSCI141L': 'blocked',
        },
      },
    });
    expect(TARGET_KEYS).toEqual([
      'james-madison-university:MATH234',
      'old-dominion-university:MATH100',
      'william-mary:CSCI141L',
    ]);
    expect(control.facts.source_pages).toMatchObject({
      jmu_math: { source_complete_entry_count: 109, source_positive_count: 79 },
      odu_math: { source_complete_entry_count: 111, source_positive_count: 98 },
      wm_csci: { source_complete_entry_count: 62, source_positive_count: 38 },
    });
  });

  it('refutes structural-none for JMU MATH234 and retains its exclusion', () => {
    const { candidates, source } = inputs();
    const control = buildUniversityPrerequisiteTailControl(source);
    const result = resolveUniversityPrerequisiteTailCandidate(
      candidateFor(candidates, 'james-madison-university:MATH234'), control,
    );
    expect(result).toMatchObject({
      ready: true,
      status: 'parsed',
      groups: [{
        kind: 'prerequisite',
        paths: [{ all_of: [{
          course_key: 'va:uni:9213:MATH233', minimum_grade: 'C-',
        }] }],
      }],
      ignored_nonrequired_requisites: [{
        kind: 'prior_credit_exclusion', excluded_if_credit_for: ['MATH235'],
      }],
    });
    expect(result.structural_none_evidence).toBeUndefined();
  });

  it('proves ODU MATH100 has zero Figure 6 edges without dropping eligibility text', () => {
    const { candidates, source } = inputs();
    const control = buildUniversityPrerequisiteTailControl(source);
    const candidate = candidateFor(candidates, 'old-dominion-university:MATH100');
    const result = resolveUniversityPrerequisiteTailCandidate(candidate, control);
    expect(result).toMatchObject({
      ready: true,
      status: 'none',
      groups: [],
      structural_none_evidence: {
        literal_none_statement: false,
        graph_effect: {
          added_course_vertices: 0,
          added_prerequisite_edges: 0,
          added_corequisite_edges: 0,
        },
        retained_non_prerequisite_signals: [
          { kind: 'outbound_other_course_prerequisite_noncompletion_description' },
          { kind: 'negative_prior_credit_or_higher_math_qualification_exclusion' },
        ],
      },
    });
    for (const signal of result.ignored_nonrequired_requisites) {
      expect(candidate.source.raw_entry_text.slice(
        signal.relative_start, signal.relative_end,
      )).toBe(signal.raw);
    }
  });

  it('retains CSCI141L exact corequisite but proves the production reciprocal cycle', () => {
    const { candidates, source } = inputs();
    const control = buildUniversityPrerequisiteTailControl(source);
    const result = resolveUniversityPrerequisiteTailCandidate(
      candidateFor(candidates, 'william-mary:CSCI141L'), control,
    );
    expect(result).toMatchObject({
      ready: false,
      blocked: true,
      issues: [],
      review_reason: 'reciprocal_corequisite_cycle_rejected_by_production_compiler',
      preserved_source_formula_groups: [{
        kind: 'corequisite',
        paths: [{ all_of: [{ course_key: 'va:uni:9233:CSCI141' }] }],
      }],
      blocker_evidence: {
        source_formula_status: 'exact',
        production_compiler_issue: 'requisite_graph_cycle',
        formula_dropped_or_rewritten: false,
      },
    });
    const probe = productionCycleProbe(control);
    expect(probe.compiled).toMatchObject({ ready: true, issues: [] });
    expect(probe.graph).toMatchObject({
      ready: false,
      parents_by_course_key: null,
      issues: [{
        path: 'parent_map',
        code: 'requisite_graph_cycle',
        cycle: [
          'va:uni:9233:CSCI141',
          'va:uni:9233:CSCI141L',
          'va:uni:9233:CSCI141',
        ],
      }],
    });
  });

  it('fails closed on source, candidate, edition, marker, or control drift', () => {
    const { candidates, source } = inputs();
    expect(buildUniversityPrerequisiteTailControl({
      ...source,
      oduMathHtml: `${source.oduMathHtml}<!-- source drift -->`,
    }).verified).toBe(false);
    expect(buildUniversityPrerequisiteTailControl({
      ...source,
      jmuMathHtml: `${source.jmuMathHtml}<!-- source drift -->`,
    }).verified).toBe(false);
    const control = buildUniversityPrerequisiteTailControl(source);
    const changed = clone(candidateFor(candidates, 'william-mary:CSCI141L'));
    changed.source.raw_entry_text = changed.source.raw_entry_text.replace('CSCI 141', 'CSCI 999');
    expect(resolveUniversityPrerequisiteTailCandidate(changed, control)).toMatchObject({
      applicable: true, ready: false, issues: expect.any(Array),
    });
    const wrongEdition = clone(candidateFor(candidates, 'old-dominion-university:MATH100'));
    wrongEdition.source.catalog_year_verified = '2025-2026';
    expect(resolveUniversityPrerequisiteTailCandidate(wrongEdition, control).ready).toBe(false);
    const changedControl = clone(control);
    changedControl.facts.target_entries['old-dominion-university:MATH100']
      .complete_entry_receipt.entry_required_requisite_marker_count = 1;
    changedControl.verified = false;
    expect(resolveUniversityPrerequisiteTailCandidate(
      candidateFor(candidates, 'old-dominion-university:MATH100'), changedControl,
    ).ready).toBe(false);
  });

  it('does not broaden the tail allowlist to neighboring exact rows', () => {
    const { candidates, source } = inputs();
    const control = buildUniversityPrerequisiteTailControl(source);
    expect(resolveUniversityPrerequisiteTailCandidate(
      candidateFor(candidates, 'james-madison-university:MATH233'), control,
    )).toEqual({ applicable: false, ready: false, blocked: false, issues: [] });
  });
});
