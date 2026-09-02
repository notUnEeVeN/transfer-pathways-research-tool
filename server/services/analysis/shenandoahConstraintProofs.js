/**
 * Exact Figure 3/4-only proofs for Shenandoah University's 2025-2026
 * Computer Science B.S.
 *
 * This module does not close Shenandoah's open course identities or ShenEd
 * allocation rules for general degree analysis.  It proves only that those
 * unresolved facts cannot move Figures 3/4 for the paper's exact nineteen
 * Virginia A.S. senders.  Every claim is bound to the complete bachelor tree,
 * retained official source receipts, and the complete projected sender tree.
 */

const { createHash } = require('node:crypto');
const { receivingCourseIdForDocument } = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const {
  VCCS_SENDER_RECEIPTS,
} = require('./uvaWiseTransferPolicyEvidence');

const SLUG = 'shenandoah-university';
const SCHOOL = 'Shenandoah University';
const SCHOOL_ID = 9224;
const SOURCE_DEGREE_ID = `va:degree:${SLUG}:cs`;
const SOURCE_INSTITUTION_ID = `va:uni:${SLUG}`;
const FINAL_DEGREE_ID = `degree:${SCHOOL_ID}:va-cs`;
const FINAL_INSTITUTION_ID = `va:uni:${SCHOOL_ID}`;
const SOURCE_PROGRAM = 'Computer Science (B.S.)';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2025-2026';
const SOURCE_BUNDLE_SHA256 = '0d156af2b4800bfe3fcf98f75964623b3d020d458bf5956f849055934fb5e1aa';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: '9fa49f2a3bad0878d7882d19eee87392b8b026b0328b902abe4c1182ba7074dc',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: 'ab924b19e7fcd05720480d5c84864ec8f1cb3a2b8dd40f92d0c709ca0ba823bb',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: 'f7a7ee206c03ef5c866d6ff7dd9bc19dd41a93c67e8703b753ea24406642e8a3',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: 'ab924b19e7fcd05720480d5c84864ec8f1cb3a2b8dd40f92d0c709ca0ba823bb',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: '34b56d9b32d1ad215fb8eeef643bb50f0dd22734886c8b8379cc7a68751abb8e',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: 'ad2d692656519c8cfd4ebbd1f3f52c1d21949cd708db21244204eb80dace4aee',
  }),
]);

// Filled after composition -> accepted source -> final numeric projection
// parity is established. Wrapper ids and one registry note are handled by
// exact style checks; every authored group, rule, flag, source ref, and unit
// declaration remains inside this fingerprint.
const PROOF_TREE_SHA256 = '4755e5bfa29fb47e40045f0bbbf8578494415475352a5c252d8ee9ac17ab392d';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const FIGURE_34 = Object.freeze(['3', '4']);
const UNRESOLVED_FIGURES = Object.freeze(['1', '6']);
const SHENANDOAH_CAPACITY_GROUP_INDEX = 9;
const SHENANDOAH_GENERAL_EDUCATION_DOMAIN_UNITS = 30;
const SHENANDOAH_ELECTIVE_CAPACITY_UNITS = 35;
const REGISTRY_NOTE = "Acalog catoid 33 is the current 2025-2026 undergraduate catalog. The program's categorical requirements precede a separately labeled Course Map that must not be imported.";
const PROOF_TITLE_CODES = Object.freeze([
  'CSC121', 'CSC122', 'CSC210', 'CSC301', 'CSC310', 'CSC403', 'CSC407',
  'CSC410', 'CSC430', 'CSC480', 'ENG101', 'FYS101', 'MATH201', 'MATH202',
  'MATH209', 'MATH370',
]);

