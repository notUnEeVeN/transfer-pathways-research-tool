import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/radford-science-pair-evidence.json';
import {
  COURSE_FACTS,
  SCIENCE_FACTS,
  buildRadfordSciencePairEvidence,
  radfordSciencePairEvidenceIssue,
  radfordSciencePairReplayIssue,
  robotsAllows,
  semanticSha256,
  sourceReplayMetadataIssue,
  urlsFor,
} from './radfordSciencePairEvidence';

function vccsFixture(fact) {
  const id = fact.sending_code.replace(/^(\D+)(\d+)$/, '$1-$2');
  const code = fact.sending_code.replace(/^(\D+)(\d+)$/, '$1 $2');
  return `<html><body><dt id="${id}">${code} - ${fact.sending_title}</dt>
    <div class="endtext">Lecture 3 hours. Laboratory ${fact.sending_lab_hours} hours.</div>
    <div class="credits">${fact.sending_credits} credits</div></body></html>`;
}

function transferFixture(fact, themeToken) {
  return `<html><body><script>Drupal.settings={"ajaxPageState":{"theme_token":"${themeToken}"}}</script><div class="course-div">
    <div class="Courses-name">${fact.sending_code}: ${fact.sending_title}</div>
    <div class="participatingname">Blue Ridge Community College</div></div>
    <div class="card"><div class="card-header"><span class="title-header">Credits</span></div><div>${fact.sending_credits}</div></div>
    <div id="courses-equivalencies-table"><table><tr>
      <td>Radford University</td><td>${fact.receiving_code}</td>
      <td>${fact.receiving_title}</td><td></td><td>4-Year</td>
    </tr></table></div></body></html>`;
}

function radfordFixture(fact, tooltipIds) {
  const code = fact.receiving_code.replace(/^(\D+)(\d+)$/, '$1 $2');
  return `<html><body><div id="acalog-catalog-name">2026-2027 University Academic Catalog</div>
    ${tooltipIds.map((id) => `<a id="tt${id}">course</a>`).join('')}
    <table><tr><td class="block_content"><h1 id="course_preview_title">${code} - ${fact.receiving_title}</h1>
    Credits: (${fact.receiving_credits}) Instructional Method: ${fact.receiving_instruction} Prerequisites:</td></tr></table>
    </body></html>`;
}

function input({
  themeToken = 'A'.repeat(43),
  tooltipIds = ['101', '202'],
} = {}) {
  const pages = {};
  const responses = {};
  for (const [code, fact] of Object.entries(COURSE_FACTS)) {
    const urls = urlsFor(fact);
    pages[code] = {
      vccs: vccsFixture(fact),
      transfer_virginia: transferFixture(fact, themeToken),
      radford: radfordFixture(fact, tooltipIds),
    };
    responses[code] = Object.fromEntries(Object.entries(urls).map(([kind, url]) => [kind, {
      requestedUrl: url, finalUrl: url, contentType: 'text/html; charset=UTF-8',
    }]));
  }
  return {
    pages,
    responses,
    robots: {
      vccs: {
        host: 'courses.vccs.edu', status: 200, crawlDelay: 1,
        text: 'User-agent: *\nDisallow: /*?*\nCrawl-delay: 1\n',
      },
      transfer_virginia: {
        host: 'www.transfervirginia.org', status: 200, crawlDelay: 10,
        text: 'User-agent: *\nDisallow: /admin/\nCrawl-delay: 10\n',
      },
      radford: {
        host: 'catalog.radford.edu', status: 200, crawlDelay: 120,
        text: 'User-agent: *\nDisallow: /ajax/\nCrawl-delay: 120\n',
      },
    },
  };
}

