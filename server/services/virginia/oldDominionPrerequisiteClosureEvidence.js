const crypto = require('node:crypto');
const {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  catalogYearSeen,
  extractCourseLeafEntries,
} = require('./universityPrerequisiteAcquisition');

const ODU_SLUG = 'old-dominion-university';
const ODU_OWNER_NAMESPACE = 'va:uni:9218';
const ODU_SCHOOL_ID = 9218;
const ODU_CATALOG_YEAR = '2026-2027';
const ODU_STRUCTURAL_NONE_KIND =
  'official_complete_odu_courseleaf_entry_structural_silence_with_same_response_positive_control';
const ODU_STRUCTURAL_NONE_RECEIPT_CONTRACT =
  'odu_2026_2027_exact_courseblock_same_response_prerequisite_control_v1';

const SOURCES = Object.freeze({
  cs: Object.freeze({
    official_url: 'https://catalog.odu.edu/courses/cs/',
    source_response_sha256: 'b9f70355e3b03f4554816a7bb966ff016b23bb472d38e5fe693982d4f1d891b6',
    retained_normalized_text_sha256: '975130484364dbe7ca82a179712a7556cb714739357979a98ecefa7d363ceefc',
    cache_path:
      'university-prerequisites/raw/old-dominion-university/old-dominion-university__cs.html',
    source_courseblock_count: 205,
    source_complete_entry_count: 205,
    source_positive_count: 136,
    positive_control_code: 'CS202G',
    positive_control_raw_entry_sha256:
      'b2ab17887114a89de14d13c1498dc70569cb204f927a4903d4a5ed66e14ecfc7',
    positive_control_raw_entry_html_sha256:
      '68b3f13029e775523b53b13133fdc3cd23967f00625738bbff233a6cf001b41e',
  }),
  oeas: Object.freeze({
    official_url: 'https://catalog.odu.edu/courses/oeas/',
    source_response_sha256: 'b5e84c22bc71fe0f2d47cc03d986ece02d29ab5ed64b96b83d16ebc6adaee77b',
    retained_normalized_text_sha256: 'b5e84c22bc71fe0f2d47cc03d986ece02d29ab5ed64b96b83d16ebc6adaee77b',
    cache_path:
      'university-prerequisites/raw/old-dominion-university/old-dominion-university__oeas.html',
    source_courseblock_count: 129,
    source_complete_entry_count: 129,
    source_positive_count: 69,
    positive_control_code: 'OEAS112N',
    positive_control_raw_entry_sha256:
      'fe7e64bbb805f28f02be3e957a4f734c28628d319711c191e6f2e3a228ff7b3d',
    positive_control_raw_entry_html_sha256:
      '8fd7b0bdc2b181f70a2cbea5365c73be00c009686207b15eb0d369de5c5d9a9f',
  }),
});

