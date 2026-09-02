import { describe, expect, it } from 'vitest';
import {
  COURSE_FACTS,
  EQUIVALENCY_SOURCE_URLS,
} from './radfordSciencePairEvidence';
import {
  RECEIPT_TARGETS,
  buildRadfordCollegeSciencePairEvidence,
  discoveryRows,
  receiptKey,
  routeForTarget,
} from './radfordCollegeSciencePairEvidence';

function page({ institution, code, twoYearRows = [], receivingCode = null }) {
  const fact = COURSE_FACTS[code];
  const rows = twoYearRows.map((row) => `<tr>
    <td>${row.source_institution}</td><td><a href="/course/${row.guid}">${code}</a></td>
    <td>${fact.sending_title}</td><td></td><td>2-Year</td></tr>`).join('');
  const radford = receivingCode == null ? '' : `<tr>
    <td>Radford University</td><td>${receivingCode}</td><td>${fact.receiving_title}</td>
    <td></td><td>4-Year</td></tr>`;
  return `<html><body><div class="course-div">
    <div class="Courses-name">${code}: ${fact.sending_title}</div>
    <div class="participatingname">${institution}</div></div>
    <div><div class="card-header"><span class="title-header">Credits</span></div>
      <div>${fact.sending_credits}</div></div>
    <div id="courses-equivalencies-table"><table>${rows}${radford}</table></div>
  </body></html>`;
}

function syntheticInput() {
  const discoveryPages = {};
  const discoveryResponses = {};
  const coursePages = {};
  const courseResponses = {};
  for (const code of Object.keys(COURSE_FACTS)) {
    const targets = RECEIPT_TARGETS.filter((target) => target.sending_code === code);
    const rows = targets.filter((target) => (
      target.source_institution !== 'Blue Ridge Community College'
    )).map((target, index) => ({
      source_institution: target.source_institution,
      guid: `${String(index + 1).padStart(24, 'A')}${code}`.replace(/[^A-F0-9]/g, 'A')
        .slice(0, 32),
    }));
    const url = EQUIVALENCY_SOURCE_URLS[code];
    discoveryPages[code] = page({
      institution: 'Blue Ridge Community College',
      code,
      twoYearRows: rows,
      receivingCode: COURSE_FACTS[code].receiving_code,
    });
    discoveryResponses[code] = {
      requestedUrl: url, finalUrl: url, status: 200, contentType: 'text/html',
    };
    for (const target of targets.filter((entry) => (
      entry.source_institution !== 'Blue Ridge Community College'
    ))) {
      const key = receiptKey(target.college_slug, code);
      const route = discoveryRows(discoveryPages[code], code).find((row) => (
        row.source_institution === target.source_institution
      ));
      coursePages[key] = page({
        institution: target.source_institution,
        code,
        receivingCode: COURSE_FACTS[code].receiving_code,
      });
      courseResponses[key] = {
        requestedUrl: route.url, finalUrl: route.url,
        status: 200, contentType: 'text/html',
      };
    }
  }
  return {
    discoveryPages,
    discoveryResponses,
    coursePages,
    courseResponses,
    robots: {
      host: 'www.transfervirginia.org', status: 200, crawlDelay: 10,
      text: 'User-agent: *\nAllow: /\nCrawl-delay: 10\n',
    },
  };
}

describe('Radford college-specific science-pair equivalency evidence', () => {
  it('discovers exact college renderings and proves all 34 target landings', () => {
    const input = syntheticInput();
    const built = buildRadfordCollegeSciencePairEvidence(input);
    expect(built).toMatchObject({
      verified: true,
      issues: [],
      target_count: 34,
      positive_receipts: 34,
      negative_receipts: 0,
    });
    expect(built.receipts.map((receipt) => [
      receipt.source_institution,
      receipt.sending_code,
      receipt.receiving_code,
      receipt.status,
    ])).toHaveLength(34);
    expect(routeForTarget({ rows: [] }, RECEIPT_TARGETS[0])).toMatchObject({
      kind: 'root_page',
      source_institution: 'Blue Ridge Community College',
    });
  });

  it('records absence and a wrong Radford landing as negative, never positive', () => {
    const missing = syntheticInput();
    const brightpoint = RECEIPT_TARGETS.find((target) => (
      target.college_slug === 'brightpoint-community-college'
        && target.sending_code === 'CHM111'
    ));
    missing.discoveryPages.CHM111 = missing.discoveryPages.CHM111.replace(
      /<tr>\s*<td>Brightpoint Community College<\/td>[\s\S]*?<\/tr>/,
      '',
    );
    let built = buildRadfordCollegeSciencePairEvidence(missing);
    expect(built.receipts.find((receipt) => (
      receipt.college_slug === brightpoint.college_slug
        && receipt.sending_code === brightpoint.sending_code
    ))).toMatchObject({
      status: 'negative', reason: 'college_course_rendering_not_discovered', source: null,
    });

    const wrong = syntheticInput();
    const key = receiptKey(brightpoint.college_slug, brightpoint.sending_code);
    wrong.coursePages[key] = wrong.coursePages[key].replace('CHEM111', 'CHEM1XX');
    built = buildRadfordCollegeSciencePairEvidence(wrong);
    expect(built.receipts.find((receipt) => receipt.college_slug === brightpoint.college_slug
      && receipt.sending_code === brightpoint.sending_code)).toMatchObject({
      status: 'negative', reason: 'exact_radford_landing_not_published',
    });
  });

  it.each([
    ['college identity', (input) => {
      const key = receiptKey('brightpoint-community-college', 'CHM111');
      input.coursePages[key] = input.coursePages[key]
        .replace('Brightpoint Community College', 'Different College');
    }],
    ['sending credits', (input) => {
      const key = receiptKey('brightpoint-community-college', 'CHM111');
      input.coursePages[key] = input.coursePages[key].replace('<div>4</div>', '<div>3</div>');
    }],
    ['redirect', (input) => {
      const key = receiptKey('brightpoint-community-college', 'CHM111');
      input.courseResponses[key].finalUrl = 'https://example.test/redirect';
    }],
    ['robots delay', (input) => { input.robots.crawlDelay = 0; }],
  ])('fails acquisition integrity on %s drift', (_label, mutate) => {
    const input = syntheticInput();
    mutate(input);
    expect(buildRadfordCollegeSciencePairEvidence(input).verified).toBe(false);
  });
});
