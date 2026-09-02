import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import {
  extractCourseLeafEntries,
} from './universityPrerequisiteAcquisition';
import {
  extractRequiredClauses,
  reviewCandidate,
} from './universityPrerequisiteReview';
import {
  COURSE_KEY,
  NARRATIVE_STATEMENT,
  RAW_ALTERNATIVES,
  REFERENCED_COURSE_RECEIPT,
  ROBOTS_RESPONSE_SHA256,
  SOURCE_CACHE_PATH,
  SOURCE_RESPONSE_SHA256,
  SOURCE_URL,
  TARGET_RECEIPT,
  expectedGroup,
  expectedProof,
  resolutionRowIssues,
  resolveNorfolkStateCsc295Prerequisite,
  sha256,
} from './norfolkStateCsc295PrerequisiteEvidence';

const ROOT = path.resolve(__dirname, '../..');
const candidate = candidatesArtifact.candidates.find((row) => row.course_key === COURSE_KEY);

function resolution(value = candidate) {
  return resolveNorfolkStateCsc295Prerequisite(
    value,
    extractRequiredClauses(value).clauses,
  );
}

describe('exact Norfolk State CSC295 narrative prerequisite evidence', () => {
  it('binds exact official bytes and uniquely identifies Computer Programming II as CSC260', () => {
    const source = fs.readFileSync(path.join(ROOT, '.va-catalogs', SOURCE_CACHE_PATH));
    expect(sha256(source)).toBe(SOURCE_RESPONSE_SHA256);
    const metadata = JSON.parse(fs.readFileSync(
      path.join(ROOT, '.va-catalogs', SOURCE_CACHE_PATH.replace(/\.html$/, '.json')),
      'utf8',
    ));
    expect(metadata).toMatchObject({
      requested_url: SOURCE_URL,
      final_url: SOURCE_URL,
      http_status: 200,
      content_sha256: SOURCE_RESPONSE_SHA256,
      byte_length: source.length,
      robots: {
        http_status: 200,
        content_sha256: ROBOTS_RESPONSE_SHA256,
      },
    });
    const extracted = extractCourseLeafEntries(source, ['CSC260', 'CSC295']);
    expect(extracted).toMatchObject({
      missing: [],
      ambiguous: [],
      courseblock_count: 52,
      complete_entry_count: 52,
      complete_entries_with_required_requisite_marker_count: 32,
    });
    expect(extracted.entries.find((row) => row.course_code === 'CSC260')).toMatchObject({
      courseblock_index: REFERENCED_COURSE_RECEIPT.courseblock_index,
      raw_entry_sha256: REFERENCED_COURSE_RECEIPT.raw_entry_sha256,
      raw_entry_html_sha256: REFERENCED_COURSE_RECEIPT.raw_entry_html_sha256,
      raw_entry_text: expect.stringMatching(/^CSC 260 Computer Programming II \(3 Credits\)/),
    });
    expect(extracted.entries.find((row) => row.course_code === 'CSC295')).toMatchObject({
      courseblock_index: TARGET_RECEIPT.courseblock_index,
      raw_entry_sha256: TARGET_RECEIPT.raw_entry_sha256,
      raw_entry_html_sha256: TARGET_RECEIPT.raw_entry_html_sha256,
      raw_entry_text: expect.stringContaining(NARRATIVE_STATEMENT),
    });
  });

  it('preserves CSC260 OR equivalent knowledge as two distinct paths', () => {
    expect(candidate).toBeTruthy();
    expect(extractRequiredClauses(candidate).clauses).toEqual([]);
    const resolved = resolution();
    expect(resolved).toEqual({
      applicable: true,
      ready: true,
      issues: [],
      raw_requisites: NARRATIVE_STATEMENT,
      groups: [expectedGroup()],
      proof: expectedProof(),
      review_reason: 'exact_nsu_csc295_narrative_prerequisite_disjunction',
    });
    expect(resolved.groups[0]).toMatchObject({
      raw: RAW_ALTERNATIVES,
      formula: 'paths_or__conditions_and',
      paths: [{
        all_of: [{
          type: 'course',
          code: 'CSC260',
          course_key: 'va:uni:9217:CSC260',
          raw: 'Computer Programming II',
        }],
      }, {
        all_of: [{
          type: 'non_course',
          condition: 'equivalent_knowledge',
          raw: 'equivalent knowledge',
        }],
      }],
    });
    const reviewed = reviewCandidate(candidate);
    expect(reviewed).toMatchObject({
      status: 'parsed',
      raw_requisites: NARRATIVE_STATEMENT,
      groups: [expectedGroup()],
      review_status: 'promoted_strict_formula',
      review_reason: 'exact_nsu_csc295_narrative_prerequisite_disjunction',
      norfolk_state_csc295_resolution: expectedProof(),
    });
    expect(resolutionRowIssues(reviewed)).toEqual([]);
  });

  it.each([
    ['response hash', (row) => { row.source.source_response_sha256 = '0'.repeat(64); }],
    ['entry wording', (row) => {
      row.source.raw_entry_text = row.source.raw_entry_text.replace(' or ', ' and ');
      row.source.raw_entry_sha256 = sha256(row.source.raw_entry_text);
      row.source.character_end = row.source.raw_entry_text.length;
    }],
    ['entry HTML hash', (row) => { row.source.raw_entry_html_sha256 = '0'.repeat(64); }],
    ['courseblock index', (row) => { row.source.courseblock_index += 1; }],
    ['marker population', (row) => {
      row.source.complete_entry_receipt
        .source_complete_entries_with_required_requisite_marker_count -= 1;
    }],
    ['invented formal clause', (row, clauses) => {
      clauses.push({ kind: 'prerequisite', raw: RAW_ALTERNATIVES });
    }],
  ])('fails closed when the exact %s changes', (label, mutate) => {
    const changed = structuredClone(candidate);
    const clauses = extractRequiredClauses(changed).clauses;
    mutate(changed, clauses);
    expect(resolveNorfolkStateCsc295Prerequisite(changed, clauses)).toMatchObject({
      applicable: true,
      ready: false,
      review_reason: 'nsu_csc295_exact_narrative_prerequisite_receipt_changed',
    });
  });

  it.each([
    ['disjunction', (row) => { row.groups.pop(); }],
    ['course identity', (row) => {
      row.groups[0].paths[0].all_of[0].course_key = 'va:uni:9217:CSC295';
    }],
    ['typed alternative', (row) => {
      row.groups[0].paths[1].all_of[0].condition = 'waived';
    }],
    ['source proof', (row) => {
      row.norfolk_state_csc295_resolution.source_response_sha256 = '0'.repeat(64);
    }],
    ['same-page identity', (row) => {
      row.norfolk_state_csc295_resolution.same_response_course_identity.title = 'Programming';
    }],
    ['content accounting', (row) => {
      row.norfolk_state_csc295_resolution.content_accounting.source_content_discarded = true;
    }],
  ])('rejects a published row with changed %s', (label, mutate) => {
    const row = structuredClone(reviewCandidate(candidate));
    mutate(row);
    expect(resolutionRowIssues(row)).not.toEqual([]);
  });
});