const ROWS = Object.freeze({
  CS115: Object.freeze({
    source: 'cs',
    courseblock_index: 1,
    raw_entry_sha256: 'de5a220691ca63b32684ce9da4ca78cb7d68f74ef7d3edc27e98404da1ab45e1',
    raw_entry_html_sha256: '019fb4b6b1bfd23153655f6df3a0933629da1be9c26bc6a126b2272326ee29bf',
    safe_structural_none: false,
    blocker: 'published_non_prerequisite_enrollment_and_credit_restrictions',
    signals: Object.freeze([
      Object.freeze({
        kind: 'intended_audience',
        raw: 'Intended for prospective CS majors.',
        prerequisite_effect: false,
      }),
      Object.freeze({
        kind: 'required_course_component',
        raw: 'Laboratory work required.',
        required_component: 'laboratory',
        prerequisite_effect: false,
      }),
      Object.freeze({
        kind: 'prior_credit_exclusion',
        raw: 'Computer science majors who already have credit for CS 150, CS 151, CS 152, or ENGN 122 cannot subsequently take CS 115 for credit toward their degree.',
        excluded_if_credit_for: Object.freeze(['CS150', 'CS151', 'CS152', 'ENGN122']),
        prerequisite_effect: false,
      }),
    ]),
  }),
  CS121G: Object.freeze({
    source: 'cs',
    courseblock_index: 3,
    raw_entry_sha256: '6cb0e10d186987db542da02892c3554e692ddf61bdf3ba3e41cbb047f4ca1e3e',
    raw_entry_html_sha256: '7e2b1bc889f9c28f1fac66a757a9ae0d28efe4293ad478ec978408339aa52166',
    safe_structural_none: true,
    signals: Object.freeze([]),
  }),
  CS222: Object.freeze({
    source: 'cs',
    courseblock_index: 12,
    raw_entry_sha256: '8ec7e243628838e452a8c4c8e182f7498e09fb5131330b304a304e231d35d41c',
    raw_entry_html_sha256: '46cd65737c3a17987fa4eb606ffb942ac74c17832f8389a133180204c91af6c1',
    safe_structural_none: true,
    signals: Object.freeze([]),
  }),
  OEAS106N: Object.freeze({
    source: 'oeas',
    courseblock_index: 0,
    raw_entry_sha256: '4fb7403c2660642c3372a6195be9c4dfe5404226b7f0d6b38d1365a7a29ec5db',
    raw_entry_html_sha256: '598b8107cfadd656673725d85d7137b60e44c5587dfeab20338d79b0fa114a0c',
    safe_structural_none: false,
    blocker: 'published_required_knowledge_and_field_component',
    signals: Object.freeze([
      Object.freeze({
        kind: 'required_prior_knowledge',
        raw: 'Knowledge of the metric system, scientific notation, ratio and proportion, and graphing is required.',
        prerequisite_effect: 'unresolved',
      }),
      Object.freeze({
        kind: 'required_course_component',
        raw: 'Field trip required.',
        required_component: 'field_trip',
        prerequisite_effect: false,
      }),
    ]),
  }),
  OEAS110N: Object.freeze({
    source: 'oeas',
    courseblock_index: 2,
    raw_entry_sha256: '12b381f3b1c8861480f0429e0705a1160050b1490c518eb9dd2373549b8848a8',
    raw_entry_html_sha256: '7d307bdb8612a26f50513ef09e103d0ec6223810d562a7c71a3073695e808b1e',
    safe_structural_none: false,
    blocker: 'published_mutual_credit_exclusion',
    signals: Object.freeze([Object.freeze({
      kind: 'mutual_credit_exclusion',
      raw: 'A student receiving credit for OEAS 110N cannot receive credit for OEAS 111N.',
      excludes_course_code: 'OEAS111N',
      prerequisite_effect: false,
    })]),
  }),
  OEAS111N: Object.freeze({
    source: 'oeas',
    courseblock_index: 3,
    raw_entry_sha256: 'cc7902e456918bb360eb9f252d60e780d106a8895bcabbe4361ec0921de1b99e',
    raw_entry_html_sha256: '7f9cb3c4ec0511343c892367bd081863ed3ba2f022742f4bef75218604ba2fc3',
    safe_structural_none: false,
    blocker: 'published_mutual_credit_exclusion',
    signals: Object.freeze([Object.freeze({
      kind: 'mutual_credit_exclusion',
      raw: 'A student receiving credit for OEAS 111N cannot receive credit for OEAS 110N.',
      excludes_course_code: 'OEAS110N',
      prerequisite_effect: false,
    })]),
  }),
  OEAS126N: Object.freeze({
    source: 'oeas',
    courseblock_index: 5,
    raw_entry_sha256: '410e9a2a6c99491e21ba371007b2b09155c813d087f139d5046a40928f08598d',
    raw_entry_html_sha256: '4abf3cec76d25850ddc754bc1935a91c66813d54876ed48b0f483ed292ceae23',
    safe_structural_none: false,
    blocker: 'published_honors_college_enrollment_restriction',
    signals: Object.freeze([Object.freeze({
      kind: 'enrollment_restriction',
      raw: 'Open only to students in the Honors College.',
      required_population: 'Honors College students',
      prerequisite_effect: false,
    })]),
  }),
});

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function exactUniqueOffset(text, statement) {
  const source = String(text || '');
  const first = source.indexOf(statement);
  return first >= 0 && source.indexOf(statement, first + 1) < 0 ? first : -1;
}

