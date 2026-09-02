const crypto = require('node:crypto');
const path = require('node:path');
const cheerio = require('cheerio');
const {
  CNU_BOUNDARY_CONTRACT,
  CNU_COLUMN_GEOMETRY,
  CNU_COMPOUND_BOUNDARY_CONTRACT,
  CNU_COMPOUND_RECEIPT_CONTRACT,
  CNU_EXPECTED_PAGE_COUNT,
  CNU_EXPECTED_PDF_SHA256,
  CNU_EXPECTED_PDF_TITLE,
  CNU_PDF_CACHE_PATH,
  CNU_PINNED_COMPOUND_RECEIPTS,
  CNU_SLUG,
} = require('./cnuPdfPrerequisiteAcquisition');
const {
  BRIDGEWATER_BOUNDARY_CONTRACT,
  BRIDGEWATER_EDITION_PATH,
  BRIDGEWATER_HOST,
  BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT,
  BRIDGEWATER_SLUG,
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
  LONGWOOD_DEPARTMENT_URL,
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
  LONGWOOD_BANNER_URL,
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
  expectedCourseUrl: expectedRadfordCourseUrl,
} = require('./radfordAcalogPrerequisiteAcquisition');
const {
  VIRGINIA_TECH_CATALOG_YEAR,
  VIRGINIA_TECH_CS_DEPARTMENT_URL,
  VIRGINIA_TECH_CS_HTML_CACHE_PATH,
  VIRGINIA_TECH_CS_HTML_SHA256,
  VIRGINIA_TECH_CS_TEXT_CACHE_PATH,
  VIRGINIA_TECH_CS_TEXT_SHA256,
  VIRGINIA_TECH_HOST,
  VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT,
  VIRGINIA_TECH_SLUG,
} = require('./virginiaTechCourseLeafPrerequisiteAcquisition');
const {
  BROWSER_CHALLENGE_CONTRACT,
  BROWSER_ROBOTS_CONTRACT,
  JMU_CATALOG_YEAR,
  JMU_COURSELEAF_SUBJECT_ROUTES,
  JMU_HOST,
  JMU_SLUG,
  VIRGINIA_TECH_COURSE_DESCRIPTION_SUBJECT_ROUTES,
  VIRGINIA_TECH_COURSELEAF_SUBJECT_ROUTES,
  VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
  VIRGINIA_TECH_SITEMAP_URL,
  exactKnownBrowserResource,
  expectedBrowserCoursePaths,
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
  expectedCourseUrl: expectedUvaWiseCourseUrl,
} = require('./uvaWiseAcalogPrerequisiteAcquisition');
const {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CATALOG_YEAR,
  SHENANDOAH_CATOID,
  SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
  SHENANDOAH_HOST,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_PROGRAM_HTML_SHA256,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  SHENANDOAH_SLUG,
  expectedCourseUrl: expectedShenandoahCourseUrl,
  expectedFilterDiscoveryUrl: expectedShenandoahFilterDiscoveryUrl,
} = require('./shenandoahAcalogPrerequisiteAcquisition');
const {
  CNU_ALIAS_RECEIPT_CONTRACT,
  CNU_CATALOG_RAW_TEXT_SHA256,
  CNU_CATALOG_RESPONSE_SHA256,
  CNU_CATALOG_URL,
  CNU_CATALOG_YEAR: CNU_CPEN371W_CATALOG_YEAR,
  CNU_CLAUSE_RECEIPT_CONTRACT,
  CNU_COURSE_BOUNDARY_CONTRACT: CNU_CPEN371W_COURSE_BOUNDARY_CONTRACT,
  CNU_CPEN371W_FACTS_SHA256,
  CNU_OWNER_NAMESPACE,
  CNU_PROGRAM_RESPONSE_SHA256,
  CNU_PROGRAM_URL,
  CNU_ROBOTS_RESPONSE_SHA256,
} = require('./cnuCpen371wPrerequisiteEvidence');
const {
  EXPECTED: VSU_ARABIC_EXPECTED,
  VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT,
  VSU_ARABIC_BOUNDARY_CONTRACT,
  VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
  VSU_ARABIC_FACTS_SHA256,
  VSU_CATALOG_YEAR: VSU_ARABIC_CATALOG_YEAR,
  VSU_DEPARTMENT_RESPONSE_SHA256,
  VSU_DEPARTMENT_URL,
  VSU_OWNER_NAMESPACE,
  VSU_ROBOTS_RESPONSE_SHA256,
  VSU_SLUG,
  admissionRestrictionFormula,
  prerequisiteFormula: vsuArabicPrerequisiteFormula,
} = require('./virginiaStateArabicPrerequisiteEvidence');
const {
  requiredResidentPathCourseCodes,
} = require('./universityPrerequisiteScope');
const {
  scopedUnparsedCourseKeys,
} = require('./norfolkVirginiaStatePrerequisiteScope');
const {
  scopedUnparsedCourseKeys: scopedGeorgeMasonUnparsedCourseKeys,
} = require('./georgeMasonPrerequisiteSilenceEvidence');
const {
  oldDominionClosureCaptureKeys,
} = require('./oldDominionPrerequisiteClosureScope');
const {
  EXPECTED: VIRGINIA_TECH_GRADUATE_CS_EXPECTED,
  TARGET_CODES: VIRGINIA_TECH_GRADUATE_CS_TARGETS,
  VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_CURRENT_SOURCE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
  VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_URL,
  VIRGINIA_TECH_OWNER_NAMESPACE,
} = require('./virginiaTechGraduateCsPrerequisiteEvidence');

const ARTIFACT = 'virginia_figure6_university_prerequisite_official_capture';
const USER_AGENT = 'TransferPathwaysResearchBot/1.0 (Virginia Figure 6 evidence collection)';
const COURSELEAF_BOUNDARY_CONTRACT =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT_CONTRACT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const COURSELEAF_STRUCTURED_REQUISITE_FIELD_RECEIPT_CONTRACT =
  'courseleaf_exact_structured_requisite_field_offsets_and_html_hash_v1';
const GMU_CYSE_CACHE_REACQUISITION_RECEIPT =
  'gmu_exact_cached_courseleaf_response_revalidated_after_false_interstitial_block_v1';
const GMU_CYSE_RESPONSE_SHA256 =
  'e1c6f3d40c65fe9b9c814891d34253bb9260e77575ca4e3b6c25cb6fd147eb23';
const GMU_CYSE_CACHE_PATH =
  'university-prerequisites/raw/george-mason-university/george-mason-university__cyse.html';
const CNU_CPEN371W_EVIDENCE_CACHE_PATH =
  'research/cnu-cpen371w-prerequisite-evidence.json';
const CNU_CPEN371W_SOURCE_CACHE_PATH =
  'research/cnu-cpen371w-prerequisite-sources/cnu-2026-2027-undergraduate-catalog.pdf';
const CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256 =
  '32e6446156533766454606a023632d50fb0c79c427f672221970bfb8a9b74425';
const VSU_ARABIC_EVIDENCE_CACHE_PATH =
  'research/virginia-state-arabic-prerequisite-evidence.json';
const VSU_ARABIC_SOURCE_CACHE_PATH =
  'research/virginia-state-arabic-prerequisite-sources/languages-and-literature-2026-2027.html';
const VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256 =
  '4755d5e9c496f9c37144747abc4bd0903e35ceb50f2236586fc4001d83bab89d';
const VSU_ARABIC_TARGETS = Object.freeze(Object.keys(VSU_ARABIC_EXPECTED));
const VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH =
  'research/virginia-tech-graduate-cs-prerequisite-evidence.json';
const VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH =
  'research/virginia-tech-graduate-cs-prerequisite-sources/graduate-course-descriptions.html';
const VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256 =
  'fcd9e497ad705003082251a89ab4e5c79df9f594c0f8eeb0a5cf82f92782ffab';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

const COURSELEAF_ROUTES = Object.freeze({
  'george-mason-university': '/courses/<prefix>/',
  'norfolk-state-university': '/undergraduate/course-descriptions/<prefix>/',
  'old-dominion-university': '/courses/<prefix>/',
  'randolph-macon-college': '/courses-az/<prefix>/',
  'university-of-mary-washington': '/undergraduate/course-descriptions/<prefix>/',
  'virginia-commonwealth-university': '/azcourses/<prefix>/',
  'virginia-state-university': '/undergraduate/courses/<prefix>/',
  'william-mary': '/undergraduate/courses/<prefix>/',
});

// Virginia Tech's public course-search landing page is a client-side index,
// but the current first-party department page publishes the complete CS
// subject roster as bounded CourseLeaf courseblocks in one response.
const VIRGINIA_TECH_BULK_SUBJECT_ROUTES = Object.freeze({
  CS: '/undergraduate/college-engineering/computer-science/',
});

const OWNER_BLOCKERS = Object.freeze({
  'james-madison-university': 'The catalog platform has a plausible subject route, but acquisition must stop if its robots response is empty or non-200.',
  'shenandoah-university': 'Acalog requires filtered discovery followed by exact course-detail capture and publishes crawl-delay: 120 for this host.',
  'the-university-of-virginia-s-college-at-wise': 'Acalog detail capture is blocked until the official host presents a valid TLS chain and a usable robots policy.',
  'virginia-polytechnic-institute-and-state-university': 'The retained page is a search index; acquisition must stop if the catalog robots response is empty or non-200.',
});

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function coursePrefix(code) {
  return normalizeCode(code)?.match(/^([A-Z]+)/)?.[1] || null;
}

function splitCourseKey(key) {
  const match = /^(va:uni:\d+):([A-Z]{2,8}\d{2,4}[A-Z]?)$/.exec(String(key || ''));
  return match ? { owner_namespace: match[1], course_code: match[2] } : null;
}

function normalizedEntryText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function exactReceiptOffsetsValid(rawEntryText, receipt, {
  contract,
  kind,
  label = null,
} = {}) {
  if (!receipt || receipt.receipt_contract !== contract || receipt.kind !== kind
      || (label !== null && receipt.label !== label)
      || sha256(receipt.raw) !== receipt.raw_sha256
      || rawEntryText.slice(receipt.relative_start, receipt.relative_end) !== receipt.raw
      || !Number.isInteger(receipt.statement_relative_start)
      || !Number.isInteger(receipt.statement_relative_end)
      || receipt.statement_relative_start < 0
      || receipt.statement_relative_end < receipt.relative_end
      || receipt.statement_relative_end > rawEntryText.length) return false;
  if (label !== null && rawEntryText.slice(
    receipt.statement_relative_start,
    receipt.statement_relative_start + label.length + 1,
  ) !== `${label}:`) return false;
  return true;
}

function cnuCpen371wEntryIssue(row) {
  const expectedSemantic = {
    status: 'parsed',
    formula: 'paths_or__conditions_and',
    paths: [{ all_of: [{
      type: 'course',
      code: 'ENGL223',
      course_key: `${CNU_OWNER_NAMESPACE}:ENGL223`,
      minimum_grade: 'C-',
      raw: 'ENGL 223 with a C- or higher',
    }, {
      type: 'non_course',
      condition: 'pcse_major_or_minor',
      academic_program: 'PCSE',
      eligible_academic_program_roles: ['major', 'minor'],
      raw: 'major or minor in PCSE',
    }] }],
  };
  const receipt = row.required_requisite_clause;
  if (row.slug !== CNU_SLUG || row.owner_namespace !== CNU_OWNER_NAMESPACE
      || row.course_key !== `${CNU_OWNER_NAMESPACE}:CPEN371W`
      || row.course_code !== 'CPEN371W'
      || row.capture_origin !== 'official_current_cnu_joint_identity_evidence'
      || row.boundary_contract !== CNU_ALIAS_RECEIPT_CONTRACT
      || row.course_boundary_contract !== CNU_CPEN371W_COURSE_BOUNDARY_CONTRACT
      || row.official_url !== CNU_CATALOG_URL
      || row.program_official_url !== CNU_PROGRAM_URL
      || row.cache_path !== CNU_CPEN371W_SOURCE_CACHE_PATH
      || row.evidence_cache_path !== CNU_CPEN371W_EVIDENCE_CACHE_PATH
      || row.evidence_artifact_sha256 !== CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256
      || row.source_response_sha256 !== CNU_CATALOG_RESPONSE_SHA256
      || row.program_response_sha256 !== CNU_PROGRAM_RESPONSE_SHA256
      || row.robots_response_sha256 !== CNU_ROBOTS_RESPONSE_SHA256
      || row.catalog_raw_text_sha256 !== CNU_CATALOG_RAW_TEXT_SHA256
      || row.facts_sha256 !== CNU_CPEN371W_FACTS_SHA256
      || row.catalog_year_verified !== CNU_CPEN371W_CATALOG_YEAR
      || row.physical_pdf_page !== 275
      || row.heading_text !== 'CPEN 371. WI: Computer Ethics (2-2-0)'
      || row.title !== 'Computer Ethics'
      || row.raw_entry_sha256 !== '8f4497cc8e4bef8c23130ec97000e8fbe65cc526d2a89d8197c8925c6371da73'
      || JSON.stringify(row.published_units) !== JSON.stringify({
        kind: 'credit_lecture_lab_tuple',
        notation: '(2-2-0)',
        credit_hours_min: 2,
        credit_hours_max: 2,
        lecture_hours: 2,
        laboratory_hours: 0,
      })
      || !exactReceiptOffsetsValid(row.raw_entry_text, receipt, {
        contract: CNU_CLAUSE_RECEIPT_CONTRACT,
        kind: 'prerequisite',
        label: 'Prerequisites',
      })
      || receipt.raw !== 'ENGL 223 with a C- or higher; major or minor in PCSE'
      || JSON.stringify(row.semantic_prerequisite) !== JSON.stringify(expectedSemantic)
      || row.program_requirement?.target_course_code !== 'CPEN371W'
      || row.program_requirement?.exact_requirement_text !== 'CPEN 371W - Computer Ethics'
      || row.catalog_degree_requirement?.exact_requirement_text !== '1. CPEN 214, 371W;'
      || row.identity_resolution?.receipt_contract !== CNU_ALIAS_RECEIPT_CONTRACT
      || row.identity_resolution?.resolved !== true
      || row.identity_resolution?.scope !== 'CPEN371W_only'
      || row.identity_resolution?.broad_suffix_alias_rule_created !== false
      || row.identity_resolution?.target_is_catalog_entry_code_plus_w !== true
      || row.identity_resolution?.catalog_entry_writing_intensive_marker !== 'WI'
      || row.identity_resolution?.exact_title_match_after_wi_marker !== true
      || row.identity_resolution?.exact_catalog_entry_count !== 1
      || row.identity_resolution?.competing_target_heading_count !== 0) {
    return 'exact_current_identity_or_prerequisite_receipt';
  }
  return null;
}