const SCOPED_RULE_PATHS = Object.freeze({
  'requirement_groups[1]': Object.freeze({
    kind: 'open_subject_level_credit_menu', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[2]': Object.freeze({
    kind: 'open_subject_level_credit_menu', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[3]': Object.freeze({
    kind: 'conditional_transfer_fys_replacement', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[4]': Object.freeze({
    kind: 'sphere_region_credit_ranges', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[5]': Object.freeze({
    kind: 'sphere_region_credit_ranges', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[6]': Object.freeze({
    kind: 'sphere_region_credit_ranges', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[7]': Object.freeze({
    kind: 'sphere_region_credit_ranges', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[8]': Object.freeze({
    kinds: Object.freeze([
      'shened_total_across_ranged_spheres',
      'major_discipline_substitution_limit',
      'conditional_associate_degree_domain_fulfillment',
    ]),
    figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[9]': Object.freeze({
    kind: 'capacity_contains_conditional_shened_gates', figures: UNRESOLVED_FIGURES,
  }),
  'requirement_groups[10]': Object.freeze({
    kind: 'articulation_agreement_residency_treatment', figures: Object.freeze([]),
  }),
});

const QUALITY_FLAG_CODES = Object.freeze([
  'shened_range_allocation_and_overlap',
  'conditional_transfer_shened_treatment',
  'open_major_elective_subject_filters',
]);

const RICHARD_BLAND_RECEIPT = Object.freeze({
  slug: 'richard-bland-college',
  numeric_id: 9317,
  name: 'Richard Bland College',
  source_id: 'va:as:richard-bland-college:cs',
  projection_id: 'as_degree:9317:va-cs:local_as',
  projection_college_id: 'va:cc:9317',
  source_bundle_sha256: 'eaae55d519535782ad80339e3365627a7855dededae58b8326bf643478d94186',
  pair_tree_sha256: 'bc93bd46f2df462d3da58d7d5776ee0142b674ecb1f9ab61047fc434b363bd23',
  protected_source_bundle_sha256: '9511b3b5844ffdac140358812ee5c0a5074960b4544a53d12c5af3772ade1c79',
  protected_pair_tree_sha256: 'dac11e4ed2ddeb3b4c003098c0fbb23088c8006220fc78633e2f7972d01d6a3f',
});

const SHENANDOAH_SENDER_RECEIPTS = Object.freeze([
  ...VCCS_SENDER_RECEIPTS.map((receipt) => Object.freeze({
    slug: receipt.slug,
    numeric_id: receipt.numeric_id,
    name: receipt.name,
    source_id: receipt.source_id,
    projection_id: receipt.projection_id,
    projection_college_id: receipt.projection_college_id,
    source_bundle_sha256: receipt.source_bundle_sha256,
    pair_tree_sha256: receipt.pair_tree_sha256,
    protected_source_bundle_sha256: receipt.protected_source_bundle_sha256,
    protected_pair_tree_sha256: receipt.protected_pair_tree_sha256,
  })),
  RICHARD_BLAND_RECEIPT,
].sort((left, right) => left.numeric_id - right.numeric_id));

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

// Keep the projection fingerprint identical to the already reviewed sender
// receipts while owning the Shenandoah proof boundary locally. Verification
// and display-only wrapper fields are intentionally outside this hash; the
// publication gate continues to enforce them independently.
function shenandoahSenderTreeFingerprint(document) {
  return hash({
    catalog_year: document?.catalog_year || null,
    total_units: document?.total_units ?? null,
    total_units_max: document?.total_units_max ?? null,
    degree_type: document?.degree_type || null,
    source_degree_type: document?.source_degree_type || null,
    state: document?.state || null,
    provenance: { source_bundle_hash: document?.provenance?.source_bundle_hash || null },
    analysis_contract: document?.analysis_contract || null,
    unit_audit: document?.unit_audit || null,
    data_quality_flags: document?.data_quality_flags || [],
    requirement_groups: document?.requirement_groups || [],
  });
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

function normalizedShenandoahProofTree(document) {
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

function shenandoahProofTreeFingerprint(document) {
  return hash(normalizedShenandoahProofTree(document));
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
      ? null : 'the composed Shenandoah source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== `server/.va-catalogs/composed/${SLUG}.json`) {
    return 'the retained Shenandoah source-bundle receipt changed';
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
      })) return 'the retained official Shenandoah source roles or text hashes changed';
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

