#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  parseRobots,
  responseCachePath,
  robotsAllows,
  sha256,
} = require('../../services/virginia/universityPrerequisiteAcquisition');
const {
  SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
  validateBrowserChallengeReceipt,
} = require('../../services/virginia/browserChallengeCourseLeafAcquisition');
const {
  SHENANDOAH_CATALOG_YEAR,
  SHENANDOAH_CATOID,
  SHENANDOAH_COURSE_CATALOG_CACHE_PATH,
  SHENANDOAH_COURSE_CATALOG_HTML_SHA256,
  SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
  SHENANDOAH_FILTER_DISCOVERY_TARGETS,
  SHENANDOAH_HOST,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  SHENANDOAH_SLUG,
  expectedFilterDiscoveryUrl,
  extractShenandoahFilteredDiscovery,
  verifyShenandoahCourseCatalogFilterForm,
} = require('../../services/virginia/shenandoahAcalogPrerequisiteAcquisition');
const {
  captureBrowserChallengeDocument,
} = require('./acquireUniversityPrerequisites');

const SERVER = path.resolve(__dirname, '../..');
const CACHE = path.join(SERVER, '.va-catalogs');
const OUTPUT = path.join(
  CACHE, 'research', 'shenandoah-acalog-course-discovery.json',
);
const FETCH = process.argv.includes('--fetch');
const WRITE = process.argv.includes('--write');
const REFRESH = process.argv.includes('--refresh');
const allowed = new Set(['--fetch', '--write', '--refresh']);
const unknown = process.argv.slice(2).filter((arg) => !allowed.has(arg));
if (unknown.length) {
  console.error(`unknown option(s): ${unknown.join(', ')}`);
  process.exit(2);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const absoluteCachePath = (relative) => {
  const resolved = path.resolve(CACHE, relative);
  if (!resolved.startsWith(`${CACHE}${path.sep}`)) throw new Error(`unsafe cache path: ${relative}`);
  return resolved;
};

function discoveryRoutes() {
  return Object.keys(SHENANDOAH_FILTER_DISCOVERY_TARGETS).sort().map((code) => ({
    route_id: `${SHENANDOAH_SLUG}__${code.toLowerCase()}_discovery`,
    school_id: 9224,
    slug: SHENANDOAH_SLUG,
    owner_namespace: 'va:uni:9224',
    platform: 'shenandoah_acalog_filter_discovery',
    catalog_year: SHENANDOAH_CATALOG_YEAR,
    official_url: expectedFilterDiscoveryUrl(code),
    official_host: SHENANDOAH_HOST,
    target_course_codes: [code],
    target_count: 1,
    boundary_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
    catoid: SHENANDOAH_CATOID,
    required_crawl_delay_seconds: SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  }));
}

function latestShenandoahFetchTime() {
  const directory = path.join(
    CACHE, 'university-prerequisites', 'raw', SHENANDOAH_SLUG,
  );
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try { return Date.parse(readJson(path.join(directory, name)).fetched_at) || 0; } catch { return 0; }
    })
    .reduce((latest, value) => Math.max(latest, value), 0);
}

async function respectPriorHostDelay() {
  const latest = latestShenandoahFetchTime();
  const remaining = SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS * 1000
    - (Date.now() - latest);
  if (remaining > 0) await sleep(remaining + 1000);
}

function retainedRobotsReceipt() {
  const directory = path.join(CACHE, 'university-prerequisites', 'raw', '_robots');
  const metadataPath = path.join(directory, `${SHENANDOAH_HOST}.json`);
  const bodyPath = path.join(directory, `${SHENANDOAH_HOST}.txt`);
  const metadata = readJson(metadataPath);
  const bytes = fs.readFileSync(bodyPath);
  const policy = parseRobots(bytes.toString('utf8'));
  if (metadata.requested_url !== `https://${SHENANDOAH_HOST}/robots.txt`
      || metadata.final_url !== metadata.requested_url
      || metadata.http_status !== 200
      || metadata.content_sha256 !== sha256(bytes)
      || policy.crawl_delay_seconds !== SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS
      || !robotsAllows(policy, '/content.php')) {
    throw new Error('retained Shenandoah robots receipt drifted');
  }
  return {
    url: metadata.final_url,
    http_status: metadata.http_status,
    content_sha256: metadata.content_sha256,
    crawl_delay_seconds: policy.crawl_delay_seconds,
  };
}

