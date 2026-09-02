import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import {
  AMBIGUOUS_BOOLEAN_CODES,
  CONDITIONAL_APPLICABILITY_CODES,
  EXACT_CANDIDATE_SHA256,
  EXACT_SOURCE_SHA256,
  EXACT_STATEMENTS,
  SAFE_CODES,
  TARGET_CODES,
  UNIDENTIFIED_PREREQUISITE_CODES,
  canonicalSha256,
  resolveVirginiaTechRemainingPrerequisiteCandidate,
  sha256,
  summarizeVirginiaTechRemainingPrerequisites,
} from './virginiaTechRemainingPrerequisiteEvidence';

const SERVER_ROOT = path.resolve(__dirname, '../..');
const candidates = candidatesArtifact.candidates
  .filter((row) => row.school_id === 9230 && TARGET_CODES.includes(row.course_code));
const byCode = new Map(candidates.map((row) => [row.course_code, row]));
const clone = (value) => structuredClone(value);

function resolution(code, candidate = byCode.get(code)) {
  return resolveVirginiaTechRemainingPrerequisiteCandidate(candidate);
}

function expectFailsClosed(code, mutate) {
  const changed = clone(byCode.get(code));
  mutate(changed);
  const result = resolution(code, changed);
  expect(result).toMatchObject({
    applicable: true,
    ready: false,
    code,
    classification: 'exact_receipt_changed',
    review_reason: 'virginia_tech_remaining_exact_candidate_or_source_receipt_changed',
  });
  expect(result.status).not.toBe('none');
  expect(result.groups).toBeUndefined();
}

