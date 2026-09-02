const crypto = require('node:crypto');
const {
  BRIDGEWATER_BOUNDARY_CONTRACT,
  BRIDGEWATER_EDITION_PATH,
  BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT,
  bridgewaterUnmodeledTimingSignals,
  expectedCoursePath,
} = require('./bridgewaterCleanCatalogPrerequisiteAcquisition');

const BRIDGEWATER_SLUG = 'bridgewater-college';
const BRIDGEWATER_OWNER_NAMESPACE = 'va:uni:9205';
const EDITION_RESPONSE_SHA256 =
  '705fb1cad1dab47b0e3b55537d7b84ec57e438263bff73425c08712cdf770825';

const TARGETS = Object.freeze({
  CL100: Object.freeze({
    raw_entry_sha256: 'c288f9be1844b39d67bbc85cdd9dab6f5452c210e53d863447960e6d50372201',
    raw_entry_html_sha256: 'd6526a08bad5ce24b858c6c5c3a904ef256909bc8ec7223125394696b8f9306f',
    source_response_sha256: '739d5c92f1b9601f5b3f7126a4c3282bba18e32b11a7bcd16855393327f1b529',
    timing_signal_codes: Object.freeze(['required_first_semester']),
    signals: Object.freeze([Object.freeze({
      kind: 'required_first_semester_timing',
      raw: 'required first-semester seminar course',
      term_constraint: 'first_semester',
      prerequisite_effect: 'unmodeled',
    })]),
  }),
  CL150: Object.freeze({
    raw_entry_sha256: '117801a7f48368c3e128da470434e7976c16ddadca89154ceebf6768eb349d6e',
    raw_entry_html_sha256: '4bddc0556560bccea7d92394936bb0dc2e989a30eaf48e4c3123c7cb1c771b34',
    source_response_sha256: '770d489f57a3a6d468fd5fef806f7bef042709837fec104bf7b9343ed530cb6d',
    timing_signal_codes: Object.freeze([
      'taken_during_first_semester',
      'taken_in_first_semester',
    ]),
    signals: Object.freeze([
      Object.freeze({
        kind: 'required_first_semester_timing',
        raw: 'It is taken during the student’s first semester on campus.',
        term_constraint: 'first_semester',
        prerequisite_effect: 'unmodeled',
      }),
      Object.freeze({
        kind: 'required_first_semester_timing_restatement',
        raw: 'Taken in a student’s first semester.',
        term_constraint: 'first_semester',
        prerequisite_effect: 'unmodeled',
      }),
      Object.freeze({
        kind: 'intended_audience',
        raw: 'students joining the BC community as transfer students',
        intended_population: 'transfer_students',
        prerequisite_effect: false,
      }),
    ]),
  }),
});

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

function exactSignalReceipts(text, signals) {
  const source = String(text || '');
  const rows = [];
  for (const signal of signals) {
    const first = source.indexOf(signal.raw);
    if (first < 0 || source.indexOf(signal.raw, first + 1) >= 0) return null;
    rows.push({
      ...signal,
      relative_start: first,
      relative_end: first + signal.raw.length,
      raw_sha256: sha256(signal.raw),
    });
  }
  return rows;
}

function auditBridgewaterTimingPrerequisiteCandidate(candidate) {
  const expected = TARGETS[candidate?.course_code];
  const applicable = candidate?.slug === BRIDGEWATER_SLUG && Boolean(expected);
  if (!applicable) return { applicable: false, ready: false, issues: [] };
  const source = candidate?.source || {};
  const receipt = source.requisite_field_receipt;
  const issues = [];
  if (candidate.school_id !== 9205) issues.push('school_id');
  if (candidate.owner_namespace !== BRIDGEWATER_OWNER_NAMESPACE) issues.push('owner_namespace');
  if (candidate.course_key !== `${BRIDGEWATER_OWNER_NAMESPACE}:${candidate.course_code}`) {
    issues.push('course_key');
  }
  if (source.capture_origin !== 'official_cleancatalog_course_page'
      || source.source_format !== 'cleancatalog_course_page'
      || source.boundary_contract !== BRIDGEWATER_BOUNDARY_CONTRACT) issues.push('boundary');
  if (source.catalog_year_verified !== '2026-2027'
      || source.edition_catalog_year !== '2026-2027'
      || source.edition_path !== BRIDGEWATER_EDITION_PATH
      || source.edition_response_sha256 !== EDITION_RESPONSE_SHA256) issues.push('edition');
  if (source.canonical_path !== expectedCoursePath(candidate.course_code)) issues.push('canonical_path');
  if (source.raw_entry_sha256 !== expected.raw_entry_sha256
      || sha256(source.raw_entry_text) !== expected.raw_entry_sha256
      || source.raw_entry_html_sha256 !== expected.raw_entry_html_sha256
      || source.source_response_sha256 !== expected.source_response_sha256) issues.push('source_hash');
  if (receipt?.receipt_contract !== BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT
      || receipt.exact_prerequisite_field_count !== 0
      || receipt.exact_corequisite_field_count !== 0
      || receipt.unrecognized_requisite_like_field_count !== 0
      || !Array.isArray(receipt.requisite_fields) || receipt.requisite_fields.length !== 0) {
    issues.push('requisite_field_receipt');
  }
  const timing = bridgewaterUnmodeledTimingSignals(source.raw_entry_text);
  if (JSON.stringify(timing) !== JSON.stringify(expected.timing_signal_codes)) {
    issues.push('timing_signal_detector');
  }
  const signals = exactSignalReceipts(source.raw_entry_text, expected.signals);
  if (!signals) issues.push('signal_receipt');
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues: [...new Set(issues)].sort(),
    review_reason: 'bridgewater_timing_constraint_receipt_mismatch',
  };
  return {
    applicable: true,
    ready: false,
    issues: [],
    review_reason: 'published_first_semester_timing_constraint_not_modeled_as_prerequisite',
    retained_non_prerequisite_signals: signals,
    blocker_evidence: {
      catalog_year: '2026-2027',
      source_response_sha256: source.source_response_sha256,
      raw_entry_sha256: source.raw_entry_sha256,
      raw_entry_html_sha256: source.raw_entry_html_sha256,
      edition_response_sha256: source.edition_response_sha256,
      requisite_field_receipt: receipt,
      inference_boundary: 'The exact edition-bound entry is structurally silent about prerequisite/corequisite fields, but it publishes a first-semester timing rule. The timing rule is retained and blocks promotion to structural none until the prerequisite analysis has an explicit policy for non-course sequencing constraints.',
    },
  };
}

module.exports = {
  BRIDGEWATER_OWNER_NAMESPACE,
  BRIDGEWATER_SLUG,
  EDITION_RESPONSE_SHA256,
  TARGETS,
  auditBridgewaterTimingPrerequisiteCandidate,
  sha256,
};
