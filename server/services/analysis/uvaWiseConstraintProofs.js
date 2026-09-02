/**
 * Exact paper-figure proofs for the 2026-2027 UVA Wise Computer Science B.S.
 *
 * The proof is deliberately bound to the complete selected source tree, all
 * inactive variants, exact accounting declarations, projected course ids, and
 * the seven retained official source receipts.  Open course identities are
 * never manufactured here.  In particular, the source does not close the
 * two-laboratory-science roster, so that rule remains fail-closed.
 */

const { createHash } = require('node:crypto');
const { receivingCourseIdForDocument } = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const UVA_WISE_TRANSFER_POLICY_EVIDENCE = require(
  '../../.va-catalogs/research/uva-wise-vccs-transfer-policy-evidence.json'
);
const UVA_WISE_GE_ROSTER_EVIDENCE = require(
  '../../.va-catalogs/research/uva-wise-ge-roster-evidence.json'
);
const {
  VCCS_SENDER_RECEIPTS,
  uvaWiseTransferPolicyEvidenceIssue,
  uvaWiseVccsSenderTreeFingerprint,
} = require('./uvaWiseTransferPolicyEvidence');
const {
  uvaWiseContextualFigure34CapacityProof,
} = require('./uvaWiseGeRosterEvidence');

const SLUG = 'the-university-of-virginia-s-college-at-wise';
const SCHOOL = "The University of Virginia's College at Wise";
const SCHOOL_ID = 9226;
const SOURCE_DEGREE_ID = `va:degree:${SLUG}:cs`;
const SOURCE_INSTITUTION_ID = `va:uni:${SLUG}`;
const FINAL_DEGREE_ID = `degree:${SCHOOL_ID}:va-cs`;
const FINAL_INSTITUTION_ID = `va:uni:${SCHOOL_ID}`;
const PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2026-2027';
const SOURCE_BUNDLE_SHA256 = 'f8c48454fb9f5b57dee396b0c75721e9ae3d9a20f0031f19a80ba707787e82f3';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: '351dcdfb593b6eb07d8a13d406e1b63bb383ce0f5e132ae7b96b09309348f944',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: 'eeaf89b77c60ab9b29edf6ee9f11fe89bd2ef7bef2b04a9c686196ffabd88a11',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: 'db776266706b6daa53b15bf3808e90d08de667a5845356f81477274b747400e4',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: 'a704b500a0ae3ee95fcec90ee41cdee18094721181d0b0100e25e58f7fac6151',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: '8550e101ff93853ec8ad3e5a4786c6a96ba45c9f002ae7aeb9c8a73926f03f93',
  }),
  Object.freeze({
    id: 'cybersecurity_concentration', role: 'cybersecurity_concentration', kind: 'major',
    sha256: '99b9702837f07e5115ef446204b78c46a48244e663fb97c9f0322dfdffb4672b',
  }),
  Object.freeze({
    id: 'data_science_concentration', role: 'data_science_concentration', kind: 'major',
    sha256: '77fea2a06a50eeb69da3c40096480db9df4096b413e63e29d3a2c4d32a57f515',
  }),
]);

