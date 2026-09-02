const crypto = require('node:crypto');

const BROWSER_CHALLENGE_CONTRACT =
  'known_courseleaf_host_exact_same_url_document_202_then_200_raw_response_v1';
const SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT =
  'shenandoah_acalog_exact_same_url_document_202_then_200_raw_response_v1';
const BROWSER_ROBOTS_CONTRACT =
  'known_courseleaf_host_browser_challenge_robots_policy_and_exact_path_allowance_v1';
const VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT =
  'virginia_tech_official_sitemap_exact_department_path_discovery_v1';

const JMU_SLUG = 'james-madison-university';
const JMU_HOST = 'catalog.jmu.edu';
const JMU_CATALOG_YEAR = '2026-2027';
const JMU_COURSELEAF_SUBJECT_ROUTES = Object.freeze({
  CS: '/courses/cs/',
  MATH: '/courses/math/',
});

const VIRGINIA_TECH_SLUG = 'virginia-polytechnic-institute-and-state-university';
const VIRGINIA_TECH_HOST = 'catalog.vt.edu';
const VIRGINIA_TECH_SITEMAP_PATH = '/sitemap.xml';
const VIRGINIA_TECH_SITEMAP_URL = `https://${VIRGINIA_TECH_HOST}${VIRGINIA_TECH_SITEMAP_PATH}`;

// Each path below was discovered as an exact <loc> in the current official
// sitemap, then checked against the page's complete CourseLeaf courseblock
// roster. A prefix is never routed to a degree-plan page or inferred from a
// departmental name alone.
const VIRGINIA_TECH_COURSELEAF_SUBJECT_ROUTES = Object.freeze({
  AOE: '/undergraduate/college-engineering/aerospace-ocean-engineering/',
  ART: '/undergraduate/architecture-arts-design/school-visual-arts/',
  BIOL: '/undergraduate/college-science/biological-sciences/',
  BIT: '/undergraduate/pamplin-college-business/business-information-technology/',
  CEM: '/undergraduate/college-engineering/construction-engineering-management/',
  CHEM: '/undergraduate/college-science/chemistry/',
  CMDA: '/undergraduate/college-science/computational-modeling-data-analytics/',
  COMM: '/undergraduate/liberal-arts-human-sciences/communication/',
  ECE: '/undergraduate/college-engineering/electrical-computer-engineering/',
  ENGE: '/undergraduate/college-engineering/engineering-education/',
  ENGL: '/undergraduate/liberal-arts-human-sciences/english/',
  GEOG: '/undergraduate/natural-resources-environment/geography/',
  GEOS: '/undergraduate/college-science/geosciences/',
  MATH: '/undergraduate/college-science/mathematics/',
  ME: '/undergraduate/college-engineering/mechanical-engineering/',
  MUS: '/undergraduate/architecture-arts-design/music/',
  PHYS: '/undergraduate/college-science/physics/',
  PSCI: '/undergraduate/liberal-arts-human-sciences/political-science/',
  STAT: '/undergraduate/college-science/statistics/',
  STS: '/undergraduate/liberal-arts-human-sciences/science-technology-society/',
});

