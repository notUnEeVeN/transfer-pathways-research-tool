import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  STRICT_FORMULA_REJECTION_AUDIT,
  STRICT_FORMULA_REJECTION_AUDIT_CONTRACT,
  reviewCandidate,
  strictFormulaRejectionAuditReport,
} from './universityPrerequisiteReview';

const candidates = JSON.parse(fs.readFileSync(new URL(
  '../../.va-catalogs/research/va-university-prerequisite-candidates.json',
  import.meta.url,
), 'utf8')).candidates;

function candidateFor(key) {
  const separator = key.lastIndexOf(':');
  const slug = key.slice(0, separator);
  const code = key.slice(separator + 1);
  const found = candidates.find((row) => row.slug === slug && row.course_code === code);
  if (!found) throw new Error(`missing strict-rejection audit candidate ${key}`);
  return found;
}

function reviewed(key) {
  return reviewCandidate(candidateFor(key));
}

function identities(row) {
  return row.groups[0].paths.map((route) => (
    route.all_of.map((condition) => condition.code || condition.condition)
  ));
}

describe('source-bound strict formula rejection audit', () => {
  it('covers exactly the eight prior parser rejections and promotes only five', () => {
    const keys = Object.keys(STRICT_FORMULA_REJECTION_AUDIT).sort();
    expect(keys).toHaveLength(8);
    const rows = keys.map(reviewed);
    const report = strictFormulaRejectionAuditReport(rows);
    expect(report).toMatchObject({
      receipt_contract: STRICT_FORMULA_REJECTION_AUDIT_CONTRACT,
      prior_strict_parser_rejected_rows: 8,
      audited_rows: 8,
      newly_promoted_lossless_formula_rows: 5,
      remaining_blocked_rows: 3,
      complete: true,
      promoted_keys: [
        'radford-university:MATH171',
        'the-university-of-virginia-s-college-at-wise:CSC2180',
        'virginia-commonwealth-university:BNFO201',
        'virginia-commonwealth-university:EGRE254',
        'virginia-commonwealth-university:ENGR261',
      ],
      blocked_keys: [
        'radford-university:CS322',
        'randolph-macon-college:CSCI311',
        'virginia-polytechnic-institute-and-state-university:CS3704',
      ],
    });
    expect(rows.every((row) => (
      row.strict_formula_rejection_audit.source_receipt_valid
      && row.strict_formula_rejection_audit.issues.length === 0
    ))).toBe(true);
  });

  it('retains the exact Radford MATH 171 grade/course/placement alternatives', () => {
    const row = reviewed('radford-university:MATH171');
    expect(row).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      groups: [expect.objectContaining({
        flags: expect.arrayContaining([
          'source_bound_strict_formula_rejection_audit',
          'radford_math171_nested_grade_or_placement',
        ]),
      })],
    });
    expect(identities(row)).toEqual([
      ['MATH138'],
      ['approved_college_level_precalculus_course_including_trigonometry'],
      ['passing_score_on_department_approved_mathematics_placement_exam'],
    ]);
    const [math, openCourse, placement] = row.groups[0].paths
      .map((route) => route.all_of[0]);
    expect(math).toMatchObject({ code: 'MATH138', minimum_grade: 'C' });
    expect(openCourse).toMatchObject({
      type: 'non_course', represents_course_choice: true,
      course_subject_area: 'precalculus', trigonometry_included: true,
      approval_required: true, minimum_grade: 'C',
    });
    expect(placement).toMatchObject({
      type: 'non_course', assessment_kind: 'placement_exam',
      passing_score_required: true,
      approval_authority: 'Department of Mathematics and Statistics',
    });
  });

  it('keeps UVA Wise and VCU grade scope, inherited identity, and route topology exact', () => {
    const wise = reviewed(
      'the-university-of-virginia-s-college-at-wise:CSC2180',
    );
    expect(identities(wise)).toEqual([['CSC1180', 'MTH1110']]);
    expect(wise.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'CSC1180' }),
      expect.objectContaining({
        code: 'MTH1110', minimum_grade: 'C',
        catalog_grade_scope: 'atom_local_trailing_grade_phrase',
      }),
    ]);
    expect(wise.groups[0].paths[0].all_of[0]).not.toHaveProperty('minimum_grade');

    const bioinformatics = reviewed('virginia-commonwealth-university:BNFO201');
    expect(identities(bioinformatics)).toEqual([
      ['MATH151'], ['MATH200'],
      ['recent_satisfactory_vcu_mathematics_placement_test_score'],
    ]);
    expect(bioinformatics.groups[0].paths[0].all_of[0])
      .not.toHaveProperty('minimum_grade');
    expect(bioinformatics.groups[0].paths[1].all_of[0]).toMatchObject({
      code: 'MATH200', minimum_grade: 'C', catalog_displayed_code: '200',
      inherited_subject_from_preceding_course: 'MATH',
    });
    expect(bioinformatics.groups[0].paths[2].all_of[0]).toMatchObject({
      satisfactory_score_required: true, maximum_age_years: 1,
      recency_measured_before: 'the beginning of the course',
    });

    const digitalLogic = reviewed('virginia-commonwealth-university:EGRE254');
    expect(identities(digitalLogic)).toEqual([
      ['EGRE101', 'departmental_applicability_for_egre101_route'],
      ['EGRB102', 'departmental_applicability_for_egrb102_route'],
      ['CLSE101', 'departmental_applicability_for_clse101_route'],
      ['EGMN190', 'EGMN203', 'departmental_applicability_for_egmn190_egmn203_route'],
      ['EGMN102', 'EGMN190', 'departmental_applicability_for_egmn102_egmn190_route'],
    ]);
    for (const route of digitalLogic.groups[0].paths) {
      expect(route.all_of.filter((condition) => condition.type === 'course')
        .every((condition) => condition.minimum_grade === 'C')).toBe(true);
      expect(route.all_of.at(-1)).toMatchObject({
        type: 'non_course', departmental_applicability_required: true,
        route_selection_authority: 'department',
      });
    }

    const robotics = reviewed('virginia-commonwealth-university:ENGR261');
    expect(identities(robotics)).toEqual([
      ['CLSE101', 'CMSC254'],
      ['EGMN190', 'CMSC254'],
      ['EGRB102', 'CMSC254'],
      ['EGRE101', 'CMSC254'],
      ['ENGR105', 'CMSC254'],
    ]);
    expect(robotics.groups[0].paths.flatMap((route) => route.all_of)
      .every((condition) => condition.minimum_grade === 'C')).toBe(true);
  });

  it('leaves the three non-unique/conflicting formulas blocked without graph edges', () => {
    for (const key of [
      'radford-university:CS322',
      'randolph-macon-college:CSCI311',
      'virginia-polytechnic-institute-and-state-university:CS3704',
    ]) {
      const row = reviewed(key);
      expect(row).toMatchObject({
        status: 'unparsed', review_status: 'not_promoted',
        review_reason: 'strict_formula_parser_rejected', groups: [],
        strict_formula_rejection_audit: {
          source_receipt_valid: true, issues: [],
        },
      });
      expect(row.strict_formula_rejection_audit.decision_reason).toBe(
        STRICT_FORMULA_REJECTION_AUDIT[key].decision_reason,
      );
      if (key === 'virginia-polytechnic-institute-and-state-university:CS3704') {
        expect(row.parser_error).toBe('conflicting_prerequisite_course_codes');
        expect(row.virginia_tech_recursive_prerequisite_resolution)
          .toMatchObject({
            classification: 'conflicting_source_requirements',
            integration_disposition: {
              promoted: false,
              blocker: 'conflicting_prerequisite_course_codes',
              formula_emitted: false,
            },
          });
      } else {
        expect(row.parser_error).toBe(
          STRICT_FORMULA_REJECTION_AUDIT[key].decision_reason,
        );
      }
    }
  });

  it('fails closed when a promoted entry, response, HTML, or clause receipt changes', () => {
    const key = 'virginia-commonwealth-university:BNFO201';
    for (const mutate of [
      (row) => { row.source.raw_entry_text += ' '; },
      (row) => { row.source.retained_normalized_text_sha256 = '0'.repeat(64); },
      (row) => { row.source.raw_entry_html_sha256 = '0'.repeat(64); },
      (row) => {
        row.source.raw_entry_text = row.source.raw_entry_text.replace(
          'minimum grade of C', 'minimum grade of B',
        );
      },
    ]) {
      const changed = structuredClone(candidateFor(key));
      mutate(changed);
      const row = reviewCandidate(changed);
      expect(row).toMatchObject({
        status: 'unparsed', review_status: 'not_promoted',
        review_reason: 'strict_formula_parser_rejected', groups: [],
        strict_formula_rejection_audit: { source_receipt_valid: false },
      });
      expect(row.parser_error).toMatch(/audit receipt changed/);
    }
  });
});
