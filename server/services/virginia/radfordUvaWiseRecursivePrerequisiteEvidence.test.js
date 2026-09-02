import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  BLOCKED_REVIEW_REASON,
  EXPECTED_FACTS_SHA256,
  REVIEW_REASON,
  TARGET_KEYS,
  buildEvidence,
  evidenceIssues,
  resolveRadfordUvaWiseRecursive,
} = require('./radfordUvaWiseRecursivePrerequisiteEvidence');

describe('Radford/UVA Wise recursive prerequisite evidence', () => {
  const artifact = buildEvidence();
  const candidates = require('../../.va-catalogs/research/va-university-prerequisite-candidates.json');
  const candidate = (key) => candidates.candidates.find((row) => row.course_key === key);

  it('replays fourteen exact entries with a pinned five-safe/nine-blocked partition', () => {
    expect(evidenceIssues(artifact)).toEqual([]);
    expect(artifact.facts_sha256).toBe(EXPECTED_FACTS_SHA256);
    expect(artifact.summary).toMatchObject({
      captured_exact_entry_rows: 14,
      safe_exact_formula_rows: 5,
      blocked_exact_source_rows: 9,
      exact_formal_reference_keys: 11,
      unresolved_formal_reference_keys: 0,
    });
    expect(artifact.facts.target_rows.map((row) => row.course_key).sort())
      .toEqual([...TARGET_KEYS]);
  });

  it('promotes only the five exact compiler-safe formulas', () => {
    const safe = {
      'va:uni:9219:PHYS112': [['PHYS111']],
      'va:uni:9219:PHYS221': [['MATH169'], ['MATH171']],
      'va:uni:9219:PHYS222': [['PHYS221']],
      'va:uni:9226:MTH1110': [['MTH1010']],
      'va:uni:9226:MTH1210': [['MTH1110']],
    };
    for (const [key, expectedPaths] of Object.entries(safe)) {
      const resolved = resolveRadfordUvaWiseRecursive(candidate(key), artifact);
      expect(resolved).toMatchObject({
        applicable: true,
        ready: true,
        blocked: false,
        status: 'parsed',
        review_reason: REVIEW_REASON,
      });
      expect(resolved.groups.flatMap((group) => group.paths.map((path) => (
        path.all_of.map((condition) => condition.code)
      )))).toEqual(expectedPaths);
    }
  });

  it('preserves every blocked formula and signal while emitting no partial groups', () => {
    const blockedKeys = TARGET_KEYS.filter((key) => ![
      'va:uni:9219:PHYS112', 'va:uni:9219:PHYS221', 'va:uni:9219:PHYS222',
      'va:uni:9226:MTH1110', 'va:uni:9226:MTH1210',
    ].includes(key));
    expect(blockedKeys).toHaveLength(9);
    for (const key of blockedKeys) {
      const resolved = resolveRadfordUvaWiseRecursive(candidate(key), artifact);
      expect(resolved).toMatchObject({
        applicable: true,
        ready: false,
        blocked: true,
        issues: [],
        review_reason: BLOCKED_REVIEW_REASON,
        blocker_evidence: {
          prerequisite_formula_inferred: false,
          structural_none_inferred: false,
          partial_course_edges_emitted: false,
        },
      });
      expect(resolved.blocker_evidence.runtime_blockers.length).toBeGreaterThan(0);
    }
  });

  it('fails closed when an exact source byte projection drifts', () => {
    const original = candidate('va:uni:9219:PHYS112');
    const mutated = {
      ...original,
      source: { ...original.source, raw_entry_text: `${original.source.raw_entry_text} drift` },
    };
    expect(resolveRadfordUvaWiseRecursive(mutated, artifact)).toMatchObject({
      applicable: true,
      ready: false,
      issues: ['source_receipt'],
    });
  });
});
