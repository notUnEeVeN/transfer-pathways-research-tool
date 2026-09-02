/**
 * Exact Virginia State prerequisite/corequisite remediation for the finite
 * direct-path rows that remained unparsed after the generic CourseLeaf pass.
 *
 * The generic parser intentionally refuses to infer prerequisite silence from
 * a corequisite-only entry or from prose containing words such as "required".
 * This module does not weaken that rule.  It binds the fixed 26 direct rows
 * plus their exact CHEM 105 recursive-closure row to an independently
 * replayable evidence artifact, preserves every reviewed
 * corequisite/restriction/content signal, and emits formulas only where the
 * exact current source supports them.  PHYS 112 remains blocked because its
 * current entry names MATH 200 while the complete current MATH subject page
 * publishes no MATH 200 entry; MATH 260 is not inferred as an alias.
 */

const crypto = require('node:crypto');
const path = require('node:path');

const ARTIFACT = 'virginia_state_prerequisite_closure_evidence';
const CONTRACT =
  'vsu_exact_2026_2027_courseleaf_prerequisite_corequisite_content_accounting_v1';
const REVIEW_REASON =
  'exact_vsu_courseleaf_required_requisite_formula_or_structural_silence';
const BLOCKED_REVIEW_REASON =
  'vsu_phys112_current_corequisite_reference_missing_from_current_math_catalog';
const SCHOOL_ID = 9231;
const SLUG = 'virginia-state-university';
const OWNER = 'va:uni:9231';
const CATALOG_YEAR = '2026-2027';
const FORMULA = 'paths_or__conditions_and';
const COURSELEAF_BOUNDARY =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const EVIDENCE_PATH = path.resolve(
  __dirname,
  '../../.va-catalogs/research/virginia-state-prerequisite-closure-evidence.json',
);

// Updated only after replaying every retained official response.  The value is
// intentionally not derived from the checked-in artifact at runtime.
const EXPECTED_FACTS_SHA256 =
  '8bd1013217706d76bb5ca94128644f984ec5e01e3240e39f324257816d5c43f5';

const signal = (kind, raw, extra = {}) => Object.freeze({
  channel: 'ignored_nonrequired_requisites', kind, raw, ...extra,
});
const internal = (kind, raw, extra = {}) => Object.freeze({
  channel: 'internal_component_corequisites', kind, raw, ...extra,
});
const course = (code, raw) => Object.freeze({ type: 'course', code, raw });
const nonCourse = (condition, raw, extra = {}) => Object.freeze({
  type: 'non_course', condition, raw, ...extra,
});
const group = (kind, raw, conditions) => Object.freeze({
  kind, raw, conditions: Object.freeze(conditions),
});
const clause = (kind, raw) => Object.freeze({ kind, raw });