function vsuArabicEntryIssue(row) {
  const expected = VSU_ARABIC_EXPECTED[row.course_code];
  if (!expected) return 'target_code';
  const spaced = row.course_code.replace(/^(ARAB)(\d+)$/, '$1 $2');
  const expectedHeading = `${spaced}. ${expected.title}. (${expected.units} Credits)`;
  const expectedRaw = `${expectedHeading}\n${expected.description}`;
  const formal = expected.prerequisite != null;
  const receipt = formal ? row.required_requisite_clause : row.enrollment_restriction;
  const expectedSemantic = formal
    ? vsuArabicPrerequisiteFormula(expected.prerequisite_code, expected.prerequisite)
    : admissionRestrictionFormula(expected.restriction);
  const receiptValid = formal
    ? exactReceiptOffsetsValid(row.raw_entry_text, receipt, {
      contract: VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
      kind: 'prerequisite',
      label: 'Prerequisite',
    }) && receipt.raw === expected.prerequisite
    : receipt?.receipt_contract === VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT
      && receipt.kind === 'enrollment_restriction'
      && receipt.restriction_type === 'prior_admission_credit'
      && receipt.subject === 'Arabic'
      && receipt.admission_credit_allowed === false
      && receipt.raw === expected.restriction
      && sha256(receipt.raw) === receipt.raw_sha256
      && row.raw_entry_text.slice(receipt.relative_start, receipt.relative_end) === receipt.raw;
  if (row.slug !== VSU_SLUG || row.owner_namespace !== VSU_OWNER_NAMESPACE
      || row.course_key !== `${VSU_OWNER_NAMESPACE}:${row.course_code}`
      || row.capture_origin !== 'official_vsu_languages_department_evidence'
      || row.boundary_contract !== VSU_ARABIC_BOUNDARY_CONTRACT
      || row.official_url !== VSU_DEPARTMENT_URL
      || row.cache_path !== VSU_ARABIC_SOURCE_CACHE_PATH
      || row.evidence_cache_path !== VSU_ARABIC_EVIDENCE_CACHE_PATH
      || row.evidence_artifact_sha256 !== VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256
      || row.source_response_sha256 !== VSU_DEPARTMENT_RESPONSE_SHA256
      || row.robots_response_sha256 !== VSU_ROBOTS_RESPONSE_SHA256
      || row.facts_sha256 !== VSU_ARABIC_FACTS_SHA256
      || row.catalog_year_verified !== VSU_ARABIC_CATALOG_YEAR
      || row.arabic_section_courseblock_count !== 4
      || !/^[a-f0-9]{64}$/.test(row.arabic_section_html_sha256 || '')
      || row.heading_text !== expectedHeading || row.title !== expected.title
      || row.raw_entry_text !== expectedRaw
      || row.raw_entry_sha256 !== sha256(expectedRaw)
      || !/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
      || row.formal_prerequisite_marker_count !== (formal ? 1 : 0)
      || row.catalog_silence_inferred_as_no_prerequisite !== false
      || !row.published_units
      || row.published_units.kind !== 'published_fixed_credits'
      || row.published_units.notation !== `${expected.units} Credits`
      || row.published_units.credit_hours_min !== expected.units
      || row.published_units.credit_hours_max !== expected.units
      || !receiptValid
      || (formal ? row.enrollment_restriction !== null : row.required_requisite_clause !== null)
      || JSON.stringify(row.semantic_prerequisite) !== JSON.stringify(expectedSemantic)) {
    return 'exact_department_entry_or_constraint_receipt';
  }
  return null;
}

function virginiaTechGraduateCsEntryIssue(row) {
  const expected = VIRGINIA_TECH_GRADUATE_CS_EXPECTED[row.course_code];
  if (!expected || !VIRGINIA_TECH_GRADUATE_CS_TARGETS.includes(row.course_code)) {
    return 'target_code';
  }
  const isStructuralNone = row.course_code === 'CS5104';
  const expectedRaw = `${expected.heading}\n${expected.description}`;
  const expectedRawSha256 = isStructuralNone
    ? '48affaf32abc3b7314d081dd28d9784ff0e9fba100c93e601bf2c4c74431f05d'
    : 'ab9ad1826498e5950212a5e870ba2746f6ddce6bc4ee39bd2ba76c34672bbedb';
  const expectedHtmlSha256 = isStructuralNone
    ? 'd6fd87328fa99eae33bb359499143de27616fd56e105d3d13b0b44b802018e48'
    : '903a882002ed64508944c6e0610fb372999077ca83db8d1995f3e2ee834d4c3c';
  const expectedSemantic = isStructuralNone ? null : {
    status: 'parsed',
    formula: 'paths_or__conditions_and',
    paths: [{ all_of: [{
      type: 'course',
      code: 'CS3114',
      course_key: `${VIRGINIA_TECH_OWNER_NAMESPACE}:CS3114`,
      raw: 'CS3114',
    }] }],
  };
  const receipt = row.required_requisite_clause;
  const exactClauseValid = !isStructuralNone && exactReceiptOffsetsValid(
    row.raw_entry_text,
    receipt,
    {
      contract: VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT,
      kind: 'prerequisite',
      label: 'Pre',
    },
  ) && receipt.raw === 'CS3114'
    && receipt.statement_raw === 'Pre: CS3114'
    && sha256(receipt.statement_raw) === receipt.statement_sha256
    && row.raw_entry_text.slice(
      receipt.statement_relative_start,
      receipt.statement_relative_end,
    ) === receipt.statement_raw;
  const structural = row.structural_none_evidence;
  const exactStructuralNoneValid = isStructuralNone
    && structural?.receipt_contract === VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT
    && structural?.literal_none_statement === false
    && structural?.missing_search_result_used === false
    && structural?.exact_complete_entry_present === true
    && structural?.same_page_positive_control === true
    && structural?.source_bounded_entry_count === 56
    && structural?.source_entries_with_pre_marker_count === 43
    && structural?.source_pre_marker_count === 46
    && structural?.positive_control_course_code === 'CS5114'
    && structural?.positive_control_statement === 'Pre: CS3114'
    && structural?.entry_required_prerequisite_marker_count === 0
    && structural?.entry_corequisite_marker_count === 0
    && structural?.entry_requisite_marker_like_count === 0
    && structural?.entry_constraint_like_signal_count === 0;
  if (row.slug !== VIRGINIA_TECH_SLUG
      || row.owner_namespace !== VIRGINIA_TECH_OWNER_NAMESPACE
      || row.course_key !== `${VIRGINIA_TECH_OWNER_NAMESPACE}:${row.course_code}`
      || row.capture_origin !== 'official_current_virginia_tech_graduate_cs_evidence'
      || row.boundary_contract !== VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT
      || row.source_current_contract !== VIRGINIA_TECH_GRADUATE_CS_CURRENT_SOURCE_CONTRACT
      || row.official_url !== VIRGINIA_TECH_GRADUATE_CS_URL
      || row.robots_official_url !== VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL
      || row.cache_path !== VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH
      || row.evidence_cache_path !== VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH
      || row.evidence_artifact_sha256
        !== VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256
      || row.source_response_sha256 !== VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256
      || row.source_response_bytes !== 105535
      || row.robots_response_sha256 !== VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256
      || row.facts_sha256 !== VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256
      || row.source_effective_pubdate !== '2026-07-01T12:54:08Z'
      || row.source_captured_on !== '2026-08-25'
      || row.catalog_edition_claimed !== false
      || row.catalog_year_verified !== null
      || row.heading_text !== expected.heading
      || row.title !== expected.title
      || row.next_heading_code !== expected.next_heading_code
      || !Number.isInteger(row.boundary_start) || !Number.isInteger(row.boundary_end)
      || row.boundary_start < 0 || row.boundary_end <= row.boundary_start
      || row.raw_entry_text !== expectedRaw
      || row.raw_entry_sha256 !== expectedRawSha256
      || sha256(row.raw_entry_text) !== expectedRawSha256
      || row.raw_entry_html_sha256 !== expectedHtmlSha256
      || JSON.stringify(row.published_units) !== JSON.stringify({
        kind: 'published_contact_credit_tuple',
        notation: '(3H,3C)',
        contact_hours: 3,
        credit_hours_min: 3,
        credit_hours_max: 3,
      })
      || row.formal_prerequisite_marker_count !== (isStructuralNone ? 0 : 1)
      || row.formal_corequisite_marker_count !== 0
      || row.prerequisite_marker_like_count !== (isStructuralNone ? 0 : 1)
      || row.constraint_like_signal_count !== 0
      || (isStructuralNone ? (
        row.required_requisite_clause !== null
        || row.semantic_prerequisite !== null
        || !exactStructuralNoneValid
      ) : (
        row.structural_none_evidence !== null
        || !exactClauseValid
        || JSON.stringify(row.semantic_prerequisite) !== JSON.stringify(expectedSemantic)
      ))) {
    return 'exact_current_heading_boundary_or_prerequisite_receipt';
  }
  return null;
}

function catalogYearSeen(text, expectedYear) {
  const match = /^(20\d{2})-(20)?(\d{2})$/.exec(String(expectedYear || ''));
  if (!match) return false;
  const full = `${match[1]}-${match[3].length === 2 ? match[1].slice(0, 2) + match[3] : match[3]}`;
  const short = `${match[1]}-${full.slice(-2)}`;
  return String(text || '').includes(full) || String(text || '').includes(short);
}

function courseCodeAtEntryStart(text) {
  const match = /^([A-Z]{2,8})\s*-?\s*(\d{2,4}[A-Z]?)(?=$|[^A-Z0-9])/i.exec(text);
  return match ? normalizeCode(`${match[1]}${match[2]}`) : null;
}

function headingHasPublishedUnits(block, text) {
  const first = normalizedEntryText(block.children().first().text());
  const heading = first || text.slice(0, 300);
  const structured = block.find('.detail-hours_html');
  if (structured.length === 1) {
    const value = normalizedEntryText(structured.first().text());
    if (/^(?:credits?|credit hours?)\s+\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?$/i.test(value)) {
      return true;
    }
  }
  return /(?:\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s+(?:credit(?:s| hours?)?|hours?)\b|\bno credit\b)/i
    .test(heading);
}

