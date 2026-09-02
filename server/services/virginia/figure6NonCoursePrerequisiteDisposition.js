/**
 * Finite Figure 6 disposition for exact entries whose retained catalog signals
 * are not ordinary prerequisite/corequisite course formulas.
 *
 * Figure 6 computes Curricular Analytics h(G) over course vertices and
 * prerequisite/corequisite edges.  A timing rule, intended-audience note,
 * integrated course component, or negative enrollment/credit restriction does
 * not create an incoming edge.  It may still affect scheduling, eligibility,
 * or degree applicability, so every such statement remains attached to the
 * row and this policy makes no claim about those other analyses.
 *
 * Required prior knowledge is different.  The current schema can represent a
 * non-course requisite but cannot prove how ODU's required knowledge is met.
 * OEAS 106N therefore remains blocked instead of being converted to `none`.
 *
 * This is deliberately an exact-row allowlist.  It is not a prose grammar and
 * cannot classify a neighboring or changed catalog entry.
 */

const crypto = require('node:crypto');
const {
  auditBridgewaterTimingPrerequisiteCandidate,
} = require('./bridgewaterTimingPrerequisiteEvidence');
const {
  resolveOldDominionPrerequisiteCandidate,
} = require('./oldDominionPrerequisiteClosureEvidence');

const CONTRACT = 'va_figure6_exact_noncourse_signal_disposition_v1';
const STRUCTURAL_NONE_KIND =
  'exact_course_entry_zero_figure6_requisite_edges_with_retained_noncourse_constraints';
const STRUCTURAL_NONE_REASON =
  'exact_noncourse_signals_have_zero_curricular_complexity_graph_edge_effect';
const RECEIPT_MISMATCH_REASON =
  'figure6_exact_noncourse_signal_disposition_receipt_changed';
const REQUIRED_KNOWLEDGE_BLOCKER =
  'required_prior_knowledge_has_unresolved_figure6_noncourse_requisite_effect';

const FIGURE6_CONSTRUCT = Object.freeze({
  metric: 'curricular_analytics_structural_complexity_h_of_g',
  vertices: 'selected_curriculum_courses',
  edges: 'required_prerequisite_and_corequisite_dependencies',
  excluded_dimensions: Object.freeze([
    'absolute_term_timing',
    'intended_audience',
    'integrated_course_activity',
    'negative_prior_credit_exclusion',
    'mutual_credit_exclusion',
    'population_enrollment_restriction',
  ]),
  fail_closed_dimension: 'unresolved_required_prior_knowledge',
});

const POLICY_ROWS = Object.freeze({
  'va:uni:9205:CL100': Object.freeze({
    safe: true,
    audit_reason: 'published_first_semester_timing_constraint_not_modeled_as_prerequisite',
    signal_dispositions: Object.freeze([
      Object.freeze(['required_first_semester_timing', 'absolute_term_timing_zero_edge']),
    ]),
  }),
  'va:uni:9205:CL150': Object.freeze({
    safe: true,
    audit_reason: 'published_first_semester_timing_constraint_not_modeled_as_prerequisite',
    signal_dispositions: Object.freeze([
      Object.freeze(['required_first_semester_timing', 'absolute_term_timing_zero_edge']),
      Object.freeze([
        'required_first_semester_timing_restatement',
        'absolute_term_timing_zero_edge',
      ]),
      Object.freeze(['intended_audience', 'population_description_zero_edge']),
    ]),
  }),
  'va:uni:9218:CS115': Object.freeze({
    safe: true,
    audit_reason: 'published_non_prerequisite_enrollment_and_credit_restrictions',
    signal_dispositions: Object.freeze([
      Object.freeze(['intended_audience', 'population_description_zero_edge']),
      Object.freeze(['required_course_component', 'integrated_activity_zero_edge']),
      Object.freeze(['prior_credit_exclusion', 'negative_credit_rule_zero_edge']),
    ]),
  }),
  'va:uni:9218:OEAS106N': Object.freeze({
    safe: false,
    audit_reason: 'published_required_knowledge_and_field_component',
    blocker: REQUIRED_KNOWLEDGE_BLOCKER,
    signal_dispositions: Object.freeze([
      Object.freeze(['required_prior_knowledge', 'unresolved_noncourse_requisite']),
      Object.freeze(['required_course_component', 'integrated_activity_zero_edge']),
    ]),
  }),
  'va:uni:9218:OEAS110N': Object.freeze({
    safe: true,
    audit_reason: 'published_mutual_credit_exclusion',
    signal_dispositions: Object.freeze([
      Object.freeze(['mutual_credit_exclusion', 'negative_credit_rule_zero_edge']),
    ]),
  }),
  'va:uni:9218:OEAS111N': Object.freeze({
    safe: true,
    audit_reason: 'published_mutual_credit_exclusion',
    signal_dispositions: Object.freeze([
      Object.freeze(['mutual_credit_exclusion', 'negative_credit_rule_zero_edge']),
    ]),
  }),
  'va:uni:9218:OEAS126N': Object.freeze({
    safe: true,
    audit_reason: 'published_honors_college_enrollment_restriction',
    signal_dispositions: Object.freeze([
      Object.freeze(['enrollment_restriction', 'population_eligibility_zero_edge']),
    ]),
  }),
});