const DECISIONS = Object.freeze({
  AGRI100: Object.freeze({
    page: 'agri', disposition: 'none', clauses: Object.freeze([
      clause('corequisite', 'AGRI 100.'),
    ]),
    signals: Object.freeze([
      internal(
        'same_catalog_code_internal_laboratory_corequisite',
        'Lab Co-requisite: AGRI 100.',
        { component: 'laboratory', course_code: 'AGRI100' },
      ),
    ]),
  }),
  AGRI150: Object.freeze({
    page: 'agri', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      internal(
        'unnumbered_integrated_laboratory_component',
        'A laboratory is taken in conjunction and provides hands on laboratory exercises related to selected lecture topics.',
        { component: 'laboratory', course_code: null },
      ),
    ]),
  }),
  BIOL116: Object.freeze({
    page: 'biol', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      signal(
        'outbound_prerequisite_exclusion',
        'This course does not serve as a prerequisite for any other biology course.',
      ),
    ]),
  }),
  BIOL120: Object.freeze({
    page: 'biol', disposition: 'none', clauses: Object.freeze([
      clause(
        'corequisite',
        'BIOL 120 Principles of Biology I Laboratory Lab: A laboratory course required to be taken in conjunction with BIOL 120 Principles of Biology I lecture course. This course will involve hands on laboratory exercises related to selected lecture topics.',
      ),
      clause('corequisite', 'BIOL 120 Principles of Biology I Lecture.'),
    ]),
    signals: Object.freeze([
      signal(
        'outbound_prerequisite_statement',
        'This course is a pre-requisite for all other Biology courses.',
      ),
      internal(
        'same_catalog_code_internal_laboratory_corequisite',
        'Co-requisite: BIOL 120 Principles of Biology I Laboratory Lab: A laboratory course required to be taken in conjunction with BIOL 120 Principles of Biology I lecture course. This course will involve hands on laboratory exercises related to selected lecture topics.',
        { component: 'laboratory', course_code: 'BIOL120' },
      ),
      internal(
        'same_catalog_code_internal_lecture_corequisite',
        'Co-requisite: BIOL 120 Principles of Biology I Lecture.',
        { component: 'lecture', course_code: 'BIOL120' },
      ),
    ]),
  }),
  CHEM105: Object.freeze({
    page: 'chem', disposition: 'none', clauses: Object.freeze([
      clause('corequisite', 'CHEM 105 Introductory Chemistry.'),
    ]),
    signals: Object.freeze([
      signal(
        'audience_readiness_note',
        'designed for students lacking the pre-requisites for General Chemistry (CHEM151)',
      ),
      internal(
        'same_catalog_code_internal_laboratory_corequisite',
        'Co-requisite: CHEM 105 Introductory Chemistry.',
        { component: 'laboratory', course_code: 'CHEM105' },
      ),
    ]),
  }),
  CHEM153: Object.freeze({
    page: 'chem', disposition: 'parsed', clauses: Object.freeze([
      clause('corequisite', 'CHEM 151 General Chemistry I.'),
    ]),
    groups: Object.freeze([
      group('corequisite', 'Co-requisite: CHEM 151 General Chemistry I.', [
        course('CHEM151', 'CHEM 151 General Chemistry I'),
      ]),
    ]), signals: Object.freeze([]),
  }),
  CHEM163: Object.freeze({
    page: 'chem', disposition: 'parsed', clauses: Object.freeze([
      clause('corequisite', 'CHEM 161 Chemistry I.'),
    ]),
    groups: Object.freeze([
      group('corequisite', 'Co-requisite: CHEM 161 Chemistry I.', [
        course('CHEM161', 'CHEM 161 Chemistry I'),
      ]),
    ]), signals: Object.freeze([]),
  }),
  CSCI150: Object.freeze({
    page: 'csci', disposition: 'parsed', clauses: Object.freeze([
      clause(
        'corequisite',
        'CSCI 101 Introduction to Computer Science Profession and CSCI 151 Programming I Labs.',
      ),
    ]),
    groups: Object.freeze([
      group(
        'corequisite',
        'Co-requisites: CSCI 101 Introduction to Computer Science Profession and CSCI 151 Programming I Labs.',
        [
          course('CSCI101', 'CSCI 101 Introduction to Computer Science Profession'),
          course('CSCI151', 'CSCI 151 Programming I Labs'),
        ],
      ),
    ]),
    signals: Object.freeze([
      signal(
        'duplicate_corequisite_statement_coalesced',
        'Students must be co-enrolled in CSCI 151.',
        { course_code: 'CSCI151', coalesced_with_group_index: 0 },
      ),
    ]),
  }),
  CSCI151: Object.freeze({
    page: 'csci', disposition: 'parsed', clauses: Object.freeze([
      clause(
        'corequisite',
        'CSCI 101 Computer Science Profession and CSCI 150 Programming I.',
      ),
    ]),
    groups: Object.freeze([
      group(
        'corequisite',
        'Co-requisites: CSCI 101 Computer Science Profession and CSCI 150 Programming I.',
        [
          course('CSCI101', 'CSCI 101 Computer Science Profession'),
          course('CSCI150', 'CSCI 150 Programming I'),
        ],
      ),
    ]),
    signals: Object.freeze([
      signal(
        'duplicate_corequisite_statement_coalesced',
        'Students must be co-enrolled in CSCI 150.',
        { course_code: 'CSCI150', coalesced_with_group_index: 0 },
      ),
    ]),
  }),
  DIET101: Object.freeze({
    page: 'diet', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      signal('descriptive_nutrient_requirement_phrase', 'biological nutrient requirements'),
    ]),
  }),
  DRAM199: Object.freeze({
    page: 'dram', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      signal(
        'course_activity_requirement',
        'Some evaluation of outside performances is required and involvement in one of the college theatre productions may also be required.',
      ),
    ]),
  }),
  FREN110: Object.freeze({
    page: 'fren', disposition: 'parsed', clauses: Object.freeze([]),
    groups: Object.freeze([
      group(
        'prerequisite',
        'open to students receiving no admission credit in French',
        [nonCourse(
          'no_admission_credit_in_french',
          'open to students receiving no admission credit in French',
          { admission_credit_subject: 'French', admission_credit_allowed: false },
        )],
      ),
    ]), signals: Object.freeze([]),
  }),
  GEOG210: Object.freeze({
    page: 'geog', disposition: 'none', clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  GLST202: Object.freeze({
    page: 'glst', disposition: 'none', clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  HPER160: Object.freeze({
    page: 'hper', disposition: 'none', clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  HPER165: Object.freeze({
    page: 'hper', disposition: 'none', clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  HPER166: Object.freeze({
    page: 'hper', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      signal(
        'certificate_outcome_statement',
        'Satisfactory completion of this course enables the student to meet the requirements for the American Red Cross Beginner Swimming Certificate.',
      ),
    ]),
  }),
  HPER169: Object.freeze({
    page: 'hper', disposition: 'none', clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  HPER170: Object.freeze({
    page: 'hper', disposition: 'none', clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  HPER171: Object.freeze({
    page: 'hper', disposition: 'none', clauses: Object.freeze([]), signals: Object.freeze([]),
  }),
  MATH130: Object.freeze({
    page: 'math', disposition: 'parsed', clauses: Object.freeze([]),
    groups: Object.freeze([
      group(
        'prerequisite',
        'ONLY for students seeking certification to reach PreK - 3/PreK - 6',
        [nonCourse(
          'prek_3_or_prek_6_teacher_certification_student',
          'ONLY for students seeking certification to reach PreK - 3/PreK - 6',
          {
            academic_program_kind: 'teacher_certification',
            eligible_certification_levels: Object.freeze(['PreK-3', 'PreK-6']),
          },
        )],
      ),
    ]), signals: Object.freeze([]),
  }),
  MATH150: Object.freeze({
    page: 'math', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      signal(
        'outbound_anti_credit_restriction',
        'Students successfully completing this course cannot take MATH 120 or MATH 121 for credit.',
        { restricted_future_course_codes: Object.freeze(['MATH120', 'MATH121']) },
      ),
    ]),
  }),
  PHYS100: Object.freeze({
    page: 'phys', disposition: 'none', clauses: Object.freeze([
      clause('corequisite', 'PHYS 100.'),
    ]),
    signals: Object.freeze([
      internal(
        'same_catalog_code_internal_laboratory_corequisite',
        'Co-requisite: PHYS 100.',
        { component: 'laboratory', course_code: 'PHYS100' },
      ),
    ]),
  }),
  PHYS112: Object.freeze({
    page: 'phys', disposition: 'blocked', clauses: Object.freeze([
      clause(
        'corequisite',
        'MATH 200 Calculus I Lab Laboratory experiments in mechanics, fluids, and heat designed to compliment PHYS 112.',
      ),
      clause('corequisite', 'PHYS 112 General Physics I.'),
    ]),
    signals: Object.freeze([
      internal(
        'same_catalog_code_internal_laboratory_corequisite',
        'Co-requisite: PHYS 112 General Physics I.',
        { component: 'laboratory', course_code: 'PHYS112' },
      ),
    ]),
    blocker: Object.freeze({
      referenced_course_code: 'MATH200',
      current_catalog_nearby_code: 'MATH260',
      inference_refused: 'MATH200_to_MATH260_alias_or_typographical_correction',
    }),
  }),
  PSYC212: Object.freeze({
    page: 'psyc', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      signal(
        'course_activity_requirement',
        'Students are required to observe children under guidance and to apply methods of child study.',
      ),
    ]),
  }),
  SOCI101: Object.freeze({
    page: 'soci', disposition: 'none', clauses: Object.freeze([]),
    signals: Object.freeze([
      signal(
        'outbound_degree_requirement',
        'This course is required for all sociology majors.',
      ),
    ]),
  }),
  SPAN110: Object.freeze({
    page: 'span', disposition: 'parsed', clauses: Object.freeze([]),
    groups: Object.freeze([
      group(
        'prerequisite',
        'open to students receiving no admission credit in Spanish',
        [nonCourse(
          'no_admission_credit_in_spanish',
          'open to students receiving no admission credit in Spanish',
          { admission_credit_subject: 'Spanish', admission_credit_allowed: false },
        )],
      ),
    ]), signals: Object.freeze([]),
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

function isScopedVirginiaStatePrerequisite({
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
  // Deliberately lazy: the evidence builder imports this module to create the
  // artifact from retained sources.
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
  const expectedCounts = { parsed: 7, none: 19, blocked: 1 };
  const counts = Object.fromEntries(Object.keys(expectedCounts).map((disposition) => [
    disposition, rows.filter((row) => row.disposition === disposition).length,
  ]));
  if (!same(counts, expectedCounts)) issues.push('disposition_counts');
  if (artifact?.publication_ready !== false) issues.push('publication_ready');
  if (artifact?.publication_blockers?.length !== 1
      || artifact.publication_blockers[0]?.course_key !== `${OWNER}:PHYS112`) {
    issues.push('publication_blockers');
  }
  return issues;
}

function evidenceRow(artifact, code) {
  return artifact?.facts?.target_rows?.find((row) => row.course_code === code) || null;
}

function boundedSpan(text, row, index) {
  const start = String(text || '').indexOf(row.raw);
  if (start < 0 || String(text).indexOf(row.raw, start + row.raw.length) >= 0) {
    return { issue: `reviewed_span_${index}_not_unique` };
  }
  return { start, end: start + row.raw.length };
}

function projectedSignals(candidate, decision) {
  const text = String(candidate?.source?.raw_entry_text || '');
  const ignored = [];
  const internalComponents = [];
  const issues = [];
  for (const [index, sourceSignal] of (decision.signals || []).entries()) {
    const span = boundedSpan(text, sourceSignal, index);
    if (span.issue) {
      issues.push(span.issue);
      continue;
    }
    const { channel, ...signalFields } = sourceSignal;
    const projected = {
      ...signalFields,
      raw_sha256: sha256(sourceSignal.raw),
      relative_start: span.start,
      relative_end: span.end,
      source_character_start: candidate.source.character_start + span.start,
      source_character_end: candidate.source.character_start + span.end,
      required_prerequisite_graph_edge_emitted: false,
      source_content_preserved: true,
    };
    if (channel === 'internal_component_corequisites') {
      projected.graph_projection = 'preserved_internal_component_without_self_edge';
      internalComponents.push(projected);
    } else ignored.push(projected);
  }
  return { ignored, internalComponents, issues };
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
        'vsu_exact_courseleaf_closure_evidence',
      ],
      formula: FORMULA,
      paths: [{
        id: `${groupId}:path:0`,
        raw: sourceGroup.raw,
        all_of: sourceGroup.conditions.map((condition) => (
          condition.type === 'course' ? {
            ...condition,
            course_key: `${OWNER}:${condition.code}`,
          } : { ...condition }
        )),
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

function candidateIssues(candidate, clauses = [], artifact = loadEvidenceArtifact()) {
  if (!isScopedVirginiaStatePrerequisite(candidate)) return ['not_scoped'];
  const code = normalizeCode(candidate.course_code);
  const decision = DECISIONS[code];
  const receipt = evidenceRow(artifact, code);
  const page = artifact?.facts?.source_pages?.find((row) => row.page_id === decision.page);
  const source = candidate.source || {};
  const issues = [...artifactIssues(artifact)];
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
  requireExact(same(source.structured_requisite_fields, []),
    'structured_requisite_fields');
  requireExact(same(clauseShape(clauses), decision.clauses), 'required_clause_projection');
  const signals = projectedSignals(candidate, decision);
  issues.push(...signals.issues);
  if (decision.disposition === 'blocked') {
    const blocker = artifact?.publication_blockers?.find((row) => (
      row.course_key === `${OWNER}:${code}`
    ));
    requireExact(blocker?.referenced_course_code === decision.blocker.referenced_course_code,
      'blocked_reference');
    requireExact(blocker?.current_math_subject_exact_entry_count_for_math200 === 0,
      'math200_absence_receipt');
    requireExact(blocker?.alias_inferred === false, 'alias_inference_boundary');
  }
  return [...new Set(issues)];
}

function proof(candidate, artifact, disposition) {
  const code = normalizeCode(candidate.course_code);
  const decision = DECISIONS[code];
  const receipt = evidenceRow(artifact, code);
  const page = artifact.facts.source_pages.find((row) => row.page_id === decision.page);
  const signals = projectedSignals(candidate, decision);
  return {
    kind: disposition === 'none'
      ? 'official_complete_vsu_courseleaf_entry_required_prerequisite_silence'
      : 'official_complete_vsu_courseleaf_exact_requisite_formula',
    contract: CONTRACT,
    course_entry_status: 'published_exact_courseleaf_courseblock',
    finding: disposition === 'none'
      ? 'no_incoming_prerequisite_formula_after_exact_corequisite_and_content_accounting'
      : 'exact_required_requisite_formula_with_full_content_accounting',
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
    preserved_nonrequired_signal_count: signals.ignored.length,
    preserved_internal_component_count: signals.internalComponents.length,
    content_accounting: {
      full_entry_sha256: receipt.raw_entry_sha256,
      full_entry_retained_as_source_evidence: true,
      every_reviewed_corequisite_and_noncourse_signal_preserved: true,
      source_content_discarded: false,
    },
    inference_boundary: disposition === 'none'
      ? 'Status none means that this exact complete current VSU course entry contributes no incoming prerequisite graph formula. Same-code or unnumbered integrated laboratory components and every reviewed non-prerequisite condition remain span-bound evidence; they are not erased or converted into invented self-edges.'
      : 'The formula is emitted only for the exact span-bound current VSU course/corequisite or non-course enrollment condition. The complete entry remains retained, and no missing catalog record or course-code alias is inferred.',
  };
}

function blockedAttempt(candidate, artifact) {
  const code = normalizeCode(candidate.course_code);
  const decision = DECISIONS[code];
  const receipt = evidenceRow(artifact, code);
  const blocker = artifact.publication_blockers.find((row) => (
    row.course_key === `${OWNER}:${code}`
  ));
  const signals = projectedSignals(candidate, decision);
  return {
    contract: CONTRACT,
    disposition: 'blocked_conflicting_current_catalog_reference',
    source_response_sha256: candidate.source.source_response_sha256,
    raw_entry_sha256: receipt.raw_entry_sha256,
    referenced_course_code: decision.blocker.referenced_course_code,
    current_catalog_nearby_code: decision.blocker.current_catalog_nearby_code,
    current_math_subject_response_sha256: blocker.current_math_subject_response_sha256,
    current_math_subject_exact_entry_count_for_math200:
      blocker.current_math_subject_exact_entry_count_for_math200,
    current_math_subject_exact_entry_count_for_math260:
      blocker.current_math_subject_exact_entry_count_for_math260,
    alias_inferred: false,
    inference_refused: decision.blocker.inference_refused,
    source_corequisite_clauses: decision.clauses,
    preserved_internal_component_corequisites: signals.internalComponents,
    content_accounting: {
      full_entry_sha256: receipt.raw_entry_sha256,
      complete_corequisite_clauses_preserved: true,
      source_content_discarded: false,
    },
    blocker_reason:
      'The exact PHYS 112 entry requires MATH 200, but the complete exact current MATH subject page contains no MATH 200 entry and separately publishes MATH 260 as Calculus I. Treating MATH 260 as MATH 200 would silently repair an official-source conflict.',
  };
}

function resolveVirginiaStatePrerequisiteClosure(
  candidate,
  clauses = [],
  artifact = loadEvidenceArtifact(),
) {
  if (!isScopedVirginiaStatePrerequisite(candidate)) {
    return { applicable: false, ready: false, issues: [] };
  }
  const issues = candidateIssues(candidate, clauses, artifact);
  const code = normalizeCode(candidate.course_code);
  const decision = DECISIONS[code];
  if (issues.length) return {
    applicable: true,
    ready: false,
    blocked: decision.disposition === 'blocked',
    issues,
    review_reason: 'vsu_exact_prerequisite_closure_receipt_changed',
  };
  if (decision.disposition === 'blocked') return {
    applicable: true,
    ready: false,
    blocked: true,
    issues: [],
    review_reason: BLOCKED_REVIEW_REASON,
    preserved_corequisite_clauses: decision.clauses,
    internal_component_corequisites:
      projectedSignals(candidate, decision).internalComponents,
    blocker_evidence: blockedAttempt(candidate, artifact),
  };
  const signals = projectedSignals(candidate, decision);
  const groups = expectedGroups(code, decision);
  return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: decision.disposition,
    raw_requisites: groups.length ? groups.map((row) => row.raw).join('\n') : null,
    groups,
    review_status: decision.disposition === 'none'
      ? 'promoted_structural_none' : 'promoted_strict_formula',
    review_reason: REVIEW_REASON,
    ignored_nonrequired_requisites: signals.ignored,
    internal_component_corequisites: signals.internalComponents,
    proof: proof(candidate, artifact, decision.disposition),
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

function resolutionRowIssues(row, artifact = loadEvidenceArtifact()) {
  if (!isScopedVirginiaStatePrerequisite(row)) return [];
  const candidate = replayCandidateFromRow(row);
  const resolved = resolveVirginiaStatePrerequisiteClosure(
    candidate,
    clausesFromReviewEvidence(row),
    artifact,
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
        || !same(row.preserved_corequisite_clauses,
          resolved.preserved_corequisite_clauses)
        || !same(row.internal_component_corequisites || [],
          resolved.internal_component_corequisites)
        || !same(row.virginia_state_prerequisite_blocker, resolved.blocker_evidence)) {
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
    if (!same(row.internal_component_corequisites || [],
      resolved.internal_component_corequisites)) issues.push('internal_components');
    const proofField = decision.disposition === 'none'
      ? row.structural_none_evidence : row.virginia_state_prerequisite_resolution;
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
  CONTRACT,
  COURSELEAF_BOUNDARY,
  COURSELEAF_RECEIPT,
  DECISIONS,
  EVIDENCE_PATH,
  EXPECTED_FACTS_SHA256,
  FORMULA,
  OWNER,
  REVIEW_REASON,
  SCHOOL_ID,
  SLUG,
  TARGET_CODES,
  artifactIssues,
  candidateIssues,
  canonicalJson,
  isScopedVirginiaStatePrerequisite,
  loadEvidenceArtifact,
  projectedSignals,
  resolutionRowIssues,
  resolveVirginiaStatePrerequisiteClosure,
  sha256,
};
