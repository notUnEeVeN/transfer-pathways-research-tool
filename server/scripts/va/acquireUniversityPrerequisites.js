#!/usr/bin/env node
/**
 * Resumable, fail-closed capture of official receiving-university course
 * entries for Virginia Figure 6. No database is opened. Network access and
 * cache writes require --fetch; artifact writes require --write.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {
  ARTIFACT,
  CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256,
  CNU_CPEN371W_EVIDENCE_CACHE_PATH,
  USER_AGENT,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH,
  VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH,
  VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256,
  VSU_ARABIC_EVIDENCE_CACHE_PATH,
  buildAcquisitionPlan,
  catalogYearSeen,
  extractCourseLeafEntries,
  parseRobots,
  responseCachePath,
  robotsAllows,
  sha256,
  validateAcquisitionArtifact,
} = require('../../services/virginia/universityPrerequisiteAcquisition');
const {
  CNU_ALIAS_RECEIPT_CONTRACT,
  CNU_CATALOG_URL,
  CNU_CLAUSE_RECEIPT_CONTRACT,
  CNU_COURSE_BOUNDARY_CONTRACT: CNU_CPEN371W_COURSE_BOUNDARY_CONTRACT,
  CNU_CPEN371W_FACTS_SHA256,
  CNU_PROGRAM_URL,
  cnuCpen371wPrerequisiteEvidenceIssue,
} = require('../../services/virginia/cnuCpen371wPrerequisiteEvidence');
const {
  VSU_ARABIC_BOUNDARY_CONTRACT,
  VSU_ARABIC_FACTS_SHA256,
  VSU_DEPARTMENT_URL,
  virginiaStateArabicPrerequisiteEvidenceIssue,
} = require('../../services/virginia/virginiaStateArabicPrerequisiteEvidence');
const {
  TARGET_CODES: VIRGINIA_TECH_GRADUATE_CS_TARGETS,
  VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
  VIRGINIA_TECH_GRADUATE_CS_URL,
  virginiaTechGraduateCsPrerequisiteEvidenceIssue,
} = require('../../services/virginia/virginiaTechGraduateCsPrerequisiteEvidence');
const {
  CNU_BOUNDARY_CONTRACT,
  CNU_COMPOUND_BOUNDARY_CONTRACT,
  extractCnuPdfEntries,
} = require('../../services/virginia/cnuPdfPrerequisiteAcquisition');
const {
  BRIDGEWATER_BOUNDARY_CONTRACT,
  BRIDGEWATER_SLUG,
  extractBridgewaterCourseEntry,
  verifyBridgewaterCatalogEdition,
} = require('../../services/virginia/bridgewaterCleanCatalogPrerequisiteAcquisition');
const {
  LONGWOOD_BOUNDARY_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_CATOID,
  LONGWOOD_CATALOG_CONTEXT_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
  LONGWOOD_CATALOG_CONTEXT_YEAR,
  LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
  extractLongwoodComputerScienceEntries,
  verifyLongwoodCatalogContext,
} = require('../../services/virginia/longwoodDepartmentPrerequisiteAcquisition');
const {
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
  extractLongwoodBannerEntries,
} = require('../../services/virginia/longwoodBannerCourseAcquisition');
const {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_DISCOVERY_CONTRACT,
  RADFORD_PROGRAM_HTML_SHA256,
  RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  extractRadfordCourseEntry,
  verifyRadfordProgramDiscovery,
  verifyRadfordRetainedEntryDiscovery,
} = require('../../services/virginia/radfordAcalogPrerequisiteAcquisition');
const {
  VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT,
  verifyVirginiaTechCsRetainedSource,
} = require('../../services/virginia/virginiaTechCourseLeafPrerequisiteAcquisition');
const {
  BROWSER_CHALLENGE_CONTRACT,
  BROWSER_ROBOTS_CONTRACT,
  VIRGINIA_TECH_SLUG,
  VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
  browserDocumentLooksLikeInterstitial,
  exactKnownBrowserResource,
  extractSitemapLocations,
  validateBrowserChallengeReceipt,
  validateBrowserRobotsReceipt,
} = require('../../services/virginia/browserChallengeCourseLeafAcquisition');
const {
  UVA_WISE_BOUNDARY_CONTRACT,
  UVA_WISE_CATALOG_YEAR,
  UVA_WISE_CATOID,
  UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
  UVA_WISE_DIRECT_COURSE_RECORDS,
  UVA_WISE_DISCOVERY_CONTRACT,
  UVA_WISE_GE_HTML_SHA256,
  UVA_WISE_PROGRAM_HTML_SHA256,
  UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
  UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  extractUvaWiseCourseEntry,
  verifyUvaWiseDiscovery,
  verifyUvaWiseRetainedEntryDiscovery,
} = require('../../services/virginia/uvaWiseAcalogPrerequisiteAcquisition');
const {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CATALOG_YEAR,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
  SHENANDOAH_PROGRAM_HTML_SHA256,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  extractShenandoahCourseEntry,
  extractShenandoahFilteredDiscovery,
  verifyShenandoahProgramDiscovery,
} = require('../../services/virginia/shenandoahAcalogPrerequisiteAcquisition');
const {
  CACHE_REACQUIRE_CODES: GMU_CACHE_REACQUIRE_CODES,
  OWNER: GMU_OWNER,
  SLUG: GMU_SLUG,
  cachedCyseReacquisitionReceipt,
} = require('../../services/virginia/georgeMasonPrerequisiteClosureAudit');

const SERVER = path.resolve(__dirname, '../..');
const CACHE = path.join(SERVER, '.va-catalogs');
const RESEARCH = path.join(CACHE, 'research');
const SCOPE = path.join(RESEARCH, 'va-university-prerequisite-scope.json');
const CANDIDATES = path.join(RESEARCH, 'va-university-prerequisite-candidates.json');
const REVIEW = path.join(RESEARCH, 'va-university-prerequisite-review.json');
const OUTPUT = path.join(RESEARCH, 'va-university-prerequisite-acquisition.json');
const CNU_CPEN371W_SOURCE_CACHE_PATH =
  'research/cnu-cpen371w-prerequisite-sources/cnu-2026-2027-undergraduate-catalog.pdf';
const VSU_ARABIC_SOURCE_CACHE_PATH =
  'research/virginia-state-arabic-prerequisite-sources/languages-and-literature-2026-2027.html';
const FETCH = process.argv.includes('--fetch');
const WRITE = process.argv.includes('--write');
const REFRESH = process.argv.includes('--refresh');
const JSON_ONLY = process.argv.includes('--json');
const allowed = new Set(['--fetch', '--write', '--refresh', '--json']);
const unknown = process.argv.slice(2).filter((arg) => !allowed.has(arg));
if (unknown.length) {
  console.error(`unknown option(s): ${unknown.join(', ')}`);
  process.exit(2);
}
if (REFRESH && !FETCH) {
  console.error('--refresh requires --fetch');
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const asArray = (value) => Array.isArray(value) ? value : [];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function planFromArtifacts() {
  return buildAcquisitionPlan({
    scope: readJson(SCOPE),
    candidates: readJson(CANDIDATES),
    review: readJson(REVIEW),
    priorAcquisition: fs.existsSync(OUTPUT) ? readJson(OUTPUT) : null,
  });
}

function absoluteCachePath(relative) {
  const resolved = path.resolve(CACHE, relative);
  if (!resolved.startsWith(`${CACHE}${path.sep}`)) throw new Error(`unsafe cache path: ${relative}`);
  return resolved;
}

function routeFiles(route) {
  const rawRelative = responseCachePath(route);
  const extension = path.posix.extname(rawRelative);
  const stem = rawRelative.slice(0, -extension.length);
  return {
    rawRelative,
    raw: absoluteCachePath(rawRelative),
    metadataRelative: `${stem}.json`,
    metadata: absoluteCachePath(`${stem}.json`),
    challengeRelative: `${stem}.challenge.html`,
    challenge: absoluteCachePath(`${stem}.challenge.html`),
  };
}

async function rawGet(url, expectedHost, attempts = 3, { allowedProtocol = 'https:' } = {}) {
  let current = new URL(url);
  if (current.protocol !== allowedProtocol || current.hostname.toLowerCase() !== expectedHost) {
    throw new Error(`request URL is not ${allowedProtocol} on the expected official host`);
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      for (let redirect = 0; redirect <= 3; redirect += 1) {
        const response = await fetch(current, {
          redirect: 'manual',
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain;q=0.9,*/*;q=0.1' },
          signal: AbortSignal.timeout(25_000),
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) throw new Error(`redirect ${response.status} has no Location`);
          const next = new URL(location, current);
          if (next.protocol !== allowedProtocol || next.hostname.toLowerCase() !== expectedHost) {
            throw new Error(`cross-host or cross-protocol redirect refused: ${next.href}`);
          }
          current = next;
          continue;
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 10 * 1024 * 1024) throw new Error('response exceeds 10 MiB capture limit');
        return {
          status: response.status,
          final_url: current.href,
          content_type: response.headers.get('content-type') || null,
          retry_after: response.headers.get('retry-after') || null,
          bytes,
        };
      }
      throw new Error('too many redirects');
    } catch (error) {
      if (attempt === attempts) throw error;
      await sleep(500 * (2 ** (attempt - 1)));
    }
  }
  throw new Error('unreachable fetch retry state');
}

function browserRobotsFiles(host) {
  const directory = path.join(CACHE, 'university-prerequisites', 'raw', '_robots');
  const stem = `${host}__browser`;
  return {
    finalRelative: path.posix.join('university-prerequisites', 'raw', '_robots', `${stem}.txt`),
    challengeRelative:
      path.posix.join('university-prerequisites', 'raw', '_robots', `${stem}.challenge.html`),
    metadataRelative: path.posix.join('university-prerequisites', 'raw', '_robots', `${stem}.json`),
    final: path.join(directory, `${stem}.txt`),
    challenge: path.join(directory, `${stem}.challenge.html`),
    metadata: path.join(directory, `${stem}.json`),
  };
}

