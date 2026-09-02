const crypto = require('node:crypto');
const {
  LONGWOOD_BOUNDARY_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_CONTRACT,
  LONGWOOD_DEPARTMENT_URL,
  LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
  extractLongwoodComputerScienceEntries,
  verifyLongwoodCatalogContext,
} = require('./longwoodDepartmentPrerequisiteAcquisition');
const {
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
  LONGWOOD_BANNER_URL,
  extractLongwoodBannerEntries,
} = require('./longwoodBannerCourseAcquisition');

const LONGWOOD_SLUG = 'longwood-university';
const LONGWOOD_OWNER_NAMESPACE = 'va:uni:9214';
const LONGWOOD_CATALOG_YEAR = '2026-2027';
const LONGWOOD_CATALOG_CONTEXT_SHA256 =
  '1f983cba698cff68f85d60b3735c23d83d5aebcf51f5856b0dc9213dbcf78bc4';
const LONGWOOD_CATALOG_CONTEXT_RELEVANT_SHA256 =
  '6f6b187ac013502368368e7107be737adb3c9b3d449f89feb7bb3f0c869c599f';

const SOURCES = Object.freeze({
  department: Object.freeze({
    official_url: LONGWOOD_DEPARTMENT_URL,
    source_response_sha256: '01802e9aff48430af3064550c8b8bb6eb5011953282e3c18633f16101788609d',
    boundary_contract: LONGWOOD_BOUNDARY_CONTRACT,
    two_source_edition_boundary: LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
    positive_control_code: 'CMSC201',
    positive_control_raw_entry_sha256:
      '29a04b738834c6e33403920fcbe89fab6d5755b0ae17d16d78a490a4c501fda8',
    positive_control_raw_entry_html_sha256:
      '70a5fa7e66b2c81384a3742083fe321eff61a502d8776c9f1ec6eb3db7d0adec',
    positive_control_statement: 'Prerequisite: CMSC 160; CMSC 162 recommended.',
  }),
  banner: Object.freeze({
    official_url: LONGWOOD_BANNER_URL,
    source_response_sha256: '2f4fc77307b8b4f045ed0f3809a6c57e534fbe7145ad8d5142fb1ca7adb37841',
    boundary_contract: LONGWOOD_BANNER_BOUNDARY_CONTRACT,
    two_source_edition_boundary: LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
    positive_control_code: 'MATH250',
    positive_control_raw_entry_sha256:
      'c45dc167fac980735772cf8cd90e07e9d860105dc0d436884bce9dc83ec6da93',
    positive_control_raw_entry_html_sha256:
      'd9e5fd28f7e1254619704c5926084df246a2fad11eed77c1d954edf61c3fe6d6',
    positive_control_statement: 'Prerequisites: MATH 175 or MATH 261.',
  }),
});

