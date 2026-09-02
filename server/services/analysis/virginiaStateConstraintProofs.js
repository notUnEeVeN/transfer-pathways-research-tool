/**
 * Exact paper-figure scoping for Virginia State University's 2026-2027
 * Computer Science B.S.
 *
 * The retained official program and GE pages close one exact 120-credit tree:
 * 33 GE + 54 core + 14 required + 6 unrestricted + 13 restricted.  That
 * accounting is useful to Figures 3/4, but it does not make the degree fully
 * solved.  The restricted pool still has no published submenu distribution,
 * several GE routes have variable course/credit shapes, and cross-layer reuse
 * needs identity-aware selection.  Those facts remain closed for Figures 1/6.
 * Course-grade thresholds are handled separately by the exact bachelor
 * performance proof.  That proof conditions Figures 3/4 on a grade-eligible
 * successful pathway and does not resolve the distinct official policy that
 * leaves transfer-course application to program discretion.
 *
 * Nothing here parses a label or invents a course.  Scoping is enabled only
 * for the exact complete source tree, exact rule/flag locations, exact source
 * receipts, and canonical numeric projection identities.  Any drift falls
 * back to the generic all-figure impact.
 */

const { createHash } = require('node:crypto');
const {
  courseIdFor,
  receivingCourseIdForDocument,
} = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');

const SLUG = 'virginia-state-university';
const SCHOOL = 'Virginia State University';
const SCHOOL_ID = 9231;
const SOURCE_DEGREE_ID = `va:degree:${SLUG}:cs`;
const SOURCE_INSTITUTION_ID = `va:uni:${SLUG}`;
const FINAL_DEGREE_ID = `degree:${SCHOOL_ID}:va-cs`;
const FINAL_INSTITUTION_ID = `va:uni:${SCHOOL_ID}`;
const SOURCE_PROGRAM = 'Computer Science Major, Bachelor of Science (B.S.)';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2026-2027';
const COMPOSITION_ARTIFACT = 'server/.va-catalogs/composed/virginia-state-university.json';

// The first tuple is the current checked-in source.  The second is the
// protected, human-verified operational source: its GE mathematics carrier
// predates the exact 6-8 credit range and stores max=6.  Both use the same six
// official pages; the bundle/tree pairing below prevents mixing their bytes.
const SOURCE_BUNDLE_SHA256 = '7dc03dd0f3739e2bad2b6695e519d3486e97cf4f6f478babccdf5a22986bd16d';
const PROTECTED_SOURCE_BUNDLE_SHA256 = '8798bbd35187e6ea5437a34370fbbbff0bd7e3174117f3acbb78cf85fb04bde6';
const SOURCE_BUNDLE_SHA256S = Object.freeze([
  SOURCE_BUNDLE_SHA256,
  PROTECTED_SOURCE_BUNDLE_SHA256,
]);

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    url: 'https://catalog.vsu.edu/undergraduate/college-engineering-technology/department-engineering-computer-science/computer-science-major-bs/',
    sha256: 'a3b7b3e40240ae0a78a1c8ad07d1c965524a11a0e2dd65293f653dcd47128ec8',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    url: 'https://catalog.vsu.edu/undergraduate/general-education-programs/',
    sha256: '02d2e2935e9a20f1674f5998d76222bcd87e3e63caba167d2356f80e4fa78a39',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    url: 'https://catalog.vsu.edu/undergraduate/college-engineering-technology/department-computer-science/',
    sha256: '5336696ee31b33102cfcc1c3f334eb23450aea6cf83ba15cf6b76f4425dbca34',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    url: 'https://catalog.vsu.edu/undergraduate/university/policy-statements/',
    sha256: '8231eec2870bed927cd7eff20b190aa1f2bdd8b3977b478d665caf555b7851ee',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    url: 'https://catalog.vsu.edu/undergraduate/academic-regulations-procedures/',
    sha256: '8505c4af65f4890eab611f542c5ef39e2ef50ce4e616da8cc2f02c8e64912cdb',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    url: 'https://catalog.vsu.edu/undergraduate/courses/csci/',
    sha256: '7c5ec8b6c5f35f8abf15d7d3e641f1c7023db2ac1f9d7cacf5dc0d3f5cad7214',
  }),
]);

