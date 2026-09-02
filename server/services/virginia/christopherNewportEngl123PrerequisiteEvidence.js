const crypto = require('node:crypto');
const {
  CNU_BOUNDARY_CONTRACT,
  CNU_EXPECTED_PDF_SHA256,
} = require('./cnuPdfPrerequisiteAcquisition');

const CNU_ENGL123_STRUCTURAL_NONE_KIND =
  'official_complete_cnu_pdf_entry_structural_silence_with_same_pdf_positive_control';
const CNU_ENGL123_STRUCTURAL_NONE_RECEIPT_CONTRACT =
  'cnu_2025_2026_engl123_complete_pdf_entry_same_pdf_prerequisite_positive_control_v1';

const TARGET = Object.freeze({
  school_id: 9206,
  slug: 'christopher-newport-university',
  owner_namespace: 'va:uni:9206',
  course_key: 'va:uni:9206:ENGL123',
  course_code: 'ENGL123',
  catalog_year: '2025-2026',
  official_url:
    'https://cnu.edu/public/_documents/undergrad-catalog/2025-26-undergraduate_catalog.pdf#page=271',
  heading_text: 'ENGL 123. First-Year Writing Seminar (3-3-0)',
  raw_entry_sha256: '8be62f60906ef3d894446868205c5726ddb620e23e2b091d223a683f4b29124d',
  bbox_layout_sha256: '1156fb942db6673f24ea89c2958e3bc8d5e669593d710e4329651f45a6dfc342',
  pdf_page_start: 107,
  pdf_page_end: 107,
  page_column_span: Object.freeze(['107:right']),
  source_block_sha256:
    '8be62f60906ef3d894446868205c5726ddb620e23e2b091d223a683f4b29124d',
});

const POSITIVE_CONTROL = Object.freeze({
  course_key: 'va:uni:9206:ENGL223',
  course_code: 'ENGL223',
  heading_text: 'ENGL 223. Second-Year Writing Seminar (3-3-0)',
  raw_entry_sha256: 'e50a70fe8fdaa35d9945b0fbab7f9213d8bfe2d507d7a5e2411a25dd338e07da',
  pdf_page_start: 109,
  pdf_page_end: 109,
  page_column_span: Object.freeze(['109:left']),
  prerequisite_statement:
    'Prerequisites: ENGL 123 with a C- or higher and\nsophomore standing.',
  prerequisite_raw: 'ENGL 123 with a C- or higher and\nsophomore standing',
});

const RETAINED_NON_PREREQUISITE_SIGNAL = Object.freeze({
  kind: 'degree_completion_minimum_grade',
  raw: 'Students must earn a C- or higher to satisfy University\ndegree requirements.',
  minimum_grade: 'C-',
  applies_to: 'university_degree_requirements',
  prerequisite_effect: false,
});

const RETAINED_FORWARD_RELATIONSHIP_SIGNAL = Object.freeze({
  kind: 'descriptive_forward_course_relationship',
  raw: 'The course\noffers students frequent written and oral feedback on their\nwriting and prepares students for the Second-Year Writing\nSeminar by providing guidance for students to incorporate\nmultiple print and electronic resources into their writing.',
  related_course_code: 'ENGL223',
  formal_recommendation: false,
  prerequisite_effect: false,
});

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function exactUniqueOffset(text, statement) {
  const first = String(text || '').indexOf(statement);
  return first >= 0 && String(text || '').indexOf(statement, first + 1) < 0 ? first : -1;
}