const TARGET_COURSE_KEYS = Object.freeze(Object.keys(POLICY_ROWS));
const SAFE_COURSE_KEYS = Object.freeze(TARGET_COURSE_KEYS.filter(
  (key) => POLICY_ROWS[key].safe,
));
const BLOCKED_COURSE_KEYS = Object.freeze(TARGET_COURSE_KEYS.filter(
  (key) => !POLICY_ROWS[key].safe,
));

const asArray = (value) => Array.isArray(value) ? value : [];
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));

function candidateCourseKey(candidate) {
  return String(candidate?.course_key || '').trim();
}

function exactSourceAudit(candidate, oldDominionMarkerControl) {
  if (candidate?.slug === 'bridgewater-college') {
    return auditBridgewaterTimingPrerequisiteCandidate(candidate);
  }
  if (candidate?.slug === 'old-dominion-university') {
    return resolveOldDominionPrerequisiteCandidate(candidate, oldDominionMarkerControl);
  }
  return { applicable: false, ready: false, issues: [] };
}

function signalDispositionRows(signals, expected) {
  return asArray(signals).map((signal, index) => ({
    signal_index: index,
    kind: signal.kind,
    disposition: expected.signal_dispositions[index]?.[1] || null,
    raw_sha256: signal.raw_sha256,
  }));
}

function auditIssues(candidate, expected, audit) {
  const signals = asArray(audit?.retained_non_prerequisite_signals);
  const expectedKinds = expected.signal_dispositions.map(([kind]) => kind);
  const actualKinds = signals.map((signal) => signal?.kind);
  const issues = [];
  if (audit?.applicable !== true || audit?.ready !== false
      || asArray(audit?.issues).length !== 0) issues.push('exact_source_audit');
  if (audit?.review_reason !== expected.audit_reason) issues.push('source_audit_disposition');
  if (canonicalJson(actualKinds) !== canonicalJson(expectedKinds)) {
    issues.push('retained_signal_inventory');
  }
  for (const signal of signals) {
    if (!String(signal?.raw || '')
        || !Number.isInteger(signal?.relative_start)
        || !Number.isInteger(signal?.relative_end)
        || signal.relative_start < 0
        || signal.relative_end <= signal.relative_start
        || String(candidate?.source?.raw_entry_text || '').slice(
          signal.relative_start, signal.relative_end,
        ) !== signal.raw
        || signal.raw_sha256 !== sha256(signal.raw)) {
      issues.push('retained_signal_span');
    }
  }
  if (!audit?.blocker_evidence || typeof audit.blocker_evidence !== 'object') {
    issues.push('source_binding_evidence');
  }
  return [...new Set(issues)].sort();
}

