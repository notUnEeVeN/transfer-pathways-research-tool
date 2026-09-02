/**
 * Exact prerequisite resolutions for the finite outstanding rows at six
 * Virginia universities whose source shapes do not fit the shared grammar.
 *
 * This module is deliberately narrow. Every supported row is named below,
 * every formula and ignored signal is closed over exact retained text, and
 * the generated evidence artifact is pinned as one canonical fact set. A
 * source, edition, boundary, marker-control, or wording change returns the row
 * to review. Exact named corequisites remain formulas; genuinely ambiguous or
 * unnamed requirements stay blocked.
 */

const crypto = require('node:crypto');
const path = require('node:path');

const ARTIFACT = 'virginia_small_university_prerequisite_closure_evidence';
const CONTRACT =
  'va_six_university_exact_prerequisite_formula_and_structural_none_v1';
const FORMULA = 'paths_or__conditions_and';
const REVIEW_REASON =
  'exact_six_university_source_bound_prerequisite_resolution';
const BLOCKED_REVIEW_REASON =
  'six_university_exact_source_prerequisite_ambiguity_preserved';
const EVIDENCE_PATH = path.resolve(
  __dirname,
  '../../.va-catalogs/research/va-small-university-prerequisite-closure-evidence.json',
);

// Filled only after replaying all retained official bytes. The JSON cannot be
// changed independently of this code pin.
const EXPECTED_FACTS_SHA256 =
  'a4e589cbacb428b51da0938999c797e4614a49e8f844d569f808d785d7d31ad2';

const condition = (name, raw, extra = {}) => Object.freeze({
  type: 'non_course', condition: name, raw, ...extra,
});
const course = (code, raw, extra = {}) => Object.freeze({
  type: 'course', code, raw, ...extra,
});
const group = (kind, raw, paths, extra = {}) => Object.freeze({
  kind, raw,
  paths: Object.freeze(paths.map((row) => Object.freeze(row))),
  ...extra,
});
const prerequisiteGroup = (raw, paths, extra = {}) => (
  group('prerequisite', raw, paths, extra)
);
const corequisiteGroup = (raw, paths, extra = {}) => (
  group('corequisite', raw, paths, extra)
);
const signal = (kind, raw, extra = {}) => Object.freeze({
  kind,
  raw,
  required_prerequisite_graph_edge_emitted: false,
  ...extra,
});
const identity = ({
  schoolId, slug, owner, catalogYear, code, scopeRole, sourceId,
  disposition, rawRequisites = null, groups = [], signals = [], blocker = null,
  markerExpectation = null,
}) => Object.freeze({
  school_id: schoolId,
  slug,
  owner_namespace: owner,
  catalog_year: catalogYear,
  course_code: code,
  course_key: `${owner}:${code}`,
  scope_role: scopeRole,
  source_id: sourceId,
  disposition,
  raw_requisites: rawRequisites,
  groups: Object.freeze(groups),
  signals: Object.freeze(signals),
  blocker,
  marker_expectation: markerExpectation && Object.freeze(markerExpectation),
});

const SHEN = Object.freeze({
  schoolId: 9224,
  slug: 'shenandoah-university',
  owner: 'va:uni:9224',
  catalogYear: '2025-2026',
});
const UVA_WISE = Object.freeze({
  schoolId: 9226,
  slug: 'the-university-of-virginia-s-college-at-wise',
  owner: 'va:uni:9226',
  catalogYear: '2026-2027',
});
const UMW = Object.freeze({
  schoolId: 9228,
  slug: 'university-of-mary-washington',
  owner: 'va:uni:9228',
  catalogYear: '2026-2027',
});
const WM = Object.freeze({
  schoolId: 9233,
  slug: 'william-mary',
  owner: 'va:uni:9233',
  catalogYear: '2026-2027',
});
const CNU = Object.freeze({
  schoolId: 9206,
  slug: 'christopher-newport-university',
  owner: 'va:uni:9206',
  catalogYear: '2025-2026',
});
const JMU = Object.freeze({
  schoolId: 9213,
  slug: 'james-madison-university',
  owner: 'va:uni:9213',
  catalogYear: '2026-2027',
});

const FYS_RESTRICTION =
  'Open only to first-year, first-semester students.';
const JMU_MATH105_FIELD =
  'This course is not open to students who have completed MATH 220 with a grade of C- or higher, or to majors in mathematics or statistics.';
const JMU_MATH155_ALEKS =
  'An appropriate ALEKS placement score is required in order to enroll.';
