import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/virginia-tech-equivalency-quantity-evidence.json';
import {
  EQUIVALENCY_RESPONSE_SHA256,
  EQUIVALENCY_URL,
  QUANTITY_FACTS_SHA256,
  ROBOTS_FINAL_URL,
  ROBOTS_RESPONSE_SHA256,
  ROBOTS_URL,
  buildVirginiaTechEquivalencyQuantityEvidence,
  parseVirginiaTechEquivalencyQuantityEvidence,
  virginiaTechEquivalencyQuantityEvidenceIssue,
} from './virginiaTechEquivalencyQuantityEvidence';

const ROOT = path.resolve(__dirname, '../..');
const PAGE = path.join(
  ROOT,
  '.va-catalogs/research/virginia-tech-equivalency-quantity-sources/vccs-equivalencies-2026.html',
);
const ROBOTS = path.join(
  ROOT,
  '.va-catalogs/research/virginia-tech-equivalency-quantity-sources/robots.txt',
);

function rebuild(html = fs.readFileSync(PAGE, 'utf8'), robots = fs.readFileSync(ROBOTS, 'utf8')) {
  return buildVirginiaTechEquivalencyQuantityEvidence(html, {
    requestedUrl: EQUIVALENCY_URL,
    finalUrl: EQUIVALENCY_URL,
    contentType: evidence.source.content_type,
    robotsText: robots,
    robotsStatus: 200,
    robotsRequestedUrl: ROBOTS_URL,
    robotsFinalUrl: ROBOTS_FINAL_URL,
    robotsContentType: evidence.robots.content_type,
    capturedAt: null,
  });
}

describe('Virginia Tech VCCS equivalency quantity evidence', () => {
  it('rebuilds the exact artifact from the retained official responses', () => {
    expect(rebuild()).toEqual(evidence);
    expect(virginiaTechEquivalencyQuantityEvidenceIssue(evidence)).toBeNull();
    expect(evidence).toMatchObject({
      quantity_facts_sha256: QUANTITY_FACTS_SHA256,
      source: { response_sha256: EQUIVALENCY_RESPONSE_SHA256 },
      robots: {
        response_sha256: ROBOTS_RESPONSE_SHA256,
        same_host_redirect: true,
        equivalency_path_allowed: true,
      },
      quantity_facts: {
        rows: {
          CSC222: {
            sending_units: 4,
            named_receiving_code: 'CS1114',
            named_receiving_units: 3,
            elective_receiving_code: 'CS1XXX',
            elective_receiving_units: 1,
            language_condition: 'java_or_advisor_review',
          },
          CSC223: {
            sending_units: 4,
            named_receiving_code: 'CS2114',
            named_receiving_units: 3,
            elective_receiving_code: 'CS2XXX',
            elective_receiving_units: 1,
            language_condition: null,
          },
          EGR122: {
            sending_units: 3,
            named_receiving_code: 'ENGE1216',
            named_receiving_units: 2,
            elective_receiving_code: 'ENGE1XXX',
            elective_receiving_units: 1,
            language_condition: null,
          },
        },
      },
      paper_interpretation: {
        quantity_resolution_codes: ['CSC223', 'EGR122'],
        csc222_quantity_known: true,
        csc222_language_condition_resolved: false,
        generic_variable_credit_rule_inferred: false,
      },
    });
  });

  it.each([
    ['CSC 222 condition', 'If taught in a language other than Java, please see your advisor.', ''],
    [
      'CSC 223 quantity',
      /<td>Software Design and Data Structures \+ Computer Science Elective<\/td>\r?\n\s*<td>3\+1<\/td>/,
      '<td>Software Design and Data Structures + Computer Science Elective</td>\n        <td>4</td>',
    ],
    [
      'EGR 122 quantity',
      /<td>Foundations of Engineering \+ Engineering Education Elective<\/td>\r?\n\s*<td>2\+1<\/td>/,
      '<td>Foundations of Engineering + Engineering Education Elective</td>\n        <td>3</td>',
    ],
    ['table header', 'VT Credits', 'Receiving Credits'],
  ])('fails closed when the official %s row changes', (_label, before, after) => {
    const html = fs.readFileSync(PAGE, 'utf8').replace(before, after);
    expect(() => rebuild(html)).toThrow(/did not verify/);
  });

  it('fails closed on robots status, redirect host, or path policy changes', () => {
    const html = fs.readFileSync(PAGE, 'utf8');
    for (const options of [
      { robotsStatus: 202 },
      { robotsFinalUrl: 'https://example.org/robots.txt' },
      { robotsText: 'User-agent: *\nDisallow: /VCCS-Equivalencies/\n' },
    ]) {
      const parsed = parseVirginiaTechEquivalencyQuantityEvidence(html, {
        requestedUrl: EQUIVALENCY_URL,
        finalUrl: EQUIVALENCY_URL,
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

  it('rejects self-consistent-looking artifact mutations', () => {
    const interpretation = structuredClone(evidence);
    interpretation.paper_interpretation.csc222_language_condition_resolved = true;
    expect(virginiaTechEquivalencyQuantityEvidenceIssue(interpretation))
      .toMatch(/bounded quantity interpretation/i);

    const quantity = structuredClone(evidence);
    quantity.quantity_facts.rows.CSC223.elective_receiving_units = 2;
    expect(virginiaTechEquivalencyQuantityEvidenceIssue(quantity)).toMatch(/receipt changed/i);

    const response = structuredClone(evidence);
    response.source.response_sha256 = '0'.repeat(64);
    expect(virginiaTechEquivalencyQuantityEvidenceIssue(response)).toMatch(/receipt changed/i);
  });
});
