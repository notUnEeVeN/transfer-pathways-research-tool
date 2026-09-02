/**
 * Exact paper-figure proofs for Radford University's 2026-2027 Computer
 * Science B.S. canonical (no-concentration) path.
 *
 * The proof is bound to the complete selected tree, every inactive variant,
 * exact unit declarations, projected course identities, and all six retained
 * official receipts.  It proves only fixed accounting and zero-unit overlap
 * facts.  Science/laboratory eligibility, WI attributes, GE designations, and
 * course ownership remain fail-closed until course-level evidence exists.
 */

const { createHash } = require('node:crypto');
const { receivingCourseIdForDocument } = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const RADFORD_TRANSFER_DEGREE_EVIDENCE = require(
  '../../.va-catalogs/research/radford-transfer-degree-real-evidence.json'
);
const RADFORD_SCIENCE_PAIR_EVIDENCE = require(
  '../../.va-catalogs/research/radford-science-pair-evidence.json'
);
const {
  POLICY_FACTS_SHA256: TRANSFER_DEGREE_POLICY_FACTS_SHA256,
  radfordTransferDegreeEvidenceIssue,
} = require('./radfordTransferDegreeEvidence');
const {
  radfordSciencePairEvidenceIssue,
} = require('./radfordSciencePairEvidence');

const SLUG = 'radford-university';
const SCHOOL = 'Radford University';
const SCHOOL_ID = 9219;
const SOURCE_DEGREE_ID = `va:degree:${SLUG}:cs`;
const SOURCE_INSTITUTION_ID = `va:uni:${SLUG}`;
const FINAL_DEGREE_ID = `degree:${SCHOOL_ID}:va-cs`;
const FINAL_INSTITUTION_ID = `va:uni:${SCHOOL_ID}`;
const SOURCE_PROGRAM = 'Computer Science, B.S. (R, L)';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2026-2027';
const SOURCE_BUNDLE_SHA256 = 'c561e9db2e3940f71f724406e8b29d0f63d8942945b350d03a2e6236099f0800';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: '377250367076d0a6fe945db23326b400e04ab3d47c816da464793c8897aa1b8c',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: 'f6702e30bd187de51d7fd72a13729de64fe8ec6c8cdc697aff5a62f04f52909c',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: '833e8647a6ad9b7b1607b3daae420f465360ac77c8d6a3536746e7946e6fb38b',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: '8cbd26b4c092390c642000a9ed2073bb6aaae2d2cfc44e8d05fc7e2d2636ad8b',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: 'a7857bf36596af10cfa04d336b95eac8fd6f5d89c6b466d9a648a46cbe1957f4',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: 'f2fe7f4f4586be3897b0b4e5e516d5c213bfea0f3deb11ccd70414abdfb8f6cd',
  }),
]);

