#!/usr/bin/env node
/**
 * Replay the retained official prerequisite sources for the finite unresolved
 * rows at Shenandoah, UVA Wise, Mary Washington, William & Mary, JMU, and CNU.
 *
 * This script is local-only. It never opens MongoDB or performs network I/O.
 * The CNU PDF is replayed through pdfinfo/pdftotext in a private temp folder;
 * every other source is reparsed directly from its retained HTTP bytes.
 */

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  BROWSER_CHALLENGE_CONTRACT,
  catalogYearSeen,
  extractCourseLeafEntries,
  requisiteMarkerCounts,
  validateBrowserChallengeReceipt,
  validateBrowserRobotsReceipt,
} = require('../../services/virginia/universityPrerequisiteAcquisition');
const {
  CNU_BOUNDARY_CONTRACT,
  CNU_EXPECTED_PAGE_COUNT,
  CNU_EXPECTED_PDF_SHA256,
  CNU_EXPECTED_PDF_TITLE,
  CNU_PDF_CACHE_PATH,
  extractCnuPdfEntries,
} = require('../../services/virginia/cnuPdfPrerequisiteAcquisition');
const {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CATALOG_YEAR,
  SHENANDOAH_COURSE_CATALOG_CACHE_PATH,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  SHENANDOAH_SLUG,
  expectedCourseUrl: expectedShenandoahCourseUrl,
  extractShenandoahCourseEntry,
  extractShenandoahFilteredDiscovery,
  verifyShenandoahCourseCatalogFilterForm,
  verifyShenandoahProgramDiscovery,
} = require('../../services/virginia/shenandoahAcalogPrerequisiteAcquisition');
const {
  UVA_WISE_BOUNDARY_CONTRACT,
  UVA_WISE_CATALOG_YEAR,
  UVA_WISE_GE_CACHE_PATH,
  UVA_WISE_PROGRAM_CACHE_PATH,
  UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
  UVA_WISE_SLUG,
  expectedCourseUrl: expectedUvaWiseCourseUrl,
  extractUvaWiseCourseEntry,
  verifyUvaWiseDiscovery,
} = require('../../services/virginia/uvaWiseAcalogPrerequisiteAcquisition');
const {
  ARTIFACT,
  CNU,
  CONTRACT,
  DECISIONS,
  EVIDENCE_PATH,
  JMU,
  SHEN,
  TARGET_KEYS,
  UMW,
  UVA_WISE,
  WM,
  artifactIssues,
  canonicalJson,
  normalizedText,
  sha256,
} = require('../../services/virginia/smallUniversityPrerequisiteClosureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const CACHE = path.join(SERVER, '.va-catalogs');
const CANDIDATES = path.join(
  CACHE, 'research', 'va-university-prerequisite-candidates.json',
);
const COURSELEAF_BOUNDARY =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';

const COURSELEAF_SOURCES = Object.freeze({
  jmu_math: Object.freeze({
    institution: JMU,
    official_url: 'https://catalog.jmu.edu/courses/math/',
    cache_path:
      'university-prerequisites/raw/james-madison-university/james-madison-university__math.html',
    response_sha256:
      'b0bb5de8fd65f4a48f183582c4abbd1faa2fe57241692595bcdd75bbab72f853',
    response_bytes: 174336,
    courseblock_count: 109,
    complete_entry_count: 109,
    positive_count: 79,
    target_codes: Object.freeze(['MATH105', 'MATH155', 'MATH156', 'MATH236']),
    positive_control_code: 'MATH220',
    browser_challenge: true,
  }),
  umw_cpsc: Object.freeze({
    institution: UMW,
    official_url: 'https://catalog.umw.edu/undergraduate/course-descriptions/cpsc/',
    cache_path:
      'university-prerequisites/raw/university-of-mary-washington/university-of-mary-washington__cpsc.html',
    response_sha256:
      'd89c5ff3ebab107fb32e31c81ffc6fa438d5c1574a94ba892b69a4fda0ab3039',
    response_bytes: 61064,
    courseblock_count: 35,
    complete_entry_count: 34,
    positive_count: 24,
    target_codes: Object.freeze(['CPSC110', 'CPSC220', 'CPSC284']),
    positive_control_code: 'CPSC225',
  }),
  wm_csci: Object.freeze({
    institution: WM,
    official_url: 'https://catalog.wm.edu/undergraduate/courses/csci/',
    cache_path:
      'university-prerequisites/raw/william-mary/william-mary__csci.html',
    response_sha256:
      '54b9e44c308f6205f5d05437c649e4f19ecf9d0d027c7379374e0d84ad844eed',
    response_bytes: 102381,
    courseblock_count: 62,
    complete_entry_count: 62,
    positive_count: 38,
    target_codes: Object.freeze(['CSCI141']),
    positive_control_code: 'CSCI241',
  }),
  wm_math: Object.freeze({
    institution: WM,
    official_url: 'https://catalog.wm.edu/undergraduate/courses/math/',
    cache_path:
      'university-prerequisites/raw/william-mary/william-mary__math.html',
    response_sha256:
      '24fa149a313b93ef85e754286e9aa01ebd2e03a938a7e0b6315a5f620682928f',
    response_bytes: 104364,
    courseblock_count: 63,
    complete_entry_count: 63,
    positive_count: 47,
    target_codes: Object.freeze(['MATH109', 'MATH111', 'MATH131']),
    positive_control_code: 'MATH112',
  }),
});

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

function metadataPath(cachePath) {
  return path.join(CACHE, cachePath.replace(/\.html$/, '.json'));
}

function verifyReceiptCacheRows(receipt) {
  for (const row of receipt?.document_responses || []) {
    const file = path.join(CACHE, row.cache_path || '');
    if (!row.cache_path || !fs.existsSync(file)) {
      throw new Error(`missing retained browser receipt cache ${row.cache_path || '<null>'}`);
    }
    const bytes = fs.readFileSync(file);
    if (bytes.length !== row.byte_length || sha256(bytes) !== row.content_sha256) {
      throw new Error(`${row.cache_path}: retained browser receipt bytes changed`);
    }
  }
}

function verifyNormalRobots(metadata, officialUrl) {
  const protocol = new URL(officialUrl).protocol;
  const host = new URL(officialUrl).hostname.toLowerCase();
  const suffix = protocol === 'http:' ? '__http' : '';
  const cachePath = path.join(
    CACHE, 'university-prerequisites', 'raw', '_robots', `${host}${suffix}.txt`,
  );
  const robots = metadata?.robots;
  if (robots?.url !== `${protocol}//${host}/robots.txt`
      || robots.http_status !== 200
      || !fs.existsSync(cachePath)
      || sha256(fs.readFileSync(cachePath)) !== robots.content_sha256) {
    throw new Error(`${host}: retained robots receipt changed`);
  }
}

function verifyHtmlMetadata({ bytes, metadata, source }) {
  if (metadata.requested_url !== source.official_url
      || metadata.final_url !== source.official_url
      || metadata.content_sha256 !== sha256(bytes)
      || metadata.byte_length !== bytes.length
      || !String(metadata.content_type || '').toLowerCase().includes('text/html')) {
    throw new Error(`${source.cache_path}: retained HTTP response receipt changed`);
  }
  if (source.browser_challenge) {
    const browser = validateBrowserChallengeReceipt(
      metadata.browser_challenge_receipt,
      {
        expectedUrl: source.official_url,
        expectedFinalContentType: 'text/html',
        expectedFinalSha256: sha256(bytes),
        expectedContract: BROWSER_CHALLENGE_CONTRACT,
      },
    );
    const robots = validateBrowserRobotsReceipt(metadata.robots_receipt, {
      origin: new URL(source.official_url).origin,
      checkedPath: new URL(source.official_url).pathname,
    });
    if (!browser.valid || !robots.valid) {
      throw new Error(`${source.cache_path}: browser/robots receipt failed replay`);
    }
    verifyReceiptCacheRows(metadata.browser_challenge_receipt);
    verifyReceiptCacheRows(metadata.robots_receipt.capture);
  } else {
    if (metadata.http_status !== 200) {
      throw new Error(`${source.cache_path}: retained HTTP status changed`);
    }
    verifyNormalRobots(metadata, source.official_url);
  }
}

function exactEntryFact(entry) {
  return {
    course_code: entry.course_code,
    courseblock_index: entry.courseblock_index ?? null,
    raw_entry_length: entry.raw_entry_text.length,
    raw_entry_sha256: entry.raw_entry_sha256,
    raw_entry_html_sha256: entry.raw_entry_html_sha256 || null,
    published_units: entry.published_units,
    requisite_marker_counts: entry.requisite_marker_counts || null,
    complete_entry_receipt: entry.complete_entry_receipt || null,
    structured_requisite_fields: entry.structured_requisite_fields || [],
    catoid: entry.catoid ?? null,
    coid: entry.coid ?? null,
    pdf_page_start: entry.pdf_page_start ?? null,
    pdf_page_end: entry.pdf_page_end ?? null,
    page_column_span: entry.page_column_span || null,
    source_blocks: entry.source_blocks || null,
  };
}

function buildCourseLeafSources() {
  const sourceFacts = [];
  const entries = new Map();
  for (const [sourceId, source] of Object.entries(COURSELEAF_SOURCES)) {
    const file = path.join(CACHE, source.cache_path);
    const bytes = fs.readFileSync(file);
    const metadata = readJson(metadataPath(source.cache_path));
    verifyHtmlMetadata({ bytes, metadata, source });
    if (sha256(bytes) !== source.response_sha256
        || bytes.length !== source.response_bytes
        || !catalogYearSeen(bytes.toString('utf8'), source.institution.catalogYear)) {
      throw new Error(`${sourceId}: response hash/bytes/catalog edition changed`);
    }
    const extraction = extractCourseLeafEntries(bytes, [
      ...source.target_codes, source.positive_control_code,
    ]);
    if (extraction.missing.length || extraction.ambiguous.length
        || extraction.courseblock_count !== source.courseblock_count
        || extraction.complete_entry_count !== source.complete_entry_count
        || extraction.complete_entries_with_required_requisite_marker_count
          !== source.positive_count) {
      throw new Error(`${sourceId}: complete CourseLeaf boundary population changed`);
    }
    const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
    const positive = byCode.get(source.positive_control_code);
    if (!positive || positive.requisite_marker_counts?.required !== 1
        || positive.complete_entry_receipt?.receipt_contract !== COURSELEAF_RECEIPT
        || positive.complete_entry_receipt?.same_source_positive_control !== true) {
      throw new Error(`${sourceId}: same-response required-marker control changed`);
    }
    for (const code of source.target_codes) {
      const entry = byCode.get(code);
      if (!entry) throw new Error(`${sourceId}:${code}: exact entry missing`);
      entries.set(`${source.institution.slug}:${code}`, {
        entry,
        source: {
          source_id: sourceId,
          official_url: source.official_url,
          cache_path: source.cache_path,
          source_response_sha256: source.response_sha256,
          source_response_bytes: source.response_bytes,
          catalog_year: source.institution.catalogYear,
          boundary_contract: COURSELEAF_BOUNDARY,
          marker_control: entry.complete_entry_receipt,
        },
      });
    }
    sourceFacts.push({
      source_id: sourceId,
      institution_slug: source.institution.slug,
      catalog_year: source.institution.catalogYear,
      official_url: source.official_url,
      cache_path: source.cache_path,
      metadata_cache_path: source.cache_path.replace(/\.html$/, '.json'),
      source_response_sha256: source.response_sha256,
      source_response_bytes: source.response_bytes,
      metadata_sha256: sha256(fs.readFileSync(metadataPath(source.cache_path))),
      boundary_contract: COURSELEAF_BOUNDARY,
      source_courseblock_count: extraction.courseblock_count,
      source_complete_entry_count: extraction.complete_entry_count,
      source_complete_entries_with_required_requisite_marker_count:
        extraction.complete_entries_with_required_requisite_marker_count,
      positive_control: exactEntryFact(positive),
      positive_control_sha256: sha256(canonicalJson(exactEntryFact(positive))),
      browser_challenge_receipt_sha256: metadata.browser_challenge_receipt
        ? sha256(canonicalJson(metadata.browser_challenge_receipt)) : null,
      robots_receipt_sha256: metadata.robots_receipt
        ? sha256(canonicalJson(metadata.robots_receipt))
        : sha256(canonicalJson(metadata.robots)),
    });
  }
  return { sourceFacts, entries };
}

function readAcalogDetail({
  slug, code, officialUrl, catalogYear, expectedBoundary, crawlDelay, extractor,
}) {
  const stem = `${slug}__${code.toLowerCase()}`;
  const cachePath = `university-prerequisites/raw/${slug}/${stem}.html`;
  const file = path.join(CACHE, cachePath);
  const bytes = fs.readFileSync(file);
  const metadata = readJson(metadataPath(cachePath));
  const source = { official_url: officialUrl, cache_path: cachePath };
  verifyHtmlMetadata({ bytes, metadata, source });
  if (metadata.robots?.crawl_delay_seconds !== crawlDelay) {
    throw new Error(`${slug}:${code}: crawl-delay receipt changed`);
  }
  const extraction = extractor(bytes.toString('utf8'), code, {
    finalUrl: metadata.final_url,
  });
  if (!extraction.verified || extraction.entries.length !== 1
      || extraction.missing.length) {
    throw new Error(`${slug}:${code}: Acalog exact detail boundary changed`);
  }
  const entry = extraction.entries[0];
  return {
    entry,
    source: {
      official_url: officialUrl,
      cache_path: cachePath,
      metadata_cache_path: cachePath.replace(/\.html$/, '.json'),
      source_response_sha256: sha256(bytes),
      source_response_bytes: bytes.length,
      metadata_sha256: sha256(fs.readFileSync(metadataPath(cachePath))),
      catalog_year: catalogYear,
      boundary_contract: expectedBoundary,
      robots_response_sha256: metadata.robots.content_sha256,
      robots_crawl_delay_seconds: metadata.robots.crawl_delay_seconds,
    },
  };
}

function buildAcalogSources() {
  const entries = new Map();
  const sourceFacts = [];

  const shenProgram = fs.readFileSync(path.join(CACHE, SHENANDOAH_PROGRAM_CACHE_PATH));
  const shenCourseCatalog = fs.readFileSync(
    path.join(CACHE, SHENANDOAH_COURSE_CATALOG_CACHE_PATH),
  );
  const shenFysDiscoveryPath =
    'university-prerequisites/raw/shenandoah-university/shenandoah-university__fys101_discovery.html';
  const shenFysDiscovery = fs.readFileSync(path.join(CACHE, shenFysDiscoveryPath));
  const shenProgramResult = verifyShenandoahProgramDiscovery(
    shenProgram.toString('utf8'), ['CSC121', 'CSC122'],
  );
  const shenFormResult = verifyShenandoahCourseCatalogFilterForm(
    shenCourseCatalog.toString('utf8'),
  );
  const shenFysMetadata = readJson(metadataPath(shenFysDiscoveryPath));
  verifyHtmlMetadata({
    bytes: shenFysDiscovery,
    metadata: shenFysMetadata,
    source: {
      official_url: shenFysMetadata.requested_url,
      cache_path: shenFysDiscoveryPath,
    },
  });
  const shenFysResult = extractShenandoahFilteredDiscovery(
    shenFysDiscovery.toString('utf8'), 'FYS101',
    { finalUrl: shenFysMetadata.final_url },
  );
  if (!shenProgramResult.verified || !shenFormResult.verified
      || !shenFysResult.verified
      || shenFysResult.link?.coid !== SHENANDOAH_DIRECT_COURSE_RECORDS.FYS101.coid) {
    throw new Error('Shenandoah exact discovery receipts changed');
  }
  const shenTargets = [
    ['CSC121', 'shen_csc121'],
    ['FYS101', 'shen_fys101'],
  ];
  const shenControl = readAcalogDetail({
    slug: SHENANDOAH_SLUG,
    code: 'CSC122',
    officialUrl: expectedShenandoahCourseUrl('CSC122'),
    catalogYear: SHENANDOAH_CATALOG_YEAR,
    expectedBoundary: SHENANDOAH_BOUNDARY_CONTRACT,
    crawlDelay: SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
    extractor: extractShenandoahCourseEntry,
  });
  if (!shenControl.entry.required_requisite_clause) {
    throw new Error('Shenandoah same-catalog prerequisite positive control changed');
  }
  for (const [code, sourceId] of shenTargets) {
    const target = readAcalogDetail({
      slug: SHENANDOAH_SLUG,
      code,
      officialUrl: expectedShenandoahCourseUrl(code),
      catalogYear: SHENANDOAH_CATALOG_YEAR,
      expectedBoundary: SHENANDOAH_BOUNDARY_CONTRACT,
      crawlDelay: SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
      extractor: extractShenandoahCourseEntry,
    });
    if (target.entry.required_requisite_clause !== null
        || target.entry.formal_corequisite_marker_count !== 0) {
      throw new Error(`Shenandoah ${code}: target requisite marker changed`);
    }
    const markerControl = {
      kind: 'same_catalog_acalog_required_prerequisite_positive_control',
      catalog_year: SHENANDOAH_CATALOG_YEAR,
      catoid: target.entry.catoid,
      target_required_prerequisite_marker_count: 0,
      target_corequisite_marker_count: target.entry.formal_corequisite_marker_count,
      positive_control: exactEntryFact(shenControl.entry),
      positive_control_source_response_sha256:
        shenControl.source.source_response_sha256,
      discovery_receipt_sha256: sha256(canonicalJson({
        program: shenProgramResult.links,
        filtered: shenFysResult.link,
      })),
    };
    entries.set(`${SHENANDOAH_SLUG}:${code}`, {
      entry: target.entry,
      source: {
        source_id: sourceId,
        ...target.source,
        marker_control: markerControl,
      },
    });
    sourceFacts.push({
      source_id: sourceId,
      institution_slug: SHENANDOAH_SLUG,
      ...target.source,
      marker_control: markerControl,
      program_discovery_cache_path: SHENANDOAH_PROGRAM_CACHE_PATH,
      program_discovery_sha256: sha256(shenProgram),
      course_catalog_filter_cache_path: SHENANDOAH_COURSE_CATALOG_CACHE_PATH,
      course_catalog_filter_sha256: sha256(shenCourseCatalog),
      filtered_discovery_cache_path: code === 'FYS101' ? shenFysDiscoveryPath : null,
      filtered_discovery_sha256: code === 'FYS101' ? sha256(shenFysDiscovery) : null,
    });
  }

  const uvaProgram = fs.readFileSync(path.join(CACHE, UVA_WISE_PROGRAM_CACHE_PATH));
  const uvaGe = fs.readFileSync(path.join(CACHE, UVA_WISE_GE_CACHE_PATH));
  const uvaDiscovery = verifyUvaWiseDiscovery({
    programHtml: uvaProgram.toString('utf8'),
    geHtml: uvaGe.toString('utf8'),
  }, ['CSC1010', 'ENG1010', 'CSC1180']);
  if (!uvaDiscovery.verified) throw new Error('UVA Wise exact discovery receipt changed');
  const uvaControl = readAcalogDetail({
    slug: UVA_WISE_SLUG,
    code: 'CSC1180',
    officialUrl: expectedUvaWiseCourseUrl('CSC1180'),
    catalogYear: UVA_WISE_CATALOG_YEAR,
    expectedBoundary: UVA_WISE_BOUNDARY_CONTRACT,
    crawlDelay: UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
    extractor: extractUvaWiseCourseEntry,
  });
  if (!uvaControl.entry.required_requisite_clause) {
    throw new Error('UVA Wise same-catalog prerequisite positive control changed');
  }
  for (const [code, sourceId] of [
    ['CSC1010', 'uva_wise_csc1010'], ['ENG1010', 'uva_wise_eng1010'],
  ]) {
    const target = readAcalogDetail({
      slug: UVA_WISE_SLUG,
      code,
      officialUrl: expectedUvaWiseCourseUrl(code),
      catalogYear: UVA_WISE_CATALOG_YEAR,
      expectedBoundary: UVA_WISE_BOUNDARY_CONTRACT,
      crawlDelay: UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
      extractor: extractUvaWiseCourseEntry,
    });
    if (target.entry.required_requisite_clause !== null) {
      throw new Error(`UVA Wise ${code}: target prerequisite marker changed`);
    }
    const markerControl = {
      kind: 'same_catalog_acalog_required_prerequisite_positive_control',
      catalog_year: UVA_WISE_CATALOG_YEAR,
      catoid: target.entry.catoid,
      target_required_prerequisite_marker_count: 0,
      positive_control: exactEntryFact(uvaControl.entry),
      positive_control_source_response_sha256:
        uvaControl.source.source_response_sha256,
      discovery_receipt_sha256: sha256(canonicalJson(uvaDiscovery.links)),
    };
    entries.set(`${UVA_WISE_SLUG}:${code}`, {
      entry: target.entry,
      source: {
        source_id: sourceId,
        ...target.source,
        marker_control: markerControl,
      },
    });
    sourceFacts.push({
      source_id: sourceId,
      institution_slug: UVA_WISE_SLUG,
      ...target.source,
      marker_control: markerControl,
      program_discovery_cache_path: UVA_WISE_PROGRAM_CACHE_PATH,
      program_discovery_sha256: sha256(uvaProgram),
      ge_discovery_cache_path: UVA_WISE_GE_CACHE_PATH,
      ge_discovery_sha256: sha256(uvaGe),
      http_exception_contract:
        'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1',
    });
  }
  return { sourceFacts, entries };
}

function buildCnuSource() {
  const pdfFile = path.join(CACHE, CNU_PDF_CACHE_PATH);
  const pdfBytes = fs.readFileSync(pdfFile);
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'va-cnu-prereq-'));
  try {
    const infoFile = path.join(tempDirectory, 'catalog.pdfinfo.txt');
    const bboxFile = path.join(tempDirectory, 'catalog.bbox.html');
    fs.writeFileSync(infoFile, childProcess.execFileSync('pdfinfo', [pdfFile]));
    childProcess.execFileSync('pdftotext', ['-bbox-layout', pdfFile, bboxFile]);
    const result = extractCnuPdfEntries({
      pdfBytes,
      bboxHtml: fs.readFileSync(bboxFile, 'utf8'),
      pdfInfoText: fs.readFileSync(infoFile, 'utf8'),
      targetCodes: ['CPSC250', 'ENGR211', 'MATH128'],
      catalogYear: CNU.catalogYear,
      expectedPdfSha256: CNU_EXPECTED_PDF_SHA256,
      expectedTitle: CNU_EXPECTED_PDF_TITLE,
      expectedPageCount: CNU_EXPECTED_PAGE_COUNT,
    });
    if (!result.verified || result.missing.length || result.ambiguous.length
        || result.geometry_rejections.length
        || result.recognized_heading_count !== 1321
        || result.possible_boundary_count !== 1341) {
      throw new Error(`CNU exact PDF boundary replay failed: ${result.issues.join(',')}`);
    }
    const byCode = new Map(result.entries.map((entry) => [entry.course_code, entry]));
    const positive = byCode.get('CPSC250');
    if (requisiteMarkerCounts(positive?.raw_entry_text).required !== 1) {
      throw new Error('CNU same-PDF prerequisite positive control changed');
    }
    const markerControl = {
      kind: 'same_pdf_exact_prerequisite_positive_control',
      catalog_year: CNU.catalogYear,
      pdf_title: result.pdf_info.title,
      pdf_page_count: result.page_count,
      bbox_layout_sha256: result.bbox_layout_sha256,
      recognized_heading_count: result.recognized_heading_count,
      possible_boundary_count: result.possible_boundary_count,
      positive_control: exactEntryFact(positive),
      positive_control_required_prerequisite_marker_count: 1,
    };
    const entries = new Map();
    for (const code of ['ENGR211', 'MATH128']) entries.set(`${CNU.slug}:${code}`, {
      entry: byCode.get(code),
      source: {
        source_id: 'cnu_pdf',
        official_url:
          'https://cnu.edu/public/_documents/undergrad-catalog/2025-26-undergraduate_catalog.pdf#page=271',
        cache_path: CNU_PDF_CACHE_PATH,
        source_response_sha256: result.pdf_sha256,
        source_response_bytes: pdfBytes.length,
        catalog_year: CNU.catalogYear,
        boundary_contract: CNU_BOUNDARY_CONTRACT,
        marker_control: markerControl,
      },
    });
    const versionResult = childProcess.spawnSync('pdftotext', ['-v'], {
      encoding: 'utf8',
    });
    if (versionResult.error || versionResult.status !== 0) {
      throw new Error('CNU pdftotext version receipt unavailable');
    }
    const pdftotextVersion = `${versionResult.stdout || ''}${versionResult.stderr || ''}`
      .trim().split(/\r?\n/, 1)[0];
    if (!pdftotextVersion) throw new Error('CNU pdftotext version receipt empty');
    return {
      sourceFact: {
        source_id: 'cnu_pdf',
        institution_slug: CNU.slug,
        catalog_year: CNU.catalogYear,
        official_url:
          'https://cnu.edu/public/_documents/undergrad-catalog/2025-26-undergraduate_catalog.pdf#page=271',
        cache_path: CNU_PDF_CACHE_PATH,
        source_response_sha256: result.pdf_sha256,
        source_response_bytes: pdfBytes.length,
        boundary_contract: CNU_BOUNDARY_CONTRACT,
        pdf_title: result.pdf_info.title,
        pdf_page_count: result.page_count,
        bbox_layout_sha256: result.bbox_layout_sha256,
        geometry_contract: result.geometry_contract,
        classified_block_count: result.classified_block_count,
        rejected_geometry_block_count: result.rejected_geometry_block_count,
        recognized_heading_count: result.recognized_heading_count,
        possible_boundary_count: result.possible_boundary_count,
        boundary_only_heading_count: result.boundary_only_heading_count,
        pdftotext_version: pdftotextVersion,
        marker_control: markerControl,
      },
      entries,
    };
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function genericConstraintMarkerSpans(text) {
  const pattern = /\b(?:require(?:d|ment|ments)|permission|consent|standing|placement|minimum\s+(?:score|grade)|concurrent|enroll(?:ed|ing|ment)?|admission|registration\s+restrictions?|recommended|must\s+be\s+(?:taken|passed|completed)|may\s+not\s+(?:take|be\s+taken|register|enroll|receive\s+credit)|cannot\s+(?:take|register|enroll|receive\s+credit)|may\s+receive\s+credit.{0,120}\bonly\s+one|not\s+applicable\s+for\s+credit|open\s+only\s+to|only\s+for\s+students|limited\s+to\s+students|(?:no\s+credit|credit)\s+(?:will\s+not\s+be\s+given|cannot\s+be\s+earned|may\s+not\s+be\s+earned|for\s+more\s+than\s+one)|(?:prior|working|some)\s+(?:knowledge|experience)|background\s+in|proficiency\s+in|competency\s+in|taken\s+in\s+conjunction|(?:advisor|adviser|instructor|department(?:al)?|faculty)\s+approval)\b/gi;
  return [...String(text || '').matchAll(pattern)].map((match) => ({
    raw: match[0], start: match.index, end: match.index + match[0].length,
  }));
}

function exactUniqueSpan(text, raw) {
  const first = String(text).indexOf(raw);
  return first >= 0 && String(text).indexOf(raw, first + raw.length) < 0
    ? { start: first, end: first + raw.length } : null;
}

function exactGroupSpans(text, sourceGroup) {
  if (!sourceGroup.statement_raw) {
    const raw = exactUniqueSpan(text, sourceGroup.raw);
    return raw ? [raw] : [];
  }
  const statement = exactUniqueSpan(text, sourceGroup.statement_raw);
  const inner = sourceGroup.statement_raw.indexOf(sourceGroup.raw);
  if (!statement || inner < 0 || sourceGroup.statement_raw.indexOf(
    sourceGroup.raw, inner + sourceGroup.raw.length,
  ) >= 0) return [];
  return [statement, {
    start: statement.start + inner,
    end: statement.start + inner + sourceGroup.raw.length,
  }];
}

function assertConstraintAccounting(decision, entry) {
  const spans = [
    ...decision.groups.flatMap((row) => exactGroupSpans(entry.raw_entry_text, row)),
    ...decision.signals.map((row) => exactUniqueSpan(entry.raw_entry_text, row.raw)),
  ];
  if (spans.some((row) => !row)
      || decision.groups.some((row) => exactGroupSpans(
        entry.raw_entry_text, row,
      ).length !== (row.statement_raw ? 2 : 1))) {
    throw new Error(`${decision.course_key}: exact formula/signal span changed`);
  }
  const unaccounted = genericConstraintMarkerSpans(entry.raw_entry_text).filter((marker) => (
    !spans.some((span) => marker.start >= span.start && marker.end <= span.end)
  ));
  if (unaccounted.length) {
    throw new Error(`${decision.course_key}: unaccounted constraint marker(s): ${unaccounted.map((row) => row.raw).join(', ')}`);
  }
  const counted = requisiteMarkerCounts(entry.raw_entry_text);
  const targetCounts = {
    required: counted.required,
    corequisite: counted.corequisite,
  };
  if (decision.marker_expectation
      && !same(targetCounts, decision.marker_expectation)) {
    throw new Error(`${decision.course_key}: exact prerequisite/corequisite marker expectation changed`);
  }
  return targetCounts;
}

function buildTargetRows(entrySources, candidateArtifact) {
  const candidateMap = new Map(candidateArtifact.candidates.map((candidate) => [
    `${candidate.slug}:${candidate.course_code}`, candidate,
  ]));
  return TARGET_KEYS.map((targetKey) => {
    const decision = DECISIONS[targetKey];
    const candidate = candidateMap.get(targetKey);
    const current = entrySources.get(targetKey);
    if (!candidate || !current?.entry) {
      throw new Error(`${targetKey}: exact candidate/current-source pair missing`);
    }
    const entry = current.entry;
    const source = current.source;
    if (candidate.school_id !== decision.school_id
        || candidate.owner_namespace !== decision.owner_namespace
        || candidate.course_key !== decision.course_key
        || candidate.source?.official_url !== source.official_url
        || candidate.source?.catalog_year_verified !== decision.catalog_year
        || sha256(candidate.source?.raw_entry_text || '')
          !== candidate.source?.raw_entry_sha256
        || sha256(normalizedText(candidate.source.raw_entry_text))
          !== sha256(normalizedText(entry.raw_entry_text))) {
      throw new Error(`${targetKey}: scoped candidate no longer matches current exact entry`);
    }
    const targetRequisiteMarkerCounts = assertConstraintAccounting(decision, entry);
    const acceptedHashes = [...new Set([
      candidate.source.raw_entry_sha256,
      entry.raw_entry_sha256,
    ])].sort();
    return {
      target_key: targetKey,
      school_id: decision.school_id,
      slug: decision.slug,
      owner_namespace: decision.owner_namespace,
      course_key: decision.course_key,
      course_code: decision.course_code,
      catalog_year: decision.catalog_year,
      scope_role: decision.scope_role,
      disposition: decision.disposition,
      source_id: decision.source_id,
      decision_sha256: sha256(canonicalJson(decision)),
      official_url: source.official_url,
      cache_path: source.cache_path,
      source_response_sha256: source.source_response_sha256,
      source_response_bytes: source.source_response_bytes,
      boundary_contract: source.boundary_contract,
      current_raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_html_sha256: entry.raw_entry_html_sha256 || null,
      normalized_entry_sha256: sha256(normalizedText(entry.raw_entry_text)),
      raw_entry_length: entry.raw_entry_text.length,
      published_units: entry.published_units,
      marker_control: source.marker_control,
      target_requisite_marker_counts: targetRequisiteMarkerCounts,
      accepted_candidate_raw_entry_sha256: acceptedHashes,
      candidate_capture_origin: candidate.source.capture_origin,
      candidate_raw_entry_sha256: candidate.source.raw_entry_sha256,
      candidate_normalized_entry_sha256:
        sha256(normalizedText(candidate.source.raw_entry_text)),
      source_upgrade_needed: candidate.source.capture_origin === 'retained_catalog_text',
      reviewed_formula_group_count: decision.groups.length,
      reviewed_non_prerequisite_or_blocker_signal_count: decision.signals.length,
      source_content_discarded: false,
    };
  });
}

function buildFromRetainedSources() {
  const candidateArtifact = readJson(CANDIDATES);
  const courseLeaf = buildCourseLeafSources();
  const acalog = buildAcalogSources();
  const cnu = buildCnuSource();
  const entrySources = new Map([
    ...courseLeaf.entries,
    ...acalog.entries,
    ...cnu.entries,
  ]);
  const targetRows = buildTargetRows(entrySources, candidateArtifact);
  if (!same(targetRows.map((row) => row.target_key).sort(), TARGET_KEYS)) {
    throw new Error('six-university exact target inventory changed');
  }
  const facts = {
    source_pages: [
      ...courseLeaf.sourceFacts,
      ...acalog.sourceFacts,
      cnu.sourceFact,
    ].sort((left, right) => left.source_id.localeCompare(right.source_id)),
    target_rows: targetRows,
  };
  const publicationBlockers = targetRows.filter((row) => (
    row.disposition === 'blocked'
  )).map((row) => ({
    course_key: row.course_key,
    target_key: row.target_key,
    catalog_year: row.catalog_year,
    source_response_sha256: row.source_response_sha256,
    raw_entry_sha256: row.current_raw_entry_sha256,
    prerequisite_formula_inferred: false,
    structural_none_inferred: false,
    blocker_reason: DECISIONS[row.target_key].blocker,
    authority_needed:
      'A current official catalog statement or institution/registrar confirmation that resolves this exact ambiguity.',
  }));
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    contract: CONTRACT,
    snapshot_date: candidateArtifact.snapshot_date,
    publication_ready: false,
    summary: {
      exact_target_rows: targetRows.length,
      exact_direct_remediation_rows:
        targetRows.filter((row) => row.scope_role === 'direct_remediation').length,
      exact_recursive_closure_rows:
        targetRows.filter((row) => row.scope_role === 'recursive_closure').length,
      source_proven_parsed_rows:
        targetRows.filter((row) => row.disposition === 'parsed').length,
      source_proven_structural_none_rows:
        targetRows.filter((row) => row.disposition === 'none').length,
      blocked_rows:
        targetRows.filter((row) => row.disposition === 'blocked').length,
      institutions: new Set(targetRows.map((row) => row.slug)).size,
      source_pages: facts.source_pages.length,
      exact_candidate_source_upgrades:
        targetRows.filter((row) => row.source_upgrade_needed).length,
      preserved_reviewed_signals: Object.values(DECISIONS)
        .reduce((sum, decision) => sum + decision.signals.length, 0),
      dropped_source_signals: 0,
      inferred_course_aliases: 0,
    },
    policy: {
      formulas:
        'Only exact formal prerequisite/corequisite fields or exact unstructured required-enrollment statements become formulas; every formula is closed over one named retained entry.',
      structural_none:
        'Only a complete present entry with an edition-bound same-source/same-catalog formal prerequisite positive control and full constraint-signal accounting may become none.',
      corequisites:
        'A named distinct-course corequisite becomes an exact formula when a complete edition-bound entry, exact marker counts, and a same-source positive control prove there is no unaccounted prerequisite marker. Unnamed components stay blocked.',
      ambiguity:
        'Undefined sequence placement, unnamed required lab identity, and should/advisory ambiguity remain blocked without institutional authority.',
      source_upgrade:
        'A retained-text candidate may be upgraded only when its normalized complete entry is byte-replayed from the exact current official response; the old and current hashes remain explicit.',
    },
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
    publication_blockers: publicationBlockers,
  };
}