async function captureBrowserDiscoveries(routes = discoveryRoutes()) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const robots = retainedRobotsReceipt();
  let lastRequestAt = latestShenandoahFetchTime();
  try {
    for (const route of routes) {
      const remaining = SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS * 1000
        - (Date.now() - lastRequestAt);
      if (remaining > 0) {
        console.log(`waiting ${Math.ceil(remaining / 1000)}s for Shenandoah crawl delay`);
        await sleep(remaining + 1000);
      }
      const cachePath = responseCachePath(route);
      const metadataPath = cachePath.replace(/\.html$/, '.json');
      const challengePath = cachePath.replace(/\.html$/, '.challenge.html');
      const result = await captureBrowserChallengeDocument(browser, {
        url: route.official_url,
        expectedHost: SHENANDOAH_HOST,
        expectedFinalContentType: 'text/html',
        challengeCachePath: challengePath,
        finalCachePath: cachePath,
        receiptContract: SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
      });
      const final = result.receipt.document_responses[1];
      const metadata = {
        requested_url: route.official_url,
        final_url: final.url,
        http_status: final.http_status,
        content_type: final.content_type,
        byte_length: final.byte_length,
        content_sha256: final.content_sha256,
        fetched_at: new Date().toISOString(),
        capture_status: 'official_html_captured',
        blocked_reason: null,
        robots,
        browser_challenge_cache_path: challengePath,
        browser_challenge_receipt: result.receipt,
      };
      for (const relative of [cachePath, challengePath, metadataPath]) {
        fs.mkdirSync(path.dirname(absoluteCachePath(relative)), { recursive: true });
      }
      fs.writeFileSync(absoluteCachePath(cachePath), result.finalBytes);
      fs.writeFileSync(absoluteCachePath(challengePath), result.challengeBytes);
      fs.writeFileSync(
        absoluteCachePath(metadataPath), `${JSON.stringify(metadata, null, 2)}\n`,
      );
      lastRequestAt = Date.parse(metadata.fetched_at);
      console.log(`captured ${route.target_course_codes[0]} through exact 202→200 browser receipt`);
    }
  } finally {
    await browser.close();
  }
}

function uncachedDiscoveryRoutes(routes = discoveryRoutes(), exists = fs.existsSync) {
  return routes.filter((route) => {
    const cachePath = responseCachePath(route);
    const paths = [
      cachePath,
      cachePath.replace(/\.html$/, '.challenge.html'),
      cachePath.replace(/\.html$/, '.json'),
    ].map((relative) => absoluteCachePath(relative));
    const present = paths.map((file) => exists(file));
    if (present.some(Boolean) && !present.every(Boolean)) {
      throw new Error(`${route.target_course_codes[0]} has an incomplete retained discovery receipt`);
    }
    return !present.every(Boolean);
  });
}