// Filled only after composition -> accepted source -> final numeric projection
// parity is established. Wrapper ids and derived display fields are excluded;
// every authored group, variant, constraint, source ref, flag, and accounting
// declaration remains bound.
const PROOF_TREE_SHA256 = '296a8c967fdb87de78bc8a3a7a78e2946e5a31c362fdda7350874d20aba6a548';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const RULE_PATHS = Object.freeze({
  major_area_overlap: 'requirement_groups[7]',
  real_minimum_unique_credit_capacity: 'requirement_groups[11]',
});
const SCOPED_RULE_PATHS = Object.freeze({
  two_sciences_one_laboratory: Object.freeze({
    path: 'requirement_groups[2]', figures: Object.freeze(['1', '6']),
  }),
  prefix_level_exclusion_and_approval_rule: Object.freeze({
    path: 'requirement_groups[4]', figures: Object.freeze(['1', '6']),
  }),
  upper_level_writing_intensive_course: Object.freeze({
    path: 'requirement_groups[10]', figures: Object.freeze(['6']),
  }),
  ge_designated_credit_minimum: Object.freeze({
    path: 'requirement_groups[11]', figures: Object.freeze(['6']),
  }),
  outside_school_credit_minimum: Object.freeze({
    path: 'requirement_groups[11]', figures: Object.freeze(['6']),
  }),
  real_minimum_unique_credit_capacity: Object.freeze({
    path: 'requirement_groups[11]', figures: Object.freeze(['6']),
  }),
});
const OVERLAP_MARKERS = Object.freeze([
  Object.freeze([
    'requirement_groups[1].sections[1].receivers[0].overlap_key',
    'radford-foundational-math', 'MATH171', 4, 4,
  ]),
  Object.freeze([
    'requirement_groups[6].sections[0].receivers[0].overlap_key',
    'radford-foundational-math', 'MATH171', 4, 0,
  ]),
]);
const INACTIVE_CODE_FLAG_MESSAGE = 'The current Computer Science program explicitly lists GEOL 121 in the Advanced Computer Science science menu, but the current official catoid 62 course-catalog filter returns no GEOL 121 course. Preserve the program-listed code without inventing a title.';
const REGISTRY_NOTE = 'The standard no-concentration B.S. is source-backed by the 12-credit upper-level CS alternative. Concentration blocks and the accelerated graduate pathway are separate variants, not additional base requirements.';
const PROOF_TITLE_CODES = Object.freeze([
  'ASTR151', 'ASTR152', 'BIOL106', 'BIOL111', 'BIOL112', 'BIOL229',
  'BIOL230', 'BIOL231', 'BIOL310', 'BIOL311', 'CHEM111', 'CHEM112',
  'CS540', 'GEOL105', 'GEOL120', 'GEOL206', 'PHYS111', 'PHYS112',
  'PHYS221', 'PHYS222',
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
    note: text(receiver?.note ?? body.note),
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
  const metadata = Object.fromEntries(Object.entries(variant || {})
    .filter(([key]) => !['requirement_groups', 'codes_seen', 'course_titles'].includes(key))
    .map(([key, value]) => [key, value]));
  return {
    metadata,
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
  return Object.fromEntries(PROOF_TITLE_CODES.map((code) => [
    code, text(document?.course_titles?.[code]),
  ]));
}

function normalizedRadfordProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    total_units: number(document?.total_units),
    total_units_max: number(document?.total_units_max),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: array(document?.modeling_notes).filter((note) => note !== REGISTRY_NOTE),
    data_quality_flags: [...array(document?.data_quality_flags)],
    course_titles: normalizedCourseTitles(document),
    groups: array(document?.requirement_groups).map(normalizedGroup),
    variants: array(document?.requirement_variants).map(normalizedVariant),
  };
}

function radfordProofTreeFingerprint(document) {
  return hash(normalizedRadfordProofTree(document));
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
  if (style === 'composition') {
    const required = array(document?.source_bundle_required);
    const expected = SOURCE_RECEIPTS.map((row) => row.id);
    return JSON.stringify(required) === JSON.stringify(expected)
      ? null : 'the composed Radford source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== `server/.va-catalogs/composed/${SLUG}.json`) {
    return 'the retained Radford source-bundle receipt changed';
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
          || source?.secure !== true;
      })) return 'the retained official Radford source roles or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactProjectedCourseIds(document) {
  for (const group of allGroups(document)) {
    for (const section of array(group?.sections)) {
      for (const receiver of array(section?.receivers)) {
        const body = receiverBody(receiver);
        if (!['course', 'series'].includes(text(body?.kind)?.toLowerCase())) continue;
        const expected = receiverCodes(receiver)
          .map((code) => receivingCourseIdForDocument(document, code));
        const actual = text(body?.kind)?.toLowerCase() === 'series'
          ? array(body?.parent_ids) : [body?.parent_id];
        if (!expected.length || actual.length !== expected.length
            || actual.some((id, index) => Number(id) !== expected[index])) return false;
      }
    }
  }
  return true;
}

function exactRadfordTree(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact Radford composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the Radford catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = radfordProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed Radford tree, variants, refs, constraints, flags, or accounting declarations changed');
  }
  if (style !== 'composition' && !exactProjectedCourseIds(document)) {
    return fail('one or more projected Radford course identities changed');
  }
  return {
    supported: true,
    affected_figures: [],
    reason: 'the complete reviewed Radford canonical tree and six official source receipts match',
    proof: {
      institution_slug: SLUG,
      document_style: style,
      proof_tree_sha256: fingerprint,
      source_bundle_sha256: style === 'composition' ? null : SOURCE_BUNDLE_SHA256,
      source_receipts: SOURCE_RECEIPTS.map((row) => ({ ...row })),
    },
  };
}