const JMU_MATH155_POSITIVE =
  'Demonstrated Proficiency in Algebra through the Math Placement Test. A test is required to determine placement in MATH 155.';
const JMU_MATH155_EXCLUSION =
  'Not eligible if you have earned credit for MATH 135, MATH 156, MATH 205, MATH 231, MATH 232 or MATH 235.';
const JMU_MATH156_POSITIVE =
  'Demonstrated Proficiency in Algebra through the Math Placement Test.';
const JMU_MATH156_EXCLUSION =
  'Not eligible if you have earned credit for MATH 135, MATH 155, MATH 205, MATH 231, MATH 232, or MATH 235.';
const JMU_MATH236_FORMULA =
  'MATH 232 or MATH 234 or MATH 235 with a grade of "C-" or better.';

const DECISIONS = Object.freeze({
  [`${SHEN.slug}:CSC121`]: identity({
    ...SHEN, code: 'CSC121', scopeRole: 'direct_remediation',
    sourceId: 'shen_csc121', disposition: 'none',
    signals: [signal(
      'explicit_no_previous_programming_experience_required',
      'No previous programming experience is required.',
      { incoming_prerequisite_effect: false },
    )],
  }),
  [`${SHEN.slug}:FYS101`]: identity({
    ...SHEN, code: 'FYS101', scopeRole: 'direct_remediation',
    sourceId: 'shen_fys101', disposition: 'parsed',
    rawRequisites: FYS_RESTRICTION,
    groups: [prerequisiteGroup(FYS_RESTRICTION, [[condition(
      'first_year_first_semester_student',
      FYS_RESTRICTION,
      {
        student_year: 1,
        semester_ordinal: 1,
        enrollment_restriction: true,
      },
    )]], { grammar: 'exact_unstructured_enrollment_restriction' })],
  }),
  [`${UVA_WISE.slug}:CSC1010`]: identity({
    ...UVA_WISE, code: 'CSC1010', scopeRole: 'direct_remediation',
    sourceId: 'uva_wise_csc1010', disposition: 'none',
    signals: [
      signal(
        'explicit_no_prior_programming_experience_assumed',
        'No prior programming experience is assumed.',
        { incoming_prerequisite_effect: false },
      ),
      signal(
        'prior_credit_exclusion',
        'This course may not be taken for credit after the student has taken CSC 1180 .',
        { excluded_if_credit_for: ['CSC1180'], incoming_prerequisite_effect: false },
      ),
    ],
  }),
  [`${UVA_WISE.slug}:ENG1010`]: identity({
    ...UVA_WISE, code: 'ENG1010', scopeRole: 'direct_remediation',
    sourceId: 'uva_wise_eng1010', disposition: 'blocked',
    signals: [signal(
      'unresolved_composition_sequence_placement',
      'Full-time students who have not completed ENG 1010-ENG 1020 or the equivalent must enroll in the appropriate course in that sequence.',
      {
        incoming_prerequisite_effect: 'unresolved',
        named_sequence_courses: ['ENG1010', 'ENG1020'],
        appropriate_course_identified: false,
      },
    )],
    blocker:
      'The exact entry requires the appropriate course in a two-course sequence but does not identify the placement rule that makes ENG 1010 appropriate.',
  }),
  [`${UMW.slug}:CPSC220`]: identity({
    ...UMW, code: 'CPSC220', scopeRole: 'direct_remediation',
    sourceId: 'umw_cpsc', disposition: 'none',
    signals: [
      signal(
        'intended_programming_background',
        'This course is intended for students with previous programming experience.',
        { incoming_prerequisite_effect: false },
      ),
      signal(
        'advisory_alternative_course',
        'Others are advised to take CPSC 110 instead.',
        { advised_course_code: 'CPSC110', incoming_prerequisite_effect: false },
      ),
    ],
  }),
  [`${UMW.slug}:CPSC284`]: identity({
    ...UMW, code: 'CPSC284', scopeRole: 'direct_remediation',
    sourceId: 'umw_cpsc', disposition: 'blocked',
    signals: [
      signal(
        'assumed_programming_background',
        'This course assumes prior programming experience.',
        { incoming_prerequisite_effect: 'unresolved' },
      ),
      signal(
        'ambiguous_should_take_before_enrolling',
        'Others should take CPSC 110 before enrolling in this class.',
        { named_course_code: 'CPSC110', incoming_prerequisite_effect: 'unresolved' },
      ),
    ],
    blocker:
      'The entry says students "should" take CPSC 110 before enrolling but does not say whether that is enforceable, recommended, or waivable.',
  }),
  [`${UMW.slug}:CPSC110`]: identity({
    ...UMW, code: 'CPSC110', scopeRole: 'recursive_closure',
    sourceId: 'umw_cpsc', disposition: 'none',
    signals: [signal(
      'graded_credit_exclusion_after_higher_course',
      'May not be taken for graded credit after passing any Computer Science course numbered 220 or higher.',
      { incoming_prerequisite_effect: false },
    )],
  }),
  [`${WM.slug}:CSCI141`]: identity({
    ...WM, code: 'CSCI141', scopeRole: 'direct_remediation',
    sourceId: 'wm_csci', disposition: 'parsed',
    rawRequisites: 'Corequisite(s): CSCI 141L',
    groups: [corequisiteGroup('CSCI 141L', [[course('CSCI141L', 'CSCI 141L')]], {
      grammar: 'exact_formal_single_course_corequisite',
      statement_raw: 'Corequisite(s): CSCI 141L',
    })],
    markerExpectation: { required: 0, corequisite: 1 },
  }),
  [`${WM.slug}:MATH109`]: identity({
    ...WM, code: 'MATH109', scopeRole: 'direct_remediation',
    sourceId: 'wm_math', disposition: 'parsed',
    rawRequisites: 'Corequisite(s): MATH 109L',
    groups: [corequisiteGroup('MATH 109L', [[course('MATH109L', 'MATH 109L')]], {
      grammar: 'exact_formal_single_course_corequisite',
      statement_raw: 'Corequisite(s): MATH 109L',
    })],
    signals: [signal(
      'duplicate_required_coregistration_statement',
      'Co-registration in the computational laboratory MATH 109L is required.',
      {
        corequisite_course_code: 'MATH109L',
        incoming_prerequisite_effect: false,
        duplicated_by_exact_corequisite_formula: true,
      },
    )],
    markerExpectation: { required: 0, corequisite: 1 },
  }),
  [`${WM.slug}:MATH111`]: identity({
    ...WM, code: 'MATH111', scopeRole: 'direct_remediation',
    sourceId: 'wm_math', disposition: 'blocked',
    signals: [
      signal(
        'required_equipment',
        'Requires graphing calculator.',
        { incoming_prerequisite_effect: false },
      ),
      signal(
        'unnamed_required_calculus_lab_corequisite',
        'Concurrent enrollment in Math 111 calculus lab required.',
        {
          incoming_prerequisite_effect: 'unresolved',
          inferred_lab_course_code: null,
        },
      ),
      signal(
        'mutual_credit_exclusion',
        'Students may not receive credit for more than one of Math 108, 111, and 131.',
        { excluded_course_codes: ['MATH108', 'MATH111', 'MATH131'], incoming_prerequisite_effect: false },
      ),
    ],
    blocker:
      'Concurrent enrollment is required in an unnamed calculus-lab course; no course code or independently bounded lab identity may be invented.',
  }),
  [`${WM.slug}:MATH131`]: identity({
    ...WM, code: 'MATH131', scopeRole: 'direct_remediation',
    sourceId: 'wm_math', disposition: 'none',
    signals: [signal(
      'mutual_credit_exclusion',
      'Students may not receive credit for more than one of Math 108, 111, and 131.',
      { excluded_course_codes: ['MATH108', 'MATH111', 'MATH131'], incoming_prerequisite_effect: false },
    )],
  }),
  [`${CNU.slug}:ENGR211`]: identity({
    ...CNU, code: 'ENGR211', scopeRole: 'recursive_closure',
    sourceId: 'cnu_pdf', disposition: 'parsed',
    rawRequisites:
      'Corequisites: PHYS 202/202L; MATH 247; ENGR 210 or\nPHYS 340.',
    groups: [corequisiteGroup(
      'PHYS 202/202L; MATH 247; ENGR 210 or\nPHYS 340',
      [
        [
          course('PHYS202', 'PHYS 202'),
          course('PHYS202L', 'PHYS 202L'),
          course('MATH247', 'MATH 247'),
          course('ENGR210', 'ENGR 210'),
        ],
        [
          course('PHYS202', 'PHYS 202'),
          course('PHYS202L', 'PHYS 202L'),
          course('MATH247', 'MATH 247'),
          course('PHYS340', 'PHYS 340'),
        ],
      ],
      {
        grammar: 'exact_semicolon_and_slash_pair_and_final_or_corequisite',
        statement_raw:
          'Corequisites: PHYS 202/202L; MATH 247; ENGR 210 or\nPHYS 340.',
      },
    )],
    markerExpectation: { required: 0, corequisite: 1 },
  }),
  [`${CNU.slug}:MATH128`]: identity({
    ...CNU, code: 'MATH128', scopeRole: 'recursive_closure',
    sourceId: 'cnu_pdf', disposition: 'none',
  }),
  [`${JMU.slug}:MATH105`]: identity({
    ...JMU, code: 'MATH105', scopeRole: 'recursive_closure',
    sourceId: 'jmu_math', disposition: 'parsed',
    rawRequisites: `Prerequisites: ${JMU_MATH105_FIELD}`,
    groups: [prerequisiteGroup(JMU_MATH105_FIELD, [[
      condition(
        'has_not_completed_jmu_math220_with_grade_c_minus_or_higher',
        'This course is not open to students who have completed MATH 220 with a grade of C- or higher',
        {
          excluded_if_completed_course_code: 'MATH220',
          excluded_completion_minimum_grade: 'C-',
          negative_eligibility_condition: true,
        },
      ),
      condition(
        'not_majoring_in_mathematics_or_statistics',
        'to majors in mathematics or statistics',
        {
          excluded_majors: ['Mathematics', 'Statistics'],
          negative_eligibility_condition: true,
        },
      ),
    ]], { grammar: 'exact_structured_negative_eligibility_formula' })],
    signals: [
      signal(
        'duplicate_major_enrollment_exclusion_outside_formal_field',
        'Not open to majors in mathematics or statistics.',
        { excluded_majors: ['Mathematics', 'Statistics'] },
      ),
      signal(
        'prior_credit_exclusion_with_department_head_consent_exception',
        'Not open to students who have previously earned credit in courses requiring MATH 105 competency except with consent of the Mathematics and Statistics department head.',
        { consent_authority: 'Mathematics and Statistics department head' },
      ),
    ],
  }),
  [`${JMU.slug}:MATH155`]: identity({
    ...JMU, code: 'MATH155', scopeRole: 'recursive_closure',
    sourceId: 'jmu_math', disposition: 'parsed',
    rawRequisites:
      `${JMU_MATH155_ALEKS} Prerequisites: ${JMU_MATH155_POSITIVE} ${JMU_MATH155_EXCLUSION}`,
    groups: [
      prerequisiteGroup(JMU_MATH155_ALEKS, [[condition(
        'appropriate_aleks_placement_score',
        JMU_MATH155_ALEKS,
        {
          placement_test: 'ALEKS',
          appropriate_score_required: true,
          enrollment_condition: true,
        },
      )]], { grammar: 'exact_unstructured_required_placement_score' }),
      prerequisiteGroup(JMU_MATH155_POSITIVE, [[condition(
        'demonstrated_algebra_proficiency_through_jmu_math_placement_test',
        JMU_MATH155_POSITIVE,
        {
          placement_test: 'JMU Math Placement Test',
          demonstrated_algebra_proficiency_required: true,
          test_required_for_course_placement: true,
        },
      )]], { grammar: 'exact_structured_placement_formula' }),
    ],
    signals: [signal(
      'prior_credit_exclusion',
      JMU_MATH155_EXCLUSION,
      { excluded_course_codes: ['MATH135', 'MATH156', 'MATH205', 'MATH231', 'MATH232', 'MATH235'] },
    )],
  }),
  [`${JMU.slug}:MATH156`]: identity({
    ...JMU, code: 'MATH156', scopeRole: 'recursive_closure',
    sourceId: 'jmu_math', disposition: 'parsed',
    rawRequisites: `Prerequisites: ${JMU_MATH156_POSITIVE} ${JMU_MATH156_EXCLUSION}`,
    groups: [prerequisiteGroup(JMU_MATH156_POSITIVE, [[condition(
      'demonstrated_algebra_proficiency_through_jmu_math_placement_test',
      JMU_MATH156_POSITIVE,
      {
        placement_test: 'JMU Math Placement Test',
        demonstrated_algebra_proficiency_required: true,
      },
    )]], { grammar: 'exact_structured_placement_formula' })],
    signals: [
      signal(
        'extended_instructional_time_description',
        'MATH 156 will meet five times a week for students requiring more instructional time.',
        { incoming_prerequisite_effect: false },
      ),
      signal(
        'prior_credit_exclusion',
        JMU_MATH156_EXCLUSION,
        { excluded_course_codes: ['MATH135', 'MATH155', 'MATH205', 'MATH231', 'MATH232', 'MATH235'] },
      ),
    ],
  }),
  [`${JMU.slug}:MATH236`]: identity({
    ...JMU, code: 'MATH236', scopeRole: 'recursive_closure',
    sourceId: 'jmu_math', disposition: 'parsed',
    rawRequisites: `Prerequisites: ${JMU_MATH236_FORMULA}`,
    groups: [prerequisiteGroup(JMU_MATH236_FORMULA, [
      [course('MATH232', 'MATH 232', {
        minimum_grade: 'C-',
        catalog_grade_scope: 'shared_trailing_grade_phrase_over_three_or_alternatives',
      })],
      [course('MATH234', 'MATH 234', {
        minimum_grade: 'C-',
        catalog_grade_scope: 'shared_trailing_grade_phrase_over_three_or_alternatives',
      })],
      [course('MATH235', 'MATH 235', {
        minimum_grade: 'C-',
        catalog_grade_scope: 'shared_trailing_grade_phrase_over_three_or_alternatives',
      })],
    ], { grammar: 'exact_three_course_or_with_shared_trailing_grade' })],
  }),
});