// Filled after composition -> accepted source -> canonical numeric projection
// parity is measured.  The protected hash differs only in the reviewed
// mathematics max carrier and is paired to its own source-bundle receipt.
const PROOF_TREE_SHA256 = '5a908ee98414c13aff6bbdf7f05340b7f9e2892851ec60ec89f030f848f15800';
const PROTECTED_PROOF_TREE_SHA256 = '561dfb5e51fca62c972495067efd4dc256db4efecb135f7d89db278cc7a63562';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const RULE_PATHS = Object.freeze({
  variable_credit_category: Object.freeze({
    path: 'requirement_groups[1]', figures: Object.freeze(['6']),
  }),
  credit_based_variable_science_and_lab_selection: Object.freeze({
    path: 'requirement_groups[6]', figures: Object.freeze(['6']),
  }),
  credit_based_pool_with_unpublished_submenu_distribution: Object.freeze({
    path: 'requirement_groups[13]', figures: Object.freeze(['1', '6']),
  }),
  no_double_count_with_fixed_requirements_or_ge_areas: Object.freeze({
    path: 'requirement_groups[13]', figures: Object.freeze(['1', '6']),
  }),
  general_education_single_area_and_major_overlap: Object.freeze({
    path: 'requirement_groups[15]', figures: Object.freeze(['6']),
  }),
});

const QUALITY_FLAG_PATHS = Object.freeze({
  restricted_elective_distribution_not_published: Object.freeze({
    index: 0, figures: Object.freeze(['1', '6']),
  }),
  general_education_cross_layer_overlap: Object.freeze({
    index: 1, figures: Object.freeze(['6']),
  }),
  general_education_science_variable_credit: Object.freeze({
    index: 2, figures: Object.freeze(['6']),
  }),
  major_subject_course_grade_requirement: Object.freeze({
    index: 3, figures: Object.freeze(['3', '4']),
  }),
});

const MINIMUM_CREDIT_RULE = Object.freeze({
  kind: 'minimum_credit_selection',
  path: 'requirement_groups[5]',
});

const EXPECTED_GROUP_UNITS = Object.freeze([
  6, 3, 3, 3, 3, 6, 4, 3, 2, 19, 35, 14, 6, 13, 0, 0,
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

function normalizedReceiver(receiver, document) {
  const body = receiverBody(receiver);
  const codes = receiverCodes(receiver);
  return {
    kind: text(body.kind)?.toLowerCase() || null,
    codes,
    units: number(body.units),
    // Display-title normalization is intentionally outside this proof. The
    // canonical projection strips parenthetical display suffixes, while the
    // paper readers use the exact code, units, receiver kind, and numeric id.
    // Do not turn prose into an executable course-identity whitelist.
    name: text(body.name),
    conjunction: text(body.conjunction)?.toLowerCase()
      || (text(body.kind)?.toLowerCase() === 'series' ? 'and' : null),
    tier: text(receiver?.tier),
    level: text(receiver?.course_level),
    cc: receiver?.cc_articulable ?? null,
    note: text(receiver?.note ?? body.note),
    overlap: text(receiver?.overlap_key),
    ge_areas: [...array(receiver?.ge_areas)],
    assume: receiver?.assume_satisfiable === true,
  };
}

function normalizedSection(section, group, document) {
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
    receivers: array(section?.receivers).map((receiver) => (
      normalizedReceiver(receiver, document)
    )),
  };
}

function normalizedGroup(group, document) {
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
    sections: array(group?.sections).map((section) => (
      normalizedSection(section, group, document)
    )),
  };
}

function canonicalProgram(value) {
  return text(value) === FINAL_PROGRAM ? SOURCE_PROGRAM : text(value);
}

function normalizedVirginiaStateProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    program: canonicalProgram(document?.program),
    award: text(document?.award ?? document?.degree_variant),
    total_units: number(document?.total_units),
    total_units_max: number(document?.total_units_max),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: [...array(document?.modeling_notes)],
    data_quality_flags: [...array(document?.data_quality_flags)],
    groups: array(document?.requirement_groups).map((group) => (
      normalizedGroup(group, document)
    )),
  };
}

function virginiaStateProofTreeFingerprint(document) {
  return hash(normalizedVirginiaStateProofTree(document));
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
    && text(document?.program) === FINAL_PROGRAM
    && text(document?.source_program) === SOURCE_PROGRAM;
  return [composition, source, projection].filter(Boolean).length === 1
    ? (composition ? 'composition' : source ? 'accepted_source' : 'final_projection')
    : null;
}

