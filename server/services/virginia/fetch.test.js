import { describe, it, expect } from 'vitest';
import { isBotChallenge } from './fetch';

/**
 * Transfer Virginia sits behind AWS WAF. A tripped bot rule is answered with
 * HTTP **200** and a ~2KB JavaScript challenge page, so status codes cannot
 * distinguish it from real content.
 *
 * This detector exists because the first full crawl cached 406 challenge pages
 * as if they were guides. The parser found no requirement table in any of them
 * and reported them as empty, which would have produced the finding "75% of
 * Virginia transfer guides publish no requirements" — false, and indistinguishable
 * from a real result once it left the scraper. Detecting the challenge is the
 * difference between a visible failure and a fabricated one.
 */

// The exact body served by the WAF, trimmed.
const CHALLENGE = `<html><head><script src="https://de5282c3ca0c.edge.sdk.awswaf.com/challenge.js"></script>
<script>AwsWafIntegration.saveReferrer(); AwsWafIntegration.checkForceRefresh().then((forceRefresh) => {
if (forceRefresh) { AwsWafIntegration.forceRefreshToken().then(() => { window.location.reload(true); });
} else { AwsWafIntegration.getToken().then(() => { window.location.reload(true); }); }});</script></head><body></body></html>`;

describe('isBotChallenge', () => {
  it('identifies the AWS WAF challenge served in place of a page', () => {
    expect(isBotChallenge(CHALLENGE)).toBe(true);
  });

  it('identifies it by the SDK host alone', () => {
    expect(isBotChallenge('<script src="https://x.edge.sdk.awswaf.com/challenge.js"></script>')).toBe(true);
  });

  it('does not flag a real guide page', () => {
    const guide = `<html><body><h1>UMW Computer Science BS Transfer Guide</h1>
      <table><tr><td>Complete at a Virginia Community College</td><td>Credits</td>
      <td>Course Equivalent</td><td>Notes</td></tr>
      <tr><td>ENG 111</td><td>3</td><td>ENGL 101</td><td>College Comp I</td></tr></table>
      ${'<p>padding to exceed the size guard.</p>'.repeat(400)}</body></html>`;
    expect(isBotChallenge(guide)).toBe(false);
  });

  // The size guard stops a legitimate page that merely mentions the WAF (a
  // status notice, a docs page) from being discarded as a challenge.
  it('does not flag a long page that happens to mention awswaf', () => {
    const long = `<html><body>${'<p>content</p>'.repeat(2000)}<p>awswaf</p></body></html>`;
    expect(long.length).toBeGreaterThan(8000);
    expect(isBotChallenge(long)).toBe(false);
  });

  it('is safe on empty and non-string input', () => {
    expect(isBotChallenge('')).toBe(false);
    expect(isBotChallenge(null)).toBe(false);
    expect(isBotChallenge(undefined)).toBe(false);
    expect(isBotChallenge(12345)).toBe(false);
  });
});
