import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditBridgewaterTimingPrerequisiteCandidate,
} from './bridgewaterTimingPrerequisiteEvidence';

const CANDIDATES_PATH = path.resolve(
  __dirname, '../../.va-catalogs/research/va-university-prerequisite-candidates.json',
);

function rows() {
  const artifact = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
  return artifact.candidates.filter((row) => row.slug === 'bridgewater-college');
}

function cloned(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('Bridgewater first-semester prerequisite blockers', () => {
  it('retains both exact edition-bound timing constraints without calling them none', () => {
    const candidates = rows();
    const cl100 = auditBridgewaterTimingPrerequisiteCandidate(
      candidates.find((row) => row.course_code === 'CL100'),
    );
    const cl150 = auditBridgewaterTimingPrerequisiteCandidate(
      candidates.find((row) => row.course_code === 'CL150'),
    );
    expect(cl100).toMatchObject({
      applicable: true,
      ready: false,
      issues: [],
      retained_non_prerequisite_signals: [{
        kind: 'required_first_semester_timing',
        term_constraint: 'first_semester',
      }],
    });
    expect(cl150).toMatchObject({ applicable: true, ready: false, issues: [] });
    expect(cl150.retained_non_prerequisite_signals.map((row) => row.kind)).toEqual([
      'required_first_semester_timing',
      'required_first_semester_timing_restatement',
      'intended_audience',
    ]);
  });

  it('fails closed on source, edition, field, or timing-signal drift', () => {
    const target = rows().find((row) => row.course_code === 'CL100');
    const mutations = [
      (row) => { row.source.raw_entry_text = row.source.raw_entry_text.replace('required first-semester', 'optional first-semester'); },
      (row) => { row.source.edition_catalog_year = '2025-2026'; },
      (row) => { row.source.requisite_field_receipt.exact_prerequisite_field_count = 1; },
      (row) => { row.owner_namespace = 'va:uni:9999'; },
    ];
    for (const mutate of mutations) {
      const changed = cloned(target);
      mutate(changed);
      expect(auditBridgewaterTimingPrerequisiteCandidate(changed)).toMatchObject({
        applicable: true,
        ready: false,
      });
      expect(auditBridgewaterTimingPrerequisiteCandidate(changed).issues.length).toBeGreaterThan(0);
    }
  });

  it('does not broaden to a safe-silent neighboring course', () => {
    const comm100 = rows().find((row) => row.course_code === 'COMM100');
    expect(auditBridgewaterTimingPrerequisiteCandidate(comm100))
      .toEqual({ applicable: false, ready: false, issues: [] });
  });
});
