import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import reviewArtifact from '../../.va-catalogs/research/va-university-prerequisite-review.json';
import {
  extractCourseLeafEntries,
} from './universityPrerequisiteAcquisition';
import {
  extractRequiredClauses,
  reviewCandidate,
} from './universityPrerequisiteReview';
import {
  CONTRACT,
  OWNER,
  PAGE,
  REACQUIRE_CODES,
  RECEIPTS,
  REVIEW_REASON,
  TARGET_CODES,
  expectedCompleteEntryReceipt,
  resolutionRowIssues,
  resolveGeorgeMasonPrerequisiteSilence,
  sha256,
} from './georgeMasonPrerequisiteSilenceEvidence';

const ROOT = path.resolve(__dirname, '../..');
const candidateByCode = new Map(candidatesArtifact.candidates.filter((row) => (
  row.owner_namespace === OWNER && TARGET_CODES.includes(row.course_code)
)).map((row) => [row.course_code, row]));

function resolve(candidate) {
  return resolveGeorgeMasonPrerequisiteSilence(
    candidate,
    extractRequiredClauses(candidate).clauses,
  );
}

describe('exact George Mason required-requisite silence evidence', () => {
  it('binds the fixed 15-row inventory to complete official CourseLeaf blocks', () => {
    expect(TARGET_CODES).toEqual([
      'BIOL102', 'BIOL103', 'BIOL105', 'BIOL106', 'BIOL107', 'CHEM211',
      'CS108', 'CS110', 'ECE511', 'ENGH100', 'ENGH101', 'ENGH388',
      'GEOL102', 'PHIL371', 'PHIL376',
    ]);
    expect(candidateByCode.size).toBe(15);
    for (const [pageId, source] of Object.entries(PAGE)) {
      const pageCodes = TARGET_CODES.filter((code) => RECEIPTS[code].page === pageId);
      const bytes = fs.readFileSync(path.join(ROOT, '.va-catalogs', source.cache_path));
      expect(sha256(bytes)).toBe(source.source_response_sha256);
      expect(bytes.length).toBe(source.source_response_bytes);
      const metadata = JSON.parse(fs.readFileSync(
        path.join(ROOT, '.va-catalogs', source.cache_path.replace(/\.html$/, '.json')),
        'utf8',
      ));
      expect(metadata).toMatchObject({
        requested_url: source.official_url,
        final_url: source.official_url,
        http_status: 200,
        content_sha256: source.source_response_sha256,
        byte_length: source.source_response_bytes,
      });
      const extracted = extractCourseLeafEntries(bytes, pageCodes);
      expect(extracted).toMatchObject({
        missing: [],
        ambiguous: [],
        courseblock_count: source.source_courseblock_count,
        complete_entry_count: source.source_complete_entry_count,
        complete_entries_with_required_requisite_marker_count:
          source.source_positive_control_count,
      });
      for (const code of pageCodes) {
        const expected = RECEIPTS[code];
        expect(extracted.entries.find((row) => row.course_code === code)).toMatchObject({
          courseblock_index: expected.courseblock_index,
          raw_entry_sha256: expected.raw_entry_sha256,
          raw_entry_html_sha256: expected.raw_entry_html_sha256,
          published_units: expected.published_units,
          complete_entry_receipt: expectedCompleteEntryReceipt(code),
          structured_requisite_fields: [],
        });
      }
    }
  });

  it('uses acquired exact CS blocks instead of the weaker retained-text boundaries', () => {
    for (const code of REACQUIRE_CODES) {
      expect(candidateByCode.get(code)?.source).toMatchObject({
        capture_origin: 'official_acquisition',
        source_format: 'courseleaf_courseblock',
        boundary_contract: 'unique_courseblock_exact_leading_code_with_published_units',
        source_response_sha256: PAGE.cs.source_response_sha256,
        raw_entry_sha256: RECEIPTS[code].raw_entry_sha256,
        raw_entry_html_sha256: RECEIPTS[code].raw_entry_html_sha256,
        complete_entry_receipt: expectedCompleteEntryReceipt(code),
      });
    }
  });

  it('promotes all 15 only in the required prerequisite/corequisite dimension', () => {
    let signalCount = 0;
    for (const code of TARGET_CODES) {
      const candidate = candidateByCode.get(code);
      expect(extractRequiredClauses(candidate).clauses).toEqual([]);
      const resolved = resolve(candidate);
      expect(resolved).toMatchObject({
        applicable: true,
        ready: true,
        issues: [],
        review_reason: REVIEW_REASON,
        structural_none_evidence: {
          contract: CONTRACT,
          literal_none_statement: false,
          finding: 'no_required_prerequisite_or_corequisite_label_in_complete_entry',
          formal_required_label_audit: {
            required_prerequisite_or_corequisite_label_count: 0,
            unqualified_prerequisite_or_corequisite_label_count: 0,
            same_response_positive_control_count: expect.any(Number),
          },
          content_accounting: {
            every_reviewed_nonrequired_signal_marker_accounted_for: true,
            source_content_discarded: false,
          },
        },
      });
      expect(resolved.ignored_nonrequired_requisites)
        .toHaveLength(RECEIPTS[code].signals.length);
      signalCount += resolved.ignored_nonrequired_requisites.length;
      for (const signal of resolved.ignored_nonrequired_requisites) {
        expect(signal.required_prerequisite_graph_edge_emitted).toBe(false);
        expect(candidate.source.raw_entry_text.slice(
          signal.relative_start, signal.relative_end,
        )).toBe(signal.raw);
        expect(sha256(signal.raw)).toBe(signal.raw_sha256);
      }
      const reviewed = reviewCandidate(candidate);
      expect(reviewed).toMatchObject({
        status: 'none',
        raw_requisites: null,
        groups: [],
        review_status: 'promoted_structural_none',
        review_reason: REVIEW_REASON,
        ignored_nonrequired_requisites: resolved.ignored_nonrequired_requisites,
        structural_none_evidence: resolved.structural_none_evidence,
      });
      expect(resolutionRowIssues(reviewed)).toEqual([]);
    }
    expect(signalCount).toBe(48);
  });

  it('retains recommendations, corequisite advice, grade, anti-credit, and enrollment signals', () => {
    const rows = TARGET_CODES.flatMap((code) => resolve(candidateByCode.get(code))
      .ignored_nonrequired_requisites);
    const kinds = new Set(rows.map((row) => row.kind));
    expect(kinds).toEqual(new Set([
      'academic_program_recommendation',
      'anti_credit_restriction',
      'anti_requisite',
      'attempt_limit',
      'attribute_enrollment_restriction',
      'audience_background_note',
      'audience_eligibility_note',
      'class_enrollment_restriction',
      'college_enrollment_restriction',
      'concurrent_sequence_advice',
      'course_equivalence_note',
      'degree_enrollment_restriction',
      'degree_minimum_grade_note',
      'degree_timing_requirement',
      'level_enrollment_restriction',
      'outbound_prerequisite_note',
      'program_enrollment_restriction',
      'recommended_corequisite',
      'recommended_prerequisite',
      'registration_restriction',
      'repeat_credit_restriction',
      'strong_course_sequence_recommendation',
    ]));
    expect(rows.find((row) => row.kind === 'outbound_prerequisite_note')).toMatchObject({
      raw: 'CHEM 211 is a prerequisite to CHEM 212.',
      required_prerequisite_graph_edge_emitted: false,
    });
    expect(rows.find((row) => row.kind === 'recommended_corequisite')).toBeTruthy();
  });

  it.each([
    ['response hash', (row) => { row.source.source_response_sha256 = '0'.repeat(64); }],
    ['entry boundary', (row) => { row.source.courseblock_index += 1; }],
    ['entry HTML', (row) => { row.source.raw_entry_html_sha256 = '0'.repeat(64); }],
    ['marker population', (row) => {
      row.source.complete_entry_receipt
        .source_complete_entries_with_required_requisite_marker_count -= 1;
    }],
    ['nonrequired wording', (row) => {
      row.source.raw_entry_text = row.source.raw_entry_text.replace(
        'Recommended Prerequisite:', 'Required Prerequisite:',
      );
      row.source.raw_entry_sha256 = sha256(row.source.raw_entry_text);
      row.source.character_end = row.source.raw_entry_text.length;
    }],
    ['invented required clause', (row, clauses) => {
      clauses.push({ kind: 'prerequisite', raw: 'ENGH 302' });
    }],
  ])('fails closed when the exact %s changes', (label, mutate) => {
    const candidate = structuredClone(candidateByCode.get('ENGH388'));
    const clauses = extractRequiredClauses(candidate).clauses;
    mutate(candidate, clauses);
    const resolved = resolveGeorgeMasonPrerequisiteSilence(candidate, clauses);
    expect(resolved).toMatchObject({
      applicable: true,
      ready: false,
      review_reason: 'gmu_exact_required_requisite_silence_receipt_changed',
    });
    expect(resolved.issues.length).toBeGreaterThan(0);
  });

  it('rejects publication-row tampering that drops or reclassifies a preserved signal', () => {
    const original = reviewArtifact.direct_review_rows.find((row) => (
      row.owner_namespace === OWNER && row.code === 'ECE511'
    ));
    expect(resolutionRowIssues(original)).toEqual([]);
    const dropped = structuredClone(original);
    dropped.ignored_nonrequired_requisites.pop();
    expect(resolutionRowIssues(dropped)).toContain('nonrequired_signals');
    const emitted = structuredClone(original);
    emitted.ignored_nonrequired_requisites[0]
      .required_prerequisite_graph_edge_emitted = true;
    expect(resolutionRowIssues(emitted)).toContain('nonrequired_signals');
    const relabeled = structuredClone(original);
    relabeled.structural_none_evidence.literal_none_statement = true;
    expect(resolutionRowIssues(relabeled)).toContain('structural_none_evidence');
  });
});
