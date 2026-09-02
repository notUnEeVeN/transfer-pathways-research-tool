const crypto = require('node:crypto');
const {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256,
  CNU_CPEN371W_EVIDENCE_CACHE_PATH,
  CNU_CPEN371W_SOURCE_CACHE_PATH,
  VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256,
  VSU_ARABIC_EVIDENCE_CACHE_PATH,
  VSU_ARABIC_SOURCE_CACHE_PATH,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH,
  VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH,
  cnuCpen371wEntryIssue,
  requisiteMarkerCounts,
  structuredCourseLeafRequisiteFieldsValid,
  virginiaTechGraduateCsEntryIssue,
  vsuArabicEntryIssue,
} = require('./universityPrerequisiteAcquisition');
const {
  requiredResidentPathCourseCodes,
} = require('./universityPrerequisiteScope');
const {
  isScopedNorfolkVirginiaStatePrerequisite,
} = require('./norfolkVirginiaStatePrerequisiteScope');
const {
  isScopedGeorgeMasonPrerequisiteSilence,
} = require('./georgeMasonPrerequisiteSilenceEvidence');
const {
  isScopedOldDominionClosureCapture,
} = require('./oldDominionPrerequisiteClosureScope');
const {
  CNU_BOUNDARY_CONTRACT,
  CNU_COLUMN_GEOMETRY,
  CNU_COMPOUND_BOUNDARY_CONTRACT,
  CNU_COMPOUND_RECEIPT_CONTRACT,
  CNU_EXPECTED_PAGE_COUNT,
  CNU_EXPECTED_PDF_SHA256,
  CNU_PINNED_COMPOUND_RECEIPTS,
} = require('./cnuPdfPrerequisiteAcquisition');
const {
  BRIDGEWATER_BOUNDARY_CONTRACT,
  BRIDGEWATER_EDITION_PATH,
  BRIDGEWATER_HOST,
  BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT,
  expectedCoursePath: expectedBridgewaterCoursePath,
} = require('./bridgewaterCleanCatalogPrerequisiteAcquisition');
const {
  LONGWOOD_BOUNDARY_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_CATOID,
  LONGWOOD_CATALOG_CONTEXT_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH,
  LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH,
  LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
  LONGWOOD_CATALOG_CONTEXT_URL,
  LONGWOOD_CATALOG_CONTEXT_YEAR,
  LONGWOOD_DEPARTMENT_HOST,
  LONGWOOD_DEPARTMENT_PATH,
  LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
  LONGWOOD_DIRECT_CMSC_TARGETS,
  LONGWOOD_SLUG,
  LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
} = require('./longwoodDepartmentPrerequisiteAcquisition');
const {
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS,
  LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS,
  LONGWOOD_BANNER_HOST,
  LONGWOOD_BANNER_PATH,
  LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
} = require('./longwoodBannerCourseAcquisition');
const {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_CATALOG_YEAR,
  RADFORD_CATOID,
  RADFORD_CLOSURE_COURSE_RECORDS,
  RADFORD_COURSE_RECORDS,
  RADFORD_DIRECT_COURSE_RECORDS,
  RADFORD_DISCOVERY_CONTRACT,
  RADFORD_HOST,
  RADFORD_PROGRAM_CACHE_PATH,
  RADFORD_PROGRAM_HTML_SHA256,
  RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  RADFORD_SLUG,
} = require('./radfordAcalogPrerequisiteAcquisition');
const {
  VIRGINIA_TECH_CATALOG_YEAR,
  VIRGINIA_TECH_CS_DEPARTMENT_URL,
  VIRGINIA_TECH_CS_HTML_CACHE_PATH,
  VIRGINIA_TECH_CS_HTML_SHA256,
  VIRGINIA_TECH_CS_TEXT_CACHE_PATH,
  VIRGINIA_TECH_CS_TEXT_SHA256,
  VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT,
  VIRGINIA_TECH_SLUG,
} = require('./virginiaTechCourseLeafPrerequisiteAcquisition');
const {
  BROWSER_CHALLENGE_CONTRACT,
  JMU_SLUG,
  VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
  exactKnownBrowserResource,
  validateBrowserChallengeReceipt,
  validateBrowserRobotsReceipt,
} = require('./browserChallengeCourseLeafAcquisition');
const {
  UVA_WISE_BOUNDARY_CONTRACT,
  UVA_WISE_CATALOG_YEAR,
  UVA_WISE_CATOID,
  UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
  UVA_WISE_CLOSURE_COURSE_RECORDS,
  UVA_WISE_COURSE_RECORDS,
  UVA_WISE_DIRECT_COURSE_RECORDS,
  UVA_WISE_DISCOVERY_CONTRACT,
  UVA_WISE_GE_CACHE_PATH,
  UVA_WISE_GE_HTML_SHA256,
  UVA_WISE_HOST,
  UVA_WISE_PROGRAM_CACHE_PATH,
  UVA_WISE_PROGRAM_HTML_SHA256,
  UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
  UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  UVA_WISE_SLUG,
} = require('./uvaWiseAcalogPrerequisiteAcquisition');
const {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CATALOG_YEAR,
  SHENANDOAH_CATOID,
  SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_HOST,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_PROGRAM_HTML_SHA256,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  SHENANDOAH_SLUG,
} = require('./shenandoahAcalogPrerequisiteAcquisition');
const {
  CNU_ALIAS_RECEIPT_CONTRACT,
} = require('./cnuCpen371wPrerequisiteEvidence');
const {
  VSU_ARABIC_BOUNDARY_CONTRACT,
} = require('./virginiaStateArabicPrerequisiteEvidence');
const {
  VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
} = require('./virginiaTechGraduateCsPrerequisiteEvidence');

const ARTIFACT = 'virginia_figure6_university_prerequisite_entry_candidates';
const CANDIDATE_STATUS = 'candidate_review_required';

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const UNIT_NUMBER = '\\d+(?:\\.\\d+)?(?:-\\d+(?:\\.\\d+)?)?';

/**
 * These are intentionally institution-specific text boundaries, not generic
 * CourseLeaf/Acalog parsers. Cached exports from the same vendor do not have a
 * common shape. Every accepted heading includes the owner-local code, title,
 * and published unit label. A candidate ends at the next accepted heading (or
 * a source-specific terminal marker), so prerequisite references in prose are
 * never promoted to entries.
 */
const CAPTURE_RULES = Object.freeze({
  'bridgewater-college': {
    strategy: 'cleancatalog_blank_line_heading',
    heading: /^ ([A-Z]{2,8})-(\d{2,4}[A-Z]?): \n ([^\n]{1,200})\n\n/gm,
    terminal: null,
  },
  'christopher-newport-university': {
    strategy: 'official_pdf_bbox_nonoverlapping_columns',
    blocked_reason: 'No unique singular heading or pinned compound member receipt with published units was bounded from the official PDF.',
  },
  [LONGWOOD_SLUG]: {
    strategy: 'official_unique_entry_listings_with_separate_catoid_19_context',
    blocked_reason: 'Only structurally unique entries from the reviewed Longwood first-party listings are supported.',
  },
  'george-mason-university': {
    strategy: 'courseleaf_line_heading',
    heading: /^(CS) (\d{2,4}[A-Z]?): ([^\n]{1,250})\. (\d+(?:-\d+)?(?:\.\d+)? credits?)\.$/gim,
    terminal: '\n\nBack to Top',
  },
  'norfolk-state-university': {
    strategy: 'courseleaf_compact_department_heading',
    heading: new RegExp(`(CSC) (\\d{2,4}[A-Z]?) ([A-Za-z0-9][^\\n]{1,180}?) \\((` + UNIT_NUMBER + ` Credits?)\\)`, 'g'),
    terminal: '\n\n 2025-2026 Academic Catalog',
  },
  'old-dominion-university': {
    strategy: 'courseleaf_compact_department_heading',
    heading: new RegExp(`(CS) (\\d{2,4}[A-Z]?(?:/\\d{2,4}[A-Z]?)?) ([A-Za-z0-9][^\\n.]{1,180}?) \\((` + UNIT_NUMBER + ` Credit Hours?)\\)`, 'g'),
    terminal: '\n\n Search catalog',
  },
  'randolph-macon-college': {
    strategy: 'courseleaf_compact_dash_heading',
    heading: new RegExp(`(CSCI) (\\d{2,4}[A-Z]?) - ([A-Za-z0-9][^\\n]{1,180}?) \\((` + UNIT_NUMBER + ` Hours?)\\)`, 'g'),
    terminal: '\n\n Close this window',
  },
  'university-of-mary-washington': {
    strategy: 'courseleaf_compact_dash_heading',
    heading: new RegExp(`(CPSC) (\\d{2,4}[A-Z]?) - ([A-Za-z0-9][^\\n]{1,180}?) \\((` + UNIT_NUMBER + ` Credits?)\\)`, 'g'),
    terminal: '\n\n Close this window',
  },
  'virginia-commonwealth-university': {
    strategy: 'courseleaf_paragraph_heading',
    heading: /^(CMSC) (\d{2,4}[A-Z]?)\. ([^\n]{2,200})\. (\d+(?:-\d+)? Hours?)\.$/gm,
    terminal: '\n\n Virginia Commonwealth University',
  },
  'virginia-state-university': {
    strategy: 'courseleaf_line_heading_parenthesized_units',
    heading: /^(CSCI) (\d{2,4}[A-Z]?)\. ([^\n]{2,200})\. \((\d+(?:-\d+)? Credits?)\)$/gm,
    terminal: '\n\n Close this window',
  },
  'william-mary': {
    strategy: 'courseleaf_compact_department_heading',
    heading: new RegExp(`(CSCI) (\\d{2,4}[A-Z]?) ([A-Za-z0-9][^\\n]{1,180}?) \\((` + UNIT_NUMBER + ` Credits?)\\)`, 'g'),
    terminal: '\n\n Close this window',
  },
});