// Filled from uvaWiseProofTreeFingerprint after composition -> accepted source
// -> final numeric projection parity is established. Wrapper ids and derived
// display fields are excluded; all authored rules and variants remain bound.
const PROOF_TREE_SHA256 = 'cf4ba3bdda39ddf7b4f48fdbe64aa50f40fe814fc0db90ca27f4da36b299a2e4';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const REGISTRY_NOTE = 'HTTP-only current Acalog source. Use 2026-2027 catoid 9 and program poid 1199; the former catoid 2 seed is archived.';
const RULE_PATHS = Object.freeze({
  published_first_year_experience_range: 'requirement_groups[6]',
  accelerated_composition_credit_award: 'requirement_groups[7]',
  accelerated_language_core_substitution: 'requirement_groups[8]',
  major_course_substitutes_for_core_area: 'requirement_groups[9]',
});
const SCOPED_RULE_PATHS = Object.freeze({
  prefix_and_level_course_menu: Object.freeze({
    path: 'requirement_groups[1]', figures: Object.freeze(['1', '6']),
  }),
  upper_division_prefix_distribution: Object.freeze({
    path: 'requirement_groups[4]', figures: Object.freeze(['1', '6']),
  }),
  no_double_count_with_core: Object.freeze({
    path: 'requirement_groups[4]', figures: Object.freeze(['1', '6']),
  }),
  contextual_subarea_minimums: Object.freeze({
    path: 'requirement_groups[12]', figures: Object.freeze(['3', '4', '6']),
  }),
  contextual_disciplinary_breadth: Object.freeze({
    path: 'requirement_groups[12]', figures: Object.freeze(['3', '4', '6']),
  }),
  inclusive_excellence_designation: Object.freeze({
    path: 'requirement_groups[12]', figures: Object.freeze(['3', '4', '6']),
  }),
  no_core_cross_area_double_count: Object.freeze({
    path: 'requirement_groups[12]', figures: Object.freeze(['3', '4', '6']),
  }),
});
const CONTEXTUAL_FIGURE_3_4_CAPACITY_RULES = new Set([
  'contextual_subarea_minimums',
  'contextual_disciplinary_breadth',
  'no_core_cross_area_double_count',
]);
const OVERLAP_MARKERS = Object.freeze([
  ['requirement_groups[0].sections[0].receivers[0].overlap_key', 'uvawise-major-mth2040', 'MTH2040', 4],
  ['requirement_groups[0].sections[2].receivers[0].overlap_key', 'uvawise-major-statistics', 'MTH2180', 3],
  ['requirement_groups[0].sections[2].receivers[1].overlap_key', 'uvawise-major-statistics', 'STA2180', 3],
  ['requirement_groups[2].sections[0].receivers[0].overlap_key', 'uvawise-core-scientific-reasoning', 'UVAWISE-CS-LAB-SCIENCE', 8],
  ['requirement_groups[3].sections[0].receivers[0].overlap_key', 'uvawise-core-studies-self', 'SWE1790', 3],
  ['requirement_groups[3].sections[1].receivers[0].overlap_key', 'uvawise-major-csc1010', 'CSC1010', 4],
  ['requirement_groups[3].sections[2].receivers[0].overlap_key', 'uvawise-major-csc1180', 'CSC1180', 4],
  ['requirement_groups[9].sections[0].receivers[0].overlap_key', 'uvawise-major-mth2040', 'MTH2040', 0],
  ['requirement_groups[10].sections[0].receivers[0].overlap_key', 'uvawise-core-scientific-reasoning', 'UVAWISE-CORE-SCIENTIFIC-REASONING', 0],
  ['requirement_groups[11].sections[0].receivers[0].overlap_key', 'uvawise-core-studies-self', 'SWE1790', 0],
]);

const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => value == null ? null : String(value).trim();
const number = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function receiverBody(receiver) {
  return receiver?.receiving && typeof receiver.receiving === 'object'
    ? receiver.receiving : receiver || {};
}