// These exact subject-index paths are a second, separately bounded CourseLeaf
// surface in the same official catalog. They are used only for recursive
// prerequisite-closure keys that are absent from the degree-derived candidate
// set; the established department-page captures above remain unchanged.
// Every path is required to occur verbatim in the captured official sitemap.
const VIRGINIA_TECH_COURSE_DESCRIPTION_SUBJECT_ROUTES = Object.freeze({
  ACIS: '/course-descriptions/acis/',
  BC: '/course-descriptions/bc/',
  CEE: '/course-descriptions/cee/',
  CHEM: '/course-descriptions/chem/',
  ECON: '/course-descriptions/econ/',
  ESM: '/course-descriptions/esm/',
  FIN: '/course-descriptions/fin/',
  ISC: '/course-descriptions/isc/',
  ISE: '/course-descriptions/ise/',
  MATH: '/course-descriptions/math/',
  ME: '/course-descriptions/me/',
  REAL: '/course-descriptions/real/',
  UAP: '/course-descriptions/uap/',
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const isSha256 = (value) => /^[a-f0-9]{64}$/.test(String(value || ''));

function expectedBrowserCoursePath(slug, prefix) {
  const normalized = String(prefix || '').toUpperCase();
  if (slug === JMU_SLUG) return JMU_COURSELEAF_SUBJECT_ROUTES[normalized] || null;
  if (slug === VIRGINIA_TECH_SLUG) {
    return VIRGINIA_TECH_COURSELEAF_SUBJECT_ROUTES[normalized] || null;
  }
  return null;
}

function expectedBrowserCoursePaths(slug, prefix) {
  const normalized = String(prefix || '').toUpperCase();
  if (slug === JMU_SLUG) {
    return [JMU_COURSELEAF_SUBJECT_ROUTES[normalized]].filter(Boolean);
  }
  if (slug === VIRGINIA_TECH_SLUG) {
    return [...new Set([
      VIRGINIA_TECH_COURSELEAF_SUBJECT_ROUTES[normalized],
      VIRGINIA_TECH_COURSE_DESCRIPTION_SUBJECT_ROUTES[normalized],
    ].filter(Boolean))];
  }
  return [];
}

function exactKnownBrowserResource({ slug, platform, officialUrl, targetSubjectPrefix = null }) {
  let parsed;
  try { parsed = new URL(officialUrl); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.search || parsed.hash) return false;
  if (platform === 'browser_challenge_sitemap') {
    return slug === VIRGINIA_TECH_SLUG && parsed.href === VIRGINIA_TECH_SITEMAP_URL;
  }
  if (platform !== 'browser_challenge_courseleaf') return false;
  const expectedPaths = expectedBrowserCoursePaths(slug, targetSubjectPrefix);
  const expectedHost = slug === JMU_SLUG ? JMU_HOST
    : (slug === VIRGINIA_TECH_SLUG ? VIRGINIA_TECH_HOST : null);
  return Boolean(expectedPaths.length && expectedHost
    && parsed.hostname.toLowerCase() === expectedHost
    && expectedPaths.includes(parsed.pathname)
    && parsed.href === `https://${expectedHost}${parsed.pathname}`);
}

function browserDocumentLooksLikeInterstitial(body) {
  const html = String(body || '');
  return /<title>[^<]*(?:access denied|not found|login|captcha)/i.test(html)
    || /cf-chl-|challenge-platform/i.test(html)
    || /(?:id|class)=["'][^"']*(?:g-recaptcha|h-captcha|captcha-container|captcha-challenge)/i
      .test(html)
    || /<(?:iframe|script)[^>]+(?:recaptcha|hcaptcha)/i.test(html);
}

function validateBrowserChallengeReceipt(receipt, {
  expectedUrl,
  expectedFinalContentType,
  expectedFinalSha256 = null,
  expectedContract = BROWSER_CHALLENGE_CONTRACT,
} = {}) {
  const issues = [];
  const rows = Array.isArray(receipt?.document_responses)
    ? receipt.document_responses : [];
  if (![BROWSER_CHALLENGE_CONTRACT, SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT]
    .includes(expectedContract)) issues.push('expected_contract');
  if (receipt?.contract !== expectedContract) issues.push('contract');
  if (receipt?.requested_url !== expectedUrl || receipt?.exact_same_url !== true) {
    issues.push('requested_url');
  }
  if (receipt?.document_response_count !== 2 || rows.length !== 2) issues.push('response_count');
  const [challenge, final] = rows;
  if (challenge?.ordinal !== 1 || challenge?.http_status !== 202
      || challenge?.url !== expectedUrl
      || !String(challenge?.content_type || '').toLowerCase().includes('text/html')
      || !(challenge?.byte_length > 0) || !isSha256(challenge?.content_sha256)
      || !String(challenge?.cache_path || '').endsWith('.challenge.html')) {
    issues.push('challenge_response');
  }
  if (final?.ordinal !== 2 || final?.http_status !== 200 || final?.url !== expectedUrl
      || !String(final?.content_type || '').toLowerCase()
        .includes(String(expectedFinalContentType || '').toLowerCase())
      || !(final?.byte_length > 0) || !isSha256(final?.content_sha256)
      || !String(final?.cache_path || '')) {
    issues.push('final_response');
  }
  if (expectedFinalSha256 && final?.content_sha256 !== expectedFinalSha256) {
    issues.push('final_response_hash');
  }
  return { valid: issues.length === 0, issues };
}

function validateBrowserRobotsReceipt(receipt, { origin, checkedPath } = {}) {
  const issues = [];
  const expectedUrl = `${origin}/robots.txt`;
  const capture = validateBrowserChallengeReceipt(receipt?.capture, {
    expectedUrl,
    expectedFinalContentType: 'text/plain',
  });
  if (receipt?.contract !== BROWSER_ROBOTS_CONTRACT) issues.push('contract');
  if (!capture.valid) issues.push(...capture.issues.map((issue) => `capture:${issue}`));
  if (receipt?.nonempty_final_body !== true || receipt?.checked_path !== checkedPath
      || receipt?.path_allowed !== true
      || !Number.isInteger(receipt?.parsed_policy?.rule_count)
      || receipt.parsed_policy.rule_count < 1
      || !(receipt?.parsed_policy?.crawl_delay_seconds >= 0)
      || !isSha256(receipt?.parsed_policy?.policy_sha256)) {
    issues.push('policy');
  }
  return { valid: issues.length === 0, issues };
}

function extractSitemapLocations(xml, expectedOrigin = `https://${VIRGINIA_TECH_HOST}`) {
  const rows = [];
  const invalid = [];
  for (const match of String(xml || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    let parsed;
    try { parsed = new URL(match[1].replace(/&amp;/g, '&')); } catch {
      invalid.push(match[1]);
      continue;
    }
    if (parsed.origin !== expectedOrigin || parsed.search || parsed.hash) {
      invalid.push(parsed.href);
      continue;
    }
    rows.push(parsed.href);
  }
  const locations = [...new Set(rows)].sort();
  return {
    valid: invalid.length === 0 && locations.length > 0 && locations.length === rows.length,
    invalid,
    locations,
    locations_sha256: sha256(JSON.stringify(locations)),
  };
}

module.exports = {
  BROWSER_CHALLENGE_CONTRACT,
  BROWSER_ROBOTS_CONTRACT,
  JMU_COURSELEAF_SUBJECT_ROUTES,
  JMU_CATALOG_YEAR,
  JMU_HOST,
  JMU_SLUG,
  SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
  VIRGINIA_TECH_COURSE_DESCRIPTION_SUBJECT_ROUTES,
  VIRGINIA_TECH_COURSELEAF_SUBJECT_ROUTES,
  VIRGINIA_TECH_HOST,
  VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
  VIRGINIA_TECH_SITEMAP_PATH,
  VIRGINIA_TECH_SITEMAP_URL,
  VIRGINIA_TECH_SLUG,
  browserDocumentLooksLikeInterstitial,
  exactKnownBrowserResource,
  expectedBrowserCoursePath,
  expectedBrowserCoursePaths,
  extractSitemapLocations,
  validateBrowserChallengeReceipt,
  validateBrowserRobotsReceipt,
};
