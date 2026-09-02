import { describe, expect, it } from 'vitest';
import {
  BROWSER_CHALLENGE_CONTRACT,
  SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
  browserDocumentLooksLikeInterstitial,
  exactKnownBrowserResource,
  extractSitemapLocations,
  validateBrowserChallengeReceipt,
} from './browserChallengeCourseLeafAcquisition';

const hash = 'a'.repeat(64);

describe('known-host CourseLeaf browser challenge acquisition', () => {
  it('accepts only the exact same-URL 202 then 200 raw-document receipt', () => {
    const url = 'https://catalog.jmu.edu/courses/cs/';
    const receipt = {
      contract: BROWSER_CHALLENGE_CONTRACT,
      requested_url: url,
      exact_same_url: true,
      document_response_count: 2,
      document_responses: [
        { ordinal: 1, http_status: 202, url, content_type: 'text/html',
          byte_length: 10, content_sha256: hash, cache_path: 'cs.challenge.html' },
        { ordinal: 2, http_status: 200, url, content_type: 'text/html',
          byte_length: 20, content_sha256: hash, cache_path: 'cs.html' },
      ],
    };
    expect(validateBrowserChallengeReceipt(receipt, {
      expectedUrl: url, expectedFinalContentType: 'text/html', expectedFinalSha256: hash,
    })).toEqual({ valid: true, issues: [] });
    receipt.document_responses[0].http_status = 200;
    expect(validateBrowserChallengeReceipt(receipt, {
      expectedUrl: url, expectedFinalContentType: 'text/html', expectedFinalSha256: hash,
    }).issues).toContain('challenge_response');
  });

  it('uses a distinct exact Shenandoah Acalog provenance contract without widening defaults', () => {
    const url = 'https://catalog.su.edu/content.php?filter%5B27%5D=ENG&filter%5B29%5D=101';
    const receipt = {
      contract: SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
      requested_url: url,
      exact_same_url: true,
      document_response_count: 2,
      document_responses: [
        { ordinal: 1, http_status: 202, url, content_type: 'text/html',
          byte_length: 10, content_sha256: hash, cache_path: 'eng.challenge.html' },
        { ordinal: 2, http_status: 200, url, content_type: 'text/html',
          byte_length: 20, content_sha256: hash, cache_path: 'eng.html' },
      ],
    };
    const options = {
      expectedUrl: url,
      expectedFinalContentType: 'text/html',
      expectedFinalSha256: hash,
      expectedContract: SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
    };
    expect(validateBrowserChallengeReceipt(receipt, options))
      .toEqual({ valid: true, issues: [] });
    expect(validateBrowserChallengeReceipt(receipt, {
      ...options, expectedContract: undefined,
    }).issues).toContain('contract');

    const mislabeledCourseLeaf = structuredClone(receipt);
    mislabeledCourseLeaf.contract = BROWSER_CHALLENGE_CONTRACT;
    expect(validateBrowserChallengeReceipt(mislabeledCourseLeaf, options).issues)
      .toContain('contract');
    expect(validateBrowserChallengeReceipt(receipt, {
      ...options, expectedContract: 'invented_transport_contract',
    }).issues).toContain('expected_contract');
  });

  it('pins JMU subjects and Virginia Tech departments to exact reviewed paths', () => {
    expect(exactKnownBrowserResource({
      slug: 'james-madison-university',
      platform: 'browser_challenge_courseleaf',
      officialUrl: 'https://catalog.jmu.edu/courses/math/',
      targetSubjectPrefix: 'MATH',
    })).toBe(true);
    expect(exactKnownBrowserResource({
      slug: 'virginia-polytechnic-institute-and-state-university',
      platform: 'browser_challenge_courseleaf',
      officialUrl: 'https://catalog.vt.edu/undergraduate/college-science/mathematics/',
      targetSubjectPrefix: 'MATH',
    })).toBe(true);
    expect(exactKnownBrowserResource({
      slug: 'virginia-polytechnic-institute-and-state-university',
      platform: 'browser_challenge_courseleaf',
      officialUrl: 'https://catalog.vt.edu/course-descriptions/isc/',
      targetSubjectPrefix: 'ISC',
    })).toBe(true);
    expect(exactKnownBrowserResource({
      slug: 'virginia-polytechnic-institute-and-state-university',
      platform: 'browser_challenge_courseleaf',
      officialUrl: 'https://catalog.vt.edu/course-descriptions/ise/',
      targetSubjectPrefix: 'ISC',
    })).toBe(false);
    expect(exactKnownBrowserResource({
      slug: 'virginia-polytechnic-institute-and-state-university',
      platform: 'browser_challenge_courseleaf',
      officialUrl: 'https://catalog.vt.edu/undergraduate/college-science/physics/',
      targetSubjectPrefix: 'MATH',
    })).toBe(false);
  });

  it('does not mistake ordinary catalog prose mentioning CAPTCHA for an interstitial', () => {
    expect(browserDocumentLooksLikeInterstitial(`
      <html><head><title>Courses | George Mason University Catalog</title></head>
      <body><div class="courseblock">CYSE 476: Designing an accessible CAPTCHA.</div></body></html>
    `)).toBe(false);
    expect(browserDocumentLooksLikeInterstitial(
      '<html><head><title>CAPTCHA challenge</title></head></html>',
    )).toBe(true);
    expect(browserDocumentLooksLikeInterstitial(
      '<div id="captcha-container">Complete the challenge</div>',
    )).toBe(true);
  });

  it('rejects duplicate, off-host, and query-bearing sitemap locations', () => {
    const exact = 'https://catalog.vt.edu/undergraduate/college-science/mathematics/';
    expect(extractSitemapLocations(`<urlset><url><loc>${exact}</loc></url></urlset>`))
      .toMatchObject({ valid: true, locations: [exact] });
    expect(extractSitemapLocations(
      `<urlset><url><loc>${exact}</loc></url><url><loc>${exact}</loc></url></urlset>`,
    ).valid).toBe(false);
    expect(extractSitemapLocations(
      '<urlset><url><loc>https://example.com/undergraduate/</loc></url></urlset>',
    ).valid).toBe(false);
  });
});