function claimsVirginiaState(document) {
  const identityValues = [
    document?.slug,
    document?._id,
    document?.va_requirement_id,
    document?.institution_id,
    document?.school_id,
    document?.school,
  ].map((value) => String(value ?? '').trim()).filter(Boolean);
  return identityValues.some((value) => [
    SLUG,
    SOURCE_DEGREE_ID,
    SOURCE_INSTITUTION_ID,
    FINAL_DEGREE_ID,
    FINAL_INSTITUTION_ID,
    String(SCHOOL_ID),
    SCHOOL,
  ].includes(value))
    || SOURCE_BUNDLE_SHA256S.includes(document?.provenance?.source_bundle_hash)
    || array(document?.sources).some((source) => (
      source?.id === 'major' && source?.sha256 === SOURCE_RECEIPTS[0].sha256
    ));
}

function sourceBundleIssue(document, style) {
  if (style === 'composition') {
    const actual = array(document?.source_bundle_required);
    const expected = SOURCE_RECEIPTS.map((row) => row.id);
    return actual.length === expected.length
      && actual.every((id, index) => id === expected[index])
      ? null : 'the composed Virginia State source-bundle role inventory changed';
  }
  if (!SOURCE_BUNDLE_SHA256S.includes(document?.provenance?.source_bundle_hash)
      || document?.provenance?.composition_artifact !== COMPOSITION_ARTIFACT) {
    return 'the retained Virginia State source-bundle receipt changed';
  }
  const sources = array(document?.sources);
  if (sources.length !== SOURCE_RECEIPTS.length
      || sources.some((source, index) => {
        const expected = SOURCE_RECEIPTS[index];
        return source?.id !== expected.id
          || source?.role !== expected.role
          || source?.kind !== expected.kind
          || source?.url !== expected.url
          || source?.sha256 !== expected.sha256
          || source?.official !== true
          || source?.secure !== true;
      })) return 'the retained official Virginia State source roles, URLs, or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactProjectedCourseIds(document) {
  for (const group of array(document?.requirement_groups)) {
    for (const section of array(group?.sections)) {
      for (const receiver of array(section?.receivers)) {
        const body = receiverBody(receiver);
        const kind = text(body?.kind)?.toLowerCase();
        if (!['course', 'series'].includes(kind)) continue;
        const expected = receiverCodes(receiver)
          .map((code) => receivingCourseIdForDocument(document, code));
        const actual = kind === 'series' ? array(body?.parent_ids) : [body?.parent_id];
        if (!expected.length || actual.length !== expected.length
            || actual.some((id, index) => Number(id) !== expected[index])) return false;
      }
    }
  }
  return true;
}

function expectedProofTreeHash(document, style) {
  if (style === 'composition') return PROOF_TREE_SHA256;
  return document?.provenance?.source_bundle_hash === PROTECTED_SOURCE_BUNDLE_SHA256
    ? PROTECTED_PROOF_TREE_SHA256 : PROOF_TREE_SHA256;
}

function exactVirginiaStateTree(document) {
  const style = documentStyle(document);
  if (!style) {
    return fail('document identity is not an exact Virginia State composition/source/projection tuple');
  }
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the Virginia State catalog year or degree total changed');
  }
  if (style === 'final_projection' && !usesCanonicalSourceContract(document)) {
    return fail('the Virginia State numeric projection lacks the exact canonical source contract');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = virginiaStateProofTreeFingerprint(document);
  if (fingerprint !== expectedProofTreeHash(document, style)) {
    return fail('the reviewed Virginia State source tree, source refs, constraints, flags, or accounting declarations changed');
  }
  if (style !== 'composition' && !exactProjectedCourseIds(document)) {
    return fail('one or more projected Virginia State course identities changed');
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed Virginia State 2026-2027 tree and six-role official source receipt match',
    proof: {
      document_style: style,
      proof_tree_sha256: fingerprint,
      source_bundle_sha256: style === 'composition'
        ? null : document.provenance.source_bundle_hash,
      official_source_sha256: Object.fromEntries(
        SOURCE_RECEIPTS.map(({ id, sha256 }) => [id, sha256]),
      ),
    },
  };
}

function sectionUnits(section) {
  return number(section?.unit_advisement ?? section?.units);
}

function groupUnitCapacity(group) {
  const sections = array(group?.sections);
  const conjunction = text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and';
  const units = sections.map(sectionUnits);
  if (units.some((value) => value == null)) return null;
  return conjunction === 'or' ? Math.min(...units) : units.reduce((sum, value) => sum + value, 0);
}