function retainedSignals(entry, expected) {
  const result = [];
  for (const signal of expected.signals) {
    const start = exactUniqueOffset(entry.raw_entry_text, signal.raw);
    if (start < 0) return null;
    result.push({
      ...signal,
      relative_start: start,
      relative_end: start + signal.raw.length,
      raw_sha256: sha256(signal.raw),
    });
  }
  return result;
}

function validateExtractedEntry(entry, code, expected, source) {
  const receipt = entry?.complete_entry_receipt;
  const signals = entry ? retainedSignals(entry, expected) : null;
  return entry?.course_code === code
    && entry.courseblock_index === expected.courseblock_index
    && entry.raw_entry_sha256 === expected.raw_entry_sha256
    && sha256(entry.raw_entry_text) === expected.raw_entry_sha256
    && entry.raw_entry_html_sha256 === expected.raw_entry_html_sha256
    && entry.requisite_marker_counts?.required === 0
    && entry.requisite_marker_counts?.corequisite === 0
    && entry.requisite_marker_counts?.marker_like === 0
    && receipt?.receipt_contract === COURSELEAF_RECEIPT_CONTRACT
    && receipt.source_courseblock_count === source.source_courseblock_count
    && receipt.source_complete_entry_count === source.source_complete_entry_count
    && receipt.source_complete_entries_with_required_requisite_marker_count
      === source.source_positive_count
    && receipt.entry_required_requisite_marker_count === 0
    && receipt.entry_corequisite_marker_count === 0
    && receipt.entry_requisite_marker_like_count === 0
    && receipt.same_source_positive_control === true
    && Array.isArray(signals);
}