function baseCandidateIssues(candidate, expected) {
  const source = candidate?.source || {};
  const issues = [];
  if (candidate?.school_id !== TARGET.school_id) issues.push('school_id');
  if (candidate?.slug !== TARGET.slug) issues.push('slug');
  if (candidate?.owner_namespace !== TARGET.owner_namespace) issues.push('owner_namespace');
  if (candidate?.course_key !== expected.course_key) issues.push('course_key');
  if (candidate?.course_code !== expected.course_code) issues.push('course_code');
  if (source.capture_origin !== 'retained_official_pdf_bbox') issues.push('capture_origin');
  if (source.boundary_contract !== CNU_BOUNDARY_CONTRACT) issues.push('boundary_contract');
  if (source.source_format !== 'pdf_bbox_columns') issues.push('source_format');
  if (source.catalog_year_verified !== TARGET.catalog_year) issues.push('catalog_year');
  if (source.official_url !== TARGET.official_url) issues.push('official_url');
  if (source.pdf_sha256 !== CNU_EXPECTED_PDF_SHA256
      || source.source_response_sha256 !== CNU_EXPECTED_PDF_SHA256
      || source.declared_normalized_text_sha256 !== CNU_EXPECTED_PDF_SHA256
      || source.retained_normalized_text_sha256 !== CNU_EXPECTED_PDF_SHA256) {
    issues.push('pdf_identity');
  }
  if (source.bbox_layout_sha256 !== TARGET.bbox_layout_sha256) issues.push('bbox_layout');
  if (source.heading_text !== expected.heading_text) issues.push('heading_text');
  if (source.raw_entry_sha256 !== expected.raw_entry_sha256
      || sha256(source.raw_entry_text) !== expected.raw_entry_sha256) {
    issues.push('raw_entry');
  }
  if (source.pdf_page_start !== expected.pdf_page_start
      || source.pdf_page_end !== expected.pdf_page_end
      || JSON.stringify(source.page_column_span) !== JSON.stringify(expected.page_column_span)) {
    issues.push('page_boundary');
  }
  if (!source.published_units || source.published_units.credit_hours_min !== 3
      || source.published_units.credit_hours_max !== 3
      || source.published_units.notation !== '(3-3-0)') issues.push('published_units');
  const blocks = asArray(source.source_blocks);
  if (blocks.length !== 1
      || blocks[0]?.pdf_page !== expected.pdf_page_start
      || blocks[0]?.column !== expected.page_column_span[0].split(':')[1]
      || blocks[0]?.raw_text_sha256 !== expected.raw_entry_sha256) issues.push('source_blocks');
  return issues;
}

function cnuEngl123MarkerControl(candidates) {
  const rows = asArray(candidates);
  const targetRows = rows.filter((row) => row?.course_key === TARGET.course_key);
  const controlRows = rows.filter((row) => row?.course_key === POSITIVE_CONTROL.course_key);
  const issues = [];
  if (targetRows.length !== 1) issues.push('unique_target');
  if (controlRows.length !== 1) issues.push('unique_positive_control');
  const target = targetRows[0];
  const control = controlRows[0];
  if (target) issues.push(...baseCandidateIssues(target, TARGET).map((issue) => `target:${issue}`));
  if (control) {
    issues.push(...baseCandidateIssues(control, {
      ...POSITIVE_CONTROL,
    }).map((issue) => `positive_control:${issue}`));
    const text = control.source?.raw_entry_text || '';
    if (exactUniqueOffset(text, POSITIVE_CONTROL.prerequisite_statement) < 0
        || exactUniqueOffset(text, POSITIVE_CONTROL.prerequisite_raw) < 0
        || control.prerequisite_marker_count !== 1
        || control.corequisite_marker_count !== 0) {
      issues.push('positive_control:required_prerequisite_statement');
    }
  }
  if (target) {
    const text = target.source?.raw_entry_text || '';
    if (/\b(?:Pre|Co)(?:-|\s*)requisites?\s*:/i.test(text)
        || target.prerequisite_marker_count !== 0
        || target.corequisite_marker_count !== 0) issues.push('target:requisite_marker');
    if (exactUniqueOffset(text, RETAINED_NON_PREREQUISITE_SIGNAL.raw) < 0) {
      issues.push('target:degree_grade_signal');
    }
    if (exactUniqueOffset(text, RETAINED_FORWARD_RELATIONSHIP_SIGNAL.raw) < 0) {
      issues.push('target:forward_relationship_signal');
    }
  }
  if (target && control && target.source.pdf_sha256 !== control.source.pdf_sha256) {
    issues.push('same_pdf');
  }
  if (issues.length) return { verified: false, issues };

  const signals = [
    RETAINED_NON_PREREQUISITE_SIGNAL,
    RETAINED_FORWARD_RELATIONSHIP_SIGNAL,
  ].map((signal) => {
    const start = exactUniqueOffset(target.source.raw_entry_text, signal.raw);
    return {
      ...signal,
      relative_start: start,
      relative_end: start + signal.raw.length,
      raw_sha256: sha256(signal.raw),
    };
  });
  const positive = {
    course_key: control.course_key,
    raw_entry_sha256: control.source.raw_entry_sha256,
    heading_text: control.source.heading_text,
    pdf_page_start: control.source.pdf_page_start,
    pdf_page_end: control.source.pdf_page_end,
    page_column_span: control.source.page_column_span,
    prerequisite_statement: POSITIVE_CONTROL.prerequisite_statement,
    prerequisite_statement_sha256: sha256(POSITIVE_CONTROL.prerequisite_statement),
  };
  const receipt = {
    receipt_contract: CNU_ENGL123_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    same_pdf_positive_control: true,
    catalog_year: TARGET.catalog_year,
    pdf_sha256: CNU_EXPECTED_PDF_SHA256,
    bbox_layout_sha256: TARGET.bbox_layout_sha256,
    target_course_key: target.course_key,
    target_raw_entry_sha256: target.source.raw_entry_sha256,
    target_requisite_marker_count: 0,
    target_corequisite_marker_count: 0,
    positive_control: positive,
    positive_control_sha256: sha256(JSON.stringify(positive)),
    retained_non_prerequisite_signals: signals,
    retained_non_prerequisite_signals_sha256: sha256(JSON.stringify(signals)),
  };
  return { verified: true, issues: [], receipt };
}