describe('Virginia Tech remaining prerequisite exact evidence', () => {
  it('classifies all twelve remaining candidate rows with an exact safe delta of five', () => {
    expect(candidates).toHaveLength(12);
    expect(new Set(candidates.map((row) => row.course_code)).size).toBe(12);
    expect(SAFE_CODES).toEqual([
      'COMM2004', 'COMM2014', 'CS1114', 'CS4784', 'ENGE3900',
    ]);
    expect(AMBIGUOUS_BOOLEAN_CODES).toEqual(['CS4664', 'MATH3414', 'MATH4445']);
    expect(CONDITIONAL_APPLICABILITY_CODES).toEqual(['ENGE4735', 'ENGE4736']);
    expect(UNIDENTIFIED_PREREQUISITE_CODES).toEqual(['MUS3065', 'MUS3066']);
    expect(summarizeVirginiaTechRemainingPrerequisites(candidates)).toEqual({
      contract: 'virginia_tech_remaining_prerequisite_exact_receipts_v1',
      target_count: 12,
      safe_delta: 5,
      safe_codes: ['COMM2004', 'COMM2014', 'CS1114', 'CS4784', 'ENGE3900'],
      ambiguous_boolean_codes: ['CS4664', 'MATH3414', 'MATH4445'],
      conditional_applicability_codes: ['ENGE4735', 'ENGE4736'],
      new_official_prerequisite_identity_codes: ['MUS3065', 'MUS3066'],
      exact_receipt_failures: [],
    });
  });

  it('binds every complete candidate/source object and every retained official response byte', () => {
    const checkedResponses = new Set();
    for (const code of TARGET_CODES) {
      const candidate = byCode.get(code);
      expect(candidate).toBeTruthy();
      expect(canonicalSha256(candidate)).toBe(EXACT_CANDIDATE_SHA256[code]);
      expect(canonicalSha256(candidate.source)).toBe(EXACT_SOURCE_SHA256[code]);
      expect(sha256(candidate.source.raw_entry_text)).toBe(candidate.source.raw_entry_sha256);
      if (checkedResponses.has(candidate.source.source_response_sha256)) continue;
      checkedResponses.add(candidate.source.source_response_sha256);
      const bytes = fs.readFileSync(path.join(
        SERVER_ROOT,
        '.va-catalogs',
        candidate.source.cache_path,
      ));
      expect(bytes).toHaveLength(candidate.source.source_response_bytes);
      expect(sha256(bytes)).toBe(candidate.source.source_response_sha256);
    }
    expect(checkedResponses).toHaveLength(5);
  });

  it('preserves both exact sophomore-standing requirements as typed non-course conditions', () => {
    for (const code of ['COMM2004', 'COMM2014']) {
      const result = resolution(code);
      expect(result).toMatchObject({
        applicable: true,
        ready: true,
        code,
        classification: 'safe_exact_retained_bytes',
        status: 'parsed',
        raw_requisites: EXACT_STATEMENTS[code].raw,
        issues: [],
      });
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0]).toMatchObject({
        kind: 'prerequisite',
        formula: 'paths_or__conditions_and',
        paths: [{
          all_of: [{
            type: 'non_course',
            condition: 'sophomore_standing_or_higher',
            minimum_class_standing: 'sophomore',
            required: true,
          }],
        }],
      });
      expect(result.proof).toMatchObject({
        required_content_discarded: false,
        source_or_core_content_changed: false,
      });
    }
  });

  it('preserves CS1114 as parsed corequisite-only evidence, never prerequisite-none', () => {
    const result = resolution('CS1114');
    expect(result).toMatchObject({
      applicable: true,
      ready: true,
      status: 'parsed',
      raw_requisites: 'Corequisite(s): MATH 1225',
      groups: [{
        kind: 'corequisite',
        paths: [{
          all_of: [{
            type: 'course',
            code: 'MATH1225',
            course_key: 'va:uni:9230:MATH1225',
            concurrent_allowed: true,
          }],
        }],
      }],
    });
    expect(result.status).not.toBe('none');
    expect(result.proof.complete_entry_receipt).toMatchObject({
      entry_required_requisite_marker_count: 0,
      entry_corequisite_marker_count: 1,
      same_source_positive_control: true,
    });
  });

  it('preserves CS4784 senior standing and minimum C in both ANDed courses', () => {
    const result = resolution('CS4784');
    expect(result).toMatchObject({
      applicable: true,
      ready: true,
      status: 'parsed',
      raw_requisites: EXACT_STATEMENTS.CS4784.raw,
    });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].paths).toHaveLength(1);
    expect(result.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({
        type: 'non_course',
        condition: 'senior_standing_or_higher',
        minimum_class_standing: 'senior',
        required: true,
      }),
      expect.objectContaining({
        type: 'course',
        code: 'CS3724',
        course_key: 'va:uni:9230:CS3724',
        minimum_grade: 'C',
      }),
      expect.objectContaining({
        type: 'course',
        code: 'CS3744',
        course_key: 'va:uni:9230:CS3744',
        minimum_grade: 'C',
      }),
    ]);
    expect(result.proof.modeled_statements.map((row) => row.raw)).toEqual([
      EXACT_STATEMENTS.CS4784.senior,
      EXACT_STATEMENTS.CS4784.grade,
      EXACT_STATEMENTS.CS4784.prerequisite,
    ]);
  });

  it('preserves ENGE3900 departmental approval as a required typed condition', () => {
    const result = resolution('ENGE3900');
    expect(result).toMatchObject({
      applicable: true,
      ready: true,
      status: 'parsed',
      raw_requisites: EXACT_STATEMENTS.ENGE3900.raw,
      groups: [{
        paths: [{
          all_of: [{
            type: 'non_course',
            condition: 'departmental_approval_of_3900_plan',
            authorization_kind: 'approval',
            authorization_authority: 'department',
            approval_subject: '3900 plan',
            required: true,
          }],
        }],
      }],
    });
  });

  it('does not guess precedence for the three ambiguous Boolean fields', () => {
    for (const code of AMBIGUOUS_BOOLEAN_CODES) {
      const result = resolution(code);
      expect(result).toMatchObject({
        applicable: true,
        ready: false,
        code,
        classification: 'genuinely_ambiguous_boolean_grouping',
        issues: ['ambiguous_boolean_grouping'],
        proof: {
          formula_emitted: false,
          precedence_rule_inferred: false,
        },
      });
      expect(result.groups).toBeUndefined();
      expect(result.status).not.toBe('none');
    }
  });

  it('does not flatten ENGE major-qualified branches into a universal formula', () => {
    for (const code of CONDITIONAL_APPLICABILITY_CODES) {
      const result = resolution(code);
      expect(result).toMatchObject({
        applicable: true,
        ready: false,
        code,
        classification: 'major_conditional_not_losslessly_representable',
        proof: {
          exact_corequisite_branches: [
            { course_code: 'MSE4055', applies_when_major: 'MSE' },
            { course_code: 'ISE4404', applies_when_major: 'ISE' },
          ],
          default_branch_published: false,
          prerequisite_route_to_major_mapping_published: false,
          formula_emitted: false,
          universal_corequisite_inferred: false,
        },
      });
      expect(result.groups).toBeUndefined();
    }
  });

  it('keeps both MUS rows blocked because the left OR operand names no prerequisite', () => {
    for (const code of UNIDENTIFIED_PREREQUISITE_CODES) {
      const result = resolution(code);
      expect(result).toMatchObject({
        applicable: true,
        ready: false,
        code,
        classification: 'requires_new_official_prerequisite_identity',
        issues: ['published_prerequisite_operand_unidentified'],
        proof: {
          exact_statement: { raw: EXACT_STATEMENTS[code].raw },
          connector: 'or',
          left_branch: {
            published_text: 'pre-requisite',
            prerequisite_identity_published: false,
          },
          right_branch: {
            published_text: 'permission of the instructor',
            authorization_kind: 'permission',
            authorization_authority: 'instructor',
          },
          formula_emitted: false,
          sequence_from_course_number_or_title_inferred: false,
          status_none_authorized: false,
        },
      });
      expect(result.groups).toBeUndefined();
      expect(result.status).not.toBe('none');
    }
  });

  it('fails closed for every target on identity, response, entry, or receipt mutation', () => {
    for (const code of TARGET_CODES) {
      expectFailsClosed(code, (row) => { row.school_id += 1; });
      expectFailsClosed(code, (row) => { row.course_key += 'X'; });
      expectFailsClosed(code, (row) => { row.source.source_response_sha256 = '0'.repeat(64); });
      expectFailsClosed(code, (row) => { row.source.raw_entry_text += ' '; });
      expectFailsClosed(code, (row) => {
        row.source.complete_entry_receipt.same_source_positive_control = false;
      });
      expectFailsClosed(code, (row) => { row.source.raw_entry_html_sha256 = '1'.repeat(64); });
    }
  });

  it('rejects attempts to make ambiguity or missing identity disappear by editing text alone', () => {
    for (const code of AMBIGUOUS_BOOLEAN_CODES) {
      expectFailsClosed(code, (row) => {
        row.source.structured_requisite_fields[0].raw = `(${row.source.structured_requisite_fields[0].raw})`;
      });
    }
    for (const code of UNIDENTIFIED_PREREQUISITE_CODES) {
      expectFailsClosed(code, (row) => {
        row.source.raw_entry_text = row.source.raw_entry_text.replace(
          'pre-requisite',
          code === 'MUS3066' ? 'MUS 3065' : 'MUS 2064',
        );
      });
    }
  });

  it('does not generalize beyond the exact twelve-row roster', () => {
    expect(resolveVirginiaTechRemainingPrerequisiteCandidate(
      candidatesArtifact.candidates.find((row) => row.school_id === 9230
        && row.course_code === 'CS2114'),
    )).toEqual({ applicable: false, ready: false, issues: [] });
    expect(resolveVirginiaTechRemainingPrerequisiteCandidate({
      school_id: 1,
      slug: 'not-virginia-tech',
      owner_namespace: 'va:uni:1',
      course_key: 'va:uni:1:COMM2004',
      course_code: 'COMM2004',
      source: {},
    })).toMatchObject({ applicable: true, ready: false, code: 'COMM2004' });
  });
});