function pathValue(document, path) {
  return String(path || '').split('.').reduce((value, part) => {
    const match = part.match(/^(\w+)\[(\d+)]$/);
    return match ? value?.[match[1]]?.[Number(match[2])] : value?.[part];
  }, document);
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}, paths = RULE_PATHS) {
  const expectedPath = paths[kind];
  if (!expectedPath || path !== expectedPath) {
    return `the ${kind} declaration moved from its reviewed source path`;
  }
  if (pathValue(document, path) !== container) {
    return `the ${kind} evaluator did not receive its exact source container`;
  }
  const declarations = array(container?.analysis_constraints)
    .filter((entry) => text(entry?.kind) === kind);
  if (declarations.length !== 1 || declarations[0] !== constraint) {
    return `the ${kind} declaration is absent, duplicated, or detached from its container`;
  }
  return null;
}

function sectionUnits(section) {
  return number(section?.unit_advisement ?? section?.units);
}

function sectionAsk(section) {
  return number(section?.section_advisement ?? section?.select);
}

function exactSingleReceiver(section, { kind, codes = [], name = null, units } = {}) {
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  return sectionAsk(section) === 1
    && sectionUnits(section) === units
    && number(section?.unit_advisement_max ?? section?.units_max ?? units) === units
    && receivers.length === 1
    && text(body?.kind)?.toLowerCase() === kind
    && JSON.stringify(receiverCodes(receivers[0])) === JSON.stringify(codes)
    && (name == null || text(body?.name) === name)
    && number(body?.units) === units;
}

function canonicalGroupUnits(group) {
  const sections = array(group?.sections);
  const units = sections.map(sectionUnits);
  if (!sections.length || units.some((value) => value == null || value < 0)) return null;
  const conjunction = text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and';
  if (conjunction !== 'or' || sections.length === 1) {
    return units.reduce((sum, value) => sum + value, 0);
  }
  const index = group?.canonical_section_index;
  return Number.isInteger(index) && index >= 0 && index < units.length ? units[index] : null;
}

function majorAreaOverlapProof(document) {
  const group = document?.requirement_groups?.[7];
  const sections = array(group?.sections);
  if (text(group?.requirement_layer) !== 'ge_college'
      || text(group?.tier) !== 'breadth'
      || text(group?.course_level) !== 'mixed'
      || group?.cc_articulable !== true
      || JSON.stringify(array(group?.source_refs))
        !== JSON.stringify(['major', 'general_education'])
      || sections.length !== 2
      || !exactSingleReceiver(sections[0], {
        kind: 'ge_area', codes: ['RADFORD-REAL-R-MAJOR'],
        name: 'R area fulfilled by the Computer Science major', units: 0,
      })
      || !exactSingleReceiver(sections[1], {
        kind: 'ge_area', codes: ['RADFORD-REAL-L-MAJOR'],
        name: 'L area fulfilled by the Computer Science major', units: 0,
      })
      || number(document?.unit_audit?.canonical_real_units_inside_major) !== 18) {
    return fail('the exact two zero-unit R/L receipts or their 18-credit major accounting changed');
  }
  return {
    group_path: 'requirement_groups[7]',
    zero_unit_receipts: ['RADFORD-REAL-R-MAJOR', 'RADFORD-REAL-L-MAJOR'],
    major_real_units: 18,
    additive_units: 0,
  };
}