function receiverCodes(receiver) {
  const body = receiverBody(receiver);
  const raw = receiver?.code_seen ?? body.code ?? body.codes ?? [];
  return (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => String(value || '').split(/\s*\+\s*|\s+and\s+/i))
    .map((value) => value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
    .filter(Boolean);
}

function normalizedConstraint(constraint) {
  return {
    kind: text(constraint?.kind),
    status: text(constraint?.status),
    description: text(constraint?.description),
  };
}

function effective(section, group, field) {
  return section?.[field] == null ? group?.[field] ?? null : section[field];
}

function normalizedReceiver(receiver) {
  const body = receiverBody(receiver);
  return {
    kind: text(body.kind)?.toLowerCase() || null,
    codes: receiverCodes(receiver),
    units: number(body.units),
    name: text(body.name),
    conjunction: text(body.conjunction)?.toLowerCase()
      || (body.kind === 'series' ? 'and' : null),
    tier: text(receiver?.tier),
    level: text(receiver?.course_level),
    cc: receiver?.cc_articulable ?? null,
    overlap: text(receiver?.overlap_key),
    note: text(receiver?.note),
    ge_areas: [...array(receiver?.ge_areas)],
    assume: receiver?.assume_satisfiable === true,
  };
}

function normalizedSection(section, group) {
  const units = number(section?.unit_advisement ?? section?.units);
  return {
    ask: number(section?.section_advisement ?? section?.select),
    units,
    max: number(section?.unit_advisement_max ?? section?.units_max ?? units),
    label: text(section?.label_seen ?? section?.label),
    tier: text(effective(section, group, 'tier')),
    level: text(effective(section, group, 'course_level')),
    cc: effective(section, group, 'cc_articulable'),
    refs: array(section?.source_refs).length
      ? [...section.source_refs] : [...array(group?.source_refs)],
    note: text(section?.note),
    overlap: text(section?.overlap_key),
    ge_areas: [...array(section?.ge_areas)],
    assume: section?.assume_satisfiable === true,
    constraints: array(section?.analysis_constraints).map(normalizedConstraint),
    receivers: array(section?.receivers).map(normalizedReceiver),
  };
}

function normalizedGroup(group) {
  return {
    title: text(group?.title),
    is_required: group?.is_required !== false,
    conjunction: text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and',
    canonical: Number.isInteger(group?.canonical_section_index)
      ? group.canonical_section_index : null,
    layer: text(group?.requirement_layer),
    tier: text(group?.tier),
    level: text(group?.course_level),
    cc: group?.cc_articulable ?? null,
    refs: [...array(group?.source_refs)],
    stated: text(group?.stated_credits),
    note: text(group?.note),
    overlap: text(group?.overlap_key),
    distinct: group?.distinct_course_ids_across_sections === true,
    constraints: array(group?.analysis_constraints).map(normalizedConstraint),
    sections: array(group?.sections).map((section) => normalizedSection(section, group)),
  };
}

function normalizedVariant(variant) {
  return {
    key: text(variant?.key),
    label: text(variant?.label),
    selected: variant?.selected === true,
    refs: [...array(variant?.source_refs)],
    published_total_units: number(variant?.published_total_units),
    published_major_units_minimum: number(variant?.published_major_units_minimum),
    published_major_units_maximum: number(variant?.published_major_units_maximum),
    canonical_major_units: number(variant?.canonical_major_units),
    published_concentration_units_minimum:
      number(variant?.published_concentration_units_minimum),
    published_concentration_units_maximum:
      number(variant?.published_concentration_units_maximum),
    minimum_course_grade: text(variant?.minimum_course_grade),
    eligible_majors: [...array(variant?.eligible_majors)],
    relationship_to_standard_major: text(variant?.relationship_to_standard_major),
    common_requirements: text(variant?.common_requirements),
    requirement_groups_location: text(variant?.requirement_groups_location),
    groups: array(variant?.requirement_groups).map(normalizedGroup),
  };
}

function allGroups(document) {
  return [
    ...array(document?.requirement_groups),
    ...array(document?.requirement_variants)
      .flatMap((variant) => array(variant?.requirement_groups)),
  ];
}

function normalizedCourseTitles(document) {
  const rows = [];
  for (const group of allGroups(document)) {
    for (const section of array(group.sections)) {
      for (const receiver of array(section.receivers)) {
        const body = receiverBody(receiver);
        for (const code of receiverCodes(receiver)) {
          rows.push([code, text(body.title) ?? text(document?.course_titles?.[code])]);
        }
      }
    }
  }
  return Object.fromEntries(rows.filter(([, title]) => title).sort(([left], [right]) => (
    left.localeCompare(right)
  )));
}

function normalizedUvaWiseProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    program: text(document?.program),
    total_units: number(document?.total_units),
    total_units_max: number(document?.total_units_max),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: array(document?.modeling_notes).filter((note) => note !== REGISTRY_NOTE),
    data_quality_flags: array(document?.data_quality_flags),
    course_titles: normalizedCourseTitles(document),
    groups: array(document?.requirement_groups).map(normalizedGroup),
    variants: array(document?.requirement_variants).map(normalizedVariant),
  };
}

function uvaWiseProofTreeFingerprint(document) {
  return hash(normalizedUvaWiseProofTree(document));
}

function documentStyle(document) {
  const composition = document?.slug === SLUG
    && document?._id == null
    && document?.institution_id == null
    && document?.school_id == null
    && document?.va_requirement_id == null
    && text(document?.program) === PROGRAM;
  const source = document?._id === SOURCE_DEGREE_ID
    && document?.institution_id === SOURCE_INSTITUTION_ID
    && document?.school_id === SOURCE_INSTITUTION_ID
    && document?.slug == null
    && document?.va_requirement_id == null
    && document?.kind === 'degree'
    && document?.major_slug === 'cs'
    && document?.school === SCHOOL
    && text(document?.program) === PROGRAM;
  const projection = document?._id === FINAL_DEGREE_ID
    && document?.institution_id === FINAL_INSTITUTION_ID
    && document?.school_id === SCHOOL_ID
    && document?.va_requirement_id === SOURCE_DEGREE_ID
    && document?.slug == null
    && document?.kind === 'degree'
    && document?.state === 'va'
    && document?.major_slug === 'va-cs'
    && document?.school === SCHOOL
    && text(document?.program) === PROGRAM;
  return [composition, source, projection].filter(Boolean).length === 1
    ? (composition ? 'composition' : source ? 'accepted_source' : 'final_projection')
    : null;
}

