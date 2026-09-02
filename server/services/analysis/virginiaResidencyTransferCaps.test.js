import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const {
  ACTIVE_VA_RESIDENCY_POLICY_IDS,
  deriveVirginiaTransferCaps,
  evaluateVirginiaResidencyTransferPolicy,
  sourcePolicyId,
} = cjs('./virginiaResidencyTransferCaps');
const { cachedAcceptedSourcePlan } = cjs('../../scripts/importVirginiaCatalogDegrees');

function activeBachelorDocuments() {
  const active = new Set(ACTIVE_VA_RESIDENCY_POLICY_IDS);
  return cachedAcceptedSourcePlan().documents
    .filter((doc) => doc.kind === 'degree' && active.has(sourcePolicyId(doc)))
    .sort((a, b) => sourcePolicyId(a).localeCompare(sourcePolicyId(b)));
}

function byId(id) {
  return activeBachelorDocuments().find((doc) => sourcePolicyId(doc) === id);
}

describe('Virginia residency and two-year transfer caps', () => {
  it('inventories every active bachelor policy and supports only fully executable rules', () => {
    const reports = activeBachelorDocuments().map(evaluateVirginiaResidencyTransferPolicy);
    expect(reports).toHaveLength(16);
    expect(reports.map((report) => report.source_policy_id)).toEqual(
      [...ACTIVE_VA_RESIDENCY_POLICY_IDS].sort(),
    );
    expect(reports.filter((report) => report.supported).map((report) => (
      report.source_policy_id
    ))).toEqual([
      'bridgewater-college',
      'christopher-newport-university',
      'george-mason-university',
      'james-madison-university',
      'longwood-university',
      'norfolk-state-university',
      'old-dominion-university',
      'radford-university',
      'shenandoah-university',
      'the-university-of-virginia-s-college-at-wise',
      'university-of-mary-washington',
      'virginia-commonwealth-university',
      'virginia-polytechnic-institute-and-state-university',
      'virginia-state-university',
      'william-mary',
    ]);
    expect(Object.fromEntries(reports.map((report) => [
      report.source_policy_id,
      report.effective_two_year_transfer_cap_units,
    ]))).toEqual({
      'bridgewater-college': 87,
      'christopher-newport-university': 75,
      'george-mason-university': 90,
      'james-madison-university': 60,
      'longwood-university': 90,
      'norfolk-state-university': 89,
      'old-dominion-university': 90,
      'radford-university': 90,
      'randolph-macon-college': 75,
      'shenandoah-university': 90,
      'the-university-of-virginia-s-college-at-wise': 62,
      'university-of-mary-washington': 90,
      'virginia-commonwealth-university': 90,
      'virginia-polytechnic-institute-and-state-university': 61.5,
      'virginia-state-university': null,
      'william-mary': 60,
    });
  });

  it('derives JMU two-year capacity from its exact four-year minimum', () => {
    const report = evaluateVirginiaResidencyTransferPolicy(byId('james-madison-university'));
    expect(report).toMatchObject({
      supported: true,
      degree_total_units: 120,
      residency_minimum_units: 30,
      overall_transfer_cap_units: 90,
      two_year_transfer_cap_units: 60,
      effective_two_year_transfer_cap_units: 60,
    });
  });

  it('accepts Bridgewater only through its whole-tree residence proof', () => {
    expect(evaluateVirginiaResidencyTransferPolicy(byId('bridgewater-college')))
      .toMatchObject({
        supported: true,
        evaluator: 'evaluateBridgewaterResidencyPolicy',
        effective_two_year_transfer_cap_units: 87,
        proof: { fixed_nontransferable_upper_major_units: 12 },
      });
  });

  it('accepts source-bound GMU and UMW major-residence proofs without a prose-derived cap', () => {
    expect(evaluateVirginiaResidencyTransferPolicy(byId('george-mason-university')))
      .toMatchObject({
        supported: true,
        evaluator: 'evaluateGmuResidencyPolicy',
        effective_two_year_transfer_cap_units: 90,
        proof: { fixed_nonarticulable_upper_major_units: 25 },
      });
    expect(evaluateVirginiaResidencyTransferPolicy(byId('university-of-mary-washington')))
      .toMatchObject({
        supported: true,
        evaluator: 'evaluateUmwResidencyPolicy',
        effective_two_year_transfer_cap_units: 90,
        proof: { fixed_nonarticulable_major_units: 33 },
      });
  });

  it('accepts ODU only through its exact resident-writing and upper-major carriers', () => {
    expect(evaluateVirginiaResidencyTransferPolicy(byId('old-dominion-university')))
      .toMatchObject({
        supported: true,
        evaluator: 'evaluateOduResidencyPolicy',
        overall_transfer_cap_units: 90,
        effective_two_year_transfer_cap_units: 90,
        proof: {
          resident_upper_cs_elective_units: 9,
          resident_writing_course: 'CS411W',
          resident_writing_course_units: 3,
          fixed_resident_upper_major_units: 12,
        },
      });
  });

  it('accepts VCU only through its direct transfer ceiling and exact resident-major witness', () => {
    expect(evaluateVirginiaResidencyTransferPolicy(byId('virginia-commonwealth-university')))
      .toMatchObject({
        supported: true,
        evaluator: 'evaluateVcuResidencyPolicy',
        evaluator_version: 2,
        overall_transfer_cap_units: 90,
        final_window_transfer_cap_units: 90,
        effective_two_year_transfer_cap_units: 90,
        issues: [],
        proof: {
          published_transfer_maximum_units: 90,
          accreditation_floor_declared_nonappealable: true,
          sponsored_exchange_selected: false,
          postmatriculation_external_credit_units: 0,
          military_or_arac_timing_exception_can_raise_90_credit_ceiling: false,
          major_residency: {
            ready: true,
            total_major_course_attempts: 21,
            fixed_resident_major_course_attempts: 18,
            resident_major_course_attempts_minimum: 11,
          },
        },
      });
  });

  it('keeps Virginia Tech percentage arithmetic exact at a 123-credit degree', () => {
    const report = evaluateVirginiaResidencyTransferPolicy(
      byId('virginia-polytechnic-institute-and-state-university'),
    );
    expect(report).toMatchObject({
      supported: true,
      degree_total_units: 123,
      residency_minimum_units: 31,
      residency_percentage_exact_units: 30.75,
      overall_transfer_cap_units: 92,
      final_window_transfer_cap_units: 96,
      two_year_transfer_cap_units: 61.5,
      effective_two_year_transfer_cap_units: 61.5,
    });
  });

  it('enforces every William & Mary residency dimension through its exact source/tree receipt', () => {
    const report = evaluateVirginiaResidencyTransferPolicy(byId('william-mary'));
    expect(report).toMatchObject({
      supported: true,
      evaluator: 'evaluateWmResidencyPolicy',
      overall_transfer_cap_units: 60,
      effective_two_year_transfer_cap_units: 60,
      declared_subrules: [
        'overall_residency', 'major_residency_units', 'major_course_count_fraction',
        'external_upper_major_course_maximum',
      ],
      proof: {
        resident_major_units: 27,
        resident_major_course_count_minimum: 9,
        half_major_course_count_minimum: 8,
        external_300_400_major_courses_selected: 0,
        external_300_400_major_courses_maximum: 2,
        external_upper_rule_path: 'requirement_groups[5].sections[5]',
      },
    });
    expect(report.reason).toMatch(/zero external 300\/400-level major courses/i);
  });

  it('fails closed when independently stored minimum and cap declarations disagree', () => {
    const doc = structuredClone(byId('james-madison-university'));
    doc.unit_audit.transfer_credit_units_maximum = 70;
    const report = evaluateVirginiaResidencyTransferPolicy(doc);
    expect(report.supported).toBe(false);
    expect(report.overall_transfer_cap_units).toBe(70);
    expect(report.reason).toMatch(/overall residency\/transfer cap declarations disagree/i);
  });

  it('fails closed on missing, ambiguous, or internally incomplete declarations', () => {
    expect(evaluateVirginiaResidencyTransferPolicy({
      _id: 'unknown-required-policy',
      total_units: 120,
      unit_audit: { residency: { status: 'required', minimum_units: 30 } },
    })).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/no reviewed Virginia policy profile/i),
    });

    const missingJmuField = structuredClone(byId('james-madison-university'));
    delete missingJmuField.unit_audit.four_year_institution_units_minimum;
    expect(evaluateVirginiaResidencyTransferPolicy(missingJmuField)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/requires unit_audit\.four_year_institution_units_minimum/i),
    });

    const incompleteWindow = structuredClone(byId('shenandoah-university'));
    incompleteWindow.unit_audit.final_credit_window_units = 30;
    expect(evaluateVirginiaResidencyTransferPolicy(incompleteWindow)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/requires both window and resident-minimum fields/i),
    });
  });

  it('does not derive a number from residency prose', () => {
    const base = {
      _id: 'unprofiled',
      total_units: 120,
      unit_audit: {
        residency: {
          status: 'required',
          rule: 'At least 60 credits must be earned here.',
        },
      },
    };
    const first = deriveVirginiaTransferCaps(base);
    const second = deriveVirginiaTransferCaps({
      ...base,
      unit_audit: {
        residency: { ...base.unit_audit.residency, rule: 'At least 30 credits must be earned here.' },
      },
    });
    expect(first.overall_transfer_cap_units).toBeNull();
    expect(second.overall_transfer_cap_units).toBeNull();
    expect(first.issues).toEqual(second.issues);
  });
});