async function captureBrowserChallengeDocument(browser, {
  url,
  expectedHost,
  expectedFinalContentType,
  challengeCachePath,
  finalCachePath,
  receiptContract = BROWSER_CHALLENGE_CONTRACT,
}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== expectedHost
      || parsed.href !== url) {
    throw new Error('browser challenge URL is not exact HTTPS on the expected official host');
  }
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    acceptDownloads: false,
  });
  const page = await context.newPage();
  const responsePromises = [];
  let sameUrlDocumentCount = 0;
  let resolveSecond;
  const secondResponse = new Promise((resolve) => { resolveSecond = resolve; });
  page.on('response', (response) => {
    if (response.url() !== url || response.request().resourceType() !== 'document') return;
    sameUrlDocumentCount += 1;
    const ordinal = sameUrlDocumentCount;
    responsePromises.push((async () => {
      const bytes = Buffer.from(await response.body());
      if (!bytes.length) throw new Error(`empty browser document response ${ordinal}`);
      if (bytes.length > 10 * 1024 * 1024) {
        throw new Error(`browser document response ${ordinal} exceeds 10 MiB`);
      }
      return {
        ordinal,
        http_status: response.status(),
        url: response.url(),
        content_type: response.headers()['content-type'] || null,
        byte_length: bytes.length,
        content_sha256: sha256(bytes),
        cache_path: ordinal === 1 ? challengeCachePath : finalCachePath,
        bytes,
      };
    })());
    if (sameUrlDocumentCount === 2) resolveSecond();
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    let responseTimeout;
    try {
      await Promise.race([
        secondResponse,
        new Promise((_, reject) => {
          responseTimeout = setTimeout(
            () => reject(new Error('browser challenge did not yield a second same-URL document response')),
            60_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(responseTimeout);
    }
    await page.waitForTimeout(250);
    const rows = (await Promise.all(responsePromises)).sort((left, right) => (
      left.ordinal - right.ordinal
    ));
    const receipt = {
      contract: receiptContract,
      requested_url: url,
      exact_same_url: rows.every((row) => row.url === url),
      document_response_count: sameUrlDocumentCount,
      browser_engine: 'chromium',
      browser_version: browser.version(),
      document_responses: rows.map(({ bytes, ...row }) => row),
    };
    const validation = validateBrowserChallengeReceipt(receipt, {
      expectedUrl: url,
      expectedFinalContentType,
      expectedContract: receiptContract,
    });
    if (!validation.valid) {
      throw new Error(`browser challenge contract failed:${validation.issues.join(',')}`);
    }
    return { receipt, challengeBytes: rows[0].bytes, finalBytes: rows[1].bytes };
  } finally {
    await context.close();
  }
}

function readBrowserRobotsCache(host) {
  const files = browserRobotsFiles(host);
  if (![files.final, files.challenge, files.metadata].every(fs.existsSync)) return null;
  const metadata = readJson(files.metadata);
  const finalBytes = fs.readFileSync(files.final);
  const challengeBytes = fs.readFileSync(files.challenge);
  const rows = metadata.capture?.document_responses || [];
  if (sha256(finalBytes) !== rows[1]?.content_sha256
      || sha256(challengeBytes) !== rows[0]?.content_sha256) return null;
  const captureValidation = validateBrowserChallengeReceipt(metadata.capture, {
    expectedUrl: `https://${host}/robots.txt`,
    expectedFinalContentType: 'text/plain',
    expectedFinalSha256: sha256(finalBytes),
  });
  if (!captureValidation.valid || !finalBytes.toString('utf8').trim()) return null;
  const policy = parseRobots(finalBytes.toString('utf8'));
  if (metadata.nonempty_final_body !== true
      || metadata.parsed_policy?.rule_count !== policy.rules.length
      || metadata.parsed_policy?.crawl_delay_seconds !== policy.crawl_delay_seconds
      || metadata.parsed_policy?.policy_sha256 !== sha256(JSON.stringify(policy))) return null;
  return { files, metadata, finalBytes, challengeBytes, policy, from_cache: true };
}

async function browserRobotsForHost(browser, host) {
  if (!REFRESH) {
    const cached = readBrowserRobotsCache(host);
    if (cached) return cached;
  }
  const files = browserRobotsFiles(host);
  const url = `https://${host}/robots.txt`;
  const result = await captureBrowserChallengeDocument(browser, {
    url,
    expectedHost: host,
    expectedFinalContentType: 'text/plain',
    challengeCachePath: files.challengeRelative,
    finalCachePath: files.finalRelative,
  });
  const text = result.finalBytes.toString('utf8');
  if (!text.trim()) throw new Error('browser robots final response is empty');
  const policy = parseRobots(text);
  const metadata = {
    contract: BROWSER_ROBOTS_CONTRACT,
    capture: result.receipt,
    nonempty_final_body: true,
    parsed_policy: {
      rule_count: policy.rules.length,
      crawl_delay_seconds: policy.crawl_delay_seconds,
      policy_sha256: sha256(JSON.stringify(policy)),
    },
    fetched_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(files.final), { recursive: true });
  fs.writeFileSync(files.challenge, result.challengeBytes);
  fs.writeFileSync(files.final, result.finalBytes);
  fs.writeFileSync(files.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
  return {
    files, metadata, finalBytes: result.finalBytes,
    challengeBytes: result.challengeBytes, policy, from_cache: false,
  };
}

function robotsReceiptForPath(robots, pathname) {
  return {
    contract: BROWSER_ROBOTS_CONTRACT,
    capture: robots.metadata.capture,
    nonempty_final_body: robots.metadata.nonempty_final_body,
    parsed_policy: robots.metadata.parsed_policy,
    checked_path: pathname,
    path_allowed: robotsAllows(robots.policy, pathname),
  };
}

async function captureBrowserRoutes(host, routes) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    let robots;
    try {
      robots = await browserRobotsForHost(browser, host);
    } catch (error) {
      for (const route of routes) {
        await writeBlockedRoute(route, `browser_robots_capture_failed:${error.message}`);
      }
      return;
    }
    const delay = Math.max(1000, robots.policy.crawl_delay_seconds * 1000);
    let lastRequestAt = robots.from_cache ? 0 : Date.parse(robots.metadata.fetched_at);
    for (const route of routes) {
      const files = routeFiles(route);
      if (!REFRESH && [files.raw, files.challenge, files.metadata].every(fs.existsSync)) continue;
      if (!exactKnownBrowserResource({
        slug: route.slug,
        platform: route.platform,
        officialUrl: route.official_url,
        targetSubjectPrefix: route.target_subject_prefix,
      })) {
        await writeBlockedRoute(route, 'browser_resource_not_in_exact_known_host_contract');
        continue;
      }
      const pathname = new URL(route.official_url).pathname;
      const robotsReceipt = robotsReceiptForPath(robots, pathname);
      const robotsValidation = validateBrowserRobotsReceipt(robotsReceipt, {
        origin: `https://${host}`,
        checkedPath: pathname,
      });
      if (!robotsValidation.valid) {
        await writeBlockedRoute(
          route, `browser_robots_receipt_invalid:${robotsValidation.issues.join(',')}`,
        );
        continue;
      }
      const remainingDelay = delay - (Date.now() - lastRequestAt);
      if (remainingDelay > 0) await sleep(remainingDelay);
      let result;
      try {
        result = await captureBrowserChallengeDocument(browser, {
          url: route.official_url,
          expectedHost: host,
          expectedFinalContentType:
            route.platform === 'browser_challenge_sitemap' ? 'xml' : 'text/html',
          challengeCachePath: files.challengeRelative,
          finalCachePath: files.rawRelative,
        });
      } catch (error) {
        await writeBlockedRoute(route, `browser_document_capture_failed:${error.message}`);
        lastRequestAt = Date.now();
        continue;
      }
      lastRequestAt = Date.now();
      const body = result.finalBytes.toString('utf8');
      const accepted = route.platform === 'browser_challenge_sitemap'
        ? /<urlset\b/i.test(body)
        : !browserDocumentLooksLikeInterstitial(body);
      fs.mkdirSync(path.dirname(files.raw), { recursive: true });
      fs.writeFileSync(files.challenge, result.challengeBytes);
      fs.writeFileSync(files.raw, result.finalBytes);
      const metadata = {
        route_id: route.route_id,
        requested_url: route.official_url,
        final_url: route.official_url,
        capture_status: accepted
          ? 'official_browser_document_captured' : 'blocked_fail_closed',
        blocked_reason: accepted ? null : 'browser_final_response_failed_content_check',
        content_type: result.receipt.document_responses[1].content_type,
        byte_length: result.finalBytes.length,
        content_sha256: sha256(result.finalBytes),
        fetched_at: new Date().toISOString(),
        browser_challenge_receipt: result.receipt,
        robots_receipt: robotsReceipt,
        target_course_codes: route.target_course_codes,
      };
      fs.writeFileSync(files.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
    }
  } finally {
    await browser.close();
  }
}

async function robotsForHost(host, protocol = 'https:') {
  const directory = path.join(CACHE, 'university-prerequisites', 'raw', '_robots');
  const suffix = protocol === 'http:' ? '__http' : '';
  const rawFile = path.join(directory, `${host}${suffix}.txt`);
  const metadataFile = path.join(directory, `${host}${suffix}.json`);
  if (!REFRESH && fs.existsSync(rawFile) && fs.existsSync(metadataFile)) {
    const metadata = readJson(metadataFile);
    const bytes = fs.readFileSync(rawFile);
    if (sha256(bytes) === metadata.content_sha256) return { metadata, bytes, from_cache: true };
  }
  fs.mkdirSync(directory, { recursive: true });
  const robotsUrl = `${protocol}//${host}/robots.txt`;
  const response = await rawGet(robotsUrl, host, 3, { allowedProtocol: protocol });
  const metadata = {
    requested_url: robotsUrl,
    final_url: response.final_url,
    http_status: response.status,
    content_type: response.content_type,
    byte_length: response.bytes.length,
    content_sha256: sha256(response.bytes),
    fetched_at: new Date().toISOString(),
  };
  fs.writeFileSync(rawFile, response.bytes);
  fs.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`);
  return { metadata, bytes: response.bytes, from_cache: false };
}

async function writeBlockedRoute(route, reason, robots = null) {
  const files = routeFiles(route);
  fs.mkdirSync(path.dirname(files.metadata), { recursive: true });
  const metadata = {
    route_id: route.route_id,
    requested_url: route.official_url,
    capture_status: 'blocked_fail_closed',
    blocked_reason: reason,
    robots: robots ? {
      url: robots.metadata.final_url,
      http_status: robots.metadata.http_status,
      content_sha256: robots.metadata.content_sha256,
    } : null,
    target_course_codes: route.target_course_codes,
    checked_at: new Date().toISOString(),
  };
  fs.writeFileSync(files.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
}

function latestRetainedRouteFetchTime(routes) {
  let latest = 0;
  for (const slug of new Set(routes.map((route) => route.slug).filter(Boolean))) {
    const directory = path.join(CACHE, 'university-prerequisites', 'raw', slug);
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).filter((value) => value.endsWith('.json'))) {
      try {
        const fetchedAt = Date.parse(readJson(path.join(directory, name)).fetched_at) || 0;
        latest = Math.max(latest, fetchedAt);
      } catch { /* an invalid receipt will fail during artifact replay */ }
    }
  }
  return latest;
}

async function captureRoutes(plan) {
  const byHost = new Map();
  for (const route of plan.routes.filter((row) => ![
    'pdf_bbox_columns',
    'retained_courseleaf_source',
    'cnu_cpen371w_current_joint_evidence',
    'vsu_arabic_current_department_evidence',
    'virginia_tech_graduate_cs_current_department_evidence',
  ].includes(row.platform))) {
    const protocol = route.transport_protocol || 'https:';
    const hostKey = `${protocol}//${route.official_host}`;
    const rows = byHost.get(hostKey) || [];
    rows.push(route);
    byHost.set(hostKey, rows);
  }
  for (const [hostKey, routes] of byHost) {
    const protocol = routes[0].transport_protocol || 'https:';
    const host = routes[0].official_host;
    if (routes.some((route) => (
      (route.transport_protocol || 'https:') !== protocol || route.official_host !== host
    ))) throw new Error(`mixed host/protocol route group: ${hostKey}`);
    const browserChallengeRoutes = routes.filter((route) => (
      ['browser_challenge_courseleaf', 'browser_challenge_sitemap'].includes(route.platform)
    ));
    if (browserChallengeRoutes.length) {
      if (browserChallengeRoutes.length !== routes.length || protocol !== 'https:') {
        throw new Error(`mixed browser/raw capture route group: ${hostKey}`);
      }
      await captureBrowserRoutes(host, browserChallengeRoutes);
      continue;
    }
    const exactUvaWiseHttp = protocol === 'http:' && routes.every((route) => (
      route.platform === 'uva_wise_acalog_course'
      && route.http_exception_contract
        === 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1'
      && new URL(route.official_url).pathname === '/preview_course_nopop.php'
    ));
    if (protocol !== 'https:' && !exactUvaWiseHttp) {
      for (const route of routes) await writeBlockedRoute(
        route, `non_https_transport_not_pinned:${protocol}`,
      );
      continue;
    }
    let robots;
    try {
      robots = await robotsForHost(host, protocol);
    } catch (error) {
      for (const route of routes) await writeBlockedRoute(route, `robots_fetch_failed:${error.message}`);
      continue;
    }
    if (robots.metadata.http_status !== 200 || !robots.bytes.toString('utf8').trim()) {
      for (const route of routes) {
        await writeBlockedRoute(route, 'robots_response_must_be_nonempty_http_200', robots);
      }
      continue;
    }
    const policy = parseRobots(robots.bytes.toString('utf8'));
    const exactAcalogDelay = policy.crawl_delay_seconds === 120
      && routes.every((route) => (
        [
          'radford_acalog_course',
          'uva_wise_acalog_course',
          'shenandoah_acalog_course',
          'shenandoah_acalog_filter_discovery',
        ].includes(route.platform)
        && route.required_crawl_delay_seconds === 120
      ));
    if (policy.crawl_delay_seconds > 15 && !exactAcalogDelay) {
      for (const route of routes) {
        await writeBlockedRoute(route, `robots_crawl_delay_deferred:${policy.crawl_delay_seconds}`, robots);
      }
      continue;
    }
    const delay = Math.max(1000, policy.crawl_delay_seconds * 1000);
    let lastRequestAt = Math.max(
      latestRetainedRouteFetchTime(routes),
      robots.from_cache ? 0 : Date.parse(robots.metadata.fetched_at),
    );
    for (const route of routes) {
      const files = routeFiles(route);
      if (!REFRESH && fs.existsSync(files.raw) && fs.existsSync(files.metadata)) continue;
      const pathname = new URL(route.official_url).pathname;
      if (!robotsAllows(policy, pathname)) {
        await writeBlockedRoute(route, `robots_disallow:${pathname}`, robots);
        continue;
      }
      const remainingDelay = delay - (Date.now() - lastRequestAt);
      if (remainingDelay > 0) await sleep(remainingDelay);
      let response;
      try {
        response = await rawGet(route.official_url, host, exactAcalogDelay ? 1 : 3, {
          allowedProtocol: protocol,
        });
      } catch (error) {
        await writeBlockedRoute(route, `request_failed:${error.message}`, robots);
        lastRequestAt = Date.now();
        continue;
      }
      lastRequestAt = Date.now();
      const contentType = String(response.content_type || '').toLowerCase();
      const body = response.bytes.toString('utf8');
      const accepted = response.status === 200
        && contentType.includes('text/html')
        && !browserDocumentLooksLikeInterstitial(body);
      fs.mkdirSync(path.dirname(files.raw), { recursive: true });
      fs.writeFileSync(files.raw, response.bytes);
      const metadata = {
        route_id: route.route_id,
        requested_url: route.official_url,
        final_url: response.final_url,
        capture_status: accepted ? 'official_html_captured' : 'blocked_fail_closed',
        blocked_reason: accepted ? null : 'response_failed_status_content_type_or_interstitial_check',
        http_status: response.status,
        content_type: response.content_type,
        byte_length: response.bytes.length,
        content_sha256: sha256(response.bytes),
        fetched_at: new Date().toISOString(),
        robots: {
          url: robots.metadata.final_url,
          http_status: robots.metadata.http_status,
          content_sha256: robots.metadata.content_sha256,
          crawl_delay_seconds: policy.crawl_delay_seconds,
        },
        target_course_codes: route.target_course_codes,
      };
      fs.writeFileSync(files.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
    }
  }
}

function verifyCachedBrowserRoute(route, files, metadata, finalBytes) {
  const expectedFinalContentType = route.platform === 'browser_challenge_sitemap'
    ? 'xml' : 'text/html';
  const capture = validateBrowserChallengeReceipt(metadata.browser_challenge_receipt, {
    expectedUrl: route.official_url,
    expectedFinalContentType,
    expectedFinalSha256: sha256(finalBytes),
  });
  const pathname = new URL(route.official_url).pathname;
  const robots = validateBrowserRobotsReceipt(metadata.robots_receipt, {
    origin: `https://${route.official_host}`,
    checkedPath: pathname,
  });
  const issues = [
    ...capture.issues.map((issue) => `document:${issue}`),
    ...robots.issues.map((issue) => `robots:${issue}`),
  ];
  if (!exactKnownBrowserResource({
    slug: route.slug,
    platform: route.platform,
    officialUrl: route.official_url,
    targetSubjectPrefix: route.target_subject_prefix,
  })) issues.push('exact_known_resource');
  const receiptFiles = [
    [metadata.browser_challenge_receipt?.document_responses?.[0]?.cache_path, files.challenge],
    [metadata.browser_challenge_receipt?.document_responses?.[1]?.cache_path, files.raw],
    ...asArray(metadata.robots_receipt?.capture?.document_responses).map((row) => [
      row.cache_path, absoluteCachePath(row.cache_path),
    ]),
  ];
  for (const [relative, absolute] of receiptFiles) {
    if (!relative || !fs.existsSync(absolute)) {
      issues.push(`receipt_file_missing:${relative || 'blank'}`);
      continue;
    }
    const row = [
      ...asArray(metadata.browser_challenge_receipt?.document_responses),
      ...asArray(metadata.robots_receipt?.capture?.document_responses),
    ].find((candidate) => candidate.cache_path === relative);
    if (!row || sha256(fs.readFileSync(absolute)) !== row.content_sha256) {
      issues.push(`receipt_file_hash:${relative}`);
    }
  }
  const robotsFinal = metadata.robots_receipt?.capture?.document_responses?.[1];
  if (robotsFinal?.cache_path && fs.existsSync(absoluteCachePath(robotsFinal.cache_path))) {
    const text = fs.readFileSync(absoluteCachePath(robotsFinal.cache_path), 'utf8');
    const policy = parseRobots(text);
    if (!text.trim() || !robotsAllows(policy, pathname)
        || metadata.robots_receipt.parsed_policy?.rule_count !== policy.rules.length
        || metadata.robots_receipt.parsed_policy?.crawl_delay_seconds
          !== policy.crawl_delay_seconds
        || metadata.robots_receipt.parsed_policy?.policy_sha256
          !== sha256(JSON.stringify(policy))) issues.push('robots_policy_replay');
  }
  return { valid: issues.length === 0, issues };
}

function readCachedHtmlRoute(route) {
  const files = routeFiles(route);
  if (!fs.existsSync(files.metadata)) {
    return {
      failure: { ...route, capture_status: 'not_attempted', cache_path: files.rawRelative },
    };
  }
  const metadata = readJson(files.metadata);
  const acceptedStatuses = route.platform?.startsWith('browser_challenge_')
    ? ['official_browser_document_captured'] : ['official_html_captured'];
  const exactGmuCyseCacheReacquisition = route.slug === GMU_SLUG
    && route.owner_namespace === GMU_OWNER
    && route.platform === 'courseleaf'
    && route.official_url === 'https://catalog.gmu.edu/courses/cyse/'
    && asArray(route.target_course_codes).length > 0
    && asArray(route.target_course_codes).every((code) => (
      GMU_CACHE_REACQUIRE_CODES.includes(code)
    ));
  if ((!acceptedStatuses.includes(metadata.capture_status)
      && !exactGmuCyseCacheReacquisition) || !fs.existsSync(files.raw)) {
    return {
      failure: {
        ...route,
        capture_status: metadata.capture_status || 'blocked_fail_closed',
        blocked_reason: metadata.blocked_reason || 'capture metadata is incomplete',
        cache_path: files.rawRelative,
        robots: metadata.robots || null,
      },
    };
  }
  const bytes = fs.readFileSync(files.raw);
  const responseHash = sha256(bytes);
  if (responseHash !== metadata.content_sha256) {
    return {
      failure: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: 'cached_response_hash_mismatch',
        cache_path: files.rawRelative,
      },
    };
  }
  if (route.platform?.startsWith('browser_challenge_')) {
    const replay = verifyCachedBrowserRoute(route, files, metadata, bytes);
    if (!replay.valid) return {
      failure: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `browser_receipt_replay_failed:${replay.issues.join(',')}`,
        cache_path: files.rawRelative,
      },
    };
  }
  let cacheReacquisitionReceipt = null;
  if (exactGmuCyseCacheReacquisition) {
    const replay = cachedCyseReacquisitionReceipt(bytes, metadata);
    if (!replay.ready) return {
      failure: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `gmu_cyse_cache_reacquisition_failed:${replay.issues.join(',')}`,
        cache_path: files.rawRelative,
      },
    };
    cacheReacquisitionReceipt = replay.receipt;
  }
  return {
    files,
    metadata,
    bytes,
    responseHash,
    body: bytes.toString('utf8'),
    cacheReacquisitionReceipt,
  };
}

function buildBridgewaterEditionCapture(route) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, evidence: null };
  const result = verifyBridgewaterCatalogEdition(cached.body, route.catalog_year);
  const capture = {
    ...route,
    capture_status: result.verified ? 'catalog_edition_verified' : 'blocked_fail_closed',
    blocked_reason: result.verified ? null : `catalog_edition_verification_failed:${result.issues.join(',')}`,
    cache_path: cached.files.rawRelative,
    final_url: cached.metadata.final_url,
    fetched_at: cached.metadata.fetched_at,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: result.catalog_year,
    exact_year_statement: result.exact_year_statement,
    normalized_main_text_sha256: result.normalized_main_text_sha256,
    robots: cached.metadata.robots,
  };
  return {
    capture,
    evidence: result.verified ? {
      response_sha256: cached.responseHash,
      cache_path: cached.files.rawRelative,
      catalog_year: result.catalog_year,
      edition_path: result.edition_path,
      exact_year_statement: result.exact_year_statement,
      normalized_main_text_sha256: result.normalized_main_text_sha256,
    } : null,
  };
}