const ROWS = Object.freeze({
  CMSC140: Object.freeze({
    source: 'department',
    raw_entry_sha256: '460de2c29cfd071316b38fc27cba8fb97e3ee55b65bbb3158780d6d9230000eb',
    raw_entry_html_sha256: '5660f5f6a7c5466c8b5c4681c92a70380563e46d54628ae15f651d233ea14261',
    signal: Object.freeze({
      kind: 'prior_credit_enrollment_exclusion',
      raw: 'Students may not enroll in this course is CMSC 160 has already been completed.',
      excluded_if_completed_course_code: 'CMSC160',
      source_typo_preserved: true,
      prerequisite_effect: false,
    }),
  }),
  CMSC160: Object.freeze({
    source: 'department',
    raw_entry_sha256: 'de8d6271ef988a39552f6463b8e73f9d14cfe80eaed17e25a88ea24e43348152',
    raw_entry_html_sha256: 'caf07a2c963aaa504a853fd845b145ac210673ddff6d7a092c2257394719ab7b',
    corequisite_statement: 'Corequisite: CMSC 161.',
    corequisite_raw: 'CMSC 161',
    corequisite_paths: Object.freeze([Object.freeze(['CMSC161'])]),
  }),
  CMSC161: Object.freeze({
    source: 'department',
    raw_entry_sha256: '10295c6ea3900e21294d7151dd2feb8d16588a345aaa23568c64cac9fd9511d7',
    raw_entry_html_sha256: '6cd8233fa3996087b0e58377ae7bf877a39c140ead472cecbab0bc014dbbe462',
    corequisite_statement: 'Co-requisites: CMSC 160 or CMSC 162.',
    corequisite_raw: 'CMSC 160 or CMSC 162',
    corequisite_paths: Object.freeze([
      Object.freeze(['CMSC160']),
      Object.freeze(['CMSC162']),
    ]),
  }),
  CMSC483: Object.freeze({
    source: 'department',
    raw_entry_sha256: '47479abd4fae7821490d1576a59e0a839b9aab3720a9c39cd4ec7040554ec3bb',
    raw_entry_html_sha256: '89732f97c63d4933f9d3536d24d94e4b3ed6f4b2e7467ca5079e8f4d1043d983',
  }),
  CTZN110: Object.freeze({
    source: 'banner',
    raw_entry_sha256: 'ba37517f58aeb2b78218703205e55ef0d8feded40a34c816553f306ea0c7406a',
    raw_entry_html_sha256: 'a84282b41156baf33852b636253072f6a5a32c0745dd0a62ed9a5c9f6fa94025',
  }),
  ENGL165: Object.freeze({
    source: 'banner',
    raw_entry_sha256: '46a2f20d6b0dd18c22e4bef38535c5c034868dc2713f3fffbe634706aabf600c',
    raw_entry_html_sha256: '3f746b860235fbcba16d45d9872e5661dc2faff8f9dc86957351791b9507b8a9',
  }),
  MATH171: Object.freeze({
    source: 'banner',
    raw_entry_sha256: '30df1b0ae7df77462f86d49e88e4264daefeec42f4bfde5bd88d8fc7b0384e0a',
    raw_entry_html_sha256: '8443afe0a4b237e5273298a2b29a1e64a1581fff9f1e7bef73f5204f1b2a7dda',
  }),
  MATH175: Object.freeze({
    source: 'banner',
    raw_entry_sha256: 'ff7f6368ad54e7d011f4bf0f261c4cccadb6943bc228469e46654f5e3e4cabe8',
    raw_entry_html_sha256: '14da2732fbcd4e77cc9bfd6f2ae5016780abbc4cc44aed9f3825f347d52c4dda',
  }),
});

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function exactUniqueOffset(text, statement) {
  const source = String(text || '');
  const first = source.indexOf(statement);
  return first >= 0 && source.indexOf(statement, first + 1) < 0 ? first : -1;
}

function corequisiteGroup(code, expected, rawText) {
  if (!expected.corequisite_statement) return null;
  const statementStart = exactUniqueOffset(rawText, expected.corequisite_statement);
  const rawStart = exactUniqueOffset(rawText, expected.corequisite_raw);
  if (statementStart < 0 || rawStart < statementStart) return null;
  return {
    id: `${LONGWOOD_OWNER_NAMESPACE}:${code}:corequisite:0`,
    kind: 'corequisite',
    raw: expected.corequisite_raw,
    flags: [
      'strict_full_text_accounting',
      'source:longwood-university',
      'longwood_exact_unversioned_page_corequisite_only',
    ],
    formula: 'paths_or__conditions_and',
    paths: expected.corequisite_paths.map((codes, index) => ({
      id: `${LONGWOOD_OWNER_NAMESPACE}:${code}:corequisite:0:path:${index}`,
      raw: expected.corequisite_raw,
      all_of: codes.map((courseCode) => ({
        type: 'course',
        code: courseCode,
        course_key: `${LONGWOOD_OWNER_NAMESPACE}:${courseCode}`,
        raw: courseCode.replace(/^(CMSC)(\d+)$/, '$1 $2'),
      })),
    })),
    source_receipt: {
      statement_relative_start: statementStart,
      statement_relative_end: statementStart + expected.corequisite_statement.length,
      raw_relative_start: rawStart,
      raw_relative_end: rawStart + expected.corequisite_raw.length,
      statement_sha256: sha256(expected.corequisite_statement),
      raw_sha256: sha256(expected.corequisite_raw),
    },
  };
}

