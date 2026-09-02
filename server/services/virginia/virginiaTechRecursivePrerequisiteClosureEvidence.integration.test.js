import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import reviewArtifact from '../../.va-catalogs/research/va-university-prerequisite-review.json';
import scopeArtifact from '../../.va-catalogs/research/va-university-prerequisite-scope.json';
import {
  validateUniversityPrerequisiteReview,
} from './universityPrerequisiteReview';
import {
  OWNER,
  SAFE_COREQUISITE_CODES,
  TARGET_CODES,
  resolutionRowIssues,
} from './virginiaTechRecursivePrerequisiteClosureEvidence';

const rows = reviewArtifact.review_rows.filter((row) => (
  row.owner_namespace === OWNER && TARGET_CODES.includes(row.code)
));
const byCode = new Map(rows.map((row) => [row.code, row]));

describe('Virginia Tech recursive prerequisite shared artifact integration', () => {
  it('promotes only the three exact corequisite rows and leaves five blockers visible', () => {
    expect(validateUniversityPrerequisiteReview(reviewArtifact, {
      scope: scopeArtifact,
      candidates: candidatesArtifact,
    })).toEqual({ valid: true, issues: [] });
    expect(rows).toHaveLength(8);
    expect(rows.filter((row) => row.status === 'parsed').map((row) => row.code).sort())
      .toEqual([...SAFE_COREQUISITE_CODES].sort());
    expect(rows.filter((row) => row.status === 'unparsed').map((row) => row.code).sort())
      .toEqual(['CHEM1014', 'CS3704', 'ISC1105', 'ISC1115', 'MATH1014']);
    for (const row of rows) expect(resolutionRowIssues(row)).toEqual([]);
    expect(reviewArtifact.summary).toMatchObject({
      parsed: 652,
      none: 171,
      unparsed: 26,
      missing: 1,
      closure_parsed: 190,
      closure_none: 109,
      closure_unparsed: 21,
      promoted_contract_rows: 1122,
    });
    expect(reviewArtifact.closure).toMatchObject({
      formula_reference_keys: 709,
      unresolved_reference_keys: 76,
    });
  });

  it('preserves the exact formula shapes and resolves every newly introduced reference', () => {
    expect(byCode.get('ESM2114').groups[0].paths.map((formulaPath) => (
      formulaPath.all_of.map((condition) => condition.course_key)
    ))).toEqual([
      ['va:uni:9230:MATH2204'],
      ['va:uni:9230:MATH2204H'],
      ['va:uni:9230:MATH2406H'],
    ]);
    expect(byCode.get('MATH1454').groups[0].paths.map((formulaPath) => (
      formulaPath.all_of.map((condition) => condition.course_key)
    ))).toEqual([['va:uni:9230:MATH1225']]);
    expect(byCode.get('ME4584').groups[0].paths.map((formulaPath) => (
      formulaPath.all_of.map((condition) => condition.course_key)
    ))).toEqual([
      ['va:uni:9230:ME4524'],
      ['va:uni:9230:ECE4704'],
    ]);
    const promotedKeys = new Set(reviewArtifact.promoted_rows.map((row) => row.course_key));
    const references = SAFE_COREQUISITE_CODES.flatMap((code) => (
      byCode.get(code).groups.flatMap((group) => group.paths.flatMap((formulaPath) => (
        formulaPath.all_of.map((condition) => condition.course_key)
      )))
    ));
    expect(references.every((key) => promotedKeys.has(key))).toBe(true);
    expect(promotedKeys.has('va:uni:9230:ME4524')).toBe(true);
    expect(promotedKeys.has('va:uni:9230:ECE4704')).toBe(true);
  });

  it('detects formula, source proof, and blocker tampering at the row boundary', () => {
    const formula = structuredClone(byCode.get('ESM2114'));
    formula.groups[0].paths[0].all_of[0].course_key = 'va:uni:9230:MATH0000';
    expect(resolutionRowIssues(formula)).toContain('promoted_formula_projection');

    const proof = structuredClone(byCode.get('MATH1454'));
    proof.virginia_tech_recursive_prerequisite_resolution.proof.raw_entry_sha256 = '0'.repeat(64);
    expect(resolutionRowIssues(proof)).toContain('source_binding');

    const math = structuredClone(byCode.get('MATH1014'));
    math.status = 'none';
    math.parser_error = null;
    expect(resolutionRowIssues(math)).toEqual(expect.arrayContaining([
      'blocked_projection', 'math1014_runtime_blocker',
    ]));

    const isc = structuredClone(byCode.get('ISC1105'));
    isc.virginia_tech_recursive_prerequisite_resolution.proof.one_way_edge_inferred = true;
    expect(resolutionRowIssues(isc)).toContain('reciprocal_cycle_blocker');

    const conflict = structuredClone(byCode.get('CS3704'));
    conflict.virginia_tech_recursive_prerequisite_resolution
      .proof.source_conflict.typo_resolution_inferred = true;
    expect(resolutionRowIssues(conflict)).toContain('source_conflict_blocker');
  });
});