function normalizeHeadingCode(prefix, number) {
  return `${prefix}${String(number).split('/')[0]}`.toUpperCase();
}

function titleLooksLikeReferenceRun(title) {
  return /\b[A-Z]{2,8}[ -]?\d{2,4}/.test(title)
    || /\b(?:pre|co)requisites?|curriculum:/i.test(title);
}

function scanHeadings(text, rule) {
  if (!rule?.heading) return [];
  const headings = [];
  const regex = new RegExp(rule.heading.source, rule.heading.flags);
  let match;
  while ((match = regex.exec(text))) {
    // Compact HTML-to-text exports can place a prerequisite code immediately
    // before the next real heading. If a tentative "title" contains another
    // course code or requisite label, restart one character later so the true
    // overlapping heading remains discoverable.
    if (titleLooksLikeReferenceRun(match[3])) {
      regex.lastIndex = match.index + 1;
      continue;
    }
    headings.push({
      course_code: normalizeHeadingCode(match[1], match[2]),
      title: match[3],
      heading_text: match[0],
      start: match.index,
      heading_end: match.index + match[0].length,
    });
  }
  return headings;
}

function terminalBoundary(text, rule, lastHeading) {
  if (!lastHeading) return null;
  if (rule.terminal === null) return text.length;
  const index = text.indexOf(rule.terminal, lastHeading.heading_end);
  return index >= 0 ? index : null;
}

function boundedEntries(text, rule) {
  const headings = scanHeadings(text, rule);
  const terminal = terminalBoundary(text, rule, headings.at(-1));
  if (headings.length && terminal === null) return { headings, entries: [], terminal_found: false };
  const entries = headings.map((heading, index) => {
    const end = headings[index + 1]?.start ?? terminal;
    const raw = text.slice(heading.start, end);
    return {
      ...heading,
      end,
      raw_entry_text: raw,
      raw_entry_sha256: sha256(raw),
    };
  });
  return { headings, entries, terminal_found: true };
}

function candidateRow(scopeUniversity, entry) {
  const raw = entry.raw_entry_text;
  return {
    school_id: scopeUniversity.school_id,
    slug: scopeUniversity.slug,
    owner_namespace: scopeUniversity.owner_namespace,
    course_key: `${scopeUniversity.owner_namespace}:${entry.course_code}`,
    course_code: entry.course_code,
    title_candidate: entry.title,
    row_status: CANDIDATE_STATUS,
    publication_ready: false,
    formula_status: 'unparsed_review_required',
    prerequisite_marker_count: (raw.match(/\b(?:required\s+)?pre-?requisite(?:s|\(s\)|s\(s\))?\s*:/gi) || []).length,
    corequisite_marker_count: (raw.match(/\b(?:pre-?\s+or\s+corequisite|co-?requisite|corequisite)(?:s|\(s\))?\s*:/gi) || []).length,
    no_prerequisite_inference: true,
    source: {
      capture_origin: 'retained_catalog_text',
      catalog_year_verified: scopeUniversity.catalog_year,
      official_url: scopeUniversity.cached_course_catalog.official_url,
      declared_normalized_text_sha256: scopeUniversity.cached_course_catalog.declared_normalized_text_sha256,
      retained_normalized_text_sha256: scopeUniversity.cached_course_catalog.retained_normalized_text_sha256,
      character_start: entry.start,
      character_end: entry.end,
      heading_text: entry.heading_text,
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_text: raw,
    },
  };
}