function resolveFigure6NonCoursePrerequisiteDisposition(
  candidate,
  { oldDominionMarkerControl = null } = {},
) {
  const courseKey = candidateCourseKey(candidate);
  const expected = POLICY_ROWS[courseKey];
  if (!expected) return { applicable: false, ready: false, issues: [] };

  const audit = exactSourceAudit(candidate, oldDominionMarkerControl);
  const issues = auditIssues(candidate, expected, audit);
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues,
    review_reason: RECEIPT_MISMATCH_REASON,
  };

  const retainedSignals = audit.retained_non_prerequisite_signals.map((signal) => ({
    ...signal,
  }));
  const dispositions = signalDispositionRows(retainedSignals, expected);
  const proofBase = {
    contract: CONTRACT,
    course_key: courseKey,
    catalog_year: candidate.source.catalog_year_verified
      || candidate.source.edition_catalog_year,
    raw_entry_sha256: candidate.source.raw_entry_sha256,
    source_response_sha256: candidate.source.source_response_sha256,
    retained_non_prerequisite_signals: retainedSignals,
    retained_non_prerequisite_signals_sha256: sha256(canonicalJson(retainedSignals)),
    signal_dispositions: dispositions,
    signal_dispositions_sha256: sha256(canonicalJson(dispositions)),
    source_binding: audit.blocker_evidence,
    figure6_construct: FIGURE6_CONSTRUCT,
    content_accounting: {
      retained_signal_count: retainedSignals.length,
      every_reviewed_signal_accounted_for: true,
      source_content_discarded: false,
    },
  };

  if (!expected.safe) return {
    applicable: true,
    ready: false,
    issues: [],
    review_reason: expected.blocker,
    retained_non_prerequisite_signals: retainedSignals,
    blocker_evidence: {
      ...proofBase,
      blocking_signal_kinds: dispositions
        .filter((row) => row.disposition === 'unresolved_noncourse_requisite')
        .map((row) => row.kind),
      inference_boundary:
        'ODU states that prior knowledge is required but does not identify a course, assessment, or satisfied condition. The existing non-course-requisite schema cannot prove that condition for the selected OEAS 106N path, so no `none` row is emitted.',
    },
  };

  return {
    applicable: true,
    ready: true,
    issues: [],
    status: 'none',
    review_status: 'promoted_structural_none',
    review_reason: STRUCTURAL_NONE_REASON,
    retained_non_prerequisite_signals: retainedSignals,
    ignored_nonrequired_requisites: retainedSignals,
    structural_none_evidence: {
      ...proofBase,
      kind: STRUCTURAL_NONE_KIND,
      course_entry_status: 'published_exact_edition_bound_course_entry',
      finding:
        'zero_incoming_figure6_prerequisite_or_corequisite_edges_with_all_noncourse_signals_retained',
      literal_none_statement: false,
      graph_effect: {
        added_course_vertices: 0,
        added_prerequisite_edges: 0,
        added_corequisite_edges: 0,
      },
      inference_boundary:
        'This establishes only zero incoming prerequisite/corequisite graph edges for the Figure 6 h(G) construct. It does not waive or satisfy scheduling, audience, course-component, prior-credit, mutual-credit, enrollment, degree-applicability, or course-selection rules; those retained signals remain available to the layers that own those questions.',
    },
  };
}

function retainedSignalIssues(rawText, signals, expected) {
  const expectedKinds = expected.signal_dispositions.map(([kind]) => kind);
  const actualKinds = asArray(signals).map((signal) => signal?.kind);
  const issues = [];
  if (canonicalJson(actualKinds) !== canonicalJson(expectedKinds)) {
    issues.push('retained_signal_inventory');
  }
  for (const signal of asArray(signals)) {
    if (!String(signal?.raw || '')
        || !Number.isInteger(signal?.relative_start)
        || !Number.isInteger(signal?.relative_end)
        || signal.relative_start < 0
        || signal.relative_end <= signal.relative_start
        || String(rawText || '').slice(signal.relative_start, signal.relative_end) !== signal.raw
        || signal.raw_sha256 !== sha256(signal.raw)) issues.push('retained_signal_span');
  }
  return issues;
}

function absoluteSignalsForRow(row, relativeSignals) {
  const start = row?.review_evidence?.entry_character_start;
  if (!Number.isInteger(start)) return null;
  return asArray(relativeSignals).map((signal) => ({
    ...signal,
    source_character_start: start + signal.relative_start,
    source_character_end: start + signal.relative_end,
  }));
}

/**
 * Revalidate the final review-row projection without trusting the builder.
 * This is consumed by the Figure 6 publication validator after integration.
 */