function publishedUnitsReceipt(block, text) {
  const structured = block.find('.detail-hours_html');
  if (structured.length === 1) {
    const field = normalizedEntryText(structured.first().text());
    const match = /^(credits?|credit hours?)\s+(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/i
      .exec(field);
    if (match) {
      const minimum = Number(match[2]);
      const maximum = Number(match[3] || match[2]);
      if (minimum >= 0 && maximum >= minimum) return {
        kind: match[3] ? 'published_variable_credit_range' : 'published_fixed_credits',
        notation: match[0],
        credit_hours_min: minimum,
        credit_hours_max: maximum,
        heading_text_sha256: sha256(field),
        structural_field: 'unique_detail-hours_html',
        structural_field_html_sha256: sha256(structured.first().html() || ''),
      };
    }
  }
  const first = normalizedEntryText(block.children().first().text());
  const heading = first || text.slice(0, 300);
  const match = /\b(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s+(credit(?:s| hours?)?|hours?)\b/i
    .exec(heading);
  if (match) {
    const minimum = Number(match[1]);
    const maximum = Number(match[2] || match[1]);
    if (minimum >= 0 && maximum >= minimum) return {
      kind: match[2] ? 'published_variable_credit_range' : 'published_fixed_credits',
      notation: match[0],
      credit_hours_min: minimum,
      credit_hours_max: maximum,
      heading_text_sha256: sha256(heading),
    };
  }
  const noCredit = /\bno credit\b/i.exec(heading);
  return noCredit ? {
    kind: 'published_no_credit',
    notation: noCredit[0],
    credit_hours_min: 0,
    credit_hours_max: 0,
    heading_text_sha256: sha256(heading),
  } : null;
}

function requisiteMarkerCounts(text) {
  const source = String(text || '');
  return {
    required: (source.match(
      /\b(?:required\s+)?pre-?requisite(?:s|\(s\)|s\(s\))?\s*:/gi,
    ) || []).length,
    corequisite: (source.match(
      /\b(?:pre-?\s+or\s+corequisite|co-?requisite|corequisite)(?:s|\(s\))?\s*:/gi,
    ) || []).length,
    marker_like: (source.match(/\b(?:pre-?|co-?)?requisites?\b/gi) || []).length,
    constraint_like: (source.match(
      /\b(?:require(?:d|ment|ments)|permission|consent|standing|placement|minimum\s+(?:score|grade)|concurrent|enroll(?:ed|ing|ment)?|admission|registration\s+restrictions?|recommended|must\s+be\s+(?:taken|passed|completed)|may\s+not\s+(?:take|be\s+taken|register|enroll|receive\s+credit)|cannot\s+(?:take|register|enroll|receive\s+credit)|may\s+receive\s+credit.{0,120}\bonly\s+one|not\s+applicable\s+for\s+credit|open\s+only\s+to|only\s+for\s+students|limited\s+to\s+students|(?:no\s+credit|credit)\s+(?:will\s+not\s+be\s+given|cannot\s+be\s+earned|may\s+not\s+be\s+earned|for\s+more\s+than\s+one)|(?:prior|working|some)\s+(?:knowledge|experience)|background\s+in|proficiency\s+in|competency\s+in|taken\s+in\s+conjunction|(?:advisor|adviser|instructor|department(?:al)?|faculty)\s+approval)\b/gi,
    ) || []).length + (source.match(
      /\bpre:\s*(?:junior|senior)\s+standing(?=Instructional)/gi,
    ) || []).length,
  };
}

function structuredCourseLeafRequisiteFields(block, rawEntryText, $) {
  const fields = [];
  const candidates = [];
  block.find('.detail-prereq, .detail-coreq').each((index, element) => {
    candidates.push({ element, structural_class: String($(element).attr('class') || '')
      .split(/\s+/).find((name) => /^detail-(?:prereq|coreq)$/.test(name)) });
  });
  // JMU's current CourseLeaf template puts the exact Prerequisites field in a
  // courseblockextra element rather than detail-prereq. Restrict this fallback
  // to an element whose normalized text begins with the formal marker.
  block.find('.courseblockextra').each((index, element) => {
    const field = $(element);
    const text = normalizedEntryText(field.text());
    if (/^Prerequisites?:\s*/i.test(text)) {
      candidates.push({ element, structural_class: 'courseblockextra' });
    }
  });
  for (const candidate of candidates) {
    const field = $(candidate.element);
    const rawFieldText = normalizedEntryText(field.text());
    const markerPattern = candidate.structural_class === 'courseblockextra'
      ? /\b(Prerequisite\(s\)|Prerequisites?|Corequisite\(s\)|Corequisites?):\s*/gi
      : /^(Prerequisite\(s\)|Prerequisites?|Corequisite\(s\)|Corequisites?):\s*/gi;
    const markers = [...rawFieldText.matchAll(markerPattern)];
    if (!markers.length || !candidate.structural_class) continue;
    const first = rawEntryText.indexOf(rawFieldText);
    if (first < 0 || rawEntryText.indexOf(rawFieldText, first + 1) >= 0) continue;
    markers.forEach((marker, index) => {
      const start = marker.index + marker[0].length;
      const end = markers[index + 1]?.index ?? rawFieldText.length;
      const region = rawFieldText.slice(start, end);
      const raw = region.trim();
      if (!raw) return;
      const rawStartInField = start + region.indexOf(raw);
      fields.push({
        receipt_contract: COURSELEAF_STRUCTURED_REQUISITE_FIELD_RECEIPT_CONTRACT,
        kind: /^Corequisite/i.test(marker[1]) ? 'corequisite' : 'prerequisite',
        label: marker[1],
        structural_class: candidate.structural_class,
        raw_field_text: rawFieldText,
        raw_field_text_sha256: sha256(rawFieldText),
        raw_field_html_sha256: sha256(field.html() || ''),
        field_relative_start: first,
        field_relative_end: first + rawFieldText.length,
        raw,
        raw_sha256: sha256(raw),
        relative_start: first + rawStartInField,
        relative_end: first + rawStartInField + raw.length,
        statement_relative_start: first + marker.index,
        statement_relative_end: first + rawStartInField + raw.length,
      });
    });
  }
  return fields;
}

function structuredCourseLeafRequisiteFieldsValid(row) {
  const fields = asArray(row?.structured_requisite_fields);
  const markers = requisiteMarkerCounts(row?.raw_entry_text);
  // DOM-to-text normalization can concatenate the preceding sentence and the
  // structured label (for example, `twice.Prerequisites:`). The structural
  // field is authoritative here; raw-text marker counts may therefore be
  // lower, but may never exceed the exact structured field population.
  if (fields.filter((field) => field.kind === 'prerequisite').length < markers.required
      || fields.filter((field) => field.kind === 'corequisite').length < markers.corequisite) {
    return false;
  }
  return fields.every((field) => {
    const expectedClass = row.slug === JMU_SLUG
      ? 'courseblockextra'
      : (field.kind === 'prerequisite' ? 'detail-prereq' : 'detail-coreq');
    const marker = `${field.label}:`;
    return field.receipt_contract
        === COURSELEAF_STRUCTURED_REQUISITE_FIELD_RECEIPT_CONTRACT
      && field.structural_class === expectedClass
      && (field.kind === 'prerequisite'
        ? /^(?:Prerequisite\(s\)|Prerequisites?)$/.test(field.label || '')
        : /^(?:Corequisite\(s\)|Corequisites?)$/.test(field.label || ''))
      && sha256(field.raw_field_text || '') === field.raw_field_text_sha256
      && /^[a-f0-9]{64}$/.test(field.raw_field_html_sha256 || '')
      && row.raw_entry_text.slice(field.field_relative_start, field.field_relative_end)
        === field.raw_field_text
      && sha256(field.raw || '') === field.raw_sha256
      && row.raw_entry_text.slice(field.relative_start, field.relative_end) === field.raw
      && row.raw_entry_text.slice(
        field.statement_relative_start,
        field.statement_relative_start + marker.length,
      ) === marker
      && field.statement_relative_start <= field.relative_start
      && field.statement_relative_end === field.relative_end
      && field.field_relative_start <= field.statement_relative_start
      && field.field_relative_end >= field.statement_relative_end;
  });
}

/**
 * CourseLeaf's courseblock element is an explicit vendor course-entry
 * boundary. We still require one unique block, an exact leading code, and a
 * published unit label. A loose code anywhere in prose is never accepted.
 */
function extractCourseLeafEntries(html, targetCodes = []) {
  const targets = new Set(asArray(targetCodes).map(normalizeCode).filter(Boolean));
  const $ = cheerio.load(String(html || ''));
  const byCode = new Map();
  const completeRows = [];
  $('.courseblock').each((index, element) => {
    const block = $(element);
    const rawEntryText = normalizedEntryText(block.text());
    const code = courseCodeAtEntryStart(rawEntryText);
    const publishedUnits = publishedUnitsReceipt(block, rawEntryText);
    if (!code || !publishedUnits || !headingHasPublishedUnits(block, rawEntryText)) return;
    const markers = requisiteMarkerCounts(rawEntryText);
    const complete = {
      course_code: code,
      courseblock_index: index,
      published_units: publishedUnits,
      requisite_marker_counts: markers,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(block.html() || ''),
      structured_requisite_fields: structuredCourseLeafRequisiteFields(block, rawEntryText, $),
    };
    completeRows.push(complete);
    if (!targets.has(code)) return;
    const rows = byCode.get(code) || [];
    rows.push(complete);
    byCode.set(code, rows);
  });
  const positiveControls = completeRows.filter((row) => (
    row.requisite_marker_counts.required > 0
  ));
  for (const rows of byCode.values()) {
    for (const row of rows) row.complete_entry_receipt = {
      receipt_contract: COURSELEAF_RECEIPT_CONTRACT,
      source_courseblock_count: $('.courseblock').length,
      source_complete_entry_count: completeRows.length,
      source_complete_entries_with_required_requisite_marker_count: positiveControls.length,
      entry_required_requisite_marker_count: row.requisite_marker_counts.required,
      entry_corequisite_marker_count: row.requisite_marker_counts.corequisite,
      entry_requisite_marker_like_count: row.requisite_marker_counts.marker_like,
      entry_constraint_like_signal_count: row.requisite_marker_counts.constraint_like,
      same_source_positive_control: positiveControls.some((control) => (
        control.courseblock_index !== row.courseblock_index
      )),
    };
  }
  const entries = [];
  const ambiguous = [];
  const missing = [];
  for (const code of [...targets].sort()) {
    const rows = byCode.get(code) || [];
    if (rows.length === 1) entries.push(rows[0]);
    else if (rows.length > 1) ambiguous.push({ course_code: code, matching_blocks: rows.length });
    else missing.push(code);
  }
  return {
    entries,
    ambiguous,
    missing,
    courseblock_count: $('.courseblock').length,
    complete_entry_count: completeRows.length,
    complete_entries_with_required_requisite_marker_count: positiveControls.length,
  };
}

function parseRobots(text, userAgent = USER_AGENT) {
  const groups = [];
  let group = null;
  let sawRule = false;
  for (const sourceLine of String(text || '').split(/\r?\n/)) {
    const line = sourceLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!group || sawRule) {
        group = { agents: [], rules: [], crawl_delay_seconds: null };
        groups.push(group);
        sawRule = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (field === 'allow' || field === 'disallow')) {
      group.rules.push({ kind: field, path: value });
      sawRule = true;
    } else if (group && field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) group.crawl_delay_seconds = seconds;
      sawRule = true;
    }
  }
  const agent = userAgent.toLowerCase();
  const specificity = (candidate) => candidate === '*' ? 0
    : (agent.includes(candidate) ? candidate.length : -1);
  const matched = groups.map((candidate) => ({
    candidate,
    score: Math.max(-1, ...candidate.agents.map(specificity)),
  })).filter((row) => row.score >= 0);
  if (!matched.length) return { usable: true, rules: [], crawl_delay_seconds: 0 };
  const best = Math.max(...matched.map((row) => row.score));
  const selected = matched.filter((row) => row.score === best).map((row) => row.candidate);
  return {
    usable: true,
    rules: selected.flatMap((row) => row.rules),
    crawl_delay_seconds: Math.max(0, ...selected.map((row) => row.crawl_delay_seconds || 0)),
  };
}

function robotsAllows(robots, pathname) {
  const matches = asArray(robots?.rules).filter((rule) => rule.path && pathname.startsWith(rule.path));
  if (!matches.length) return true;
  matches.sort((left, right) => right.path.length - left.path.length
    || (left.kind === 'allow' ? -1 : 1));
  return matches[0].kind === 'allow';
}

function acquisitionTargets({ scope, candidates, review, priorAcquisition = null }) {
  const directKeys = new Set();
  const scopedOwners = new Set(asArray(scope?.universities)
    .map((university) => university.owner_namespace));
  for (const university of asArray(scope?.universities)) {
    for (const code of requiredResidentPathCourseCodes(university)) {
      directKeys.add(`${university.owner_namespace}:${code}`);
    }
  }
  const candidateKeys = new Set(asArray(candidates?.candidates).map((row) => row.course_key));
  const directMissing = [...directKeys].filter((key) => !candidateKeys.has(key)).sort();
  const closureGaps = [
    ...asArray(review?.closure?.unresolved_unparsed_direct),
    ...asArray(review?.closure?.unresolved_unparsed_closure),
    ...asArray(review?.closure?.unresolved_missing_direct),
    ...asArray(review?.closure?.unresolved_outside_direct_scope),
  ].sort();
  const priorKeys = asArray(priorAcquisition?.entries).map((row) => row.course_key).filter(Boolean);
  const captureKeySet = new Set([
    ...directMissing,
    ...closureGaps.filter((key) => !candidateKeys.has(key)),
    ...priorKeys,
    ...scopedUnparsedCourseKeys(review),
    ...scopedGeorgeMasonUnparsedCourseKeys(review),
    ...oldDominionClosureCaptureKeys(scope),
    ...(scopedOwners.has('va:uni:9219')
      ? Object.keys(RADFORD_CLOSURE_COURSE_RECORDS)
        .map((code) => `va:uni:9219:${code}`) : []),
    ...(scopedOwners.has('va:uni:9226')
      ? Object.keys(UVA_WISE_CLOSURE_COURSE_RECORDS)
        .map((code) => `va:uni:9226:${code}`) : []),
  ]);
  // Bridgewater's retained department export has entry-like text boundaries,
  // but it omits the structured prerequisite/corequisite fields printed on
  // the first-party CleanCatalog course pages. Always prefer an exact course
  // page for every current direct Bridgewater target; prior acquisition rows
  // then make subsequent cache-only passes deterministic.
  for (const university of asArray(scope?.universities)) {
    if (university.slug !== BRIDGEWATER_SLUG) continue;
    for (const code of requiredResidentPathCourseCodes(university)) {
      captureKeySet.add(`${university.owner_namespace}:${code}`);
    }
  }
  const captureKeys = [...captureKeySet].sort();
  return { directKeys, candidateKeys, directMissing, closureGaps, priorKeys, captureKeys };
}