function resolveCnuEngl123Prerequisite(candidate, markerControl) {
  const applicable = candidate?.slug === TARGET.slug && candidate?.course_code === TARGET.course_code;
  if (!applicable) return { applicable: false, ready: false, issues: [] };
  const issues = baseCandidateIssues(candidate, TARGET);
  const source = candidate.source || {};
  const control = markerControl?.receipt;
  if (markerControl?.verified !== true || asArray(markerControl?.issues).length) {
    issues.push('marker_control_not_verified');
  }
  if (control?.receipt_contract !== CNU_ENGL123_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || control?.same_pdf_positive_control !== true
      || control?.pdf_sha256 !== source.pdf_sha256
      || control?.bbox_layout_sha256 !== source.bbox_layout_sha256
      || control?.target_course_key !== candidate.course_key
      || control?.target_raw_entry_sha256 !== source.raw_entry_sha256
      || control?.target_requisite_marker_count !== 0
      || control?.target_corequisite_marker_count !== 0
      || control?.positive_control?.course_key !== POSITIVE_CONTROL.course_key
      || control?.positive_control?.raw_entry_sha256 !== POSITIVE_CONTROL.raw_entry_sha256
      || sha256(JSON.stringify(control?.positive_control || null))
        !== control?.positive_control_sha256
      || !Array.isArray(control?.retained_non_prerequisite_signals)
      || control.retained_non_prerequisite_signals.length !== 2
      || sha256(JSON.stringify(control.retained_non_prerequisite_signals))
        !== control.retained_non_prerequisite_signals_sha256) {
    issues.push('marker_control_receipt');
  }
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues: [...new Set(issues)].sort(),
    review_reason: 'cnu_engl123_exact_structural_none_receipt_mismatch',
  };
  return {
    applicable: true,
    ready: true,
    issues: [],
    status: 'none',
    review_status: 'promoted_structural_none',
    review_reason: 'complete_cnu_pdf_entry_silence_with_same_pdf_prerequisite_positive_control',
    ignored_nonrequired_requisites: control.retained_non_prerequisite_signals,
    structural_none_evidence: {
      kind: CNU_ENGL123_STRUCTURAL_NONE_KIND,
      course_entry_status: 'published_exact_cnu_pdf_bbox_entry',
      finding: 'no_required_prerequisite_or_corequisite_marker_in_complete_entry_with_same_pdf_positive_control',
      literal_none_statement: false,
      boundary_contract: CNU_BOUNDARY_CONTRACT,
      receipt_contract: CNU_ENGL123_STRUCTURAL_NONE_RECEIPT_CONTRACT,
      source_response_sha256: source.source_response_sha256,
      raw_entry_sha256: source.raw_entry_sha256,
      pdf_sha256: source.pdf_sha256,
      bbox_layout_sha256: source.bbox_layout_sha256,
      pdf_page_start: source.pdf_page_start,
      pdf_page_end: source.pdf_page_end,
      page_column_span: source.page_column_span,
      published_units: source.published_units,
      marker_control: control,
      inference_boundary: 'This proves only that the exact complete ENGL 123 entry in the pinned 2025-2026 CNU PDF publishes no prerequisite or corequisite marker while an exact complete entry in the same PDF publishes one. The degree-completion C- statement is retained separately and is not reclassified as an enrollment prerequisite.',
    },
  };
}

