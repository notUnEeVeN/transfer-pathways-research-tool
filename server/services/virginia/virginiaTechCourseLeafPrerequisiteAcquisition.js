const crypto = require('node:crypto');
const cheerio = require('cheerio');

const VIRGINIA_TECH_SLUG = 'virginia-polytechnic-institute-and-state-university';
const VIRGINIA_TECH_HOST = 'catalog.vt.edu';
const VIRGINIA_TECH_CATALOG_YEAR = '2026-2027';
const VIRGINIA_TECH_CS_DEPARTMENT_URL =
  'https://catalog.vt.edu/undergraduate/college-engineering/computer-science/';
const VIRGINIA_TECH_CS_HTML_CACHE_PATH =
  'pages/virginia-polytechnic-institute-and-state-university__college.html';
const VIRGINIA_TECH_CS_TEXT_CACHE_PATH =
  'pages/virginia-polytechnic-institute-and-state-university__college.txt';
const VIRGINIA_TECH_CS_HTML_SHA256 =
  '89225dfa30ddcfdedca1fd6ec6f26b7ea220979589a97d874b69cf98dc95fbc4';
const VIRGINIA_TECH_CS_TEXT_SHA256 =
  'f528785a2ea8c8a37442ed618c72c61dd9064f7781084849613631e7820e618e';
const VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT =
  'retained_official_2026_2027_department_whole_response_and_exact_courseblock_v1';
const VIRGINIA_TECH_CS_EXPECTED_COURSEBLOCK_COUNT = 74;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function verifyVirginiaTechCsRetainedSource({ htmlBytes, textBytes }) {
  const html = Buffer.isBuffer(htmlBytes) ? htmlBytes : Buffer.from(String(htmlBytes || ''));
  const text = Buffer.isBuffer(textBytes) ? textBytes : Buffer.from(String(textBytes || ''));
  const $ = cheerio.load(html.toString('utf8'));
  const issues = [];
  const htmlSha256 = sha256(html);
  const textSha256 = sha256(text);
  if (htmlSha256 !== VIRGINIA_TECH_CS_HTML_SHA256) issues.push('html_sha256');
  if (textSha256 !== VIRGINIA_TECH_CS_TEXT_SHA256) issues.push('text_sha256');
  if (!String($('title').first().text()).includes('Computer Science | Virginia Tech Academic Catalog')) {
    issues.push('page_title');
  }
  if (!String($('body').text()).includes(VIRGINIA_TECH_CATALOG_YEAR)) issues.push('catalog_year');
  if (!String($('#coursestextcontainer h2').first().text())
    .includes('Undergraduate Course Descriptions (CS)')) issues.push('subject_heading');
  const courseblockCount = $('.courseblock').length;
  if (courseblockCount !== VIRGINIA_TECH_CS_EXPECTED_COURSEBLOCK_COUNT) {
    issues.push('courseblock_count');
  }
  const codes = [];
  $('.courseblock').each((_, element) => {
    const heading = $(element).children().first().text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const match = /^CS\s+(\d{4}[A-Z]?)\b/.exec(heading);
    if (match) codes.push(`CS${match[1]}`);
  });
  if (codes.length !== courseblockCount || new Set(codes).size !== codes.length) {
    issues.push('unique_cs_courseblock_headings');
  }
  return {
    verified: issues.length === 0,
    issues,
    official_url: VIRGINIA_TECH_CS_DEPARTMENT_URL,
    catalog_year: VIRGINIA_TECH_CATALOG_YEAR,
    html_sha256: htmlSha256,
    text_sha256: textSha256,
    courseblock_count: courseblockCount,
    exact_course_codes: codes,
  };
}

module.exports = {
  VIRGINIA_TECH_CATALOG_YEAR,
  VIRGINIA_TECH_CS_DEPARTMENT_URL,
  VIRGINIA_TECH_CS_EXPECTED_COURSEBLOCK_COUNT,
  VIRGINIA_TECH_CS_HTML_CACHE_PATH,
  VIRGINIA_TECH_CS_HTML_SHA256,
  VIRGINIA_TECH_CS_TEXT_CACHE_PATH,
  VIRGINIA_TECH_CS_TEXT_SHA256,
  VIRGINIA_TECH_HOST,
  VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT,
  VIRGINIA_TECH_SLUG,
  verifyVirginiaTechCsRetainedSource,
};
