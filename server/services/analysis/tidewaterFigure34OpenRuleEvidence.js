/**
 * Fail-closed audit of Tidewater's remaining Figure 3/4 source questions.
 *
 * This intentionally does not turn nearby/cross-program evidence into a
 * curriculum decision. It proves the exact current blocker inventory, records
 * the bounded ASL counterexample to an exhaustive 13-course language menu,
 * and emits the institutional questions needed to close the row.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const SERVER = path.resolve(__dirname, '../..');
const DEGREE_PATH = path.join(
  SERVER, '.va-catalogs/composed/tidewater-community-college.json',
);
const EVIDENCE_PATH = path.join(
  SERVER, '.va-catalogs/research/tidewater-figure34-open-rule-evidence.json',
);

const EXPECTED_CONSTRAINTS = Object.freeze([
  Object.freeze({
    path: 'requirement_groups[2].analysis_constraints[0]',
    kind: 'direct_placement_with_category_replacement',
  }),
  Object.freeze({
    path: 'requirement_groups[10].analysis_constraints[0]',
    kind: 'footnote_8_source_language_ambiguity',
  }),
  Object.freeze({
    path: 'requirement_groups[10].analysis_constraints[1]',
    kind: 'world_language_category_open',
  }),
  Object.freeze({
    path: 'requirement_groups[11].analysis_constraints[1]',
    kind: 'world_language_category_open',
  }),
]);
const EXPECTED_FLAGS = Object.freeze([
  'catalog_footnote_8_ambiguous',
  'direct_placement_receiver_not_supported',
]);
const REQUIRED_QUESTION_IDS = Object.freeze([
  'footnote_8_boolean',
  'world_language_roster',
  'direct_placement_cardinality',
  'published_total_reconciliation',
  'reproducible_source_copy',
]);

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = (values) => [...new Set((values || []).map(String))].sort();

function factsSha256(evidence) {
  const { facts_sha256: ignored, ...facts } = evidence || {};
  return sha256(JSON.stringify(stable(facts)));
}

function constraintAt(degree, locator) {
  const match = /^requirement_groups\[(\d+)]\.analysis_constraints\[(\d+)]$/.exec(locator);
  if (!match) return null;
  return degree?.requirement_groups?.[Number(match[1])]
    ?.analysis_constraints?.[Number(match[2])] || null;
}

function auditTidewaterFigure34OpenRuleEvidence(degree, evidence) {
  const issues = [];
  const identity = evidence?.catalog_identity || {};
  const version = degree?.catalog_version || {};
  if (degree?.slug !== 'tidewater-community-college'
      || degree?.program !== identity.program
      || degree?.award !== 'AS'
      || degree?.catalog_year !== identity.catalog_year
      || version.catalog_id !== identity.catalog_id
      || version.program_id !== identity.program_id
      || String(version.program_code) !== String(identity.program_code)
      || degree?.total_units !== identity.published_units_minimum
      || degree?.total_units_max !== identity.published_units_maximum) {
    issues.push('catalog_identity_changed');
  }

  const sourceById = new Map((degree?.research_sources || []).map((source) => [source.id, source]));
  for (const observation of evidence?.source_observations?.transparent_render || []) {
    const source = sourceById.get(observation.id);
    if (!source
        || source.url !== observation.official_origin_url
        || source.retrieval_url !== observation.retrieval_url
        || source.sha256 !== observation.composition_declared_sha256) {
      issues.push(`source_receipt_changed:${observation.id}`);
    }
    if (!/^[a-f0-9]{64}$/.test(observation.current_response_sha256_observed_2026_08_25)
        || observation.current_response_bytes_retained !== false) {
      issues.push(`transparent_render_boundary_changed:${observation.id}`);
    }
  }
  if (sourceById.size !== 4
      || evidence?.source_observations?.direct_origin?.status !== 'blocked_cloudflare_403'
      || evidence?.source_observations?.direct_origin
        ?.reproducible_current_official_bytes_retained !== false) {
    issues.push('official_capture_boundary_changed');
  }

  const observedConstraints = EXPECTED_CONSTRAINTS.map(({ path: locator }) => ({
    path: locator,
    kind: constraintAt(degree, locator)?.kind || null,
    status: constraintAt(degree, locator)?.status || null,
  }));
  for (const expected of EXPECTED_CONSTRAINTS) {
    const actual = constraintAt(degree, expected.path);
    if (actual?.kind !== expected.kind || actual?.status !== 'evaluator_not_implemented') {
      issues.push(`active_constraint_changed:${expected.path}`);
    }
  }
  if (!jsonEqual(
    (evidence?.active_blockers || []).map(({ path: locator, kind }) => ({ path: locator, kind })),
    EXPECTED_CONSTRAINTS,
  )) issues.push('evidence_blocker_inventory_changed');

  const blockingFlags = sorted((degree?.data_quality_flags || [])
    .filter((flag) => flag.severity === 'block_analysis')
    .map((flag) => flag.code));
  if (!jsonEqual(blockingFlags, sorted(EXPECTED_FLAGS))
      || !jsonEqual(sorted(evidence?.blocking_quality_flags), sorted(EXPECTED_FLAGS))) {
    issues.push('blocking_quality_flags_changed');
  }

  const modeled = degree?.option_sets?.world_language?.courses || [];
  const recordedModeled = evidence?.modeled_world_language_inventory?.codes || [];
  const aslCandidates = evidence?.modeled_world_language_inventory
    ?.current_approved_transfer_page_additional_asl_candidates || [];
  const missingAsl = sorted(aslCandidates.filter((course) => !modeled.includes(course)));
  if (!jsonEqual(modeled, recordedModeled)
      || modeled.length !== 13
      || evidence?.modeled_world_language_inventory?.count !== modeled.length) {
    issues.push('modeled_world_language_inventory_changed');
  }
  if (!jsonEqual(missingAsl, sorted(['ASL101', 'ASL102', 'ASL201', 'ASL202']))
      || evidence?.modeled_world_language_inventory?.candidate_count !== 4
      || evidence?.modeled_world_language_inventory?.exhaustive_roster_proved !== false
      || evidence?.modeled_world_language_inventory
        ?.safe_to_add_asl_without_program_adjudication !== false) {
    issues.push('asl_scope_boundary_changed');
  }
  const languageConsumers = [
    degree?.option_sets?.technical_slot_a?.world_language_courses || [],
    (degree?.option_sets?.approved_elective?.courses || [])
      .filter((course) => modeled.includes(course)),
  ];
  if (languageConsumers.some((courses) => !jsonEqual(courses, modeled))) {
    issues.push('world_language_consumer_drift');
  }

  const pdf = evidence?.source_observations?.bounded_first_party_pdf || {};
  if (pdf.url !== 'https://www.tcc.edu/wp-content/uploads/2025/10/TCC_Engineering_HANDBOOK25-26_R5.pdf'
      || pdf.relevant_page !== 9
      || pdf.direct_capture_status !== 'blocked_cloudflare_403'
      || pdf.source_bytes_retained !== false
      || !jsonEqual(pdf.observed_taxonomy?.asl_codes, ['ASL101', 'ASL102', 'ASL201', 'ASL202'])
      || !String(pdf.scope_limit || '').includes('does not prove')) {
    issues.push('bounded_pdf_scope_changed');
  }

  const questionIds = (evidence?.institutional_questions || []).map(({ id }) => id);
  if (!jsonEqual(questionIds, REQUIRED_QUESTION_IDS)
      || (evidence?.institutional_questions || []).some(({ question }) => !String(question || '').trim())) {
    issues.push('institutional_questions_changed');
  }
  if (evidence?.verdict?.figure_3_ready !== false
      || evidence?.verdict?.figure_4_ready !== false
      || evidence?.verdict?.safe_public_source_closures !== 0
      || evidence?.verdict?.institutional_adjudication_required !== true
      || evidence?.verdict?.database_writes !== 0
      || evidence?.verdict?.verified_major_core_edits !== 0) {
    issues.push('fail_closed_verdict_changed');
  }
  if (factsSha256(evidence) !== evidence?.facts_sha256) issues.push('facts_sha256_changed');

  return {
    valid: issues.length === 0,
    issues,
    institution: identity.institution || null,
    catalog_year: identity.catalog_year || null,
    source_capture: {
      exact_current_official_bytes_retained: false,
      transparent_render_observations: evidence?.source_observations?.transparent_render?.length || 0,
    },
    active_constraints: observedConstraints,
    blocking_quality_flags: blockingFlags,
    world_language: {
      modeled_count: modeled.length,
      additional_asl_candidates: missingAsl,
      exhaustive_roster_proved: false,
      safe_to_add_asl: false,
    },
    figure_3_ready: false,
    figure_4_ready: false,
    institutional_questions: evidence?.institutional_questions || [],
    database_writes: 0,
    verified_major_core_edits: 0,
  };
}

function loadTidewaterFigure34OpenRuleEvidence() {
  return {
    degree: JSON.parse(fs.readFileSync(DEGREE_PATH, 'utf8')),
    evidence: JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8')),
  };
}

function auditCheckedInTidewaterFigure34OpenRuleEvidence() {
  const { degree, evidence } = loadTidewaterFigure34OpenRuleEvidence();
  return auditTidewaterFigure34OpenRuleEvidence(degree, evidence);
}

module.exports = {
  EVIDENCE_PATH,
  EXPECTED_CONSTRAINTS,
  EXPECTED_FLAGS,
  REQUIRED_QUESTION_IDS,
  auditCheckedInTidewaterFigure34OpenRuleEvidence,
  auditTidewaterFigure34OpenRuleEvidence,
  factsSha256,
  loadTidewaterFigure34OpenRuleEvidence,
};