function buildOldDominionPrerequisiteMarkerControl({ csHtml, oeasHtml } = {}) {
  const htmlBySource = { cs: String(csHtml || ''), oeas: String(oeasHtml || '') };
  const issues = [];
  const sourceControls = {};
  const entryControls = {};
  for (const [sourceKey, source] of Object.entries(SOURCES)) {
    const html = htmlBySource[sourceKey];
    if (sha256(html) !== source.source_response_sha256) issues.push(`${sourceKey}:source_hash`);
    if (!catalogYearSeen(html, ODU_CATALOG_YEAR)) issues.push(`${sourceKey}:catalog_year`);
    const codes = [
      ...Object.entries(ROWS).filter(([, row]) => row.source === sourceKey).map(([code]) => code),
      source.positive_control_code,
    ];
    const extracted = extractCourseLeafEntries(html, codes);
    if (extracted.missing.length || extracted.ambiguous.length
        || extracted.courseblock_count !== source.source_courseblock_count
        || extracted.complete_entry_count !== source.source_complete_entry_count
        || extracted.complete_entries_with_required_requisite_marker_count
          !== source.source_positive_count) issues.push(`${sourceKey}:entry_population`);
    const byCode = new Map(extracted.entries.map((entry) => [entry.course_code, entry]));
    for (const [code, expected] of Object.entries(ROWS).filter(([, row]) => (
      row.source === sourceKey
    ))) {
      const entry = byCode.get(code);
      if (!validateExtractedEntry(entry, code, expected, source)) {
        issues.push(`${code}:exact_entry`);
        continue;
      }
      const signals = retainedSignals(entry, expected);
      entryControls[code] = {
        course_key: `${ODU_OWNER_NAMESPACE}:${code}`,
        course_code: code,
        source_key: sourceKey,
        source_response_sha256: source.source_response_sha256,
        courseblock_index: entry.courseblock_index,
        raw_entry_sha256: entry.raw_entry_sha256,
        raw_entry_html_sha256: entry.raw_entry_html_sha256,
        published_units: entry.published_units,
        complete_entry_receipt: entry.complete_entry_receipt,
        safe_structural_none: expected.safe_structural_none,
        blocker: expected.blocker || null,
        retained_non_prerequisite_signals: signals,
        retained_non_prerequisite_signals_sha256: sha256(JSON.stringify(signals)),
      };
    }
    const positive = byCode.get(source.positive_control_code);
    if (!positive
        || positive.raw_entry_sha256 !== source.positive_control_raw_entry_sha256
        || positive.raw_entry_html_sha256 !== source.positive_control_raw_entry_html_sha256
        || positive.requisite_marker_counts?.required !== 1
        || positive.complete_entry_receipt?.same_source_positive_control !== true
        || positive.structured_requisite_fields?.length !== 1
        || positive.structured_requisite_fields[0]?.kind !== 'prerequisite') {
      issues.push(`${sourceKey}:positive_control`);
    }
    const positiveControl = positive ? {
      course_key: `${ODU_OWNER_NAMESPACE}:${source.positive_control_code}`,
      course_code: source.positive_control_code,
      courseblock_index: positive.courseblock_index,
      raw_entry_sha256: positive.raw_entry_sha256,
      raw_entry_html_sha256: positive.raw_entry_html_sha256,
      structured_requisite_field: positive.structured_requisite_fields[0],
    } : null;
    sourceControls[sourceKey] = {
      official_url: source.official_url,
      catalog_year: ODU_CATALOG_YEAR,
      source_response_sha256: source.source_response_sha256,
      retained_normalized_text_sha256: source.retained_normalized_text_sha256,
      source_courseblock_count: extracted.courseblock_count,
      source_complete_entry_count: extracted.complete_entry_count,
      source_positive_count: extracted.complete_entries_with_required_requisite_marker_count,
      positive_control: positiveControl,
      positive_control_sha256: sha256(JSON.stringify(positiveControl)),
    };
  }
  const receipt = {
    receipt_contract: ODU_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    catalog_year: ODU_CATALOG_YEAR,
    sources: sourceControls,
    sources_sha256: sha256(JSON.stringify(sourceControls)),
    entries: entryControls,
    entries_sha256: sha256(JSON.stringify(entryControls)),
  };
  return {
    verified: issues.length === 0 && Object.keys(entryControls).length === Object.keys(ROWS).length,
    issues: [...new Set(issues)].sort(),
    receipt,
  };
}

function exactCandidate(candidates, courseCode) {
  const rows = asArray(candidates).filter((row) => (
    row?.slug === ODU_SLUG
      && row?.owner_namespace === ODU_OWNER_NAMESPACE
      && row?.course_code === courseCode
  ));
  return rows.length === 1 ? rows[0] : null;
}