function buildBridgewaterCourseCapture(route, editionEvidence) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, entries: [] };
  if (!editionEvidence) return {
    capture: {
      ...route,
      capture_status: 'blocked_fail_closed',
      blocked_reason: 'catalog_edition_evidence_missing_or_invalid',
      cache_path: cached.files.rawRelative,
      final_url: cached.metadata.final_url,
      source_response_sha256: cached.responseHash,
    },
    entries: [],
  };
  const target = route.target_course_codes[0];
  const result = extractBridgewaterCourseEntry(cached.body, target);
  const capture = {
    ...route,
    capture_status: result.verified && result.entries.length === 1
      ? 'bounded_entries_available' : 'no_exact_entries_bounded',
    blocked_reason: result.verified ? null : `course_entry_verification_failed:${result.issues.join(',')}`,
    cache_path: cached.files.rawRelative,
    final_url: cached.metadata.final_url,
    fetched_at: cached.metadata.fetched_at,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: route.catalog_year,
    exact_entry_count: result.entries.length,
    exact_entry_codes: result.entries.map((row) => row.course_code),
    missing: result.missing,
    edition_response_sha256: editionEvidence.response_sha256,
    robots: cached.metadata.robots,
  };
  const entries = result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_cleancatalog_course_page',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: BRIDGEWATER_BOUNDARY_CONTRACT,
    official_url: cached.metadata.final_url,
    cache_path: cached.files.rawRelative,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: route.catalog_year,
    canonical_path: entry.canonical_path,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    requisite_field_receipt: entry.requisite_field_receipt,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
    edition_response_sha256: editionEvidence.response_sha256,
    edition_cache_path: editionEvidence.cache_path,
    edition_catalog_year: editionEvidence.catalog_year,
    edition_path: editionEvidence.edition_path,
    edition_exact_year_statement: editionEvidence.exact_year_statement,
    edition_normalized_main_text_sha256: editionEvidence.normalized_main_text_sha256,
  }));
  return { capture, entries };
}