function renderArtifact() {
  return `${JSON.stringify(buildFromRetainedSources(), null, 2)}\n`;
}

function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const rendered = renderArtifact();
  if (write) fs.writeFileSync(EVIDENCE_PATH, rendered);
  else if (!jsonOnly && (!fs.existsSync(EVIDENCE_PATH)
      || fs.readFileSync(EVIDENCE_PATH, 'utf8') !== rendered)) {
    throw new Error('six-university prerequisite evidence artifact drifted');
  }
  const artifact = JSON.parse(rendered);
  const issues = artifactIssues(artifact).filter((issue) => issue !== 'facts_sha256_pin');
  if (issues.length) {
    throw new Error(`six-university prerequisite evidence invalid: ${issues.join(', ')}`);
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Six-university prerequisite closure evidence: PASS');
    console.log(`  direct/closure rows: ${artifact.summary.exact_direct_remediation_rows}/${artifact.summary.exact_recursive_closure_rows}`);
    console.log(`  parsed/none/blocked: ${artifact.summary.source_proven_parsed_rows}/${artifact.summary.source_proven_structural_none_rows}/${artifact.summary.blocked_rows}`);
    console.log(`  exact current-source upgrades: ${artifact.summary.exact_candidate_source_upgrades}`);
    console.log(`  facts SHA-256: ${artifact.facts_sha256}`);
    console.log(write ? `  wrote ${EVIDENCE_PATH}` : '  retained replay: no drift');
  }
  return artifact;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CACHE,
  CANDIDATES,
  COURSELEAF_SOURCES,
  buildAcalogSources,
  buildCnuSource,
  buildCourseLeafSources,
  buildFromRetainedSources,
  buildTargetRows,
  main,
  renderArtifact,
};
