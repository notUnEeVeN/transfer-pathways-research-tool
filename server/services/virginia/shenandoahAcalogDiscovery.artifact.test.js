import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildArtifact,
  validateArtifact,
} = require('../../scripts/va/captureShenandoahAcalogDiscovery');
const {
  SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
} = require('./browserChallengeCourseLeafAcquisition');

const artifact = JSON.parse(fs.readFileSync(new URL(
  '../../.va-catalogs/research/shenandoah-acalog-course-discovery.json', import.meta.url,
), 'utf8'));
const cacheRoot = new URL('../../.va-catalogs/', import.meta.url);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

describe('checked-in Shenandoah exact-filter discovery evidence', () => {
  it('replays five exact current identities from retained same-URL browser receipts', () => {
    expect(buildArtifact()).toEqual(artifact);
    expect(validateArtifact(artifact)).toEqual({ verified: true, issues: [] });
    expect(artifact).toMatchObject({
      publication_ready: false,
      summary: {
        exact_filter_queries: 5,
        exact_current_course_identities: 5,
        exact_filter_responses_without_current_course_identity: 0,
        unusable_official_filter_responses: 0,
      },
    });
    expect(artifact.discoveries.map((row) => row.course_code))
      .toEqual(['ENG101', 'FYS101', 'INT101', 'MATH101', 'MATH102']);
    expect(artifact.discoveries.every((row) => (
      row.status === 'exact_current_course_identity'
      && row.catalog_year === '2025-2026'
      && row.catoid === 33
      && Number.isInteger(row.coid)
      && row.exact_link_receipt?.course_code === row.course_code
      && row.exact_link_receipt?.coid === row.coid
      && row.browser_challenge_receipt?.contract
        === SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT
      && row.browser_challenge_receipt?.exact_same_url === true
      && row.browser_challenge_receipt?.document_response_count === 2
      && row.browser_challenge_receipt?.document_responses?.[0]?.http_status === 202
      && row.browser_challenge_receipt?.document_responses?.[1]?.http_status === 200
      && row.browser_challenge_receipt?.document_responses?.[1]?.content_sha256
        === row.source_response_sha256
      && row.robots.http_status === 200
      && row.robots.crawl_delay_seconds === 120
      && row.absence_boundary === null
    ))).toBe(true);
    expect(Object.fromEntries(artifact.discoveries.map((row) => [
      row.course_code, { title: row.title, coid: row.coid },
    ]))).toEqual({
      ENG101: { title: 'Composition', coid: 54326 },
      FYS101: { title: 'Going Global First-Year Seminar', coid: 54418 },
      INT101: { title: 'Introduction to Computing Fundamentals', coid: 55320 },
      MATH101: { title: 'College Algebra', coid: 54576 },
      MATH102: { title: 'Precalculus', coid: 54577 },
    });
    expect(Object.fromEntries(artifact.discoveries.map((row) => [
      row.course_code, row.source_response_sha256,
    ]))).toEqual({
      ENG101: 'ef907d9ff2317642b50e7c46b1ecd5c0d92f49cd41cf3e4d3ec1d92dabcb22f1',
      FYS101: 'a51bf0d5fdbc732da2b5356d19cb22d0ab8e1d39cd79a08f83edcbbae507a1f0',
      INT101: 'c3722be423c803d43b7db611c980780e643fef2841bbf69d53062bc8633e9748',
      MATH101: '6c2fdb804af9be52273ea0a5691f219c94467c41881abc73f24dbd8b7af7a19a',
      MATH102: 'fa31a58085372087d4f1561af89254b6c10eb96765ca63c8ab1f6f0f190ae5a5',
    });
  });

  it('retains exact response bytes and the published inter-request delay', () => {
    for (const row of artifact.discoveries) {
      expect(sha256(fs.readFileSync(new URL(row.cache_path, cacheRoot))))
        .toBe(row.source_response_sha256);
      expect(sha256(fs.readFileSync(new URL(
        row.browser_challenge_cache_path, cacheRoot,
      )))).toBe(row.browser_challenge_receipt.document_responses[0].content_sha256);
      expect(row.browser_challenge_receipt.document_responses[1].cache_path)
        .toBe(row.cache_path);
    }
    const fetchedAt = artifact.discoveries.map((row) => Date.parse(row.fetched_at))
      .sort((left, right) => left - right);
    expect(fetchedAt.every(Number.isFinite)).toBe(true);
    expect(fetchedAt.slice(1).every((value, index) => value - fetchedAt[index] >= 120_000))
      .toBe(true);
  });

  it('fails closed on status, identity, receipt, or boundary mutation', () => {
    for (const mutate of [
      (row) => { row.status = 'exact_filter_response_without_current_course_identity'; },
      (row) => { row.coid += 1; },
      (row) => { row.source_response_sha256 = '0'.repeat(64); },
      (row) => { row.browser_challenge_receipt.document_responses[0].http_status = 200; },
    ]) {
      const tampered = structuredClone(artifact);
      mutate(tampered.discoveries[0]);
      expect(validateArtifact(tampered)).toEqual({
        verified: false, issues: ['artifact_replay'],
      });
    }
  });
});