const TARGET_KEYS = Object.freeze(Object.keys(DECISIONS).sort());

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''));
  return crypto.createHash('sha256').update(bytes).digest('hex');
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

function normalizedText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function keyFor(value = {}) {
  return `${String(value.slug || '')}:${normalizeCode(value.course_code || value.code)}`;
}

function isScopedSmallUniversityPrerequisite(value = {}) {
  const key = keyFor(value);
  const decision = DECISIONS[key];
  if (!decision) return false;
  return (value.school_id == null || value.school_id === decision.school_id)
    && (value.owner_namespace == null
      || value.owner_namespace === decision.owner_namespace)
    && (value.course_key == null || value.course_key === decision.course_key);
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
  if (artifact?.facts_sha256 !== EXPECTED_FACTS_SHA256) issues.push('facts_sha256_pin');
  if (sha256(canonicalJson(artifact?.facts || null)) !== artifact?.facts_sha256) {
    issues.push('facts_sha256_replay');
  }
  const rows = Array.isArray(artifact?.facts?.target_rows)
    ? artifact.facts.target_rows : [];
  if (!same(rows.map((row) => row.target_key).sort(), TARGET_KEYS)) {
    issues.push('target_inventory');
  }
  if (rows.some((row) => (
    row.decision_sha256 !== sha256(canonicalJson(DECISIONS[row.target_key]))
  ))) issues.push('decision_hashes');
  const counts = Object.fromEntries(['parsed', 'none', 'blocked'].map((disposition) => [
    disposition, rows.filter((row) => row.disposition === disposition).length,
  ]));
  if (!same(counts, { parsed: 8, none: 6, blocked: 3 })) {
    issues.push('disposition_counts');
  }
  if (rows.filter((row) => row.scope_role === 'direct_remediation').length !== 10
      || rows.filter((row) => row.scope_role === 'recursive_closure').length !== 7) {
    issues.push('scope_partition');
  }
  if (new Set(rows.map((row) => row.slug)).size !== 6) {
    issues.push('institution_count');
  }
  const blockers = Array.isArray(artifact?.publication_blockers)
    ? artifact.publication_blockers : [];
  if (blockers.length !== 3
      || !same(blockers.map((row) => row.course_key).sort(), rows
        .filter((row) => row.disposition === 'blocked')
        .map((row) => row.course_key).sort())) issues.push('publication_blockers');
  if (artifact?.publication_ready !== false) issues.push('publication_ready');
  return [...new Set(issues)];
}