function acquiredCandidateEntryIssues(candidate, courseCode, expected, source) {
  const candidateSource = candidate?.source || {};
  const receipt = candidateSource.complete_entry_receipt;
  const signals = candidate ? retainedSignals({
    raw_entry_text: candidateSource.raw_entry_text,
  }, expected) : null;
  const issues = [];
  if (!candidate) return ['unique_candidate'];
  if (candidate.school_id !== ODU_SCHOOL_ID || candidate.slug !== ODU_SLUG
      || candidate.owner_namespace !== ODU_OWNER_NAMESPACE
      || candidate.course_key !== `${ODU_OWNER_NAMESPACE}:${courseCode}`) issues.push('identity');
  if (candidateSource.capture_origin !== 'official_acquisition'
      || candidateSource.source_format !== 'courseleaf_courseblock'
      || candidateSource.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT) issues.push('boundary');
  if (candidateSource.catalog_year_verified !== ODU_CATALOG_YEAR
      || candidateSource.official_url !== source.official_url
      || candidateSource.source_response_sha256 !== source.source_response_sha256
      || candidateSource.declared_normalized_text_sha256
        !== candidateSource.retained_normalized_text_sha256
      || ![source.source_response_sha256, source.retained_normalized_text_sha256]
        .includes(candidateSource.retained_normalized_text_sha256)) issues.push('source');
  if (candidateSource.courseblock_index !== expected.courseblock_index
      || candidateSource.raw_entry_sha256 !== expected.raw_entry_sha256
      || sha256(candidateSource.raw_entry_text) !== expected.raw_entry_sha256
      || candidateSource.raw_entry_html_sha256 !== expected.raw_entry_html_sha256) issues.push('entry');
  if (candidate.prerequisite_marker_count !== 0 || candidate.corequisite_marker_count !== 0
      || receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
      || receipt.source_courseblock_count !== source.source_courseblock_count
      || receipt.source_complete_entry_count !== source.source_complete_entry_count
      || receipt.source_complete_entries_with_required_requisite_marker_count
        !== source.source_positive_count
      || receipt.entry_required_requisite_marker_count !== 0
      || receipt.entry_corequisite_marker_count !== 0
      || receipt.entry_requisite_marker_like_count !== 0
      || receipt.same_source_positive_control !== true
      || !Array.isArray(signals)) issues.push('marker_receipt');
  return issues;
}

/**
 * Rebuild the exact ODU marker control solely from the versioned candidate
 * artifact. The acquisition stage must therefore retain both target blocks
 * and one named positive block from each exact response.
 */