function realCapacityProof(document) {
  const groups = array(document?.requirement_groups);
  const units = groups.map(canonicalGroupUnits);
  const group = groups[11];
  const section = group?.sections?.[0];
  if (groups.length !== 13 || units.some((value) => value == null)
      || units.reduce((sum, value) => sum + value, 0) !== 120
      || units.slice(0, 5).reduce((sum, value) => sum + value, 0) !== 55
      || [5, 8, 9, 10, 11].reduce((sum, index) => sum + units[index], 0) !== 30
      || [6, 7].reduce((sum, index) => sum + units[index], 0) !== 0
      || units[12] !== 35
      || text(group?.requirement_layer) !== 'ge_college'
      || text(group?.tier) !== 'breadth'
      || text(group?.course_level) !== 'elective_capacity'
      || group?.cc_articulable !== true
      || !exactSingleReceiver(section, {
        kind: 'ge_area', codes: ['RADFORD-REAL-REMAINING'],
        name: 'Remaining applicable REAL credit', units: 3,
      })
      || number(document?.unit_audit?.canonical_major_units) !== 55
      || number(document?.unit_audit?.canonical_real_units_inside_major) !== 18
      || number(document?.unit_audit?.canonical_remaining_real_capacity) !== 30
      || number(document?.unit_audit?.canonical_unrestricted_capacity) !== 35
      || radfordTransferDegreeEvidenceIssue(RADFORD_TRANSFER_DEGREE_EVIDENCE)) {
    return fail('the exact 55 + 30 + 35 Radford accounting or three-credit REAL carrier changed');
  }
  return {
    group_path: 'requirement_groups[11]',
    degree_units: 120,
    canonical_major_units: 55,
    real_units_inside_major: 18,
    remaining_real_units: 30,
    remaining_real_group_units: 3,
    unrestricted_units: 35,
    reader_role: 'general_education',
    transfer_degree_policy_facts_sha256: TRANSFER_DEGREE_POLICY_FACTS_SHA256,
    paper_incoming_award: 'AS',
  };
}

function evaluateRadfordConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (!RULE_PATHS[kind]) return fail('no exact Radford evaluator handles this rule');
  const exact = exactRadfordTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context);
  if (issue) return fail(issue);
  const proof = kind === 'major_area_overlap'
    ? majorAreaOverlapProof(context.document) : realCapacityProof(context.document);
  if (proof.supported === false) return proof;
  return {
    ...exact,
    reason: kind === 'major_area_overlap'
      ? 'the official program assigns R and L to the CS major; their exact tree receipts add zero units while the major supplies eighteen unique REAL credits'
      : 'the exact selected tree reconciles as 55 major + 30 remaining REAL + 35 unrestricted credits, and the final three-credit carrier remains REAL rather than free-elective capacity',
    proof: { ...exact.proof, rule_path: context.path, ...proof },
  };
}

function evaluateRadfordStructuralRule({ kind, path, document } = {}) {
  if (kind !== 'overlap_key') return null;
  const style = documentStyle(document);
  // Structural evaluators are chained. A foreign document is not a Radford
  // failure and must allow the next institution-specific evaluator to run.
  if (!style) return null;
  const exact = exactRadfordTree(document);
  if (!exact.supported) return exact;
  const expected = OVERLAP_MARKERS.find(([expectedPath]) => expectedPath === path);
  if (!expected) return fail('the overlap marker is outside the exact Radford marker inventory');
  const [, overlap, code, receiverUnits, sectionUnitReceipt] = expected;
  const receiver = pathValue(document, path.replace(/\.overlap_key$/, ''));
  const section = pathValue(document, path.replace(/\.receivers\[0]\.overlap_key$/, ''));
  if (text(pathValue(document, path)) !== overlap
      || receiverCodes(receiver)[0] !== code
      || number(receiverBody(receiver)?.units) !== receiverUnits
      || sectionUnits(section) !== sectionUnitReceipt) {
    return fail('the exact Radford overlap key, course, receiver units, or section receipt changed');
  }
  return {
    ...exact,
    evaluator: 'evaluateRadfordStructuralRule',
    reason: sectionUnitReceipt === 0
      ? 'the REAL foundational-math receipt contributes zero units and cannot spend or earn MATH 171 a second time'
      : 'the canonical major MATH 171 route carries the only four earned credits for the matched overlap key',
    proof: {
      ...exact.proof,
      marker_path: path,
      overlap_key: overlap,
      receiver_code: code,
      receiver_units: receiverUnits,
      section_units: sectionUnitReceipt,
    },
  };
}

function radfordSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  const scoped = SCOPED_RULE_PATHS[kind];
  if (!scoped) return null;
  const exact = exactRadfordTree(context.document);
  if (!exact.supported) return null;
  const paths = Object.fromEntries(Object.entries(SCOPED_RULE_PATHS)
    .map(([key, row]) => [key, row.path]));
  if (ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  }, paths)) return null;
  if (kind === 'two_sciences_one_laboratory') {
    const group = context.container;
    const section = group?.sections?.[0];
    const receiver = section?.receivers?.[0];
    if (text(group?.title) !== 'B.S. science requirement'
        || text(group?.requirement_layer) !== 'major'
        || text(group?.tier) !== 'breadth'
        || text(group?.course_level) !== 'lower_division_or_category'
        || group?.cc_articulable !== true
        || array(group?.sections).length !== 1
        || sectionAsk(section) !== 1
        || sectionUnits(section) !== 6
        || number(section?.unit_advisement_max) !== 8
        || array(section?.receivers).length !== 1
        || text(receiverBody(receiver)?.kind)?.toLowerCase() !== 'ge_area'
        || receiverCodes(receiver)[0] !== 'RADFORD-BS-SCIENCE-WITH-LAB'
        || number(receiverBody(receiver)?.units) !== 6
        || radfordSciencePairEvidenceIssue(RADFORD_SCIENCE_PAIR_EVIDENCE)) return null;
    return [...scoped.figures];
  }
  if (kind !== 'prefix_level_exclusion_and_approval_rule'
      && radfordTransferDegreeEvidenceIssue(RADFORD_TRANSFER_DEGREE_EVIDENCE)) return null;
  if (kind === 'prefix_level_exclusion_and_approval_rule') {
    const group = context.container;
    const section = group?.sections?.[0];
    if (text(group?.requirement_layer) !== 'major'
        || text(group?.tier) !== 'nontransferable'
        || text(group?.course_level) !== 'upper_division'
        || group?.cc_articulable !== false
        || section?.cc_articulable !== false
        || !exactSingleReceiver(section, {
          kind: 'requirement', codes: [],
          name: 'Twelve approved upper-level CS credits under the published exclusions and director-approval rule',
          units: 12,
        })) return null;
  }
  return [...scoped.figures];
}

function radfordRequirementRole(document, group, section) {
  const groupIndex = array(document?.requirement_groups).indexOf(group);
  const sectionIndex = array(group?.sections).indexOf(section);
  const roles = {
    '6:0': ['zero_unit_requirement', 0],
    '7:0': ['zero_unit_requirement', 0],
    '7:1': ['zero_unit_requirement', 0],
    '11:0': ['general_education', 3],
    '12:0': ['elective_capacity', 35],
  };
  const expected = roles[`${groupIndex}:${sectionIndex}`];
  if (!expected) return null;
  const exact = exactRadfordTree(document);
  if (!exact.supported || sectionUnits(section) !== expected[1]
      || (groupIndex === 11
        && radfordTransferDegreeEvidenceIssue(RADFORD_TRANSFER_DEGREE_EVIDENCE))) return null;
  if (groupIndex === 7 && majorAreaOverlapProof(document).supported === false) return null;
  if (groupIndex === 11 && realCapacityProof(document).supported === false) return null;
  return {
    applies: true,
    exact: true,
    role: expected[0],
    issues: [],
    evidence: {
      source_bound_evaluator: 'radfordRequirementRole',
      proof_tree_sha256: exact.proof.proof_tree_sha256,
      path: `requirement_groups[${groupIndex}].sections[${sectionIndex}]`,
      exact_capacity_units: expected[1],
      eligibility_publication_gated: groupIndex === 11,
    },
  };
}

/**
 * Pair-level guard for the paper-only completed-A.S. REAL waiver.  The
 * bachelor audit proves Radford's policy; this function proves each actual
 * sender is the exact award to which that policy applies.  A new applied or
 * noncanonical award fails the affected cell closed.
 */
