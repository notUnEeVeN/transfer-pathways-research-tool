/**
 * Exact paper-figure proofs for Christopher Newport's 2025-2026 CS degree.
 *
 * The one closed choice rule (the 495/500-level cap) is enforced by selecting
 * a source-valid advanced menu.  The Area-of-Inquiry and second-WI rules are
 * intentionally not treated as executable course menus: the shared document
 * preserves their credits and attributes, but not the chosen courses and
 * prerequisite closure.  The complete reviewed tree proves those two rules
 * cannot move Figures 1/3/4; they remain fail-closed for Figure 6.
 */

const { createHash } = require('node:crypto');
const { receivingCourseIdForDocument } = require('../virginia/courseIdentity');

const SLUG = 'christopher-newport-university';
const SCHOOL = 'Christopher Newport University';
const SCHOOL_ID = 9206;
const SOURCE_DEGREE_ID = 'va:degree:christopher-newport-university:cs';
const SOURCE_INSTITUTION_ID = 'va:uni:christopher-newport-university';
const FINAL_DEGREE_ID = 'degree:9206:va-cs';
const FINAL_INSTITUTION_ID = 'va:uni:9206';
const SOURCE_PROGRAM = 'Bachelor of Science in Computer Foundations, Computer Science Major';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2025-2026';
const SOURCE_BUNDLE_SHA256 = 'a677b2326f08ec2269cec2dd938f1d41aedc861ff06b0afd79e94f966d935708';
const OFFICIAL_TEXT_SHA256 = 'decd8d2605842c3ce1fc7714dda8c4c1eb82abc293b89f0208773a4dd09112ec';
const OFFICIAL_PDF_SHA256 = '30e4ab16d575d4ab5a966012f37cf6a6b536ffb775d267fccba4f82fcd23d327';

// Filled from normalizedCnuProofTree() after composition -> accepted source ->
// final numeric projection parity was established.  The normalizer excludes
// wrapper ids and derived display categories, but includes every authored
// group, section, receiver, source ref, constraint, accounting field, note,
// quality flag, and course title.
const PROOF_TREE_SHA256 = '03f04015838dcc99d55bb9edb5150cc2756e5eb66ef1c819145c4767a6e83b67';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const SPECIAL_TOPICS_PATH = 'requirement_groups[1]';
const OPEN_RULE_PATHS = Object.freeze({
  area_of_inquiry_discipline_limits: 'requirement_groups[4]',
  writing_intensive_attribute_within_capacity: 'requirement_groups[5]',
});
const ADVANCED_SELECTION_INDICES = Object.freeze([0, 1, 2]);
const RESTRICTED_ADVANCED_CODES = Object.freeze(['CPSC495', 'PCSE495', 'CNUCPSC500']);
const SOURCE_IDS = Object.freeze([
  'major', 'general_education', 'college', 'graduation', 'course_catalog',
]);
const REGISTRY_NOTE = 'Current official 2025-2026 undergraduate catalog PDF. The Computer Science major requirement window is page 270; GE and graduation rules are pp. 59-61 and 56-57 respectively.';

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

function canonicalProgram(value) {
  const program = text(value);
  return program === FINAL_PROGRAM ? SOURCE_PROGRAM : program;
}