function acquiredCandidateRow(scopeUniversity, entry) {
  const raw = entry.raw_entry_text;
  return {
    school_id: scopeUniversity.school_id,
    slug: scopeUniversity.slug,
    owner_namespace: scopeUniversity.owner_namespace,
    course_key: entry.course_key,
    course_code: entry.course_code,
    title_candidate: entry.title || raw.slice(0, 240),
    row_status: CANDIDATE_STATUS,
    publication_ready: false,
    formula_status: 'unparsed_review_required',
    prerequisite_marker_count: (raw.match(/\b(?:required\s+)?pre-?requisite(?:s|\(s\)|s\(s\))?\s*:/gi) || []).length,
    corequisite_marker_count: (raw.match(/\b(?:pre-?\s+or\s+corequisite|co-?requisite|corequisite)(?:s|\(s\))?\s*:/gi) || []).length,
    no_prerequisite_inference: true,
    source: {
      capture_origin: entry.capture_origin || 'official_acquisition',
      boundary_contract: entry.boundary_contract,
      catalog_year_verified: entry.catalog_year_verified,
      official_url: entry.official_url,
      declared_normalized_text_sha256: entry.source_response_sha256,
      retained_normalized_text_sha256: entry.source_response_sha256,
      source_response_sha256: entry.source_response_sha256,
      source_response_bytes: entry.source_response_bytes,
      cache_path: entry.cache_path,
      ...(Number.isInteger(entry.courseblock_index) ? { courseblock_index: entry.courseblock_index } : {}),
      ...(entry.raw_entry_html_sha256 ? { raw_entry_html_sha256: entry.raw_entry_html_sha256 } : {}),
      ...(entry.boundary_contract === BRIDGEWATER_BOUNDARY_CONTRACT ? {
        source_format: 'cleancatalog_course_page',
        canonical_path: entry.canonical_path,
        published_units: entry.published_units,
        requisite_field_receipt: entry.requisite_field_receipt,
        edition_response_sha256: entry.edition_response_sha256,
        edition_cache_path: entry.edition_cache_path,
        edition_catalog_year: entry.edition_catalog_year,
        edition_path: entry.edition_path,
        edition_exact_year_statement: entry.edition_exact_year_statement,
        edition_normalized_main_text_sha256: entry.edition_normalized_main_text_sha256,
      } : {}),
      ...(entry.boundary_contract === LONGWOOD_BOUNDARY_CONTRACT ? {
        source_format: 'longwood_department_course_listing',
        published_units: entry.published_units,
        department_page_catalog_year_statement: entry.department_page_catalog_year_statement,
        catalog_context_contract: entry.catalog_context_contract,
        catalog_context_official_url: entry.catalog_context_official_url,
        catalog_context_html_cache_path: entry.catalog_context_html_cache_path,
        catalog_context_text_cache_path: entry.catalog_context_text_cache_path,
        catalog_context_html_sha256: entry.catalog_context_html_sha256,
        catalog_context_normalized_text_sha256:
          entry.catalog_context_normalized_text_sha256,
        catalog_context_relevant_sha256: entry.catalog_context_relevant_sha256,
        catalog_context_catalog_year: entry.catalog_context_catalog_year,
        catalog_context_catoid: entry.catalog_context_catoid,
        two_source_edition_boundary: entry.two_source_edition_boundary,
        two_source_binding_note: entry.two_source_binding_note,
      } : {}),
      ...(entry.boundary_contract === LONGWOOD_BANNER_BOUNDARY_CONTRACT ? {
        source_format: 'longwood_banner_course_listing',
        published_units: entry.published_units,
        department_page_catalog_year_statement: entry.department_page_catalog_year_statement,
        catalog_context_contract: entry.catalog_context_contract,
        catalog_context_official_url: entry.catalog_context_official_url,
        catalog_context_html_cache_path: entry.catalog_context_html_cache_path,
        catalog_context_text_cache_path: entry.catalog_context_text_cache_path,
        catalog_context_html_sha256: entry.catalog_context_html_sha256,
        catalog_context_normalized_text_sha256:
          entry.catalog_context_normalized_text_sha256,
        catalog_context_relevant_sha256: entry.catalog_context_relevant_sha256,
        catalog_context_catalog_year: entry.catalog_context_catalog_year,
        catalog_context_catoid: entry.catalog_context_catoid,
        two_source_edition_boundary: entry.two_source_edition_boundary,
        two_source_binding_note: entry.two_source_binding_note,
      } : {}),
      ...(entry.boundary_contract === RADFORD_BOUNDARY_CONTRACT ? {
        source_format: 'radford_acalog_course_page',
        catoid: entry.catoid,
        coid: entry.coid,
        published_units: entry.published_units,
        raw_entry_html_sha256: entry.raw_entry_html_sha256,
        required_requisite_clause: entry.required_requisite_clause,
        pre_or_corequisite_clause: entry.pre_or_corequisite_clause,
        formal_requisite_marker_count: entry.formal_requisite_marker_count,
        discovery_contract: entry.discovery_contract,
        discovery_cache_path: entry.discovery_cache_path,
        discovery_response_sha256: entry.discovery_response_sha256,
        discovery_link_receipt: entry.discovery_link_receipt,
        robots_crawl_delay_seconds: entry.robots_crawl_delay_seconds,
      } : {}),
      ...(entry.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT ? {
        source_format: 'uva_wise_acalog_course_page',
        catoid: entry.catoid,
        coid: entry.coid,
        published_units: entry.published_units,
        raw_entry_html_sha256: entry.raw_entry_html_sha256,
        required_requisite_clause: entry.required_requisite_clause,
        discovery_contract: entry.discovery_contract,
        ...(entry.discovery_contract === UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT ? {
          discovery_cache_path: entry.discovery_cache_path,
          discovery_response_sha256: entry.discovery_response_sha256,
        } : {
          discovery_program_cache_path: entry.discovery_program_cache_path,
          discovery_program_response_sha256: entry.discovery_program_response_sha256,
          discovery_ge_cache_path: entry.discovery_ge_cache_path,
          discovery_ge_response_sha256: entry.discovery_ge_response_sha256,
        }),
        discovery_link_receipt: entry.discovery_link_receipt,
        robots_crawl_delay_seconds: entry.robots_crawl_delay_seconds,
        http_exception_contract: entry.http_exception_contract,
      } : {}),
      ...(entry.boundary_contract === SHENANDOAH_BOUNDARY_CONTRACT ? {
        source_format: 'shenandoah_acalog_course_page',
        catoid: entry.catoid,
        coid: entry.coid,
        published_units: entry.published_units,
        raw_entry_html_sha256: entry.raw_entry_html_sha256,
        required_requisite_clause: entry.required_requisite_clause,
        formal_corequisite_marker_count: entry.formal_corequisite_marker_count,
        discovery_contract: entry.discovery_contract,
        discovery_cache_path: entry.discovery_cache_path,
        discovery_response_sha256: entry.discovery_response_sha256,
        discovery_link_receipt: entry.discovery_link_receipt,
        robots_crawl_delay_seconds: entry.robots_crawl_delay_seconds,
      } : {}),
      ...(entry.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT ? {
        source_format: 'cnu_current_joint_identity_pdf_entry',
        course_boundary_contract: entry.course_boundary_contract,
        program_official_url: entry.program_official_url,
        evidence_cache_path: entry.evidence_cache_path,
        evidence_artifact_sha256: entry.evidence_artifact_sha256,
        program_response_sha256: entry.program_response_sha256,
        program_response_bytes: entry.program_response_bytes,
        robots_response_sha256: entry.robots_response_sha256,
        catalog_raw_text_sha256: entry.catalog_raw_text_sha256,
        facts_sha256: entry.facts_sha256,
        physical_pdf_page: entry.physical_pdf_page,
        title: entry.title,
        published_units: entry.published_units,
        required_requisite_clause: entry.required_requisite_clause,
        semantic_prerequisite: entry.semantic_prerequisite,
        program_requirement: entry.program_requirement,
        catalog_degree_requirement: entry.catalog_degree_requirement,
        identity_resolution: entry.identity_resolution,
      } : {}),
      ...(entry.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT ? {
        source_format: 'vsu_languages_department_courseblock',
        evidence_cache_path: entry.evidence_cache_path,
        evidence_artifact_sha256: entry.evidence_artifact_sha256,
        robots_response_sha256: entry.robots_response_sha256,
        facts_sha256: entry.facts_sha256,
        arabic_section_html_sha256: entry.arabic_section_html_sha256,
        arabic_section_courseblock_count: entry.arabic_section_courseblock_count,
        title: entry.title,
        published_units: entry.published_units,
        formal_prerequisite_marker_count: entry.formal_prerequisite_marker_count,
        required_requisite_clause: entry.required_requisite_clause,
        enrollment_restriction: entry.enrollment_restriction,
        catalog_silence_inferred_as_no_prerequisite:
          entry.catalog_silence_inferred_as_no_prerequisite,
        semantic_prerequisite: entry.semantic_prerequisite,
      } : {}),
      ...(entry.boundary_contract === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT ? {
        source_format: 'virginia_tech_current_graduate_cs_heading_entry',
        source_current_contract: entry.source_current_contract,
        robots_official_url: entry.robots_official_url,
        evidence_cache_path: entry.evidence_cache_path,
        evidence_artifact_sha256: entry.evidence_artifact_sha256,
        robots_response_sha256: entry.robots_response_sha256,
        facts_sha256: entry.facts_sha256,
        source_effective_pubdate: entry.source_effective_pubdate,
        source_captured_on: entry.source_captured_on,
        catalog_edition_claimed: entry.catalog_edition_claimed,
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
      } : {}),
      ...(entry.boundary_contract === COURSELEAF_BOUNDARY_CONTRACT ? {
        source_format: 'courseleaf_courseblock',
        published_units: entry.published_units,
        raw_entry_html_sha256: entry.raw_entry_html_sha256,
        complete_entry_receipt: entry.complete_entry_receipt,
        structured_requisite_fields: entry.structured_requisite_fields,
        ...(entry.cache_reacquisition_receipt ? {
          cache_reacquisition_receipt: entry.cache_reacquisition_receipt,
        } : {}),
        ...(entry.retained_source_contract ? {
          retained_source_contract: entry.retained_source_contract,
          retained_source_text_cache_path: entry.retained_source_text_cache_path,
          retained_source_text_sha256: entry.retained_source_text_sha256,
          live_recapture_claim: entry.live_recapture_claim,
        } : {}),
        ...(entry.browser_challenge_contract ? {
          target_subject_prefix: entry.target_subject_prefix,
          browser_challenge_contract: entry.browser_challenge_contract,
          browser_challenge_receipt: entry.browser_challenge_receipt,
          robots_receipt: entry.robots_receipt,
          sitemap_discovery_receipt: entry.sitemap_discovery_receipt,
        } : {}),
      } : {}),
      ...(entry.pdf_sha256 ? {
        source_format: 'pdf_bbox_columns',
        pdf_sha256: entry.pdf_sha256,
        bbox_layout_sha256: entry.bbox_layout_sha256,
        pdftotext_version: entry.pdftotext_version,
        published_units: entry.published_units,
        pdf_page_start: entry.pdf_page_start,
        pdf_page_end: entry.pdf_page_end,
        page_column_span: entry.page_column_span,
        source_blocks: entry.source_blocks,
        ...(entry.boundary_contract === CNU_COMPOUND_BOUNDARY_CONTRACT ? {
          compound_entry: entry.compound_entry,
          compound_receipt_contract: entry.compound_receipt_contract,
          compound_receipt_sha256: entry.compound_receipt_sha256,
          compound_heading_course_codes: entry.compound_heading_course_codes,
          compound_member_requisite: entry.compound_member_requisite,
          compound_sibling_requisites: entry.compound_sibling_requisites,
        } : {}),
      } : {}),
      character_start: 0,
      character_end: raw.length,
      heading_text: entry.heading_text || raw.slice(0, 240),
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_text: raw,
    },
  };
}

