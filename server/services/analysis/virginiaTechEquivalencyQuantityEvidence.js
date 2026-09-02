const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'virginia_tech_vccs_equivalency_quantity_evidence';
const EQUIVALENCY_URL =
  'https://transferguide.registrar.vt.edu/VCCS-Equivalencies/VCCS-Equivalencies-2026.html';
const ROBOTS_URL = 'https://transferguide.registrar.vt.edu/robots.txt';
const ROBOTS_FINAL_URL =
  'https://transferguide.registrar.vt.edu/content/dam/transferguide_registrar_vt_edu/robots.txt';
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

// These values bind the checked-in artifact to one exact official response.
// They are deliberately not a generic parser contract.
const EQUIVALENCY_RESPONSE_SHA256 =
  '05536558dd8ee2d16e2b5ffac680f7c460e1c244b4569d16b18c322dd21bd9a9';
const ROBOTS_RESPONSE_SHA256 =
  'b1282f723cd580b0cf3c38125d24259ceab3b897d38b63376d9fa6c302558fcf';
const QUANTITY_FACTS_SHA256 =
  'e655ca8c1cc0bdef35326d1ce52cc32ee05d87c9f28b4e342f9031ac4942f300';

const EXPECTED_TITLE =
  'VCCS Equivalencies Summer 2026 - Spring 2027 | transferguide.registrar | Virginia Tech';
const EXPECTED_HEADER = Object.freeze([
  'VCCS Course Number',
  'VCCS Course Title',
  'VCCS Credits',
  'VT Course Number',
  'VT Course Title',
  'VT Credits',
  'Comments',
]);
const EXPECTED_ROWS = Object.freeze({
  CSC222: Object.freeze([
    'CSC 222',
    'Object-Oriented Programming',
    '4',
    'CS 1114 + CS 1XXX',
    'Introduction to Software Design and Computer Science Elective',
    '3+1',
    'If taught in a language other than Java, please see your advisor.',
  ]),
  CSC223: Object.freeze([
    'CSC 223',
    'Data Structures and Analysis of Algorithms',
    '4',
    'CS 2114 + CS 2XXX',
    'Software Design and Data Structures + Computer Science Elective',
    '3+1',
    '',
  ]),
  EGR122: Object.freeze([
    'EGR 122',
    'Engineering Design',
    '3',
    'ENGE 1216 + ENGE 1XXX',
    'Foundations of Engineering + Engineering Education Elective',
    '2+1',
    '',
  ]),
});
const SEMANTIC_ROWS = Object.freeze({
  CSC222: Object.freeze({
    sending_code: 'CSC222',
    sending_units: 4,
    named_receiving_code: 'CS1114',
    named_receiving_units: 3,
    elective_receiving_code: 'CS1XXX',
    elective_receiving_units: 1,
    total_receiving_units: 4,
    language_condition: 'java_or_advisor_review',
  }),
  CSC223: Object.freeze({
    sending_code: 'CSC223',
    sending_units: 4,
    named_receiving_code: 'CS2114',
    named_receiving_units: 3,
    elective_receiving_code: 'CS2XXX',
    elective_receiving_units: 1,
    total_receiving_units: 4,
    language_condition: null,
  }),
  EGR122: Object.freeze({
    sending_code: 'EGR122',
    sending_units: 3,
    named_receiving_code: 'ENGE1216',
    named_receiving_units: 2,
    elective_receiving_code: 'ENGE1XXX',
    elective_receiving_units: 1,
    total_receiving_units: 3,
    language_condition: null,
  }),
});

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function robotsAllows(robotsText, url = EQUIVALENCY_URL) {
  const source = String(robotsText || '');
  if (!source.trim()) return false;
  const target = new URL(url).pathname;
  const disallowed = source.split(/\r?\n/)
    .map((line) => /^\s*Disallow:\s*(\S*)\s*$/i.exec(line)?.[1] || null)
    .filter(Boolean);
  return !disallowed.some((prefix) => target.startsWith(prefix));
}