function exactSignalReceipt(entry, expected) {
  if (!expected.signal) return null;
  const start = exactUniqueOffset(entry.raw_entry_text, expected.signal.raw);
  if (start < 0) return undefined;
  return {
    ...expected.signal,
    relative_start: start,
    relative_end: start + expected.signal.raw.length,
    raw_sha256: sha256(expected.signal.raw),
  };
}

function buildLongwoodPrerequisiteClosureControl({
  departmentHtml,
  bannerHtml,
  catalogContextHtml,
} = {}) {
  const htmlBySource = {
    department: String(departmentHtml || ''),
    banner: String(bannerHtml || ''),
  };
  const issues = [];
  if (sha256(catalogContextHtml) !== LONGWOOD_CATALOG_CONTEXT_SHA256) {
    issues.push('catalog_context:source_hash');
  }
  const context = verifyLongwoodCatalogContext(
    catalogContextHtml, LONGWOOD_CATALOG_YEAR, 19,
  );
  if (!context.verified
      || context.relevant_context_sha256 !== LONGWOOD_CATALOG_CONTEXT_RELEVANT_SHA256) {
    issues.push('catalog_context:edition_receipt');
  }
  const entries = {};
  const sourceControls = {};
  for (const [sourceKey, source] of Object.entries(SOURCES)) {
    const html = htmlBySource[sourceKey];
    if (sha256(html) !== source.source_response_sha256) issues.push(`${sourceKey}:source_hash`);
    const rowCodes = Object.entries(ROWS).filter(([, row]) => row.source === sourceKey)
      .map(([code]) => code);
    const codes = [...rowCodes, source.positive_control_code];
    const extraction = sourceKey === 'department'
      ? extractLongwoodComputerScienceEntries(html, codes)
      : extractLongwoodBannerEntries(html, codes);
    if (!extraction.verified || extraction.missing.length) issues.push(`${sourceKey}:entry_boundary`);
    const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
    for (const code of rowCodes) {
      const expected = ROWS[code];
      const entry = byCode.get(code);
      const group = entry ? corequisiteGroup(code, expected, entry.raw_entry_text) : null;
      const signal = entry ? exactSignalReceipt(entry, expected) : undefined;
      if (!entry || entry.raw_entry_sha256 !== expected.raw_entry_sha256
          || sha256(entry.raw_entry_text) !== expected.raw_entry_sha256
          || entry.raw_entry_html_sha256 !== expected.raw_entry_html_sha256
          || (expected.corequisite_statement && !group)
          || signal === undefined) {
        issues.push(`${code}:exact_entry`);
        continue;
      }
      entries[code] = {
        course_key: `${LONGWOOD_OWNER_NAMESPACE}:${code}`,
        course_code: code,
        source_key: sourceKey,
        source_response_sha256: source.source_response_sha256,
        raw_entry_sha256: entry.raw_entry_sha256,
        raw_entry_html_sha256: entry.raw_entry_html_sha256,
        published_units: entry.published_units,
        preserved_corequisite_groups: group ? [group] : [],
        retained_non_prerequisite_signals: signal ? [signal] : [],
      };
    }
    const positive = byCode.get(source.positive_control_code);
    if (!positive
        || positive.raw_entry_sha256 !== source.positive_control_raw_entry_sha256
        || positive.raw_entry_html_sha256 !== source.positive_control_raw_entry_html_sha256
        || exactUniqueOffset(positive.raw_entry_text, source.positive_control_statement) < 0) {
      issues.push(`${sourceKey}:positive_control`);
    }
    const positiveControl = positive ? {
      course_key: `${LONGWOOD_OWNER_NAMESPACE}:${source.positive_control_code}`,
      raw_entry_sha256: positive.raw_entry_sha256,
      raw_entry_html_sha256: positive.raw_entry_html_sha256,
      prerequisite_statement: source.positive_control_statement,
      prerequisite_statement_sha256: sha256(source.positive_control_statement),
    } : null;
    sourceControls[sourceKey] = {
      official_url: source.official_url,
      source_response_sha256: source.source_response_sha256,
      boundary_contract: source.boundary_contract,
      same_page_positive_control: true,
      positive_control: positiveControl,
      positive_control_sha256: sha256(JSON.stringify(positiveControl)),
      course_entry_page_catalog_year_statement: null,
      exact_catalog_edition_binding: false,
      separate_catalog_context: {
        contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
        catalog_year: LONGWOOD_CATALOG_YEAR,
        catoid: 19,
        source_sha256: LONGWOOD_CATALOG_CONTEXT_SHA256,
        relevant_context_sha256: LONGWOOD_CATALOG_CONTEXT_RELEVANT_SHA256,
      },
      two_source_edition_boundary: source.two_source_edition_boundary,
    };
  }
  const receipt = {
    catalog_year_context: LONGWOOD_CATALOG_YEAR,
    exact_course_entry_edition_binding: false,
    sources: sourceControls,
    sources_sha256: sha256(JSON.stringify(sourceControls)),
    entries,
    entries_sha256: sha256(JSON.stringify(entries)),
  };
  return {
    verified: issues.length === 0 && Object.keys(entries).length === Object.keys(ROWS).length,
    issues: [...new Set(issues)].sort(),
    receipt,
  };
}