function buildUniversityPrerequisiteCandidates({ scope, catalogTexts, acquisition = null }) {
  const candidates = [];
  const universities = [];
  const acquiredByOwner = new Map();
  for (const entry of acquisition?.entries || []) {
    const rows = acquiredByOwner.get(entry.owner_namespace) || [];
    rows.push(entry);
    acquiredByOwner.set(entry.owner_namespace, rows);
  }
  for (const university of scope.universities) {
    const rule = CAPTURE_RULES[university.slug];
    const text = String(catalogTexts[university.slug] || '');
    const exactTokens = new Set(university.cached_course_catalog.exact_code_tokens_seen);
    const directCodes = new Set(requiredResidentPathCourseCodes(university));
    const result = boundedEntries(text, rule);
    const entriesByCode = new Map();
    for (const entry of result.entries) {
      const rows = entriesByCode.get(entry.course_code) || [];
      rows.push(entry);
      entriesByCode.set(entry.course_code, rows);
    }
    const boundedCodes = [...exactTokens]
      .filter((code) => entriesByCode.get(code)?.length === 1)
      .sort();
    const ownerAcquiredRows = acquiredByOwner.get(university.owner_namespace) || [];
    const supersedingAcquiredCodes = new Set(ownerAcquiredRows.filter((entry) => (
      university.slug === 'bridgewater-college'
        || isScopedNorfolkVirginiaStatePrerequisite({ ...entry, slug: university.slug })
        || isScopedGeorgeMasonPrerequisiteSilence({ ...entry, slug: university.slug })
        || entry.cache_reacquisition_receipt?.contract
          === 'gmu_exact_cached_courseleaf_response_revalidated_after_false_interstitial_block_v1'
        || isScopedOldDominionClosureCapture({ ...entry, slug: university.slug })
    )).map((entry) => entry.course_code));
    const selectedBoundedCodes = boundedCodes
      .filter((code) => !supersedingAcquiredCodes.has(code));
    for (const code of selectedBoundedCodes) {
      candidates.push(candidateRow(university, entriesByCode.get(code)[0]));
    }
    const acquiredRows = ownerAcquiredRows
      .filter((entry) => (
        !boundedCodes.includes(entry.course_code)
        || supersedingAcquiredCodes.has(entry.course_code)
      ));
    const acquiredByCode = new Map();
    for (const entry of acquiredRows) {
      const rows = acquiredByCode.get(entry.course_code) || [];
      rows.push(entry);
      acquiredByCode.set(entry.course_code, rows);
    }
    const uniqueAcquiredCodes = [...acquiredByCode]
      .filter(([, rows]) => rows.length === 1)
      .map(([code]) => code).sort();
    for (const code of uniqueAcquiredCodes) {
      candidates.push(acquiredCandidateRow(university, acquiredByCode.get(code)[0]));
    }
    const finalCandidateCodes = new Set([...boundedCodes, ...uniqueAcquiredCodes]);
    const directCandidateCodes = [...directCodes].filter((code) => finalCandidateCodes.has(code)).sort();
    const closureCandidateCodes = uniqueAcquiredCodes.filter((code) => !directCodes.has(code)).sort();
    const cachedTokenWithoutEntry = [...exactTokens].filter((code) => !boundedCodes.includes(code)).sort();
    const tokenWithoutEntry = [...exactTokens].filter((code) => !finalCandidateCodes.has(code)).sort();
    const directWithoutToken = [...directCodes].filter((code) => !exactTokens.has(code)).sort();
    const directWithoutCandidate = [...directCodes].filter((code) => !finalCandidateCodes.has(code)).sort();
    universities.push({
      school_id: university.school_id,
      slug: university.slug,
      owner_namespace: university.owner_namespace,
      catalog_platform: university.catalog_platform,
      capture_strategy: rule?.strategy || 'blocked_no_institution_specific_boundary',
      capture_status: uniqueAcquiredCodes.length
        ? 'official_acquisition_boundaries_available'
        : (rule?.heading && result.terminal_found
          ? 'institution_specific_boundaries_available'
          : 'direct_capture_required'),
      blocked_reason: uniqueAcquiredCodes.length ? null
        : (rule?.blocked_reason || (!rule?.heading
          ? 'The retained source has no tested institution-specific complete-entry boundary.'
          : null)),
      source: {
        official_url: university.cached_course_catalog.official_url,
        declared_normalized_text_sha256: university.cached_course_catalog.declared_normalized_text_sha256,
        retained_normalized_text_sha256: university.cached_course_catalog.retained_normalized_text_sha256,
        byte_match: university.cached_course_catalog.byte_match,
      },
      direct_named_course_count: university.direct_named_course_codes.length,
      deterministic_resident_path_course_count:
        (university.deterministic_resident_path_course_codes || []).length,
      required_resident_path_course_count: directCodes.size,
      exact_code_token_count: exactTokens.size,
      detected_entry_heading_count: result.headings.length,
      cached_bounded_review_candidate_count: boundedCodes.length,
      cached_bounded_review_candidate_codes: boundedCodes,
      acquired_superseding_cached_candidate_count:
        boundedCodes.filter((code) => supersedingAcquiredCodes.has(code)).length,
      acquired_superseding_cached_candidate_codes:
        boundedCodes.filter((code) => supersedingAcquiredCodes.has(code)),
      acquired_review_candidate_count: uniqueAcquiredCodes.length,
      acquired_review_candidate_codes: uniqueAcquiredCodes,
      closure_review_candidate_count: closureCandidateCodes.length,
      closure_review_candidate_codes: closureCandidateCodes,
      bounded_review_candidate_count: directCandidateCodes.length,
      bounded_review_candidate_codes: directCandidateCodes,
      exact_tokens_without_cached_bounded_entry_count: cachedTokenWithoutEntry.length,
      exact_tokens_without_cached_bounded_entry: cachedTokenWithoutEntry,
      exact_tokens_without_bounded_entry_count: tokenWithoutEntry.length,
      exact_tokens_without_bounded_entry: tokenWithoutEntry,
      direct_codes_without_exact_token_count: directWithoutToken.length,
      direct_codes_without_exact_token: directWithoutToken,
      direct_codes_without_bounded_candidate_count: directWithoutCandidate.length,
      direct_codes_without_bounded_candidate: directWithoutCandidate,
    });
  }

  const sum = (field) => universities.reduce((total, row) => total + row[field], 0);
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    snapshot_date: scope.snapshot_date,
    authority: 'official_institution_catalog_retained_source_entries',
    publication_ready: false,
    row_contract: 'discovery_candidate_only_review_required_not_importable',
    summary: {
      active_universities: universities.length,
      direct_named_courses: sum('direct_named_course_count'),
      deterministic_resident_path_courses:
        sum('deterministic_resident_path_course_count'),
      required_resident_path_courses: sum('required_resident_path_course_count'),
      exact_code_tokens_in_cached_official_text: sum('exact_code_token_count'),
      safely_bounded_review_candidates: candidates.length,
      safely_bounded_direct_review_candidates: sum('bounded_review_candidate_count'),
      safely_bounded_closure_review_candidates: sum('closure_review_candidate_count'),
      acquired_exact_entry_candidates: sum('acquired_review_candidate_count'),
      cached_safely_bounded_review_candidates: sum('cached_bounded_review_candidate_count'),
      cached_exact_tokens_without_bounded_entry: sum('exact_tokens_without_cached_bounded_entry_count'),
      exact_tokens_without_bounded_entry: sum('exact_tokens_without_bounded_entry_count'),
      direct_codes_without_exact_token: sum('direct_codes_without_exact_token_count'),
      remaining_direct_capture_floor: sum('direct_codes_without_bounded_candidate_count'),
      publication_contract_rows: 0,
      recursive_closure_courses: null,
    },
    evidence_boundary: [
      'A candidate exists only when an exact course code is the unique heading of an institution-specifically bounded entry in retained official catalog text or pinned PDF layout evidence.',
      'Candidate raw text is discovery evidence for human formula review; it is not a parsed prerequisite row and cannot encode status=none.',
      'Token hits in prerequisites, degree lists, search indexes, or PDF text without verified page/column boundaries remain uncaptured.',
      'Recursive prerequisite closure remains unknown until reviewed direct entries are parsed.',
      'Official acquisition rows retain the source-byte hash and exact structural HTML or PDF boundary evidence; they remain nonpublication candidates until strict formula review.',
      'Bridgewater acquisition rows bind each course page to a separate exact-year Courses of Instruction response; an omitted prerequisite field remains unparsed rather than becoming none.',
      'Longwood acquisition rows bind exact entries from reviewed first-party listings to a separate retained 2026-2027 catoid 19 catalog context. The listings themselves are unversioned, and their silence never proves no prerequisite.',
    ],
    capture_manifest: universities,
    candidates,
  };
}