function buildAcquisitionPlan({ scope, candidates, review, priorAcquisition = null }) {
  const targets = acquisitionTargets({ scope, candidates, review, priorAcquisition });
  const byOwner = new Map(asArray(scope?.universities).map((row) => [row.owner_namespace, row]));
  const routes = [];
  const blocked = [];
  for (const [owner, university] of byOwner) {
    const keys = targets.captureKeys.filter((key) => key.startsWith(`${owner}:`));
    const codes = keys.map((key) => splitCourseKey(key)?.course_code).filter(Boolean);
    if (university.slug === BRIDGEWATER_SLUG) {
      const base = new URL(university.cached_course_catalog.official_url);
      if (base.hostname.toLowerCase() !== BRIDGEWATER_HOST) {
        if (codes.length) blocked.push({
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          target_course_codes: codes.sort(),
          target_count: codes.length,
          status: 'owner_specific_capture_required',
          reason: 'The declared Bridgewater course source is not on the pinned official CleanCatalog host.',
        });
        continue;
      }
      if (codes.length) routes.push({
        route_id: `${BRIDGEWATER_SLUG}__catalog_edition`,
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        platform: 'cleancatalog_edition',
        catalog_year: university.catalog_year,
        official_url: new URL(BRIDGEWATER_EDITION_PATH, base.origin).href,
        official_host: BRIDGEWATER_HOST,
        target_course_codes: [],
        target_count: 0,
        boundary_contract: 'bridgewater_exact_courses_of_instruction_year_statement_v1',
      });
      const unsupported = [];
      for (const code of codes.sort()) {
        const pathname = expectedBridgewaterCoursePath(code);
        if (!pathname) {
          unsupported.push(code);
          continue;
        }
        routes.push({
          route_id: `${BRIDGEWATER_SLUG}__${code.toLowerCase()}`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'cleancatalog_course',
          catalog_year: university.catalog_year,
          official_url: new URL(pathname, base.origin).href,
          official_host: BRIDGEWATER_HOST,
          target_course_codes: [code],
          target_count: 1,
          boundary_contract: BRIDGEWATER_BOUNDARY_CONTRACT,
        });
      }
      if (unsupported.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: unsupported,
        target_count: unsupported.length,
        status: 'owner_specific_capture_required',
        reason: 'No reviewed Bridgewater CleanCatalog department route exists for these course prefixes.',
      });
      continue;
    }
    if (university.slug === CNU_SLUG) {
      const exactCurrentTarget = codes.filter((code) => code === 'CPEN371W');
      const legacyPdfTargets = codes.filter((code) => code !== 'CPEN371W');
      if (exactCurrentTarget.length) routes.push({
        route_id: `${CNU_SLUG}__cpen371w_current_joint_evidence`,
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        platform: 'cnu_cpen371w_current_joint_evidence',
        catalog_year: CNU_CPEN371W_CATALOG_YEAR,
        official_url: CNU_CATALOG_URL,
        official_host: new URL(CNU_CATALOG_URL).hostname.toLowerCase(),
        program_official_url: CNU_PROGRAM_URL,
        cache_path: CNU_CPEN371W_SOURCE_CACHE_PATH,
        evidence_cache_path: CNU_CPEN371W_EVIDENCE_CACHE_PATH,
        evidence_artifact_sha256: CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256,
        expected_source_response_sha256: CNU_CATALOG_RESPONSE_SHA256,
        expected_program_response_sha256: CNU_PROGRAM_RESPONSE_SHA256,
        expected_robots_response_sha256: CNU_ROBOTS_RESPONSE_SHA256,
        expected_facts_sha256: CNU_CPEN371W_FACTS_SHA256,
        target_course_codes: exactCurrentTarget,
        target_count: exactCurrentTarget.length,
        boundary_contract: CNU_ALIAS_RECEIPT_CONTRACT,
        alias_scope: 'CPEN371W_only',
      });
      if (legacyPdfTargets.length) routes.push({
        route_id: `${CNU_SLUG}__official_pdf_bbox_columns`,
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        platform: 'pdf_bbox_columns',
        catalog_year: university.catalog_year,
        official_url: university.cached_course_catalog.official_url,
        official_host: new URL(university.cached_course_catalog.official_url).hostname.toLowerCase(),
        cache_path: CNU_PDF_CACHE_PATH,
        expected_pdf_sha256: CNU_EXPECTED_PDF_SHA256,
        expected_pdf_title: CNU_EXPECTED_PDF_TITLE,
        expected_page_count: CNU_EXPECTED_PAGE_COUNT,
        target_course_codes: legacyPdfTargets.sort(),
        target_count: legacyPdfTargets.length,
        boundary_contract: CNU_BOUNDARY_CONTRACT,
      });
      continue;
    }
    if (university.slug === LONGWOOD_SLUG) {
      const expectedDirect = [...LONGWOOD_DIRECT_CMSC_TARGETS];
      const expectedDeterministic = [...LONGWOOD_DETERMINISTIC_CMSC_TARGETS];
      const declaredCmsc = asArray(university.direct_named_course_codes)
        .filter((code) => /^CMSC/.test(code)).sort();
      const deterministicCmsc = asArray(
        university.deterministic_resident_path_course_codes,
      ).filter((code) => /^CMSC/.test(code)).sort();
      const context = university.cached_course_catalog || {};
      const contextVerified = university.catalog_year === LONGWOOD_CATALOG_CONTEXT_YEAR
        && context.official_url === LONGWOOD_CATALOG_CONTEXT_URL
        && context.declared_normalized_text_sha256 === LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
        && context.retained_normalized_text_sha256 === LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
        && context.byte_match === true
        && JSON.stringify(declaredCmsc) === JSON.stringify(expectedDirect)
        && JSON.stringify(deterministicCmsc) === JSON.stringify(expectedDeterministic);
      if (!contextVerified) {
        if (codes.length) blocked.push({
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          target_course_codes: codes.sort(),
          target_count: codes.length,
          status: 'owner_specific_capture_required',
          reason: 'The retained Longwood catoid 19 context, exact 14-course direct CMSC roster, or exact three-course deterministic resident-path prerequisite target set drifted.',
        });
        continue;
      }
      const selectedCmsc = new Set([...expectedDirect, ...expectedDeterministic]);
      const supportedDepartment = codes.filter((code) => selectedCmsc.has(code)).sort();
      const supportedBanner = codes
        .filter((code) => (
          /^(?:CTZN|ENGL|MATH)/.test(code)
          || LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS.includes(code)
          || LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS.includes(code)
        )).sort();
      const supportedCodes = new Set([...supportedDepartment, ...supportedBanner]);
      const unsupported = codes.filter((code) => !supportedCodes.has(code)).sort();
      if (supportedDepartment.length) routes.push({
        route_id: `${LONGWOOD_SLUG}__computer_science_course_listing`,
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        platform: 'longwood_department_course_listing',
        catalog_year: LONGWOOD_CATALOG_CONTEXT_YEAR,
        official_url: LONGWOOD_DEPARTMENT_URL,
        official_host: LONGWOOD_DEPARTMENT_HOST,
        target_course_codes: supportedDepartment,
        target_count: supportedDepartment.length,
        boundary_contract: LONGWOOD_BOUNDARY_CONTRACT,
        catalog_context_contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
        catalog_context_official_url: LONGWOOD_CATALOG_CONTEXT_URL,
        catalog_context_html_cache_path: LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH,
        catalog_context_text_cache_path: LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH,
        catalog_context_text_sha256: LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
        catalog_context_catoid: LONGWOOD_CATALOG_CONTEXT_CATOID,
        two_source_edition_boundary: LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
        department_page_catalog_year_statement: null,
      });
      if (supportedBanner.length) routes.push({
        route_id: `${LONGWOOD_SLUG}__courses_from_banner`,
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        platform: 'longwood_banner_course_listing',
        catalog_year: LONGWOOD_CATALOG_CONTEXT_YEAR,
        official_url: LONGWOOD_BANNER_URL,
        official_host: LONGWOOD_BANNER_HOST,
        target_course_codes: supportedBanner,
        target_count: supportedBanner.length,
        boundary_contract: LONGWOOD_BANNER_BOUNDARY_CONTRACT,
        catalog_context_contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
        catalog_context_official_url: LONGWOOD_CATALOG_CONTEXT_URL,
        catalog_context_html_cache_path: LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH,
        catalog_context_text_cache_path: LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH,
        catalog_context_text_sha256: LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
        catalog_context_catoid: LONGWOOD_CATALOG_CONTEXT_CATOID,
        two_source_edition_boundary: LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
        department_page_catalog_year_statement: null,
      });
      if (unsupported.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: unsupported,
        target_count: unsupported.length,
        status: 'owner_specific_capture_required',
        reason: 'The reviewed Longwood adapters cover the 14 direct CMSC entries, three exact deterministic resident-path CMSC entries, CTZN/ENGL/MATH entries, and the exact PSYC335/RELI301/SPAN320 resident Perspective targets on the first-party Banner listing; other owner-prefix courses remain capture gaps.',
      });
      continue;
    }
    if (university.slug === RADFORD_SLUG) {
      const directCodes = asArray(university.direct_named_course_codes).sort();
      const expectedCodes = Object.keys(RADFORD_DIRECT_COURSE_RECORDS).sort();
      const source = university.cached_course_catalog || {};
      const contextVerified = university.catalog_year === RADFORD_CATALOG_YEAR
        && source.official_url === `https://${RADFORD_HOST}/content.php?catoid=${RADFORD_CATOID}&navoid=3427`
        && source.byte_match === true
        && JSON.stringify(directCodes) === JSON.stringify(expectedCodes);
      if (!contextVerified) {
        if (codes.length) blocked.push({
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          target_course_codes: codes.sort(),
          target_count: codes.length,
          status: 'owner_specific_capture_required',
          reason: 'The retained Radford catoid 62 context or exact 15-course direct roster drifted.',
        });
        continue;
      }
      const unsupported = [];
      for (const code of codes.sort()) {
        const record = RADFORD_COURSE_RECORDS[code];
        if (!record) {
          unsupported.push(code);
          continue;
        }
        routes.push({
          route_id: `${RADFORD_SLUG}__${code.toLowerCase()}`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'radford_acalog_course',
          catalog_year: RADFORD_CATALOG_YEAR,
          official_url: expectedRadfordCourseUrl(code),
          official_host: RADFORD_HOST,
          target_course_codes: [code],
          target_count: 1,
          boundary_contract: RADFORD_BOUNDARY_CONTRACT,
          catoid: RADFORD_CATOID,
          coid: record.coid,
          expected_title: record.title,
          discovery_contract: RADFORD_CLOSURE_COURSE_RECORDS[code]
            ? RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT : RADFORD_DISCOVERY_CONTRACT,
          discovery_cache_path: record.discovery_cache_path || RADFORD_PROGRAM_CACHE_PATH,
          discovery_response_sha256:
            record.discovery_response_sha256 || RADFORD_PROGRAM_HTML_SHA256,
          discovery_course_code: record.discovery_course_code || null,
          required_crawl_delay_seconds: 120,
        });
      }
      if (unsupported.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: unsupported,
        target_count: unsupported.length,
        status: 'owner_specific_capture_required',
        reason: 'No pinned current-program or retained-entry catoid/coid identity exists for these Radford courses.',
      });
      continue;
    }
    if (university.slug === UVA_WISE_SLUG) {
      const directCodes = asArray(university.direct_named_course_codes).sort();
      const expectedCodes = Object.keys(UVA_WISE_DIRECT_COURSE_RECORDS).sort();
      const source = university.cached_course_catalog || {};
      const sourceUrl = new URL(source.official_url);
      const contextVerified = university.catalog_year === UVA_WISE_CATALOG_YEAR
        && sourceUrl.protocol === 'http:'
        && sourceUrl.hostname.toLowerCase() === UVA_WISE_HOST
        && Number(sourceUrl.searchParams.get('catoid')) === UVA_WISE_CATOID
        && source.byte_match === true
        && JSON.stringify(directCodes) === JSON.stringify(expectedCodes);
      if (!contextVerified) {
        if (codes.length) blocked.push({
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          target_course_codes: codes.sort(),
          target_count: codes.length,
          status: 'owner_specific_capture_required',
          reason: 'The retained UVA Wise catoid 9 context or exact 31-course direct roster drifted.',
        });
        continue;
      }
      const unsupported = [];
      for (const code of codes.sort()) {
        const record = UVA_WISE_COURSE_RECORDS[code];
        if (!record) {
          unsupported.push(code);
          continue;
        }
        routes.push({
          route_id: `${UVA_WISE_SLUG}__${code.toLowerCase()}`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'uva_wise_acalog_course',
          catalog_year: UVA_WISE_CATALOG_YEAR,
          official_url: expectedUvaWiseCourseUrl(code),
          official_host: UVA_WISE_HOST,
          transport_protocol: 'http:',
          target_course_codes: [code],
          target_count: 1,
          boundary_contract: UVA_WISE_BOUNDARY_CONTRACT,
          catoid: UVA_WISE_CATOID,
          coid: record.coid,
          expected_title: record.title,
          discovery_contract: UVA_WISE_CLOSURE_COURSE_RECORDS[code]
            ? UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT : UVA_WISE_DISCOVERY_CONTRACT,
          ...(UVA_WISE_CLOSURE_COURSE_RECORDS[code] ? {
            discovery_cache_path: record.discovery_cache_path,
            discovery_response_sha256: record.discovery_response_sha256,
            discovery_course_code: record.discovery_course_code,
          } : {
            discovery_program_cache_path: UVA_WISE_PROGRAM_CACHE_PATH,
            discovery_program_response_sha256: UVA_WISE_PROGRAM_HTML_SHA256,
            discovery_ge_cache_path: UVA_WISE_GE_CACHE_PATH,
            discovery_ge_response_sha256: UVA_WISE_GE_HTML_SHA256,
          }),
          required_crawl_delay_seconds: UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
          http_exception_contract:
            'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1',
        });
      }
      if (unsupported.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: unsupported,
        target_count: unsupported.length,
        status: 'owner_specific_capture_required',
        reason: 'No pinned current-program or retained-entry catoid/coid identity exists for these UVA Wise courses.',
      });
      continue;
    }
    if (university.slug === SHENANDOAH_SLUG) {
      const source = university.cached_course_catalog || {};
      let sourceUrl = null;
      try { sourceUrl = new URL(source.official_url); } catch { /* checked below */ }
      const contextVerified = university.catalog_year === SHENANDOAH_CATALOG_YEAR
        && sourceUrl?.protocol === 'https:'
        && sourceUrl?.hostname.toLowerCase() === SHENANDOAH_HOST
        && sourceUrl?.pathname === '/content.php'
        && Number(sourceUrl.searchParams.get('catoid')) === SHENANDOAH_CATOID
        && source.byte_match === true;
      if (!contextVerified) {
        if (codes.length) blocked.push({
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          target_course_codes: codes.sort(),
          target_count: codes.length,
          status: 'owner_specific_capture_required',
          reason: 'The retained Shenandoah 2025-2026 catoid 33 context drifted.',
        });
        continue;
      }
      const unsupported = [];
      for (const code of codes.sort()) {
        const record = SHENANDOAH_DIRECT_COURSE_RECORDS[code];
        if (!record) {
          unsupported.push(code);
          continue;
        }
        routes.push({
          route_id: `${SHENANDOAH_SLUG}__${code.toLowerCase()}`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'shenandoah_acalog_course',
          catalog_year: SHENANDOAH_CATALOG_YEAR,
          official_url: expectedShenandoahCourseUrl(code),
          official_host: SHENANDOAH_HOST,
          target_course_codes: [code],
          target_count: 1,
          boundary_contract: SHENANDOAH_BOUNDARY_CONTRACT,
          catoid: SHENANDOAH_CATOID,
          coid: record.coid,
          expected_title: record.title,
          discovery_contract:
            record.discovery_contract || SHENANDOAH_DISCOVERY_CONTRACT,
          discovery_cache_path:
            record.discovery_cache_path || SHENANDOAH_PROGRAM_CACHE_PATH,
          discovery_response_sha256:
            record.discovery_response_sha256 || SHENANDOAH_PROGRAM_HTML_SHA256,
          discovery_official_url: record.discovery_contract
            === SHENANDOAH_FILTER_DISCOVERY_CONTRACT
            ? expectedShenandoahFilterDiscoveryUrl(code) : null,
          required_crawl_delay_seconds: SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
        });
      }
      if (unsupported.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: unsupported,
        target_count: unsupported.length,
        status: 'owner_specific_capture_required',
        reason: 'The retained current Shenandoah program page does not expose an exact catoid 33 course identity for these courses; obsolete catoid 11 course-map links are not accepted.',
      });
      continue;
    }
    if (university.slug === JMU_SLUG) {
      const base = new URL(university.cached_course_catalog.official_url);
      const contextVerified = university.catalog_year === JMU_CATALOG_YEAR
        && base.protocol === 'https:'
        && base.hostname.toLowerCase() === JMU_HOST
        && base.pathname === '/courses/';
      if (!contextVerified) {
        if (codes.length) blocked.push({
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          target_course_codes: codes.sort(),
          target_count: codes.length,
          status: 'owner_specific_capture_required',
          reason: 'The JMU catalog year or exact official CourseLeaf course-index identity drifted.',
        });
        continue;
      }
      const supported = new Set();
      for (const [prefix, pathname] of Object.entries(JMU_COURSELEAF_SUBJECT_ROUTES)) {
        const prefixCodes = codes.filter((code) => coursePrefix(code) === prefix).sort();
        if (!prefixCodes.length) continue;
        prefixCodes.forEach((code) => supported.add(code));
        routes.push({
          route_id: `${university.slug}__${prefix.toLowerCase()}`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'browser_challenge_courseleaf',
          catalog_year: university.catalog_year,
          official_url: `https://${JMU_HOST}${pathname}`,
          official_host: JMU_HOST,
          target_subject_prefix: prefix,
          target_course_codes: prefixCodes,
          target_count: prefixCodes.length,
          boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
          browser_challenge_contract: BROWSER_CHALLENGE_CONTRACT,
          robots_contract: BROWSER_ROBOTS_CONTRACT,
        });
      }
      const unsupported = codes.filter((code) => !supported.has(code)).sort();
      if (unsupported.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: unsupported,
        target_count: unsupported.length,
        status: 'owner_specific_capture_required',
        reason: 'No reviewed exact JMU CourseLeaf subject route exists for these prefixes.',
      });
      continue;
    }
    if (university.slug === VIRGINIA_TECH_SLUG) {
      const base = new URL(university.cached_course_catalog.official_url);
      if (university.catalog_year !== VIRGINIA_TECH_CATALOG_YEAR
          || base.protocol !== 'https:'
          || base.hostname.toLowerCase() !== VIRGINIA_TECH_HOST
          || base.pathname !== '/course-search/') {
        if (codes.length) blocked.push({
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          target_course_codes: codes.sort(),
          target_count: codes.length,
          status: 'owner_specific_capture_required',
          reason: 'The retained Virginia Tech catalog year or official catalog host drifted from the pinned CS subject source.',
        });
        continue;
      }
      const supported = new Set();
      const exactGraduateCsTargets = codes.filter((code) => (
        VIRGINIA_TECH_GRADUATE_CS_TARGETS.includes(code)
      )).sort();
      const genericCodes = codes.filter((code) => (
        !VIRGINIA_TECH_GRADUATE_CS_TARGETS.includes(code)
      ));
      if (exactGraduateCsTargets.length) {
        exactGraduateCsTargets.forEach((code) => supported.add(code));
        routes.push({
          route_id: `${VIRGINIA_TECH_SLUG}__graduate_cs_current_department_evidence`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'virginia_tech_graduate_cs_current_department_evidence',
          catalog_year: university.catalog_year,
          official_url: VIRGINIA_TECH_GRADUATE_CS_URL,
          official_host: new URL(VIRGINIA_TECH_GRADUATE_CS_URL).hostname.toLowerCase(),
          robots_official_url: VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
          cache_path: VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH,
          evidence_cache_path: VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH,
          evidence_artifact_sha256:
            VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256,
          expected_source_response_sha256:
            VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256,
          expected_robots_response_sha256:
            VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256,
          expected_facts_sha256: VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256,
          source_current_contract: VIRGINIA_TECH_GRADUATE_CS_CURRENT_SOURCE_CONTRACT,
          source_effective_pubdate: '2026-07-01T12:54:08Z',
          source_captured_on: '2026-08-25',
          source_catalog_edition_claimed: false,
          target_course_codes: exactGraduateCsTargets,
          target_count: exactGraduateCsTargets.length,
          boundary_contract: VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
        });
      }
      const closureFallbackKeys = new Set(targets.closureGaps.filter((key) => (
        key.startsWith(`${owner}:`) && !targets.candidateKeys.has(key)
      )));
      for (const capture of asArray(priorAcquisition?.captures)) {
        if (capture.slug !== VIRGINIA_TECH_SLUG
            || capture.platform !== 'browser_challenge_courseleaf') continue;
        let capturePath = null;
        try { capturePath = new URL(capture.official_url).pathname; } catch { /* ignored */ }
        const expectedFallback = VIRGINIA_TECH_COURSE_DESCRIPTION_SUBJECT_ROUTES[
          capture.target_subject_prefix
        ];
        if (capturePath !== expectedFallback) continue;
        for (const code of asArray(capture.target_course_codes)) {
          closureFallbackKeys.add(`${owner}:${code}`);
        }
      }
      const fallbackCodes = new Set(codes.filter((code) => (
        closureFallbackKeys.has(`${owner}:${code}`)
        && VIRGINIA_TECH_COURSE_DESCRIPTION_SUBJECT_ROUTES[coursePrefix(code)]
      )));
      for (const [prefix, pathname] of Object.entries(VIRGINIA_TECH_BULK_SUBJECT_ROUTES)) {
        const prefixCodes = genericCodes.filter((code) => coursePrefix(code) === prefix).sort();
        if (!prefixCodes.length) continue;
        prefixCodes.forEach((code) => supported.add(code));
        routes.push({
          route_id: `${university.slug}__${prefix.toLowerCase()}_department`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'retained_courseleaf_source',
          catalog_year: university.catalog_year,
          official_url: new URL(pathname, base.origin).href,
          official_host: base.hostname.toLowerCase(),
          target_course_codes: prefixCodes,
          target_count: prefixCodes.length,
          boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
          discovery_contract: 'official_department_page_complete_subject_courseblocks_v1',
          retained_source_contract: VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT,
          retained_html_cache_path: VIRGINIA_TECH_CS_HTML_CACHE_PATH,
          retained_html_sha256: VIRGINIA_TECH_CS_HTML_SHA256,
          retained_text_cache_path: VIRGINIA_TECH_CS_TEXT_CACHE_PATH,
          retained_text_sha256: VIRGINIA_TECH_CS_TEXT_SHA256,
        });
      }
      const browserPrefixes = Object.entries(VIRGINIA_TECH_COURSELEAF_SUBJECT_ROUTES)
        .filter(([prefix]) => genericCodes.some((code) => (
          coursePrefix(code) === prefix && !fallbackCodes.has(code)
        )));
      const closurePrefixes = Object.entries(VIRGINIA_TECH_COURSE_DESCRIPTION_SUBJECT_ROUTES)
        .filter(([prefix]) => genericCodes.some((code) => (
          coursePrefix(code) === prefix && fallbackCodes.has(code)
        )));
      const sitemapPrefixes = [...browserPrefixes, ...closurePrefixes];
      if (sitemapPrefixes.length) routes.push({
        route_id: `${university.slug}__official_sitemap`,
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        platform: 'browser_challenge_sitemap',
        catalog_year: university.catalog_year,
        official_url: VIRGINIA_TECH_SITEMAP_URL,
        official_host: VIRGINIA_TECH_HOST,
        cache_extension: 'xml',
        target_course_codes: [],
        target_count: 0,
        expected_discovered_paths: [...new Set(
          sitemapPrefixes.map(([, pathname]) => pathname),
        )].sort(),
        discovery_contract: VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
        browser_challenge_contract: BROWSER_CHALLENGE_CONTRACT,
        robots_contract: BROWSER_ROBOTS_CONTRACT,
      });
      for (const [prefix, pathname] of browserPrefixes) {
        const prefixCodes = genericCodes.filter((code) => (
          coursePrefix(code) === prefix && !fallbackCodes.has(code)
        )).sort();
        prefixCodes.forEach((code) => supported.add(code));
        routes.push({
          route_id: `${university.slug}__${prefix.toLowerCase()}_department`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'browser_challenge_courseleaf',
          catalog_year: university.catalog_year,
          official_url: `https://${VIRGINIA_TECH_HOST}${pathname}`,
          official_host: VIRGINIA_TECH_HOST,
          target_subject_prefix: prefix,
          target_course_codes: prefixCodes,
          target_count: prefixCodes.length,
          boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
          discovery_contract: VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
          discovery_url: VIRGINIA_TECH_SITEMAP_URL,
          browser_challenge_contract: BROWSER_CHALLENGE_CONTRACT,
          robots_contract: BROWSER_ROBOTS_CONTRACT,
        });
      }
      for (const [prefix, pathname] of closurePrefixes) {
        const prefixCodes = genericCodes.filter((code) => (
          coursePrefix(code) === prefix && fallbackCodes.has(code)
        )).sort();
        prefixCodes.forEach((code) => supported.add(code));
        routes.push({
          route_id: `${university.slug}__${prefix.toLowerCase()}_course_descriptions`,
          school_id: university.school_id,
          slug: university.slug,
          owner_namespace: owner,
          platform: 'browser_challenge_courseleaf',
          catalog_year: university.catalog_year,
          official_url: `https://${VIRGINIA_TECH_HOST}${pathname}`,
          official_host: VIRGINIA_TECH_HOST,
          target_subject_prefix: prefix,
          target_course_codes: prefixCodes,
          target_count: prefixCodes.length,
          boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
          discovery_contract: VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
          discovery_url: VIRGINIA_TECH_SITEMAP_URL,
          browser_challenge_contract: BROWSER_CHALLENGE_CONTRACT,
          robots_contract: BROWSER_ROBOTS_CONTRACT,
          recursive_closure_only: true,
        });
      }
      const unsupported = codes.filter((code) => !supported.has(code)).sort();
      if (unsupported.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: unsupported,
        target_count: unsupported.length,
        status: 'owner_specific_capture_required',
        reason: 'No exact current Virginia Tech sitemap-discovered department route is pinned for these course prefixes.',
      });
      continue;
    }
    const exactVsuArabicTargets = university.slug === VSU_SLUG
      ? codes.filter((code) => VSU_ARABIC_TARGETS.includes(code)).sort()
      : [];
    const genericCodes = university.slug === VSU_SLUG
      ? codes.filter((code) => !VSU_ARABIC_TARGETS.includes(code))
      : codes;
    if (exactVsuArabicTargets.length) routes.push({
      route_id: `${VSU_SLUG}__arabic_current_department_evidence`,
      school_id: university.school_id,
      slug: university.slug,
      owner_namespace: owner,
      platform: 'vsu_arabic_current_department_evidence',
      catalog_year: VSU_ARABIC_CATALOG_YEAR,
      official_url: VSU_DEPARTMENT_URL,
      official_host: new URL(VSU_DEPARTMENT_URL).hostname.toLowerCase(),
      cache_path: VSU_ARABIC_SOURCE_CACHE_PATH,
      evidence_cache_path: VSU_ARABIC_EVIDENCE_CACHE_PATH,
      evidence_artifact_sha256: VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256,
      expected_source_response_sha256: VSU_DEPARTMENT_RESPONSE_SHA256,
      expected_robots_response_sha256: VSU_ROBOTS_RESPONSE_SHA256,
      expected_facts_sha256: VSU_ARABIC_FACTS_SHA256,
      target_course_codes: exactVsuArabicTargets,
      target_count: exactVsuArabicTargets.length,
      boundary_contract: VSU_ARABIC_BOUNDARY_CONTRACT,
    });
    const template = COURSELEAF_ROUTES[university.slug];
    if (!template) {
      if (genericCodes.length) blocked.push({
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        target_course_codes: genericCodes,
        target_count: genericCodes.length,
        status: 'owner_specific_capture_required',
        reason: OWNER_BLOCKERS[university.slug] || 'No tested official complete-entry route is available.',
      });
      continue;
    }
    const base = new URL(university.cached_course_catalog.official_url);
    const byPrefix = new Map();
    for (const code of genericCodes) {
      const prefix = coursePrefix(code);
      const values = byPrefix.get(prefix) || [];
      values.push(code);
      byPrefix.set(prefix, values);
    }
    for (const [prefix, prefixCodes] of [...byPrefix].sort()) {
      const pathname = template.replace('<prefix>', prefix.toLowerCase());
      routes.push({
        route_id: `${university.slug}__${prefix.toLowerCase()}`,
        school_id: university.school_id,
        slug: university.slug,
        owner_namespace: owner,
        platform: 'courseleaf',
        catalog_year: university.catalog_year,
        official_url: new URL(pathname, base.origin).href,
        official_host: base.hostname.toLowerCase(),
        target_course_codes: prefixCodes.sort(),
        target_count: prefixCodes.length,
        boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
      });
    }
  }
  return {
    schema_version: 1,
    artifact: `${ARTIFACT}_plan`,
    snapshot_date: scope.snapshot_date,
    publication_ready: false,
    summary: {
      direct_courses_without_bounded_candidate: targets.directMissing.length,
      prior_recursive_closure_gaps: targets.closureGaps.length,
      unique_capture_keys: targets.captureKeys.length,
      tested_courseleaf_routes: routes.filter((row) => row.platform === 'courseleaf').length,
      tested_browser_challenge_courseleaf_routes:
        routes.filter((row) => row.platform === 'browser_challenge_courseleaf').length,
      tested_browser_challenge_sitemap_routes:
        routes.filter((row) => row.platform === 'browser_challenge_sitemap').length,
      tested_cleancatalog_course_routes:
        routes.filter((row) => row.platform === 'cleancatalog_course').length,
      tested_cleancatalog_edition_routes:
        routes.filter((row) => row.platform === 'cleancatalog_edition').length,
      tested_pdf_routes: routes.filter((row) => row.platform === 'pdf_bbox_columns').length,
      tested_cnu_cpen371w_current_evidence_routes:
        routes.filter((row) => row.platform === 'cnu_cpen371w_current_joint_evidence').length,
      tested_vsu_arabic_current_evidence_routes:
        routes.filter((row) => row.platform === 'vsu_arabic_current_department_evidence').length,
      tested_longwood_department_routes:
        routes.filter((row) => row.platform === 'longwood_department_course_listing').length,
      tested_longwood_banner_routes:
        routes.filter((row) => row.platform === 'longwood_banner_course_listing').length,
      tested_radford_acalog_course_routes:
        routes.filter((row) => row.platform === 'radford_acalog_course').length,
      tested_retained_courseleaf_routes:
        routes.filter((row) => row.platform === 'retained_courseleaf_source').length,
      tested_uva_wise_acalog_course_routes:
        routes.filter((row) => row.platform === 'uva_wise_acalog_course').length,
      tested_shenandoah_acalog_course_routes:
        routes.filter((row) => row.platform === 'shenandoah_acalog_course').length,
      route_target_keys: routes.reduce((total, row) => total + row.target_count, 0),
      owner_specific_blocked_keys: blocked.reduce((total, row) => total + row.target_count, 0),
    },
    routes,
    blocked,
  };
}