function buildLongwoodDepartmentCapture(route) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, entries: [] };
  let contextHtml;
  let contextText;
  let contextHtmlHash;
  let contextTextHash;
  try {
    const htmlPath = absoluteCachePath(route.catalog_context_html_cache_path);
    const textPath = absoluteCachePath(route.catalog_context_text_cache_path);
    contextHtml = fs.readFileSync(htmlPath);
    contextText = fs.readFileSync(textPath);
    contextHtmlHash = sha256(contextHtml);
    contextTextHash = sha256(contextText);
  } catch (error) {
    return {
      capture: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `longwood_catalog_context_missing:${error.message}`,
        cache_path: cached.files.rawRelative,
        final_url: cached.metadata.final_url,
        source_response_sha256: cached.responseHash,
      },
      entries: [],
    };
  }
  const context = verifyLongwoodCatalogContext(
    contextHtml.toString('utf8'), route.catalog_year, route.catalog_context_catoid,
  );
  const contextVerified = context.verified
    && context.catalog_year === LONGWOOD_CATALOG_CONTEXT_YEAR
    && context.catoid === LONGWOOD_CATALOG_CONTEXT_CATOID
    && contextTextHash === route.catalog_context_text_sha256
    && contextTextHash === LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256;
  const result = extractLongwoodComputerScienceEntries(
    cached.body, route.target_course_codes,
  );
  const verified = contextVerified && result.verified
    && result.entries.length === route.target_course_codes.length;
  const bindingNote = 'The unversioned first-party department page supplies the CMSC entry text; it does not print a catalog year. The separately retained Longwood Course Descriptions page proves only the selected 2026-2027 Undergraduate Catalog and catoid 19 context used for this contemporaneous two-source capture.';
  const capture = {
    ...route,
    capture_status: verified ? 'bounded_entries_available' : 'blocked_fail_closed',
    blocked_reason: verified ? null : [
      ...(!contextVerified ? [`catalog_context_verification_failed:${context.issues.join(',') || 'hash_or_identity'}`] : []),
      ...(!result.verified ? [`department_entry_verification_failed:${result.issues.join(',')}`] : []),
    ].join(';'),
    cache_path: cached.files.rawRelative,
    final_url: cached.metadata.final_url,
    fetched_at: cached.metadata.fetched_at,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: contextVerified ? context.catalog_year : null,
    department_page_catalog_year_statement: null,
    catalog_context_contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
    catalog_context_html_sha256: contextHtmlHash,
    catalog_context_normalized_text_sha256: contextTextHash,
    catalog_context_relevant_sha256: context.relevant_context_sha256,
    catalog_context_catalog_year: context.catalog_year,
    catalog_context_catoid: context.catoid,
    two_source_edition_boundary: LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
    two_source_binding_note: bindingNote,
    exact_entry_count: verified ? result.entries.length : 0,
    exact_entry_codes: verified ? result.entries.map((row) => row.course_code) : [],
    missing: result.missing,
    robots: cached.metadata.robots,
  };
  const entries = verified ? result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_longwood_department_course_listing',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: LONGWOOD_BOUNDARY_CONTRACT,
    official_url: cached.metadata.final_url,
    cache_path: cached.files.rawRelative,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: context.catalog_year,
    department_page_catalog_year_statement: null,
    catalog_context_contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
    catalog_context_official_url: route.catalog_context_official_url,
    catalog_context_html_cache_path: route.catalog_context_html_cache_path,
    catalog_context_text_cache_path: route.catalog_context_text_cache_path,
    catalog_context_html_sha256: contextHtmlHash,
    catalog_context_normalized_text_sha256: contextTextHash,
    catalog_context_relevant_sha256: context.relevant_context_sha256,
    catalog_context_catalog_year: context.catalog_year,
    catalog_context_catoid: context.catoid,
    two_source_edition_boundary: LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
    two_source_binding_note: bindingNote,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
  })) : [];
  return { capture, entries };
}

function buildLongwoodBannerCapture(route) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, entries: [] };
  let contextHtml;
  let contextText;
  let contextHtmlHash;
  let contextTextHash;
  try {
    const htmlPath = absoluteCachePath(route.catalog_context_html_cache_path);
    const textPath = absoluteCachePath(route.catalog_context_text_cache_path);
    contextHtml = fs.readFileSync(htmlPath);
    contextText = fs.readFileSync(textPath);
    contextHtmlHash = sha256(contextHtml);
    contextTextHash = sha256(contextText);
  } catch (error) {
    return {
      capture: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `longwood_catalog_context_missing:${error.message}`,
        cache_path: cached.files.rawRelative,
        final_url: cached.metadata.final_url,
        source_response_sha256: cached.responseHash,
      },
      entries: [],
    };
  }
  const context = verifyLongwoodCatalogContext(
    contextHtml.toString('utf8'), route.catalog_year, route.catalog_context_catoid,
  );
  const contextVerified = context.verified
    && context.catalog_year === LONGWOOD_CATALOG_CONTEXT_YEAR
    && context.catoid === LONGWOOD_CATALOG_CONTEXT_CATOID
    && contextTextHash === route.catalog_context_text_sha256
    && contextTextHash === LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256;
  const result = extractLongwoodBannerEntries(cached.body, route.target_course_codes);
  const verified = contextVerified && result.verified
    && result.entries.length === route.target_course_codes.length;
  const bindingNote = 'The unversioned first-party Courses from Banner page supplies the exact course-entry text; it does not print a catalog year. The separately retained Longwood Course Descriptions page proves only the selected 2026-2027 Undergraduate Catalog and catoid 19 context used for this contemporaneous two-source capture.';
  const capture = {
    ...route,
    capture_status: verified ? 'bounded_entries_available' : 'blocked_fail_closed',
    blocked_reason: verified ? null : [
      ...(!contextVerified ? [`catalog_context_verification_failed:${context.issues.join(',') || 'hash_or_identity'}`] : []),
      ...(!result.verified ? [`banner_entry_verification_failed:${result.issues.join(',')}`] : []),
    ].join(';'),
    cache_path: cached.files.rawRelative,
    final_url: cached.metadata.final_url,
    fetched_at: cached.metadata.fetched_at,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: contextVerified ? context.catalog_year : null,
    department_page_catalog_year_statement: null,
    catalog_context_contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
    catalog_context_html_sha256: contextHtmlHash,
    catalog_context_normalized_text_sha256: contextTextHash,
    catalog_context_relevant_sha256: context.relevant_context_sha256,
    catalog_context_catalog_year: context.catalog_year,
    catalog_context_catoid: context.catoid,
    two_source_edition_boundary: LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
    two_source_binding_note: bindingNote,
    exact_entry_count: verified ? result.entries.length : 0,
    exact_entry_codes: verified ? result.entries.map((row) => row.course_code) : [],
    missing: result.missing,
    robots: cached.metadata.robots,
  };
  const entries = verified ? result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_longwood_banner_course_listing',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: LONGWOOD_BANNER_BOUNDARY_CONTRACT,
    official_url: cached.metadata.final_url,
    cache_path: cached.files.rawRelative,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: context.catalog_year,
    department_page_catalog_year_statement: null,
    catalog_context_contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
    catalog_context_official_url: route.catalog_context_official_url,
    catalog_context_html_cache_path: route.catalog_context_html_cache_path,
    catalog_context_text_cache_path: route.catalog_context_text_cache_path,
    catalog_context_html_sha256: contextHtmlHash,
    catalog_context_normalized_text_sha256: contextTextHash,
    catalog_context_relevant_sha256: context.relevant_context_sha256,
    catalog_context_catalog_year: context.catalog_year,
    catalog_context_catoid: context.catoid,
    two_source_edition_boundary: LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
    two_source_binding_note: bindingNote,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
  })) : [];
  return { capture, entries };
}

function buildRadfordCourseCapture(route) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, entries: [] };
  let discoveryBytes;
  try {
    discoveryBytes = fs.readFileSync(absoluteCachePath(route.discovery_cache_path));
  } catch (error) {
    return {
      capture: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `radford_program_discovery_missing:${error.message}`,
        cache_path: cached.files.rawRelative,
      },
      entries: [],
    };
  }
  const discoveryHash = sha256(discoveryBytes);
  const retainedEntryDiscovery =
    route.discovery_contract === RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT;
  const discovery = retainedEntryDiscovery
    ? verifyRadfordRetainedEntryDiscovery(
      discoveryBytes.toString('utf8'), route.target_course_codes[0],
    )
    : verifyRadfordProgramDiscovery(
      discoveryBytes.toString('utf8'), route.target_course_codes,
    );
  const discoveryVerified = discovery.verified
    && discoveryHash === route.discovery_response_sha256
    && (retainedEntryDiscovery
      || (discoveryHash === RADFORD_PROGRAM_HTML_SHA256
        && route.discovery_contract === RADFORD_DISCOVERY_CONTRACT));
  const target = route.target_course_codes[0];
  const result = extractRadfordCourseEntry(cached.body, target, {
    finalUrl: cached.metadata.final_url,
  });
  const verified = discoveryVerified && result.verified && result.entries.length === 1;
  const capture = {
    ...route,
    capture_status: verified ? 'bounded_entries_available' : 'blocked_fail_closed',
    blocked_reason: verified ? null : [
      ...(!discoveryVerified
        ? [`discovery_verification_failed:${discovery.issues.join(',') || 'hash_or_contract'}`]
        : []),
      ...(!result.verified ? [`course_entry_verification_failed:${result.issues.join(',')}`] : []),
    ].join(';'),
    cache_path: cached.files.rawRelative,
    final_url: cached.metadata.final_url,
    fetched_at: cached.metadata.fetched_at,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: verified ? route.catalog_year : null,
    discovery_response_sha256: discoveryHash,
    discovery_link_receipts: discovery.links,
    exact_entry_count: verified ? 1 : 0,
    exact_entry_codes: verified ? [target] : [],
    missing: verified ? [] : [target],
    robots: cached.metadata.robots,
  };
  const entries = verified ? result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_radford_acalog_course_page',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: RADFORD_BOUNDARY_CONTRACT,
    official_url: cached.metadata.final_url,
    cache_path: cached.files.rawRelative,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: route.catalog_year,
    catoid: entry.catoid,
    coid: entry.coid,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    required_requisite_clause: entry.required_requisite_clause,
    pre_or_corequisite_clause: entry.pre_or_corequisite_clause,
    formal_requisite_marker_count: entry.formal_requisite_marker_count,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
    discovery_contract: route.discovery_contract,
    discovery_cache_path: route.discovery_cache_path,
    discovery_response_sha256: discoveryHash,
    discovery_link_receipt: discovery.links[0],
    robots_crawl_delay_seconds: cached.metadata.robots?.crawl_delay_seconds,
  })) : [];
  return { capture, entries };
}