function buildArtifact() {
  const formPath = absoluteCachePath(SHENANDOAH_COURSE_CATALOG_CACHE_PATH);
  const formBytes = fs.readFileSync(formPath);
  const form = verifyShenandoahCourseCatalogFilterForm(formBytes.toString('utf8'));
  if (!form.verified || sha256(formBytes) !== SHENANDOAH_COURSE_CATALOG_HTML_SHA256) {
    throw new Error(`retained Shenandoah filter-form verification failed: ${form.issues.join(',')}`);
  }
  const discoveries = discoveryRoutes().map((route) => {
    const cachePath = responseCachePath(route);
    const metadataPath = cachePath.replace(/\.html$/, '.json');
    const bytes = fs.readFileSync(absoluteCachePath(cachePath));
    const metadata = readJson(absoluteCachePath(metadataPath));
    let browserTransportVerified = true;
    if (metadata.browser_challenge_receipt) {
      const challengePath = metadata.browser_challenge_cache_path;
      const challengeBytes = fs.readFileSync(absoluteCachePath(challengePath));
      const validation = validateBrowserChallengeReceipt(
        metadata.browser_challenge_receipt,
        {
          expectedUrl: route.official_url,
          expectedFinalContentType: 'text/html',
          expectedFinalSha256: sha256(bytes),
          expectedContract: SHENANDOAH_ACALOG_BROWSER_CHALLENGE_CONTRACT,
        },
      );
      const [challenge, final] = metadata.browser_challenge_receipt.document_responses || [];
      browserTransportVerified = validation.valid
        && challenge?.content_sha256 === sha256(challengeBytes)
        && challenge?.cache_path === challengePath
        && final?.cache_path === cachePath;
    }
    const commonTransportVerified = browserTransportVerified
      && metadata.requested_url === route.official_url
      && metadata.content_sha256 === sha256(bytes)
      && metadata.final_url === route.official_url
      && metadata.robots?.http_status === 200
      && metadata.robots?.crawl_delay_seconds
        === SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS
      && /^[a-f0-9]{64}$/.test(metadata.robots?.content_sha256 || '');
    if (!commonTransportVerified) {
      throw new Error(`${route.target_course_codes[0]} filtered discovery transport drifted`);
    }
    if (metadata.capture_status === 'blocked_fail_closed') {
      if (metadata.blocked_reason
            !== 'response_failed_status_content_type_or_interstitial_check'
          || metadata.http_status === 200) {
        throw new Error(`${route.target_course_codes[0]} unexpected blocked filter response`);
      }
      return {
        course_code: route.target_course_codes[0],
        status: 'official_filter_response_not_usable',
        title: SHENANDOAH_FILTER_DISCOVERY_TARGETS[route.target_course_codes[0]].title,
        catalog_year: SHENANDOAH_CATALOG_YEAR,
        catoid: SHENANDOAH_CATOID,
        coid: null,
        discovery_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
        retained_filter_form_cache_path: SHENANDOAH_COURSE_CATALOG_CACHE_PATH,
        retained_filter_form_sha256: SHENANDOAH_COURSE_CATALOG_HTML_SHA256,
        official_url: route.official_url,
        final_url: metadata.final_url,
        cache_path: cachePath,
        metadata_cache_path: metadataPath,
        ...(metadata.browser_challenge_receipt ? {
          browser_challenge_cache_path: metadata.browser_challenge_cache_path,
          browser_challenge_receipt: metadata.browser_challenge_receipt,
        } : {}),
        source_response_sha256: metadata.content_sha256,
        source_response_bytes: metadata.byte_length,
        fetched_at: metadata.fetched_at,
        robots: metadata.robots,
        exact_link_receipt: null,
        transport_blocker: {
          http_status: metadata.http_status,
          content_type: metadata.content_type,
          reason: metadata.blocked_reason,
        },
        absence_boundary: 'The official filter request did not return a usable HTTP 200 catalog response. This proves neither course absence nor no prerequisites and leaves acquisition blocked.',
      };
    }
    const parsed = extractShenandoahFilteredDiscovery(
      bytes.toString('utf8'), route.target_course_codes[0], { finalUrl: metadata.final_url },
    );
    const exactAbsence = !parsed.verified && parsed.link == null
      && JSON.stringify(parsed.issues) === JSON.stringify([
        'unique_exact_filtered_course_link',
      ]);
    if (metadata.capture_status !== 'official_html_captured'
        || metadata.http_status !== 200
        || (!parsed.verified && !exactAbsence)) {
      throw new Error(
        `${route.target_course_codes[0]} filtered discovery failed: ${parsed.issues.join(',')}`,
      );
    }
    return {
      course_code: route.target_course_codes[0],
      status: parsed.verified
        ? 'exact_current_course_identity'
        : 'exact_filter_response_without_current_course_identity',
      title: parsed.link?.title
        || SHENANDOAH_FILTER_DISCOVERY_TARGETS[route.target_course_codes[0]].title,
      catalog_year: SHENANDOAH_CATALOG_YEAR,
      catoid: SHENANDOAH_CATOID,
      coid: parsed.link?.coid || null,
      discovery_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
      retained_filter_form_cache_path: SHENANDOAH_COURSE_CATALOG_CACHE_PATH,
      retained_filter_form_sha256: SHENANDOAH_COURSE_CATALOG_HTML_SHA256,
      official_url: route.official_url,
      final_url: metadata.final_url,
      cache_path: cachePath,
      metadata_cache_path: metadataPath,
      ...(metadata.browser_challenge_receipt ? {
        browser_challenge_cache_path: metadata.browser_challenge_cache_path,
        browser_challenge_receipt: metadata.browser_challenge_receipt,
      } : {}),
      source_response_sha256: metadata.content_sha256,
      source_response_bytes: metadata.byte_length,
      fetched_at: metadata.fetched_at,
      robots: metadata.robots,
      exact_link_receipt: parsed.link,
      absence_boundary: parsed.verified ? null
        : 'The exact current prefix/number filter response has no unique exact course link. This blocks acquisition and does not mean that the course has no prerequisites.',
    };
  });
  return {
    schema_version: 1,
    artifact: 'shenandoah_exact_current_acalog_course_discovery',
    publication_ready: false,
    source_boundary: 'The retained 2025-2026 Course Descriptions form is hash-pinned, and each exact prefix/number request is robots-permitted and captured at the published 120-second delay. An AWS-WAF response is usable only with an exact same-URL browser receipt retaining both the HTTP 202 challenge and the resulting HTTP 200 catalog document. Only a usable HTTP 200 exact-filter response may prove one current catoid/coid/title identity or an exact-filter absence; every other response is retained solely as a transport blocker and proves neither course absence nor no prerequisites.',
    summary: {
      exact_filter_queries: discoveries.length,
      exact_current_course_identities: discoveries.filter((row) => (
        row.status === 'exact_current_course_identity'
      )).length,
      exact_filter_responses_without_current_course_identity: discoveries.filter((row) => (
        row.status === 'exact_filter_response_without_current_course_identity'
      )).length,
      unusable_official_filter_responses: discoveries.filter((row) => (
        row.status === 'official_filter_response_not_usable'
      )).length,
    },
    discoveries,
  };
}