function sourceBundleIssue(document, style) {
  if (style === 'composition') {
    const required = array(document?.source_bundle_required);
    const expected = SOURCE_RECEIPTS.map((row) => row.id);
    return required.length === expected.length
      && required.every((id, index) => id === expected[index])
      ? null : 'the composed UVA Wise source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== 'server/.va-catalogs/composed/the-university-of-virginia-s-college-at-wise.json') {
    return 'the retained UVA Wise source-bundle receipt changed';
  }
  const sources = array(document?.sources);
  if (sources.length !== SOURCE_RECEIPTS.length
      || sources.some((source, index) => {
        const expected = SOURCE_RECEIPTS[index];
        return source?.id !== expected.id
          || source?.role !== expected.role
          || source?.kind !== expected.kind
          || source?.sha256 !== expected.sha256
          || source?.official !== true
          || source?.secure !== false;
      })) return 'the retained official UVA Wise source roles or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactProjectedCourseIds(document) {
  for (const group of allGroups(document)) {
    for (const section of array(group.sections)) {
      for (const receiver of array(section.receivers)) {
        const body = receiverBody(receiver);
        if (!['course', 'series'].includes(String(body.kind || '').toLowerCase())) continue;
        const expected = receiverCodes(receiver)
          .map((code) => receivingCourseIdForDocument(document, code));
        const actual = body.kind === 'series' ? array(body.parent_ids) : [body.parent_id];
        if (!expected.length || actual.length !== expected.length
            || actual.some((id, index) => Number(id) !== expected[index])) return false;
      }
    }
  }
  return true;
}

function exactUvaWiseTree(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact UVA Wise composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the UVA Wise catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = uvaWiseProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed UVA Wise source tree, variants, source refs, constraints, or accounting declarations changed');
  }
  if (style !== 'composition' && !exactProjectedCourseIds(document)) {
    return fail('one or more projected UVA Wise course identities changed');
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed UVA Wise 2026-2027 tree and seven-role official source receipt match',
    proof: {
      document_style: style,
      proof_tree_sha256: fingerprint,
      source_bundle_sha256: style === 'composition' ? null : SOURCE_BUNDLE_SHA256,
      official_source_sha256: Object.fromEntries(
        SOURCE_RECEIPTS.map(({ id, sha256 }) => [id, sha256]),
      ),
    },
  };
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}, paths = RULE_PATHS) {
  const expectedPath = paths[kind];
  if (!expectedPath || path !== expectedPath) {
    return `the ${kind} declaration moved from its reviewed source path`;
  }
  const index = Number(path.match(/^requirement_groups\[(\d+)]$/)?.[1]);
  const group = document?.requirement_groups?.[index];
  if (!Number.isInteger(index) || group !== container) {
    return `the ${kind} evaluator did not receive its exact source container`;
  }
  const declarations = array(group.analysis_constraints).filter((entry) => entry.kind === kind);
  if (declarations.length !== 1 || declarations[0] !== constraint) {
    return `the ${kind} declaration is absent, duplicated, or detached from its container`;
  }
  return null;
}

function sectionUnits(section) {
  return number(section?.unit_advisement ?? section?.units);
}

function groupConjunction(group) {
  return text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and';
}

function exactSingleReceiver(section, { kind, codes = [], units, overlap = null } = {}) {
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  return number(section?.section_advisement ?? section?.select) === 1
    && sectionUnits(section) === units
    && receivers.length === 1
    && text(body.kind)?.toLowerCase() === kind
    && number(body.units) === units
    && JSON.stringify(receiverCodes(receivers[0])) === JSON.stringify(codes)
    && (overlap == null || text(receivers[0]?.overlap_key) === overlap);
}