function evidenceRow(artifact, targetKey) {
  return artifact?.facts?.target_rows?.find((row) => row.target_key === targetKey) || null;
}

function uniqueSpan(text, raw, label) {
  const source = String(text || '');
  const first = source.indexOf(raw);
  if (first < 0 || source.indexOf(raw, first + raw.length) >= 0) {
    return { issue: `${label}_not_unique` };
  }
  return { start: first, end: first + raw.length };
}

function groupSpans(text, sourceGroup, label) {
  if (!sourceGroup.statement_raw) {
    return { raw: uniqueSpan(text, sourceGroup.raw, `${label}_raw`) };
  }
  const statement = uniqueSpan(
    text, sourceGroup.statement_raw, `${label}_statement`,
  );
  if (statement.issue) return { statement, raw: { issue: `${label}_raw_parent_changed` } };
  const innerFirst = sourceGroup.statement_raw.indexOf(sourceGroup.raw);
  if (innerFirst < 0 || sourceGroup.statement_raw.indexOf(
    sourceGroup.raw, innerFirst + sourceGroup.raw.length,
  ) >= 0) {
    return { statement, raw: { issue: `${label}_raw_not_unique_in_statement` } };
  }
  return {
    statement,
    raw: {
      start: statement.start + innerFirst,
      end: statement.start + innerFirst + sourceGroup.raw.length,
    },
  };
}