function normalizedCnuProofTree(document) {
  const authoredCodes = new Set(array(document?.requirement_groups)
    .flatMap((group) => array(group?.sections))
    .flatMap((section) => array(section?.receivers))
    .flatMap(receiverCodes));
  const courseTitles = Object.fromEntries(Object.entries(document?.course_titles || {})
    .filter(([code]) => authoredCodes.has(code)));
  return {
    catalog_year: text(document?.catalog_year),
    program: canonicalProgram(document?.program),
    total_units: number(document?.total_units),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: array(document?.modeling_notes).filter((note) => note !== REGISTRY_NOTE),
    data_quality_flags: array(document?.data_quality_flags),
    course_titles: courseTitles,
    groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function cnuProofTreeFingerprint(document) {
  return hash(normalizedCnuProofTree(document));
}

function documentStyle(document) {
  const composition = document?.slug === SLUG
    && document?._id == null
    && document?.institution_id == null
    && document?.school_id == null
    && document?.va_requirement_id == null
    && text(document?.program) === SOURCE_PROGRAM;
  const source = document?._id === SOURCE_DEGREE_ID
    && document?.institution_id === SOURCE_INSTITUTION_ID
    && document?.school_id === SOURCE_INSTITUTION_ID
    && document?.slug == null
    && document?.va_requirement_id == null
    && document?.kind === 'degree'
    && document?.major_slug === 'cs'
    && document?.school === SCHOOL
    && text(document?.program) === SOURCE_PROGRAM;
  const projection = document?._id === FINAL_DEGREE_ID
    && document?.institution_id === FINAL_INSTITUTION_ID
    && document?.school_id === SCHOOL_ID
    && document?.va_requirement_id === SOURCE_DEGREE_ID
    && document?.slug == null
    && document?.kind === 'degree'
    && document?.state === 'va'
    && document?.major_slug === 'va-cs'
    && document?.school === SCHOOL
    && text(document?.program) === FINAL_PROGRAM;
  return [composition, source, projection].filter(Boolean).length === 1
    ? (composition ? 'composition' : source ? 'accepted_source' : 'final_projection')
    : null;
}

function sourceBundleIssue(document, style) {
  if (style === 'composition') return null;
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== 'server/.va-catalogs/composed/christopher-newport-university.json') {
    return 'the retained CNU source-bundle receipt changed';
  }
  const sources = array(document?.sources);
  if (sources.length !== SOURCE_IDS.length
      || sources.some((source, index) => (
        source?.id !== SOURCE_IDS[index]
        || source?.sha256 !== OFFICIAL_TEXT_SHA256
        || source?.official !== true
        || source?.secure !== true
      ))) return 'the retained official CNU source roles or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactCnuTree(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact CNU composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the CNU catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = cnuProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed CNU source tree, source refs, attributes, or accounting declarations changed');
  }
  if (style !== 'composition') {
    for (const group of array(document.requirement_groups)) {
      for (const section of array(group.sections)) {
        for (const receiver of array(section.receivers)) {
          const body = receiverBody(receiver);
          if (!['course', 'series'].includes(String(body.kind || '').toLowerCase())) continue;
          const expected = receiverCodes(receiver)
            .map((code) => receivingCourseIdForDocument(document, code));
          const actual = body.kind === 'series' ? array(body.parent_ids) : [body.parent_id];
          if (!expected.length || actual.length !== expected.length
              || actual.some((id, index) => Number(id) !== expected[index])) {
            return fail('one or more projected CNU course identities changed');
          }
        }
      }
    }
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed CNU 2025-2026 source tree and official source-bundle receipt match',
    proof: {
      document_style: style,
      proof_tree_sha256: fingerprint,
      source_bundle_sha256: style === 'composition' ? null : SOURCE_BUNDLE_SHA256,
      official_text_sha256: OFFICIAL_TEXT_SHA256,
      official_pdf_sha256: OFFICIAL_PDF_SHA256,
    },
  };
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}) {
  const expectedPath = kind === 'special_topics_and_500_level_limit'
    ? SPECIAL_TOPICS_PATH : OPEN_RULE_PATHS[kind];
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
    return `the ${kind} source declaration is absent, duplicated, or detached from its container`;
  }
  return null;
}