function parseVirginiaTechEquivalencyQuantityEvidence(html, {
  requestedUrl = EQUIVALENCY_URL,
  finalUrl = EQUIVALENCY_URL,
  contentType = 'text/html',
  robotsText = '',
  robotsStatus = 200,
  robotsRequestedUrl = ROBOTS_URL,
  robotsFinalUrl = ROBOTS_FINAL_URL,
  robotsContentType = 'text/plain',
  capturedAt = null,
} = {}) {
  const source = String(html || '');
  const robotsSource = String(robotsText || '');
  const issues = [];
  const $ = cheerio.load(source);
  const title = normalize($('title').text());
  const tables = $('table');
  if (requestedUrl !== EQUIVALENCY_URL || finalUrl !== EQUIVALENCY_URL) {
    issues.push('source_url');
  }
  if (!String(contentType || '').toLowerCase().includes('text/html')) {
    issues.push('content_type');
  }
  if (title !== EXPECTED_TITLE) issues.push('document_title');
  if (tables.length !== 1) issues.push('unique_equivalency_table');

  const table = tables.first();
  const header = table.find('tr').first().children()
    .map((index, element) => normalize($(element).text())).get();
  if (JSON.stringify(header) !== JSON.stringify(EXPECTED_HEADER)) {
    issues.push('table_header');
  }

  const exactRows = {};
  for (const [code, expectedCells] of Object.entries(EXPECTED_ROWS)) {
    const displayCode = expectedCells[0];
    const matches = table.find('tr').filter((index, element) => (
      normalize($(element).find('td').first().text()) === displayCode
    ));
    if (matches.length !== 1) {
      issues.push(`${code.toLowerCase()}_unique_row`);
      continue;
    }
    const row = matches.first();
    const cells = row.find('td')
      .map((index, element) => normalize($(element).text())).get();
    if (JSON.stringify(cells) !== JSON.stringify(expectedCells)) {
      issues.push(`${code.toLowerCase()}_exact_cells`);
    }
    exactRows[code] = {
      cells,
      fragment_sha256: sha256($.html(row)),
    };
  }

  if (robotsRequestedUrl !== ROBOTS_URL
      || robotsFinalUrl !== ROBOTS_FINAL_URL
      || new URL(robotsRequestedUrl).origin !== new URL(robotsFinalUrl).origin
      || robotsStatus !== 200
      || !String(robotsContentType || '').toLowerCase().includes('text/plain')
      || !robotsAllows(robotsSource)) {
    issues.push('robots_policy');
  }

  const quantityFacts = {
    catalog_window: 'Summer 2026 - Spring 2027',
    rows: Object.fromEntries(Object.entries(SEMANTIC_ROWS).map(([code, row]) => [
      code,
      { ...row, exact_cells: exactRows[code]?.cells || null },
    ])),
  };
  return {
    verified: issues.length === 0,
    issues,
    source: {
      requested_url: requestedUrl,
      final_url: finalUrl,
      content_type: contentType,
      response_bytes: Buffer.byteLength(source),
      response_sha256: sha256(source),
      captured_at: capturedAt,
      title,
      table_count: tables.length,
      header,
      exact_rows: exactRows,
    },
    robots: {
      requested_url: robotsRequestedUrl,
      final_url: robotsFinalUrl,
      http_status: robotsStatus,
      content_type: robotsContentType,
      response_bytes: Buffer.byteLength(robotsSource),
      response_sha256: sha256(robotsSource),
      same_host_redirect: new URL(robotsRequestedUrl).origin
        === new URL(robotsFinalUrl).origin,
      equivalency_path_allowed: robotsAllows(robotsSource),
    },
    quantity_facts: quantityFacts,
    quantity_facts_sha256: sha256(JSON.stringify(quantityFacts)),
  };
}