function projectedSignals(candidate, decision) {
  const text = String(candidate?.source?.raw_entry_text || '');
  const rows = [];
  const issues = [];
  for (const [index, sourceSignal] of decision.signals.entries()) {
    const span = uniqueSpan(text, sourceSignal.raw, `signal_${index}`);
    if (span.issue) {
      issues.push(span.issue);
      continue;
    }
    rows.push({
      ...sourceSignal,
      raw_sha256: sha256(sourceSignal.raw),
      relative_start: span.start,
      relative_end: span.end,
      source_character_start: (candidate.source.character_start || 0) + span.start,
      source_character_end: (candidate.source.character_start || 0) + span.end,
      source_content_preserved: true,
    });
  }
  return { rows, issues };
}

function formulaSpanIssues(candidate, decision) {
  if (decision.disposition !== 'parsed') return [];
  const text = String(candidate?.source?.raw_entry_text || '');
  return decision.groups.flatMap((sourceGroup, index) => {
    const spans = groupSpans(text, sourceGroup, `formula_group_${index}`);
    const issues = spans.raw.issue ? [spans.raw.issue] : [];
    if (spans.statement?.issue) issues.push(spans.statement.issue);
    return issues;
  });
}

function expectedGroups(decision, candidate) {
  const text = String(candidate?.source?.raw_entry_text || '');
  return decision.groups.map((sourceGroup, groupIndex) => {
    const groupId = `${decision.course_key}:${sourceGroup.kind}:${groupIndex}`;
    const projected = {
      id: groupId,
      kind: sourceGroup.kind,
      raw: sourceGroup.raw,
      flags: [
        'strict_full_text_accounting',
        `source:${decision.slug}`,
        'six_university_exact_retained_source_formula',
        sourceGroup.grammar,
      ],
      formula: FORMULA,
      paths: sourceGroup.paths.map((conditions, pathIndex) => ({
        id: `${groupId}:path:${pathIndex}`,
        raw: sourceGroup.raw,
        all_of: conditions.map((token) => token.type === 'course' ? {
          ...token,
          course_key: `${decision.owner_namespace}:${token.code}`,
        } : { ...token }),
      })),
    };
    if (sourceGroup.statement_raw) {
      const spans = groupSpans(text, sourceGroup, `formula_group_${groupIndex}`);
      const rawSpan = spans.raw;
      const statementSpan = spans.statement;
      projected.source_receipt = {
        statement_relative_start: statementSpan.start,
        statement_relative_end: statementSpan.end,
        statement_sha256: sha256(sourceGroup.statement_raw),
        raw_relative_start: rawSpan.start,
        raw_relative_end: rawSpan.end,
        raw_sha256: sha256(sourceGroup.raw),
      };
    }
    return projected;
  });
}

