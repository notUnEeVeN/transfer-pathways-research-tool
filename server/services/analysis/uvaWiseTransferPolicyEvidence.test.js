import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/uva-wise-vccs-transfer-policy-evidence.json';
import {
  EXPECTED,
  GAA_URL,
  REGISTRAR_URL,
  RESPONSE_SHA256,
  VCCS_SENDER_RECEIPTS,
  buildUvaWiseTransferPolicyEvidence,
  parseUvaWiseTransferPolicyEvidence,
  uvaWiseTransferPolicyEvidenceIssue,
} from './uvaWiseTransferPolicyEvidence';
import {
  extractPdfText,
  readRetainedSenderSources,
} from '../../scripts/va/captureUvaWiseTransferPolicyEvidence';

const ROOT = path.resolve(__dirname, '../..');
const SOURCES = path.join(ROOT, '.va-catalogs/research/uva-wise-transfer-policy-sources');
const registrarHtml = fs.readFileSync(path.join(SOURCES, 'registrar-transferring-courses.html'), 'utf8');
const gaaPdf = fs.readFileSync(path.join(SOURCES, 'uva-wise-vccs-gaa-signed-2023.pdf'));
const gaaText = fs.readFileSync(path.join(SOURCES, 'uva-wise-vccs-gaa-signed-2023.txt'), 'utf8');
const robotsText = fs.readFileSync(path.join(SOURCES, 'robots.txt'), 'utf8');

const input = (overrides = {}) => ({
  registrarHtml,
  gaaPdf,
  gaaText,
  robotsText,
  robotsStatus: 200,
  senderSources: readRetainedSenderSources(),
  responses: {
    registrar: {
      requestedUrl: REGISTRAR_URL,
      finalUrl: REGISTRAR_URL,
      contentType: evidence.sources.current_registrar_page.content_type,
    },
    gaa: {
      requestedUrl: GAA_URL,
      finalUrl: GAA_URL,
      contentType: evidence.sources.signed_vccs_gaa.content_type,
    },
  },
  ...overrides,
});