function virginiaStateFigure34AggregateProof(document) {
  const exact = exactVirginiaStateTree(document);
  if (!exact.supported) return exact;
  const groups = array(document?.requirement_groups);
  const actualGroupUnits = groups.map(groupUnitCapacity);
  const audit = document?.unit_audit || {};
  const math = groups[5]?.sections?.[0];
  const mathMax = number(math?.unit_advisement_max ?? math?.units_max ?? sectionUnits(math));
  if (groups.length !== EXPECTED_GROUP_UNITS.length
      || JSON.stringify(actualGroupUnits) !== JSON.stringify(EXPECTED_GROUP_UNITS)
      || EXPECTED_GROUP_UNITS.reduce((sum, value) => sum + value, 0) !== 120
      || ![6, 8].includes(mathMax)
      || number(audit.graduation_minimum) !== 120
      || number(audit.modeled_units) !== 120
      || number(audit.general_education_units) !== 33
      || number(audit.core_requirement_units) !== 54
      || number(audit.required_course_units) !== 14
      || number(audit.unrestricted_elective_units) !== 6
      || number(audit.restricted_elective_units) !== 13) {
    return fail('the exact Virginia State aggregate Figure 3/4 carriers no longer close at 120 credits');
  }
  return {
    ...exact,
    reason: 'the official summary and exact canonical tree agree on every fixed Figure 3/4 credit carrier',
    proof: {
      ...exact.proof,
      group_units: [...actualGroupUnits],
      general_education_units: 33,
      core_requirement_units: 54,
      required_course_units: 14,
      unrestricted_elective_units: 6,
      restricted_elective_units: 13,
      modeled_units: 120,
      mathematics_credit_range: [6, mathMax],
    },
  };
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}) {
  const expected = RULE_PATHS[kind];
  if (!expected || path !== expected.path) {
    return `the ${kind} declaration moved from its reviewed source path`;
  }
  const index = Number(path.match(/^requirement_groups\[(\d+)]$/)?.[1]);
  const group = document?.requirement_groups?.[index];
  if (!Number.isInteger(index) || group !== container) {
    return `the ${kind} scope did not receive its exact source container`;
  }
  const declarations = array(group?.analysis_constraints)
    .filter((entry) => entry?.kind === kind);
  if (declarations.length !== 1 || declarations[0] !== constraint) {
    return `the ${kind} declaration is absent, duplicated, or detached from its container`;
  }
  return null;
}

function exactRuleAttachment(kind, expectedPath, container, {
  document, path, constraint,
} = {}) {
  if (path !== expectedPath) {
    return `the ${kind} declaration moved from its reviewed source path`;
  }
  const index = Number(path.match(/^requirement_groups\[(\d+)]$/)?.[1]);
  const group = document?.requirement_groups?.[index];
  if (!Number.isInteger(index) || group !== container) {
    return `the ${kind} evaluator did not receive its exact source container`;
  }
  const declarations = array(group?.analysis_constraints)
    .filter((entry) => entry?.kind === kind);
  if (declarations.length !== 1 || declarations[0] !== constraint) {
    return `the ${kind} declaration is absent, duplicated, or detached from its container`;
  }
  return null;
}