function exactRequisiteMarkerCounts(text) {
  const source = String(text || '');
  return {
    required: (source.match(
      /\b(?:required\s+)?pre-?requisite(?:s|\(s\)|s\(s\))?\s*:/gi,
    ) || []).length,
    corequisite: (source.match(
      /\b(?:pre-?\s+or\s+corequisite|co-?requisite|corequisite)(?:s|\(s\))?\s*:/gi,
    ) || []).length,
  };
}

function candidateIssues(candidate, artifact = loadEvidenceArtifact()) {
  if (!isScopedSmallUniversityPrerequisite(candidate)) return ['not_scoped'];
  const targetKey = keyFor(candidate);
  const decision = DECISIONS[targetKey];
  const receipt = evidenceRow(artifact, targetKey);
  const source = candidate.source || {};
  const issues = [...artifactIssues(artifact)];
  const requireExact = (conditionValue, issue) => {
    if (!conditionValue) issues.push(issue);
  };
  requireExact(candidate.school_id === decision.school_id, 'school_id');
  requireExact(candidate.owner_namespace === decision.owner_namespace, 'owner_namespace');
  requireExact(candidate.course_key === decision.course_key, 'course_key');
  requireExact(receipt?.school_id === decision.school_id
    && receipt?.slug === decision.slug
    && receipt?.owner_namespace === decision.owner_namespace
    && receipt?.course_code === decision.course_code
    && receipt?.course_key === decision.course_key,
  'artifact_identity');
  requireExact(receipt?.catalog_year === decision.catalog_year, 'catalog_year');
  requireExact(receipt?.source_id === decision.source_id, 'source_id');
  requireExact(receipt?.disposition === decision.disposition, 'disposition');
  requireExact(receipt?.decision_sha256 === sha256(canonicalJson(decision)),
    'decision_sha256');
  requireExact(typeof source.raw_entry_text === 'string'
    && sha256(source.raw_entry_text) === source.raw_entry_sha256,
  'candidate_raw_entry_sha256');
  requireExact(receipt?.accepted_candidate_raw_entry_sha256?.includes(
    source.raw_entry_sha256,
  ), 'accepted_candidate_raw_entry');
  requireExact(sha256(normalizedText(source.raw_entry_text))
    === receipt?.normalized_entry_sha256,
  'normalized_current_entry');
  requireExact(same(
    exactRequisiteMarkerCounts(source.raw_entry_text),
    receipt?.target_requisite_marker_counts,
  ), 'target_requisite_marker_counts');
  if (decision.marker_expectation) {
    requireExact(same(
      receipt?.target_requisite_marker_counts,
      decision.marker_expectation,
    ), 'corequisite_marker_expectation');
  }
  requireExact(source.official_url === receipt?.official_url, 'official_url');
  if (source.catalog_year_verified != null) {
    requireExact(source.catalog_year_verified === decision.catalog_year,
      'candidate_catalog_year');
  }
  if (source.source_response_sha256 != null) {
    requireExact(source.source_response_sha256 === receipt?.source_response_sha256,
      'candidate_source_response_sha256');
  }
  if (source.boundary_contract != null) {
    requireExact(source.boundary_contract === receipt?.boundary_contract,
      'candidate_boundary_contract');
  }
  issues.push(...projectedSignals(candidate, decision).issues);
  issues.push(...formulaSpanIssues(candidate, decision));
  return [...new Set(issues)];
}

