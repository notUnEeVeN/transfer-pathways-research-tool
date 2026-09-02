import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PAGES,
  ROWS,
  SAFE_CODES,
  SLUG,
  TARGET_CODES,
  WEAK_CODES,
  WEAK_TEXT_CACHE_PATH,
  WEAK_TEXT_SHA256,
  buildVcuPrerequisiteControlFromCandidates,
  resolveVcuPrerequisiteCandidate,
} from './vcuPrerequisiteClosureEvidence';
import { extractCourseLeafEntries } from './universityPrerequisiteAcquisition';

const CACHE = path.resolve(__dirname, '../../.va-catalogs');
const CANDIDATES_PATH = path.join(
  CACHE, 'research/va-university-prerequisite-candidates.json',
);
const REVIEW_PATH = path.join(
  CACHE, 'research/va-university-prerequisite-review.json',
);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));

function inputs() {
  const artifact = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
  const review = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
  const candidates = artifact.candidates.filter((row) => row.slug === SLUG);
  const clausesByCode = new Map(review.review_rows.filter((row) => row.slug === SLUG)
    .map((row) => [row.code, row.review_evidence?.clauses || []]));
  return { candidates, clausesByCode };
}

describe('VCU exact prerequisite closure evidence', () => {
  it('replays every exact CourseLeaf boundary and same-response marker control from bytes', () => {
    for (const [pageKey, page] of Object.entries(PAGES)) {
      const bytes = fs.readFileSync(path.join(CACHE, page.cache_path));
      expect(bytes).toHaveLength(page.source_response_bytes);
      expect(sha256(bytes)).toBe(page.source_response_sha256);
      const codes = Object.entries(ROWS).filter(([, row]) => row.page === pageKey)
        .map(([code]) => code);
      const extracted = extractCourseLeafEntries(bytes.toString('utf8'), codes);
      expect(extracted).toMatchObject({
        ambiguous: [],
        missing: [],
        courseblock_count: page.source_courseblock_count,
        complete_entry_count: page.source_complete_entry_count,
        complete_entries_with_required_requisite_marker_count: page.source_positive_count,
      });
      for (const entry of extracted.entries) {
        const expected = ROWS[entry.course_code];
        expect(entry).toMatchObject({
          courseblock_index: expected.courseblock_index,
          raw_entry_sha256: expected.raw_entry_sha256,
          raw_entry_html_sha256: expected.raw_entry_html_sha256,
          published_units: expected.units,
          complete_entry_receipt: {
            same_source_positive_control: true,
          },
        });
      }
    }
  });

  it('keeps the three normalized-text CMSC rows distinct from exact source receipts', () => {
    const bytes = fs.readFileSync(path.join(CACHE, WEAK_TEXT_CACHE_PATH));
    expect(sha256(bytes)).toBe(WEAK_TEXT_SHA256);
    expect(WEAK_CODES).toEqual(['CMSC235', 'CMSC254', 'CMSC492']);
    const { candidates } = inputs();
    for (const code of WEAK_CODES) {
      const candidate = candidates.find((row) => row.course_code === code);
      expect(candidate.source).toMatchObject({ capture_origin: 'retained_catalog_text' });
      expect(candidate.source).not.toHaveProperty('source_response_sha256');
      expect(candidate.source).not.toHaveProperty('raw_entry_html_sha256');
      expect(candidate.source).not.toHaveProperty('complete_entry_receipt');
    }
  });

  it('accounts for all 18 rows and promotes only seven exact structural-none entries', () => {
    const { candidates, clausesByCode } = inputs();
    const control = buildVcuPrerequisiteControlFromCandidates(candidates);
    expect(control).toMatchObject({ verified: true, issues: [] });
    expect(control.receipt).toMatchObject({
      target_codes: TARGET_CODES,
      weak_retained_text_codes: WEAK_CODES,
      safe_structural_none_codes: SAFE_CODES,
    });
    expect(SAFE_CODES).toEqual([
      'ECON205', 'ECON210', 'UNIV111',
      'CMSC210', 'ECON203', 'MATH129', 'MATH131',
    ]);
    const resolutions = Object.fromEntries(TARGET_CODES.map((code) => [
      code,
      resolveVcuPrerequisiteCandidate(
        candidates.find((row) => row.course_code === code),
        clausesByCode.get(code),
        control,
      ),
    ]));
    expect(Object.entries(resolutions).filter(([, row]) => row.ready)
      .map(([code]) => code)).toEqual(SAFE_CODES);
    for (const code of SAFE_CODES) {
      expect(resolutions[code]).toMatchObject({
        applicable: true,
        ready: true,
        status: 'none',
        review_status: 'promoted_structural_none',
        structural_none_evidence: {
          literal_none_statement: false,
          content_accounting: { source_content_discarded: false },
        },
      });
    }
  });

  it('retains every weak-source, enrollment, Boolean, and other non-course blocker', () => {
    const { candidates, clausesByCode } = inputs();
    const control = buildVcuPrerequisiteControlFromCandidates(candidates);
    const expected = {
      CMSC235: ['vcu_retained_text_without_exact_official_courseblock_receipt', []],
      CMSC254: ['vcu_retained_text_without_exact_official_courseblock_receipt',
        ['program_enrollment_restriction', 'mutual_credit_exclusion']],
      CMSC492: ['vcu_retained_text_without_exact_official_courseblock_receipt',
        ['class_standing_and_department_credit_condition',
          'instructor_and_department_permission_condition']],
      ENGR395: ['vcu_enrollment_condition_requires_explicit_figure6_model',
        ['program_enrollment_restriction', 'descriptive_internship_requirements_phrase']],
      HONR230: ['vcu_enrollment_condition_requires_explicit_figure6_model',
        ['honors_attribute_enrollment_restriction']],
      HONR240: ['vcu_enrollment_condition_requires_explicit_figure6_model',
        ['honors_attribute_enrollment_restriction']],
      UNIV101: ['vcu_enrollment_condition_requires_explicit_figure6_model',
        ['class_enrollment_restriction']],
      UNIV191: ['vcu_enrollment_condition_requires_explicit_figure6_model',
        ['class_enrollment_restriction', 'repeat_credit_limit']],
      CLSE101: ['vcu_enrollment_condition_requires_explicit_figure6_model',
        ['program_and_class_enrollment_prerequisite']],
      EGRB102: ['vcu_implicit_comma_boolean_formula_not_source_grouped',
        ['required_prerequisite_boolean_text']],
      EGRE101: ['vcu_enrollment_condition_requires_explicit_figure6_model',
        ['program_enrollment_restriction']],
    };
    for (const [code, [reason, kinds]] of Object.entries(expected)) {
      const candidate = candidates.find((row) => row.course_code === code);
      const result = resolveVcuPrerequisiteCandidate(
        candidate, clausesByCode.get(code), control,
      );
      expect(result).toMatchObject({
        applicable: true, ready: false, issues: [], review_reason: reason,
      });
      expect(result.retained_non_prerequisite_signals.map((row) => row.kind)).toEqual(kinds);
      for (const retained of result.retained_non_prerequisite_signals) {
        expect(candidate.source.raw_entry_text.slice(
          retained.relative_start, retained.relative_end,
        )).toBe(retained.raw);
      }
    }
  });

  it('fails closed on response, entry, clause, signal, or control drift', () => {
    const { candidates, clausesByCode } = inputs();
    const control = buildVcuPrerequisiteControlFromCandidates(candidates);
    const safe = candidates.find((row) => row.course_code === 'ECON205');
    for (const mutate of [
      (row) => { row.source.source_response_sha256 = '0'.repeat(64); },
      (row) => { row.source.raw_entry_text += ' Prerequisite: ECON 203.'; },
      (row) => { row.source.raw_entry_html_sha256 = '0'.repeat(64); },
      (row) => { row.source.complete_entry_receipt.same_source_positive_control = false; },
    ]) {
      const changed = clone(safe);
      mutate(changed);
      expect(resolveVcuPrerequisiteCandidate(
        changed, clausesByCode.get('ECON205'), control,
      )).toMatchObject({ applicable: true, ready: false, review_reason:
        'vcu_exact_prerequisite_closure_receipt_changed' });
    }
    const formula = candidates.find((row) => row.course_code === 'EGRB102');
    expect(resolveVcuPrerequisiteCandidate(formula, [{
      ...clausesByCode.get('EGRB102')[0], raw: 'MATH 151 or MATH 200',
    }], control)).toMatchObject({
      applicable: true, ready: false,
      review_reason: 'vcu_exact_prerequisite_closure_receipt_changed',
    });
    const changedControl = clone(control);
    changedControl.receipt.entries.ECON205.disposition = 'blocked';
    expect(resolveVcuPrerequisiteCandidate(
      safe, clausesByCode.get('ECON205'), changedControl,
    )).toMatchObject({ applicable: true, ready: false });
  });

  it('does not broaden the finite resolver to neighboring VCU entries', () => {
    const { candidates, clausesByCode } = inputs();
    const control = buildVcuPrerequisiteControlFromCandidates(candidates);
    const neighbor = candidates.find((row) => row.course_code === 'ECON211');
    expect(resolveVcuPrerequisiteCandidate(
      neighbor, clausesByCode.get('ECON211'), control,
    )).toEqual({ applicable: false, ready: false, issues: [] });
  });
});