function exactLongwoodCandidate(candidates, code) {
  const rows = asArray(candidates).filter((row) => (
    row?.slug === LONGWOOD_SLUG
      && row?.owner_namespace === LONGWOOD_OWNER_NAMESPACE
      && row?.course_code === code
  ));
  return rows.length === 1 ? rows[0] : null;
}

/** Replays the two-source boundary receipt from the immutable candidate rows. */
function buildLongwoodPrerequisiteClosureControlFromCandidates(candidates) {
  const issues = [];
  const entries = {};
  const sourceControls = {};
  for (const [sourceKey, sourceExpected] of Object.entries(SOURCES)) {
    const rowCodes = Object.entries(ROWS).filter(([, row]) => row.source === sourceKey)
      .map(([code]) => code);
    for (const code of rowCodes) {
      const expected = ROWS[code];
      const candidate = exactLongwoodCandidate(candidates, code);
      const source = candidate?.source || {};
      const group = candidate
        ? corequisiteGroup(code, expected, source.raw_entry_text) : null;
      const signal = candidate
        ? exactSignalReceipt({ raw_entry_text: source.raw_entry_text }, expected) : undefined;
      if (!candidate || candidate.school_id !== 9214
          || candidate.course_key !== `${LONGWOOD_OWNER_NAMESPACE}:${code}`
          || source.catalog_year_verified !== LONGWOOD_CATALOG_YEAR
          || source.official_url !== sourceExpected.official_url
          || source.boundary_contract !== sourceExpected.boundary_contract
          || source.two_source_edition_boundary !== sourceExpected.two_source_edition_boundary
          || source.department_page_catalog_year_statement !== null
          || source.source_response_sha256 !== sourceExpected.source_response_sha256
          || source.raw_entry_sha256 !== expected.raw_entry_sha256
          || sha256(source.raw_entry_text) !== expected.raw_entry_sha256
          || source.raw_entry_html_sha256 !== expected.raw_entry_html_sha256
          || source.catalog_context_contract !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
          || source.catalog_context_catalog_year !== LONGWOOD_CATALOG_YEAR
          || source.catalog_context_catoid !== 19
          || source.catalog_context_html_sha256 !== LONGWOOD_CATALOG_CONTEXT_SHA256
          || source.catalog_context_relevant_sha256
            !== LONGWOOD_CATALOG_CONTEXT_RELEVANT_SHA256
          || (expected.corequisite_statement && !group)
          || signal === undefined) {
        issues.push(`${code}:exact_candidate`);
        continue;
      }
      entries[code] = {
        course_key: candidate.course_key,
        course_code: code,
        source_key: sourceKey,
        source_response_sha256: sourceExpected.source_response_sha256,
        raw_entry_sha256: source.raw_entry_sha256,
        raw_entry_html_sha256: source.raw_entry_html_sha256,
        published_units: source.published_units,
        preserved_corequisite_groups: group ? [group] : [],
        retained_non_prerequisite_signals: signal ? [signal] : [],
      };
    }
    const positive = exactLongwoodCandidate(candidates, sourceExpected.positive_control_code);
    const positiveSource = positive?.source || {};
    if (!positive || positiveSource.official_url !== sourceExpected.official_url
        || positiveSource.boundary_contract !== sourceExpected.boundary_contract
        || positiveSource.source_response_sha256 !== sourceExpected.source_response_sha256
        || positiveSource.raw_entry_sha256 !== sourceExpected.positive_control_raw_entry_sha256
        || sha256(positiveSource.raw_entry_text)
          !== sourceExpected.positive_control_raw_entry_sha256
        || positiveSource.raw_entry_html_sha256
          !== sourceExpected.positive_control_raw_entry_html_sha256
        || positiveSource.catalog_context_html_sha256 !== LONGWOOD_CATALOG_CONTEXT_SHA256
        || positiveSource.catalog_context_relevant_sha256
          !== LONGWOOD_CATALOG_CONTEXT_RELEVANT_SHA256
        || positiveSource.department_page_catalog_year_statement !== null
        || positive.prerequisite_marker_count !== 1
        || exactUniqueOffset(
          positiveSource.raw_entry_text, sourceExpected.positive_control_statement,
        ) < 0) issues.push(`${sourceKey}:positive_control`);
    const positiveControl = positive ? {
      course_key: positive.course_key,
      raw_entry_sha256: positiveSource.raw_entry_sha256,
      raw_entry_html_sha256: positiveSource.raw_entry_html_sha256,
      prerequisite_statement: sourceExpected.positive_control_statement,
      prerequisite_statement_sha256: sha256(sourceExpected.positive_control_statement),
    } : null;
    sourceControls[sourceKey] = {
      official_url: sourceExpected.official_url,
      source_response_sha256: sourceExpected.source_response_sha256,
      boundary_contract: sourceExpected.boundary_contract,
      same_page_positive_control: true,
      positive_control: positiveControl,
      positive_control_sha256: sha256(JSON.stringify(positiveControl)),
      course_entry_page_catalog_year_statement: null,
      exact_catalog_edition_binding: false,
      separate_catalog_context: {
        contract: LONGWOOD_CATALOG_CONTEXT_CONTRACT,
        catalog_year: LONGWOOD_CATALOG_YEAR,
        catoid: 19,
        source_sha256: LONGWOOD_CATALOG_CONTEXT_SHA256,
        relevant_context_sha256: LONGWOOD_CATALOG_CONTEXT_RELEVANT_SHA256,
      },
      two_source_edition_boundary: sourceExpected.two_source_edition_boundary,
    };
  }
  const receipt = {
    catalog_year_context: LONGWOOD_CATALOG_YEAR,
    exact_course_entry_edition_binding: false,
    sources: sourceControls,
    sources_sha256: sha256(JSON.stringify(sourceControls)),
    entries,
    entries_sha256: sha256(JSON.stringify(entries)),
  };
  return {
    verified: issues.length === 0 && Object.keys(entries).length === Object.keys(ROWS).length,
    issues: [...new Set(issues)].sort(),
    receipt,
  };
}

