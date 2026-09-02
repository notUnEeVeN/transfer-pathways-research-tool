import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/virginia-commonwealth-university-transfer-policy-evidence.json';
import {
  POLICY_URL,
  buildVcuTransferPolicyEvidence,
  parseVcuTransferPolicy,
} from './vcuTransferPolicyEvidence';

const ROOT = path.resolve(__dirname, '../..');
const PAGE = path.join(
  ROOT,
  '.va-catalogs/pages/virginia-commonwealth-university__transfer_admission.html',
);
const ROBOTS = path.join(
  ROOT,
  '.va-catalogs/pages/virginia-commonwealth-university__bulletin_robots.txt',
);

function rebuild(html = fs.readFileSync(PAGE, 'utf8'), robots = fs.readFileSync(ROBOTS, 'utf8')) {
  return buildVcuTransferPolicyEvidence(html, {
    requestedUrl: POLICY_URL,
    finalUrl: POLICY_URL,
    contentType: evidence.source.content_type,
    robotsText: robots,
    robotsStatus: 200,
    capturedAt: null,
  });
}

describe('VCU transfer-pathway policy evidence', () => {
  it('rebuilds the checked-in artifact from the retained official response', () => {
    expect(rebuild()).toEqual(evidence);
    expect(evidence).toMatchObject({
      verified: true,
      policy_facts_sha256: '19f6d869fc73c6f5596cad3705450ff003e66393db11b151227f058ca675bce6',
      policy_facts: {
        accepted_transfer_credit: {
          contributes_to_hours_earned: true,
          contributes_toward_degree_requirements: true,
        },
        transfer_ceiling: { maximum_units: 90 },
        residency: {
          degree_fraction_minimum: 0.25,
          degree_units_minimum_at_120: 30,
          final_window_units: 45,
          final_window_resident_units_minimum: 30,
          major_external_course_fraction_maximum: 0.5,
        },
        transfer_degree_general_education: {
          qualifying_awards: ['AA', 'AS', 'AA&S', 'AFA', 'bachelors'],
          lower_division_general_education_met: true,
        },
      },
      paper_interpretation: {
        incoming_award: 'AS',
        award_earned_before_vcu_enrollment: true,
        lower_division_connected_category_distribution_waived: true,
        accepted_transfer_units_may_apply_to_degree_hours: true,
        maximum_transfer_units: 90,
        figure_3_4_exact_for_qualifying_as: true,
        figure_6_connected_course_identity_increment: 0,
      },
    });
  });

  it.each([
    ['award wording', 'transfer-oriented associate degree (A.A., A.S., or A.A.&amp; S.)', 'transfer-oriented associate degree'],
    ['90-credit ceiling', 'A maximum of 90 total undergraduate', 'A maximum of 91 total undergraduate'],
    ['degree-hours application', 'Accepted transfer credit contributes to hours earned', 'Accepted transfer credit may contribute to hours earned'],
    ['residency floor', 'Completion of at least 25 percent', 'Completion of at least 24 percent'],
    ['final window', 'at least 30 of the last 45', 'at least 29 of the last 45'],
    ['major fraction', 'No more than half (50 percent)', 'No more than 60 percent'],
  ])('fails closed when the official %s changes', (_label, before, after) => {
    const html = fs.readFileSync(PAGE, 'utf8').replace(before, after);
    expect(() => rebuild(html)).toThrow(/did not verify/);
  });

  it('fails closed when robots disallows the exact policy path', () => {
    const parsed = parseVcuTransferPolicy(fs.readFileSync(PAGE, 'utf8'), {
      requestedUrl: POLICY_URL,
      finalUrl: POLICY_URL,
      contentType: evidence.source.content_type,
      robotsText: 'User-agent: *\nDisallow: /undergraduate/\n',
      robotsStatus: 200,
    });
    expect(parsed.verified).toBe(false);
    expect(parsed.issues).toContain('robots_policy');
  });
});