function proofFor(candidate, artifact, decision) {
  const receipt = evidenceRow(artifact, keyFor(candidate));
  const signals = projectedSignals(candidate, decision).rows;
  return {
    kind: decision.disposition === 'none'
      ? 'official_complete_entry_source_accounted_prerequisite_silence'
      : 'official_complete_entry_exact_requisite_formula',
    contract: CONTRACT,
    receipt_contract: CONTRACT,
    catalog_year: decision.catalog_year,
    owner_namespace: decision.owner_namespace,
    course_key: decision.course_key,
    source_id: decision.source_id,
    source_url: receipt.official_url,
    source_cache_path: receipt.cache_path,
    source_response_sha256: receipt.source_response_sha256,
    source_response_bytes: receipt.source_response_bytes,
    boundary_contract: receipt.boundary_contract,
    raw_entry_sha256: receipt.current_raw_entry_sha256,
    raw_entry_html_sha256: receipt.raw_entry_html_sha256,
    normalized_entry_sha256: receipt.normalized_entry_sha256,
    published_units: receipt.published_units,
    marker_control: receipt.marker_control,
    target_requisite_marker_counts: receipt.target_requisite_marker_counts,
    source_upgrade_from_retained_projection: receipt.source_upgrade_needed,
    preserved_non_prerequisite_signal_count: signals.length,
    content_accounting: {
      full_entry_sha256: receipt.current_raw_entry_sha256,
      full_current_entry_replayed_from_retained_official_bytes: true,
      every_reviewed_constraint_signal_span_preserved: true,
      every_formula_group_span_exact: decision.disposition === 'parsed',
      every_requisite_marker_classified: true,
      source_content_discarded: false,
    },
    inference_boundary: decision.disposition === 'none'
      ? 'Status none means only that this exact complete, present, edition-bound entry contributes no incoming prerequisite formula after every reviewed constraint-like phrase is span-accounted. It is never inferred from a missing result, a corequisite-only field, or unresolved advisory language.'
      : 'Only exact named enrollment, prerequisite, or corequisite statements become OR-of-AND conditions. The complete-entry marker count proves that no separate formal prerequisite marker was discarded; credit exclusions and other non-prerequisite signals remain exact-span evidence.',
  };
}

function blockerEvidence(candidate, artifact, decision) {
  const receipt = evidenceRow(artifact, keyFor(candidate));
  const signals = projectedSignals(candidate, decision).rows;
  return {
    contract: CONTRACT,
    disposition: 'blocked_exact_source_ambiguity',
    catalog_year: decision.catalog_year,
    owner_namespace: decision.owner_namespace,
    course_key: decision.course_key,
    source_url: receipt.official_url,
    source_cache_path: receipt.cache_path,
    source_response_sha256: receipt.source_response_sha256,
    raw_entry_sha256: receipt.current_raw_entry_sha256,
    boundary_contract: receipt.boundary_contract,
    preserved_signals: signals,
    prerequisite_formula_inferred: false,
    structural_none_inferred: false,
    source_content_discarded: false,
    blocker_reason: decision.blocker,
    authority_needed:
      'The institution catalog owner or registrar must publish or confirm the exact prerequisite/corequisite/placement meaning before this row can enter the publication graph.',
  };
}