function radfordCompletedAsRealWaiver(document, associateDocument) {
  const claimsRadford = [
    document?.slug, document?._id, document?.va_requirement_id,
    document?.institution_id, document?.school_id, document?.school,
  ].map((value) => String(value ?? '').trim()).some((value) => [
    SLUG, SOURCE_DEGREE_ID, SOURCE_INSTITUTION_ID, FINAL_DEGREE_ID,
    FINAL_INSTITUTION_ID, String(SCHOOL_ID), SCHOOL,
  ].includes(value));
  if (!claimsRadford) return { applicable: false, ready: false };
  const exact = exactRadfordTree(document);
  if (!exact.supported) return { applicable: true, ready: false, reason: exact.reason };
  const evidenceIssue = radfordTransferDegreeEvidenceIssue(RADFORD_TRANSFER_DEGREE_EVIDENCE);
  if (evidenceIssue) return { applicable: true, ready: false, reason: evidenceIssue };
  const communityCollegeId = Number(associateDocument?.community_college_id);
  if (!associateDocument || associateDocument?.kind !== 'as_degree'
      || text(associateDocument?.degree_type) !== 'local_as'
      || text(associateDocument?.source_degree_type)?.toUpperCase() !== 'AS'
      || text(associateDocument?.state)?.toLowerCase() !== 'va'
      || text(associateDocument?.status) !== 'found'
      || text(associateDocument?.va_requirement_status) !== 'extracted'
      || !Number.isInteger(communityCollegeId)
      || text(associateDocument?.college_id) !== `va:cc:${communityCollegeId}`
      || !/^as_degree:\d+:va-cs:local_as$/.test(text(associateDocument?._id) || '')
      || !/^va:as:[a-z0-9-]+:cs$/.test(text(associateDocument?.va_requirement_id) || '')
      || !usesCanonicalSourceContract(associateDocument)
      || !associateDocument?.provenance?.source_bundle_hash) {
    return {
      applicable: true,
      ready: false,
      reason: 'the Radford REAL waiver requires an exact completed Virginia A.S. source document',
    };
  }
  return {
    applicable: true,
    ready: true,
    award: 'AS',
    completed_before_radford_enrollment: true,
    real_areas_met: true,
    foundational_requirements_met: true,
    writing_intensive_met: true,
    general_education_units_met: 30,
    outside_major_rule_met: true,
    program_specific_science_requirement_waived: false,
    evidence_sha256: TRANSFER_DEGREE_POLICY_FACTS_SHA256,
  };
}

function radfordQualityFlagAffectedFigures(flag, document) {
  if (text(flag?.code) !== 'program_listed_code_absent_from_course_catalog') return null;
  const exact = exactRadfordTree(document);
  if (!exact.supported
      || flag !== document?.data_quality_flags?.[5]
      || text(flag?.severity)?.toLowerCase() !== 'block_analysis'
      || text(flag?.message) !== INACTIVE_CODE_FLAG_MESSAGE) return null;
  const advanced = document?.requirement_variants?.[1];
  const activeCodes = array(document?.requirement_groups)
    .flatMap((group) => array(group?.sections))
    .flatMap((section) => array(section?.receivers))
    .flatMap(receiverCodes);
  const inactiveCodes = array(advanced?.requirement_groups)
    .flatMap((group) => array(group?.sections))
    .flatMap((section) => array(section?.receivers))
    .flatMap(receiverCodes);
  if (text(advanced?.key) !== 'advanced_computer_science'
      || advanced?.selected !== false
      || activeCodes.includes('GEOL121')
      || inactiveCodes.filter((code) => code === 'GEOL121').length !== 1) return null;
  return [];
}

module.exports = {
  OVERLAP_MARKERS,
  PROOF_TREE_SHA256,
  SOURCE_BUNDLE_SHA256,
  SOURCE_RECEIPTS,
  evaluateRadfordConstraint,
  evaluateRadfordStructuralRule,
  exactRadfordTree,
  normalizedRadfordProofTree,
  radfordProofTreeFingerprint,
  radfordCompletedAsRealWaiver,
  radfordQualityFlagAffectedFigures,
  radfordRequirementRole,
  radfordSourceSpecificAffectedFigures,
};