function responseCachePath(route, extension = route.cache_extension || 'html') {
  return path.posix.join('university-prerequisites', 'raw', route.slug, `${route.route_id}.${extension}`);
}

function validateAcquisitionArtifact(artifact, { plan } = {}) {
  const issues = [];
  if (artifact?.schema_version !== 1) issues.push('schema_version');
  if (artifact?.artifact !== ARTIFACT) issues.push('artifact');
  if (artifact?.publication_ready !== false) issues.push('publication_ready');
  const entries = asArray(artifact?.entries);
  const keys = new Set();
  for (const row of entries) {
    if (keys.has(row.course_key)) issues.push(`${row.course_key}:duplicate`);
    keys.add(row.course_key);
    if (row.capture_status !== 'exact_entry_candidate_review_required') issues.push(`${row.course_key}:status`);
    if (row.publication_ready !== false || row.no_prerequisite_inference !== true) issues.push(`${row.course_key}:boundary`);
    const exactCurrentPageWithoutEdition = row.boundary_contract
      === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT
      && row.catalog_year_verified === null
      && row.catalog_edition_claimed === false;
    if (!exactCurrentPageWithoutEdition
        && !/^20\d{2}-20\d{2}$/.test(row.catalog_year_verified || '')) {
      issues.push(`${row.course_key}:catalog_year`);
    }
    if (sha256(row.raw_entry_text) !== row.raw_entry_sha256) issues.push(`${row.course_key}:entry_hash`);
    const exactUvaWiseHttp = row.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT
      && /^http:\/\//.test(row.official_url || '');
    if (!/^https:\/\//.test(row.official_url || '') && !exactUvaWiseHttp) {
      issues.push(`${row.course_key}:official_url`);
    }
    if (!/^[a-f0-9]{64}$/.test(row.source_response_sha256 || '')) issues.push(`${row.course_key}:response_hash`);
    if (row.browser_challenge_contract) {
      const expectedPaths = expectedBrowserCoursePaths(row.slug, row.target_subject_prefix);
      const documentReceipt = validateBrowserChallengeReceipt(row.browser_challenge_receipt, {
        expectedUrl: row.official_url,
        expectedFinalContentType: 'text/html',
        expectedFinalSha256: row.source_response_sha256,
      });
      const robotsReceipt = validateBrowserRobotsReceipt(row.robots_receipt, {
        origin: new URL(row.official_url).origin,
        checkedPath: new URL(row.official_url).pathname,
      });
      if (row.browser_challenge_contract !== BROWSER_CHALLENGE_CONTRACT
          || !documentReceipt.valid || !robotsReceipt.valid
          || coursePrefix(row.course_code) !== row.target_subject_prefix
          || !expectedPaths.includes(new URL(row.official_url).pathname)
          || !exactKnownBrowserResource({
            slug: row.slug,
            platform: 'browser_challenge_courseleaf',
            officialUrl: row.official_url,
            targetSubjectPrefix: row.target_subject_prefix,
          })) issues.push(`${row.course_key}:browser_challenge_receipt`);
      if (row.slug === JMU_SLUG && (
        row.published_units?.structural_field !== 'unique_detail-hours_html'
        || !/^[a-f0-9]{64}$/.test(
          row.published_units?.structural_field_html_sha256 || '',
        )
      )) issues.push(`${row.course_key}:jmu_structured_units_receipt`);
      if (row.slug === VIRGINIA_TECH_SLUG) {
        const discovery = row.sitemap_discovery_receipt;
        if (discovery?.discovery_contract !== VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT
            || discovery?.official_url !== VIRGINIA_TECH_SITEMAP_URL
            || !/^[a-f0-9]{64}$/.test(discovery?.source_response_sha256 || '')
            || !Number.isInteger(discovery?.location_count)
            || discovery.location_count < 1
            || !/^[a-f0-9]{64}$/.test(discovery?.locations_sha256 || '')
            || discovery?.discovered_course_url !== row.official_url
            || discovery?.path_discovered !== true) {
          issues.push(`${row.course_key}:virginia_tech_sitemap_receipt`);
        }
      } else if (row.sitemap_discovery_receipt !== null
          && row.sitemap_discovery_receipt !== undefined) {
        issues.push(`${row.course_key}:unexpected_sitemap_receipt`);
      }
    }
    if ([CNU_BOUNDARY_CONTRACT, CNU_COMPOUND_BOUNDARY_CONTRACT]
      .includes(row.boundary_contract)) {
      if (row.pdf_sha256 !== row.source_response_sha256
          || row.pdf_sha256 !== CNU_EXPECTED_PDF_SHA256) issues.push(`${row.course_key}:pdf_hash`);
      if (!/^[a-f0-9]{64}$/.test(row.bbox_layout_sha256 || '')) issues.push(`${row.course_key}:bbox_hash`);
      if (!Number.isInteger(row.pdf_page_start) || !Number.isInteger(row.pdf_page_end)
          || row.pdf_page_start < 1 || row.pdf_page_end < row.pdf_page_start
          || row.pdf_page_end > CNU_EXPECTED_PAGE_COUNT) issues.push(`${row.course_key}:pdf_pages`);
      const blocks = asArray(row.source_blocks);
      if (!blocks.length
          || blocks.some((block) => !['left', 'right'].includes(block.column))) {
        issues.push(`${row.course_key}:pdf_blocks`);
      }
      const expectedSpan = [...new Set(blocks.map((block) => `${block.pdf_page}:${block.column}`))];
      if (JSON.stringify(row.page_column_span) !== JSON.stringify(expectedSpan)
          || blocks.some((block) => {
            const box = block.bbox_points || {};
            const geometry = CNU_COLUMN_GEOMETRY[block.column] || {};
            return !Number.isInteger(block.pdf_page)
              || block.pdf_page < row.pdf_page_start
              || block.pdf_page > row.pdf_page_end
              || !Number.isInteger(block.page_block_index)
              || !['x_min', 'x_max', 'y_min', 'y_max'].every((key) => Number.isFinite(box[key]))
              || box.x_min < geometry.x_min_inclusive
              || box.x_max > geometry.x_max_inclusive
              || box.y_min < CNU_COLUMN_GEOMETRY.content_y_min_inclusive
              || box.y_max > CNU_COLUMN_GEOMETRY.content_y_max_inclusive
              || !/^[a-f0-9]{64}$/.test(block.raw_text_sha256 || '');
          })) {
        issues.push(`${row.course_key}:pdf_geometry`);
      }
      if (!row.published_units || !(row.published_units.credit_hours_min >= 0)
          || row.published_units.credit_hours_max < row.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:published_units`);
      }
      if (row.boundary_contract === CNU_COMPOUND_BOUNDARY_CONTRACT) {
        const expected = CNU_PINNED_COMPOUND_RECEIPTS.find((receipt) => (
          receipt.heading_text === row.heading_text
        ));
        const requisites = [
          row.compound_member_requisite,
          ...asArray(row.compound_sibling_requisites),
        ].filter(Boolean);
        const orderedRequisites = asArray(row.compound_heading_course_codes).map((code) => (
          requisites.find((receipt) => receipt.course_code === code)
        ));
        const reconstructed = {
          receipt_contract: row.compound_receipt_contract,
          heading_text: row.heading_text,
          compound_course_codes: row.compound_heading_course_codes,
          raw_entry_sha256: row.raw_entry_sha256,
          pdf_page_start: row.pdf_page_start,
          pdf_page_end: row.pdf_page_end,
          page_column_span: row.page_column_span,
          member_requisites: orderedRequisites,
        };
        const expectedMemberClausesMatch = expected
          && orderedRequisites.every((receipt) => {
            const expectedClause = expected.member_clauses[receipt?.course_code];
            return expectedClause
              && receipt.kind === 'prerequisite'
              && receipt.label === expectedClause.label
              && receipt.raw_normalized === expectedClause.raw_normalized
              && receipt.concurrent_allowed === expectedClause.concurrent_allowed;
          });
        if (row.compound_entry !== true
            || row.compound_receipt_contract !== CNU_COMPOUND_RECEIPT_CONTRACT
            || !expected
            || row.raw_entry_sha256 !== expected?.raw_entry_sha256
            || row.pdf_page_start !== expected?.pdf_page_start
            || row.pdf_page_end !== expected?.pdf_page_end
            || JSON.stringify(row.page_column_span)
              !== JSON.stringify(expected?.page_column_span)
            || JSON.stringify(row.compound_heading_course_codes)
              !== JSON.stringify(expected?.compound_course_codes)
            || !asArray(row.compound_heading_course_codes).includes(row.course_code)
            || row.compound_member_requisite?.course_code !== row.course_code
            || orderedRequisites.some((receipt) => !receipt)
            || !expectedMemberClausesMatch
            || sha256(JSON.stringify(reconstructed)) !== row.compound_receipt_sha256) {
          issues.push(`${row.course_key}:compound_receipt`);
        }
        if (requisites.some((receipt) => (
          sha256(receipt.raw) !== receipt.raw_sha256
          || row.raw_entry_text.slice(receipt.relative_start, receipt.relative_end)
            !== receipt.raw
          || sha256(receipt.statement_raw) !== receipt.statement_sha256
          || row.raw_entry_text.slice(
            receipt.statement_relative_start, receipt.statement_relative_end,
          ) !== receipt.statement_raw
        ))) {
          issues.push(`${row.course_key}:compound_member_offsets`);
        }
      }
    }
    if (row.boundary_contract === COURSELEAF_BOUNDARY_CONTRACT) {
      const receipt = row.complete_entry_receipt;
      const markers = requisiteMarkerCounts(row.raw_entry_text);
      if (!Number.isInteger(row.courseblock_index) || row.courseblock_index < 0
          || !/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
          || !row.published_units
          || !(row.published_units.credit_hours_min >= 0)
          || row.published_units.credit_hours_max < row.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:courseleaf_entry_receipt`);
      }
      if (receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
          || !Number.isInteger(receipt.source_courseblock_count)
          || !Number.isInteger(receipt.source_complete_entry_count)
          || !Number.isInteger(
            receipt.source_complete_entries_with_required_requisite_marker_count,
          )
          || receipt.source_courseblock_count < receipt.source_complete_entry_count
          || receipt.source_complete_entry_count < 1
          || receipt.source_complete_entries_with_required_requisite_marker_count < 0
          || receipt.source_complete_entries_with_required_requisite_marker_count
            > receipt.source_complete_entry_count
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
      if (row.browser_challenge_contract
          && [JMU_SLUG, VIRGINIA_TECH_SLUG].includes(row.slug)
          && !structuredCourseLeafRequisiteFieldsValid(row)) {
        issues.push(`${row.course_key}:courseleaf_structured_requisite_fields`);
      }
      if (row.slug === VIRGINIA_TECH_SLUG && !row.browser_challenge_contract && (
        row.catalog_year_verified !== VIRGINIA_TECH_CATALOG_YEAR
        || row.official_url !== VIRGINIA_TECH_CS_DEPARTMENT_URL
        || row.cache_path !== VIRGINIA_TECH_CS_HTML_CACHE_PATH
        || row.source_response_sha256 !== VIRGINIA_TECH_CS_HTML_SHA256
        || row.retained_source_contract !== VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT
        || row.retained_source_text_cache_path !== VIRGINIA_TECH_CS_TEXT_CACHE_PATH
        || row.retained_source_text_sha256 !== VIRGINIA_TECH_CS_TEXT_SHA256
        || row.live_recapture_claim !== false
        || !/^CS\d{4}[A-Z]?$/.test(row.course_code || '')
      )) {
        issues.push(`${row.course_key}:virginia_tech_retained_source_receipt`);
      }
      if (['CYSE101', 'CYSE130'].includes(row.course_code)
          && row.owner_namespace === 'va:uni:9210') {
        const cacheReceipt = row.cache_reacquisition_receipt;
        if (row.slug !== 'george-mason-university'
            || row.official_url !== 'https://catalog.gmu.edu/courses/cyse/'
            || row.cache_path !== GMU_CYSE_CACHE_PATH
            || row.source_response_sha256 !== GMU_CYSE_RESPONSE_SHA256
            || row.source_response_bytes !== 168333
            || cacheReceipt?.contract !== GMU_CYSE_CACHE_REACQUISITION_RECEIPT
            || cacheReceipt?.prior_capture_disposition_revalidated
              !== 'blocked_fail_closed'
            || cacheReceipt?.prior_blocked_reason_revalidated
              !== 'response_failed_status_content_type_or_interstitial_check'
            || cacheReceipt?.network_request_used !== false
            || cacheReceipt?.source_response_sha256 !== GMU_CYSE_RESPONSE_SHA256
            || cacheReceipt?.source_response_bytes !== 168333
            || JSON.stringify(cacheReceipt?.exact_entry_codes)
              !== JSON.stringify(['CYSE101', 'CYSE130'])
            || cacheReceipt?.exact_entries_revalidated !== true) {
          issues.push(`${row.course_key}:gmu_cyse_cache_reacquisition_receipt`);
        }
      }
    }
    if (row.boundary_contract === BRIDGEWATER_BOUNDARY_CONTRACT) {
      if (row.slug !== BRIDGEWATER_SLUG
          || expectedBridgewaterCoursePath(row.course_code) !== row.canonical_path
          || new URL(row.official_url).hostname.toLowerCase() !== BRIDGEWATER_HOST
          || new URL(row.official_url).pathname.replace(/\/$/, '') !== row.canonical_path) {
        issues.push(`${row.course_key}:bridgewater_identity`);
      }
      if (!row.title || !/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
          || !row.published_units || !(row.published_units.credit_hours_min > 0)
          || row.published_units.credit_hours_max !== row.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:bridgewater_entry`);
      }
      const fieldReceipt = row.requisite_field_receipt;
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
          ))) {
        issues.push(`${row.course_key}:bridgewater_requisite_field_receipt`);
      }
      if (!/^[a-f0-9]{64}$/.test(row.edition_response_sha256 || '')
          || row.edition_path !== BRIDGEWATER_EDITION_PATH
          || row.edition_catalog_year !== row.catalog_year_verified
          || row.edition_exact_year_statement
            !== `Course numbers and descriptions listed herein apply to the ${row.catalog_year_verified} academic year.`) {
        issues.push(`${row.course_key}:bridgewater_edition`);
      }
    }
    if (row.boundary_contract === LONGWOOD_BOUNDARY_CONTRACT) {
      let sourceUrl = null;
      try { sourceUrl = new URL(row.official_url); } catch { /* recorded below */ }
      if (row.slug !== LONGWOOD_SLUG
          || ![
            ...LONGWOOD_DIRECT_CMSC_TARGETS,
            ...LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
          ].includes(row.course_code)
          || sourceUrl?.protocol !== 'https:'
          || sourceUrl?.hostname.toLowerCase() !== LONGWOOD_DEPARTMENT_HOST
          || sourceUrl?.pathname.replace(/\/$/, '') !== LONGWOOD_DEPARTMENT_PATH) {
        issues.push(`${row.course_key}:longwood_identity`);
      }
      if (!row.title || !/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
          || !row.published_units || !(row.published_units.credit_hours_min >= 0)
          || row.published_units.credit_hours_max < row.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:longwood_entry`);
      }
      if (row.catalog_context_contract !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
          || row.catalog_context_official_url !== LONGWOOD_CATALOG_CONTEXT_URL
          || row.catalog_context_html_cache_path !== LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH
          || row.catalog_context_text_cache_path !== LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH
          || row.catalog_context_normalized_text_sha256 !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
          || !/^[a-f0-9]{64}$/.test(row.catalog_context_html_sha256 || '')
          || !/^[a-f0-9]{64}$/.test(row.catalog_context_relevant_sha256 || '')
          || row.catalog_context_catalog_year !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.catalog_context_catoid !== LONGWOOD_CATALOG_CONTEXT_CATOID
          || row.catalog_year_verified !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.two_source_edition_boundary !== LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY
          || row.department_page_catalog_year_statement !== null) {
        issues.push(`${row.course_key}:longwood_catalog_context`);
      }
    }
    if (row.boundary_contract === LONGWOOD_BANNER_BOUNDARY_CONTRACT) {
      let sourceUrl = null;
      try { sourceUrl = new URL(row.official_url); } catch { /* recorded below */ }
      if (row.slug !== LONGWOOD_SLUG
          || (!/^(?:CTZN|ENGL|MATH)\d{2,4}[A-Z]?$/.test(row.course_code || '')
            && !LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS.includes(row.course_code)
            && !LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS.includes(row.course_code))
          || sourceUrl?.protocol !== 'https:'
          || sourceUrl?.hostname.toLowerCase() !== LONGWOOD_BANNER_HOST
          || sourceUrl?.pathname.replace(/\/$/, '') !== LONGWOOD_BANNER_PATH) {
        issues.push(`${row.course_key}:longwood_banner_identity`);
      }
      if (!row.title || !/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
          || !row.published_units || !(row.published_units.credit_hours_min >= 0)
          || row.published_units.credit_hours_max < row.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:longwood_banner_entry`);
      }
      if (row.catalog_context_contract !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
          || row.catalog_context_official_url !== LONGWOOD_CATALOG_CONTEXT_URL
          || row.catalog_context_html_cache_path !== LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH
          || row.catalog_context_text_cache_path !== LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH
          || row.catalog_context_normalized_text_sha256 !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
          || !/^[a-f0-9]{64}$/.test(row.catalog_context_html_sha256 || '')
          || !/^[a-f0-9]{64}$/.test(row.catalog_context_relevant_sha256 || '')
          || row.catalog_context_catalog_year !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.catalog_context_catoid !== LONGWOOD_CATALOG_CONTEXT_CATOID
          || row.catalog_year_verified !== LONGWOOD_CATALOG_CONTEXT_YEAR
          || row.two_source_edition_boundary !== LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY
          || row.department_page_catalog_year_statement !== null) {
        issues.push(`${row.course_key}:longwood_banner_catalog_context`);
      }
    }
    if (row.boundary_contract === RADFORD_BOUNDARY_CONTRACT) {
      const expected = RADFORD_COURSE_RECORDS[row.course_code];
      const closureExpected = RADFORD_CLOSURE_COURSE_RECORDS[row.course_code];
      let sourceUrl = null;
      try { sourceUrl = new URL(row.official_url); } catch { /* recorded below */ }
      if (row.slug !== RADFORD_SLUG || !expected
          || sourceUrl?.protocol !== 'https:'
          || sourceUrl?.hostname.toLowerCase() !== RADFORD_HOST
          || sourceUrl?.pathname !== '/preview_course_nopop.php'
          || Number(sourceUrl?.searchParams.get('catoid')) !== RADFORD_CATOID
          || Number(sourceUrl?.searchParams.get('coid')) !== expected?.coid
          || row.catoid !== RADFORD_CATOID || row.coid !== expected?.coid
          || row.title !== expected?.title) {
        issues.push(`${row.course_key}:radford_identity`);
      }
      if (!/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
          || !row.published_units || !(row.published_units.credit_hours_min > 0)
          || row.published_units.credit_hours_max < row.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:radford_entry`);
      }
      const discovery = row.discovery_link_receipt;
      if (row.catalog_year_verified !== RADFORD_CATALOG_YEAR
          || discovery?.course_code !== row.course_code
          || discovery?.catoid !== RADFORD_CATOID
          || discovery?.coid !== expected?.coid
          || (!closureExpected && discovery?.title !== expected?.title)
          || (closureExpected
            ? (row.discovery_contract !== RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT
              || row.discovery_cache_path !== closureExpected.discovery_cache_path
              || row.discovery_response_sha256 !== closureExpected.discovery_response_sha256
              || discovery?.discovery_course_code !== closureExpected.discovery_course_code
              || discovery?.discovery_cache_path !== closureExpected.discovery_cache_path
              || discovery?.discovery_response_sha256
                !== closureExpected.discovery_response_sha256)
            : (row.discovery_contract !== RADFORD_DISCOVERY_CONTRACT
              || row.discovery_cache_path !== RADFORD_PROGRAM_CACHE_PATH
              || row.discovery_response_sha256 !== RADFORD_PROGRAM_HTML_SHA256))
          || row.robots_crawl_delay_seconds !== 120) {
        issues.push(`${row.course_key}:radford_discovery_receipt`);
      }
      const clause = row.required_requisite_clause;
      const markerCount = (row.raw_entry_text.match(/\bPrerequisites?:/gi) || []).length;
      if (markerCount !== (clause ? 1 : 0)
          || (clause && (clause.receipt_contract !== RADFORD_CLAUSE_RECEIPT_CONTRACT
          || clause.kind !== 'prerequisite'
          || !/^Prerequisites?$/.test(clause.label || '')
          || sha256(clause.raw) !== clause.raw_sha256
          || row.raw_entry_text.slice(clause.relative_start, clause.relative_end) !== clause.raw
          || row.raw_entry_text.slice(
            clause.statement_relative_start, clause.statement_relative_start + clause.label.length + 1,
          ) !== `${clause.label}:`
          || clause.statement_relative_end !== clause.relative_end
          || !/^[a-f0-9]{64}$/.test(clause.raw_html_sha256 || '')
          || clause.boundary_terminal
            !== 'first_br_after_unique_strong_prerequisite_marker'))) {
        issues.push(`${row.course_key}:radford_clause_receipt`);
      }
      const preOrCorequisite = row.pre_or_corequisite_clause;
      const preOrCorequisiteMarkerCount = (
        row.raw_entry_text.match(/\bPre-\s*or\s*Corequisites?:/gi) || []
      ).length;
      if (preOrCorequisiteMarkerCount !== (preOrCorequisite ? 1 : 0)
          || (preOrCorequisite
            && (preOrCorequisite.receipt_contract
              !== RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT
            || preOrCorequisite.kind !== 'pre_or_corequisite'
            || !/^Pre-\s*or\s*Corequisites?$/.test(preOrCorequisite.label || '')
            || sha256(preOrCorequisite.raw) !== preOrCorequisite.raw_sha256
            || row.raw_entry_text.slice(
              preOrCorequisite.relative_start, preOrCorequisite.relative_end,
            ) !== preOrCorequisite.raw
            || row.raw_entry_text.slice(
              preOrCorequisite.statement_relative_start,
              preOrCorequisite.statement_relative_start + preOrCorequisite.label.length + 1,
            ) !== `${preOrCorequisite.label}:`
            || preOrCorequisite.statement_relative_end !== preOrCorequisite.relative_end
            || !/^[a-f0-9]{64}$/.test(preOrCorequisite.raw_html_sha256 || '')
            || preOrCorequisite.boundary_terminal
              !== 'first_br_after_unique_strong_pre_or_corequisite_marker'))) {
        issues.push(`${row.course_key}:radford_pre_or_corequisite_clause_receipt`);
      }
      if (row.formal_requisite_marker_count != null
          && row.formal_requisite_marker_count !== markerCount + preOrCorequisiteMarkerCount) {
        issues.push(`${row.course_key}:radford_formal_requisite_marker_count`);
      }
    }
    if (row.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT) {
      const expected = UVA_WISE_COURSE_RECORDS[row.course_code];
      const closureExpected = UVA_WISE_CLOSURE_COURSE_RECORDS[row.course_code];
      let sourceUrl = null;
      try { sourceUrl = new URL(row.official_url); } catch { /* recorded below */ }
      if (row.slug !== UVA_WISE_SLUG || !expected
          || sourceUrl?.protocol !== 'http:'
          || sourceUrl?.hostname.toLowerCase() !== UVA_WISE_HOST
          || sourceUrl?.pathname !== '/preview_course_nopop.php'
          || Number(sourceUrl?.searchParams.get('catoid')) !== UVA_WISE_CATOID
          || Number(sourceUrl?.searchParams.get('coid')) !== expected?.coid
          || row.catoid !== UVA_WISE_CATOID || row.coid !== expected?.coid
          || row.title !== expected?.title) {
        issues.push(`${row.course_key}:uva_wise_identity`);
      }
      if (!/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
          || !row.published_units || !(row.published_units.credit_hours_min > 0)
          || row.published_units.credit_hours_max < row.published_units.credit_hours_min) {
        issues.push(`${row.course_key}:uva_wise_entry`);
      }
      const discovery = row.discovery_link_receipt;
      if (row.catalog_year_verified !== UVA_WISE_CATALOG_YEAR
          || discovery?.course_code !== row.course_code
          || discovery?.catoid !== UVA_WISE_CATOID
          || discovery?.coid !== expected?.coid
          || (!closureExpected && discovery?.title !== expected?.title)
          || (closureExpected
            ? (row.discovery_contract !== UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT
              || row.discovery_cache_path !== closureExpected.discovery_cache_path
              || row.discovery_response_sha256 !== closureExpected.discovery_response_sha256
              || discovery?.discovery_course_code !== closureExpected.discovery_course_code
              || discovery?.discovery_cache_path !== closureExpected.discovery_cache_path
              || discovery?.discovery_response_sha256
                !== closureExpected.discovery_response_sha256)
            : (row.discovery_contract !== UVA_WISE_DISCOVERY_CONTRACT
              || row.discovery_program_cache_path !== UVA_WISE_PROGRAM_CACHE_PATH
              || row.discovery_program_response_sha256 !== UVA_WISE_PROGRAM_HTML_SHA256
              || row.discovery_ge_cache_path !== UVA_WISE_GE_CACHE_PATH
              || row.discovery_ge_response_sha256 !== UVA_WISE_GE_HTML_SHA256))
          || row.robots_crawl_delay_seconds !== UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS
          || row.http_exception_contract
            !== 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1') {
        issues.push(`${row.course_key}:uva_wise_discovery_transport_receipt`);
      }
      const clause = row.required_requisite_clause;
      const markerCount = (row.raw_entry_text.match(/\bPrerequisite(?:\(s\)|s)?\b/gi) || []).length;
      if (markerCount !== (clause ? 1 : 0)
          || (clause && (clause.receipt_contract !== UVA_WISE_CLAUSE_RECEIPT_CONTRACT
          || clause.kind !== 'prerequisite'
          || !/^Prerequisite(?:\(s\)|s)?$/.test(clause.label || '')
          || sha256(clause.raw) !== clause.raw_sha256
          || row.raw_entry_text.slice(clause.relative_start, clause.relative_end) !== clause.raw
          || row.raw_entry_text.slice(
            clause.statement_relative_start, clause.statement_relative_start + clause.label.length,
          ) !== clause.label
          || clause.statement_relative_end !== clause.relative_end
          || !/^[a-f0-9]{64}$/.test(clause.raw_html_sha256 || '')
          || clause.boundary_terminal
            !== 'next_br_after_unique_strong_prerequisite_marker_and_first_br'))) {
        issues.push(`${row.course_key}:uva_wise_clause_receipt`);
      }
    }
    if (row.boundary_contract === SHENANDOAH_BOUNDARY_CONTRACT) {
      const expected = SHENANDOAH_DIRECT_COURSE_RECORDS[row.course_code];
      const expectedDiscoveryContract = expected?.discovery_contract
        || SHENANDOAH_DISCOVERY_CONTRACT;
      const expectedDiscoveryCachePath = expected?.discovery_cache_path
        || SHENANDOAH_PROGRAM_CACHE_PATH;
      const expectedDiscoveryHash = expected?.discovery_response_sha256
        || SHENANDOAH_PROGRAM_HTML_SHA256;
      let sourceUrl = null;
      try { sourceUrl = new URL(row.official_url); } catch { /* checked below */ }
      if (row.slug !== SHENANDOAH_SLUG || !expected
          || sourceUrl?.protocol !== 'https:'
          || sourceUrl?.hostname.toLowerCase() !== SHENANDOAH_HOST
          || sourceUrl?.pathname !== '/preview_course_nopop.php'
          || Number(sourceUrl?.searchParams.get('catoid')) !== SHENANDOAH_CATOID
          || Number(sourceUrl?.searchParams.get('coid')) !== expected?.coid
          || row.catoid !== SHENANDOAH_CATOID || row.coid !== expected?.coid
          || row.title !== expected?.title) {
        issues.push(`${row.course_key}:shenandoah_identity`);
      }
      const discovery = row.discovery_link_receipt;
      if (!/^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256 || '')
          || !row.published_units || !(row.published_units.credit_hours_min > 0)
          || row.published_units.credit_hours_max < row.published_units.credit_hours_min
          || row.catalog_year_verified !== SHENANDOAH_CATALOG_YEAR
          || row.discovery_contract !== expectedDiscoveryContract
          || row.discovery_cache_path !== expectedDiscoveryCachePath
          || row.discovery_response_sha256 !== expectedDiscoveryHash
          || discovery?.course_code !== row.course_code
          || discovery?.catoid !== SHENANDOAH_CATOID
          || discovery?.coid !== expected?.coid
          || discovery?.title !== expected?.title
          || row.robots_crawl_delay_seconds !== SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS
          || !Number.isInteger(row.formal_corequisite_marker_count)
          || row.formal_corequisite_marker_count < 0) {
        issues.push(`${row.course_key}:shenandoah_receipt`);
      }
      const clause = row.required_requisite_clause;
      const markerCount = (row.raw_entry_text.match(/Prerequisite\(s\):/gi) || []).length;
      if (markerCount !== (clause ? 1 : 0)
          || (clause && (clause.receipt_contract !== SHENANDOAH_CLAUSE_RECEIPT_CONTRACT
          || clause.kind !== 'prerequisite'
          || clause.label !== 'Prerequisite(s)'
          || sha256(clause.raw) !== clause.raw_sha256
          || row.raw_entry_text.slice(clause.relative_start, clause.relative_end) !== clause.raw
          || row.raw_entry_text.slice(
            clause.statement_relative_start,
            clause.statement_relative_start + 'Prerequisite(s):'.length,
          ) !== 'Prerequisite(s):'
          || clause.statement_relative_end !== clause.relative_end
          || !/^[a-f0-9]{64}$/.test(clause.raw_html_sha256 || '')
          || clause.boundary_terminal
            !== 'closing_p_after_unique_terminal_prerequisite_parenthetical_marker'))) {
        issues.push(`${row.course_key}:shenandoah_clause_receipt`);
      }
    }
    if (row.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT) {
      const issue = cnuCpen371wEntryIssue(row);
      if (issue) issues.push(`${row.course_key}:cnu_cpen371w_${issue}`);
    }
    if (row.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT) {
      const issue = vsuArabicEntryIssue(row);
      if (issue) issues.push(`${row.course_key}:vsu_arabic_${issue}`);
    }
    if (row.boundary_contract === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT) {
      const issue = virginiaTechGraduateCsEntryIssue(row);
      if (issue) issues.push(`${row.course_key}:virginia_tech_graduate_cs_${issue}`);
    }
  }
  if (artifact?.summary?.exact_entry_candidates !== entries.length) issues.push('summary_entries');
  const captures = asArray(artifact?.captures);
  const cnuCapture = captures.find((row) => (
    row.slug === CNU_SLUG && row.platform === 'pdf_bbox_columns'
  ));
  if (cnuCapture && (cnuCapture.platform !== 'pdf_bbox_columns'
      || cnuCapture.source_response_sha256 !== CNU_EXPECTED_PDF_SHA256
      || cnuCapture.pdf_title_verified !== CNU_EXPECTED_PDF_TITLE
      || cnuCapture.pdf_page_count !== CNU_EXPECTED_PAGE_COUNT
      || !/^[a-f0-9]{64}$/.test(cnuCapture.bbox_layout_sha256 || '')
      || cnuCapture.exact_entry_count !== entries.filter((row) => (
        [CNU_BOUNDARY_CONTRACT, CNU_COMPOUND_BOUNDARY_CONTRACT]
          .includes(row.boundary_contract)
      )).length)) {
    issues.push('cnu_capture:evidence');
  }
  const cnuExactEntries = entries.filter((row) => (
    row.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT
  ));
  const cnuExactCapture = captures.find((row) => (
    row.platform === 'cnu_cpen371w_current_joint_evidence'
  ));
  if (cnuExactEntries.length && (!cnuExactCapture
      || cnuExactEntries.length !== 1
      || cnuExactCapture.capture_status !== 'bounded_entries_available'
      || cnuExactCapture.exact_entry_count !== 1
      || JSON.stringify(cnuExactCapture.exact_entry_codes) !== JSON.stringify(['CPEN371W'])
      || cnuExactCapture.evidence_artifact_sha256
        !== CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256
      || cnuExactCapture.source_response_sha256 !== CNU_CATALOG_RESPONSE_SHA256
      || cnuExactCapture.program_response_sha256 !== CNU_PROGRAM_RESPONSE_SHA256
      || cnuExactCapture.robots_response_sha256 !== CNU_ROBOTS_RESPONSE_SHA256
      || cnuExactCapture.facts_sha256 !== CNU_CPEN371W_FACTS_SHA256
      || cnuExactCapture.alias_scope !== 'CPEN371W_only'
      || cnuExactCapture.broad_suffix_alias_rule_created !== false)) {
    issues.push('cnu_cpen371w_capture:evidence');
  }
  const vsuArabicEntries = entries.filter((row) => (
    row.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT
  ));
  const vsuArabicCapture = captures.find((row) => (
    row.platform === 'vsu_arabic_current_department_evidence'
  ));
  if (vsuArabicEntries.length && (!vsuArabicCapture
      || vsuArabicEntries.length !== VSU_ARABIC_TARGETS.length
      || vsuArabicCapture.capture_status !== 'bounded_entries_available'
      || vsuArabicCapture.exact_entry_count !== VSU_ARABIC_TARGETS.length
      || JSON.stringify(vsuArabicCapture.exact_entry_codes)
        !== JSON.stringify([...VSU_ARABIC_TARGETS].sort())
      || vsuArabicCapture.evidence_artifact_sha256 !== VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256
      || vsuArabicCapture.source_response_sha256 !== VSU_DEPARTMENT_RESPONSE_SHA256
      || vsuArabicCapture.robots_response_sha256 !== VSU_ROBOTS_RESPONSE_SHA256
      || vsuArabicCapture.facts_sha256 !== VSU_ARABIC_FACTS_SHA256
      || vsuArabicCapture.arabic_section_courseblock_count !== 4
      || vsuArabicEntries.some((row) => (
        row.source_response_sha256 !== vsuArabicCapture.source_response_sha256
        || row.arabic_section_html_sha256 !== vsuArabicCapture.arabic_section_html_sha256
      )))) {
    issues.push('vsu_arabic_capture:evidence');
  }
  const virginiaTechGraduateCsEntries = entries.filter((row) => (
    row.boundary_contract === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT
  ));
  const virginiaTechGraduateCsCapture = captures.find((row) => (
    row.platform === 'virginia_tech_graduate_cs_current_department_evidence'
  ));
  if (virginiaTechGraduateCsEntries.length && (!virginiaTechGraduateCsCapture
      || virginiaTechGraduateCsCapture.capture_status !== 'bounded_entries_available'
      || virginiaTechGraduateCsCapture.exact_entry_count
        !== virginiaTechGraduateCsEntries.length
      || JSON.stringify(virginiaTechGraduateCsCapture.exact_entry_codes)
        !== JSON.stringify(virginiaTechGraduateCsEntries.map((row) => row.course_code).sort())
      || virginiaTechGraduateCsCapture.evidence_artifact_sha256
        !== VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256
      || virginiaTechGraduateCsCapture.source_response_sha256
        !== VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256
      || virginiaTechGraduateCsCapture.robots_response_sha256
        !== VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256
      || virginiaTechGraduateCsCapture.facts_sha256
        !== VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256
      || virginiaTechGraduateCsEntries.some((row) => (
        row.source_response_sha256
          !== virginiaTechGraduateCsCapture.source_response_sha256
        || row.facts_sha256 !== virginiaTechGraduateCsCapture.facts_sha256
      )))) {
    issues.push('virginia_tech_graduate_cs_capture:evidence');
  }
  for (const row of entries.filter((entry) => (
    entry.boundary_contract === COURSELEAF_BOUNDARY_CONTRACT
  ))) {
    const capture = captures.find((candidate) => candidate.cache_path === row.cache_path);
    const receipt = row.complete_entry_receipt;
    const expectedPlatform = row.retained_source_contract
      ? 'retained_courseleaf_source'
      : (row.browser_challenge_contract ? 'browser_challenge_courseleaf' : 'courseleaf');
    if (!capture || capture.platform !== expectedPlatform
        || capture.capture_status !== 'bounded_entries_available'
        || capture.source_response_sha256 !== row.source_response_sha256
        || capture.courseblock_count !== receipt?.source_courseblock_count
        || capture.complete_entry_count !== receipt?.source_complete_entry_count
        || capture.complete_entries_with_required_requisite_marker_count
          !== receipt?.source_complete_entries_with_required_requisite_marker_count) {
      issues.push(`${row.course_key}:courseleaf_capture_receipt`);
    }
    if (row.browser_challenge_contract && (
      JSON.stringify(capture?.browser_challenge_receipt)
        !== JSON.stringify(row.browser_challenge_receipt)
      || JSON.stringify(capture?.robots_receipt) !== JSON.stringify(row.robots_receipt)
      || JSON.stringify(capture?.sitemap_discovery_receipt)
        !== JSON.stringify(row.sitemap_discovery_receipt)
    )) issues.push(`${row.course_key}:browser_courseleaf_capture_receipt`);
    if (row.retained_source_contract && (
      capture.retained_source_contract !== row.retained_source_contract
      || capture.retained_source_text_cache_path
        !== row.retained_source_text_cache_path
      || capture.retained_source_text_sha256
        !== row.retained_source_text_sha256
      || capture.live_recapture_claim !== false
    )) issues.push(`${row.course_key}:retained_courseleaf_capture_receipt`);
    if (row.cache_reacquisition_receipt
        && JSON.stringify(capture?.cache_reacquisition_receipt)
          !== JSON.stringify(row.cache_reacquisition_receipt)) {
      issues.push(`${row.course_key}:cache_reacquisition_capture_receipt`);
    }
  }
  const virginiaTechSitemap = captures.find((row) => (
    row.slug === VIRGINIA_TECH_SLUG && row.platform === 'browser_challenge_sitemap'
  ));
  const browserVirginiaTechEntries = entries.filter((row) => (
    row.slug === VIRGINIA_TECH_SLUG && row.browser_challenge_contract
  ));
  if (browserVirginiaTechEntries.length && (
    !virginiaTechSitemap
    || virginiaTechSitemap.capture_status !== 'sitemap_discovery_verified'
    || virginiaTechSitemap.discovery_contract !== VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT
    || virginiaTechSitemap.official_url !== VIRGINIA_TECH_SITEMAP_URL
    || !/^[a-f0-9]{64}$/.test(virginiaTechSitemap.source_response_sha256 || '')
    || browserVirginiaTechEntries.some((row) => (
      row.sitemap_discovery_receipt?.source_response_sha256
        !== virginiaTechSitemap.source_response_sha256
      || row.sitemap_discovery_receipt?.locations_sha256
        !== virginiaTechSitemap.locations_sha256
    ))
  )) issues.push('virginia_tech_sitemap_capture:evidence');
  const bridgewaterEdition = captures.find((row) => (
    row.slug === BRIDGEWATER_SLUG && row.platform === 'cleancatalog_edition'
  ));
  const bridgewaterEntries = entries.filter((row) => row.slug === BRIDGEWATER_SLUG);
  if (bridgewaterEntries.length && (!bridgewaterEdition
      || bridgewaterEdition.capture_status !== 'catalog_edition_verified'
      || bridgewaterEdition.source_response_sha256
        !== bridgewaterEntries[0].edition_response_sha256
      || bridgewaterEntries.some((row) => (
        row.edition_response_sha256 !== bridgewaterEdition.source_response_sha256
      )))) {
    issues.push('bridgewater_capture:edition_evidence');
  }
  const longwoodCapture = captures.find((row) => (
    row.slug === LONGWOOD_SLUG && row.platform === 'longwood_department_course_listing'
  ));
  const longwoodEntries = entries.filter((row) => (
    row.boundary_contract === LONGWOOD_BOUNDARY_CONTRACT
  ));
  if (longwoodEntries.length && (!longwoodCapture
      || longwoodCapture.capture_status !== 'bounded_entries_available'
      || longwoodCapture.exact_entry_count !== longwoodEntries.length
      || longwoodCapture.catalog_context_contract !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
      || longwoodCapture.catalog_context_normalized_text_sha256
        !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
      || longwoodEntries.some((row) => (
        row.source_response_sha256 !== longwoodCapture.source_response_sha256
        || row.catalog_context_html_sha256 !== longwoodCapture.catalog_context_html_sha256
      )))) {
    issues.push('longwood_capture:evidence');
  }
  const longwoodBannerCapture = captures.find((row) => (
    row.slug === LONGWOOD_SLUG && row.platform === 'longwood_banner_course_listing'
  ));
  const longwoodBannerEntries = entries.filter((row) => (
    row.boundary_contract === LONGWOOD_BANNER_BOUNDARY_CONTRACT
  ));
  if (longwoodBannerEntries.length && (!longwoodBannerCapture
      || longwoodBannerCapture.capture_status !== 'bounded_entries_available'
      || longwoodBannerCapture.exact_entry_count !== longwoodBannerEntries.length
      || longwoodBannerCapture.catalog_context_contract !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
      || longwoodBannerCapture.catalog_context_normalized_text_sha256
        !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
      || longwoodBannerEntries.some((row) => (
        row.source_response_sha256 !== longwoodBannerCapture.source_response_sha256
        || row.catalog_context_html_sha256 !== longwoodBannerCapture.catalog_context_html_sha256
      )))) {
    issues.push('longwood_banner_capture:evidence');
  }
  const radfordCaptures = captures.filter((row) => (
    row.slug === RADFORD_SLUG && row.platform === 'radford_acalog_course'
  ));
  const radfordEntries = entries.filter((row) => row.boundary_contract === RADFORD_BOUNDARY_CONTRACT);
  const boundedRadfordCaptures = radfordCaptures.filter((row) => (
    row.capture_status === 'bounded_entries_available'
  ));
  if (radfordEntries.length !== boundedRadfordCaptures.length
      || boundedRadfordCaptures.some((capture) => (
        capture.exact_entry_count !== 1
        || (capture.discovery_contract === RADFORD_DISCOVERY_CONTRACT
          ? capture.discovery_response_sha256 !== RADFORD_PROGRAM_HTML_SHA256
          : (capture.discovery_contract !== RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT
            || capture.discovery_response_sha256
              !== RADFORD_CLOSURE_COURSE_RECORDS[
                capture.target_course_codes?.[0]
              ]?.discovery_response_sha256))
        || capture.robots?.crawl_delay_seconds !== 120
        || !radfordEntries.some((entry) => (
          entry.course_key === `${capture.owner_namespace}:${capture.target_course_codes?.[0]}`
          && entry.cache_path === capture.cache_path
          && entry.source_response_sha256 === capture.source_response_sha256
        ))
      ))
      || radfordEntries.some((entry) => !boundedRadfordCaptures.some((capture) => (
        entry.course_key === `${capture.owner_namespace}:${capture.target_course_codes?.[0]}`
        && entry.cache_path === capture.cache_path
        && entry.source_response_sha256 === capture.source_response_sha256
      )))) {
    issues.push('radford_capture:evidence');
  }
  const uvaWiseCaptures = captures.filter((row) => (
    row.slug === UVA_WISE_SLUG && row.platform === 'uva_wise_acalog_course'
  ));
  const uvaWiseEntries = entries.filter((row) => (
    row.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT
  ));
  const boundedUvaWiseCaptures = uvaWiseCaptures.filter((row) => (
    row.capture_status === 'bounded_entries_available'
  ));
  if (uvaWiseEntries.length !== boundedUvaWiseCaptures.length
      || boundedUvaWiseCaptures.some((capture) => (
        capture.exact_entry_count !== 1
        || (capture.discovery_contract === UVA_WISE_DISCOVERY_CONTRACT
          ? (capture.discovery_program_response_sha256 !== UVA_WISE_PROGRAM_HTML_SHA256
            || capture.discovery_ge_response_sha256 !== UVA_WISE_GE_HTML_SHA256)
          : (capture.discovery_contract !== UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT
            || capture.discovery_response_sha256
              !== UVA_WISE_CLOSURE_COURSE_RECORDS[
                capture.target_course_codes?.[0]
              ]?.discovery_response_sha256))
        || capture.robots?.crawl_delay_seconds !== UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS
        || !uvaWiseEntries.some((entry) => (
          entry.course_key === `${capture.owner_namespace}:${capture.target_course_codes?.[0]}`
          && entry.cache_path === capture.cache_path
          && entry.source_response_sha256 === capture.source_response_sha256
        ))
      ))) issues.push('uva_wise_capture:evidence');
  for (const capture of captures.filter((row) => (
    row.platform?.startsWith('browser_challenge_')
      && row.capture_status !== 'blocked_fail_closed'
  ))) {
    const documentReceipt = validateBrowserChallengeReceipt(
      capture.browser_challenge_receipt,
      {
        expectedUrl: capture.official_url,
        expectedFinalContentType:
          capture.platform === 'browser_challenge_sitemap' ? 'xml' : 'text/html',
        expectedFinalSha256: capture.source_response_sha256,
      },
    );
    const robotsReceipt = validateBrowserRobotsReceipt(capture.robots_receipt, {
      origin: new URL(capture.official_url).origin,
      checkedPath: new URL(capture.official_url).pathname,
    });
    if (!documentReceipt.valid || !robotsReceipt.valid) {
      issues.push(`${capture.route_id}:browser_capture_receipt`);
    }
  }
  if (plan) {
    const routeIds = new Set(plan.routes.map((row) => row.route_id));
    for (const route of plan.routes.filter((row) => (
      row.platform?.startsWith('browser_challenge_')
    ))) {
      if (!exactKnownBrowserResource({
        slug: route.slug,
        platform: route.platform,
        officialUrl: route.official_url,
        targetSubjectPrefix: route.target_subject_prefix,
      })) issues.push(`${route.route_id}:invalid_browser_route_contract`);
    }
    for (const row of captures) {
      if (!routeIds.has(row.route_id)) issues.push(`${row.route_id}:unplanned_route`);
    }
  }
  return { valid: issues.length === 0, issues };
}