function sectionUnits(section) {
  return number(section?.unit_advisement ?? section?.units);
}

function exactRequirementSection(section, { name, units }) {
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  return number(section?.section_advisement ?? section?.select) === 1
    && sectionUnits(section) === units
    && number(section?.unit_advisement_max ?? section?.units_max ?? units) === units
    && receivers.length === 1
    && text(body?.kind)?.toLowerCase() === 'requirement'
    && text(body?.name) === name
    && number(body?.units) === units;
}

function accountingProof(document) {
  const groups = array(document?.requirement_groups);
  const audit = document?.unit_audit || {};
  const math = groups[1];
  const computing = groups[2];
  const capacity = groups[SHENANDOAH_CAPACITY_GROUP_INDEX];
  const capacitySection = capacity?.sections?.[0];
  const capacityReceiver = receiverBody(capacitySection?.receivers?.[0]);
  const academicUnitCoreAppeared = audit.academic_unit_core_units != null
    || audit.academic_unit_core_units_minimum != null
    || audit.college_core_units != null
    || groups.some((group) => /academic\s*unit\s*core|division\s*core/i.test(
      `${group?.requirement_layer || ''} ${group?.title || ''}`,
    ));
  if (groups.length !== 11
      || number(audit.major_units) !== 55
      || number(audit.general_education_units_minimum) !== 30
      || number(audit.general_education_and_elective_capacity_units) !== 65
      || number(audit.graduation_minimum) !== 120
      || number(audit.modeled_units) !== 120
      || academicUnitCoreAppeared
      || text(math?.requirement_layer) !== 'major'
      || text(math?.tier) !== 'nontransferable'
      || math?.cc_articulable !== false
      || array(math?.sections).length !== 2
      || !exactRequirementSection(math.sections[0], {
        name: 'At least three MATH credits at the 300 level or above', units: 3,
      })
      || !exactRequirementSection(math.sections[1], {
        name: 'Three additional MATH credits at the 200 level or above', units: 3,
      })
      || text(computing?.requirement_layer) !== 'major'
      || text(computing?.tier) !== 'nontransferable'
      || computing?.cc_articulable !== false
      || array(computing?.sections).length !== 1
      || !exactRequirementSection(computing.sections[0], {
        name: 'Six CSC or DATA credits at the 300 level or above', units: 6,
      })
      || text(capacity?.requirement_layer) !== 'ge_college'
      || text(capacity?.tier) !== 'breadth'
      || capacity?.cc_articulable !== true
      || array(capacity?.sections).length !== 1
      || sectionUnits(capacitySection) !== 65
      || array(capacitySection?.receivers).length !== 1
      || text(capacityReceiver?.kind)?.toLowerCase() !== 'ge_area'
      || receiverCodes(capacitySection.receivers[0])[0] !== 'SU-SHENED-ELECTIVE-CAPACITY'
      || number(capacityReceiver?.units) !== 65) {
    return fail('the exact 55-major + 30-domain + 35-elective accounting, fixed nontransferable menus, or no-unit-core witness changed');
  }
  return {
    degree_units: 120,
    major_units: 55,
    fixed_nontransferable_math_menu_units: 6,
    fixed_nontransferable_csc_data_menu_units: 6,
    university_general_education_domain_units: 30,
    unrestricted_elective_capacity_units: 35,
    academic_unit_core_units: 0,
    academic_unit_core_published: false,
    capacity_group_path: `requirement_groups[${SHENANDOAH_CAPACITY_GROUP_INDEX}]`,
  };
}