function canonicalRouteProof(kind, document) {
  if (kind === 'published_first_year_experience_range') {
    const group = document?.requirement_groups?.[6];
    if (groupConjunction(group) !== 'and' || array(group?.sections).length !== 1
        || !exactSingleReceiver(group.sections[0], {
          kind: 'course', codes: ['SEM1010'], units: 3,
        })) return fail('the exact named three-credit SEM 1010 route changed');
    return { selected_group_section_index: 0, selected_codes: ['SEM1010'], units: 3 };
  }
  if (kind === 'accelerated_composition_credit_award') {
    const group = document?.requirement_groups?.[7];
    if (groupConjunction(group) !== 'or' || group?.canonical_section_index !== 0
        || array(group?.sections).length !== 2
        || !exactSingleReceiver(group.sections[0], {
          kind: 'series', codes: ['ENG1010', 'ENG1020'], units: 6,
        })
        || !exactSingleReceiver(group.sections[1], {
          kind: 'course', codes: ['ENG1030'], units: 6,
        })) return fail('the exact written-communication canonical route changed');
    return {
      selected_group_section_index: 0,
      selected_codes: ['ENG1010', 'ENG1020'],
      units: 6,
      accelerated_grade_route_selected: false,
    };
  }
  if (kind === 'accelerated_language_core_substitution') {
    const group = document?.requirement_groups?.[8];
    if (groupConjunction(group) !== 'or' || group?.canonical_section_index !== 0
        || array(group?.sections).length !== 6
        || !exactSingleReceiver(group.sections[0], {
          kind: 'series', codes: ['FRE1010', 'FRE1020'], units: 6,
        })) return fail('the exact global-communication canonical route changed');
    return {
      selected_group_section_index: 0,
      selected_codes: ['FRE1010', 'FRE1020'],
      units: 6,
      accelerated_three_credit_route_selected: false,
    };
  }
  const major = document?.requirement_groups?.[0]?.sections?.[0];
  const core = document?.requirement_groups?.[9];
  if (!exactSingleReceiver(major, {
    kind: 'course', codes: ['MTH2040'], units: 4, overlap: 'uvawise-major-mth2040',
  })
      || array(core?.sections).length !== 1
      || !exactSingleReceiver(core.sections[0], {
        kind: 'course', codes: ['MTH2040'], units: 0, overlap: 'uvawise-major-mth2040',
      })) return fail('the exact four-credit MTH 2040 / zero-unit Core overlap changed');
  return {
    major_path: 'requirement_groups[0].sections[0]',
    core_path: 'requirement_groups[9].sections[0]',
    selected_codes: ['MTH2040'],
    earned_units: 4,
    core_increment_units: 0,
  };
}

function evaluateUvaWiseConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (!RULE_PATHS[kind]) {
    return fail('no exact UVA Wise evaluator handles this rule');
  }
  const exact = exactUvaWiseTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context, RULE_PATHS);
  if (issue) return fail(issue);
  const route = canonicalRouteProof(kind, context.document);
  if (route.supported === false) return route;
  return {
    ...exact,
    reason: kind === 'major_course_substitutes_for_core_area'
      ? 'the exact MTH 2040 major carrier earns four credits once and the matching Core receipt contributes zero additional credits'
      : 'every shared reader selects the exact source-authored canonical route; the conditional alternate is not selected',
    proof: { ...exact.proof, rule_path: context.path, ...route },
  };
}

/**
 * Prove only the Figures 3/4 quantity consequence of three contextual-Core
 * rules.  The retained catalog supplies all 145 course occurrences and one
 * exact seven-course / 21-credit witness: SWE 1790 supplies the three-credit
 * Self/major overlap and six distinct published courses supply the remaining
 * 18 credits while covering Community, Nation, World, HFA, and SBS without
 * cross-area reuse.
 *
 * This is deliberately not a course-application or prerequisite evaluator.
 * The exact selected sending/receiving identities remain open for Figure 6,
 * so the rule stays unsupported there.  Inclusive Excellence and the broader
 * two-lab-science major rule are not handled here: neither roster is complete.
 */
function evaluateUvaWiseGeConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (!CONTEXTUAL_FIGURE_3_4_CAPACITY_RULES.has(kind)) {
    return fail('no exact UVA Wise GE-capacity evaluator handles this rule');
  }
  const exact = exactUvaWiseTree(context.document);
  if (!exact.supported) return exact;
  const paths = Object.fromEntries(Object.entries(SCOPED_RULE_PATHS)
    .map(([key, row]) => [key, row.path]));
  const issue = ruleContainerIssue(kind, container, context, paths);
  if (issue) return fail(issue);
  const capacity = uvaWiseContextualFigure34CapacityProof(
    UVA_WISE_GE_ROSTER_EVIDENCE,
  );
  if (!capacity.ready) return fail(capacity.reason);
  return {
    supported: false,
    affected_figures: ['6'],
    paper_impact_proven: true,
    reason: 'the exact retained contextual roster supplies a distinct 21-credit witness satisfying every subarea, HFA/SBS breadth, and one-area-per-course rule, so this rule cannot change the fixed 18-credit Figures 3/4 remainder; exact selected identities and prerequisites remain open for Figure 6',
    proof: {
      ...exact.proof,
      rule_path: context.path,
      figure_3_4_capacity_exact: true,
      liberal_arts_core_units: capacity.liberal_arts_core_units,
      major_overlap_self_units: capacity.major_overlap_self_units,
      remaining_contextual_capacity_units:
        capacity.remaining_contextual_capacity_units,
      selected_course_codes: capacity.selected_course_codes,
      selected_course_areas: capacity.selected_course_areas,
      contextual_roster_sha256: capacity.roster_sha256,
      contextual_witness_sha256: capacity.witness_sha256,
      all_witness_courses_below_3000: capacity.all_courses_below_3000,
      figure_6_identity_and_prerequisites_exact: false,
    },
  };
}

/**
 * Exact pair boundary for the policy proof. The bachelor evaluator establishes
 * the conditional rule; this guard establishes that the actual sender is one
 * of the 18 reviewed VCCS A.S. trees. Richard Bland and every drifted wrapper,
 * source bundle, or requirement tree fail closed.
 */
function uvaWiseVccsGaaWaiver(document, associateDocument, options = {}) {
  const claimsUvaWise = [
    document?.slug, document?._id, document?.va_requirement_id,
    document?.institution_id, document?.school_id, document?.school,
  ].map((value) => String(value ?? '').trim()).some((value) => [
    SLUG, SOURCE_DEGREE_ID, SOURCE_INSTITUTION_ID, FINAL_DEGREE_ID,
    FINAL_INSTITUTION_ID, String(SCHOOL_ID), SCHOOL,
  ].includes(value));
  if (!claimsUvaWise) return { applicable: false, ready: false };
  if (options.scenario !== 'successful_gaa_participant') {
    return {
      applicable: false,
      ready: false,
      optional_policy: true,
      scenario_selected: false,
      reason: 'the optional UVA Wise GAA bonus requires the explicit successful_gaa_participant scenario; an ordinary transfer evaluation is unchanged',
    };
  }
  const exact = exactUvaWiseTree(document);
  if (!exact.supported) {
    return {
      applicable: false, ready: false, optional_policy: true,
      scenario_selected: true, bonus_denied: true, reason: exact.reason,
    };
  }
  const evidenceIssue = uvaWiseTransferPolicyEvidenceIssue(
    UVA_WISE_TRANSFER_POLICY_EVIDENCE,
  );
  if (evidenceIssue) {
    return {
      applicable: false, ready: false, optional_policy: true,
      scenario_selected: true, bonus_denied: true, reason: evidenceIssue,
    };
  }
  const numericId = Number(associateDocument?.community_college_id);
  if (numericId === 9317) {
    return {
      applicable: false,
      ready: false,
      optional_policy: true,
      scenario_selected: true,
      bonus_denied: true,
      reason: 'Richard Bland is not a party to the signed VCCS agreement, and the current registrar page does not publish the lower-division GE waiver for Richard Bland',
      source_system: 'RBC',
    };
  }
  const receipt = VCCS_SENDER_RECEIPTS.find((row) => row.numeric_id === numericId);
  const sourceBundle = text(associateDocument?.provenance?.source_bundle_hash);
  const pairTree = uvaWiseVccsSenderTreeFingerprint(associateDocument);
  const tupleCohort = receipt && sourceBundle === receipt.protected_source_bundle_sha256
      && pairTree === receipt.protected_pair_tree_sha256
    ? 'protected_authoritative'
    : receipt && sourceBundle === receipt.source_bundle_sha256
      && pairTree === receipt.pair_tree_sha256 ? 'candidate' : null;
  if (!receipt
      || associateDocument?.kind !== 'as_degree'
      || text(associateDocument?.degree_type) !== 'local_as'
      || text(associateDocument?.source_degree_type)?.toUpperCase() !== 'AS'
      || text(associateDocument?.state)?.toLowerCase() !== 'va'
      || text(associateDocument?.status) !== 'found'
      || text(associateDocument?.va_requirement_status) !== 'extracted'
      || text(associateDocument?._id) !== receipt.projection_id
      || text(associateDocument?.va_requirement_id) !== receipt.source_id
      || text(associateDocument?.college_id) !== receipt.projection_college_id
      || text(associateDocument?.college_name) !== receipt.name
      || !usesCanonicalSourceContract(associateDocument)
      || !tupleCohort) {
    return {
      applicable: false,
      ready: false,
      optional_policy: true,
      scenario_selected: true,
      bonus_denied: true,
      reason: 'the optional UVA Wise GAA bonus requires one exact source-proven VCCS transfer A.S. projection/source/tree tuple; the ordinary route remains available',
    };
  }
  return {
    applicable: true,
    ready: true,
    source_system: 'VCCS',
    sender_slug: receipt.slug,
    sender_numeric_id: receipt.numeric_id,
    sender_source_id: receipt.source_id,
    sender_tree_sha256: pairTree,
    source_bundle_sha256: sourceBundle,
    projection_receipt_cohort: tupleCohort,
    qualifying_award: 'AS',
    qualifying_cip_code: receipt.cip_code,
    schev_classification: "Associate's Degree - Transfer",
    scenario: 'successful_gaa_participant',
    scenario_selected: true,
    successful_gaa_conditions_required: true,
    ordinary_non_gap_transfer_waiver: false,
    lower_division_general_education_met: true,
    minimum_units_applied_to_degree: 60,
    maximum_accepted_units: 62,
    major_specific_two_lab_sciences_waived: false,
    richard_bland_covered: false,
    evidence_sha256: UVA_WISE_TRANSFER_POLICY_EVIDENCE.policy_facts_sha256,
  };
}

function uvaWiseSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  const scoped = SCOPED_RULE_PATHS[kind];
  if (!scoped) return null;
  const exact = exactUvaWiseTree(context.document);
  if (!exact.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  }, Object.fromEntries(Object.entries(SCOPED_RULE_PATHS).map(([key, row]) => [key, row.path])))) {
    return null;
  }
  // The two upper-major groups are fixed nontransferable capacity, so their
  // open identities cannot move a Figure 3/4 numerator. Figure 1 excludes GE,
  // but a fixed 18-credit contextual capacity does not prove that an associate
  // plan satisfies Community/Nation/World, disciplinary-breadth, Inclusive
  // Excellence, and cross-area reuse rules. Keep those rules fail-closed for
  // Figures 3/4 until course-level attributes are sourced. Figure 6 also needs
  // the exact identities/attributes. The open MTH and upper-major identities
  // remain blocking in Figure 1.
  return [...scoped.figures];
}

function evaluateUvaWiseStructuralRule({ kind, path, document } = {}) {
  if (kind !== 'overlap_key') return null;
  const exact = exactUvaWiseTree(document);
  if (!exact.supported) return exact;
  const expected = OVERLAP_MARKERS.find(([expectedPath]) => expectedPath === path);
  if (!expected) return fail('the overlap marker is outside the exact UVA Wise marker inventory');
  const [, overlap, code, units] = expected;
  const marker = path.split('.').reduce((value, key) => {
    const match = key.match(/^(\w+)\[(\d+)]$/);
    return match ? value?.[match[1]]?.[Number(match[2])] : value?.[key];
  }, document);
  const receiverPath = path.replace(/\.overlap_key$/, '');
  const receiver = receiverPath.split('.').reduce((value, key) => {
    const match = key.match(/^(\w+)\[(\d+)]$/);
    return match ? value?.[match[1]]?.[Number(match[2])] : value?.[key];
  }, document);
  if (text(marker) !== overlap || receiverCodes(receiver)[0] !== code
      || number(receiverBody(receiver).units) !== units) {
    return fail('the exact UVA Wise overlap key, receiver, or unit receipt changed');
  }
  return {
    ...exact,
    evaluator: 'evaluateUvaWiseStructuralRule',
    reason: units === 0
      ? 'the marker is an exact zero-unit same-requirement receipt and cannot add a second course or credit'
      : 'the exact counterpart is either a zero-unit receipt, an inactive-variant option, or a mutually exclusive same-section alternative',
    proof: {
      ...exact.proof,
      marker_path: path,
      overlap_key: overlap,
      receiver_code: code,
      receiver_units: units,
    },
  };
}