function auditLongwoodPrerequisiteCandidate(candidate, control) {
  const expected = ROWS[candidate?.course_code];
  const applicable = candidate?.slug === LONGWOOD_SLUG && Boolean(expected);
  if (!applicable) return { applicable: false, ready: false, issues: [] };
  const source = candidate?.source || {};
  const sourceExpected = SOURCES[expected.source];
  const receipt = control?.receipt;
  const entry = receipt?.entries?.[candidate.course_code];
  const sourceControl = receipt?.sources?.[expected.source];
  const issues = [];
  if (candidate.school_id !== 9214 || candidate.owner_namespace !== LONGWOOD_OWNER_NAMESPACE
      || candidate.course_key !== `${LONGWOOD_OWNER_NAMESPACE}:${candidate.course_code}`) {
    issues.push('owner_identity');
  }
  if (source.catalog_year_verified !== LONGWOOD_CATALOG_YEAR
      || source.official_url !== sourceExpected.official_url
      || source.boundary_contract !== sourceExpected.boundary_contract
      || source.two_source_edition_boundary !== sourceExpected.two_source_edition_boundary
      || source.department_page_catalog_year_statement !== null) issues.push('source_boundary');
  if (source.source_response_sha256 !== sourceExpected.source_response_sha256
      || source.raw_entry_sha256 !== expected.raw_entry_sha256
      || sha256(source.raw_entry_text) !== expected.raw_entry_sha256
      || source.raw_entry_html_sha256 !== expected.raw_entry_html_sha256) issues.push('source_hash');
  if (control?.verified !== true || asArray(control?.issues).length
      || receipt?.exact_course_entry_edition_binding !== false
      || sha256(JSON.stringify(receipt?.sources || null)) !== receipt?.sources_sha256
      || sha256(JSON.stringify(receipt?.entries || null)) !== receipt?.entries_sha256
      || entry?.course_key !== candidate.course_key
      || entry?.raw_entry_sha256 !== source.raw_entry_sha256
      || sourceControl?.source_response_sha256 !== source.source_response_sha256
      || sourceControl?.same_page_positive_control !== true
      || sourceControl?.exact_catalog_edition_binding !== false
      || sha256(JSON.stringify(sourceControl?.positive_control || null))
        !== sourceControl?.positive_control_sha256) issues.push('control_receipt');
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues: [...new Set(issues)].sort(),
    review_reason: 'longwood_exact_entry_or_context_receipt_mismatch',
  };
  let reviewReason = 'unversioned_course_entry_silence_not_catalog_edition_proof';
  if (entry.preserved_corequisite_groups.length) {
    reviewReason = 'corequisite_preserved_but_prerequisite_absence_not_catalog_edition_bound';
  } else if (entry.retained_non_prerequisite_signals.length) {
    reviewReason = 'enrollment_restriction_preserved_and_prerequisite_absence_not_catalog_edition_bound';
  }
  return {
    applicable: true,
    ready: false,
    issues: [],
    review_reason: reviewReason,
    preserved_corequisite_groups: entry.preserved_corequisite_groups,
    retained_non_prerequisite_signals: entry.retained_non_prerequisite_signals,
    blocker_evidence: {
      source_response_sha256: entry.source_response_sha256,
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_html_sha256: entry.raw_entry_html_sha256,
      same_page_positive_control: sourceControl.positive_control,
      separate_catalog_context: sourceControl.separate_catalog_context,
      exact_catalog_edition_binding: false,
      inference_boundary: 'The first-party course entry and same-page prerequisite marker control are exact, but the course-listing page is unversioned. The separately retained 2026-2027 catoid-19 landing page does not prove that this entry belongs to that edition, so silence cannot be promoted to structural none. Any printed corequisite or enrollment restriction remains preserved.',
    },
  };
}

module.exports = {
  LONGWOOD_CATALOG_CONTEXT_RELEVANT_SHA256,
  LONGWOOD_CATALOG_CONTEXT_SHA256,
  LONGWOOD_CATALOG_YEAR,
  LONGWOOD_OWNER_NAMESPACE,
  LONGWOOD_SLUG,
  ROWS,
  SOURCES,
  auditLongwoodPrerequisiteCandidate,
  buildLongwoodPrerequisiteClosureControl,
  buildLongwoodPrerequisiteClosureControlFromCandidates,
  sha256,
};