function residencyProof(document) {
  const audit = document?.unit_audit || {};
  const residency = audit.residency || {};
  const policy = document?.requirement_groups?.[10];
  const constraint = array(policy?.analysis_constraints).find((entry) => (
    text(entry?.kind) === 'articulation_agreement_residency_treatment'
  ));
  if (text(residency?.status)?.toLowerCase() !== 'required'
      || number(residency?.minimum_units) !== 30
      || number(residency?.minimum_fraction) !== 0.25
      || JSON.stringify(array(residency?.source_refs)) !== JSON.stringify(['graduation'])
      || number(audit.transfer_credit_units_maximum) !== 90
      || number(audit.final_thirty_resident_units_minimum) !== 24
      || text(policy?.requirement_layer) !== 'university_graduation'
      || array(policy?.analysis_constraints).length !== 2
      || !constraint) {
    return fail('the exact 120-credit, 30-resident, transfer-cap, final-24-of-30, or articulation-exception policy changed');
  }
  return {
    degree_units: 120,
    residency_minimum_units: 30,
    transfer_credit_maximum_units: 90,
    final_window_units: 30,
    final_window_resident_minimum_units: 24,
    articulation_exception_rule_path:
      'requirement_groups[10].analysis_constraints[1]',
  };
}

function exactShenandoahTree(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact Shenandoah composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the Shenandoah catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = shenandoahProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed Shenandoah tree, refs, constraints, flags, course titles, or accounting declarations changed');
  }
  if (style !== 'composition' && !exactProjectedCourseIds(document)) {
    return fail('one or more projected Shenandoah course identities changed');
  }
  const accounting = accountingProof(document);
  if (accounting.supported === false) return accounting;
  const residency = residencyProof(document);
  if (residency.supported === false) return residency;
  return {
    supported: true,
    affected_figures: [],
    reason: 'the complete reviewed Shenandoah tree and six retained official source receipts match',
    proof: {
      institution_slug: SLUG,
      document_style: style,
      proof_tree_sha256: fingerprint,
      source_bundle_sha256: style === 'composition' ? null : SOURCE_BUNDLE_SHA256,
      source_receipts: SOURCE_RECEIPTS.map((row) => ({ ...row })),
      accounting,
      residency,
    },
  };
}

function ruleContainerMatches(value, { document, container, path } = {}) {
  const scoped = SCOPED_RULE_PATHS[path];
  const kinds = scoped?.kinds || (scoped?.kind ? [scoped.kind] : []);
  if (!scoped || !kinds.includes(text(value?.kind))) return false;
  const index = Number(path.match(/^requirement_groups\[(\d+)]$/)?.[1]);
  if (!Number.isInteger(index) || document?.requirement_groups?.[index] !== container) return false;
  const declarations = array(container?.analysis_constraints)
    .filter((entry) => text(entry?.kind) === text(value?.kind));
  return declarations.length === 1 && declarations[0] === value;
}

function shenandoahSourceSpecificAffectedFigures(value, context = {}) {
  const claimsShenandoah = documentStyle(context.document) != null;
  if (!claimsShenandoah) return null;
  const exact = exactShenandoahTree(context.document);
  if (!exact.supported || !ruleContainerMatches(value, context)) return null;
  return [...SCOPED_RULE_PATHS[context.path].figures];
}

function shenandoahQualityFlagAffectedFigures(flag, document) {
  const index = array(document?.data_quality_flags).indexOf(flag);
  if (index < 0 || QUALITY_FLAG_CODES[index] !== text(flag?.code)) return null;
  const exact = exactShenandoahTree(document);
  if (!exact.supported
      || text(flag?.severity)?.toLowerCase() !== 'block_analysis') return null;
  return [...UNRESOLVED_FIGURES];
}

function claimsShenandoah(document) {
  return [
    document?.slug, document?._id, document?.va_requirement_id,
    document?.institution_id, document?.school_id, document?.school,
  ].map((value) => String(value ?? '').trim()).some((value) => [
    SLUG, SOURCE_DEGREE_ID, SOURCE_INSTITUTION_ID, FINAL_DEGREE_ID,
    FINAL_INSTITUTION_ID, String(SCHOOL_ID), SCHOOL,
  ].includes(value));
}