describe('UVA Wise current VCCS GAA transfer-policy evidence', () => {
  it('rebuilds from retained official bytes and replays PDF text extraction', () => {
    expect(buildUvaWiseTransferPolicyEvidence(input())).toEqual(evidence);
    expect(extractPdfText(gaaPdf)).toBe(gaaText);
    expect(evidence).toMatchObject({
      verified: true,
      sources: {
        current_registrar_page: { response_sha256: RESPONSE_SHA256.registrar },
        signed_vccs_gaa: {
          response_sha256: RESPONSE_SHA256.gaa_pdf,
          extracted_text_sha256: RESPONSE_SHA256.gaa_text,
          effective_date: '2023-06-14',
        },
      },
      policy_facts: {
        current_policy_bridge: {
          current_fixed_catalog: '2026-2027',
          agreement_remains_until_modified_or_terminated: true,
        },
        agreement_scope: { source_systems: ['VCCS'], richard_bland_is_party: false },
        credit_application: {
          accepted_credit_ceiling_units: 62,
          lower_division_general_education_met: true,
          guaranteed_units_applied_to_degree_minimum: 60,
          bachelor_degree_minimum_units: 120,
          chosen_major_requirements_still_apply: true,
        },
        registrar_scope: { richard_bland_ge_waiver_published: false },
      },
      paper_interpretation: {
        lower_division_ge_groups_superseded: [6, 7, 8, 9, 10, 11, 12],
        major_specific_two_lab_sciences_waived: false,
        richard_bland_covered: false,
        qualifying_vccs_sender_count: 18,
        scenario_id: 'successful_gaa_participant',
        ordinary_non_gap_transfer_receives_waiver: false,
        optional_policy_failure_blocks_ordinary_route: false,
        transfer_guide_2025_2026_used_as_2026_2027_bridge: false,
        figure_3_4_cells_made_ready_without_lab_science_proof: 0,
      },
      publication_boundary: {
        authoritative_source_collection: 'va_requirements',
        protected_projection_receipts: 18,
        candidate_tuples_matching_protected_projection: 6,
        candidate_tuples_different_from_protected_projection: 12,
      },
    });
    expect(uvaWiseTransferPolicyEvidenceIssue(evidence)).toBeNull();
    expect(evidence.sender_receipts).toEqual(VCCS_SENDER_RECEIPTS);
    expect(evidence.sender_receipts.map((row) => row.numeric_id)).not.toContain(9317);
    expect(evidence.sender_award_evidence).toHaveLength(18);
    expect(evidence.sender_award_evidence).toEqual(evidence.sender_award_evidence.map((row) => (
      expect.objectContaining({
        award: 'AS',
        vccs: expect.objectContaining({ response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }),
        schev: expect.objectContaining({
          classification: "Associate's Degree - Transfer",
          response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      })
    )));
  });

  it.each([
    ['current GAA link', GAA_URL, `${GAA_URL}?changed=1`, 'registrarHtml'],
    ['VCCS-only GE scope', 'from a public Virginia Community College', 'from a public Virginia college', 'registrarHtml'],
    ['major authority', 'reserve final decisions', 'share final decisions', 'registrarHtml'],
    ['60-of-120 application', '60 credit hours will apply', '59 credit hours will apply', 'gaaText'],
    ['62-credit ceiling', 'not to exceed 62 credits', 'not to exceed 61 credits', 'gaaText'],
    ['major preservation', 'must meet the requirements of their chosen major', 'may meet the requirements of their chosen major', 'gaaText'],
    ['duration bridge', 'will remain in effect until modified or terminated', 'remained in effect through 2025', 'gaaText'],
  ])('fails closed when %s changes', (_label, before, after, key) => {
    const changed = input({ [key]: input()[key].replace(before, after) });
    expect(parseUvaWiseTransferPolicyEvidence(changed).verified).toBe(false);
    expect(() => buildUvaWiseTransferPolicyEvidence(changed)).toThrow(/did not verify/);
  });

  it('fails closed on PDF, robots, sender, and interpretation drift', () => {
    const pdf = Buffer.from(gaaPdf);
    pdf[pdf.length - 1] ^= 1;
    const parsed = parseUvaWiseTransferPolicyEvidence(input({ gaaPdf: pdf }));
    expect(parsed.verified).toBe(true);
    expect(parsed.sources.signed_vccs_gaa.response_sha256).not.toBe(RESPONSE_SHA256.gaa_pdf);
    const changedReceipt = buildUvaWiseTransferPolicyEvidence(input({ gaaPdf: pdf }));
    expect(uvaWiseTransferPolicyEvidenceIssue(changedReceipt)).toMatch(/source receipt changed/);

    expect(parseUvaWiseTransferPolicyEvidence(input({
      robotsText: 'User-agent: *\nDisallow: /registrar/\n',
    })).verified).toBe(false);
    const sender = structuredClone(evidence);
    sender.sender_receipts.push({ slug: 'richard-bland-college', numeric_id: 9317 });
    expect(uvaWiseTransferPolicyEvidenceIssue(sender)).toMatch(/sender receipt changed/);
    const interpretation = structuredClone(evidence);
    interpretation.paper_interpretation.major_specific_two_lab_sciences_waived = true;
    expect(uvaWiseTransferPolicyEvidenceIssue(interpretation)).toMatch(/semantics/);
  });

  it('binds the exact source wording that excludes Richard Bland from the GE waiver', () => {
    expect(EXPECTED.registrar.admission).toContain('Richard Bland College');
    expect(EXPECTED.registrar.ge_waiver).toContain('public Virginia Community College');
    expect(EXPECTED.registrar.ge_waiver).not.toContain('Richard Bland');
    expect(EXPECTED.gaa.title).toContain('VIRGINIA COMMUNITY COLLEGE SYSTEM');
    expect(EXPECTED.gaa.title).not.toContain('RICHARD BLAND');
  });
});