function buildOldDominionPrerequisiteMarkerControlFromCandidates(candidates) {
  const issues = [];
  const sourceControls = {};
  const entryControls = {};
  for (const [sourceKey, source] of Object.entries(SOURCES)) {
    const targets = Object.entries(ROWS).filter(([, row]) => row.source === sourceKey);
    for (const [code, expected] of targets) {
      const candidate = exactCandidate(candidates, code);
      const entryIssues = acquiredCandidateEntryIssues(candidate, code, expected, source);
      if (entryIssues.length) {
        issues.push(...entryIssues.map((issue) => `${code}:${issue}`));
        continue;
      }
      const candidateSource = candidate.source;
      const signals = retainedSignals({ raw_entry_text: candidateSource.raw_entry_text }, expected);
      entryControls[code] = {
        course_key: candidate.course_key,
        course_code: code,
        source_key: sourceKey,
        source_response_sha256: source.source_response_sha256,
        courseblock_index: candidateSource.courseblock_index,
        raw_entry_sha256: candidateSource.raw_entry_sha256,
        raw_entry_html_sha256: candidateSource.raw_entry_html_sha256,
        published_units: candidateSource.published_units,
        complete_entry_receipt: candidateSource.complete_entry_receipt,
        safe_structural_none: expected.safe_structural_none,
        blocker: expected.blocker || null,
        retained_non_prerequisite_signals: signals,
        retained_non_prerequisite_signals_sha256: sha256(JSON.stringify(signals)),
      };
    }
    const positive = exactCandidate(candidates, source.positive_control_code);
    const positiveSource = positive?.source || {};
    const positiveField = asArray(positiveSource.structured_requisite_fields)[0];
    if (!positive || positive.school_id !== ODU_SCHOOL_ID
        || positive.owner_namespace !== ODU_OWNER_NAMESPACE
        || positiveSource.capture_origin !== 'official_acquisition'
        || positiveSource.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT
        || positiveSource.catalog_year_verified !== ODU_CATALOG_YEAR
        || positiveSource.official_url !== source.official_url
        || positiveSource.source_response_sha256 !== source.source_response_sha256
        || positiveSource.raw_entry_sha256 !== source.positive_control_raw_entry_sha256
        || sha256(positiveSource.raw_entry_text) !== source.positive_control_raw_entry_sha256
        || positiveSource.raw_entry_html_sha256 !== source.positive_control_raw_entry_html_sha256
        || positive.prerequisite_marker_count !== 1 || positive.corequisite_marker_count !== 0
        || positiveSource.complete_entry_receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
        || positiveSource.complete_entry_receipt?.source_courseblock_count
          !== source.source_courseblock_count
        || positiveSource.complete_entry_receipt?.source_complete_entry_count
          !== source.source_complete_entry_count
        || positiveSource.complete_entry_receipt
          ?.source_complete_entries_with_required_requisite_marker_count
          !== source.source_positive_count
        || positiveSource.complete_entry_receipt?.same_source_positive_control !== true
        || asArray(positiveSource.structured_requisite_fields).length !== 1
        || positiveField?.kind !== 'prerequisite') issues.push(`${sourceKey}:positive_control`);
    const positiveControl = positive ? {
      course_key: positive.course_key,
      course_code: source.positive_control_code,
      courseblock_index: positiveSource.courseblock_index,
      raw_entry_sha256: positiveSource.raw_entry_sha256,
      raw_entry_html_sha256: positiveSource.raw_entry_html_sha256,
      structured_requisite_field: positiveField,
    } : null;
    sourceControls[sourceKey] = {
      official_url: source.official_url,
      catalog_year: ODU_CATALOG_YEAR,
      source_response_sha256: source.source_response_sha256,
      retained_normalized_text_sha256: source.retained_normalized_text_sha256,
      source_courseblock_count: source.source_courseblock_count,
      source_complete_entry_count: source.source_complete_entry_count,
      source_positive_count: source.source_positive_count,
      positive_control: positiveControl,
      positive_control_sha256: sha256(JSON.stringify(positiveControl)),
    };
  }
  const receipt = {
    receipt_contract: ODU_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    catalog_year: ODU_CATALOG_YEAR,
    sources: sourceControls,
    sources_sha256: sha256(JSON.stringify(sourceControls)),
    entries: entryControls,
    entries_sha256: sha256(JSON.stringify(entryControls)),
  };
  return {
    verified: issues.length === 0 && Object.keys(entryControls).length === Object.keys(ROWS).length,
    issues: [...new Set(issues)].sort(),
    receipt,
  };
}

function candidateBindingIssues(candidate, expected, entry, source) {
  const candidateSource = candidate?.source || {};
  const issues = [];
  if (candidate?.school_id !== ODU_SCHOOL_ID) issues.push('school_id');
  if (candidate?.slug !== ODU_SLUG) issues.push('slug');
  if (candidate?.owner_namespace !== ODU_OWNER_NAMESPACE) issues.push('owner_namespace');
  if (candidate?.course_key !== `${ODU_OWNER_NAMESPACE}:${candidate?.course_code}`) {
    issues.push('course_key');
  }
  if (candidateSource.catalog_year_verified !== ODU_CATALOG_YEAR) issues.push('catalog_year');
  if (candidateSource.capture_origin !== 'official_acquisition'
      || candidateSource.source_format !== 'courseleaf_courseblock') issues.push('capture_origin');
  if (candidateSource.official_url !== source.official_url) issues.push('official_url');
  if (candidateSource.raw_entry_sha256 !== expected.raw_entry_sha256
      || sha256(candidateSource.raw_entry_text) !== expected.raw_entry_sha256
      || candidateSource.raw_entry_sha256 !== entry?.raw_entry_sha256
      || candidateSource.raw_entry_html_sha256 !== expected.raw_entry_html_sha256
      || candidateSource.courseblock_index !== expected.courseblock_index) issues.push('raw_entry');
  if (candidate.prerequisite_marker_count !== 0 || candidate.corequisite_marker_count !== 0) {
    issues.push('candidate_marker_counts');
  }
  if (![source.retained_normalized_text_sha256, source.source_response_sha256]
    .includes(candidateSource.retained_normalized_text_sha256)
      || candidateSource.declared_normalized_text_sha256
        !== candidateSource.retained_normalized_text_sha256) issues.push('retained_source_hash');
  if (candidateSource.source_response_sha256 !== source.source_response_sha256) {
    issues.push('source_response_hash');
  }
  if (candidateSource.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT) {
    issues.push('boundary_contract');
  }
  return issues;
}