function cnuFigureSelection(document) {
  const exact = exactCnuTree(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  const section = document.requirement_groups?.[1]?.sections?.[0];
  const selected = ADVANCED_SELECTION_INDICES.map((index) => section?.receivers?.[index]);
  const codes = selected.map((receiver) => receiverCodes(receiver)[0] || null);
  const restricted = codes.filter((code) => RESTRICTED_ADVANCED_CODES.includes(code));
  if (selected.some((receiver) => !receiver)
      || codes.some((code) => !code)
      || restricted.length > 2) {
    return { ready: false, reason: 'the exact CNU advanced selection no longer satisfies the 495/500-level cap' };
  }
  return {
    ready: true,
    institution: SLUG,
    section_receiver_indices: { '1:0': [...ADVANCED_SELECTION_INDICES] },
    selected_advanced_codes: codes,
    restricted_advanced_codes: restricted,
    proof: exact.proof,
  };
}

function evaluateCnuConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (kind !== 'special_topics_and_500_level_limit') {
    return fail('no exact CNU evaluator handles this open attribute/menu rule');
  }
  const exact = exactCnuTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context);
  if (issue) return fail(issue);
  const selection = cnuFigureSelection(context.document);
  if (!selection.ready) return fail(selection.reason);
  return {
    ...exact,
    reason: 'all figure readers use the exact three-course CNU selection, which contains no 495/500-level receiver',
    proof: {
      ...exact.proof,
      rule_path: context.path,
      selected_receiver_indices: [...ADVANCED_SELECTION_INDICES],
      selected_codes: selection.selected_advanced_codes,
      restricted_selected_count: selection.restricted_advanced_codes.length,
      restricted_selected_maximum: 2,
    },
  };
}

function cnuSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  if (!OPEN_RULE_PATHS[kind]) return null;
  const exact = exactCnuTree(context.document);
  if (!exact.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  })) return null;
  // The exact carriers are five GE-only fixed-credit slots and one zero-unit
  // designation inside fixed 19-credit elective capacity. Figures 1/3/4 never
  // choose their course identities: the discipline/WI rule cannot add a named
  // observation or change an applied-credit capacity. Figure 6 does choose
  // course vertices and prerequisite edges, so it remains blocked.
  return ['6'];
}

function cnuQualityFlagAffectedFigures(flag, document) {
  if (text(flag?.code) !== 'liberal_learning_distribution_constraints') return null;
  const exact = exactCnuTree(document);
  return exact.supported ? ['6'] : null;
}

function evaluateCnuResidencyPolicy(document) {
  const exact = exactCnuTree(document);
  if (!exact.supported) return null;
  const residency = document?.unit_audit?.residency;
  if (text(residency?.status)?.toLowerCase() !== 'required'
      || number(residency?.minimum_units) !== 45) return null;
  // Every transfer unit in Figures 3/4 is earned before the university
  // segment. The 45-credit overall residence minimum therefore makes the
  // final-36/30-resident rule automatically true. The reviewed tree also
  // retains 29 nontransferable upper-division major credits, exceeding the
  // final-12-major residence requirement without classifying any verified
  // lower-division major option as resident.
  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 45,
    residency_percentage_exact_units: null,
    overall_transfer_cap_units: 75,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: 90,
    effective_two_year_transfer_cap_units: 75,
    evidence: [
      { source: 'total_units - exact residency minimum', units: 75 },
      { source: 'total_units - final-36 resident minimum', units: 90 },
    ],
    inventory: { fields: {}, unclassified_fields: [] },
    source_policy_id: SLUG,
    declared_subrules: [
      'overall_residency', 'final_window_residency', 'final_window_major_residency',
    ],
    evaluator: 'evaluateCnuResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the two-year pathway is capped at 75 credits; its pre-entry sequencing satisfies the final-window rule and 29 fixed resident upper-major credits satisfy the final-12-major rule',
    issues: [],
    proof: {
      ...exact.proof,
      final_credit_window_units: 36,
      final_credit_window_residency_units_minimum: 30,
      final_major_residency_units_minimum: 12,
      fixed_nontransferable_upper_major_units: 29,
    },
  };
}

module.exports = {
  OFFICIAL_PDF_SHA256,
  OFFICIAL_TEXT_SHA256,
  cnuFigureSelection,
  cnuProofTreeFingerprint,
  cnuQualityFlagAffectedFigures,
  cnuSourceSpecificAffectedFigures,
  evaluateCnuConstraint,
  evaluateCnuResidencyPolicy,
  exactCnuTree,
  normalizedCnuProofTree,
};
