import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import reviewArtifact from '../../.va-catalogs/research/va-university-prerequisite-review.json';
import requirementsDocument from '../../.va-catalogs/requirements/virginia-polytechnic-institute-and-state-university.json';
import { extractCourseLeafEntries } from './universityPrerequisiteAcquisition';
import {
  BIT_BYTES,
  BIT_CACHE_PATH,
  BIT_METADATA_PATH,
  BIT_SHA256,
  BIT_URL,
  COURSE_CODE,
  COURSE_KEY,
  CROSS_REFERENCE,
  CURRENT_SUBJECT_IDENTITY,
  EXACT_BIT3674_CANDIDATE_SHA256,
  EXACT_BIT4624_CANDIDATE_SHA256,
  EXACT_MISSING_REVIEW_ROW_SHA256,
  PROGRAM_BYTES,
  PROGRAM_CACHE_PATH,
  PROGRAM_IDENTITY,
  PROGRAM_SHA256,
  PROGRAM_URL,
  auditVirginiaTechBit4614IdentityGap,
  canonicalSha256,
  sha256,
} from './virginiaTechBit4614IdentityGapEvidence';

const SERVER_ROOT = path.resolve(__dirname, '../..');
const PROGRAM_PATH = path.join(SERVER_ROOT, '.va-catalogs', PROGRAM_CACHE_PATH);
const BIT_PATH = path.join(SERVER_ROOT, '.va-catalogs', BIT_CACHE_PATH);
const BIT_METADATA_FILE = path.join(SERVER_ROOT, '.va-catalogs', BIT_METADATA_PATH);

const missingReviewRow = reviewArtifact.direct_review_rows.find(
  (row) => row.school_id === 9230 && row.code === COURSE_CODE,
);
const bit3674Candidate = candidatesArtifact.candidates.find(
  (row) => row.school_id === 9230 && row.course_code === 'BIT3674',
);
const bit4624Candidate = candidatesArtifact.candidates.find(
  (row) => row.school_id === 9230 && row.course_code === 'BIT4624',
);

function exactInputs() {
  return {
    missingReviewRow: structuredClone(missingReviewRow),
    requirementsDocument: structuredClone(requirementsDocument),
    programText: fs.readFileSync(PROGRAM_PATH),
    bitDepartmentHtml: fs.readFileSync(BIT_PATH),
    bitDepartmentMetadata: JSON.parse(fs.readFileSync(BIT_METADATA_FILE, 'utf8')),
    bit3674Candidate: structuredClone(bit3674Candidate),
    bit4624Candidate: structuredClone(bit4624Candidate),
  };
}

function changedResult(mutate) {
  const inputs = exactInputs();
  mutate(inputs);
  return auditVirginiaTechBit4614IdentityGap(inputs);
}