function resolveOldDominionPrerequisiteCandidate(candidate, markerControl) {
  const expected = ROWS[candidate?.course_code];
  const applicable = candidate?.slug === ODU_SLUG && Boolean(expected);
  if (!applicable) return { applicable: false, ready: false, issues: [] };
  const source = SOURCES[expected.source];
  const receipt = markerControl?.receipt;
  const entry = receipt?.entries?.[candidate.course_code];
  const sourceControl = receipt?.sources?.[expected.source];
  const issues = candidateBindingIssues(candidate, expected, entry, source);
  if (markerControl?.verified !== true || asArray(markerControl?.issues).length
      || receipt?.receipt_contract !== ODU_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || receipt?.catalog_year !== ODU_CATALOG_YEAR
      || sha256(JSON.stringify(receipt?.sources || null)) !== receipt?.sources_sha256
      || sha256(JSON.stringify(receipt?.entries || null)) !== receipt?.entries_sha256
      || entry?.course_key !== candidate.course_key
      || entry?.source_response_sha256 !== source.source_response_sha256
      || entry?.raw_entry_html_sha256 !== expected.raw_entry_html_sha256
      || entry?.safe_structural_none !== expected.safe_structural_none
      || entry?.complete_entry_receipt?.same_source_positive_control !== true
      || sha256(JSON.stringify(entry?.retained_non_prerequisite_signals || null))
        !== entry?.retained_non_prerequisite_signals_sha256
      || sourceControl?.source_response_sha256 !== source.source_response_sha256
      || sourceControl?.source_courseblock_count !== source.source_courseblock_count
      || sourceControl?.source_complete_entry_count !== source.source_complete_entry_count
      || sourceControl?.source_positive_count !== source.source_positive_count
      || sourceControl?.positive_control?.course_code !== source.positive_control_code
      || sha256(JSON.stringify(sourceControl?.positive_control || null))
        !== sourceControl?.positive_control_sha256) issues.push('marker_control_receipt');

  if (issues.length) return {
    applicable: true,
    ready: false,
    issues: [...new Set(issues)].sort(),
    review_reason: 'odu_exact_courseblock_receipt_mismatch',
  };
  if (!expected.safe_structural_none) return {
    applicable: true,
    ready: false,
    issues: [],
    review_reason: expected.blocker,
    retained_non_prerequisite_signals: entry.retained_non_prerequisite_signals,
    blocker_evidence: {
      source_response_sha256: source.source_response_sha256,
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_html_sha256: entry.raw_entry_html_sha256,
      complete_entry_receipt: entry.complete_entry_receipt,
      inference_boundary: 'The exact complete entry has no formal prerequisite field, but its published constraint-like statements are retained and prevent structural-none promotion until the analysis schema can model or explicitly exclude them.',
    },
  };

  return {
    applicable: true,
    ready: true,
    issues: [],
    status: 'none',
    review_status: 'promoted_structural_none',
    review_reason: 'complete_odu_courseleaf_entry_silence_with_same_response_prerequisite_positive_control',
    ignored_nonrequired_requisites: [],
    structural_none_evidence: {
      kind: ODU_STRUCTURAL_NONE_KIND,
      course_entry_status: 'published_exact_courseleaf_courseblock',
      finding: 'no_required_prerequisite_corequisite_or_constraint_signal_in_complete_entry_with_same_response_positive_control',
      literal_none_statement: false,
      boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
      receipt_contract: ODU_STRUCTURAL_NONE_RECEIPT_CONTRACT,
      catalog_year: ODU_CATALOG_YEAR,
      source_response_sha256: source.source_response_sha256,
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_html_sha256: entry.raw_entry_html_sha256,
      courseblock_index: entry.courseblock_index,
      published_units: entry.published_units,
      entry_marker_receipt: entry.complete_entry_receipt,
      marker_control: sourceControl,
      inference_boundary: 'This proves only structural silence in one exact complete 2026-2027 ODU CourseLeaf entry whose exact hashed response contains required-prerequisite positive controls. Rows with enrollment, credit, prior-knowledge, or component constraints are excluded from this promotion.',
    },
  };
}