function exactSenderProof(associateDocument) {
  const numericId = Number(associateDocument?.community_college_id);
  const receipt = SHENANDOAH_SENDER_RECEIPTS.find((row) => row.numeric_id === numericId);
  const sourceBundle = text(associateDocument?.provenance?.source_bundle_hash);
  const pairTree = shenandoahSenderTreeFingerprint(associateDocument);
  const tupleCohort = receipt && sourceBundle === receipt.protected_source_bundle_sha256
      && pairTree === receipt.protected_pair_tree_sha256
    ? 'protected_authoritative'
    : receipt && sourceBundle === receipt.source_bundle_sha256
      && pairTree === receipt.pair_tree_sha256 ? 'candidate' : null;
  const minimumUnits = number(associateDocument?.total_units);
  const maximumUnits = number(associateDocument?.total_units_max) ?? minimumUnits;
  if (!receipt
      || associateDocument?.kind !== 'as_degree'
      || text(associateDocument?.degree_type) !== 'local_as'
      || text(associateDocument?.source_degree_type)?.toUpperCase() !== 'AS'
      || text(associateDocument?.state)?.toLowerCase() !== 'va'
      || text(associateDocument?.status) !== 'found'
      || text(associateDocument?.va_requirement_status) !== 'extracted'
      || text(associateDocument?._id) !== receipt?.projection_id
      || text(associateDocument?.va_requirement_id) !== receipt?.source_id
      || text(associateDocument?.college_id) !== receipt?.projection_college_id
      || text(associateDocument?.college_name) !== receipt?.name
      || !usesCanonicalSourceContract(associateDocument)
      || !tupleCohort
      || minimumUnits == null || minimumUnits < 60 || minimumUnits > 63
      || maximumUnits == null || maximumUnits < minimumUnits || maximumUnits > 64) {
    return fail('the Shenandoah domain proof requires one exact member of the fixed nineteen-document Virginia A.S. projection/source/tree cohort', FIGURE_34);
  }
  return {
    supported: true,
    sender_slug: receipt.slug,
    sender_numeric_id: receipt.numeric_id,
    sender_name: receipt.name,
    sender_source_id: receipt.source_id,
    sender_projection_id: receipt.projection_id,
    sender_tree_sha256: pairTree,
    source_bundle_sha256: sourceBundle,
    projection_receipt_cohort: tupleCohort,
    qualifying_award: 'AS',
    published_units_minimum: minimumUnits,
    published_units_maximum: maximumUnits,
  };
}