function resolveSmallUniversityPrerequisite(
  candidate,
  artifact = loadEvidenceArtifact(),
) {
  if (!isScopedSmallUniversityPrerequisite(candidate)) {
    return { applicable: false, ready: false, blocked: false, issues: [] };
  }
  const decision = DECISIONS[keyFor(candidate)];
  const issues = candidateIssues(candidate, artifact);
  if (issues.length) return {
    applicable: true,
    ready: false,
    blocked: decision.disposition === 'blocked',
    issues,
    review_reason: 'six_university_exact_source_receipt_changed',
  };
  if (decision.disposition === 'blocked') return {
    applicable: true,
    ready: false,
    blocked: true,
    issues: [],
    review_reason: BLOCKED_REVIEW_REASON,
    preserved_signals: projectedSignals(candidate, decision).rows,
    blocker_evidence: blockerEvidence(candidate, artifact, decision),
  };
  return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: decision.disposition,
    raw_requisites: decision.raw_requisites,
    groups: expectedGroups(decision, candidate),
    review_status: decision.disposition === 'none'
      ? 'promoted_structural_none' : 'promoted_strict_formula',
    review_reason: REVIEW_REASON,
    ignored_nonrequired_requisites: projectedSignals(candidate, decision).rows,
    proof: proofFor(candidate, artifact, decision),
  };
}

function replayCandidateFromReviewRow(row) {
  const evidence = row?.review_evidence || {};
  return {
    school_id: row?.school_id,
    slug: row?.slug,
    owner_namespace: row?.owner_namespace,
    course_key: row?.course_key,
    course_code: row?.code,
    source: {
      official_url: evidence.official_url,
      catalog_year_verified: evidence.catalog_year_verified,
      source_response_sha256: evidence.source_response_sha256,
      source_response_bytes: evidence.source_response_bytes,
      cache_path: evidence.cache_path,
      boundary_contract: evidence.boundary_contract,
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

function resolutionRowIssues(row, artifact = loadEvidenceArtifact()) {
  if (!isScopedSmallUniversityPrerequisite(row)) return [];
  const decision = DECISIONS[keyFor(row)];
  const resolved = resolveSmallUniversityPrerequisite(
    replayCandidateFromReviewRow(row), artifact,
  );
  const issues = [];
  if (decision.disposition === 'blocked') {
    if (resolved.ready || !resolved.blocked
        || row.status !== 'unparsed'
        || row.review_status !== 'not_promoted'
        || row.review_reason !== BLOCKED_REVIEW_REASON
        || !same(row.groups, [])
        || !same(row.preserved_prerequisite_signals, resolved.preserved_signals)
        || !same(row.prerequisite_constraint_blocker_evidence,
          resolved.blocker_evidence)) issues.push('blocked_review_status');
  } else if (!resolved.ready) issues.push('source_receipt');
  else {
    if (row.status !== resolved.status
        || row.raw_requisites !== resolved.raw_requisites
        || row.review_status !== resolved.review_status
        || row.review_reason !== resolved.review_reason
        || !same(row.groups, resolved.groups)
        || !same(row.ignored_nonrequired_requisites,
          resolved.ignored_nonrequired_requisites)) issues.push('review_projection');
    const proof = decision.disposition === 'none'
      ? row.structural_none_evidence
      : row.small_university_prerequisite_resolution;
    if (!same(proof, resolved.proof)) issues.push('proof');
  }
  return issues;
}

module.exports = {
  ARTIFACT,
  BLOCKED_REVIEW_REASON,
  CNU,
  CONTRACT,
  DECISIONS,
  EVIDENCE_PATH,
  EXPECTED_FACTS_SHA256,
  FORMULA,
  JMU,
  REVIEW_REASON,
  SHEN,
  TARGET_KEYS,
  UMW,
  UVA_WISE,
  WM,
  artifactIssues,
  candidateIssues,
  canonicalJson,
  isScopedSmallUniversityPrerequisite,
  keyFor,
  loadEvidenceArtifact,
  normalizeCode,
  normalizedText,
  projectedSignals,
  replayCandidateFromReviewRow,
  resolutionRowIssues,
  resolveSmallUniversityPrerequisite,
  sha256,
};