function oldDominionResolutionRowIssues(row) {
  const expected = ROWS[row?.code];
  if (row?.slug !== ODU_SLUG || !expected?.safe_structural_none) return [];
  const source = SOURCES[expected.source];
  const none = row?.structural_none_evidence;
  const control = none?.marker_control;
  const issues = [];
  if (row?.course_key !== `${ODU_OWNER_NAMESPACE}:${row.code}`
      || row?.status !== 'none' || row?.review_status !== 'promoted_structural_none'
      || row?.catalog_year !== ODU_CATALOG_YEAR
      || row?.source_content_sha256 !== expected.raw_entry_sha256
      || row?.review_evidence?.raw_entry_sha256 !== expected.raw_entry_sha256) {
    issues.push('row_contract');
  }
  if (none?.kind !== ODU_STRUCTURAL_NONE_KIND
      || none?.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT
      || none?.receipt_contract !== ODU_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || none?.catalog_year !== ODU_CATALOG_YEAR
      || none?.source_response_sha256 !== source.source_response_sha256
      || none?.raw_entry_sha256 !== expected.raw_entry_sha256
      || none?.raw_entry_html_sha256 !== expected.raw_entry_html_sha256
      || none?.courseblock_index !== expected.courseblock_index
      || none?.entry_marker_receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
      || none?.entry_marker_receipt?.entry_required_requisite_marker_count !== 0
      || none?.entry_marker_receipt?.entry_corequisite_marker_count !== 0
      || none?.entry_marker_receipt?.entry_requisite_marker_like_count !== 0
      || none?.entry_marker_receipt?.entry_constraint_like_signal_count !== 0
      || none?.entry_marker_receipt?.same_source_positive_control !== true) {
    issues.push('structural_none_evidence');
  }
  if (control?.source_response_sha256 !== source.source_response_sha256
      || control?.source_courseblock_count !== source.source_courseblock_count
      || control?.source_complete_entry_count !== source.source_complete_entry_count
      || control?.source_positive_count !== source.source_positive_count
      || control?.positive_control?.course_code !== source.positive_control_code
      || control?.positive_control?.raw_entry_sha256
        !== source.positive_control_raw_entry_sha256
      || control?.positive_control?.raw_entry_html_sha256
        !== source.positive_control_raw_entry_html_sha256
      || sha256(JSON.stringify(control?.positive_control || null))
        !== control?.positive_control_sha256) issues.push('marker_control');
  if (asArray(row?.ignored_nonrequired_requisites).length !== 0) {
    issues.push('unexpected_ignored_signal');
  }
  return [...new Set(issues)].sort();
}

module.exports = {
  ODU_CATALOG_YEAR,
  ODU_OWNER_NAMESPACE,
  ODU_SLUG,
  ODU_STRUCTURAL_NONE_KIND,
  ODU_STRUCTURAL_NONE_RECEIPT_CONTRACT,
  ROWS,
  SOURCES,
  buildOldDominionPrerequisiteMarkerControl,
  buildOldDominionPrerequisiteMarkerControlFromCandidates,
  oldDominionResolutionRowIssues,
  resolveOldDominionPrerequisiteCandidate,
  sha256,
};