function exactVirginiaStateMinimumCreditCarrier(document) {
  const style = documentStyle(document);
  if (!style || !claimsVirginiaState(document)) {
    return fail('document identity is not the reviewed Virginia State minimum-credit tuple');
  }
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120
      || (style === 'final_projection' && !usesCanonicalSourceContract(document))) {
    return fail('the Virginia State minimum-credit wrapper or canonical contract changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const group = document?.requirement_groups?.[5];
  const sections = array(group?.sections);
  const section = sections[0];
  const receivers = array(section?.receivers);
  const codes = receivers.map((receiver) => receiverCodes(receiver));
  const units = receivers.map((receiver) => number(receiverBody(receiver)?.units));
  const expectedCodes = [
    'MATH112', 'MATH113', 'MATH120', 'MATH121', 'MATH122', 'MATH130',
    'MATH131', 'MATH150', 'MATH260', 'MATH261', 'PHIL220', 'STAT210',
  ];
  const expectedUnits = [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3];
  const storedCeiling = number(
    section?.unit_advisement_max ?? section?.units_max ?? sectionUnits(section),
  );
  const expectedCeiling = style === 'composition'
    || document?.provenance?.source_bundle_hash === SOURCE_BUNDLE_SHA256 ? 8 : 6;
  const constraints = array(group?.analysis_constraints);
  const localShape = {
    layer: text(group?.requirement_layer),
    tier: text(group?.tier),
    level: text(group?.course_level),
    cc: group?.cc_articulable ?? null,
    conjunction: text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and',
    refs: [...array(group?.source_refs)],
    stated: text(group?.stated_credits),
    ask: number(section?.section_advisement ?? section?.select),
    units: sectionUnits(section),
    max: storedCeiling,
    effective_tier: text(effective(section, group, 'tier')),
    effective_level: text(effective(section, group, 'course_level')),
    effective_cc: effective(section, group, 'cc_articulable'),
    section_refs: array(section?.source_refs).length
      ? [...section.source_refs] : [...array(group?.source_refs)],
    section_constraints: array(section?.analysis_constraints).map((constraint) => ({
      kind: text(constraint?.kind), status: text(constraint?.status),
    })),
    codes: codes.flat(),
    receiver_units: units,
    constraint: constraints.map((constraint) => ({
      kind: text(constraint?.kind), status: text(constraint?.status),
    })),
  };
  if (sections.length !== 1
      || localShape.layer !== 'general_education'
      || localShape.tier !== 'breadth'
      || localShape.level !== 'lower_division'
      || localShape.cc !== true
      || localShape.conjunction !== 'and'
      || JSON.stringify(localShape.refs) !== JSON.stringify(['major', 'general_education'])
      || localShape.stated !== '6'
      || localShape.ask !== 2
      || localShape.units !== 6
      || localShape.max !== expectedCeiling
      || localShape.effective_tier !== 'breadth'
      || localShape.effective_level !== 'lower_division'
      || localShape.effective_cc !== true
      || JSON.stringify(localShape.section_refs)
        !== JSON.stringify(['major', 'general_education'])
      || localShape.section_constraints.length !== 0
      || codes.some((value) => value.length !== 1)
      || receivers.some((receiver) => (
        text(receiverBody(receiver)?.kind)?.toLowerCase() !== 'course'
      ))
      || JSON.stringify(localShape.codes) !== JSON.stringify(expectedCodes)
      || JSON.stringify(units) !== JSON.stringify(expectedUnits)
      || constraints.length !== 1
      || constraints[0]?.kind !== MINIMUM_CREDIT_RULE.kind
      || constraints[0]?.status !== 'evaluator_not_implemented') {
    return fail('the exact VSU source-bound mathematics carrier changed');
  }
  if (style !== 'composition') {
    for (const [index, receiver] of receivers.entries()) {
      const body = receiverBody(receiver);
      if (text(body?.kind)?.toLowerCase() !== 'course'
          || Number(body?.parent_id)
            !== receivingCourseIdForDocument(document, expectedCodes[index])) {
        return fail('one or more projected VSU mathematics identities changed');
      }
    }
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the exact VSU mathematics carrier and official source tuple match',
    proof: {
      document_style: style,
      source_bundle_sha256: style === 'composition'
        ? null : document.provenance.source_bundle_hash,
      carrier_sha256: hash(localShape),
      official_source_sha256: {
        major: SOURCE_RECEIPTS[0].sha256,
        general_education: SOURCE_RECEIPTS[1].sha256,
      },
    },
  };
}

/**
 * Source-bound evaluation of VSU's GE mathematics minimum.
 *
 * The protected operational tree predates `unit_advisement_max` range
 * preservation and stores a six-credit ceiling.  The same exact tree still
 * retains all three four-credit choices, while the current official GE page
 * requires six credits.  The shared readers already use the two-course ask
 * and six-credit requirement capacity; they do not discard legal choices
 * based on the stale display ceiling.  This proof therefore supersedes only
 * that legacy evaluator receipt and never rewrites the verified source.
 */
function evaluateVirginiaStateConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (kind !== MINIMUM_CREDIT_RULE.kind || !claimsVirginiaState(context.document)) {
    return null;
  }
  const exact = exactVirginiaStateMinimumCreditCarrier(context.document);
  if (!exact.supported) return exact;
  const attachmentIssue = exactRuleAttachment(
    kind, MINIMUM_CREDIT_RULE.path, container, context,
  );
  if (attachmentIssue) return fail(attachmentIssue);
  const sections = array(container?.sections);
  const section = sections[0];
  const receivers = array(section?.receivers);
  const units = receivers.map((receiver) => number(receiverBody(receiver)?.units));
  const ask = number(section?.section_advisement ?? section?.select);
  const minimum = [...units].sort((left, right) => left - right)
    .slice(0, ask).reduce((sum, value) => sum + value, 0);
  const maximum = [...units].sort((left, right) => right - left)
    .slice(0, ask).reduce((sum, value) => sum + value, 0);
  const storedCeiling = number(
    section?.unit_advisement_max ?? section?.units_max ?? sectionUnits(section),
  );
  if (sections.length !== 1
      || ask !== 2
      || sectionUnits(section) !== 6
      || receivers.length !== 12
      || units.some((value) => ![3, 4].includes(value))
      || units.filter((value) => value === 3).length !== 9
      || units.filter((value) => value === 4).length !== 3
      || minimum !== 6
      || maximum !== 8
      || ![6, 8].includes(storedCeiling)) {
    return fail('the exact VSU two-course, six-credit mathematics carrier changed');
  }
  return {
    ...exact,
    reason: 'the official GE rule requires six credits from two choices; the exact roster supplies 6-8 credits and every shared reader retains the two-choice/six-credit paper capacity',
    proof: {
      ...exact.proof,
      rule_path: MINIMUM_CREDIT_RULE.path,
      ask,
      required_capacity_units: 6,
      minimum_receiver_sum: minimum,
      maximum_receiver_sum: maximum,
      stored_ceiling_units: storedCeiling,
      protected_legacy_ceiling_superseded: storedCeiling === 6,
      figure_reader_contract: {
        figure_1: 'two named-course observations',
        figures_3_4: 'six-credit requirement capacity',
        figure_6: 'two selected course identities',
      },
    },
  };
}

function virginiaStateSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  const scoped = RULE_PATHS[kind];
  if (!scoped) return null;
  const aggregate = virginiaStateFigure34AggregateProof(context.document);
  if (!aggregate.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  })) return null;
  // GE is excluded from Figure 1.  Its variable-credit and science-choice
  // formulas therefore remain only Figure 6 graph blockers.  The restricted
  // major pool can change Figure 1's choose-N named-course observations, and
  // every open identity/overlap rule can change the Figure 6 graph.  None can
  // move Figure 3/4's exact fixed aggregate carrier. Grade rules are scoped
  // only by the separate exact student-performance proof; this evaluator does
  // not resolve transfer-credit application discretion.
  return [...scoped.figures];
}

function virginiaStateQualityFlagAffectedFigures(flag, document) {
  const code = text(flag?.code);
  const scoped = QUALITY_FLAG_PATHS[code];
  if (!scoped) return null;
  const aggregate = virginiaStateFigure34AggregateProof(document);
  if (!aggregate.supported) return null;
  const actual = document?.data_quality_flags?.[scoped.index];
  const matches = array(document?.data_quality_flags).filter((row) => row?.code === code);
  if (actual !== flag || matches.length !== 1) return null;
  if (code === 'major_subject_course_grade_requirement') {
    const gradeGroup = document?.requirement_groups?.[14];
    const gradeRules = array(gradeGroup?.analysis_constraints).filter((rule) => (
      text(rule?.kind) === 'minimum_course_grade_by_subject'
    ));
    if (gradeRules.length !== 1
        || text(gradeRules[0]?.status) !== 'evaluator_not_implemented'
        || text(gradeGroup?.requirement_layer) !== 'major'
        || text(gradeGroup?.tier) !== 'nontransferable'
        || text(gradeGroup?.course_level) !== 'nonunit_policy'
        || gradeGroup?.cc_articulable !== false
        || JSON.stringify(array(gradeGroup?.source_refs))
          !== JSON.stringify(['major', 'college'])
        || array(gradeGroup?.sections).length !== 1
        || sectionUnits(gradeGroup.sections[0]) !== 0) return null;
    return [];
  }
  return [...scoped.figures];
}

module.exports = {
  EXPECTED_GROUP_UNITS,
  PROOF_TREE_SHA256,
  PROTECTED_PROOF_TREE_SHA256,
  PROTECTED_SOURCE_BUNDLE_SHA256,
  QUALITY_FLAG_PATHS,
  RULE_PATHS,
  SOURCE_BUNDLE_SHA256,
  SOURCE_BUNDLE_SHA256S,
  SOURCE_RECEIPTS,
  evaluateVirginiaStateConstraint,
  exactVirginiaStateTree,
  normalizedVirginiaStateProofTree,
  virginiaStateFigure34AggregateProof,
  virginiaStateProofTreeFingerprint,
  virginiaStateQualityFlagAffectedFigures,
  virginiaStateSourceSpecificAffectedFigures,
};