function uvaWiseRequirementRole(document, group, section) {
  if (group !== document?.requirement_groups?.[14]
      || section !== group?.sections?.[0]) return null;
  const exact = exactUvaWiseTree(document);
  if (!exact.supported
      || groupConjunction(group) !== 'and'
      || text(group?.requirement_layer) !== 'university_graduation'
      || text(effective(section, group, 'tier')) !== 'breadth'
      || text(effective(section, group, 'course_level')) !== 'any'
      || effective(section, group, 'cc_articulable') !== true
      || !exactSingleReceiver(section, {
        kind: 'ge_area', codes: ['UVAWISE-OPEN-CREDIT'], units: 10,
      })) return null;
  return {
    applies: true,
    exact: true,
    role: 'elective_capacity',
    issues: [],
    evidence: {
      source_bound_evaluator: 'uvaWiseRequirementRole',
      proof_tree_sha256: exact.proof.proof_tree_sha256,
      path: 'requirement_groups[14].sections[0]',
      exact_capacity_units: 10,
    },
  };
}

function evaluateUvaWiseResidencyPolicy(document) {
  const exact = exactUvaWiseTree(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  const residency = audit.residency || {};
  const upperGroup = document?.requirement_groups?.[4];
  const upperSections = array(upperGroup?.sections);
  const fixedUpperUnits = upperSections.reduce((sum, section) => sum + sectionUnits(section), 0);
  if (text(residency.status)?.toLowerCase() !== 'required'
      || number(residency.minimum_units) !== 45
      || text(residency.rule) !== 'At least 45 credits must be completed through UVA Wise, including at least 15 upper-level credits in the major; at least 58 of the 120 credits must be earned at a regionally accredited four-year institution.'
      || JSON.stringify(array(residency.source_refs)) !== JSON.stringify(['graduation'])
      || number(audit.four_year_institution_units_minimum) !== 58
      || number(audit.two_year_transfer_units_maximum) !== 62
      || number(audit.major_upper_level_residency_minimum) !== 15
      || number(audit.major_upper_division_coursework_units) !== 15
      || text(upperGroup?.requirement_layer) !== 'major'
      || text(upperGroup?.tier) !== 'nontransferable'
      || text(upperGroup?.course_level) !== 'upper_division'
      || upperGroup?.cc_articulable !== false
      || upperSections.length !== 2
      || fixedUpperUnits !== 15) return null;
  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 45,
    residency_percentage_exact_units: null,
    overall_transfer_cap_units: 75,
    two_year_transfer_cap_units: 62,
    final_window_transfer_cap_units: null,
    effective_two_year_transfer_cap_units: 62,
    evidence: [
      { source: 'total_units - exact UVA Wise residency minimum', units: 75 },
      { source: 'exact two-year transfer maximum / four-year minimum', units: 62 },
    ],
    inventory: {
      fields: {
        four_year_institution_units_minimum: 58,
        major_upper_level_residency_minimum: 15,
        two_year_transfer_units_maximum: 62,
      },
      unclassified_fields: [],
    },
    source_policy_id: SLUG,
    declared_subrules: [
      'overall_residency', 'four_year_institution_minimum',
      'two_year_transfer_cap', 'major_upper_level_residency',
    ],
    evaluator: 'evaluateUvaWiseResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the two-year pathway is capped at 62 credits; its remaining 58 UVA Wise credits exceed the 45-credit residence floor and include the exact fixed 15-credit nontransferable upper-major block',
    issues: [],
    proof: {
      ...exact.proof,
      fixed_nontransferable_upper_major_units: fixedUpperUnits,
      standard_exception_selected: false,
    },
  };
}

function uvaWiseQualityFlagAffectedFigures(flag, document) {
  if (text(flag?.code) !== 'liberal_arts_core_cross_area_constraints') return null;
  const exact = exactUvaWiseTree(document);
  return exact.supported ? ['3', '4', '6'] : null;
}

module.exports = {
  OVERLAP_MARKERS,
  PROOF_TREE_SHA256,
  SOURCE_BUNDLE_SHA256,
  SOURCE_RECEIPTS,
  evaluateUvaWiseConstraint,
  evaluateUvaWiseGeConstraint,
  evaluateUvaWiseResidencyPolicy,
  evaluateUvaWiseStructuralRule,
  exactUvaWiseTree,
  normalizedUvaWiseProofTree,
  uvaWiseProofTreeFingerprint,
  uvaWiseQualityFlagAffectedFigures,
  uvaWiseRequirementRole,
  uvaWiseSourceSpecificAffectedFigures,
  uvaWiseVccsGaaWaiver,
};
