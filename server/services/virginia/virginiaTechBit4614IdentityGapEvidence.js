/**
 * Exact evidence for Virginia Tech's unresolved BIT4614 direct prerequisite
 * row.
 *
 * The same 2026-2027 catalog presents an internally inconsistent identity:
 * the BSCS program page lists BIT 4614 as "Cybersecurity Management II",
 * while the current BIT subject page publishes that title only as BIT 3674
 * and contains no BIT 4614 courseblock.  Plain mentions of BIT 4614 inside
 * other courses' prerequisite text are not course entries and do not prove an
 * alias.  This module records the conflict; it never substitutes BIT3674,
 * applies a historical BIT4614 formula, or changes the verified major core.
 */

const { createHash } = require('node:crypto');

const CONTRACT = 'virginia_tech_bit4614_current_source_identity_conflict_v1';
const SCHOOL_ID = 9230;
const SLUG = 'virginia-polytechnic-institute-and-state-university';
const OWNER = 'va:uni:9230';
const CATALOG_YEAR = '2026-2027';
const COURSE_CODE = 'BIT4614';
const COURSE_KEY = `${OWNER}:${COURSE_CODE}`;

const PROGRAM_URL =
  'https://catalog.vt.edu/undergraduate/college-engineering/computer-science/computer-science-bs/';
const PROGRAM_CACHE_PATH =
  'pages/virginia-polytechnic-institute-and-state-university__program.txt';
const PROGRAM_SHA256 = '5734621e7745782d5018255d94884f5a56c0351dda2e25783fdb14bb945cfcf5';
const PROGRAM_BYTES = 18854;

const BIT_URL =
  'https://catalog.vt.edu/undergraduate/pamplin-college-business/business-information-technology/';
const BIT_CACHE_PATH =
  'university-prerequisites/raw/virginia-polytechnic-institute-and-state-university/virginia-polytechnic-institute-and-state-university__bit_department.html';
const BIT_METADATA_PATH = BIT_CACHE_PATH.replace(/\.html$/, '.json');
const BIT_SHA256 = '2f3257f8f3482845b01345a0c3a70d9597e318d5ec009aac834955eb037de892';
const BIT_BYTES = 104368;

const EXACT_MISSING_REVIEW_ROW_SHA256 =
  '144433867c172709201c70233051222178dfdf0988738bd961369bea1dbb9128';
const EXACT_BIT3674_CANDIDATE_SHA256 =
  '39be8e9634ca4258f3020bda91683e7e38b7501dcc198cefeef2a91701151d93';
const EXACT_BIT4624_CANDIDATE_SHA256 =
  'b5dcdaad7d98aa071bea82405f198881cb7199f43472e7dafb0a3e6fcc1250ca';

const PROGRAM_IDENTITY = Object.freeze({
  code: 'BIT4614',
  displayed_code: 'BIT 4614',
  title: 'Cybersecurity Management II',
  units: 3,
  exact_compact_text: 'BIT 4614Cybersecurity Management II3',
  exact_occurrences: 3,
});

const CURRENT_SUBJECT_IDENTITY = Object.freeze({
  code: 'BIT3674',
  displayed_code: 'BIT 3674',
  title: 'Cybersecurity Management II',
  units: 3,
  courseblock_index: 20,
  raw_entry_sha256: 'ac51a20b75c37ad7a3febe0c5d838b8b7979a69ae25571ecbf1a0b6db9fde360',
  exact_prerequisite: 'BIT 3664',
});