function shenandoahFigure34PairProof(document, associateDocument) {
  if (!claimsShenandoah(document)) return { applicable: false, ready: false };
  const bachelor = exactShenandoahTree(document);
  if (!bachelor.supported) {
    return { applicable: true, ready: false, supported: false, reason: bachelor.reason };
  }
  const sender = exactSenderProof(associateDocument);
  if (!sender.supported) {
    return { applicable: true, ready: false, supported: false, reason: sender.reason };
  }
  const maximumIncomingUnits = sender.published_units_maximum;
  const minimumResidentUnits = 120 - maximumIncomingUnits;
  if (minimumResidentUnits < 30 || maximumIncomingUnits > 90) {
    return {
      applicable: true,
      ready: false,
      supported: false,
      reason: 'the exact sender no longer has an ordinary route satisfying Shenandoah residence without the articulation exception',
    };
  }
  return {
    applicable: true,
    ready: true,
    supported: true,
    qualifying_award: 'AS',
    university_general_education_domains_fulfilled: true,
    university_general_education_domain_units: SHENANDOAH_GENERAL_EDUCATION_DOMAIN_UNITS,
    academic_unit_core_published: false,
    academic_unit_core_units: 0,
    unrestricted_elective_capacity_units: SHENANDOAH_ELECTIVE_CAPACITY_UNITS,
    articulation_residency_exception_selected: false,
    ordinary_minimum_shenandoah_units: minimumResidentUnits,
    ordinary_final_resident_units: 30,
    reason: 'the exact A.S. fulfills Shenandoah university GE domains; the CS program publishes no academic-unit core, and the ordinary path satisfies residence without the articulation exception',
    proof: {
      bachelor_proof_tree_sha256: bachelor.proof.proof_tree_sha256,
      bachelor_source_bundle_sha256: bachelor.proof.source_bundle_sha256,
      sender_slug: sender.sender_slug,
      sender_numeric_id: sender.sender_numeric_id,
      sender_name: sender.sender_name,
      sender_source_id: sender.sender_source_id,
      sender_projection_id: sender.sender_projection_id,
      sender_tree_sha256: sender.sender_tree_sha256,
      sender_source_bundle_sha256: sender.source_bundle_sha256,
      sender_projection_receipt_cohort: sender.projection_receipt_cohort,
      sender_award: sender.qualifying_award,
      sender_published_units_minimum: sender.published_units_minimum,
      sender_published_units_maximum: sender.published_units_maximum,
      degree_units: 120,
      university_general_education_domain_units:
        SHENANDOAH_GENERAL_EDUCATION_DOMAIN_UNITS,
      unrestricted_elective_capacity_units: SHENANDOAH_ELECTIVE_CAPACITY_UNITS,
      academic_unit_core_units: 0,
      transfer_credit_maximum_units: 90,
      residency_minimum_units: 30,
      final_window_units: 30,
      final_window_resident_minimum_units: 24,
      ordinary_minimum_shenandoah_units: minimumResidentUnits,
      ordinary_final_resident_units: 30,
      articulation_residency_exception_selected: false,
    },
  };
}

/**
 * Add the pair proof to bachelor Figure 3/4 readiness without removing any
 * source, human-review, projection, or unrelated analysis blocker.
 */
function shenandoahFigure34Readiness(document, readiness, pairProof) {
  const base = readiness && typeof readiness === 'object' ? readiness : {};
  if (!claimsShenandoah(document)) return base;
  const capability = pairProof?.applicable === true
    && pairProof?.ready === true
    && pairProof?.proof?.bachelor_proof_tree_sha256 === PROOF_TREE_SHA256
    && pairProof?.proof?.sender_award === 'AS'
    && JSON.stringify(array(base.figures)) === JSON.stringify(FIGURE_34);
  const blockers = [...new Set([
    ...array(base.blockers),
    ...(capability ? [] : ['shenandoah_pair_credential_proof_required']),
  ])];
  const ready = blockers.length === 0;
  const label = text(base.label) || 'The bachelor-degree source';
  return {
    ...base,
    ready,
    blockers,
    warning: ready ? null
      : `${label} is not publication-ready for figures 3/4 (${blockers.join(', ')}).`,
    shenandoah_source_pair_figure_capability: capability,
    shenandoah_source_pair_figure_ready: capability && ready,
    shenandoah_source_pair_proof: capability ? pairProof.proof : null,
  };
}

module.exports = {
  FIGURE_34,
  PROOF_TREE_SHA256,
  QUALITY_FLAG_CODES,
  SHENANDOAH_CAPACITY_GROUP_INDEX,
  SHENANDOAH_ELECTIVE_CAPACITY_UNITS,
  SHENANDOAH_GENERAL_EDUCATION_DOMAIN_UNITS,
  SHENANDOAH_SENDER_RECEIPTS,
  SOURCE_BUNDLE_SHA256,
  SOURCE_RECEIPTS,
  exactShenandoahTree,
  normalizedShenandoahProofTree,
  shenandoahFigure34PairProof,
  shenandoahFigure34Readiness,
  shenandoahProofTreeFingerprint,
  shenandoahQualityFlagAffectedFigures,
  shenandoahSenderTreeFingerprint,
  shenandoahSourceSpecificAffectedFigures,
};