describe('Radford exact science-pair evidence', () => {
  it('binds four exact sending labs, incoming edges, and receiving labs', () => {
    expect(radfordSciencePairEvidenceIssue(evidence)).toBeNull();
    expect(evidence).toMatchObject({
      verified: true,
      facts: SCIENCE_FACTS,
      facts_sha256: semanticSha256(SCIENCE_FACTS),
    });
    expect(evidence.courses.map((course) => [
      course.sending_code,
      course.sending.credits,
      course.sending.laboratory_hours,
      course.receiving_code,
      course.receiving.credits,
      course.receiving.laboratory_hours,
    ])).toEqual([
      ['CHM111', 4, 3, 'CHEM111', 4, 3],
      ['CHM112', 4, 3, 'CHEM112', 4, 3],
      ['PHY201', 4, 3, 'PHYS111', 4, 2],
      ['PHY202', 4, 3, 'PHYS112', 4, 2],
    ]);
  });

  it('parses the exact three-source conjunction for every course', () => {
    expect(buildRadfordSciencePairEvidence(input())).toMatchObject({
      verified: true, issues: [], facts: SCIENCE_FACTS,
    });
  });

  it('accepts only the enumerated per-request values in stable full-page replay', () => {
    const retained = buildRadfordSciencePairEvidence(input({
      themeToken: 'A'.repeat(43), tooltipIds: ['101', '202'],
    }));
    const live = buildRadfordSciencePairEvidence(input({
      themeToken: 'z'.repeat(43), tooltipIds: ['9876', '543'],
    }));

    expect(sourceReplayMetadataIssue(retained, live)).toBeNull();
    expect(retained.courses[0].equivalency.source.response_sha256)
      .not.toBe(live.courses[0].equivalency.source.response_sha256);
    expect(retained.courses[0].receiving.source.response_sha256)
      .not.toBe(live.courses[0].receiving.source.response_sha256);
  });

  it.each([
    ['missing Drupal token', (value) => {
      value.pages.CHM111.transfer_virginia = value.pages.CHM111.transfer_virginia
        .replace(/"theme_token":"[A-Za-z0-9_-]{43}"/, '"theme_token":"missing"');
    }],
    ['extra Drupal token', (value) => {
      value.pages.CHM111.transfer_virginia += `\n<script>{"theme_token":"${'B'.repeat(43)}"}</script>`;
    }],
    ['missing Acalog tooltip id', (value) => {
      value.pages.CHM111.radford = value.pages.CHM111.radford
        .replace(/<a id="tt[0-9]+">course<\/a>/, '');
    }],
    ['duplicate Acalog tooltip id', (value) => {
      value.pages.CHM111.radford = value.pages.CHM111.radford
        .replace('id="tt404"', 'id="tt303"');
    }],
    ['nonvolatile page byte', (value) => {
      value.pages.CHM111.transfer_virginia = value.pages.CHM111.transfer_virginia
        .replace('</body>', '<div>substantive drift</div></body>');
    }],
  ])('rejects %s drift from stable replay', (_label, mutate) => {
    const retainedInput = input();
    const liveInput = input({ themeToken: 'B'.repeat(43), tooltipIds: ['303', '404'] });
    mutate(liveInput);
    const retained = buildRadfordSciencePairEvidence(retainedInput);
    const live = buildRadfordSciencePairEvidence(liveInput);
    expect(sourceReplayMetadataIssue(retained, live)).toMatch(/response|replay/);
  });

  it.each([
    ['sending units', (value) => { value.pages.CHM111.vccs = value.pages.CHM111.vccs.replace('4 credits', '3 credits'); }],
    ['sending lab', (value) => { value.pages.CHM112.vccs = value.pages.CHM112.vccs.replace('Laboratory 3 hours', 'Laboratory 0 hours'); }],
    ['incoming edge', (value) => { value.pages.PHY201.transfer_virginia = value.pages.PHY201.transfer_virginia.replace('PHYS111', 'PHYS1ELE'); }],
    ['receiving identity', (value) => { value.pages.PHY202.radford = value.pages.PHY202.radford.replace('PHYS 112', 'PHYS 113'); }],
    ['receiving units', (value) => { value.pages.CHM111.radford = value.pages.CHM111.radford.replace('Credits: (4)', 'Credits: (3)'); }],
    ['receiving lab', (value) => { value.pages.CHM112.radford = value.pages.CHM112.radford.replace('three hours laboratory', 'zero hours laboratory'); }],
    ['source redirect', (value) => { value.responses.PHY201.radford.finalUrl = 'https://example.test/changed'; }],
    ['robots delay', (value) => { value.robots.radford.crawlDelay = 0; }],
  ])('fails closed on %s drift', (_label, mutate) => {
    const changed = input();
    mutate(changed);
    expect(buildRadfordSciencePairEvidence(changed).verified).toBe(false);
  });

  it('uses the applicable wildcard robots group and honors query rules', () => {
    const robots = [
      'User-agent: unrelated-bot', 'Disallow: /courses/',
      'User-agent: *', 'Disallow: /*?*',
    ].join('\n');
    expect(robotsAllows('https://courses.vccs.edu/courses/CHM111', robots)).toBe(true);
    expect(robotsAllows('https://courses.vccs.edu/courses/CHM111?x=1', robots)).toBe(false);
  });

  it('rejects retained semantic or response-receipt mutations', () => {
    const changedFact = structuredClone(evidence);
    changedFact.facts[0].sending_lab_hours = 0;
    expect(radfordSciencePairEvidenceIssue(changedFact)).toMatch(/semantic evidence changed/);

    const changedEdge = structuredClone(evidence);
    changedEdge.courses[0].equivalency.receiving_code = 'CHEM1ELE';
    expect(radfordSciencePairEvidenceIssue(changedEdge)).toMatch(/receipt changed/);

    const changedIncomingName = structuredClone(evidence);
    changedIncomingName.courses[0].equivalency.receiving_name = 'Chemistry Transfer Elective';
    expect(radfordSciencePairEvidenceIssue(changedIncomingName)).toMatch(/receipt changed/);

    const conditionalEdge = structuredClone(evidence);
    conditionalEdge.courses[0].equivalency.receiving_notes = 'Department approval required';
    expect(radfordSciencePairEvidenceIssue(conditionalEdge)).toMatch(/receipt changed/);

    const changedNormalizedReceipt = structuredClone(evidence);
    changedNormalizedReceipt.courses[0].equivalency.source
      .replay.normalized_response_sha256 = '0'.repeat(64);
    expect(radfordSciencePairEvidenceIssue(changedNormalizedReceipt))
      .toMatch(/stable full-page replay receipts changed/);
  });

  it('retains raw capture receipts while permitting only normalized live volatility', () => {
    const live = structuredClone(evidence);
    live.courses[0].equivalency.source.response_sha256 = '1'.repeat(64);
    live.courses[0].receiving.source.response_sha256 = '2'.repeat(64);
    live.courses[0].receiving.source.response_bytes += 2;
    expect(radfordSciencePairReplayIssue(evidence, live)).toBeNull();

    live.courses[0].receiving.source.http_status = 503;
    expect(radfordSciencePairReplayIssue(evidence, live)).toMatch(/live evidence invalid/);

    const missingRawReceipt = structuredClone(evidence);
    delete missingRawReceipt.courses[0].equivalency.source.response_sha256;
    expect(radfordSciencePairReplayIssue(evidence, missingRawReceipt))
      .toMatch(/raw response receipt is missing/);
  });
});