function cnuEngl123ResolutionRowIssues(row) {
  if (row?.course_key !== TARGET.course_key) return [];
  const none = row?.structural_none_evidence;
  const control = none?.marker_control;
  const issues = [];
  if (row?.status !== 'none' || row?.review_status !== 'promoted_structural_none'
      || row?.catalog_year !== TARGET.catalog_year
      || row?.source_content_sha256 !== TARGET.raw_entry_sha256
      || row?.review_evidence?.raw_entry_sha256 !== TARGET.raw_entry_sha256) issues.push('row_contract');
  if (none?.kind !== CNU_ENGL123_STRUCTURAL_NONE_KIND
      || none?.boundary_contract !== CNU_BOUNDARY_CONTRACT
      || none?.receipt_contract !== CNU_ENGL123_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || none?.source_response_sha256 !== CNU_EXPECTED_PDF_SHA256
      || none?.raw_entry_sha256 !== TARGET.raw_entry_sha256
      || none?.pdf_sha256 !== CNU_EXPECTED_PDF_SHA256
      || none?.bbox_layout_sha256 !== TARGET.bbox_layout_sha256
      || none?.pdf_page_start !== TARGET.pdf_page_start
      || none?.pdf_page_end !== TARGET.pdf_page_end
      || JSON.stringify(none?.page_column_span) !== JSON.stringify(TARGET.page_column_span)) {
    issues.push('structural_none_evidence');
  }
  if (control?.receipt_contract !== CNU_ENGL123_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || control?.target_course_key !== TARGET.course_key
      || control?.target_raw_entry_sha256 !== TARGET.raw_entry_sha256
      || control?.target_requisite_marker_count !== 0
      || control?.target_corequisite_marker_count !== 0
      || control?.positive_control?.course_key !== POSITIVE_CONTROL.course_key
      || control?.positive_control?.raw_entry_sha256 !== POSITIVE_CONTROL.raw_entry_sha256
      || sha256(JSON.stringify(control?.positive_control || null))
        !== control?.positive_control_sha256
      || sha256(JSON.stringify(control?.retained_non_prerequisite_signals || null))
        !== control?.retained_non_prerequisite_signals_sha256) issues.push('marker_control');
  const ignored = asArray(row?.ignored_nonrequired_requisites);
  if (ignored.length !== 2 || ignored.some((signal) => (
    sha256(signal?.raw) !== signal?.raw_sha256
      || row?.review_evidence?.raw_entry_text?.slice(
        signal.source_character_start - row.review_evidence.entry_character_start,
        signal.source_character_end - row.review_evidence.entry_character_start,
      ) !== signal.raw
  ))) issues.push('retained_non_prerequisite_signals');
  return [...new Set(issues)].sort();
}

module.exports = {
  CNU_ENGL123_STRUCTURAL_NONE_KIND,
  CNU_ENGL123_STRUCTURAL_NONE_RECEIPT_CONTRACT,
  POSITIVE_CONTROL,
  RETAINED_FORWARD_RELATIONSHIP_SIGNAL,
  RETAINED_NON_PREREQUISITE_SIGNAL,
  TARGET,
  cnuEngl123MarkerControl,
  cnuEngl123ResolutionRowIssues,
  resolveCnuEngl123Prerequisite,
  sha256,
};
