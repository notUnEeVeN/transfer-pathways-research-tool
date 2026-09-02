/**
 * Exact Norfolk State prerequisite closure for the finite rows that the
 * generic CourseLeaf silence rule deliberately leaves unparsed.
 *
 * The rule here is narrower than a prose heuristic.  Every decision is bound
 * to a complete courseblock, the retained 2025-2026 response, an exact catalog
 * edition marker, and a same-response or same-catalog formal prerequisite
 * marker control.  Constraint-like prose is span-accounted before a row can be
 * classified as structural none.  CHM 221L remains blocked because the source
 * says only "Must be taken in sequence" and does not identify a predecessor,
 * successor, or concurrency direction.
 */

const crypto = require('node:crypto');
const path = require('node:path');

const ARTIFACT = 'norfolk_state_prerequisite_closure_evidence';
const CONTRACT =
  'nsu_exact_2025_2026_courseleaf_prerequisite_closure_content_accounting_v1';
const REVIEW_REASON =
  'exact_nsu_courseleaf_prerequisite_formula_or_structural_silence';
const BLOCKED_REVIEW_REASON =
  'nsu_chm221l_unnamed_sequence_requirement';
const SCHOOL_ID = 9217;
const SLUG = 'norfolk-state-university';
const OWNER = 'va:uni:9217';
const CATALOG_YEAR = '2025-2026';
const FORMULA = 'paths_or__conditions_and';
const COURSELEAF_BOUNDARY =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const EVIDENCE_PATH = path.resolve(
  __dirname,
  '../../.va-catalogs/research/norfolk-state-prerequisite-closure-evidence.json',
);

// Replaced only after replaying every retained official response.  Keeping the
// pin in code makes editing the JSON alone insufficient to change a decision.
const EXPECTED_FACTS_SHA256 =
  '22aa140e598a9bbd219772cb380cbf7cd45426d65b1eee664c8679f4bba2e22e';

const signal = (kind, raw, extra = {}) => Object.freeze({
  kind,
  raw,
  incoming_prerequisite_effect: false,
  ...extra,
});
const clause = (kind, raw) => Object.freeze({ kind, raw });
const course = (code, raw) => Object.freeze({ type: 'course', code, raw });
const group = (kind, raw, conditions) => Object.freeze({
  kind,
  raw,
  conditions: Object.freeze(conditions),
});

const DIRECT_REMEDIATION_CODES = Object.freeze([
  'CHM221L', 'CSC316', 'CSC466', 'CSC467', 'CSC476', 'CSC477',
  'ECN200', 'ENG101', 'HRP320', 'SEM101', 'SEM102', 'SEM201',
]);
const CLOSURE_CODES = Object.freeze([
  'CSC169', 'CSC290', 'HIS100', 'ITE111', 'MTH102', 'MTH105', 'MTH151',
]);

// These names occur in exact required-prerequisite fields, but the current
// official catalog does not publish a corresponding complete course entry.
// They are closure blockers, not structural-none rows: an absent entry cannot
// tell us whether the referenced course itself has prerequisites.
const MISSING_CLOSURE_REFERENCES = Object.freeze({
  CSC195: Object.freeze({
    absence_page: 'csc',
    referrers: Object.freeze([
      Object.freeze({ course_code: 'CSC314', page: 'csc' }),
    ]),
  }),
  CSC311: Object.freeze({
    absence_page: 'csc',
    referrers: Object.freeze([
      Object.freeze({ course_code: 'CSC312', page: 'csc' }),
      Object.freeze({ course_code: 'CSC313', page: 'csc' }),
    ]),
  }),
  EEN470: Object.freeze({
    absence_page: 'een',
    referrers: Object.freeze([
      Object.freeze({ course_code: 'CSC472', page: 'csc' }),
    ]),
  }),
  ENGG101H: Object.freeze({
    // The formal field is on the ENG page.  The catalog's expected ENGG
    // subject URL is a retained 404, while ENG 101H is a distinct published
    // entry.  That is typo-like evidence, never authority to invent an alias.
    absence_page: 'eng',
    expected_subject_page: 'engg',
    distinct_near_match_code: 'ENG101H',
    referrers: Object.freeze([
      Object.freeze({ course_code: 'ENG102', page: 'eng' }),
    ]),
  }),
  MTH101: Object.freeze({
    absence_page: 'mth',
    referrers: Object.freeze([
      Object.freeze({ course_code: 'MTH105', page: 'mth' }),
    ]),
  }),
});
const MISSING_CLOSURE_CODES = Object.freeze(
  Object.keys(MISSING_CLOSURE_REFERENCES),
);

