import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import { describe, expect, it } from 'vitest';
import {
  EXACT_CANDIDATE_SHA256,
  EXACT_SOURCE_SHA256,
  TARGET_CODES,
  canonicalSha256,
  resolveVirginiaTechCs4784ClosureCandidate,
} from './virginiaTechCs4784ClosurePrerequisiteEvidence';

const candidates = new Map(candidatesArtifact.candidates.filter((row) => (
  row.owner_namespace === 'va:uni:9230' && TARGET_CODES.includes(row.course_code)
)).map((row) => [row.course_code, row]));

describe('Virginia Tech CS4784 recursive prerequisite closure', () => {
  it('binds both exact retained candidates and resolves their full formulas', () => {
    expect([...candidates.keys()].sort()).toEqual([...TARGET_CODES].sort());
    for (const code of TARGET_CODES) {
      const candidate = candidates.get(code);
      expect(canonicalSha256(candidate)).toBe(EXACT_CANDIDATE_SHA256[code]);
      expect(canonicalSha256(candidate.source)).toBe(EXACT_SOURCE_SHA256[code]);
      const result = resolveVirginiaTechCs4784ClosureCandidate(candidate);
      expect(result).toMatchObject({ applicable: true, ready: true, status: 'parsed' });
      expect(result.groups[0].formula).toBe('paths_or__conditions_and');
    }
    expect(resolveVirginiaTechCs4784ClosureCandidate(candidates.get('CS3724'))
      .groups[0].paths).toHaveLength(4);
    expect(resolveVirginiaTechCs4784ClosureCandidate(candidates.get('CS3744'))
      .groups[0].paths).toHaveLength(8);
  });

  it('keeps the CS2114 grade scope exact in both formulas', () => {
    const cs3724 = resolveVirginiaTechCs4784ClosureCandidate(candidates.get('CS3724'));
    expect(cs3724.groups[0].paths.every((path) => (
      path.all_of[0].code === 'CS2114' && path.all_of[0].minimum_grade === 'C'
    ))).toBe(true);
    const cs3744 = resolveVirginiaTechCs4784ClosureCandidate(candidates.get('CS3744'));
    expect(cs3744.groups[0].paths.filter((path) => path.all_of[0].code === 'CS2114')
      .every((path) => path.all_of[0].minimum_grade === 'C')).toBe(true);
    expect(cs3744.groups[0].paths.filter((path) => path.all_of[0].code === 'ECE3514')
      .every((path) => path.all_of[0].minimum_grade === undefined)).toBe(true);
  });

  it('fails closed on candidate, source, field, or grade drift', () => {
    for (const code of TARGET_CODES) {
      for (const mutate of [
        (row) => { row.course_key += 'X'; },
        (row) => { row.source.source_response_sha256 = '0'.repeat(64); },
        (row) => { row.source.structured_requisite_fields[0].raw += ' '; },
        (row) => { row.source.raw_entry_text = row.source.raw_entry_text.replace('grade', 'mark'); },
      ]) {
        const changed = structuredClone(candidates.get(code));
        mutate(changed);
        expect(resolveVirginiaTechCs4784ClosureCandidate(changed)).toMatchObject({
          applicable: true, ready: false, code,
        });
      }
    }
  });
});
