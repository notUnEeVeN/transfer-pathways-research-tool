import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/radford-transfer-degree-real-evidence.json';
import {
  EXPECTED,
  POLICY_FACTS_SHA256,
  buildRadfordTransferDegreeEvidence,
  parseRadfordTransferDegreeEvidence,
  radfordTransferDegreeEvidenceIssue,
} from './radfordTransferDegreeEvidence';

const robots = 'User-agent: *\nDisallow: /_resources\n';
const transferHtml = `<!doctype html><html><head><title>${EXPECTED.transfer.title}</title></head>
<body><h1>${EXPECTED.transfer.heading}</h1><p>${EXPECTED.transfer.eligibility}</p><ul>
<li>${EXPECTED.transfer.real}</li><li>${EXPECTED.transfer.foundations_and_wi}</li>
<li>${EXPECTED.transfer.general_education}</li></ul></body></html>`;
const requirementsHtml = `<!doctype html><html><head><title>${EXPECTED.requirements.title}</title></head>
<body><h1>${EXPECTED.requirements.heading}</h1><table><tr><td>${EXPECTED.requirements.total}</td>
<td>${EXPECTED.requirements.total}</td></tr></table><p>${EXPECTED.requirements.outside_major}</p></body></html>`;
const facultyHtml = `<!doctype html><html><head><title>${EXPECTED.faculty.title}</title></head>
<body><h1>${EXPECTED.faculty.heading}</h1><p>${EXPECTED.faculty.catalog_boundary}</p>
<p>${EXPECTED.faculty.other_transfer_lead}</p><ul><li>${EXPECTED.faculty.outside_major}</li></ul></body></html>`;

const input = (overrides = {}) => ({
  transferHtml,
  requirementsHtml,
  facultyHtml,
  robotsText: robots,
  robotsStatus: 200,
  ...overrides,
});

describe('Radford completed-transfer-degree REAL evidence', () => {
  it('validates the checked official receipt and exact policy semantics', () => {
    expect(radfordTransferDegreeEvidenceIssue(evidence)).toBeNull();
    expect(evidence).toMatchObject({
      verified: true,
      policy_facts_sha256: POLICY_FACTS_SHA256,
      policy_facts: {
        catalog_boundary: { applies_to_catalogs: ['2025-2026', '2026-2027'] },
        completed_transfer_degree_waiver: {
          qualifying_awards: ['AA', 'AS', 'AAS'],
          real_areas_met: true,
          writing_intensive_met: true,
          general_education_units_met: 30,
        },
        current_real_model: {
          unique_total_units_minimum: 39,
          unique_total_units_maximum: 48,
          outside_major_units_minimum: 15,
        },
        nonqualifying_transfer_requirements: {
          completed_degree_students_excluded_by_other: true,
          outside_major_units: 15,
        },
        program_specific_major_requirements_waived: false,
      },
      paper_interpretation: {
        incoming_award: 'AS',
        outside_major_rule_met_by_completed_degree_waiver: true,
        program_specific_two_sciences_one_laboratory_waived: false,
        figure_3_4_policy_rules_exact_for_qualifying_as: true,
        figure_6_open_course_identity_rules_waived: false,
      },
    });
  });

  it('parses only the exact three-page official policy conjunction', () => {
    const parsed = parseRadfordTransferDegreeEvidence(input());
    expect(parsed).toMatchObject({
      verified: true,
      issues: [],
      policy_facts_sha256: POLICY_FACTS_SHA256,
      robots: { policy_paths_allowed: true },
    });
    expect(buildRadfordTransferDegreeEvidence(input())).toMatchObject({
      verified: true,
      paper_interpretation: {
        incoming_award: 'AS',
        general_education_units_met: 30,
      },
    });
  });

  it.each([
    ['qualifying award', 'Associate of Science (AS)', 'Associate of Applied Science (AAS)', 'transferHtml'],
    ['REAL waiver', 'REAL requirements (all 4 areas)', 'REAL requirements (three areas)', 'transferHtml'],
    ['GE quantity', '30 credits required', '29 credits required', 'transferHtml'],
    ['catalog boundary', '2025-26 or 2026-27', '2025-26 only', 'facultyHtml'],
    ['outside-major implication', 'All other transfer students', 'Some other transfer students', 'facultyHtml'],
    ['current range', '39-48 hours', '39-47 hours', 'requirementsHtml'],
  ])('fails closed when the official %s changes', (_label, before, after, key) => {
    const changed = input({ [key]: input()[key].replace(before, after) });
    expect(parseRadfordTransferDegreeEvidence(changed).verified).toBe(false);
    expect(() => buildRadfordTransferDegreeEvidence(changed)).toThrow(/did not verify/);
  });

  it('fails closed on robots or retained semantic-receipt drift', () => {
    expect(parseRadfordTransferDegreeEvidence(input({
      robotsText: 'User-agent: *\nDisallow: /academics/\n',
    }))).toMatchObject({ verified: false });

    const changed = structuredClone(evidence);
    changed.paper_interpretation.program_specific_two_sciences_one_laboratory_waived = true;
    expect(radfordTransferDegreeEvidenceIssue(changed)).toMatch(/interpretation changed/);
    const changedFacts = structuredClone(evidence);
    changedFacts.policy_facts.completed_transfer_degree_waiver.general_education_units_met = 29;
    expect(radfordTransferDegreeEvidenceIssue(changedFacts)).toMatch(/semantic policy receipt changed/);
  });
});