const DECISIONS = Object.freeze({
  CHM221L: Object.freeze({
    page: 'chm', scope_role: 'direct_remediation', disposition: 'blocked',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'unnamed_sequence_requirement',
      'Must be taken in sequence.',
      {
        incoming_prerequisite_effect: 'unresolved',
        named_course_codes: Object.freeze([]),
        sequence_direction: null,
      },
    )]),
  }),
  CSC316: Object.freeze({
    page: 'csc', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'descriptive_learning_outcome_required_knowledge_phrase',
      'Students gain knowledge required for understanding cloud computing and becoming cloud practitioners.',
    )]),
  }),
  CSC466: Object.freeze({
    page: 'csc', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'curriculum_role_required_course_comparison',
      'They are designed as a Computer Science elective, not as a replacement for any specifically required course.',
    )]),
  }),
  CSC467: Object.freeze({
    page: 'csc', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'curriculum_role_required_course_comparison',
      'They are designed as a Computer Science elective, not as a replacement for any specifically required course.',
    )]),
  }),
  CSC476: Object.freeze({
    page: 'csc', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'curriculum_role_required_course_comparison',
      'They are designed as a Computer Science elective, not as a replacement for any specifically required course.',
    )]),
  }),
  CSC477: Object.freeze({
    page: 'csc', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'curriculum_role_required_course_comparison',
      'They are designed as a Computer Science elective, not as a replacement for any specifically required course.',
    )]),
  }),
  ECN200: Object.freeze({
    page: 'ecn', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  ENG101: Object.freeze({
    page: 'eng', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'course_completion_grade_requirement_without_named_successor',
      'Must be passed with a "C" or above.',
      { outbound_progression_effect: 'unresolved_without_named_successor' },
    )]),
  }),
  HRP320: Object.freeze({
    page: 'hrp', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  SEM101: Object.freeze({
    page: 'sem', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'curriculum_placement_statement',
      'As part of the General Education curriculum, Spartan Seminar 101 is a required academic course for all first-year undergraduate students during their first semester at Norfolk State University.',
      { student_year: 1, semester_ordinal: 1 },
    )]),
  }),
  SEM102: Object.freeze({
    page: 'sem', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'curriculum_placement_statement',
      'As part of the General Education curriculum, Spartan Seminar 102 is a required academic course for all first-year undergraduate students during their second semester at Norfolk State University.',
      { student_year: 1, semester_ordinal: 2 },
    )]),
  }),
  SEM201: Object.freeze({
    page: 'sem', scope_role: 'direct_remediation', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'curriculum_placement_statement',
      'As part of the General Education curriculum, Spartan Seminar 201 is a required academic course for all second-year undergraduate students during their third semester at Norfolk State University.',
      { student_year: 2, semester_ordinal: 3 },
    )]),
  }),
  CSC169: Object.freeze({
    page: 'csc', scope_role: 'recursive_closure', disposition: 'none',
    clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  CSC290: Object.freeze({
    page: 'csc', scope_role: 'recursive_closure', disposition: 'none',
    clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  HIS100: Object.freeze({
    page: 'his', scope_role: 'recursive_closure', disposition: 'none',
    clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  ITE111: Object.freeze({
    page: 'ite', scope_role: 'recursive_closure', disposition: 'none',
    clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  MTH102: Object.freeze({
    page: 'mth', scope_role: 'recursive_closure', disposition: 'none',
    clauses: Object.freeze([]),
    signals: Object.freeze([signal(
      'integrated_laboratory_component_description',
      'A lab component is used to reinforce the concepts of the topics introduced in class.',
      { component: 'laboratory' },
    )]),
  }),
  MTH105: Object.freeze({
    page: 'mth', scope_role: 'recursive_closure', disposition: 'parsed',
    raw_requisites: 'Prerequisites: Take MTH-101.',
    clauses: Object.freeze([clause('prerequisite', 'Take MTH-101.')]),
    groups: Object.freeze([group('prerequisite', 'Take MTH-101.', [
      course('MTH101', 'Take MTH-101.'),
    ])]),
    signals: Object.freeze([signal(
      'general_education_applicability_statement',
      '(Satisfies the minimum general education mathematics requirement.)',
    )]),
  }),
  MTH151: Object.freeze({
    page: 'mth', scope_role: 'recursive_closure', disposition: 'parsed',
    raw_requisites: 'Prerequisites: Take MTH-105. Take MTH-102.',
    clauses: Object.freeze([clause(
      'prerequisite', 'Take MTH-105. Take MTH-102.',
    )]),
    groups: Object.freeze([group(
      'prerequisite', 'Take MTH-105. Take MTH-102.', [
        course('MTH105', 'Take MTH-105.'),
        course('MTH102', 'Take MTH-102.'),
      ],
    )]),
    signals: Object.freeze([signal(
      'descriptive_expected_prior_knowledge_alongside_formal_prerequisites',
      'Students are expected to bring to the course knowledge of the essentials of elementary and intermediate algebra.',
    )]),
  }),
});

const TARGET_CODES = Object.freeze(Object.keys(DECISIONS));
const targetSet = new Set(TARGET_CODES);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isScopedNorfolkStatePrerequisite({
  school_id: schoolId,
  slug,
  owner_namespace: ownerNamespace,
  course_code: courseCode,
  code,
  course_key: courseKey,
} = {}) {
  const normalized = normalizeCode(courseCode || code);
  return (schoolId == null || schoolId === SCHOOL_ID)
    && slug === SLUG
    && ownerNamespace === OWNER
    && targetSet.has(normalized)
    && (courseKey == null || courseKey === `${OWNER}:${normalized}`);
}

function loadEvidenceArtifact() {
  delete require.cache[require.resolve(EVIDENCE_PATH)];
  return require(EVIDENCE_PATH);
}

function artifactIssues(artifact) {
  const issues = [];
  if (artifact?.schema_version !== 1) issues.push('schema_version');
  if (artifact?.artifact !== ARTIFACT) issues.push('artifact');
  if (artifact?.contract !== CONTRACT) issues.push('contract');
  if (artifact?.catalog_year !== CATALOG_YEAR) issues.push('catalog_year');
  if (artifact?.owner_namespace !== OWNER) issues.push('owner_namespace');
  if (artifact?.facts_sha256 !== EXPECTED_FACTS_SHA256) issues.push('facts_sha256_pin');
  if (sha256(canonicalJson(artifact?.facts || null)) !== artifact?.facts_sha256) {
    issues.push('facts_sha256_replay');
  }
  const rows = Array.isArray(artifact?.facts?.target_rows)
    ? artifact.facts.target_rows : [];
  if (!same(rows.map((row) => row.course_code).sort(), [...TARGET_CODES].sort())) {
    issues.push('target_inventory');
  }
  const counts = Object.fromEntries(['parsed', 'none', 'blocked'].map((disposition) => [
    disposition, rows.filter((row) => row.disposition === disposition).length,
  ]));
  if (!same(counts, { parsed: 2, none: 16, blocked: 1 })) {
    issues.push('disposition_counts');
  }
  if (rows.filter((row) => row.scope_role === 'direct_remediation').length !== 12
      || rows.filter((row) => row.scope_role === 'recursive_closure').length !== 7) {
    issues.push('scope_partition');
  }
  if (artifact?.publication_ready !== false) issues.push('publication_ready');
  const blockerKeys = (artifact?.publication_blockers || [])
    .map((row) => row.course_key).sort();
  const expectedBlockerKeys = [
    `${OWNER}:CHM221L`,
    ...MISSING_CLOSURE_CODES.map((code) => `${OWNER}:${code}`),
  ].sort();
  if (!same(blockerKeys, expectedBlockerKeys)) {
    issues.push('publication_blockers');
  }
  const missingClosure = Array.isArray(artifact?.facts?.missing_closure_references)
    ? artifact.facts.missing_closure_references : [];
  if (!same(missingClosure.map((row) => row.course_code).sort(),
    [...MISSING_CLOSURE_CODES].sort())) {
    issues.push('missing_closure_reference_inventory');
  }
  if (missingClosure.some((row) => (
    row.disposition !== 'blocked_missing_current_official_course_entry'
      || row.incoming_prerequisite_formula_inferred !== false
      || row.course_alias_inferred !== false
  ))) {
    issues.push('missing_closure_reference_disposition');
  }
  const control = artifact?.facts?.same_catalog_positive_control;
  if (control?.course_code !== 'CSC170'
      || control?.catalog_year !== CATALOG_YEAR
      || control?.formal_required_prerequisite_marker_count !== 1
      || control?.same_catalog_positive_control !== true) {
    issues.push('same_catalog_positive_control');
  }
  return issues;
}

function evidenceRow(artifact, code) {
  return artifact?.facts?.target_rows?.find((row) => row.course_code === code) || null;
}

function boundedSpan(text, sourceSignal, index) {
  const source = String(text || '');
  const start = source.indexOf(sourceSignal.raw);
  if (start < 0 || source.indexOf(sourceSignal.raw, start + sourceSignal.raw.length) >= 0) {
    return { issue: `reviewed_span_${index}_not_unique` };
  }
  return { start, end: start + sourceSignal.raw.length };
}

function projectedSignals(candidate, decision) {
  const text = String(candidate?.source?.raw_entry_text || '');
  const rows = [];
  const issues = [];
  for (const [index, sourceSignal] of (decision.signals || []).entries()) {
    const span = boundedSpan(text, sourceSignal, index);
    if (span.issue) {
      issues.push(span.issue);
      continue;
    }
    rows.push({
      ...sourceSignal,
      raw_sha256: sha256(sourceSignal.raw),
      relative_start: span.start,
      relative_end: span.end,
      source_character_start: candidate.source.character_start + span.start,
      source_character_end: candidate.source.character_start + span.end,
      required_prerequisite_graph_edge_emitted: false,
      source_content_preserved: true,
      graph_projection: decision.disposition === 'blocked'
        ? 'preserved_ambiguity_without_inferred_edge'
        : 'preserved_non_prerequisite_signal_without_graph_edge',
    });
  }
  return { rows, issues };
}

function expectedGroups(code, decision) {
  return (decision.groups || []).map((sourceGroup, groupIndex) => {
    const groupId = `${OWNER}:${code}:${sourceGroup.kind}:${groupIndex}`;
    return {
      id: groupId,
      kind: sourceGroup.kind,
      raw: sourceGroup.raw,
      flags: [
        'strict_full_text_accounting',
        `source:${SLUG}`,
        'nsu_take_sentences_are_conjunctive',
        'nsu_exact_courseleaf_closure_evidence',
      ],
      formula: FORMULA,
      paths: [{
        id: `${groupId}:path:0`,
        raw: sourceGroup.raw,
        all_of: sourceGroup.conditions.map((condition) => ({
          ...condition,
          course_key: `${OWNER}:${condition.code}`,
        })),
      }],
    };
  });
}

function clauseShape(clauses) {
  return (Array.isArray(clauses) ? clauses : []).map((row) => ({
    kind: row.kind,
    raw: row.raw,
  }));
}

function candidateIssues(candidate, clauses = [], artifact = null) {
  if (!isScopedNorfolkStatePrerequisite(candidate)) return ['not_scoped'];
  const exactArtifact = artifact || loadEvidenceArtifact();
  const code = normalizeCode(candidate.course_code);
  const decision = DECISIONS[code];
  const receipt = evidenceRow(exactArtifact, code);
  const page = exactArtifact?.facts?.source_pages?.find((row) => row.page_id === decision.page);
  const source = candidate.source || {};
  const issues = [...artifactIssues(exactArtifact)];
  const requireExact = (condition, issue) => { if (!condition) issues.push(issue); };
  requireExact(candidate.school_id === SCHOOL_ID, 'school_id');
  requireExact(candidate.course_key === `${OWNER}:${code}`, 'course_key');
  requireExact(source.capture_origin === 'official_acquisition', 'capture_origin');
  requireExact(source.source_format === 'courseleaf_courseblock', 'source_format');
  requireExact(source.boundary_contract === COURSELEAF_BOUNDARY, 'boundary_contract');
  requireExact(source.catalog_year_verified === CATALOG_YEAR, 'catalog_year');
  requireExact(source.official_url === page?.official_url, 'official_url');
  requireExact(source.cache_path === page?.cache_path, 'cache_path');
  requireExact(source.source_response_sha256 === page?.source_response_sha256
    && source.declared_normalized_text_sha256 === page?.source_response_sha256
    && source.retained_normalized_text_sha256 === page?.source_response_sha256,
  'source_response_sha256');
  requireExact(source.source_response_bytes === page?.source_response_bytes,
    'source_response_bytes');
  requireExact(source.courseblock_index === receipt?.courseblock_index, 'courseblock_index');
  requireExact(source.character_start === 0
    && source.character_end === receipt?.raw_entry_length
    && source.raw_entry_text?.length === receipt?.raw_entry_length,
  'entry_boundary');
  requireExact(source.raw_entry_sha256 === receipt?.raw_entry_sha256
    && sha256(source.raw_entry_text || '') === receipt?.raw_entry_sha256,
  'raw_entry_sha256');
  requireExact(source.raw_entry_html_sha256 === receipt?.raw_entry_html_sha256,
    'raw_entry_html_sha256');
  requireExact(same(source.published_units, receipt?.published_units), 'published_units');
  requireExact(same(source.complete_entry_receipt, receipt?.complete_entry_receipt),
    'complete_entry_receipt');
  requireExact(same(source.structured_requisite_fields,
    receipt?.structured_requisite_fields), 'structured_requisite_fields');
  requireExact(receipt?.decision_sha256 === sha256(canonicalJson(decision)),
    'decision_sha256');
  requireExact(same(clauseShape(clauses), decision.clauses),
    'required_clause_projection');
  const projected = projectedSignals(candidate, decision);
  issues.push(...projected.issues);
  if (decision.disposition === 'none') {
    requireExact(source.complete_entry_receipt?.entry_required_requisite_marker_count === 0
      && source.complete_entry_receipt?.entry_corequisite_marker_count === 0
      && source.complete_entry_receipt?.entry_requisite_marker_like_count === 0,
    'structural_none_requisite_markers');
  }
  if (decision.disposition === 'parsed') {
    requireExact(source.complete_entry_receipt?.entry_required_requisite_marker_count === 1,
      'parsed_required_marker');
  }
  requireExact(page?.source_complete_entries_with_required_requisite_marker_count > 0
    || exactArtifact?.facts?.same_catalog_positive_control?.same_catalog_positive_control === true,
  'prerequisite_marker_control');
  if (decision.disposition === 'blocked') {
    const blocker = exactArtifact?.publication_blockers?.find((row) => (
      row.course_key === `${OWNER}:${code}`
    ));
    requireExact(blocker?.named_course_code_count === 0, 'sequence_named_course_count');
    requireExact(blocker?.sequence_direction === null, 'sequence_direction');
    requireExact(blocker?.course_alias_or_direction_inferred === false,
      'sequence_inference_boundary');
  }
  return [...new Set(issues)];
}

function proof(candidate, artifact, disposition) {
  const code = normalizeCode(candidate.course_code);
  const decision = DECISIONS[code];
  const receipt = evidenceRow(artifact, code);
  const page = artifact.facts.source_pages.find((row) => row.page_id === decision.page);
  const signals = projectedSignals(candidate, decision).rows;
  return {
    kind: disposition === 'none'
      ? 'official_complete_nsu_courseleaf_entry_required_prerequisite_silence'
      : 'official_complete_nsu_courseleaf_exact_prerequisite_formula',
    contract: CONTRACT,
    course_entry_status: 'published_exact_courseleaf_courseblock',
    finding: disposition === 'none'
      ? 'no_incoming_prerequisite_formula_after_exact_content_signal_accounting'
      : 'exact_required_prerequisite_formula_with_full_content_signal_accounting',
    literal_none_statement: false,
    boundary_contract: COURSELEAF_BOUNDARY,
    receipt_contract: CONTRACT,
    catalog_year: CATALOG_YEAR,
    owner_namespace: OWNER,
    course_key: `${OWNER}:${code}`,
    source_url: page.official_url,
    source_cache_path: page.cache_path,
    source_response_sha256: page.source_response_sha256,
    source_response_bytes: page.source_response_bytes,
    raw_entry_sha256: receipt.raw_entry_sha256,
    raw_entry_html_sha256: receipt.raw_entry_html_sha256,
    courseblock_index: receipt.courseblock_index,
    published_units: receipt.published_units,
    marker_control: receipt.complete_entry_receipt,
    same_catalog_positive_control: artifact.facts.same_catalog_positive_control,
    preserved_non_prerequisite_signal_count: signals.length,
    content_accounting: {
      full_entry_sha256: receipt.raw_entry_sha256,
      full_entry_retained_as_source_evidence: true,
      every_reviewed_non_prerequisite_signal_preserved: true,
      source_content_discarded: false,
    },
    inference_boundary: disposition === 'none'
      ? 'Status none means only that this exact complete 2025-2026 Norfolk State entry contributes no incoming prerequisite graph formula after every reviewed constraint-like phrase is retained. A same-response or same-catalog formal marker control is present; no missing search result, course alias, or unstated sequence is inferred.'
      : 'The formula reproduces only the exact formal prerequisite field in the complete retained entry. Descriptive readiness and applicability prose remains span-bound evidence and is not silently converted to a course edge.',
  };
}

function blockedAttempt(candidate, artifact) {
  const receipt = evidenceRow(artifact, 'CHM221L');
  const blocker = artifact.publication_blockers.find((row) => (
    row.course_key === `${OWNER}:CHM221L`
  ));
  const sequenceSignals = projectedSignals(candidate, DECISIONS.CHM221L).rows;
  return {
    contract: CONTRACT,
    disposition: 'blocked_unnamed_sequence_requirement',
    catalog_year: CATALOG_YEAR,
    source_response_sha256: candidate.source.source_response_sha256,
    raw_entry_sha256: receipt.raw_entry_sha256,
    raw_entry_html_sha256: receipt.raw_entry_html_sha256,
    sequence_statement: sequenceSignals[0],
    named_course_code_count: blocker.named_course_code_count,
    sequence_direction: blocker.sequence_direction,
    course_alias_or_direction_inferred: false,
    adjacent_sequence_context: artifact.facts.chm_sequence_context,
    content_accounting: {
      full_entry_sha256: receipt.raw_entry_sha256,
      sequence_statement_preserved: true,
      source_content_discarded: false,
    },
    authority_needed: blocker.authority_needed,
    blocker_reason:
      'The complete CHM 221L entry says only that it must be taken in sequence. It does not identify CHM 221, CHM 222L, another course, or whether the relationship is prior, concurrent, or subsequent, so no prerequisite edge is emitted.',
  };
}

function resolveNorfolkStatePrerequisiteClosure(
  candidate,
  clauses = [],
  artifact = null,
) {
  if (!isScopedNorfolkStatePrerequisite(candidate)) {
    return { applicable: false, ready: false, issues: [] };
  }
  const exactArtifact = artifact || loadEvidenceArtifact();
  const code = normalizeCode(candidate.course_code);
  const decision = DECISIONS[code];
  const issues = candidateIssues(candidate, clauses, exactArtifact);
  if (issues.length) return {
    applicable: true,
    ready: false,
    blocked: decision.disposition === 'blocked',
    issues,
    review_reason: 'nsu_exact_prerequisite_closure_receipt_changed',
  };
  if (decision.disposition === 'blocked') {
    const preservedSequenceSignals = projectedSignals(candidate, decision).rows;
    return {
      applicable: true,
      ready: false,
      blocked: true,
      issues: [],
      review_reason: BLOCKED_REVIEW_REASON,
      preserved_sequence_signals: preservedSequenceSignals,
      blocker_evidence: blockedAttempt(candidate, exactArtifact),
    };
  }
  const groups = expectedGroups(code, decision);
  const ignored = projectedSignals(candidate, decision).rows;
  return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: decision.disposition,
    raw_requisites: decision.raw_requisites || null,
    groups,
    review_status: decision.disposition === 'none'
      ? 'promoted_structural_none' : 'promoted_strict_formula',
    review_reason: REVIEW_REASON,
    ignored_nonrequired_requisites: ignored,
    proof: proof(candidate, exactArtifact, decision.disposition),
  };
}

function replayCandidateFromRow(row) {
  const evidence = row?.review_evidence || {};
  return {
    school_id: row?.school_id,
    slug: row?.slug,
    owner_namespace: row?.owner_namespace,
    course_key: row?.course_key,
    course_code: row?.code,
    source: {
      official_url: evidence.official_url,
      declared_normalized_text_sha256: evidence.declared_normalized_text_sha256,
      retained_normalized_text_sha256: evidence.retained_normalized_text_sha256,
      character_start: evidence.entry_character_start,
      character_end: evidence.entry_character_end,
      raw_entry_sha256: evidence.raw_entry_sha256,
      raw_entry_text: evidence.raw_entry_text,
      capture_origin: evidence.capture_origin,
      source_format: evidence.source_format,
      boundary_contract: evidence.boundary_contract,
      catalog_year_verified: evidence.catalog_year_verified,
      source_response_sha256: evidence.source_response_sha256,
      source_response_bytes: evidence.source_response_bytes,
      cache_path: evidence.cache_path,
      courseblock_index: evidence.courseblock_index,
      published_units: evidence.published_units,
      raw_entry_html_sha256: evidence.raw_entry_html_sha256,
      complete_entry_receipt: evidence.complete_entry_receipt,
      structured_requisite_fields: evidence.structured_requisite_fields,
    },
  };
}

function clausesFromReviewEvidence(row) {
  return (row?.review_evidence?.clauses || []).map((entry) => ({
    kind: entry.kind,
    raw: entry.raw,
  }));
}

function resolutionRowIssues(row, artifact = null) {
  if (!isScopedNorfolkStatePrerequisite(row)) return [];
  const exactArtifact = artifact || loadEvidenceArtifact();
  const candidate = replayCandidateFromRow(row);
  const resolved = resolveNorfolkStatePrerequisiteClosure(
    candidate,
    clausesFromReviewEvidence(row),
    exactArtifact,
  );
  const code = normalizeCode(row.code);
  const decision = DECISIONS[code];
  const issues = [];
  if (decision.disposition === 'blocked') {
    if (resolved.ready || !resolved.blocked
        || row.status !== 'unparsed'
        || row.review_status !== 'not_promoted'
        || row.review_reason !== BLOCKED_REVIEW_REASON
        || row.raw_requisites !== null
        || !same(row.groups, [])
        || !same(row.preserved_sequence_signals,
          resolved.preserved_sequence_signals)
        || !same(row.prerequisite_constraint_blocker_evidence,
          resolved.blocker_evidence)) {
      issues.push('blocked_review_status');
    }
  } else if (!resolved.ready) issues.push('source_receipt');
  else {
    if (row.status !== resolved.status
        || row.raw_requisites !== resolved.raw_requisites
        || row.review_status !== resolved.review_status
        || row.review_reason !== resolved.review_reason
        || !same(row.groups, resolved.groups)) issues.push('review_status');
    if (!same(row.ignored_nonrequired_requisites,
      resolved.ignored_nonrequired_requisites)) issues.push('nonrequired_signals');
    const proofField = decision.disposition === 'none'
      ? row.structural_none_evidence : row.norfolk_state_prerequisite_resolution;
    if (!same(proofField, resolved.proof)) issues.push('proof');
  }
  if (row.source_content_sha256 !== row.review_evidence?.raw_entry_sha256
      || row.source_evidence?.content_sha256 !== row.review_evidence?.raw_entry_sha256
      || row.source_evidence?.raw_text !== row.review_evidence?.raw_entry_text) {
    issues.push('source_binding');
  }
  return issues;
}

module.exports = {
  ARTIFACT,
  BLOCKED_REVIEW_REASON,
  CATALOG_YEAR,
  CLOSURE_CODES,
  CONTRACT,
  COURSELEAF_BOUNDARY,
  COURSELEAF_RECEIPT,
  DECISIONS,
  DIRECT_REMEDIATION_CODES,
  EVIDENCE_PATH,
  EXPECTED_FACTS_SHA256,
  FORMULA,
  MISSING_CLOSURE_CODES,
  MISSING_CLOSURE_REFERENCES,
  OWNER,
  REVIEW_REASON,
  SCHOOL_ID,
  SLUG,
  TARGET_CODES,
  artifactIssues,
  candidateIssues,
  canonicalJson,
  isScopedNorfolkStatePrerequisite,
  loadEvidenceArtifact,
  projectedSignals,
  resolutionRowIssues,
  resolveNorfolkStatePrerequisiteClosure,
  sha256,
};