function buildUvaWiseCourseCapture(route) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, entries: [] };
  const retainedEntryDiscovery =
    route.discovery_contract === UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT;
  let programBytes;
  let geBytes;
  let retainedBytes;
  try {
    if (retainedEntryDiscovery) {
      retainedBytes = fs.readFileSync(absoluteCachePath(route.discovery_cache_path));
    } else {
      programBytes = fs.readFileSync(absoluteCachePath(route.discovery_program_cache_path));
      geBytes = fs.readFileSync(absoluteCachePath(route.discovery_ge_cache_path));
    }
  } catch (error) {
    return {
      capture: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `uva_wise_discovery_source_missing:${error.message}`,
        cache_path: cached.files.rawRelative,
      },
      entries: [],
    };
  }
  const programHash = programBytes ? sha256(programBytes) : null;
  const geHash = geBytes ? sha256(geBytes) : null;
  const retainedHash = retainedBytes ? sha256(retainedBytes) : null;
  const discovery = retainedEntryDiscovery
    ? verifyUvaWiseRetainedEntryDiscovery(
      retainedBytes.toString('utf8'), route.target_course_codes[0],
    )
    : verifyUvaWiseDiscovery({
      programHtml: programBytes.toString('utf8'),
      geHtml: geBytes.toString('utf8'),
    }, route.target_course_codes);
  const discoveryVerified = discovery.verified && (retainedEntryDiscovery
    ? retainedHash === route.discovery_response_sha256
    : (programHash === route.discovery_program_response_sha256
      && programHash === UVA_WISE_PROGRAM_HTML_SHA256
      && geHash === route.discovery_ge_response_sha256
      && geHash === UVA_WISE_GE_HTML_SHA256
      && route.discovery_contract === UVA_WISE_DISCOVERY_CONTRACT));
  const target = route.target_course_codes[0];
  const result = extractUvaWiseCourseEntry(cached.body, target, {
    finalUrl: cached.metadata.final_url,
  });
  const transportVerified = route.transport_protocol === 'http:'
    && route.http_exception_contract
      === 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1'
    && cached.metadata.robots?.crawl_delay_seconds === UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS;
  const verified = discoveryVerified && transportVerified
    && result.verified && result.entries.length === 1;
  const capture = {
    ...route,
    capture_status: verified ? 'bounded_entries_available' : 'blocked_fail_closed',
    blocked_reason: verified ? null : [
      ...(!discoveryVerified
        ? [`discovery_verification_failed:${discovery.issues.join(',') || 'hash_or_contract'}`]
        : []),
      ...(!transportVerified ? ['http_transport_or_robots_delay_receipt_failed'] : []),
      ...(!result.verified ? [`course_entry_verification_failed:${result.issues.join(',')}`] : []),
    ].join(';'),
    cache_path: cached.files.rawRelative,
    final_url: cached.metadata.final_url,
    fetched_at: cached.metadata.fetched_at,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: verified ? route.catalog_year : null,
    ...(retainedEntryDiscovery ? {
      discovery_response_sha256: retainedHash,
    } : {
      discovery_program_response_sha256: programHash,
      discovery_ge_response_sha256: geHash,
    }),
    discovery_link_receipts: discovery.links,
    exact_entry_count: verified ? 1 : 0,
    exact_entry_codes: verified ? [target] : [],
    missing: verified ? [] : [target],
    robots: cached.metadata.robots,
  };
  const entries = verified ? result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_uva_wise_acalog_course_page',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: UVA_WISE_BOUNDARY_CONTRACT,
    official_url: cached.metadata.final_url,
    cache_path: cached.files.rawRelative,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: UVA_WISE_CATALOG_YEAR,
    catoid: entry.catoid,
    coid: entry.coid,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    required_requisite_clause: entry.required_requisite_clause,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
    discovery_contract: route.discovery_contract,
    ...(retainedEntryDiscovery ? {
      discovery_cache_path: route.discovery_cache_path,
      discovery_response_sha256: retainedHash,
    } : {
      discovery_program_cache_path: route.discovery_program_cache_path,
      discovery_program_response_sha256: programHash,
      discovery_ge_cache_path: route.discovery_ge_cache_path,
      discovery_ge_response_sha256: geHash,
    }),
    discovery_link_receipt: discovery.links[0],
    robots_crawl_delay_seconds: cached.metadata.robots?.crawl_delay_seconds,
    http_exception_contract: route.http_exception_contract,
  })) : [];
  return { capture, entries };
}

function buildShenandoahCourseCapture(route) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, entries: [] };
  let discoveryBytes;
  try {
    discoveryBytes = fs.readFileSync(absoluteCachePath(route.discovery_cache_path));
  } catch (error) {
    return {
      capture: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `shenandoah_program_discovery_missing:${error.message}`,
        cache_path: cached.files.rawRelative,
      },
      entries: [],
    };
  }
  const target = route.target_course_codes[0];
  const discoveryHash = sha256(discoveryBytes);
  let discovery;
  let expectedDiscoveryHash;
  if (route.discovery_contract === SHENANDOAH_FILTER_DISCOVERY_CONTRACT) {
    const filtered = extractShenandoahFilteredDiscovery(
      discoveryBytes.toString('utf8'), target,
      { finalUrl: route.discovery_official_url },
    );
    discovery = {
      verified: filtered.verified
        && filtered.link?.course_code === target
        && filtered.link?.catoid === route.catoid
        && filtered.link?.coid === route.coid
        && filtered.link?.title === route.expected_title,
      issues: filtered.issues,
      links: filtered.link ? [filtered.link] : [],
    };
    expectedDiscoveryHash = route.discovery_response_sha256;
  } else {
    discovery = verifyShenandoahProgramDiscovery(
      discoveryBytes.toString('utf8'), route.target_course_codes,
    );
    expectedDiscoveryHash = SHENANDOAH_PROGRAM_HTML_SHA256;
  }
  const discoveryVerified = discovery.verified
    && discoveryHash === route.discovery_response_sha256
    && discoveryHash === expectedDiscoveryHash
    && [SHENANDOAH_DISCOVERY_CONTRACT, SHENANDOAH_FILTER_DISCOVERY_CONTRACT]
      .includes(route.discovery_contract);
  const result = extractShenandoahCourseEntry(cached.body, target, {
    finalUrl: cached.metadata.final_url,
  });
  const transportVerified = cached.metadata.robots?.crawl_delay_seconds
      === SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS;
  const verified = discoveryVerified && transportVerified
    && result.verified && result.entries.length === 1;
  const capture = {
    ...route,
    capture_status: verified ? 'bounded_entries_available' : 'blocked_fail_closed',
    blocked_reason: verified ? null : [
      ...(!discoveryVerified
        ? [`program_discovery_verification_failed:${discovery.issues.join(',') || 'hash_or_contract'}`]
        : []),
      ...(!transportVerified ? ['robots_delay_receipt_failed'] : []),
      ...(!result.verified ? [`course_entry_verification_failed:${result.issues.join(',')}`] : []),
    ].join(';'),
    cache_path: cached.files.rawRelative,
    final_url: cached.metadata.final_url,
    fetched_at: cached.metadata.fetched_at,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: verified ? SHENANDOAH_CATALOG_YEAR : null,
    discovery_response_sha256: discoveryHash,
    discovery_link_receipts: discovery.links,
    exact_entry_count: verified ? 1 : 0,
    exact_entry_codes: verified ? [target] : [],
    missing: verified ? [] : [target],
    robots: cached.metadata.robots,
  };
  const entries = verified ? result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_shenandoah_acalog_course_page',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: SHENANDOAH_BOUNDARY_CONTRACT,
    official_url: cached.metadata.final_url,
    cache_path: cached.files.rawRelative,
    source_response_sha256: cached.responseHash,
    source_response_bytes: cached.bytes.length,
    catalog_year_verified: SHENANDOAH_CATALOG_YEAR,
    catoid: entry.catoid,
    coid: entry.coid,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    required_requisite_clause: entry.required_requisite_clause,
    formal_corequisite_marker_count: entry.formal_corequisite_marker_count,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
    discovery_contract: route.discovery_contract,
    discovery_cache_path: route.discovery_cache_path,
    discovery_response_sha256: discoveryHash,
    discovery_link_receipt: discovery.links[0],
    robots_crawl_delay_seconds: cached.metadata.robots?.crawl_delay_seconds,
  })) : [];
  return { capture, entries };
}

function buildRetainedCourseLeafCapture(route) {
  let htmlBytes;
  let textBytes;
  try {
    htmlBytes = fs.readFileSync(absoluteCachePath(route.retained_html_cache_path));
    textBytes = fs.readFileSync(absoluteCachePath(route.retained_text_cache_path));
  } catch (error) {
    return {
      capture: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `retained_official_source_missing:${error.message}`,
      },
      entries: [],
    };
  }
  const context = verifyVirginiaTechCsRetainedSource({ htmlBytes, textBytes });
  const verified = context.verified
    && route.retained_source_contract === VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT
    && context.html_sha256 === route.retained_html_sha256
    && context.text_sha256 === route.retained_text_sha256
    && context.official_url === route.official_url
    && context.catalog_year === route.catalog_year;
  const result = verified
    ? extractCourseLeafEntries(htmlBytes.toString('utf8'), route.target_course_codes)
    : { entries: [], ambiguous: [], missing: route.target_course_codes,
      courseblock_count: 0, complete_entry_count: 0,
      complete_entries_with_required_requisite_marker_count: 0 };
  const capture = {
    ...route,
    capture_status: verified
      ? (result.entries.length ? 'bounded_entries_available' : 'no_exact_entries_bounded')
      : 'blocked_fail_closed',
    blocked_reason: verified ? null
      : `retained_official_source_verification_failed:${context.issues.join(',') || 'contract_or_identity'}`,
    cache_path: route.retained_html_cache_path,
    final_url: route.official_url,
    fetched_at: null,
    source_response_sha256: context.html_sha256,
    source_response_bytes: htmlBytes.length,
    catalog_year_verified: verified ? context.catalog_year : null,
    retained_source_contract: route.retained_source_contract,
    retained_source_text_cache_path: route.retained_text_cache_path,
    retained_source_text_sha256: context.text_sha256,
    courseblock_count: result.courseblock_count,
    complete_entry_count: result.complete_entry_count,
    complete_entries_with_required_requisite_marker_count:
      result.complete_entries_with_required_requisite_marker_count,
    exact_entry_count: result.entries.length,
    exact_entry_codes: result.entries.map((row) => row.course_code),
    ambiguous: result.ambiguous,
    missing: result.missing,
    live_recapture_claim: false,
  };
  const entries = verified ? result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_acquisition',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: route.boundary_contract,
    official_url: route.official_url,
    cache_path: route.retained_html_cache_path,
    source_response_sha256: context.html_sha256,
    source_response_bytes: htmlBytes.length,
    catalog_year_verified: context.catalog_year,
    courseblock_index: entry.courseblock_index,
    published_units: entry.published_units,
    complete_entry_receipt: entry.complete_entry_receipt,
    structured_requisite_fields: entry.structured_requisite_fields,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
    retained_source_contract: route.retained_source_contract,
    retained_source_text_cache_path: route.retained_text_cache_path,
    retained_source_text_sha256: context.text_sha256,
    live_recapture_claim: false,
  })) : [];
  return { capture, entries };
}

