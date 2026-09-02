/**
 * Exact retained-source contract for the Radford and UVA Wise prerequisite
 * rows discovered while closing the university Figure 6 graph.
 *
 * Five formulas are compiler-safe. Nine rows remain fail-closed because a
 * non-course path, pre-or-corequisite timing, ambiguous Boolean list, or
 * exclusion-only entry cannot be turned into a partial course graph.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CATALOG_YEAR,
  RADFORD_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_CLOSURE_COURSE_RECORDS,
  RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT,
  extractRadfordCourseEntry,
  verifyRadfordRetainedEntryDiscovery,
} = require('./radfordAcalogPrerequisiteAcquisition');
const {
  UVA_WISE_BOUNDARY_CONTRACT,
  UVA_WISE_CATALOG_YEAR,
  UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
  UVA_WISE_CLOSURE_COURSE_RECORDS,
  extractUvaWiseCourseEntry,
  verifyUvaWiseRetainedEntryDiscovery,
} = require('./uvaWiseAcalogPrerequisiteAcquisition');

const ARTIFACT = 'va_radford_uva_wise_recursive_prerequisite_evidence';
const CONTRACT = 'va_radford_uva_wise_exact_recursive_prerequisite_replay_v1';
const FORMULA = 'paths_or__conditions_and';
const REVIEW_REASON = 'exact_radford_uva_wise_recursive_prerequisite_formula';
const BLOCKED_REVIEW_REASON =
  'exact_radford_uva_wise_source_semantics_not_compiler_safe';
const CACHE_ROOT = path.resolve(__dirname, '../../.va-catalogs');
const CANDIDATE_PATH = 'research/va-university-prerequisite-candidates.json';
const EVIDENCE_PATH = path.join(
  CACHE_ROOT,
  'research/va-radford-uva-wise-recursive-prerequisite-evidence.json',
);

// Filled only after a complete replay of every retained response.
const EXPECTED_FACTS_SHA256 =
  '3a8f43f03b32a06e5d0cea44c2068aa798ef8cb8ea57d8335387ca2f4a213377';

const sha256 = (value) => crypto.createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || '')))
  .digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

function absoluteCachePath(relative) {
  const resolved = path.resolve(CACHE_ROOT, relative);
  if (!resolved.startsWith(`${CACHE_ROOT}${path.sep}`)) {
    throw new Error(`unsafe cache path: ${relative}`);
  }
  return resolved;
}

const defaultReadFile = (relative) => fs.readFileSync(absoluteCachePath(relative));
const readJson = (readFile, relative) => JSON.parse(readFile(relative).toString('utf8'));

const course = (code, raw, extra = {}) => Object.freeze({
  type: 'course', code, raw, ...extra,
});
const nonCourse = (condition, raw, extra = {}) => Object.freeze({
  type: 'non_course', condition, raw, ...extra,
});

const SAFE = Object.freeze({
  'va:uni:9219:PHYS112': Object.freeze({
    raw: 'PHYS 111 .',
    paths: Object.freeze([[course('PHYS111', 'PHYS 111')]]),
  }),
  'va:uni:9219:PHYS221': Object.freeze({
    raw: 'MATH 169 or MATH 171 .',
    paths: Object.freeze([
      [course('MATH169', 'MATH 169')],
      [course('MATH171', 'MATH 171')],
    ]),
  }),
  'va:uni:9219:PHYS222': Object.freeze({
    raw: 'PHYS 221 .',
    paths: Object.freeze([[course('PHYS221', 'PHYS 221')]]),
  }),
  'va:uni:9226:MTH1110': Object.freeze({
    raw: 'MTH 1010 with a C or better',
    paths: Object.freeze([[course('MTH1010', 'MTH 1010', { minimum_grade: 'C' })]]),
  }),
  'va:uni:9226:MTH1210': Object.freeze({
    raw: 'MTH 1110 with a C or better',
    paths: Object.freeze([[course('MTH1110', 'MTH 1110', { minimum_grade: 'C' })]]),
  }),
});

const BLOCKED = Object.freeze({
  'va:uni:9219:CS101': Object.freeze({
    blockers: Object.freeze(['exclusion_only_entry_requires_explicit_zero_edge_policy']),
    formulas: Object.freeze([]),
    signals: Object.freeze([
      'Students who have credit for CS 120 may not take CS 101.',
      'CS 101 may only be attempted twice.',
    ]),
  }),
  'va:uni:9219:CS109': Object.freeze({
    blockers: Object.freeze(['exclusion_only_entry_requires_explicit_zero_edge_policy']),
    formulas: Object.freeze([]),
    signals: Object.freeze([
      'Students that have earned credit for CS 120 cannot subsequently earn credit for ITEC 109.',
      'Students may not take ITEC 109 and CS 120 concurrently.',
    ]),
  }),
  'va:uni:9219:CS118': Object.freeze({
    blockers: Object.freeze([
      'pre_or_corequisite_timing_not_supported_by_publication_graph',
      'comma_boolean_list_not_source_grouped',
    ]),
    formulas: Object.freeze([Object.freeze({
      kind: 'pre_or_corequisite',
      timing: 'corequisite_or_prerequisite',
      raw: 'MATH 125 , MATH 138 , MATH 168 , MATH 169 or MATH 171 .',
      paths: null,
      formal_course_references: Object.freeze([
        'MATH125', 'MATH138', 'MATH168', 'MATH169', 'MATH171',
      ]),
    })]),
    signals: Object.freeze([
      'Students may not receive credit for both CS 120 and the sequence CS 118:CS 119 .',
      'Students may not attempt to take ITEC 118 more than two times (a “W” will count as an attempt).',
    ]),
  }),
  'va:uni:9219:CS119': Object.freeze({
    blockers: Object.freeze([
      'pre_or_corequisite_timing_not_supported_by_publication_graph',
      'comma_boolean_list_not_source_grouped',
      'whole_row_atomicity_forbids_partial_prerequisite_edges',
    ]),
    formulas: Object.freeze([
      Object.freeze({
        kind: 'prerequisite',
        raw: 'A “C” or better in CS 118 or CS 109 .',
        paths: Object.freeze([
          [course('CS118', 'CS 118', { minimum_grade: 'C' })],
          [course('CS109', 'CS 109', { minimum_grade: 'C' })],
        ]),
      }),
      Object.freeze({
        kind: 'pre_or_corequisite',
        timing: 'corequisite_or_prerequisite',
        raw: 'MATH 125 , MATH 138 , MATH 168 , MATH 169 , or MATH 171 .',
        paths: null,
        formal_course_references: Object.freeze([
          'MATH125', 'MATH138', 'MATH168', 'MATH169', 'MATH171',
        ]),
      }),
    ]),
    signals: Object.freeze([
      'Students may not receive credit for both CS 120 and the sequence CS 118 :CS 119.',
      'Students may not attempt to take ITEC 119 more than two times (a “W” will count as an attempt).',
    ]),
  }),
  'va:uni:9219:MATH125': Object.freeze({
    blockers: Object.freeze(['unbound_high_school_equivalency_condition']),
    formulas: Object.freeze([Object.freeze({
      kind: 'prerequisite',
      raw: 'Two years of high school algebra (or equivalent).',
      paths: Object.freeze([[nonCourse(
        'two_years_high_school_algebra_or_equivalent',
        'Two years of high school algebra (or equivalent)',
        { subject: 'algebra', minimum_high_school_years: 2, equivalent_allowed: true },
      )]]),
    })]),
    signals: Object.freeze([
      'Credit for MATH 125 may not be received after receiving credit for a MATH course numbered higher unless it is required by a degree program.',
    ]),
  }),
  'va:uni:9219:MATH126': Object.freeze({
    blockers: Object.freeze(['unbound_placement_exam_condition']),
    formulas: Object.freeze([Object.freeze({
      kind: 'prerequisite',
      raw: 'Either: 1) a C or better in MATH 125 , or 2) a passing score on a placement exam approved by the Department of Mathematics and Statistics.',
      paths: Object.freeze([
        [course('MATH125', 'MATH 125', { minimum_grade: 'C' })],
        [nonCourse('approved_mathematics_placement_exam_passing_score',
          'a passing score on a placement exam approved by the Department of Mathematics and Statistics', {
            placement_domain: 'mathematics', passing_score_required: true,
            approving_authority: 'Department of Mathematics and Statistics',
            threshold_published: false,
          })],
      ]),
    })]),
    signals: Object.freeze([
      'Students who have received credit for MATH 171 or MATH 151 may not also receive credit for MATH 126.',
    ]),
  }),
  'va:uni:9219:MATH138': Object.freeze({
    blockers: Object.freeze([
      'unbound_placement_exam_condition',
      'unbound_high_school_course_condition',
    ]),
    formulas: Object.freeze([Object.freeze({
      kind: 'prerequisite',
      raw: 'One of the following: 1) a C or better in MATH 125 , 2) a passing score on a placement exam approved by the Department of Mathematics and Statistics, or 3) a C or better in a high school precalculus class.',
      paths: Object.freeze([
        [course('MATH125', 'MATH 125', { minimum_grade: 'C' })],
        [nonCourse('approved_mathematics_placement_exam_passing_score',
          'a passing score on a placement exam approved by the Department of Mathematics and Statistics', {
            placement_domain: 'mathematics', passing_score_required: true,
            approving_authority: 'Department of Mathematics and Statistics',
            threshold_published: false,
          })],
        [nonCourse('high_school_precalculus_minimum_grade_c',
          'a C or better in a high school precalculus class', {
            subject: 'precalculus', level: 'high_school', minimum_grade: 'C',
          })],
      ]),
    })]),
    signals: Object.freeze([]),
  }),
  'va:uni:9219:PHYS111': Object.freeze({
    blockers: Object.freeze(['underspecified_required_high_school_mathematics']),
    formulas: Object.freeze([Object.freeze({
      kind: 'prerequisite', raw: 'High school mathematics.',
      paths: Object.freeze([[nonCourse('high_school_mathematics',
        'High school mathematics', { subject: 'mathematics', level: 'high_school' })]]),
    })]),
    signals: Object.freeze([
      'Students may not receive credit for both PHYS 111:PHYS 112 and PHYS 221 :PHYS 222 .',
    ]),
  }),
  'va:uni:9226:MTH1010': Object.freeze({
    blockers: Object.freeze(['exclusion_only_entry_requires_explicit_zero_edge_policy']),
    formulas: Object.freeze([]),
    signals: Object.freeze([
      '(No credit is given for this course if a student has satisfactorily completed MTH 1110 or above).',
    ]),
  }),
});

const SIGNALS_FOR_SAFE = Object.freeze({
  'va:uni:9219:PHYS112': Object.freeze([
    'Students may not receive credit for both PHYS 111 :112 and PHYS 221 :PHYS 222 .',
  ]),
  'va:uni:9219:PHYS221': Object.freeze([
    'Students may not receive credit for both PHYS 111 :PHYS 112 and PHYS 221:PHYS 222 .',
  ]),
  'va:uni:9219:PHYS222': Object.freeze([
    'Students may not receive credit for both PHYS 111 :PHYS 112 and PHYS 221 :222.',
  ]),
});

const TARGET_KEYS = Object.freeze([...Object.keys(SAFE), ...Object.keys(BLOCKED)].sort());

function sourceConfig(courseKey) {
  const [, , schoolId, code] = courseKey.split(':');
  const radford = Number(schoolId) === 9219;
  const slug = radford
    ? 'radford-university'
    : 'the-university-of-virginia-s-college-at-wise';
  const record = (radford ? RADFORD_CLOSURE_COURSE_RECORDS : UVA_WISE_CLOSURE_COURSE_RECORDS)[code];
  return {
    school_id: Number(schoolId),
    owner_namespace: `va:uni:${schoolId}`,
    course_code: code,
    slug,
    record,
    catalog_year: radford ? RADFORD_CATALOG_YEAR : UVA_WISE_CATALOG_YEAR,
    boundary_contract: radford ? RADFORD_BOUNDARY_CONTRACT : UVA_WISE_BOUNDARY_CONTRACT,
    extractor: radford ? extractRadfordCourseEntry : extractUvaWiseCourseEntry,
    discoveryVerifier: radford
      ? verifyRadfordRetainedEntryDiscovery : verifyUvaWiseRetainedEntryDiscovery,
  };
}

function exactSpan(text, raw, label) {
  const start = String(text).indexOf(raw);
  if (start < 0 || String(text).indexOf(raw, start + raw.length) >= 0) {
    throw new Error(`${label}:exact_unique_span`);
  }
  return {
    raw,
    raw_sha256: sha256(raw),
    relative_start: start,
    relative_end: start + raw.length,
    source_content_preserved: true,
  };
}

function candidateMap(readFile) {
  const artifact = readJson(readFile, CANDIDATE_PATH);
  if (artifact?.artifact !== 'virginia_figure6_university_prerequisite_entry_candidates') {
    throw new Error('candidate_artifact');
  }
  return new Map(asArray(artifact.candidates).map((row) => [row.course_key, row]));
}

function sourceProjection(candidate) {
  const source = candidate.source || {};
  return {
    official_url: source.official_url,
    cache_path: source.cache_path,
    source_response_sha256: source.source_response_sha256,
    source_response_bytes: source.source_response_bytes,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    raw_entry_text: source.raw_entry_text,
    boundary_contract: source.boundary_contract,
    catalog_year_verified: source.catalog_year_verified,
    source_format: source.source_format,
    catoid: source.catoid,
    coid: source.coid,
    published_units: source.published_units,
    required_requisite_clause: source.required_requisite_clause || null,
    pre_or_corequisite_clause: source.pre_or_corequisite_clause || null,
    formal_requisite_marker_count: source.formal_requisite_marker_count,
    discovery_contract: source.discovery_contract,
    discovery_cache_path: source.discovery_cache_path,
    discovery_response_sha256: source.discovery_response_sha256,
    discovery_link_receipt: source.discovery_link_receipt,
  };
}

function verifyAndBuildRow(courseKey, candidate, readFile) {
  const config = sourceConfig(courseKey);
  if (!config.record || candidate?.course_key !== courseKey
      || candidate.school_id !== config.school_id
      || candidate.owner_namespace !== config.owner_namespace
      || candidate.slug !== config.slug
      || candidate.course_code !== config.course_code
      || candidate.row_status !== 'candidate_review_required'
      || candidate.formula_status !== 'unparsed_review_required') {
    throw new Error(`${courseKey}:candidate_identity`);
  }
  const source = sourceProjection(candidate);
  const bytes = readFile(source.cache_path);
  const metadata = readJson(readFile, source.cache_path.replace(/\.html$/, '.json'));
  if (bytes.length !== source.source_response_bytes
      || sha256(bytes) !== source.source_response_sha256
      || metadata.content_sha256 !== source.source_response_sha256
      || metadata.byte_length !== source.source_response_bytes
      || metadata.final_url !== source.official_url) {
    throw new Error(`${courseKey}:response_receipt`);
  }
  const extraction = config.extractor(bytes.toString('utf8'), config.course_code, {
    finalUrl: metadata.final_url,
  });
  if (!extraction.verified || extraction.entries.length !== 1) {
    throw new Error(`${courseKey}:entry_boundary:${extraction.issues.join(',')}`);
  }
  const entry = extraction.entries[0];
  if (entry.title !== config.record.title || entry.coid !== config.record.coid
      || entry.raw_entry_sha256 !== source.raw_entry_sha256
      || entry.raw_entry_html_sha256 !== source.raw_entry_html_sha256
      || entry.raw_entry_text !== source.raw_entry_text
      || !same(entry.published_units, source.published_units)
      || !same(entry.required_requisite_clause || null, source.required_requisite_clause)
      || !same(entry.pre_or_corequisite_clause || null, source.pre_or_corequisite_clause)) {
    throw new Error(`${courseKey}:candidate_entry_projection`);
  }
  const discoveryBytes = readFile(source.discovery_cache_path);
  if (sha256(discoveryBytes) !== source.discovery_response_sha256) {
    throw new Error(`${courseKey}:discovery_response_sha256`);
  }
  const discovery = config.discoveryVerifier(discoveryBytes.toString('utf8'), config.course_code);
  if (!discovery.verified || discovery.links.length !== 1
      || !same(discovery.links[0], source.discovery_link_receipt)) {
    throw new Error(`${courseKey}:discovery_receipt:${discovery.issues.join(',')}`);
  }

  const safe = SAFE[courseKey];
  const blocked = BLOCKED[courseKey];
  const formalClauses = [entry.required_requisite_clause, entry.pre_or_corequisite_clause]
    .filter(Boolean);
  const expectedFormulas = safe ? [{ kind: 'prerequisite', raw: safe.raw, paths: safe.paths }]
    : blocked.formulas;
  if (formalClauses.length !== expectedFormulas.length
      || formalClauses.some((clause, index) => (
        clause.kind !== expectedFormulas[index].kind
          || clause.raw !== expectedFormulas[index].raw
          || clause.raw_sha256 !== sha256(clause.raw)
          || clause.receipt_contract !== (
            config.school_id === 9219
              ? (clause.kind === 'pre_or_corequisite'
                ? RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT
                : RADFORD_CLAUSE_RECEIPT_CONTRACT)
              : UVA_WISE_CLAUSE_RECEIPT_CONTRACT
          )
      ))) throw new Error(`${courseKey}:formal_clause_inventory`);

  const signalTexts = safe ? asArray(SIGNALS_FOR_SAFE[courseKey]) : blocked.signals;
  const preservedSignals = signalTexts.map((raw, index) => ({
    kind: /may not|no credit|cannot subsequently|credit for/i.test(raw)
      ? 'credit_or_enrollment_exclusion' : 'retained_constraint_signal',
    ...exactSpan(entry.raw_entry_text, raw, `${courseKey}:signal:${index}`),
    figure6_course_edge_effect: false,
  }));
  const sourceFormulas = expectedFormulas.map((formula, index) => ({
    ...formula,
    ...(formula.paths ? {
      paths: formula.paths.map((conditions) => conditions.map((condition) => ({
        ...condition,
        ...(condition.type === 'course' ? {
          course_key: `${config.owner_namespace}:${condition.code}`,
        } : {}),
      }))),
    } : {}),
    source_clause_receipt: formalClauses[index],
    source_content_preserved: true,
  }));
  const referencedCourseKeys = [...new Set(sourceFormulas.flatMap((formula) => (
    formula.paths
      ? formula.paths.flatMap((formulaPath) => formulaPath
        .filter((condition) => condition.type === 'course')
        .map((condition) => condition.course_key))
      : asArray(formula.formal_course_references)
        .map((code) => `${config.owner_namespace}:${code}`)
  )))].sort();
  return {
    course_key: courseKey,
    school_id: config.school_id,
    slug: config.slug,
    owner_namespace: config.owner_namespace,
    course_code: config.course_code,
    scope_role: 'recursive_closure',
    disposition: safe ? 'safe_exact_formula' : 'blocked_exact_source_semantics',
    publication_status_recommendation: safe ? 'parsed' : 'unparsed',
    runtime_ready: Boolean(safe),
    raw_requisites: formalClauses.map((clause) => `${clause.label}: ${clause.raw}`).join(' ') || null,
    source_formulas: sourceFormulas,
    referenced_course_keys: referencedCourseKeys,
    preserved_signals: preservedSignals,
    runtime_blockers: blocked ? [...blocked.blockers] : [],
    source,
    content_accounting: {
      exact_complete_present_entry: true,
      every_formal_requisite_clause_preserved: true,
      every_identified_constraint_signal_span_preserved: true,
      partial_course_edges_emitted: false,
      source_content_discarded: false,
    },
  };
}

function buildEvidence({ readFile = defaultReadFile } = {}) {
  const candidates = candidateMap(readFile);
  const rows = TARGET_KEYS.map((key) => verifyAndBuildRow(key, candidates.get(key), readFile));
  const allReferences = [...new Set(rows.flatMap((row) => row.referenced_course_keys))].sort();
  const referenceInventory = allReferences.map((courseKey) => ({
    course_key: courseKey,
    exact_candidate_present: candidates.has(courseKey),
  }));
  if (referenceInventory.some((row) => !row.exact_candidate_present)) {
    throw new Error('formal_reference_without_exact_candidate');
  }
  const facts = {
    policy: {
      promote_only_complete_compiler_safe_formula: true,
      pre_or_corequisite_timing_retained: true,
      non_course_paths_retained: true,
      exclusions_retained: true,
      partial_course_edges_for_blocked_rows: false,
      missing_result_inference_allowed: false,
    },
    target_rows: rows,
    formal_reference_inventory: referenceInventory,
  };
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    contract: CONTRACT,
    snapshot_date: '2026-08-25',
    publication_ready: false,
    publication_blockers: [
      'nine_exact_rows_require_noncourse_timing_boolean_or_exclusion_policy',
      'human_publication_verification_not_requested',
    ],
    summary: {
      captured_exact_entry_rows: rows.length,
      safe_exact_formula_rows: rows.filter((row) => row.runtime_ready).length,
      blocked_exact_source_rows: rows.filter((row) => !row.runtime_ready).length,
      promoted_prerequisite_groups: rows.filter((row) => row.runtime_ready).length,
      blocked_partial_edge_rows: rows.filter((row) => (
        !row.runtime_ready && row.referenced_course_keys.length
      )).length,
      exact_formal_reference_keys: referenceInventory.length,
      unresolved_formal_reference_keys: referenceInventory.filter((row) => (
        !row.exact_candidate_present
      )).length,
    },
    facts_sha256: sha256(canonicalJson(facts)),
    facts,
  };
}

function evidenceIssues(artifact) {
  const issues = [];
  if (artifact?.schema_version !== 1) issues.push('schema_version');
  if (artifact?.artifact !== ARTIFACT) issues.push('artifact');
  if (artifact?.contract !== CONTRACT) issues.push('contract');
  if (artifact?.publication_ready !== false) issues.push('publication_ready');
  if (artifact?.facts_sha256 !== EXPECTED_FACTS_SHA256) issues.push('facts_sha256_pin');
  if (sha256(canonicalJson(artifact?.facts || null)) !== artifact?.facts_sha256) {
    issues.push('facts_sha256_replay');
  }
  const rows = asArray(artifact?.facts?.target_rows);
  if (!same(rows.map((row) => row.course_key).sort(), TARGET_KEYS)) issues.push('target_inventory');
  if (rows.filter((row) => row.runtime_ready).length !== 5
      || rows.filter((row) => !row.runtime_ready).length !== 9) issues.push('partition');
  if (rows.some((row) => row.content_accounting?.source_content_discarded !== false
      || row.content_accounting?.partial_course_edges_emitted !== false
      || row.content_accounting?.every_formal_requisite_clause_preserved !== true)) {
    issues.push('content_accounting');
  }
  if (rows.filter((row) => !row.runtime_ready).some((row) => (
    row.publication_status_recommendation !== 'unparsed'
      || !row.runtime_blockers.length
  ))) issues.push('blocked_rows');
  if (asArray(artifact?.facts?.formal_reference_inventory).some((row) => (
    row.exact_candidate_present !== true
  ))) issues.push('reference_inventory');
  return [...new Set(issues)].sort();
}

function loadEvidenceArtifact() {
  const artifact = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  const issues = evidenceIssues(artifact);
  if (issues.length) throw new Error(`Radford/UVA Wise evidence invalid: ${issues.join(', ')}`);
  return artifact;
}

function evidenceRow(artifact, courseKey) {
  return asArray(artifact?.facts?.target_rows).find((row) => row.course_key === courseKey);
}

function isScopedRadfordUvaWiseRecursive(candidate) {
  return TARGET_KEYS.includes(candidate?.course_key);
}

function candidateIssues(candidate, artifact = loadEvidenceArtifact()) {
  if (!isScopedRadfordUvaWiseRecursive(candidate)) return ['not_scoped'];
  const row = evidenceRow(artifact, candidate.course_key);
  const source = sourceProjection(candidate);
  const issues = [...evidenceIssues(artifact)];
  if (candidate.school_id !== row?.school_id || candidate.slug !== row?.slug
      || candidate.owner_namespace !== row?.owner_namespace
      || candidate.course_code !== row?.course_code) issues.push('identity');
  if (!same(source, row?.source)) issues.push('source_receipt');
  return [...new Set(issues)];
}

function productionGroups(row) {
  return row.source_formulas.map((sourceFormula, groupIndex) => ({
    id: `${row.course_key}:${sourceFormula.kind}:${groupIndex}`,
    kind: sourceFormula.kind,
    raw: sourceFormula.raw,
    flags: [
      'strict_full_text_accounting',
      'exact_retained_official_source_formula',
      CONTRACT,
    ],
    formula: FORMULA,
    paths: sourceFormula.paths.map((conditions, pathIndex) => ({
      id: `${row.course_key}:${sourceFormula.kind}:${groupIndex}:path:${pathIndex}`,
      raw: sourceFormula.raw,
      all_of: conditions,
    })),
  }));
}

function proof(row) {
  return {
    kind: 'exact_retained_acalog_recursive_prerequisite_formula',
    contract: CONTRACT,
    course_key: row.course_key,
    source_url: row.source.official_url,
    source_cache_path: row.source.cache_path,
    source_response_sha256: row.source.source_response_sha256,
    source_response_bytes: row.source.source_response_bytes,
    boundary_contract: row.source.boundary_contract,
    raw_entry_sha256: row.source.raw_entry_sha256,
    raw_entry_html_sha256: row.source.raw_entry_html_sha256,
    required_requisite_clause: row.source.required_requisite_clause,
    pre_or_corequisite_clause: row.source.pre_or_corequisite_clause,
    preserved_signals: row.preserved_signals,
    content_accounting: row.content_accounting,
  };
}

function blockerEvidence(row) {
  return {
    ...proof(row),
    kind: 'exact_retained_acalog_semantic_blocker',
    source_formulas: row.source_formulas,
    runtime_blockers: row.runtime_blockers,
    prerequisite_formula_inferred: false,
    structural_none_inferred: false,
    partial_course_edges_emitted: false,
  };
}

function resolveRadfordUvaWiseRecursive(candidate, artifact = loadEvidenceArtifact()) {
  if (!isScopedRadfordUvaWiseRecursive(candidate)) {
    return { applicable: false, ready: false, blocked: false, issues: [] };
  }
  const row = evidenceRow(artifact, candidate.course_key);
  const issues = candidateIssues(candidate, artifact);
  if (issues.length) return {
    applicable: true, ready: false, blocked: !row.runtime_ready, issues,
    review_reason: 'radford_uva_wise_exact_source_receipt_changed',
  };
  if (!row.runtime_ready) return {
    applicable: true,
    ready: false,
    blocked: true,
    issues: [],
    review_reason: BLOCKED_REVIEW_REASON,
    raw_requisites: row.raw_requisites,
    preserved_source_formulas: row.source_formulas,
    preserved_signals: row.preserved_signals,
    blocker_evidence: blockerEvidence(row),
  };
  const ignoredSignals = row.preserved_signals.map((signal) => ({
    ...signal,
    source_character_start: candidate.source.character_start + signal.relative_start,
    source_character_end: candidate.source.character_start + signal.relative_end,
  }));
  return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: 'parsed',
    raw_requisites: row.source_formulas[0].raw,
    groups: productionGroups(row),
    review_status: 'promoted_strict_formula',
    review_reason: REVIEW_REASON,
    ignored_nonrequired_requisites: ignoredSignals,
    proof: proof(row),
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
      cache_path: evidence.cache_path,
      source_response_sha256: evidence.source_response_sha256,
      source_response_bytes: evidence.source_response_bytes,
      raw_entry_sha256: evidence.raw_entry_sha256,
      raw_entry_html_sha256: evidence.raw_entry_html_sha256,
      raw_entry_text: evidence.raw_entry_text,
      boundary_contract: evidence.boundary_contract,
      catalog_year_verified: evidence.catalog_year_verified,
      source_format: evidence.source_format,
      catoid: evidence.catoid,
      coid: evidence.coid,
      published_units: evidence.published_units,
      required_requisite_clause: evidence.required_requisite_clause || null,
      pre_or_corequisite_clause: evidence.pre_or_corequisite_clause || null,
      formal_requisite_marker_count: evidence.formal_requisite_marker_count,
      discovery_contract: evidence.discovery_contract,
      discovery_cache_path: evidence.discovery_cache_path,
      discovery_response_sha256: evidence.discovery_response_sha256,
      discovery_link_receipt: evidence.discovery_link_receipt,
      character_start: evidence.entry_character_start,
    },
  };
}

function resolutionRowIssues(row, artifact = loadEvidenceArtifact()) {
  if (!isScopedRadfordUvaWiseRecursive(row)) return [];
  const expected = evidenceRow(artifact, row.course_key);
  const resolved = resolveRadfordUvaWiseRecursive(replayCandidateFromReviewRow(row), artifact);
  const issues = [];
  if (!expected.runtime_ready) {
    if (resolved.ready || !resolved.blocked || row.status !== 'unparsed'
        || row.review_status !== 'not_promoted'
        || row.review_reason !== BLOCKED_REVIEW_REASON
        || !same(row.groups, [])
        || row.raw_requisites !== resolved.raw_requisites
        || !same(row.preserved_source_formulas, resolved.preserved_source_formulas)
        || !same(row.preserved_prerequisite_signals, resolved.preserved_signals)
        || !same(row.prerequisite_constraint_blocker_evidence,
          resolved.blocker_evidence)) issues.push('blocked_projection');
  } else if (!resolved.ready) issues.push('source_receipt');
  else if (row.status !== 'parsed' || row.review_status !== 'promoted_strict_formula'
      || row.review_reason !== REVIEW_REASON || row.raw_requisites !== resolved.raw_requisites
      || !same(row.groups, resolved.groups)
      || !same(row.ignored_nonrequired_requisites,
        resolved.ignored_nonrequired_requisites)
      || !same(row.radford_uva_wise_recursive_prerequisite_resolution,
        resolved.proof)) issues.push('safe_projection');
  return issues;
}

module.exports = {
  ARTIFACT,
  BLOCKED,
  BLOCKED_REVIEW_REASON,
  CACHE_ROOT,
  CONTRACT,
  EVIDENCE_PATH,
  EXPECTED_FACTS_SHA256,
  FORMULA,
  REVIEW_REASON,
  SAFE,
  TARGET_KEYS,
  buildEvidence,
  candidateIssues,
  canonicalJson,
  defaultReadFile,
  evidenceIssues,
  isScopedRadfordUvaWiseRecursive,
  loadEvidenceArtifact,
  replayCandidateFromReviewRow,
  resolutionRowIssues,
  resolveRadfordUvaWiseRecursive,
  sha256,
};