function figure6NonCourseDispositionResolutionRowIssues(row) {
  const expected = POLICY_ROWS[row?.course_key];
  if (!expected) return [];
  const issues = [];
  const proof = expected.safe
    ? row?.structural_none_evidence
    : row?.figure6_noncourse_prerequisite_disposition_audit?.blocker_evidence;
  const relativeSignals = proof?.retained_non_prerequisite_signals;
  const rawText = row?.review_evidence?.raw_entry_text;
  const signalIssues = retainedSignalIssues(rawText, relativeSignals, expected);
  if (signalIssues.length) issues.push(...signalIssues);
  const absoluteSignals = absoluteSignalsForRow(row, relativeSignals);
  const dispositions = signalDispositionRows(relativeSignals, expected);

  if (!/^va:uni:\d+:[A-Z0-9]+$/.test(String(row?.course_key || ''))
      || row.owner_namespace !== row.course_key.split(':').slice(0, 3).join(':')
      || row.source !== 'institution_catalog'
      || row.source_content_sha256 !== sha256(rawText)
      || row.review_evidence?.raw_entry_sha256 !== row.source_content_sha256) {
    issues.push('row_source_binding');
  }
  if (proof?.contract !== CONTRACT
      || proof.course_key !== row.course_key
      || proof.raw_entry_sha256 !== row.source_content_sha256
      || proof.catalog_year !== row.catalog_year
      || proof.content_accounting?.every_reviewed_signal_accounted_for !== true
      || proof.content_accounting?.source_content_discarded !== false
      || proof.content_accounting?.retained_signal_count !== asArray(relativeSignals).length
      || proof.retained_non_prerequisite_signals_sha256
        !== sha256(canonicalJson(relativeSignals))
      || proof.signal_dispositions_sha256 !== sha256(canonicalJson(dispositions))
      || canonicalJson(proof.signal_dispositions) !== canonicalJson(dispositions)
      || canonicalJson(proof.figure6_construct) !== canonicalJson(FIGURE6_CONSTRUCT)
      || !proof.source_binding || typeof proof.source_binding !== 'object') {
    issues.push('policy_receipt');
  }
  if (!absoluteSignals
      || canonicalJson(row.retained_non_prerequisite_signals) !== canonicalJson(absoluteSignals)) {
    issues.push('retained_signal_projection');
  }

  if (expected.safe) {
    if (row.status !== 'none' || row.raw_requisites !== null
        || asArray(row.groups).length !== 0
        || row.review_status !== 'promoted_structural_none'
        || row.review_reason !== STRUCTURAL_NONE_REASON
        || canonicalJson(row.ignored_nonrequired_requisites) !== canonicalJson(absoluteSignals)) {
      issues.push('safe_row_projection');
    }
    if (proof?.kind !== STRUCTURAL_NONE_KIND
        || proof?.literal_none_statement !== false
        || proof?.finding
          !== 'zero_incoming_figure6_prerequisite_or_corequisite_edges_with_all_noncourse_signals_retained'
        || proof?.graph_effect?.added_course_vertices !== 0
        || proof?.graph_effect?.added_prerequisite_edges !== 0
        || proof?.graph_effect?.added_corequisite_edges !== 0
        || row?.figure6_noncourse_prerequisite_disposition_audit != null) {
      issues.push('structural_none_evidence');
    }
  } else {
    const audit = row?.figure6_noncourse_prerequisite_disposition_audit;
    if (row.status !== 'unparsed' || row.raw_requisites !== null
        || asArray(row.groups).length !== 0 || row.review_status !== 'not_promoted'
        || row.review_reason !== expected.blocker
        || audit?.applicable !== true || audit?.ready !== false
        || asArray(audit?.issues).length !== 0
        || canonicalJson(audit?.retained_non_prerequisite_signals)
          !== canonicalJson(relativeSignals)
        || canonicalJson(proof?.blocking_signal_kinds) !== canonicalJson([
          'required_prior_knowledge',
        ])) issues.push('blocked_row_projection');
  }
  return [...new Set(issues)].sort();
}

module.exports = {
  BLOCKED_COURSE_KEYS,
  CONTRACT,
  FIGURE6_CONSTRUCT,
  POLICY_ROWS,
  RECEIPT_MISMATCH_REASON,
  REQUIRED_KNOWLEDGE_BLOCKER,
  SAFE_COURSE_KEYS,
  STRUCTURAL_NONE_KIND,
  STRUCTURAL_NONE_REASON,
  TARGET_COURSE_KEYS,
  canonicalJson,
  figure6NonCourseDispositionResolutionRowIssues,
  resolveFigure6NonCoursePrerequisiteDisposition,
  sha256,
};