function buildBrowserSitemapCapture(route) {
  const cached = readCachedHtmlRoute(route);
  if (cached.failure) return { capture: cached.failure, evidence: null };
  const sitemap = extractSitemapLocations(cached.body);
  const expectedUrls = asArray(route.expected_discovered_paths)
    .map((pathname) => `https://${route.official_host}${pathname}`);
  const missingPaths = expectedUrls.filter((url) => !sitemap.locations.includes(url));
  const verified = sitemap.valid
    && route.discovery_contract === VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT
    && missingPaths.length === 0;
  const receipt = {
    discovery_contract: route.discovery_contract,
    official_url: route.official_url,
    source_response_sha256: cached.responseHash,
    location_count: sitemap.locations.length,
    locations_sha256: sitemap.locations_sha256,
    expected_discovered_paths: route.expected_discovered_paths,
    missing_expected_paths: missingPaths,
  };
  return {
    capture: {
      ...route,
      capture_status: verified ? 'sitemap_discovery_verified' : 'blocked_fail_closed',
      blocked_reason: verified ? null
        : `sitemap_discovery_failed:${sitemap.invalid.join(',') || missingPaths.join(',') || 'empty'}`,
      cache_path: cached.files.rawRelative,
      final_url: cached.metadata.final_url,
      fetched_at: cached.metadata.fetched_at,
      source_response_sha256: cached.responseHash,
      source_response_bytes: cached.bytes.length,
      browser_challenge_receipt: cached.metadata.browser_challenge_receipt,
      robots_receipt: cached.metadata.robots_receipt,
      ...receipt,
    },
    evidence: verified ? { ...receipt, locations: new Set(sitemap.locations) } : null,
  };
}

function commandVersion(command) {
  const result = spawnSync(command, ['-v'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout || ''}${result.stderr || ''}`.split(/\r?\n/).find(Boolean) || null;
}

function buildCnuPdfCapture(route) {
  const pdfPath = absoluteCachePath(route.cache_path);
  if (!fs.existsSync(pdfPath)) return {
    capture: {
      ...route,
      capture_status: 'blocked_fail_closed',
      blocked_reason: 'retained_official_pdf_missing',
      cache_path: route.cache_path,
    },
    entries: [],
  };
  let bytes;
  let bboxHtml;
  let pdfInfoText;
  let pdftotextVersion;
  try {
    bytes = fs.readFileSync(pdfPath);
    bboxHtml = execFileSync('pdftotext', ['-bbox-layout', pdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    });
    pdfInfoText = execFileSync('pdfinfo', [pdfPath], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    pdftotextVersion = commandVersion('pdftotext');
    if (!pdftotextVersion) throw new Error('pdftotext_version_unavailable');
  } catch (error) {
    return {
      capture: {
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `pdf_extraction_failed:${error.message}`,
        cache_path: route.cache_path,
      },
      entries: [],
    };
  }
  const result = extractCnuPdfEntries({
    pdfBytes: bytes,
    bboxHtml,
    pdfInfoText,
    targetCodes: route.target_course_codes,
    catalogYear: route.catalog_year,
    expectedPdfSha256: route.expected_pdf_sha256,
    expectedTitle: route.expected_pdf_title,
    expectedPageCount: route.expected_page_count,
  });
  const capture = {
    ...route,
    capture_status: result.verified
      ? (result.entries.length ? 'bounded_entries_available' : 'no_exact_entries_bounded')
      : 'blocked_fail_closed',
    blocked_reason: result.verified ? null : `pdf_verification_failed:${result.issues.join(',')}`,
    cache_path: route.cache_path,
    final_url: route.official_url,
    fetched_at: null,
    source_response_sha256: result.pdf_sha256,
    source_response_bytes: bytes.length,
    catalog_year_verified: result.verified ? route.catalog_year : null,
    pdf_title_verified: result.verified ? result.pdf_info.title : null,
    pdf_page_count: result.page_count,
    bbox_layout_sha256: result.bbox_layout_sha256,
    pdftotext_version: pdftotextVersion,
    geometry_contract: result.geometry_contract || null,
    classified_block_count: result.classified_block_count || 0,
    rejected_geometry_block_count: result.rejected_geometry_block_count || 0,
    recognized_heading_count: result.recognized_heading_count || 0,
    possible_boundary_count: result.possible_boundary_count || 0,
    boundary_only_heading_count: result.boundary_only_heading_count || 0,
    exact_entry_count: result.entries.length,
    exact_entry_codes: result.entries.map((row) => row.course_code),
    ambiguous: result.ambiguous,
    missing: result.missing,
    compound_heading_rejections: result.compound_heading_rejections,
    compound_entry_receipts: result.compound_entry_receipts,
    identity_discrepancy_receipts: result.identity_discrepancy_receipts,
    geometry_rejections: result.geometry_rejections,
  };
  const entries = result.entries.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'retained_official_pdf_bbox',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: entry.compound_entry
      ? CNU_COMPOUND_BOUNDARY_CONTRACT : CNU_BOUNDARY_CONTRACT,
    official_url: route.official_url,
    cache_path: route.cache_path,
    source_response_sha256: result.pdf_sha256,
    source_response_bytes: bytes.length,
    pdf_sha256: result.pdf_sha256,
    bbox_layout_sha256: result.bbox_layout_sha256,
    pdftotext_version: pdftotextVersion,
    catalog_year_verified: route.catalog_year,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    pdf_page_start: entry.pdf_page_start,
    pdf_page_end: entry.pdf_page_end,
    page_column_span: entry.page_column_span,
    source_blocks: entry.source_blocks,
    ...(entry.compound_entry ? {
      compound_entry: true,
      compound_receipt_contract: entry.compound_receipt_contract,
      compound_receipt_sha256: entry.compound_receipt_sha256,
      compound_heading_course_codes: entry.compound_heading_course_codes,
      compound_member_requisite: entry.compound_member_requisite,
      compound_sibling_requisites: entry.compound_sibling_requisites,
    } : {}),
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
  }));
  return { capture, entries };
}

function readPinnedEvidence(route, expectedPath, expectedSha256, issueForEvidence) {
  if (route.evidence_cache_path !== expectedPath
      || route.evidence_artifact_sha256 !== expectedSha256) {
    return { issue: 'route_evidence_contract_drifted' };
  }
  const absolute = absoluteCachePath(expectedPath);
  if (!fs.existsSync(absolute)) return { issue: 'retained_evidence_artifact_missing' };
  const bytes = fs.readFileSync(absolute);
  if (sha256(bytes) !== expectedSha256) return { issue: 'retained_evidence_artifact_hash_mismatch' };
  let evidence;
  try { evidence = JSON.parse(bytes.toString('utf8')); } catch {
    return { issue: 'retained_evidence_artifact_invalid_json' };
  }
  const issue = issueForEvidence(evidence);
  return issue ? { issue } : { evidence, bytes };
}

function buildCnuCpen371wEvidenceCapture(route) {
  const retained = readPinnedEvidence(
    route,
    CNU_CPEN371W_EVIDENCE_CACHE_PATH,
    CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256,
    cnuCpen371wPrerequisiteEvidenceIssue,
  );
  const routeValid = route.platform === 'cnu_cpen371w_current_joint_evidence'
    && route.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT
    && route.official_url === CNU_CATALOG_URL
    && route.program_official_url === CNU_PROGRAM_URL
    && route.alias_scope === 'CPEN371W_only'
    && JSON.stringify(route.target_course_codes) === JSON.stringify(['CPEN371W']);
  if (!routeValid || retained.issue) return {
    capture: {
      ...route,
      capture_status: 'blocked_fail_closed',
      blocked_reason: routeValid ? retained.issue : 'cnu_cpen371w_exact_route_contract_drifted',
      exact_entry_count: 0,
      exact_entry_codes: [],
    },
    entries: [],
  };
  const evidence = retained.evidence;
  const course = evidence.facts.catalog_course_entry;
  const capture = {
    ...route,
    capture_status: 'bounded_entries_available',
    blocked_reason: null,
    final_url: evidence.catalog_source.final_url,
    fetched_at: null,
    source_response_sha256: evidence.catalog_source.response_sha256,
    source_response_bytes: evidence.catalog_source.response_bytes,
    program_response_sha256: evidence.program_source.response_sha256,
    robots_response_sha256: evidence.robots.response_sha256,
    facts_sha256: evidence.facts_sha256,
    evidence_artifact_sha256: sha256(retained.bytes),
    catalog_year_verified: evidence.facts.catalog_year,
    exact_entry_count: 1,
    exact_entry_codes: ['CPEN371W'],
    alias_scope: evidence.facts.identity_resolution.scope,
    broad_suffix_alias_rule_created:
      evidence.facts.identity_resolution.broad_suffix_alias_rule_created,
  };
  const entries = [{
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:CPEN371W`,
    course_code: 'CPEN371W',
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_current_cnu_joint_identity_evidence',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: CNU_ALIAS_RECEIPT_CONTRACT,
    course_boundary_contract: CNU_CPEN371W_COURSE_BOUNDARY_CONTRACT,
    official_url: CNU_CATALOG_URL,
    program_official_url: CNU_PROGRAM_URL,
    cache_path: CNU_CPEN371W_SOURCE_CACHE_PATH,
    evidence_cache_path: CNU_CPEN371W_EVIDENCE_CACHE_PATH,
    evidence_artifact_sha256: sha256(retained.bytes),
    source_response_sha256: evidence.catalog_source.response_sha256,
    source_response_bytes: evidence.catalog_source.response_bytes,
    program_response_sha256: evidence.program_source.response_sha256,
    program_response_bytes: evidence.program_source.response_bytes,
    robots_response_sha256: evidence.robots.response_sha256,
    catalog_raw_text_sha256: evidence.catalog_source.raw_text_projection_sha256,
    facts_sha256: evidence.facts_sha256,
    catalog_year_verified: evidence.facts.catalog_year,
    physical_pdf_page: course.physical_pdf_page,
    heading_text: course.heading_text,
    title: course.identity_title,
    published_units: course.published_units,
    required_requisite_clause: course.required_requisite_clause,
    semantic_prerequisite: course.semantic_prerequisite,
    program_requirement: evidence.facts.program_requirement,
    catalog_degree_requirement: evidence.facts.catalog_degree_requirement,
    identity_resolution: evidence.facts.identity_resolution,
    raw_entry_text: course.raw_entry_text,
    raw_entry_sha256: course.raw_entry_sha256,
  }];
  return { capture, entries };
}

