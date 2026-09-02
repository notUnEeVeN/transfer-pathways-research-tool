/**
 * Exact, standalone evidence for three prerequisite-closure rows discovered
 * after the six-university review was bounded.
 *
 * This module does not alter the shared review. It replays complete current
 * CourseLeaf blocks and same-response positive controls, accounts for every
 * requisite-like phrase, and fails closed on source, boundary, marker, or
 * candidate drift. W&M CSCI 141L's source formula is retained even though the
 * production graph compiler currently rejects its reciprocal cycle with
 * CSCI 141.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  catalogYearSeen,
  extractCourseLeafEntries,
} = require('./universityPrerequisiteAcquisition');

const CONTRACT = 'va_exact_university_prerequisite_tail_closure_v1';
const FORMULA = 'paths_or__conditions_and';
const CATALOG_YEAR = '2026-2027';
const EXPECTED_FACTS_SHA256 =
  '2f80e6fac96e2d0a443911768cbb8c8fee633272d8fd874ae6bc5049f4c30ad2';
const RAW_SOURCE_ROOT = path.resolve(
  __dirname, '../../.va-catalogs/university-prerequisites/raw',
);
const RAW_SOURCE_PATHS = Object.freeze({
  jmuMathHtml: path.join(
    RAW_SOURCE_ROOT,
    'james-madison-university/james-madison-university__math.html',
  ),
  oduMathHtml: path.join(
    RAW_SOURCE_ROOT,
    'old-dominion-university/old-dominion-university__math.html',
  ),
  wmCsciHtml: path.join(
    RAW_SOURCE_ROOT,
    'william-mary/william-mary__csci.html',
  ),
});

const sha256 = (value) => crypto.createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || '')))
  .digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

const SOURCES = Object.freeze({
  jmu_math: Object.freeze({
    slug: 'james-madison-university',
    school_id: 9213,
    owner_namespace: 'va:uni:9213',
    official_url: 'https://catalog.jmu.edu/courses/math/',
    source_response_sha256:
      'b0bb5de8fd65f4a48f183582c4abbd1faa2fe57241692595bcdd75bbab72f853',
    source_response_bytes: 174336,
    source_courseblock_count: 109,
    source_complete_entry_count: 109,
    source_positive_count: 79,
    target_codes: Object.freeze(['MATH234']),
    positive_control_code: 'MATH220',
    positive_control_raw_entry_sha256:
      'd3ceca60898c2c4284b399836dbc47ce22df2f588086fa315144259505388c7d',
    positive_control_raw_entry_html_sha256:
      '69cc4d9820ba07e0eb145988545b13052c51c543dd301c582abe9aa6b671344d',
  }),
  odu_math: Object.freeze({
    slug: 'old-dominion-university',
    school_id: 9218,
    owner_namespace: 'va:uni:9218',
    official_url: 'https://catalog.odu.edu/courses/math/',
    source_response_sha256:
      '892a9047f80d730a1b11f1c575631d0201579fc2b60a13ea7c42eed1a9b8beb9',
    source_response_bytes: 263365,
    source_courseblock_count: 111,
    source_complete_entry_count: 111,
    source_positive_count: 98,
    target_codes: Object.freeze(['MATH100']),
    positive_control_code: 'MATH102M',
    positive_control_raw_entry_sha256:
      '4fa1a5940d61d7cd4b0c44a3e73f6be0ec56fbe4c30d081fed08b62df8880048',
    positive_control_raw_entry_html_sha256:
      '8f01530f92ad3099d96c80b110da7cc2f67925bb3432c21e5bd0cfab6a050683',
  }),
  wm_csci: Object.freeze({
    slug: 'william-mary',
    school_id: 9233,
    owner_namespace: 'va:uni:9233',
    official_url: 'https://catalog.wm.edu/undergraduate/courses/csci/',
    source_response_sha256:
      '54b9e44c308f6205f5d05437c649e4f19ecf9d0d027c7379374e0d84ad844eed',
    source_response_bytes: 102381,
    source_courseblock_count: 62,
    source_complete_entry_count: 62,
    source_positive_count: 38,
    target_codes: Object.freeze(['CSCI141L']),
    companion_codes: Object.freeze(['CSCI141']),
    positive_control_code: 'CSCI241',
    positive_control_raw_entry_sha256:
      'e9479ade30935f962b795d13329462a109defe826ddd3e76e917c45963824443',
    positive_control_raw_entry_html_sha256:
      'd7a5004bdeb60cee9de79f64052c4203b57e4f31f5080b57fc276a513df75bf7',
  }),
});

const course = (code, raw, extra = {}) => Object.freeze({
  type: 'course', code, raw, ...extra,
});
const group = (kind, raw, paths, statementRaw) => Object.freeze({
  kind,
  raw,
  statement_raw: statementRaw,
  paths: Object.freeze(paths.map((path) => Object.freeze(path))),
});
const signal = (kind, raw, extra = {}) => Object.freeze({ kind, raw, ...extra });

const DECISIONS = Object.freeze({
  'james-madison-university:MATH234': Object.freeze({
    source_id: 'jmu_math',
    course_code: 'MATH234',
    course_key: 'va:uni:9213:MATH234',
    disposition: 'parsed',
    raw_requisites: 'Prerequisites: MATH 233 with a grade of "C-" or better.',
    entry: Object.freeze({
      courseblock_index: 21,
      raw_entry_sha256:
        'cb22b4f3d8e54a65c8d19f068a9cd8ec7578817224fd9f1894a0f5450e78865b',
      raw_entry_html_sha256:
        '84c48d65830f85706609045213479ec8f774a4d9980f1aa34e9e9679c1ca8cdf',
      marker_counts: Object.freeze({ required: 1, corequisite: 0, marker_like: 1 }),
    }),
    groups: Object.freeze([group(
      'prerequisite',
      'MATH 233 with a grade of "C-" or better',
      [[course('MATH233', 'MATH 233', { minimum_grade: 'C-' })]],
      'Prerequisites: MATH 233 with a grade of "C-" or better.',
    )]),
    signals: Object.freeze([signal(
      'prior_credit_exclusion',
      'Not open to students who have already earned credit for MATH 235.',
      {
        excluded_if_credit_for: Object.freeze(['MATH235']),
        figure6_graph_edge_effect: false,
      },
    )]),
  }),
  'old-dominion-university:MATH100': Object.freeze({
    source_id: 'odu_math',
    course_code: 'MATH100',
    course_key: 'va:uni:9218:MATH100',
    disposition: 'none',
    raw_requisites: null,
    entry: Object.freeze({
      courseblock_index: 0,
      raw_entry_sha256:
        '48a19630b3c92756072699dbb6e33d4093e2c73bd46b6fe56c352f4b55c40319',
      raw_entry_html_sha256:
        '59e18f3fe38ec177170ea30c45c7eabaae7f2c3b8eaa3c6291121511af41b7b9',
      marker_counts: Object.freeze({ required: 0, corequisite: 0, marker_like: 1 }),
    }),
    groups: Object.freeze([]),
    signals: Object.freeze([
      signal(
        'outbound_other_course_prerequisite_noncompletion_description',
        'This course is to prepare students who did not meet the prerequisites for MATH 102M or MATH 103M.',
        {
          referenced_other_course_codes: Object.freeze(['MATH102M', 'MATH103M']),
          figure6_graph_edge_effect: false,
        },
      ),
      signal(
        'negative_prior_credit_or_higher_math_qualification_exclusion',
        'This course is not open to students with prior credit for or who qualify for College Algebra or a higher-level math course.',
        {
          excluded_if_prior_credit_or_qualified_above_course: true,
          figure6_graph_edge_effect: false,
        },
      ),
    ]),
  }),
  'william-mary:CSCI141L': Object.freeze({
    source_id: 'wm_csci',
    course_code: 'CSCI141L',
    course_key: 'va:uni:9233:CSCI141L',
    disposition: 'blocked',
    source_formula_status: 'exact',
    blocker: 'reciprocal_corequisite_cycle_rejected_by_production_compiler',
    raw_requisites: 'Corequisite(s): CSCI 141',
    entry: Object.freeze({
      courseblock_index: 7,
      raw_entry_sha256:
        'f99397269680464222dc881ecc16beb756ba50d595208846693906d70f900206',
      raw_entry_html_sha256:
        '7ed1d70ca6d6c019ef8500728043c6141a04472fa72199979eb8baf031e6d61b',
      marker_counts: Object.freeze({ required: 0, corequisite: 1, marker_like: 1 }),
    }),
    groups: Object.freeze([group(
      'corequisite',
      'CSCI 141',
      [[course('CSCI141', 'CSCI 141')]],
      'Corequisite(s): CSCI 141',
    )]),
    signals: Object.freeze([]),
  }),
});

const TARGET_KEYS = Object.freeze(Object.keys(DECISIONS).sort());

const WM_COMPANION = Object.freeze({
  course_code: 'CSCI141',
  course_key: 'va:uni:9233:CSCI141',
  courseblock_index: 6,
  raw_entry_sha256:
    '1c128c4d2d99b0dbbc11510dbebab8b1894494591eae79507dc6c8f68ca9a46d',
  raw_entry_html_sha256:
    '529493b81970d2e9229f8bd017324e918a54c95bb551b2feaeff1170b617bb6c',
  marker_counts: Object.freeze({ required: 0, corequisite: 1, marker_like: 1 }),
  raw_requisites: 'Corequisite(s): CSCI 141L',
  groups: Object.freeze([group(
    'corequisite',
    'CSCI 141L',
    [[course('CSCI141L', 'CSCI 141L')]],
    'Corequisite(s): CSCI 141L',
  )]),
});

function exactUniqueSpan(text, raw) {
  const source = String(text || '');
  const start = source.indexOf(raw);
  if (start < 0 || source.indexOf(raw, start + raw.length) >= 0) return null;
  return { start, end: start + raw.length };
}

function exactGroupSpans(text, sourceGroup) {
  const statement = exactUniqueSpan(text, sourceGroup.statement_raw);
  const inner = sourceGroup.statement_raw.indexOf(sourceGroup.raw);
  if (!statement || inner < 0 || sourceGroup.statement_raw.indexOf(
    sourceGroup.raw, inner + sourceGroup.raw.length,
  ) >= 0) return null;
  return {
    statement,
    raw: {
      start: statement.start + inner,
      end: statement.start + inner + sourceGroup.raw.length,
    },
  };
}

function projectedGroups(owner, courseKey, groups, rawEntryText) {
  return groups.map((sourceGroup, groupIndex) => {
    const spans = exactGroupSpans(rawEntryText, sourceGroup);
    if (!spans) return null;
    const id = `${courseKey}:${sourceGroup.kind}:${groupIndex}`;
    return {
      id,
      kind: sourceGroup.kind,
      raw: sourceGroup.raw,
      flags: [
        'strict_full_text_accounting',
        'exact_current_courseleaf_tail_closure_evidence',
      ],
      formula: FORMULA,
      paths: sourceGroup.paths.map((conditions, pathIndex) => ({
        id: `${id}:path:${pathIndex}`,
        raw: sourceGroup.raw,
        all_of: conditions.map((condition) => ({
          ...condition,
          course_key: `${owner}:${condition.code}`,
        })),
      })),
      source_receipt: {
        statement_relative_start: spans.statement.start,
        statement_relative_end: spans.statement.end,
        statement_sha256: sha256(sourceGroup.statement_raw),
        raw_relative_start: spans.raw.start,
        raw_relative_end: spans.raw.end,
        raw_sha256: sha256(sourceGroup.raw),
      },
    };
  });
}

function projectedSignals(signals, rawEntryText) {
  return signals.map((sourceSignal) => {
    const span = exactUniqueSpan(rawEntryText, sourceSignal.raw);
    return span ? {
      ...sourceSignal,
      relative_start: span.start,
      relative_end: span.end,
      raw_sha256: sha256(sourceSignal.raw),
      source_content_preserved: true,
    } : null;
  });
}

function exactEntryFact(entry) {
  return {
    course_code: entry.course_code,
    courseblock_index: entry.courseblock_index,
    raw_entry_sha256: entry.raw_entry_sha256,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    published_units: entry.published_units,
    requisite_marker_counts: entry.requisite_marker_counts,
    complete_entry_receipt: entry.complete_entry_receipt,
    structured_requisite_fields: entry.structured_requisite_fields,
  };
}

function buildUniversityPrerequisiteTailControl({
  jmuMathHtml = '', oduMathHtml = '', wmCsciHtml = '',
} = {}) {
  const htmlBySource = { jmu_math: jmuMathHtml, odu_math: oduMathHtml, wm_csci: wmCsciHtml };
  const issues = [];
  const sourceFacts = {};
  const entryFacts = {};
  for (const [sourceId, source] of Object.entries(SOURCES)) {
    const html = String(htmlBySource[sourceId] || '');
    if (sha256(html) !== source.source_response_sha256
        || Buffer.byteLength(html) !== source.source_response_bytes) {
      issues.push(`${sourceId}:source_bytes`);
    }
    if (!catalogYearSeen(html, CATALOG_YEAR)) issues.push(`${sourceId}:catalog_year`);
    const codes = [
      ...source.target_codes,
      ...asArray(source.companion_codes),
      source.positive_control_code,
    ];
    const extraction = extractCourseLeafEntries(html, codes);
    if (extraction.missing.length || extraction.ambiguous.length
        || extraction.courseblock_count !== source.source_courseblock_count
        || extraction.complete_entry_count !== source.source_complete_entry_count
        || extraction.complete_entries_with_required_requisite_marker_count
          !== source.source_positive_count) issues.push(`${sourceId}:entry_boundary_population`);
    const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
    const positive = byCode.get(source.positive_control_code);
    if (!positive
        || positive.raw_entry_sha256 !== source.positive_control_raw_entry_sha256
        || positive.raw_entry_html_sha256 !== source.positive_control_raw_entry_html_sha256
        || positive.requisite_marker_counts?.required !== 1
        || positive.complete_entry_receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
        || positive.complete_entry_receipt?.same_source_positive_control !== true) {
      issues.push(`${sourceId}:positive_control`);
    }
    sourceFacts[sourceId] = {
      official_url: source.official_url,
      catalog_year: CATALOG_YEAR,
      source_response_sha256: source.source_response_sha256,
      source_response_bytes: source.source_response_bytes,
      boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
      source_courseblock_count: extraction.courseblock_count,
      source_complete_entry_count: extraction.complete_entry_count,
      source_positive_count:
        extraction.complete_entries_with_required_requisite_marker_count,
      positive_control: positive ? exactEntryFact(positive) : null,
    };
    for (const code of source.target_codes) {
      const targetKey = `${source.slug}:${code}`;
      const decision = DECISIONS[targetKey];
      const entry = byCode.get(code);
      const groups = entry ? projectedGroups(
        source.owner_namespace, decision.course_key, decision.groups, entry.raw_entry_text,
      ) : [];
      const signals = entry ? projectedSignals(decision.signals, entry.raw_entry_text) : [];
      const markerCounts = entry && {
        required: entry.requisite_marker_counts.required,
        corequisite: entry.requisite_marker_counts.corequisite,
        marker_like: entry.requisite_marker_counts.marker_like,
      };
      if (!entry
          || entry.courseblock_index !== decision.entry.courseblock_index
          || entry.raw_entry_sha256 !== decision.entry.raw_entry_sha256
          || entry.raw_entry_html_sha256 !== decision.entry.raw_entry_html_sha256
          || !same(markerCounts, decision.entry.marker_counts)
          || groups.some((row) => !row)
          || signals.some((row) => !row)) issues.push(`${targetKey}:exact_entry`);
      if (code === 'MATH234') {
        const field = entry?.structured_requisite_fields?.[0];
        if (entry?.structured_requisite_fields?.length !== 1
            || field?.kind !== 'prerequisite'
            || field?.raw_field_text !== `${decision.raw_requisites} ${decision.signals[0].raw}`) {
          issues.push(`${targetKey}:structured_field_accounting`);
        }
      }
      entryFacts[targetKey] = {
        course_key: decision.course_key,
        disposition: decision.disposition,
        source_formula_status: decision.source_formula_status || null,
        source_id: sourceId,
        source_response_sha256: source.source_response_sha256,
        boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
        ...exactEntryFact(entry || {}),
        groups,
        signals,
      };
    }
    if (sourceId === 'wm_csci') {
      const entry = byCode.get(WM_COMPANION.course_code);
      const markerCounts = entry && {
        required: entry.requisite_marker_counts.required,
        corequisite: entry.requisite_marker_counts.corequisite,
        marker_like: entry.requisite_marker_counts.marker_like,
      };
      const groups = entry ? projectedGroups(
        source.owner_namespace,
        WM_COMPANION.course_key,
        WM_COMPANION.groups,
        entry.raw_entry_text,
      ) : [];
      if (!entry
          || entry.courseblock_index !== WM_COMPANION.courseblock_index
          || entry.raw_entry_sha256 !== WM_COMPANION.raw_entry_sha256
          || entry.raw_entry_html_sha256 !== WM_COMPANION.raw_entry_html_sha256
          || !same(markerCounts, WM_COMPANION.marker_counts)
          || groups.some((row) => !row)) issues.push('wm_csci:reciprocal_companion_entry');
      entryFacts['william-mary:CSCI141'] = {
        course_key: WM_COMPANION.course_key,
        source_id: sourceId,
        source_response_sha256: source.source_response_sha256,
        boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
        ...exactEntryFact(entry || {}),
        groups,
      };
    }
  }
  const facts = {
    source_pages: sourceFacts,
    target_entries: entryFacts,
    target_inventory: TARGET_KEYS,
    dispositions: Object.fromEntries(TARGET_KEYS.map((key) => [
      key, DECISIONS[key].disposition,
    ])),
  };
  const factsSha256 = sha256(canonicalJson(facts));
  if (EXPECTED_FACTS_SHA256 !== 'TO_BE_PINNED_AFTER_EXACT_REPLAY'
      && factsSha256 !== EXPECTED_FACTS_SHA256) issues.push('facts_sha256');
  return {
    verified: issues.length === 0,
    issues: [...new Set(issues)].sort(),
    contract: CONTRACT,
    facts,
    facts_sha256: factsSha256,
  };
}

function candidateKey(candidate) {
  const code = String(candidate?.course_code || candidate?.code || '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${String(candidate?.slug || '')}:${code}`;
}

function isScopedUniversityPrerequisiteTail(value = {}) {
  const decision = DECISIONS[candidateKey(value)];
  if (!decision) return false;
  const source = SOURCES[decision.source_id];
  return (value.school_id == null || value.school_id === source.school_id)
    && (value.owner_namespace == null
      || value.owner_namespace === source.owner_namespace)
    && (value.course_key == null || value.course_key === decision.course_key);
}

function candidateIssues(candidate, control) {
  const key = candidateKey(candidate);
  const decision = DECISIONS[key];
  if (!decision) return ['not_scoped'];
  const source = SOURCES[decision.source_id];
  const receipt = control?.facts?.target_entries?.[key];
  const candidateSource = candidate?.source || {};
  const issues = [];
  if (!control?.verified || control.contract !== CONTRACT
      || control.facts_sha256 !== EXPECTED_FACTS_SHA256) issues.push('control');
  if (candidate.school_id !== source.school_id
      || candidate.owner_namespace !== source.owner_namespace
      || candidate.course_key !== decision.course_key) issues.push('identity');
  if (candidateSource.capture_origin !== 'official_acquisition'
      || candidateSource.source_format !== 'courseleaf_courseblock'
      || candidateSource.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT
      || candidateSource.catalog_year_verified !== CATALOG_YEAR) issues.push('boundary_edition');
  if (candidateSource.official_url !== source.official_url
      || candidateSource.source_response_sha256 !== source.source_response_sha256
      || candidateSource.source_response_bytes !== source.source_response_bytes) issues.push('source');
  if (candidateSource.courseblock_index !== decision.entry.courseblock_index
      || candidateSource.raw_entry_sha256 !== decision.entry.raw_entry_sha256
      || sha256(candidateSource.raw_entry_text) !== decision.entry.raw_entry_sha256
      || candidateSource.raw_entry_html_sha256 !== decision.entry.raw_entry_html_sha256
      || receipt?.raw_entry_sha256 !== decision.entry.raw_entry_sha256) issues.push('entry');
  if (candidate.prerequisite_marker_count !== decision.entry.marker_counts.required
      || candidate.corequisite_marker_count !== decision.entry.marker_counts.corequisite
      || candidateSource.complete_entry_receipt?.entry_requisite_marker_like_count
        !== decision.entry.marker_counts.marker_like
      || candidateSource.complete_entry_receipt?.receipt_contract
        !== COURSELEAF_RECEIPT_CONTRACT
      || candidateSource.complete_entry_receipt?.same_source_positive_control !== true) {
    issues.push('marker_control');
  }
  return [...new Set(issues)].sort();
}

function proofBase(candidate, control, decision) {
  const receipt = control.facts.target_entries[candidateKey(candidate)];
  return {
    contract: CONTRACT,
    catalog_year: CATALOG_YEAR,
    course_key: decision.course_key,
    source_url: SOURCES[decision.source_id].official_url,
    source_response_sha256: receipt.source_response_sha256,
    boundary_contract: receipt.boundary_contract,
    raw_entry_sha256: receipt.raw_entry_sha256,
    raw_entry_html_sha256: receipt.raw_entry_html_sha256,
    complete_entry_receipt: receipt.complete_entry_receipt,
    target_requisite_marker_counts: receipt.requisite_marker_counts,
    facts_sha256: control.facts_sha256,
    content_accounting: {
      exact_complete_entry_present: true,
      same_response_positive_control: true,
      every_requisite_like_phrase_classified: true,
      source_content_discarded: false,
    },
  };
}

function resolveUniversityPrerequisiteTailCandidate(candidate, control) {
  const key = candidateKey(candidate);
  const decision = DECISIONS[key];
  if (!decision) return { applicable: false, ready: false, blocked: false, issues: [] };
  const issues = candidateIssues(candidate, control);
  if (issues.length) return {
    applicable: true, ready: false, blocked: true, issues,
    review_reason: 'exact_university_tail_source_receipt_changed',
  };
  const receipt = control.facts.target_entries[key];
  const base = proofBase(candidate, control, decision);
  if (decision.disposition === 'blocked') return {
    applicable: true,
    ready: false,
    blocked: true,
    issues: [],
    raw_requisites: decision.raw_requisites,
    review_reason: decision.blocker,
    preserved_source_formula_groups: receipt.groups,
    blocker_evidence: {
      ...base,
      source_formula_status: 'exact',
      source_formula_groups: receipt.groups,
      reciprocal_course_keys: ['va:uni:9233:CSCI141', 'va:uni:9233:CSCI141L'],
      production_compiler_issue: 'requisite_graph_cycle',
      formula_dropped_or_rewritten: false,
      inference_boundary:
        'The exact reciprocal corequisite is retained, but the production parent-map compiler rejects reciprocal dependency cycles. Publishing CSCI 141L as none or dropping either direction would change source meaning.',
    },
  };
  if (decision.disposition === 'parsed') return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: 'parsed',
    raw_requisites: decision.raw_requisites,
    groups: receipt.groups,
    ignored_nonrequired_requisites: receipt.signals,
    review_status: 'promoted_strict_formula',
    review_reason: 'exact_current_tail_prerequisite_formula',
    exact_tail_prerequisite_evidence: base,
  };
  return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: 'none',
    raw_requisites: null,
    groups: [],
    ignored_nonrequired_requisites: receipt.signals,
    review_status: 'promoted_structural_none',
    review_reason: 'exact_tail_noncourse_signals_have_zero_figure6_graph_edge_effect',
    structural_none_evidence: {
      ...base,
      kind: 'exact_tail_complete_entry_zero_figure6_requisite_edges',
      literal_none_statement: false,
      finding:
        'zero_incoming_figure6_prerequisite_or_corequisite_edges_with_all_noncourse_signals_retained',
      retained_non_prerequisite_signals: receipt.signals,
      graph_effect: {
        added_course_vertices: 0,
        added_prerequisite_edges: 0,
        added_corequisite_edges: 0,
      },
      inference_boundary:
        'This proves zero incoming Figure 6 course-dependency edges only. It does not waive MATH 100 eligibility, prior-credit, placement, or course-selection rules.',
    },
  };
}

function loadUniversityPrerequisiteTailControl() {
  return buildUniversityPrerequisiteTailControl(Object.fromEntries(
    Object.entries(RAW_SOURCE_PATHS).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]),
  ));
}

function universityPrerequisiteTailControlSummary(control) {
  return {
    contract: control?.contract || null,
    verified: control?.verified === true,
    issues: asArray(control?.issues),
    facts_sha256: control?.facts_sha256 || null,
    target_inventory: asArray(control?.facts?.target_inventory),
    dispositions: control?.facts?.dispositions || null,
    source_pages: Object.fromEntries(Object.entries(control?.facts?.source_pages || {})
      .map(([sourceId, source]) => [sourceId, {
        official_url: source.official_url,
        catalog_year: source.catalog_year,
        source_response_sha256: source.source_response_sha256,
        source_response_bytes: source.source_response_bytes,
        boundary_contract: source.boundary_contract,
        source_complete_entry_count: source.source_complete_entry_count,
        source_positive_count: source.source_positive_count,
        positive_control_course_code: source.positive_control?.course_code || null,
        positive_control_raw_entry_sha256: source.positive_control?.raw_entry_sha256 || null,
      }])),
  };
}

function replayCandidateFromReviewRow(row) {
  const evidence = row?.review_evidence || {};
  const markerReceipt = evidence.complete_entry_receipt || {};
  return {
    school_id: row?.school_id,
    slug: row?.slug,
    owner_namespace: row?.owner_namespace,
    course_key: row?.course_key,
    course_code: row?.code,
    prerequisite_marker_count:
      markerReceipt.entry_required_requisite_marker_count,
    corequisite_marker_count:
      markerReceipt.entry_corequisite_marker_count,
    source: {
      capture_origin: evidence.capture_origin,
      source_format: evidence.source_format,
      boundary_contract: evidence.boundary_contract,
      catalog_year_verified: evidence.catalog_year_verified,
      official_url: evidence.official_url,
      source_response_sha256: evidence.source_response_sha256,
      source_response_bytes: evidence.source_response_bytes,
      cache_path: evidence.cache_path,
      courseblock_index: evidence.courseblock_index,
      character_start: evidence.entry_character_start,
      character_end: evidence.entry_character_end,
      raw_entry_sha256: evidence.raw_entry_sha256,
      raw_entry_html_sha256: evidence.raw_entry_html_sha256,
      raw_entry_text: evidence.raw_entry_text,
      published_units: evidence.published_units,
      complete_entry_receipt: evidence.complete_entry_receipt,
      structured_requisite_fields: evidence.structured_requisite_fields,
    },
  };
}

function absoluteSignalsForReviewRow(row, signals) {
  const start = Number(row?.review_evidence?.entry_character_start || 0);
  return asArray(signals).map((signalRow) => ({
    ...signalRow,
    source_character_start: start + signalRow.relative_start,
    source_character_end: start + signalRow.relative_end,
  }));
}

function resolutionRowIssues(
  row,
  control = loadUniversityPrerequisiteTailControl(),
) {
  if (!isScopedUniversityPrerequisiteTail(row)) return [];
  const decision = DECISIONS[candidateKey(row)];
  const resolved = resolveUniversityPrerequisiteTailCandidate(
    replayCandidateFromReviewRow(row), control,
  );
  const issues = [];
  if (decision.disposition === 'blocked') {
    if (resolved.ready || !resolved.blocked
        || row.status !== 'unparsed'
        || row.raw_requisites !== decision.raw_requisites
        || !same(row.groups, [])
        || row.review_status !== 'not_promoted'
        || row.review_reason !== decision.blocker
        || !same(row.preserved_source_formula_groups,
          resolved.preserved_source_formula_groups)
        || !same(row.prerequisite_constraint_blocker_evidence,
          resolved.blocker_evidence)) issues.push('blocked_projection');
    return issues;
  }
  if (!resolved.ready || resolved.blocked) return ['source_receipt'];
  const expectedSignals = absoluteSignalsForReviewRow(
    row, resolved.ignored_nonrequired_requisites,
  );
  if (row.status !== resolved.status
      || row.raw_requisites !== resolved.raw_requisites
      || row.review_status !== resolved.review_status
      || row.review_reason !== resolved.review_reason
      || !same(row.groups, resolved.groups)
      || !same(row.ignored_nonrequired_requisites, expectedSignals)) {
    issues.push('review_projection');
  }
  const proof = resolved.status === 'none'
    ? row.structural_none_evidence
    : row.university_prerequisite_tail_resolution;
  const expectedProof = resolved.status === 'none'
    ? resolved.structural_none_evidence
    : resolved.exact_tail_prerequisite_evidence;
  if (!same(proof, expectedProof)) issues.push('proof');
  return issues;
}

function reciprocalWilliamMaryCompilerRows(control) {
  const source = SOURCES.wm_csci;
  const rows = [
    ['william-mary:CSCI141', WM_COMPANION.raw_requisites],
    ['william-mary:CSCI141L', DECISIONS['william-mary:CSCI141L'].raw_requisites],
  ];
  return rows.map(([key, rawRequisites]) => {
    const receipt = control?.facts?.target_entries?.[key];
    return {
      course_key: receipt?.course_key,
      owner_namespace: source.owner_namespace,
      status: 'parsed',
      source: 'institution_catalog',
      source_url: source.official_url,
      source_bundle_hash: source.source_response_sha256,
      raw_requisites: rawRequisites,
      groups: receipt?.groups || [],
    };
  });
}

module.exports = {
  CATALOG_YEAR,
  CONTRACT,
  DECISIONS,
  EXPECTED_FACTS_SHA256,
  FORMULA,
  RAW_SOURCE_PATHS,
  RAW_SOURCE_ROOT,
  SOURCES,
  TARGET_KEYS,
  WM_COMPANION,
  buildUniversityPrerequisiteTailControl,
  candidateIssues,
  canonicalJson,
  isScopedUniversityPrerequisiteTail,
  loadUniversityPrerequisiteTailControl,
  reciprocalWilliamMaryCompilerRows,
  replayCandidateFromReviewRow,
  resolutionRowIssues,
  resolveUniversityPrerequisiteTailCandidate,
  sha256,
  universityPrerequisiteTailControlSummary,
};