const CROSS_REFERENCE = Object.freeze({
  course_code: 'BIT4624',
  courseblock_index: 33,
  raw_entry_sha256: '40036af83660640651e95f313e655edb19a4664021e92bae22a100098fb78670',
  exact_prerequisite: 'BIT 3674 or BIT 4614 or CS 4264',
  interpretation:
    'A prerequisite-text mention is not a complete BIT4614 course entry and does not authorize an alias.',
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalSha256(value) {
  return sha256(canonicalJson(value));
}

function occurrences(source, needle) {
  if (!needle) throw new Error('empty Virginia Tech evidence needle');
  return String(source).split(needle).length - 1;
}

function exactCandidateField(candidate, kind) {
  const fields = candidate?.source?.structured_requisite_fields || [];
  const matches = fields.filter((field) => field.kind === kind);
  if (matches.length !== 1) return null;
  return matches[0];
}

function evidenceIssues({
  missingReviewRow,
  requirementsDocument,
  programText,
  bitDepartmentHtml,
  bitDepartmentMetadata,
  bit3674Candidate,
  bit4624Candidate,
}) {
  const issues = [];
  const bytes = (value) => (Buffer.isBuffer(value) ? value : Buffer.from(String(value || '')));
  const programBytes = bytes(programText);
  const bitBytes = bytes(bitDepartmentHtml);
  const majorSource = requirementsDocument?.sources?.find((row) => row.id === 'major');

  if (canonicalSha256(missingReviewRow) !== EXACT_MISSING_REVIEW_ROW_SHA256
      || missingReviewRow?.school_id !== SCHOOL_ID
      || missingReviewRow?.slug !== SLUG
      || missingReviewRow?.owner_namespace !== OWNER
      || missingReviewRow?.course_key !== COURSE_KEY
      || missingReviewRow?.code !== COURSE_CODE
      || missingReviewRow?.status !== 'missing'
      || missingReviewRow?.review_reason !== 'direct_code_not_present_as_exact_token_in_cached_source') {
    issues.push('missing_review_row');
  }
  if (requirementsDocument?.slug !== SLUG
      || requirementsDocument?.catalog_year !== CATALOG_YEAR
      || requirementsDocument?.source_url !== PROGRAM_URL
      || majorSource?.url !== PROGRAM_URL
      || majorSource?.catalog_platform !== 'courseleaf'
      || majorSource?.official !== true
      || majorSource?.secure !== true
      || majorSource?.sha256 !== PROGRAM_SHA256) issues.push('program_source_receipt');
  if (programBytes.length !== PROGRAM_BYTES || sha256(programBytes) !== PROGRAM_SHA256) {
    issues.push('program_source_bytes');
  }
  if (occurrences(programText, '2026-2027 Academic Catalog') !== 2
      || occurrences(programText, PROGRAM_IDENTITY.exact_compact_text)
        !== PROGRAM_IDENTITY.exact_occurrences
      || occurrences(programText, PROGRAM_IDENTITY.displayed_code)
        !== PROGRAM_IDENTITY.exact_occurrences
      || occurrences(programText, CURRENT_SUBJECT_IDENTITY.displayed_code) !== 0) {
    issues.push('program_identity_observation');
  }

  if (bitBytes.length !== BIT_BYTES || sha256(bitBytes) !== BIT_SHA256) {
    issues.push('bit_source_bytes');
  }
  if (bitDepartmentMetadata?.requested_url !== BIT_URL
      || bitDepartmentMetadata?.final_url !== BIT_URL
      || bitDepartmentMetadata?.capture_status !== 'official_browser_document_captured'
      || bitDepartmentMetadata?.content_sha256 !== BIT_SHA256
      || bitDepartmentMetadata?.byte_length !== BIT_BYTES
      || bitDepartmentMetadata?.browser_challenge_receipt?.document_responses?.[1]?.http_status !== 200
      || bitDepartmentMetadata?.browser_challenge_receipt?.document_responses?.[1]?.content_sha256
        !== BIT_SHA256
      || bitDepartmentMetadata?.robots_receipt?.parsed_policy?.policy_sha256
        !== '2c04ce7819dae6343b3de23ce69cb667e8313cb1273e43ac620a15c1bfbbc6b1'
      || bitDepartmentMetadata?.robots_receipt?.path_allowed !== true) {
    issues.push('bit_source_receipt');
  }
  if (occurrences(bitDepartmentHtml, '2026-2027 Academic Catalog') !== 4) {
    issues.push('bit_catalog_edition');
  }

  if (canonicalSha256(bit3674Candidate) !== EXACT_BIT3674_CANDIDATE_SHA256
      || bit3674Candidate?.course_code !== CURRENT_SUBJECT_IDENTITY.code
      || bit3674Candidate?.source?.source_response_sha256 !== BIT_SHA256
      || bit3674Candidate?.source?.courseblock_index !== CURRENT_SUBJECT_IDENTITY.courseblock_index
      || bit3674Candidate?.source?.raw_entry_sha256 !== CURRENT_SUBJECT_IDENTITY.raw_entry_sha256
      || !bit3674Candidate?.source?.raw_entry_text?.startsWith(
        'BIT 3674 - Cybersecurity Management II (3 credits)',
      )
      || exactCandidateField(bit3674Candidate, 'prerequisite')?.raw
        !== CURRENT_SUBJECT_IDENTITY.exact_prerequisite) issues.push('bit3674_current_entry');

  if (canonicalSha256(bit4624Candidate) !== EXACT_BIT4624_CANDIDATE_SHA256
      || bit4624Candidate?.course_code !== CROSS_REFERENCE.course_code
      || bit4624Candidate?.source?.source_response_sha256 !== BIT_SHA256
      || bit4624Candidate?.source?.courseblock_index !== CROSS_REFERENCE.courseblock_index
      || bit4624Candidate?.source?.raw_entry_sha256 !== CROSS_REFERENCE.raw_entry_sha256
      || exactCandidateField(bit4624Candidate, 'prerequisite')?.raw
        !== CROSS_REFERENCE.exact_prerequisite) issues.push('bit4614_plain_cross_reference');

  return issues;
}

function auditVirginiaTechBit4614IdentityGap(inputs) {
  const issues = evidenceIssues(inputs);
  if (issues.length) return {
    applicable: true,
    verified: false,
    ready: false,
    course_code: COURSE_CODE,
    issues,
    classification: 'exact_identity_gap_receipt_changed',
  };

  return {
    applicable: true,
    verified: true,
    ready: false,
    course_code: COURSE_CODE,
    course_key: COURSE_KEY,
    issues: ['authoritative_current_source_identity_conflict'],
    classification: 'authoritative_current_source_identity_conflict',
    evidence: {
      contract: CONTRACT,
      catalog_year: CATALOG_YEAR,
      program_source: {
        url: PROGRAM_URL,
        cache_path: PROGRAM_CACHE_PATH,
        sha256: PROGRAM_SHA256,
        bytes: PROGRAM_BYTES,
        identity: PROGRAM_IDENTITY,
      },
      current_bit_subject_source: {
        url: BIT_URL,
        cache_path: BIT_CACHE_PATH,
        metadata_path: BIT_METADATA_PATH,
        sha256: BIT_SHA256,
        bytes: BIT_BYTES,
        courseblock_count: 44,
        complete_entry_count: 44,
        required_requisite_entry_count: 31,
        exact_bit4614_courseblock_count: 0,
        exact_bit3674_courseblock_count: 1,
        current_same_title_entry: CURRENT_SUBJECT_IDENTITY,
        plain_text_bit4614_reference_count: 3,
        cross_reference_control: CROSS_REFERENCE,
      },
    },
    disposition: {
      missing_direct_row_remains: true,
      prerequisite_formula_emitted: false,
      status_none_authorized: false,
      bit3674_substitution_authorized: false,
      title_only_identity_inference_authorized: false,
      historical_bit4614_formula_authorized: false,
      verified_major_core_changed: false,
      sufficient_resolution_evidence: [
        'a corrected current 2026-2027 BSCS program page naming BIT3674',
        'an explicit current registrar crosswalk binding BIT4614 to BIT3674 with an effective catalog term',
        'a complete current BIT4614 course entry',
      ],
      inference_boundary:
        'The matching title and residual prerequisite references make a renumbering/editorial error plausible, but they do not identify which current course the verified BSCS code legally denotes or authorize importing either course\'s prerequisite formula.',
    },
  };
}

module.exports = {
  BIT_BYTES,
  BIT_CACHE_PATH,
  BIT_METADATA_PATH,
  BIT_SHA256,
  BIT_URL,
  CONTRACT,
  COURSE_CODE,
  COURSE_KEY,
  CROSS_REFERENCE,
  CURRENT_SUBJECT_IDENTITY,
  EXACT_BIT3674_CANDIDATE_SHA256,
  EXACT_BIT4624_CANDIDATE_SHA256,
  EXACT_MISSING_REVIEW_ROW_SHA256,
  PROGRAM_BYTES,
  PROGRAM_CACHE_PATH,
  PROGRAM_IDENTITY,
  PROGRAM_SHA256,
  PROGRAM_URL,
  auditVirginiaTechBit4614IdentityGap,
  canonicalSha256,
  evidenceIssues,
  sha256,
};