function buildVsuArabicEvidenceCapture(route) {
  const retained = readPinnedEvidence(
    route,
    VSU_ARABIC_EVIDENCE_CACHE_PATH,
    VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256,
    virginiaStateArabicPrerequisiteEvidenceIssue,
  );
  const routeTargets = [...route.target_course_codes].sort();
  const routeValid = route.platform === 'vsu_arabic_current_department_evidence'
    && route.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT
    && route.official_url === VSU_DEPARTMENT_URL
    && routeTargets.length > 0
    && routeTargets.every((code) => ['ARAB110', 'ARAB111', 'ARAB212', 'ARAB213'].includes(code));
  if (!routeValid || retained.issue) return {
    capture: {
      ...route,
      capture_status: 'blocked_fail_closed',
      blocked_reason: routeValid ? retained.issue : 'vsu_arabic_exact_route_contract_drifted',
      exact_entry_count: 0,
      exact_entry_codes: [],
    },
    entries: [],
  };
  const evidence = retained.evidence;
  const selected = evidence.facts.entries
    .filter((entry) => routeTargets.includes(entry.course_code))
    .sort((left, right) => left.course_code.localeCompare(right.course_code));
  const complete = selected.length === routeTargets.length
    && selected.every((entry, index) => entry.course_code === routeTargets[index]);
  if (!complete) return {
    capture: {
      ...route,
      capture_status: 'blocked_fail_closed',
      blocked_reason: 'vsu_arabic_evidence_target_partition_incomplete',
      exact_entry_count: 0,
      exact_entry_codes: [],
    },
    entries: [],
  };
  const capture = {
    ...route,
    capture_status: 'bounded_entries_available',
    blocked_reason: null,
    final_url: evidence.source.final_url,
    fetched_at: null,
    source_response_sha256: evidence.source.response_sha256,
    source_response_bytes: evidence.source.response_bytes,
    robots_response_sha256: evidence.robots.response_sha256,
    facts_sha256: evidence.facts_sha256,
    evidence_artifact_sha256: sha256(retained.bytes),
    arabic_section_html_sha256: evidence.source.arabic_section_html_sha256,
    arabic_section_courseblock_count: evidence.source.arabic_section_courseblock_count,
    catalog_year_verified: evidence.facts.catalog_year,
    exact_entry_count: selected.length,
    exact_entry_codes: selected.map((entry) => entry.course_code),
  };
  const entries = selected.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_vsu_languages_department_evidence',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: VSU_ARABIC_BOUNDARY_CONTRACT,
    official_url: VSU_DEPARTMENT_URL,
    cache_path: VSU_ARABIC_SOURCE_CACHE_PATH,
    evidence_cache_path: VSU_ARABIC_EVIDENCE_CACHE_PATH,
    evidence_artifact_sha256: sha256(retained.bytes),
    source_response_sha256: evidence.source.response_sha256,
    source_response_bytes: evidence.source.response_bytes,
    robots_response_sha256: evidence.robots.response_sha256,
    facts_sha256: evidence.facts_sha256,
    arabic_section_html_sha256: evidence.source.arabic_section_html_sha256,
    arabic_section_courseblock_count: evidence.source.arabic_section_courseblock_count,
    catalog_year_verified: evidence.facts.catalog_year,
    heading_text: entry.heading_text,
    title: entry.title,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    formal_prerequisite_marker_count: entry.formal_prerequisite_marker_count,
    required_requisite_clause: entry.required_requisite_clause,
    enrollment_restriction: entry.enrollment_restriction,
    catalog_silence_inferred_as_no_prerequisite:
      entry.catalog_silence_inferred_as_no_prerequisite,
    semantic_prerequisite: entry.semantic_prerequisite,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
  }));
  return { capture, entries };
}

