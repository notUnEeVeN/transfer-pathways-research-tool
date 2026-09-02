import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/radford-college-science-pair-equivalency-evidence.json';
import {
  RECEIPTS_SHA256,
  RECEIPT_TARGETS,
  buildRadfordCollegeSciencePairEvidence,
  radfordCollegeSciencePairEvidenceIssue,
} from './radfordCollegeSciencePairEvidence';
import { loadRetainedSources } from '../../scripts/va/captureRadfordCollegeSciencePairEvidence';

describe('retained Radford college-specific science-pair corpus', () => {
  it('replays all retained official bytes to the checked artifact exactly', () => {
    const rebuilt = buildRadfordCollegeSciencePairEvidence(loadRetainedSources());
    expect(rebuilt).toEqual(evidence);
    expect(radfordCollegeSciencePairEvidenceIssue(rebuilt)).toBeNull();
    expect(rebuilt).toMatchObject({
      verified: true,
      issues: [],
      target_count: 34,
      positive_receipts: 34,
      negative_receipts: 0,
      receipts_sha256: RECEIPTS_SHA256,
    });
    expect(rebuilt.receipts.map((receipt) => [
      receipt.college_slug, receipt.sending_code,
    ])).toEqual(RECEIPT_TARGETS.map((target) => [
      target.college_slug, target.sending_code,
    ]));
  });

  it.each([
    ['target college', (changed) => {
      changed.receipts[2].source_institution = 'Different College';
    }],
    ['landing', (changed) => { changed.receipts[2].receiving_code = 'CHEM1XX'; }],
    ['response hash', (changed) => {
      changed.receipts[2].source.response_sha256 = '0'.repeat(64);
    }],
    ['positive status', (changed) => {
      changed.receipts[2].status = 'negative';
      changed.receipts[2].reason = 'exact_radford_landing_not_published';
    }],
    ['inventory digest', (changed) => { changed.receipts_sha256 = '0'.repeat(64); }],
    ['robots receipt', (changed) => { changed.robots.crawl_delay_seconds = 0; }],
  ])('rejects retained %s drift', (_label, mutate) => {
    const changed = structuredClone(evidence);
    mutate(changed);
    expect(radfordCollegeSciencePairEvidenceIssue(changed)).toBeTruthy();
  });
});
