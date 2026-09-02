import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import reviewArtifact from '../../.va-catalogs/research/va-university-prerequisite-review.json';

const require = createRequire(import.meta.url);
const {
  buildFromArtifacts,
  checkFromArtifacts,
  main,
} = require('./checkVirginiaTechRecursivePrerequisiteClosure');
const clone = (value) => structuredClone(value);

describe('read-only Virginia Tech recursive prerequisite closure check', () => {
  it('replays retained bytes, shared projections, compiler routes, and blockers', () => {
    expect(buildFromArtifacts()).toEqual({
      verified: true,
      contract: 'virginia_tech_recursive_prerequisite_exact_receipts_v1',
      control_receipt_sha256:
        '3c9a959eeeb6d80e7963272c48d6d1dd63f6a3337a3acd54489e196a7db8a5a5',
      target_rows: 8,
      promoted_codes: ['ESM2114', 'MATH1454', 'ME4584'],
      blocked_codes: ['CHEM1014', 'CS3704', 'ISC1105', 'ISC1115', 'MATH1014'],
      direct_formula_references: [
        'va:uni:9230:ECE4704',
        'va:uni:9230:MATH1225',
        'va:uni:9230:MATH2204',
        'va:uni:9230:MATH2204H',
        'va:uni:9230:MATH2406H',
        'va:uni:9230:ME4524',
      ],
      retained_source_replay: { source_responses: 6, complete_entries: 8 },
      production_compiler_probe: {
        safe_formula_routes: [
          {
            course_code: 'ESM2114',
            parent_course_keys: ['va:uni:9230:MATH2204'],
          },
          {
            course_code: 'ESM2114',
            parent_course_keys: ['va:uni:9230:MATH2204H'],
          },
          {
            course_code: 'ESM2114',
            parent_course_keys: ['va:uni:9230:MATH2406H'],
          },
          {
            course_code: 'MATH1454',
            parent_course_keys: ['va:uni:9230:MATH1225'],
          },
          {
            course_code: 'ME4584',
            parent_course_keys: ['va:uni:9230:ME4524'],
          },
          {
            course_code: 'ME4584',
            parent_course_keys: ['va:uni:9230:ECE4704'],
          },
        ],
        reciprocal_cycle: [
          'va:uni:9230:ISC1105',
          'va:uni:9230:ISC1115',
          'va:uni:9230:ISC1105',
        ],
        math1014_runtime_blocker: 'non_course_formula_path_unresolved',
      },
    });
  });

  it('fails closed on candidate, review formula, blocker, or retained-byte tampering', () => {
    const changedCandidate = clone(candidatesArtifact);
    changedCandidate.candidates.find((row) => row.course_key === 'va:uni:9230:ESM2114')
      .source.raw_entry_text += ' ';
    expect(() => checkFromArtifacts({
      candidatesArtifact: changedCandidate,
      reviewArtifact,
    })).toThrow('exact source control failed');

    const changedFormula = clone(reviewArtifact);
    changedFormula.review_rows.find((row) => row.course_key === 'va:uni:9230:ME4584')
      .groups[0].paths.pop();
    expect(() => checkFromArtifacts({
      candidatesArtifact,
      reviewArtifact: changedFormula,
    })).toThrow('ME4584: shared review projection changed');

    const changedBlocker = clone(reviewArtifact);
    changedBlocker.review_rows.find((row) => row.course_key === 'va:uni:9230:MATH1014')
      .parser_error = null;
    expect(() => checkFromArtifacts({
      candidatesArtifact,
      reviewArtifact: changedBlocker,
    })).toThrow('MATH1014: shared review projection changed');

    let changed = false;
    expect(() => checkFromArtifacts({
      candidatesArtifact,
      reviewArtifact,
      readFile(file) {
        const bytes = fs.readFileSync(file);
        if (changed) return bytes;
        changed = true;
        return Buffer.concat([bytes, Buffer.from(' ')]);
      },
    })).toThrow('retained source response bytes changed');
  });

  it('accepts only its read-only JSON option', () => {
    expect(() => main(['--write'])).toThrow('unknown option(s): --write');
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    expect(main(['--json'])).toMatchObject({ verified: true, target_rows: 8 });
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({
      promoted_codes: ['ESM2114', 'MATH1454', 'ME4584'],
      blocked_codes: ['CHEM1014', 'CS3704', 'ISC1105', 'ISC1115', 'MATH1014'],
    });
    write.mockRestore();
  });
});