function buildVirginiaTechGraduateCsEvidenceCapture(route) {
  const retained = readPinnedEvidence(
    route,
    VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH,
    VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256,
    virginiaTechGraduateCsPrerequisiteEvidenceIssue,
  );
  const routeTargets = [...route.target_course_codes].sort();
  const routeValid = route.platform
      === 'virginia_tech_graduate_cs_current_department_evidence'
    && route.boundary_contract === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT
    && route.official_url === VIRGINIA_TECH_GRADUATE_CS_URL
    && route.robots_official_url === VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL
    && route.cache_path === VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH
    && routeTargets.length > 0
    && routeTargets.every((code) => VIRGINIA_TECH_GRADUATE_CS_TARGETS.includes(code));
  if (!routeValid || retained.issue) return {
    capture: {
      ...route,
      capture_status: 'blocked_fail_closed',
      blocked_reason: routeValid
        ? retained.issue : 'virginia_tech_graduate_cs_exact_route_contract_drifted',
      exact_entry_count: 0,
      exact_entry_codes: [],
    },
    entries: [],
  };
  const evidence = retained.evidence;
  const selected = evidence.facts.entries
    .filter((entry) => routeTargets.includes(entry.course_code))
    .sort((left, right) => left.course_code.localeCompare(right.course_code));
  const complete = selected.length === routeTargets.length
    && selected.every((entry, index) => entry.course_code === routeTargets[index]);
  if (!complete) return {
    capture: {
      ...route,
      capture_status: 'blocked_fail_closed',
      blocked_reason: 'virginia_tech_graduate_cs_evidence_target_partition_incomplete',
      exact_entry_count: 0,
      exact_entry_codes: [],
    },
    entries: [],
  };
  const capture = {
    ...route,
    capture_status: 'bounded_entries_available',
    blocked_reason: null,
    final_url: evidence.source.final_url,
    fetched_at: null,
    source_response_sha256: evidence.source.response_sha256,
    source_response_bytes: evidence.source.response_bytes,
    robots_response_sha256: evidence.robots.response_sha256,
    facts_sha256: evidence.facts_sha256,
    evidence_artifact_sha256: sha256(retained.bytes),
    source_effective_pubdate: evidence.facts.source_temporal_binding.page_pubdate,
    source_captured_on: evidence.facts.source_temporal_binding.captured_on,
    source_catalog_edition_claimed:
      evidence.facts.source_temporal_binding.catalog_edition_claimed,
    exact_entry_count: selected.length,
    exact_entry_codes: selected.map((entry) => entry.course_code),
  };
  const entries = selected.map((entry) => ({
    school_id: route.school_id,
    slug: route.slug,
    owner_namespace: route.owner_namespace,
    course_key: `${route.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    capture_status: 'exact_entry_candidate_review_required',
    capture_origin: 'official_current_virginia_tech_graduate_cs_evidence',
    publication_ready: false,
    no_prerequisite_inference: true,
    boundary_contract: VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
    source_current_contract: entry.source_current_contract,
    official_url: VIRGINIA_TECH_GRADUATE_CS_URL,
    robots_official_url: VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
    cache_path: VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH,
    evidence_cache_path: VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH,
    evidence_artifact_sha256: sha256(retained.bytes),
    source_response_sha256: evidence.source.response_sha256,
    source_response_bytes: evidence.source.response_bytes,
    robots_response_sha256: evidence.robots.response_sha256,
    facts_sha256: evidence.facts_sha256,
    source_effective_pubdate: entry.source_effective_pubdate,
    source_captured_on: evidence.facts.source_temporal_binding.captured_on,
    catalog_edition_claimed: entry.catalog_edition_claimed,
    catalog_year_verified: null,
    heading_text: entry.heading_text,
    title: entry.title,
    boundary_start: entry.boundary_start,
    boundary_end: entry.boundary_end,
    next_heading_code: entry.next_heading_code,
    published_units: entry.published_units,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    formal_prerequisite_marker_count: entry.formal_prerequisite_marker_count,
    formal_corequisite_marker_count: entry.formal_corequisite_marker_count,
    prerequisite_marker_like_count: entry.prerequisite_marker_like_count,
    constraint_like_signal_count: entry.constraint_like_signal_count,
    required_requisite_clause: entry.required_requisite_clause,
    structural_none_evidence: entry.structural_none_evidence,
    semantic_prerequisite: entry.semantic_prerequisite,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_sha256: entry.raw_entry_sha256,
  }));
  return { capture, entries };
}

function buildFromCache(plan = planFromArtifacts()) {
  const captures = [];
  const entries = [];
  const bridgewaterEditionRoute = plan.routes.find((route) => (
    route.slug === BRIDGEWATER_SLUG && route.platform === 'cleancatalog_edition'
  ));
  const bridgewaterEdition = bridgewaterEditionRoute
    ? buildBridgewaterEditionCapture(bridgewaterEditionRoute)
    : { capture: null, evidence: null };
  const virginiaTechSitemapRoute = plan.routes.find((route) => (
    route.slug === VIRGINIA_TECH_SLUG && route.platform === 'browser_challenge_sitemap'
  ));
  const virginiaTechSitemap = virginiaTechSitemapRoute
    ? buildBrowserSitemapCapture(virginiaTechSitemapRoute)
    : { capture: null, evidence: null };
  for (const route of plan.routes) {
    if (route.platform === 'cnu_cpen371w_current_joint_evidence') {
      const result = buildCnuCpen371wEvidenceCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'vsu_arabic_current_department_evidence') {
      const result = buildVsuArabicEvidenceCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'virginia_tech_graduate_cs_current_department_evidence') {
      const result = buildVirginiaTechGraduateCsEvidenceCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'pdf_bbox_columns') {
      const result = buildCnuPdfCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'cleancatalog_edition') {
      captures.push(bridgewaterEdition.capture);
      continue;
    }
    if (route.platform === 'cleancatalog_course') {
      const result = buildBridgewaterCourseCapture(route, bridgewaterEdition.evidence);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'longwood_department_course_listing') {
      const result = buildLongwoodDepartmentCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'longwood_banner_course_listing') {
      const result = buildLongwoodBannerCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'radford_acalog_course') {
      const result = buildRadfordCourseCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'uva_wise_acalog_course') {
      const result = buildUvaWiseCourseCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'shenandoah_acalog_course') {
      const result = buildShenandoahCourseCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'retained_courseleaf_source') {
      const result = buildRetainedCourseLeafCapture(route);
      captures.push(result.capture);
      entries.push(...result.entries);
      continue;
    }
    if (route.platform === 'browser_challenge_sitemap') {
      captures.push(virginiaTechSitemap.capture);
      continue;
    }
    const cached = readCachedHtmlRoute(route);
    if (cached.failure) {
      captures.push(cached.failure);
      continue;
    }
    const yearVerified = catalogYearSeen(cached.body, route.catalog_year);
    if (!yearVerified) {
      captures.push({
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: `catalog_year_not_verified:${route.catalog_year}`,
        cache_path: cached.files.rawRelative,
        final_url: cached.metadata.final_url,
        fetched_at: cached.metadata.fetched_at,
        source_response_sha256: cached.responseHash,
      });
      continue;
    }
    const sitemapReceipt = route.slug === VIRGINIA_TECH_SLUG
      && route.platform === 'browser_challenge_courseleaf'
      ? virginiaTechSitemap.evidence : null;
    if (route.slug === VIRGINIA_TECH_SLUG
        && route.platform === 'browser_challenge_courseleaf'
        && (!sitemapReceipt
          || !sitemapReceipt.locations.has(route.official_url))) {
      captures.push({
        ...route,
        capture_status: 'blocked_fail_closed',
        blocked_reason: 'exact_official_sitemap_department_path_not_verified',
        cache_path: cached.files.rawRelative,
        final_url: cached.metadata.final_url,
        source_response_sha256: cached.responseHash,
      });
      continue;
    }
    const result = extractCourseLeafEntries(cached.body, route.target_course_codes);
    const compactSitemapReceipt = sitemapReceipt ? {
      discovery_contract: sitemapReceipt.discovery_contract,
      official_url: sitemapReceipt.official_url,
      source_response_sha256: sitemapReceipt.source_response_sha256,
      location_count: sitemapReceipt.location_count,
      locations_sha256: sitemapReceipt.locations_sha256,
      discovered_course_url: route.official_url,
      path_discovered: true,
    } : null;
    captures.push({
      ...route,
      capture_status: result.entries.length ? 'bounded_entries_available' : 'no_exact_entries_bounded',
      cache_path: cached.files.rawRelative,
      final_url: cached.metadata.final_url,
      fetched_at: cached.metadata.fetched_at,
      source_response_sha256: cached.responseHash,
      source_response_bytes: cached.bytes.length,
      catalog_year_verified: route.catalog_year,
      courseblock_count: result.courseblock_count,
      complete_entry_count: result.complete_entry_count,
      complete_entries_with_required_requisite_marker_count:
        result.complete_entries_with_required_requisite_marker_count,
      exact_entry_count: result.entries.length,
      exact_entry_codes: result.entries.map((row) => row.course_code),
      ambiguous: result.ambiguous,
      missing: result.missing,
      robots: cached.metadata.robots,
      ...(cached.cacheReacquisitionReceipt ? {
        cache_reacquisition_receipt: cached.cacheReacquisitionReceipt,
      } : {}),
      ...(route.platform === 'browser_challenge_courseleaf' ? {
        browser_challenge_receipt: cached.metadata.browser_challenge_receipt,
        robots_receipt: cached.metadata.robots_receipt,
        sitemap_discovery_receipt: compactSitemapReceipt,
      } : {}),
    });
    for (const entry of result.entries) {
      entries.push({
        school_id: route.school_id,
        slug: route.slug,
        owner_namespace: route.owner_namespace,
        course_key: `${route.owner_namespace}:${entry.course_code}`,
        course_code: entry.course_code,
        capture_status: 'exact_entry_candidate_review_required',
        publication_ready: false,
        no_prerequisite_inference: true,
        boundary_contract: route.boundary_contract,
        official_url: cached.metadata.final_url,
        cache_path: cached.files.rawRelative,
        source_response_sha256: cached.responseHash,
        source_response_bytes: cached.bytes.length,
        catalog_year_verified: route.catalog_year,
        courseblock_index: entry.courseblock_index,
        published_units: entry.published_units,
        complete_entry_receipt: entry.complete_entry_receipt,
        structured_requisite_fields: entry.structured_requisite_fields,
        ...(cached.cacheReacquisitionReceipt ? {
          cache_reacquisition_receipt: cached.cacheReacquisitionReceipt,
        } : {}),
        raw_entry_html_sha256: entry.raw_entry_html_sha256,
        raw_entry_text: entry.raw_entry_text,
        raw_entry_sha256: entry.raw_entry_sha256,
        ...(route.platform === 'browser_challenge_courseleaf' ? {
          capture_origin: 'official_acquisition',
          target_subject_prefix: route.target_subject_prefix,
          browser_challenge_contract: route.browser_challenge_contract,
          browser_challenge_receipt: cached.metadata.browser_challenge_receipt,
          robots_receipt: cached.metadata.robots_receipt,
          sitemap_discovery_receipt: compactSitemapReceipt,
        } : {}),
      });
    }
  }
  entries.sort((left, right) => left.course_key.localeCompare(right.course_key));
  const attempted = captures.filter((row) => row.capture_status !== 'not_attempted');
  const successfulCaptureStatuses = new Set([
    'bounded_entries_available',
    'catalog_edition_verified',
    'sitemap_discovery_verified',
  ]);
  const capturedKeys = new Set(entries.map((row) => row.course_key));
  const testedRouteKeys = new Set(plan.routes.flatMap((route) => (
    route.target_course_codes.map((code) => `${route.owner_namespace}:${code}`)
  )));
  const testedRouteMissingKeys = [...testedRouteKeys].filter((key) => !capturedKeys.has(key)).sort();
  const ownerBlockedKeys = plan.blocked.flatMap((row) => row.target_course_codes
    .map((code) => `${row.owner_namespace}:${code}`));
  const slugs = [...new Set([
    ...plan.routes.map((row) => row.slug),
    ...plan.blocked.map((row) => row.slug),
  ])].sort();
  const institutionGaps = slugs.map((slug) => {
    const routeRows = plan.routes.filter((row) => row.slug === slug);
    const blockedRows = plan.blocked.filter((row) => row.slug === slug);
    const owner = routeRows[0]?.owner_namespace || blockedRows[0]?.owner_namespace;
    const routeKeys = new Set(routeRows.flatMap((row) => row.target_course_codes
      .map((code) => `${owner}:${code}`)));
    const blockedKeys = new Set(blockedRows.flatMap((row) => row.target_course_codes
      .map((code) => `${owner}:${code}`)));
    const exact = [...new Set([...routeKeys, ...blockedKeys])].filter((key) => capturedKeys.has(key));
    const testedMissing = [...routeKeys].filter((key) => !capturedKeys.has(key));
    return {
      slug,
      owner_namespace: owner,
      capture_target_keys: new Set([...routeKeys, ...blockedKeys]).size,
      exact_entry_candidates: exact.length,
      tested_official_routes_without_exact_entry: testedMissing.length,
      tested_official_route_missing_codes: testedMissing.map((key) => key.split(':').at(-1)).sort(),
      owner_specific_unavailable_or_deferred: blockedKeys.size,
      owner_specific_unavailable_or_deferred_codes: [...blockedKeys]
        .map((key) => key.split(':').at(-1)).sort(),
      remaining_capture_gap: testedMissing.length + blockedKeys.size,
    };
  });
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    snapshot_date: plan.snapshot_date,
    publication_ready: false,
    authority: 'official_institution_catalog_retained_source_capture',
    summary: {
      planned_capture_keys: plan.summary.unique_capture_keys,
      planned_routes: plan.routes.length,
      attempted_routes: attempted.length,
      bounded_routes: captures.filter((row) => row.capture_status === 'bounded_entries_available').length,
      blocked_or_empty_routes:
        attempted.filter((row) => !successfulCaptureStatuses.has(row.capture_status)).length,
      exact_entry_candidates: entries.length,
      unique_exact_entry_candidates: new Set(entries.map((row) => row.course_key)).size,
      owner_specific_blocked_keys: plan.summary.owner_specific_blocked_keys,
      tested_route_keys_without_exact_entry: testedRouteMissingKeys.length,
      remaining_capture_keys: testedRouteMissingKeys.length + ownerBlockedKeys.length,
    },
    evidence_boundary: [
      'Every retained source is bound to the official URL declared by the university scope and its bytes are hashed before entry extraction.',
      'Only an institution-specific structural boundary with an exact leading course code and published unit label becomes an entry candidate.',
      'CNU PDF candidates require the pinned official PDF hash, catalog title/year/page count, non-overlapping bbox columns, a unique exact leading code, and published unit notation; compound sequence headings remain uncaptured.',
      'CNU CPEN371W alone uses a separate current 2026-2027 joint receipt: the current degree requirement publishes CPEN 371W - Computer Ethics while the same catalog has one CPEN 371 WI: Computer Ethics entry. The alias is exact-target-only and never creates a suffix rule.',
      'VSU ARAB110/111/212/213 alone use the complete current Languages and Literature Arabic section. ARAB110 retains its admission-credit enrollment restriction, and each later course retains the catalog-published course-or-equivalent alternative.',
      'Virginia Tech CS5104/CS5114 alone use exact complete heading-to-next-heading entries from the hash-pinned current first-party graduate CS page. CS5104 structural silence requires zero requisite and constraint-like markers plus same-page positive controls; CS5114 retains exactly Pre: CS3114. No catalog-edition claim or missing-search inference is made.',
      'Bridgewater candidates require a separate hashed Courses of Instruction page stating the exact catalog year plus one unique full CleanCatalog class article with an exact canonical path, H1 code, and published Credits field.',
      'Longwood candidates use either the unversioned first-party Computer Science listing or Courses from Banner listing for exact entry text, plus a separate retained Acalog page for the selected 2026-2027 Undergraduate Catalog/catoid 19 context. Neither listing is represented as printing a year, and silence never proves no prerequisite.',
      'Radford candidates require one robots-permitted, 120-second-spaced official Acalog preview_course_nopop response per program-listed or exact retained-entry-linked target, exact catoid 62/coid/H1/title/Credits identity, and a hash-pinned discovery link. Prerequisite and Pre- or Corequisite markers are separately bounded; no AJAX endpoint is used and silence never proves no prerequisite.',
      'UVA Wise candidates require one robots-permitted, 120-second-spaced official HTTP Acalog preview_course_nopop response per program-listed or exact retained-entry-linked target, exact catoid 9/coid/H1/title/Credits identity, and hash-pinned discovery evidence. No AJAX endpoint is used and silence never proves no prerequisite.',
      'Shenandoah candidates require one robots-permitted, 120-second-spaced official Acalog preview_course_nopop response per exact catoid 33 program-listed target, plus a hash-pinned retained 2025-2026 program discovery link. Obsolete catoid 11 course-map links are rejected, no AJAX endpoint is used, and silence never proves no prerequisite.',
      'JMU and Virginia Tech browser captures are limited to two known official CourseLeaf hosts and exact reviewed paths. Every accepted robots, sitemap, and course document retains both raw responses and requires an exact same-URL document sequence of HTTP 202 followed by HTTP 200.',
      'JMU entries require one unique CourseLeaf courseblock, an exact leading course code, and one unique structured detail-hours_html Credits field. Virginia Tech non-CS entries additionally require the exact department URL to occur in the hashed official sitemap; missing target codes remain gaps.',
      'Missing markers and silent entries never become status=none. Every captured entry remains review-required.',
      'Empty robots bodies, disallow rules, long crawl delays, incomplete browser challenge sequences, login/interstitial responses, ambiguous duplicate blocks, and hash drift fail closed.',
    ],
    plan_summary: plan.summary,
    owner_specific_blockers: plan.blocked,
    institution_gaps: institutionGaps,
    captures,
    entries,
  };
}

async function main() {
  const plan = planFromArtifacts();
  if (FETCH) await captureRoutes(plan);
  const artifact = buildFromCache(plan);
  const report = validateAcquisitionArtifact(artifact, { plan });
  if (!report.valid) throw new Error(`acquisition validation failed: ${report.issues.join(', ')}`);
  const rendered = `${JSON.stringify(artifact, null, 2)}\n`;
  if (WRITE) fs.writeFileSync(OUTPUT, rendered);
  else if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
    throw new Error('Virginia university prerequisite acquisition artifact drifted; inspect and rerun with --write');
  }
  if (JSON_ONLY) return process.stdout.write(rendered);
  console.log('Virginia university prerequisite official acquisition: REVIEW ONLY');
  console.log(`  capture keys ${artifact.summary.planned_capture_keys}`);
  console.log(`  attempted routes ${artifact.summary.attempted_routes}/${artifact.summary.planned_routes}`);
  console.log(`  exact complete-entry candidates ${artifact.summary.exact_entry_candidates}`);
  console.log(`  owner-specific blocked keys ${artifact.summary.owner_specific_blocked_keys}`);
  console.log(WRITE ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

module.exports = {
  OUTPUT,
  buildFromCache,
  captureBrowserChallengeDocument,
  captureRoutes,
  buildBridgewaterCourseCapture,
  buildBridgewaterEditionCapture,
  buildBrowserSitemapCapture,
  buildCnuCpen371wEvidenceCapture,
  buildCnuPdfCapture,
  buildLongwoodBannerCapture,
  buildLongwoodDepartmentCapture,
  buildRadfordCourseCapture,
  buildUvaWiseCourseCapture,
  buildShenandoahCourseCapture,
  buildVsuArabicEvidenceCapture,
  buildVirginiaTechGraduateCsEvidenceCapture,
  latestRetainedRouteFetchTime,
  readCachedHtmlRoute,
  planFromArtifacts,
  rawGet,
  verifyCachedBrowserRoute,
};