function buildVirginiaTechEquivalencyQuantityEvidence(html, options = {}) {
  const parsed = parseVirginiaTechEquivalencyQuantityEvidence(html, options);
  if (!parsed.verified) {
    throw new Error(`Virginia Tech equivalency quantity evidence did not verify: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: {
      name: 'Virginia Polytechnic Institute and State University',
      slug: 'virginia-polytechnic-institute-and-state-university',
      school_id: 9230,
    },
    purpose:
      'Exact official receiving-credit quantities for the selected CSC 223 and EGR 122 Virginia Tech equivalencies. The separate CSC 222 Java/advisor condition remains unresolved without college-specific language evidence.',
    ...parsed,
    paper_interpretation: {
      quantity_resolution_codes: ['CSC223', 'EGR122'],
      csc222_quantity_known: true,
      csc222_language_condition_resolved: false,
      generic_variable_credit_rule_inferred: false,
    },
  };
}

function virginiaTechEquivalencyQuantityEvidenceIssue(evidence) {
  const facts = evidence?.quantity_facts;
  const interpretation = evidence?.paper_interpretation;
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== ARTIFACT
      || evidence?.verified !== true
      || (evidence?.issues || []).length !== 0
      || evidence?.institution?.school_id !== 9230
      || evidence?.source?.requested_url !== EQUIVALENCY_URL
      || evidence?.source?.final_url !== EQUIVALENCY_URL
      || evidence?.source?.response_sha256 !== EQUIVALENCY_RESPONSE_SHA256
      || evidence?.robots?.requested_url !== ROBOTS_URL
      || evidence?.robots?.final_url !== ROBOTS_FINAL_URL
      || evidence?.robots?.http_status !== 200
      || evidence?.robots?.response_sha256 !== ROBOTS_RESPONSE_SHA256
      || evidence?.robots?.same_host_redirect !== true
      || evidence?.robots?.equivalency_path_allowed !== true
      || evidence?.quantity_facts_sha256 !== QUANTITY_FACTS_SHA256
      || sha256(JSON.stringify(facts)) !== QUANTITY_FACTS_SHA256) {
    return 'the exact official Virginia Tech equivalency quantity receipt changed';
  }
  if (facts?.catalog_window !== 'Summer 2026 - Spring 2027'
      || JSON.stringify(Object.keys(facts?.rows || {}).sort())
        !== JSON.stringify(['CSC222', 'CSC223', 'EGR122'])
      || JSON.stringify(interpretation?.quantity_resolution_codes)
        !== JSON.stringify(['CSC223', 'EGR122'])
      || interpretation?.csc222_quantity_known !== true
      || interpretation?.csc222_language_condition_resolved !== false
      || interpretation?.generic_variable_credit_rule_inferred !== false) {
    return 'the Virginia Tech equivalency evidence no longer supports the bounded quantity interpretation';
  }
  for (const [code, expected] of Object.entries(SEMANTIC_ROWS)) {
    const actual = facts.rows[code];
    if (!actual
        || JSON.stringify(Object.fromEntries(Object.keys(expected).map((key) => [key, actual[key]])))
          !== JSON.stringify(expected)
        || JSON.stringify(actual.exact_cells) !== JSON.stringify(EXPECTED_ROWS[code])) {
      return `the exact Virginia Tech ${code} quantity fact changed`;
    }
  }
  return null;
}

module.exports = {
  ARTIFACT,
  EQUIVALENCY_RESPONSE_SHA256,
  EQUIVALENCY_URL,
  EXPECTED_HEADER,
  EXPECTED_ROWS,
  QUANTITY_FACTS_SHA256,
  ROBOTS_FINAL_URL,
  ROBOTS_RESPONSE_SHA256,
  ROBOTS_URL,
  SEMANTIC_ROWS,
  USER_AGENT,
  buildVirginiaTechEquivalencyQuantityEvidence,
  normalize,
  parseVirginiaTechEquivalencyQuantityEvidence,
  robotsAllows,
  sha256,
  virginiaTechEquivalencyQuantityEvidenceIssue,
};