describe('Virginia Tech BIT4614 exact current-source identity gap', () => {
  it('is the sole missing direct university prerequisite row', () => {
    const missing = reviewArtifact.direct_review_rows.filter((row) => row.status === 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0]).toEqual(missingReviewRow);
    expect(missingReviewRow).toMatchObject({
      school_id: 9230,
      slug: 'virginia-polytechnic-institute-and-state-university',
      owner_namespace: 'va:uni:9230',
      course_key: COURSE_KEY,
      code: COURSE_CODE,
      status: 'missing',
      source: null,
      groups: [],
      review_status: 'not_promoted',
      review_reason: 'direct_code_not_present_as_exact_token_in_cached_source',
    });
    expect(canonicalSha256(missingReviewRow)).toBe(EXACT_MISSING_REVIEW_ROW_SHA256);
  });

  it('binds the exact official 2026-2027 BSCS source that names BIT4614 three times', () => {
    const bytes = fs.readFileSync(PROGRAM_PATH);
    expect(bytes).toHaveLength(PROGRAM_BYTES);
    expect(sha256(bytes)).toBe(PROGRAM_SHA256);
    const text = bytes.toString('utf8');
    expect(text.split('2026-2027 Academic Catalog')).toHaveLength(3);
    expect(text.split(PROGRAM_IDENTITY.exact_compact_text)).toHaveLength(4);
    expect(text.split(PROGRAM_IDENTITY.displayed_code)).toHaveLength(4);
    expect(text).not.toContain(CURRENT_SUBJECT_IDENTITY.displayed_code);
    expect(requirementsDocument).toMatchObject({
      slug: 'virginia-polytechnic-institute-and-state-university',
      catalog_year: '2026-2027',
      source_url: PROGRAM_URL,
      sources: expect.arrayContaining([expect.objectContaining({
        id: 'major',
        role: 'program',
        url: PROGRAM_URL,
        sha256: PROGRAM_SHA256,
        official: true,
        secure: true,
      })]),
    });
  });

  it('replays the exact current BIT subject page: BIT3674 exists and BIT4614 does not', () => {
    const bytes = fs.readFileSync(BIT_PATH);
    expect(bytes).toHaveLength(BIT_BYTES);
    expect(sha256(bytes)).toBe(BIT_SHA256);
    const metadata = JSON.parse(fs.readFileSync(BIT_METADATA_FILE, 'utf8'));
    expect(metadata).toMatchObject({
      requested_url: BIT_URL,
      final_url: BIT_URL,
      capture_status: 'official_browser_document_captured',
      byte_length: BIT_BYTES,
      content_sha256: BIT_SHA256,
      browser_challenge_receipt: {
        exact_same_url: true,
        document_response_count: 2,
        document_responses: [
          { http_status: 202 },
          { http_status: 200, url: BIT_URL, content_sha256: BIT_SHA256 },
        ],
      },
      robots_receipt: {
        path_allowed: true,
      },
    });

    const extracted = extractCourseLeafEntries(bytes, ['BIT3674', 'BIT4614', 'BIT4624']);
    expect(extracted).toMatchObject({
      missing: ['BIT4614'],
      ambiguous: [],
      courseblock_count: 44,
      complete_entry_count: 44,
      complete_entries_with_required_requisite_marker_count: 31,
    });
    expect(extracted.entries.find((row) => row.course_code === 'BIT3674')).toMatchObject({
      courseblock_index: CURRENT_SUBJECT_IDENTITY.courseblock_index,
      raw_entry_sha256: CURRENT_SUBJECT_IDENTITY.raw_entry_sha256,
      raw_entry_text: expect.stringMatching(
        /^BIT 3674 - Cybersecurity Management II \(3 credits\)/,
      ),
      structured_requisite_fields: [{
        kind: 'prerequisite',
        raw: CURRENT_SUBJECT_IDENTITY.exact_prerequisite,
      }],
    });
    expect(extracted.entries.find((row) => row.course_code === 'BIT4624')).toMatchObject({
      courseblock_index: CROSS_REFERENCE.courseblock_index,
      raw_entry_sha256: CROSS_REFERENCE.raw_entry_sha256,
      structured_requisite_fields: [{
        kind: 'prerequisite',
        raw: CROSS_REFERENCE.exact_prerequisite,
      }],
    });
  });

  it('binds the same exact candidates and treats prerequisite references as non-entry controls', () => {
    expect(canonicalSha256(bit3674Candidate)).toBe(EXACT_BIT3674_CANDIDATE_SHA256);
    expect(canonicalSha256(bit4624Candidate)).toBe(EXACT_BIT4624_CANDIDATE_SHA256);
    expect(bit3674Candidate.source.source_response_sha256).toBe(BIT_SHA256);
    expect(bit4624Candidate.source.source_response_sha256).toBe(BIT_SHA256);
    expect(bit4624Candidate.source.structured_requisite_fields[0].raw)
      .toContain('BIT 4614');
    const extracted = extractCourseLeafEntries(
      fs.readFileSync(BIT_PATH),
      ['BIT4614'],
    );
    expect(extracted.entries).toEqual([]);
    expect(extracted.missing).toEqual(['BIT4614']);
  });

  it('verifies the conflict but refuses a title-only substitution or historical formula', () => {
    const result = auditVirginiaTechBit4614IdentityGap(exactInputs());
    expect(result).toEqual({
      applicable: true,
      verified: true,
      ready: false,
      course_code: COURSE_CODE,
      course_key: COURSE_KEY,
      issues: ['authoritative_current_source_identity_conflict'],
      classification: 'authoritative_current_source_identity_conflict',
      evidence: {
        contract: 'virginia_tech_bit4614_current_source_identity_conflict_v1',
        catalog_year: '2026-2027',
        program_source: {
          url: PROGRAM_URL,
          cache_path: PROGRAM_CACHE_PATH,
          sha256: PROGRAM_SHA256,
          bytes: PROGRAM_BYTES,
          identity: PROGRAM_IDENTITY,
        },
        current_bit_subject_source: {
          url: BIT_URL,
          cache_path: BIT_CACHE_PATH,
          metadata_path: BIT_METADATA_PATH,
          sha256: BIT_SHA256,
          bytes: BIT_BYTES,
          courseblock_count: 44,
          complete_entry_count: 44,
          required_requisite_entry_count: 31,
          exact_bit4614_courseblock_count: 0,
          exact_bit3674_courseblock_count: 1,
          current_same_title_entry: CURRENT_SUBJECT_IDENTITY,
          plain_text_bit4614_reference_count: 3,
          cross_reference_control: CROSS_REFERENCE,
        },
      },
      disposition: {
        missing_direct_row_remains: true,
        prerequisite_formula_emitted: false,
        status_none_authorized: false,
        bit3674_substitution_authorized: false,
        title_only_identity_inference_authorized: false,
        historical_bit4614_formula_authorized: false,
        verified_major_core_changed: false,
        sufficient_resolution_evidence: [
          'a corrected current 2026-2027 BSCS program page naming BIT3674',
          'an explicit current registrar crosswalk binding BIT4614 to BIT3674 with an effective catalog term',
          'a complete current BIT4614 course entry',
        ],
        inference_boundary: expect.stringContaining(
          'matching title and residual prerequisite references make a renumbering/editorial error plausible',
        ),
      },
    });
    expect(result.groups).toBeUndefined();
    expect(result.status).not.toBe('none');
  });

  it.each([
    ['missing row identity', (input) => { input.missingReviewRow.course_key += 'X'; }],
    ['missing row disposition', (input) => { input.missingReviewRow.status = 'none'; }],
    ['program source hash', (input) => {
      input.requirementsDocument.sources.find((row) => row.id === 'major').sha256 = '0'.repeat(64);
    }],
    ['program source bytes', (input) => {
      input.programText = Buffer.from(input.programText.toString().replace('BIT 4614', 'BIT 3674'));
    }],
    ['BIT response bytes', (input) => {
      input.bitDepartmentHtml = Buffer.concat([input.bitDepartmentHtml, Buffer.from(' ')]);
    }],
    ['BIT response receipt', (input) => {
      input.bitDepartmentMetadata.content_sha256 = '0'.repeat(64);
    }],
    ['BIT3674 identity', (input) => {
      input.bit3674Candidate.source.raw_entry_text = input.bit3674Candidate.source.raw_entry_text
        .replace('BIT 3674', 'BIT 4614');
    }],
    ['BIT4624 cross-reference', (input) => {
      input.bit4624Candidate.source.structured_requisite_fields[0].raw =
        'BIT 3674 or CS 4264';
    }],
  ])('fails closed when the exact %s changes', (label, mutate) => {
    expect(changedResult(mutate)).toMatchObject({
      applicable: true,
      verified: false,
      ready: false,
      course_code: COURSE_CODE,
      classification: 'exact_identity_gap_receipt_changed',
    });
  });
});