function validateUniversityPrerequisiteCandidates(artifact, { scope, catalogTexts } = {}) {
  const issues = [];
  if (artifact?.schema_version !== 1) issues.push('schema_version');
  if (artifact?.artifact !== ARTIFACT) issues.push('artifact');
  if (artifact?.publication_ready !== false) issues.push('publication_ready');
  if (artifact?.summary?.publication_contract_rows !== 0) issues.push('publication_contract_rows');
  const rows = Array.isArray(artifact?.candidates) ? artifact.candidates : [];
  const manifest = Array.isArray(artifact?.capture_manifest) ? artifact.capture_manifest : [];
  const keys = new Set();
  for (const row of rows) {
    if (row?.row_status !== CANDIDATE_STATUS || row?.publication_ready !== false) issues.push(`${row?.course_key}:status`);
    if (row?.formula_status !== 'unparsed_review_required' || row?.no_prerequisite_inference !== true) issues.push(`${row?.course_key}:formula_status`);
    if (keys.has(row?.course_key)) issues.push(`${row?.course_key}:duplicate`);
    keys.add(row?.course_key);
    if (sha256(row?.source?.raw_entry_text) !== row?.source?.raw_entry_sha256) issues.push(`${row?.course_key}:raw_hash`);
    if (catalogTexts?.[row.slug] && row.source.capture_origin === 'retained_catalog_text') {
      const text = catalogTexts[row.slug];
      if (text.slice(row.source.character_start, row.source.character_end) !== row.source.raw_entry_text) {
        issues.push(`${row?.course_key}:source_offsets`);
      }
    }
    if (row.source.boundary_contract === COURSELEAF_BOUNDARY_CONTRACT) {
      const receipt = row.source.complete_entry_receipt;
      const markers = requisiteMarkerCounts(row.source.raw_entry_text);
      if (row.source.capture_origin !== 'official_acquisition'
          || row.source.source_format !== 'courseleaf_courseblock'
          || row.source.declared_normalized_text_sha256
            !== row.source.source_response_sha256
          || row.source.retained_normalized_text_sha256
            !== row.source.source_response_sha256
          || !/^[a-f0-9]{64}$/.test(row.source.source_response_sha256 || '')
          || !Number.isInteger(row.source.courseblock_index)
          || row.source.courseblock_index < 0
          || !/^[a-f0-9]{64}$/.test(row.source.raw_entry_html_sha256 || '')
          || !row.source.published_units
          || !(row.source.published_units.credit_hours_min >= 0)
          || row.source.published_units.credit_hours_max
            < row.source.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:courseleaf_entry_receipt`);
      }
      if (receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
          || receipt.entry_required_requisite_marker_count !== markers.required
          || receipt.entry_corequisite_marker_count !== markers.corequisite
          || receipt.entry_requisite_marker_like_count !== markers.marker_like
          || receipt.entry_constraint_like_signal_count !== markers.constraint_like
          || receipt.same_source_positive_control !== (
            receipt.source_complete_entries_with_required_requisite_marker_count
              > (markers.required > 0 ? 1 : 0)
          )) {
        issues.push(`${row.course_key}:courseleaf_marker_control`);
      }
      if (row.source.browser_challenge_contract) {
        const documentReceipt = validateBrowserChallengeReceipt(
          row.source.browser_challenge_receipt,
          {
            expectedUrl: row.source.official_url,
            expectedFinalContentType: 'text/html',
            expectedFinalSha256: row.source.source_response_sha256,
          },
        );
        const sourceUrl = new URL(row.source.official_url);
        const robotsReceipt = validateBrowserRobotsReceipt(row.source.robots_receipt, {
          origin: sourceUrl.origin,
          checkedPath: sourceUrl.pathname,
        });
        if (row.source.browser_challenge_contract !== BROWSER_CHALLENGE_CONTRACT
            || !documentReceipt.valid || !robotsReceipt.valid
            || !exactKnownBrowserResource({
              slug: row.slug,
              platform: 'browser_challenge_courseleaf',
              officialUrl: row.source.official_url,
              targetSubjectPrefix: row.source.target_subject_prefix,
            })) issues.push(`${row.course_key}:browser_challenge_receipt`);
        if (row.slug === JMU_SLUG && (
          row.source.published_units?.structural_field !== 'unique_detail-hours_html'
          || !/^[a-f0-9]{64}$/.test(
            row.source.published_units?.structural_field_html_sha256 || '',
          )
        )) issues.push(`${row.course_key}:jmu_structured_units_receipt`);
        if ([JMU_SLUG, VIRGINIA_TECH_SLUG].includes(row.slug)
            && !structuredCourseLeafRequisiteFieldsValid({
              ...row.source,
              slug: row.slug,
              raw_entry_text: row.source.raw_entry_text,
              structured_requisite_fields: row.source.structured_requisite_fields,
            })) issues.push(`${row.course_key}:browser_structured_requisite_fields`);
        if (row.slug === VIRGINIA_TECH_SLUG && (
          row.source.sitemap_discovery_receipt?.discovery_contract
            !== VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT
          || row.source.sitemap_discovery_receipt?.discovered_course_url
            !== row.source.official_url
          || row.source.sitemap_discovery_receipt?.path_discovered !== true
        )) issues.push(`${row.course_key}:virginia_tech_sitemap_receipt`);
      }
      if (row.slug === VIRGINIA_TECH_SLUG && !row.source.browser_challenge_contract && (
        row.source.catalog_year_verified !== VIRGINIA_TECH_CATALOG_YEAR
        || row.source.official_url !== VIRGINIA_TECH_CS_DEPARTMENT_URL
        || row.source.cache_path !== VIRGINIA_TECH_CS_HTML_CACHE_PATH
        || row.source.source_response_sha256 !== VIRGINIA_TECH_CS_HTML_SHA256
        || row.source.retained_source_contract !== VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT
        || row.source.retained_source_text_cache_path
          !== VIRGINIA_TECH_CS_TEXT_CACHE_PATH
        || row.source.retained_source_text_sha256 !== VIRGINIA_TECH_CS_TEXT_SHA256
        || row.source.live_recapture_claim !== false
      )) issues.push(`${row.course_key}:virginia_tech_retained_source_receipt`);
    }
    if ([CNU_BOUNDARY_CONTRACT, CNU_COMPOUND_BOUNDARY_CONTRACT]
      .includes(row.source.boundary_contract)) {
      if (row.source.pdf_sha256 !== CNU_EXPECTED_PDF_SHA256
          || row.source.source_response_sha256 !== row.source.pdf_sha256) {
        issues.push(`${row?.course_key}:cnu_pdf_hash`);
      }
      const blocks = Array.isArray(row.source.source_blocks) ? row.source.source_blocks : [];
      if (!/^[a-f0-9]{64}$/.test(row.source.bbox_layout_sha256 || '')
          || row.source.source_format !== 'pdf_bbox_columns'
          || !/^pdftotext version \d/.test(row.source.pdftotext_version || '')
          || !blocks.length
          || blocks.some((block) => !['left', 'right'].includes(block.column))) {
        issues.push(`${row?.course_key}:cnu_pdf_evidence`);
      }
      if (!Number.isInteger(row.source.pdf_page_start)
          || !Number.isInteger(row.source.pdf_page_end)
          || row.source.pdf_page_start < 1
          || row.source.pdf_page_end < row.source.pdf_page_start
          || row.source.pdf_page_end > CNU_EXPECTED_PAGE_COUNT) {
        issues.push(`${row?.course_key}:cnu_pdf_pages`);
      }
      const expectedSpan = [...new Set(blocks.map((block) => `${block.pdf_page}:${block.column}`))];
      if (JSON.stringify(row.source.page_column_span) !== JSON.stringify(expectedSpan)
          || blocks.some((block) => {
            const box = block.bbox_points || {};
            const geometry = CNU_COLUMN_GEOMETRY[block.column] || {};
            return !Number.isInteger(block.pdf_page)
              || block.pdf_page < row.source.pdf_page_start
              || block.pdf_page > row.source.pdf_page_end
              || !Number.isInteger(block.page_block_index)
              || !['x_min', 'x_max', 'y_min', 'y_max'].every((key) => Number.isFinite(box[key]))
              || box.x_min < geometry.x_min_inclusive
              || box.x_max > geometry.x_max_inclusive
              || box.y_min < CNU_COLUMN_GEOMETRY.content_y_min_inclusive
              || box.y_max > CNU_COLUMN_GEOMETRY.content_y_max_inclusive
              || !/^[a-f0-9]{64}$/.test(block.raw_text_sha256 || '');
          })) {
        issues.push(`${row?.course_key}:cnu_pdf_geometry`);
      }
      if (!row.source.published_units
          || !(row.source.published_units.credit_hours_min >= 0)
          || row.source.published_units.credit_hours_max
            < row.source.published_units.credit_hours_min) {
        issues.push(`${row?.course_key}:cnu_published_units`);
      }
      if (row.source.boundary_contract === CNU_COMPOUND_BOUNDARY_CONTRACT) {
        const expected = CNU_PINNED_COMPOUND_RECEIPTS.find((receipt) => (
          receipt.heading_text === row.source.heading_text
        ));
        const requisites = [
          row.source.compound_member_requisite,
          ...(row.source.compound_sibling_requisites || []),
        ].filter(Boolean);
        const ordered = (row.source.compound_heading_course_codes || []).map((code) => (
          requisites.find((receipt) => receipt.course_code === code)
        ));
        const reconstructed = {
          receipt_contract: row.source.compound_receipt_contract,
          heading_text: row.source.heading_text,
          compound_course_codes: row.source.compound_heading_course_codes,
          raw_entry_sha256: row.source.raw_entry_sha256,
          pdf_page_start: row.source.pdf_page_start,
          pdf_page_end: row.source.pdf_page_end,
          page_column_span: row.source.page_column_span,
          member_requisites: ordered,
        };
        const expectedMemberClausesMatch = expected
          && ordered.every((receipt) => {
            const expectedClause = expected.member_clauses[receipt?.course_code];
            return expectedClause
              && receipt.kind === 'prerequisite'
              && receipt.label === expectedClause.label
              && receipt.raw_normalized === expectedClause.raw_normalized
              && receipt.concurrent_allowed === expectedClause.concurrent_allowed;
          });
        if (row.source.compound_entry !== true
            || row.source.compound_receipt_contract !== CNU_COMPOUND_RECEIPT_CONTRACT
            || !expected
            || row.source.raw_entry_sha256 !== expected?.raw_entry_sha256
            || row.source.pdf_page_start !== expected?.pdf_page_start
            || row.source.pdf_page_end !== expected?.pdf_page_end
            || JSON.stringify(row.source.page_column_span)
              !== JSON.stringify(expected?.page_column_span)
            || JSON.stringify(row.source.compound_heading_course_codes)
              !== JSON.stringify(expected?.compound_course_codes)
            || !row.source.compound_heading_course_codes.includes(row.course_code)
            || row.source.compound_member_requisite?.course_code !== row.course_code
            || ordered.some((receipt) => !receipt)
            || !expectedMemberClausesMatch
            || sha256(JSON.stringify(reconstructed)) !== row.source.compound_receipt_sha256) {
          issues.push(`${row?.course_key}:cnu_compound_receipt`);
        }
        if (requisites.some((receipt) => (
          sha256(receipt.raw) !== receipt.raw_sha256
          || row.source.raw_entry_text.slice(receipt.relative_start, receipt.relative_end)
            !== receipt.raw
          || sha256(receipt.statement_raw) !== receipt.statement_sha256
          || row.source.raw_entry_text.slice(
            receipt.statement_relative_start, receipt.statement_relative_end,
          ) !== receipt.statement_raw
        ))) {
          issues.push(`${row?.course_key}:cnu_compound_offsets`);
        }
      }
    }
    if (row.source.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT) {
      const projected = {
        ...row.source,
        slug: row.slug,
        owner_namespace: row.owner_namespace,
        course_key: row.course_key,
        course_code: row.course_code,
      };
      if (row.source.source_format !== 'cnu_current_joint_identity_pdf_entry'
          || row.source.cache_path !== CNU_CPEN371W_SOURCE_CACHE_PATH
          || row.source.evidence_cache_path !== CNU_CPEN371W_EVIDENCE_CACHE_PATH
          || row.source.evidence_artifact_sha256
            !== CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256
          || row.source.declared_normalized_text_sha256
            !== row.source.source_response_sha256
          || row.source.retained_normalized_text_sha256
            !== row.source.source_response_sha256
          || row.source.character_start !== 0
          || row.source.character_end !== row.source.raw_entry_text.length
          || cnuCpen371wEntryIssue(projected)) {
        issues.push(`${row.course_key}:cnu_cpen371w_exact_evidence`);
      }
    }
    if (row.source.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT) {
      const projected = {
        ...row.source,
        slug: row.slug,
        owner_namespace: row.owner_namespace,
        course_key: row.course_key,
        course_code: row.course_code,
      };
      if (row.source.source_format !== 'vsu_languages_department_courseblock'
          || row.source.cache_path !== VSU_ARABIC_SOURCE_CACHE_PATH
          || row.source.evidence_cache_path !== VSU_ARABIC_EVIDENCE_CACHE_PATH
          || row.source.evidence_artifact_sha256 !== VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256
          || row.source.declared_normalized_text_sha256
            !== row.source.source_response_sha256
          || row.source.retained_normalized_text_sha256
            !== row.source.source_response_sha256
          || row.source.character_start !== 0
          || row.source.character_end !== row.source.raw_entry_text.length
          || vsuArabicEntryIssue(projected)) {
        issues.push(`${row.course_key}:vsu_arabic_exact_evidence`);
      }
    }
    if (row.source.boundary_contract === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT) {
      const projected = {
        ...row.source,
        slug: row.slug,
        owner_namespace: row.owner_namespace,
        course_key: row.course_key,
        course_code: row.course_code,
      };
      if (row.source.source_format !== 'virginia_tech_current_graduate_cs_heading_entry'
          || row.source.cache_path !== VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH
          || row.source.evidence_cache_path
            !== VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH
          || row.source.evidence_artifact_sha256
            !== VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256
          || row.source.declared_normalized_text_sha256
            !== row.source.source_response_sha256
          || row.source.retained_normalized_text_sha256
            !== row.source.source_response_sha256
          || row.source.character_start !== 0
          || row.source.character_end !== row.source.raw_entry_text.length
          || virginiaTechGraduateCsEntryIssue(projected)) {
        issues.push(`${row.course_key}:virginia_tech_graduate_cs_exact_evidence`);
      }
    }
    if (row.source.boundary_contract === BRIDGEWATER_BOUNDARY_CONTRACT) {
      let url = null;
      try { url = new URL(row.source.official_url); } catch { /* recorded below */ }
      if (url?.hostname.toLowerCase() !== BRIDGEWATER_HOST
          || url?.pathname.replace(/\/$/, '') !== row.source.canonical_path
          || row.source.canonical_path !== expectedBridgewaterCoursePath(row.course_code)) {
        issues.push(`${row?.course_key}:bridgewater_identity`);
      }
      if (!/^[a-f0-9]{64}$/.test(row.source.raw_entry_html_sha256 || '')
          || row.source.source_format !== 'cleancatalog_course_page'
          || !row.source.published_units
          || !(row.source.published_units.credit_hours_min > 0)
          || row.source.published_units.credit_hours_max
            !== row.source.published_units.credit_hours_min) {
        issues.push(`${row?.course_key}:bridgewater_entry`);
      }
      const fieldReceipt = row.source.requisite_field_receipt;
      if (fieldReceipt?.receipt_contract !== BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT
          || !Number.isInteger(fieldReceipt.field_label_count)
          || fieldReceipt.field_label_count <= 0
          || !/^[a-f0-9]{64}$/.test(fieldReceipt.field_labels_sha256 || '')
          || !Number.isInteger(fieldReceipt.exact_prerequisite_field_count)
          || fieldReceipt.exact_prerequisite_field_count < 0
          || !Number.isInteger(fieldReceipt.exact_corequisite_field_count)
          || fieldReceipt.exact_corequisite_field_count < 0
          || fieldReceipt.unrecognized_requisite_like_field_count !== 0
          || !Array.isArray(fieldReceipt.requisite_fields)
          || fieldReceipt.requisite_fields.length !== (
            fieldReceipt.exact_prerequisite_field_count
            + fieldReceipt.exact_corequisite_field_count
          )
          || fieldReceipt.requisite_fields.some((field) => (
            !/^(?:Pre|Co)requisites?$/i.test(field.label)
            || !Array.isArray(field.values) || !field.values.length
            || !/^[a-f0-9]{64}$/.test(field.values_sha256 || '')
            || sha256(JSON.stringify(field.values)) !== field.values_sha256
          ))) issues.push(`${row?.course_key}:bridgewater_requisite_field_receipt`);
      if (!/^[a-f0-9]{64}$/.test(row.source.edition_response_sha256 || '')
          || !/^[a-f0-9]{64}$/.test(row.source.edition_normalized_main_text_sha256 || '')
          || row.source.edition_path !== BRIDGEWATER_EDITION_PATH
          || row.source.edition_catalog_year !== row.source.catalog_year_verified
          || row.source.edition_exact_year_statement
            !== `Course numbers and descriptions listed herein apply to the ${row.source.catalog_year_verified} academic year.`) {
        issues.push(`${row?.course_key}:bridgewater_edition`);
      }
    }
    if (row.source.boundary_contract === LONGWOOD_BOUNDARY_CONTRACT) {
      let url = null;
      try { url = new URL(row.source.official_url); } catch { /* recorded below */ }
      if (row.slug !== LONGWOOD_SLUG
          || ![
            ...LONGWOOD_DIRECT_CMSC_TARGETS,
            ...LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
          ].includes(row.course_code)
          || url?.protocol !== 'https:'
          || url?.hostname.toLowerCase() !== LONGWOOD_DEPARTMENT_HOST
          || url?.pathname.replace(/\/$/, '') !== LONGWOOD_DEPARTMENT_PATH
          || row.source.source_format !== 'longwood_department_course_listing') {
        issues.push(`${row?.course_key}:longwood_identity`);
      }
      if (!/^[a-f0-9]{64}$/.test(row.source.raw_entry_html_sha256 || '')
          || !row.source.published_units
          || !(row.source.published_units.credit_hours_min >= 0)
          || row.source.published_units.credit_hours_max
            < row.source.published_units.credit_hours_min) {
        issues.push(`${row?.course_key}:longwood_entry`);
      }
      if (row.source.catalog_year_verified !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.source.department_page_catalog_year_statement !== null
          || row.source.catalog_context_contract !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
          || row.source.catalog_context_official_url !== LONGWOOD_CATALOG_CONTEXT_URL
          || row.source.catalog_context_html_cache_path
            !== LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH
          || row.source.catalog_context_text_cache_path
            !== LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH
          || row.source.catalog_context_normalized_text_sha256
            !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
          || !/^[a-f0-9]{64}$/.test(row.source.catalog_context_html_sha256 || '')
          || !/^[a-f0-9]{64}$/.test(row.source.catalog_context_relevant_sha256 || '')
          || row.source.catalog_context_catalog_year !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.source.catalog_context_catoid !== LONGWOOD_CATALOG_CONTEXT_CATOID
          || row.source.two_source_edition_boundary !== LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY
          || !/does not print a catalog year/i.test(row.source.two_source_binding_note || '')) {
        issues.push(`${row?.course_key}:longwood_catalog_context`);
      }
    }
    if (row.source.boundary_contract === LONGWOOD_BANNER_BOUNDARY_CONTRACT) {
      let url = null;
      try { url = new URL(row.source.official_url); } catch { /* recorded below */ }
      if (row.slug !== LONGWOOD_SLUG
          || (!/^(?:CTZN|ENGL|MATH)\d{2,4}[A-Z]?$/.test(row.course_code || '')
            && !LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS.includes(row.course_code)
            && !LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS.includes(row.course_code))
          || url?.protocol !== 'https:'
          || url?.hostname.toLowerCase() !== LONGWOOD_BANNER_HOST
          || url?.pathname.replace(/\/$/, '') !== LONGWOOD_BANNER_PATH
          || row.source.source_format !== 'longwood_banner_course_listing') {
        issues.push(`${row?.course_key}:longwood_banner_identity`);
      }
      if (!/^[a-f0-9]{64}$/.test(row.source.raw_entry_html_sha256 || '')
          || !row.source.published_units
          || !(row.source.published_units.credit_hours_min >= 0)
          || row.source.published_units.credit_hours_max
            < row.source.published_units.credit_hours_min) {
        issues.push(`${row?.course_key}:longwood_banner_entry`);
      }
      if (row.source.catalog_year_verified !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.source.department_page_catalog_year_statement !== null
          || row.source.catalog_context_contract !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
          || row.source.catalog_context_official_url !== LONGWOOD_CATALOG_CONTEXT_URL
          || row.source.catalog_context_html_cache_path
            !== LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH
          || row.source.catalog_context_text_cache_path
            !== LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH
          || row.source.catalog_context_normalized_text_sha256
            !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
          || !/^[a-f0-9]{64}$/.test(row.source.catalog_context_html_sha256 || '')
          || !/^[a-f0-9]{64}$/.test(row.source.catalog_context_relevant_sha256 || '')
          || row.source.catalog_context_catalog_year !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.source.catalog_context_catoid !== LONGWOOD_CATALOG_CONTEXT_CATOID
          || row.source.two_source_edition_boundary
            !== LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY
          || !/does not print a catalog year/i.test(row.source.two_source_binding_note || '')) {
        issues.push(`${row?.course_key}:longwood_banner_catalog_context`);
      }
    }
    if (row.source.boundary_contract === RADFORD_BOUNDARY_CONTRACT) {
      const expected = RADFORD_COURSE_RECORDS[row.course_code];
      const closureExpected = RADFORD_CLOSURE_COURSE_RECORDS[row.course_code];
      let url = null;
      try { url = new URL(row.source.official_url); } catch { /* recorded below */ }
      if (row.slug !== RADFORD_SLUG || !expected
          || row.source.source_format !== 'radford_acalog_course_page'
          || url?.protocol !== 'https:' || url?.hostname.toLowerCase() !== RADFORD_HOST
          || url?.pathname !== '/preview_course_nopop.php'
          || Number(url?.searchParams.get('catoid')) !== RADFORD_CATOID
          || Number(url?.searchParams.get('coid')) !== expected?.coid
          || row.source.catoid !== RADFORD_CATOID || row.source.coid !== expected?.coid) {
        issues.push(`${row.course_key}:radford_identity`);
      }
      const receipt = row.source.discovery_link_receipt;
      if (row.source.catalog_year_verified !== RADFORD_CATALOG_YEAR
          || receipt?.course_code !== row.course_code
          || receipt?.catoid !== RADFORD_CATOID || receipt?.coid !== expected?.coid
          || (!closureExpected && receipt?.title !== expected?.title)
          || (closureExpected
            ? (row.source.discovery_contract !== RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT
              || row.source.discovery_cache_path !== closureExpected.discovery_cache_path
              || row.source.discovery_response_sha256
                !== closureExpected.discovery_response_sha256
              || receipt?.discovery_course_code !== closureExpected.discovery_course_code
              || receipt?.discovery_cache_path !== closureExpected.discovery_cache_path
              || receipt?.discovery_response_sha256
                !== closureExpected.discovery_response_sha256)
            : (row.source.discovery_contract !== RADFORD_DISCOVERY_CONTRACT
              || row.source.discovery_cache_path !== RADFORD_PROGRAM_CACHE_PATH
              || row.source.discovery_response_sha256 !== RADFORD_PROGRAM_HTML_SHA256))
          || row.source.robots_crawl_delay_seconds !== 120
          || !/^[a-f0-9]{64}$/.test(row.source.raw_entry_html_sha256 || '')
          || !row.source.published_units
          || !(row.source.published_units.credit_hours_min > 0)
          || row.source.published_units.credit_hours_max
            < row.source.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:radford_receipt`);
      }
      const clause = row.source.required_requisite_clause;
      const markerCount = (row.source.raw_entry_text.match(/\bPrerequisites?:/gi) || []).length;
      if (markerCount !== (clause ? 1 : 0)
          || (clause && (clause.receipt_contract !== RADFORD_CLAUSE_RECEIPT_CONTRACT
          || clause.kind !== 'prerequisite'
          || sha256(clause.raw) !== clause.raw_sha256
          || row.source.raw_entry_text.slice(clause.relative_start, clause.relative_end)
            !== clause.raw
          || clause.statement_relative_end !== clause.relative_end
          || !/^[a-f0-9]{64}$/.test(clause.raw_html_sha256 || '')))) {
        issues.push(`${row.course_key}:radford_clause_receipt`);
      }
      const preOrCorequisite = row.source.pre_or_corequisite_clause;
      const preOrCorequisiteMarkerCount = (
        row.source.raw_entry_text.match(/\bPre-\s*or\s*Corequisites?:/gi) || []
      ).length;
      if (preOrCorequisiteMarkerCount !== (preOrCorequisite ? 1 : 0)
          || (preOrCorequisite
            && (preOrCorequisite.receipt_contract
              !== RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT
            || preOrCorequisite.kind !== 'pre_or_corequisite'
            || sha256(preOrCorequisite.raw) !== preOrCorequisite.raw_sha256
            || row.source.raw_entry_text.slice(
              preOrCorequisite.relative_start, preOrCorequisite.relative_end,
            ) !== preOrCorequisite.raw
            || preOrCorequisite.statement_relative_end !== preOrCorequisite.relative_end
            || preOrCorequisite.boundary_terminal
              !== 'first_br_after_unique_strong_pre_or_corequisite_marker'))) {
        issues.push(`${row.course_key}:radford_pre_or_corequisite_clause_receipt`);
      }
      if (row.source.formal_requisite_marker_count != null
          && row.source.formal_requisite_marker_count
            !== markerCount + preOrCorequisiteMarkerCount) {
        issues.push(`${row.course_key}:radford_formal_requisite_marker_count`);
      }
    }
    if (row.source.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT) {
      const expected = UVA_WISE_COURSE_RECORDS[row.course_code];
      const closureExpected = UVA_WISE_CLOSURE_COURSE_RECORDS[row.course_code];
      let sourceUrl = null;
      try { sourceUrl = new URL(row.source.official_url); } catch { /* recorded below */ }
      if (row.source.capture_origin !== 'official_uva_wise_acalog_course_page'
          || row.source.source_format !== 'uva_wise_acalog_course_page'
          || row.slug !== UVA_WISE_SLUG || !expected
          || sourceUrl?.protocol !== 'http:'
          || sourceUrl?.hostname.toLowerCase() !== UVA_WISE_HOST
          || sourceUrl?.pathname !== '/preview_course_nopop.php'
          || row.source.catoid !== UVA_WISE_CATOID
          || row.source.coid !== expected?.coid
          || row.source.catalog_year_verified !== UVA_WISE_CATALOG_YEAR
          || (closureExpected
            ? (row.source.discovery_contract !== UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT
              || row.source.discovery_cache_path !== closureExpected.discovery_cache_path
              || row.source.discovery_response_sha256
                !== closureExpected.discovery_response_sha256
              || row.source.discovery_link_receipt?.discovery_course_code
                !== closureExpected.discovery_course_code
              || row.source.discovery_link_receipt?.coid !== closureExpected.coid)
            : (row.source.discovery_contract !== UVA_WISE_DISCOVERY_CONTRACT
              || row.source.discovery_program_cache_path !== UVA_WISE_PROGRAM_CACHE_PATH
              || row.source.discovery_program_response_sha256 !== UVA_WISE_PROGRAM_HTML_SHA256
              || row.source.discovery_ge_cache_path !== UVA_WISE_GE_CACHE_PATH
              || row.source.discovery_ge_response_sha256 !== UVA_WISE_GE_HTML_SHA256))
          || row.source.robots_crawl_delay_seconds !== UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS
          || row.source.http_exception_contract
            !== 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1') {
        issues.push(`${row.course_key}:uva_wise_source_receipt`);
      }
      const clause = row.source.required_requisite_clause;
      if (clause && (clause.receipt_contract !== UVA_WISE_CLAUSE_RECEIPT_CONTRACT
          || sha256(clause.raw) !== clause.raw_sha256
          || row.source.raw_entry_text.slice(clause.relative_start, clause.relative_end)
            !== clause.raw)) issues.push(`${row.course_key}:uva_wise_clause_receipt`);
    }
    if (row.source.boundary_contract === SHENANDOAH_BOUNDARY_CONTRACT) {
      const expected = SHENANDOAH_DIRECT_COURSE_RECORDS[row.course_code];
      const expectedDiscoveryContract = expected?.discovery_contract
        || SHENANDOAH_DISCOVERY_CONTRACT;
      const expectedDiscoveryCachePath = expected?.discovery_cache_path
        || SHENANDOAH_PROGRAM_CACHE_PATH;
      const expectedDiscoveryResponseSha256 = expected?.discovery_response_sha256
        || SHENANDOAH_PROGRAM_HTML_SHA256;
      let sourceUrl = null;
      try { sourceUrl = new URL(row.source.official_url); } catch { /* recorded below */ }
      if (row.source.capture_origin !== 'official_shenandoah_acalog_course_page'
          || row.source.source_format !== 'shenandoah_acalog_course_page'
          || row.slug !== SHENANDOAH_SLUG || !expected
          || sourceUrl?.protocol !== 'https:'
          || sourceUrl?.hostname.toLowerCase() !== SHENANDOAH_HOST
          || sourceUrl?.pathname !== '/preview_course_nopop.php'
          || Number(sourceUrl.searchParams.get('catoid')) !== SHENANDOAH_CATOID
          || Number(sourceUrl.searchParams.get('coid')) !== expected?.coid
          || row.source.catoid !== SHENANDOAH_CATOID
          || row.source.coid !== expected?.coid
          || row.source.catalog_year_verified !== SHENANDOAH_CATALOG_YEAR
          || row.source.discovery_contract !== expectedDiscoveryContract
          || row.source.discovery_cache_path !== expectedDiscoveryCachePath
          || row.source.discovery_response_sha256 !== expectedDiscoveryResponseSha256
          || row.source.robots_crawl_delay_seconds
            !== SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS
          || row.source.discovery_link_receipt?.course_code !== row.course_code
          || row.source.discovery_link_receipt?.coid !== expected?.coid
          || row.source.discovery_link_receipt?.title !== expected?.title
          || !/^[a-f0-9]{64}$/.test(row.source.raw_entry_html_sha256 || '')
          || !row.source.published_units
          || !(row.source.published_units.credit_hours_min > 0)
          || row.source.published_units.credit_hours_max
            < row.source.published_units.credit_hours_min
          || !Number.isInteger(row.source.formal_corequisite_marker_count)
          || row.source.formal_corequisite_marker_count < 0) {
        issues.push(`${row.course_key}:shenandoah_source_receipt`);
      }
      const clause = row.source.required_requisite_clause;
      if (clause && (clause.receipt_contract !== SHENANDOAH_CLAUSE_RECEIPT_CONTRACT
          || sha256(clause.raw) !== clause.raw_sha256
          || row.source.raw_entry_text.slice(clause.relative_start, clause.relative_end)
            !== clause.raw)) issues.push(`${row.course_key}:shenandoah_clause_receipt`);
    }
  }
  if (artifact?.summary?.safely_bounded_review_candidates !== rows.length) issues.push('summary_candidates');
  if (scope) {
    const bySlug = new Map(scope.universities.map((row) => [row.slug, row]));
    if (manifest.length !== scope.universities.length) issues.push('manifest_count');
    for (const row of manifest) {
      const source = bySlug.get(row.slug);
      if (!source || source.school_id !== row.school_id) issues.push(`${row.slug}:scope_identity`);
      if (row.bounded_review_candidate_count + row.direct_codes_without_bounded_candidate_count !== row.required_resident_path_course_count) {
        issues.push(`${row.slug}:candidate_partition`);
      }
      if (row.cached_bounded_review_candidate_count + row.exact_tokens_without_cached_bounded_entry_count !== row.exact_code_token_count) {
        issues.push(`${row.slug}:cached_token_partition`);
      }
    }
    if (artifact.summary.direct_named_courses !== scope.summary.direct_named_courses) issues.push('summary_direct');
    const expectedDeterministic = scope.summary.deterministic_resident_path_courses ?? 0;
    const expectedRequired = scope.summary.required_resident_path_courses
      ?? scope.summary.direct_named_courses;
    if (artifact.summary.deterministic_resident_path_courses
        !== expectedDeterministic) {
      issues.push('summary_deterministic_resident_path');
    }
    if (artifact.summary.required_resident_path_courses
        !== expectedRequired) {
      issues.push('summary_required_resident_path');
    }
    if (artifact.summary.exact_code_tokens_in_cached_official_text !== scope.summary.exact_code_tokens_in_cached_official_text) issues.push('summary_tokens');
  }
  const expectedCaptureFloor = manifest.reduce((total, row) => total + row.direct_codes_without_bounded_candidate_count, 0);
  if (artifact?.summary?.remaining_direct_capture_floor !== expectedCaptureFloor) issues.push('summary_capture_floor');
  return { valid: issues.length === 0, issues };
}

module.exports = {
  ARTIFACT,
  CANDIDATE_STATUS,
  CAPTURE_RULES,
  boundedEntries,
  buildUniversityPrerequisiteCandidates,
  scanHeadings,
  sha256,
  titleLooksLikeReferenceRun,
  validateUniversityPrerequisiteCandidates,
};