function validateArtifact(artifact) {
  let expected;
  try {
    expected = buildArtifact();
  } catch (error) {
    return { verified: false, issues: [`source_replay:${error.message}`] };
  }
  return JSON.stringify(artifact) === JSON.stringify(expected)
    ? { verified: true, issues: [] }
    : { verified: false, issues: ['artifact_replay'] };
}

async function main() {
  if (FETCH) {
    const routes = REFRESH ? discoveryRoutes() : uncachedDiscoveryRoutes();
    if (routes.length) {
      await respectPriorHostDelay();
      await captureBrowserDiscoveries(routes);
    }
  }
  const artifact = buildArtifact();
  const rendered = `${JSON.stringify(artifact, null, 2)}\n`;
  if (WRITE) fs.writeFileSync(OUTPUT, rendered);
  else if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
    throw new Error('Shenandoah Acalog discovery artifact drifted; inspect and rerun with --write');
  }
  console.log(`Shenandoah exact filtered discoveries ${artifact.summary.exact_current_course_identities}`);
  console.log(WRITE ? `wrote ${OUTPUT}` : 'checked artifact: no drift');
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

module.exports = {
  OUTPUT,
  buildArtifact,
  captureBrowserDiscoveries,
  discoveryRoutes,
  latestShenandoahFetchTime,
  respectPriorHostDelay,
  uncachedDiscoveryRoutes,
  validateArtifact,
};
