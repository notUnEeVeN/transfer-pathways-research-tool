import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/virginia-tech-transferable-associate-policy-evidence.json';
import {
  POLICY_FACTS_SHA256,
  POLICY_RESPONSE_SHA256,
  POLICY_URL,
  ROBOTS_FINAL_URL,
  ROBOTS_RESPONSE_SHA256,
  ROBOTS_URL,
  buildVirginiaTechTransferPolicyEvidence,
  parseVirginiaTechTransferPolicy,
  virginiaTechTransferPolicyEvidenceIssue,
} from './virginiaTechTransferPolicyEvidence';

const ROOT = path.resolve(__dirname, '../..');
const PAGE = path.join(
  ROOT, '.va-catalogs/research/virginia-tech-transfer-policy-sources/vccs-transfer-policy.html',
);
const ROBOTS = path.join(
  ROOT, '.va-catalogs/research/virginia-tech-transfer-policy-sources/robots.txt',
);

function rebuild(html = fs.readFileSync(PAGE, 'utf8'), robots = fs.readFileSync(ROBOTS, 'utf8')) {
  return buildVirginiaTechTransferPolicyEvidence(html, {
    requestedUrl: POLICY_URL,
    finalUrl: POLICY_URL,
    contentType: evidence.source.content_type,
    robotsText: robots,
    robotsStatus: 200,
    robotsRequestedUrl: ROBOTS_URL,
    robotsFinalUrl: ROBOTS_FINAL_URL,
    robotsContentType: evidence.robots.content_type,
    capturedAt: null,
  });
}

describe('Virginia Tech transferable-associate policy evidence', () => {
  it('rebuilds the exact artifact from retained official responses', () => {
    expect(rebuild()).toEqual(evidence);
    expect(virginiaTechTransferPolicyEvidenceIssue(evidence)).toBeNull();
    expect(evidence).toMatchObject({
      policy_facts_sha256: POLICY_FACTS_SHA256,
      source: { response_sha256: POLICY_RESPONSE_SHA256 },
      robots: {
        response_sha256: ROBOTS_RESPONSE_SHA256,
        same_host_redirect: true,
        policy_path_allowed: true,
      },
      policy_facts: {
        completed_transferable_associate: {
          source_systems: ['VCCS', 'RBC'],
          baccalaureate_oriented_sequence_required: true,
          pathways_general_education_satisfied: true,
          major_specific_requirements_still_apply: true,
        },
        transferable_associate_awards: {
          included: ['AA', 'AS', 'AA&S'],
          excluded: ['AAS', 'AFA'],
        },
        passport_ucgs: {
          earned_milestone_or_credential_required_for_transcript_notation: true,
        },
      },
      paper_interpretation: {
        incoming_award: 'AS',
        completed_transferable_associate_degree: true,
        passport_or_ucgs_earned_assumed: false,
        figure_model: 'complete_degree_path',
      },
    });
  });

  it.each([
    ['source-system owner', 'Virginia Community College or Richard Bland College', 'a Virginia college'],
    ['baccalaureate sequence', 'baccalaureate-oriented sequence of courses', 'college-oriented sequence of courses'],
    ['all-GE effect', 'Fulfills<strong> </strong>all general education requirements', 'Fulfills<strong> </strong>some general education requirements'],
    ['major carveout', 'students must also complete the specific course requirements for their major', 'students may complete the specific course requirements for their major'],
    ['included award', 'an Associate of Science', 'an Associate of Applied Science'],
    ['excluded awards', 'Neither an Associate of Applied Science nor an Associate of Fine Arts is transferable', 'An Associate of Fine Arts is transferable'],
    ['earned notation', 'transcript with the earned milestone or credential', 'transcript with the planned milestone or credential'],
  ])('fails closed when the official %s statement changes', (_label, before, after) => {
    expect(() => rebuild(fs.readFileSync(PAGE, 'utf8').replace(before, after)))
      .toThrow(/did not verify/);
  });

  it('fails closed on robots status, redirect-host, or path changes', () => {
    const html = fs.readFileSync(PAGE, 'utf8');
    for (const options of [
      { robotsStatus: 202 },
      { robotsFinalUrl: 'https://example.org/robots.txt' },
      { robotsText: 'User-agent: *\nDisallow: /Transfer-Requirements/\n' },
    ]) {
      const parsed = parseVirginiaTechTransferPolicy(html, {
        requestedUrl: POLICY_URL,
        finalUrl: POLICY_URL,
        contentType: evidence.source.content_type,
        robotsText: fs.readFileSync(ROBOTS, 'utf8'),
        robotsStatus: 200,
        robotsRequestedUrl: ROBOTS_URL,
        robotsFinalUrl: ROBOTS_FINAL_URL,
        robotsContentType: evidence.robots.content_type,
        ...options,
      });
      expect(parsed.verified).toBe(false);
      expect(parsed.issues).toContain('robots_policy');
    }
  });

  it('rejects a self-consistent-looking mutation of the checked artifact', () => {
    const mutated = structuredClone(evidence);
    mutated.paper_interpretation.passport_or_ucgs_earned_assumed = true;
    expect(virginiaTechTransferPolicyEvidenceIssue(mutated)).toMatch(/semantics/i);
    const response = structuredClone(evidence);
    response.source.response_sha256 = '0'.repeat(64);
    expect(virginiaTechTransferPolicyEvidenceIssue(response)).toMatch(/receipt changed/i);
  });
});