module.exports = {
  ARTIFACT,
  BROWSER_CHALLENGE_CONTRACT,
  BROWSER_ROBOTS_CONTRACT,
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  COURSELEAF_STRUCTURED_REQUISITE_FIELD_RECEIPT_CONTRACT,
  COURSELEAF_ROUTES,
  CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256,
  CNU_CPEN371W_EVIDENCE_CACHE_PATH,
  CNU_CPEN371W_SOURCE_CACHE_PATH,
  OWNER_BLOCKERS,
  USER_AGENT,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH,
  VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH,
  VIRGINIA_TECH_GRADUATE_CS_TARGETS,
  VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256,
  VSU_ARABIC_EVIDENCE_CACHE_PATH,
  VSU_ARABIC_SOURCE_CACHE_PATH,
  VSU_ARABIC_TARGETS,
  acquisitionTargets,
  buildAcquisitionPlan,
  catalogYearSeen,
  courseCodeAtEntryStart,
  coursePrefix,
  cnuCpen371wEntryIssue,
  extractCourseLeafEntries,
  normalizeCode,
  normalizedEntryText,
  parseRobots,
  publishedUnitsReceipt,
  requisiteMarkerCounts,
  structuredCourseLeafRequisiteFieldsValid,
  responseCachePath,
  robotsAllows,
  sha256,
  splitCourseKey,
  validateAcquisitionArtifact,
  validateBrowserChallengeReceipt,
  validateBrowserRobotsReceipt,
  virginiaTechGraduateCsEntryIssue,
  vsuArabicEntryIssue,
};
