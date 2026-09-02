/**
 * Exact paper-figure proof for Virginia Military Institute's variable-credit
 * CIS elective menu.
 *
 * The current Theory and Application tree says "six credits" and stores six
 * possible receivers. Five are three-credit courses; CIS 303L is one credit.
 * A generic choose-two walk can therefore admit a four-credit pair even
 * though the published six-credit obligation is unchanged. This proof binds
 * the exact official source bundle and exact authored carrier, removes only
 * the one-credit receiver from the eligible coverage roster, and supplies a
 * deterministic legal two-course route to Figure 6. It does not modify the
 * verified major tree or claim that CIS 303L itself is invalid coursework.
 */

const { createHash } = require('node:crypto');
const {
  courseIdFor,
  receivingCourseIdForDocument,
} = require('../virginia/courseIdentity');
const VMI_OPEN_RULE_EVIDENCE = require(
  '../../.va-catalogs/research/virginia-military-institute-open-rule-evidence.json'
);
const {
  ARTIFACT_SEMANTIC_SHA256: OPEN_RULE_EVIDENCE_SHA256,
  virginiaMilitaryInstituteOpenRuleEvidenceIssue,
} = require('./virginiaMilitaryInstituteOpenRuleEvidence');

const SLUG = 'virginia-military-institute';
const SCHOOL = 'Virginia Military Institute';
const SCHOOL_ID = 9235;
const SOURCE_DEGREE_ID = `va:degree:${SLUG}:cs`;
const SOURCE_INSTITUTION_ID = `va:uni:${SLUG}`;
const FINAL_DEGREE_ID = `degree:${SCHOOL_ID}:va-cs`;
const FINAL_INSTITUTION_ID = `va:uni:${SCHOOL_ID}`;
const SOURCE_PROGRAM = 'Computer Science, B.S. - Theory and Application Track';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2025-2026';
const SOURCE_BUNDLE_SHA256 = 'cf12fe2a0d7abd9e2a6593a9d45bb5eefc35d8691da1d5c63ae370248b08d89e';
const COMPOSITION_ARTIFACT = 'server/.va-catalogs/composed/virginia-military-institute.json';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    url: 'https://catalog.vmi.edu/preview_program.php?catoid=39&poid=2815&print=1',
    sha256: '87c7981ed376b431a5116bdbed48d5213e3bf476ac7ec5da3f4e3a3571fe2609',
  }),
  Object.freeze({
    id: 'program_cybersecurity', role: 'program_cybersecurity', kind: 'program_cybersecurity',
    url: 'https://catalog.vmi.edu/preview_program.php?catoid=39&poid=2816&returnto=1546',
    sha256: '5a98ade34154f2a2c48ffbd39918fae4164465b73912956d8bd0b2df4137795f',
  }),
  Object.freeze({
    id: 'program_information_technology', role: 'program_information_technology', kind: 'program_information_technology',
    url: 'https://catalog.vmi.edu/preview_program.php?catoid=39&poid=2817&returnto=1546',
    sha256: '6413a62c099fe1178f678b27d9caf612ec19485450ccdb0e7e534c3001234777',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    url: 'https://www.vmi.edu/academics/academic-program/',
    sha256: '189939a08a458e988916adbc5fe7ef3bd1f647b005cabe28cff2695c664c738d',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    url: 'https://www.vmi.edu/academics/academic-support-services/registrar/registration-enrollment/transfer-activity-after-matriculation/',
    sha256: 'ba0009fe257230d773537dc2578ebae35c71c4af5639222aa2208ecc23307d7e',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    url: 'https://www.vmi.edu/academics/academic-support-services/registrar/institutional-information/',
    sha256: '7c0f5c1d53b9cf0b4278d03ea3a3a5f5a0cbe24ca9b89781a169e0b81e7309db',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    url: 'https://catalog.vmi.edu/content.php?catoid=39&navoid=1548',
    sha256: '88a32ceba30aabc76b6a6389de0a52c5d9fde78b1a5634ad6f3bed4b10a02439',
  }),
]);

const OFFICIAL_RESPONSE_RECEIPTS = Object.freeze({
  program_html: Object.freeze({
    sha256: '095efb6560ade865e6a4534bc52f14e56dd32235b0462d4e3b0b827038744351',
    bytes: 153754,
  }),
  course_catalog_html: Object.freeze({
    sha256: '18460bba408b1b64e4de8fc8fa914ad2c73f78a983ba5abe50dc1a6dc11544a1',
    bytes: 85702,
  }),
});

const RULE_KIND = 'choose_six_credits_from_variable_credit_menu';
const RULE_PATH = 'requirement_groups[3]';
const ALL_RECEIVER_CODES = Object.freeze([
  'CIS211', 'CIS303', 'CIS303L', 'CIS342', 'CIS331', 'CIS377',
]);
const LEGAL_RECEIVER_INDICES = Object.freeze([0, 1, 3, 4, 5]);
const FIGURE_6_RECEIVER_INDICES = Object.freeze([0, 1]);

// Filled from normalizedCarrier() for the composition, accepted source, and
// final numeric projection. Derived display categories and wrapper ids are
// excluded; every authored field on the exact rule carrier is included.
const CARRIER_SHA256 = '031f657b040dfdd72d952faf9e4f5c6f32a387c14977f697550349428acf6e26';
// Exact normalized parity across the reviewed composition, accepted source,
// and final numeric projection for the complete Core carrier, mathematics
// carrier, free-elective carrier, and published unit audit.  This binds the
// MA 123/124 prerequisite supply used by both supplemental witnesses; a
// source-tree change cannot silently reuse the retained evidence.
const OPEN_RULE_CARRIER_SHA256 =
  'e0078e1bdf2f3d66d19135190aec87d43186e5aac0122d3930ae5cf89da8a7a5';
const OPEN_RULE_PATHS = Object.freeze({
  approved_math_elective_level_floor: 'requirement_groups[5]',
  core_overlay_inside_free_electives: 'requirement_groups[7]',
});

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

function normalizeConstraint(constraint) {
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
    constraints: array(section?.analysis_constraints).map(normalizeConstraint),
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
    constraints: array(group?.analysis_constraints).map(normalizeConstraint),
    sections: array(group?.sections).map((section) => normalizedSection(section, group)),
  };
}

function normalizedVmiOpenRuleCarrier(document) {
  return {
    catalog_year: text(document?.catalog_year),
    total_units: number(document?.total_units),
    unit_audit: document?.unit_audit || null,
    groups: [0, 5, 7].map((index) => normalizedGroup(
      document?.requirement_groups?.[index],
    )),
  };
}

function vmiOpenRuleCarrierFingerprint(document) {
  return hash(normalizedVmiOpenRuleCarrier(document));
}

function normalizedCarrier(group) {
  const section = array(group?.sections)[0] || null;
  return {
    title: text(group?.title),
    is_required: group?.is_required !== false,
    conjunction: text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and',
    layer: text(group?.requirement_layer),
    tier: text(group?.tier),
    level: text(group?.course_level),
    cc: group?.cc_articulable ?? null,
    refs: [...array(group?.source_refs)],
    stated: number(group?.stated_credits),
    note: text(group?.note),
    overlap: text(group?.overlap_key),
    distinct: group?.distinct_course_ids_across_sections === true,
    constraints: array(group?.analysis_constraints).map(normalizeConstraint),
    section_count: array(group?.sections).length,
    section: section ? {
      ask: number(section.section_advisement ?? section.select),
      units: number(section.unit_advisement ?? section.units),
      max: number(
        section.unit_advisement_max ?? section.units_max
          ?? section.unit_advisement ?? section.units,
      ),
      label: text(section.label_seen ?? section.label),
      tier: text(section.tier ?? group?.tier),
      level: text(section.course_level ?? group?.course_level),
      cc: section.cc_articulable ?? group?.cc_articulable ?? null,
      refs: array(section.source_refs).length
        ? [...section.source_refs] : [...array(group?.source_refs)],
      note: text(section.note),
      overlap: text(section.overlap_key),
      assume: section.assume_satisfiable === true,
      constraints: array(section.analysis_constraints).map(normalizeConstraint),
      receivers: array(section.receivers).map((receiver) => {
        const body = receiverBody(receiver);
        return {
          kind: text(body.kind)?.toLowerCase() || null,
          codes: receiverCodes(receiver),
          units: number(body.units),
          tier: text(receiver?.tier),
          level: text(receiver?.course_level),
          cc: receiver?.cc_articulable ?? null,
          note: text(receiver?.note ?? body.note),
          overlap: text(receiver?.overlap_key),
        };
      }),
    } : null,
  };
}

function vmiCarrierFingerprint(document) {
  return hash(normalizedCarrier(document?.requirement_groups?.[3]));
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

function claimsVmi(document) {
  const identities = [
    document?.slug, document?._id, document?.va_requirement_id,
    document?.institution_id, document?.school_id, document?.school,
  ].map((value) => String(value ?? '').trim()).filter(Boolean);
  return identities.some((value) => [
    SLUG, SOURCE_DEGREE_ID, SOURCE_INSTITUTION_ID, FINAL_DEGREE_ID,
    FINAL_INSTITUTION_ID, String(SCHOOL_ID), SCHOOL,
  ].includes(value))
    || document?.provenance?.source_bundle_hash === SOURCE_BUNDLE_SHA256;
}

function sourceBundleIssue(document, style) {
  if (style === 'composition') {
    const ids = array(document?.source_bundle_required);
    const expected = SOURCE_RECEIPTS.map((row) => row.id);
    return ids.length === expected.length
      && ids.every((id, index) => id === expected[index])
      ? null : 'the composed VMI source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact !== COMPOSITION_ARTIFACT) {
    return 'the retained VMI source-bundle receipt changed';
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
      })) return 'the retained official VMI source roles, URLs, or text hashes changed';
  return null;
}

function fail(reason) {
  return { supported: false, reason };
}

function exactVmiCarrier(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact VMI composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 136) {
    return fail('the VMI catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = vmiCarrierFingerprint(document);
  if (fingerprint !== CARRIER_SHA256) {
    return fail('the reviewed VMI elective carrier, source refs, or credit declarations changed');
  }
  if (style !== 'composition') {
    const receivers = array(document?.requirement_groups?.[3]?.sections?.[0]?.receivers);
    for (const receiver of receivers) {
      const codes = receiverCodes(receiver);
      if (codes.length !== 1
          || Number(receiverBody(receiver).parent_id)
            !== receivingCourseIdForDocument(document, codes[0])) {
        return fail('one or more projected VMI elective course identities changed');
      }
    }
  }
  return {
    supported: true,
    reason: 'the exact official VMI source bundle and six-credit elective carrier match',
    proof: {
      document_style: style,
      carrier_sha256: fingerprint,
      source_bundle_sha256: style === 'composition' ? null : SOURCE_BUNDLE_SHA256,
      source_response_receipts: OFFICIAL_RESPONSE_RECEIPTS,
    },
  };
}

function exactVmiOpenRuleCarrier(document) {
  const exact = exactVmiCarrier(document);
  if (!exact.supported) return exact;
  const fingerprint = vmiOpenRuleCarrierFingerprint(document);
  if (fingerprint !== OPEN_RULE_CARRIER_SHA256) {
    return fail('the reviewed VMI Core, mathematics, free-elective, or unit carrier changed');
  }
  const evidenceIssue = virginiaMilitaryInstituteOpenRuleEvidenceIssue(
    VMI_OPEN_RULE_EVIDENCE,
  );
  if (evidenceIssue) return fail(evidenceIssue);
  return {
    supported: true,
    reason: 'the exact VMI source tree and supplemental source evidence match',
    proof: {
      ...exact.proof,
      open_rule_carrier_sha256: fingerprint,
      supplemental_evidence_sha256: OPEN_RULE_EVIDENCE_SHA256,
    },
  };
}

function ruleContainerIssue(container, { document, path, constraint } = {}) {
  if (path !== RULE_PATH || document?.requirement_groups?.[3] !== container) {
    return 'the VMI six-credit rule moved from its reviewed source path';
  }
  const matches = array(container?.analysis_constraints)
    .filter((entry) => entry?.kind === RULE_KIND);
  if (matches.length !== 1 || matches[0] !== constraint) {
    return 'the VMI six-credit declaration is absent, duplicated, or detached from its carrier';
  }
  return null;
}

function openRuleContainerIssue(kind, container, { document, path, constraint } = {}) {
  const expectedPath = OPEN_RULE_PATHS[kind];
  const match = /^requirement_groups\[(\d+)\]$/.exec(expectedPath || '');
  const groupIndex = match ? Number(match[1]) : null;
  if (!expectedPath || path !== expectedPath
      || document?.requirement_groups?.[groupIndex] !== container) {
    return `the VMI ${kind} rule moved from its reviewed source path`;
  }
  const matches = array(container?.analysis_constraints)
    .filter((entry) => entry?.kind === kind);
  if (matches.length !== 1 || matches[0] !== constraint) {
    return `the VMI ${kind} declaration is absent, duplicated, or detached from its carrier`;
  }
  return null;
}

function evaluateVmiOpenRule(kind, container, context) {
  const exact = exactVmiOpenRuleCarrier(context.document);
  if (!exact.supported) return exact;
  const carrierIssue = openRuleContainerIssue(kind, container, context);
  if (carrierIssue) return fail(carrierIssue);

  if (kind === 'approved_math_elective_level_floor') {
    const proof = VMI_OPEN_RULE_EVIDENCE.approved_math_elective_level_floor;
    if (proof?.source_verified !== true || proof?.paper_witness_exact !== true
        || proof?.authored_constraint_path !== OPEN_RULE_PATHS[kind]
        || proof?.predicate?.subject !== 'MA'
        || proof?.predicate?.minimum_course_number !== 200
        || proof?.predicate?.credits !== 3
        || proof?.deterministic_witness?.course_code !== 'MA331X'
        || proof?.deterministic_witness?.allocation !== 'open mathematics elective'
        || proof?.deterministic_witness?.credits !== 3
        || proof?.deterministic_witness?.satisfies_number_floor !== true
        || proof?.deterministic_witness?.prerequisite_course_already_required !== true
        || proof?.deterministic_witness?.prerequisite_course_code !== 'MA124') {
      return fail('the exact VMI mathematics witness is unavailable');
    }
    return {
      supported: true,
      reason: 'MA 331X is a retained exact three-credit, 200-level-or-higher mathematics witness whose MA 124 prerequisite is already required',
      proof: {
        ...exact.proof,
        rule_path: OPEN_RULE_PATHS[kind],
        subject: 'MA',
        minimum_course_number: 200,
        required_units: 3,
        selected_course_code: 'MA331X',
        selected_allocation: 'open mathematics elective',
        prerequisite_course_code: 'MA124',
        incremental_units_above_degree_total: 0,
        source_entry_sha256: proof.deterministic_witness.source_entry_sha256,
      },
    };
  }

  const proof = VMI_OPEN_RULE_EVIDENCE.core_overlay_inside_free_electives;
  const witness = proof?.deterministic_cross_allocation_witness;
  const assignments = array(witness?.assignments);
  if (proof?.source_verified !== true || proof?.paper_witness_exact !== true
      || proof?.authored_constraint_path !== OPEN_RULE_PATHS[kind]
      || proof?.localization_finding
        ?.authored_kind_literal_both_courses_inside_free_electives_supported !== false
      || proof?.localization_finding
        ?.description_inside_published_allocation_supported !== true
      || witness?.study_abroad_used !== false
      || witness?.total_designated_courses !== 2
      || witness?.incremental_credits_above_published_degree_total !== 0
      || witness?.free_elective_credits_consumed !== 3
      || witness?.free_elective_credits_remaining !== 21
      || assignments.length !== 2
      || assignments[0]?.course_code !== 'MA331X'
      || assignments[0]?.allocation !== 'open mathematics elective'
      || assignments[0]?.credits !== 3
      || assignments[0]?.prerequisite_course_already_required !== true
      || assignments[1]?.course_code !== 'MA330WX'
      || assignments[1]?.allocation !== 'free electives'
      || assignments[1]?.credits !== 3
      || assignments[1]?.selected_prerequisite_course_already_required !== true
      || assignments[1]?.selected_prerequisite_branch?.code !== 'MA123') {
    return fail('the exact VMI cross-allocation Core witness is unavailable');
  }
  return {
    supported: true,
    reason: 'the two required Civilizations and Cultures designations fit inside published capacity through one mathematics slot and one free-elective slot with zero added credits',
    proof: {
      ...exact.proof,
      rule_path: OPEN_RULE_PATHS[kind],
      selected_courses: assignments.map((assignment) => ({
        course_code: assignment.course_code,
        allocation: assignment.allocation,
        units: assignment.credits,
        source_entry_sha256: assignment.source_entry_sha256,
      })),
      free_elective_units_consumed: 3,
      free_elective_units_remaining: 21,
      incremental_units_above_degree_total: 0,
      literal_both_courses_inside_free_electives_claimed: false,
    },
  };
}

function vmiCoverageSelection(document) {
  const exact = exactVmiCarrier(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  return {
    ready: true,
    institution: SLUG,
    section_receiver_indices: { '3:0': [...LEGAL_RECEIVER_INDICES] },
    excluded_receiver_indices: { '3:0': [2] },
    excluded_receiver_codes: ['CIS303L'],
    reason: 'only the five three-credit receivers can participate in an exact choose-two, six-credit route',
    proof: exact.proof,
  };
}

function vmiFigure6Selection(document) {
  const exact = exactVmiCarrier(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  return {
    ready: true,
    institution: SLUG,
    section_receiver_indices: { '3:0': [...FIGURE_6_RECEIVER_INDICES] },
    selected_course_codes: FIGURE_6_RECEIVER_INDICES.map((index) => (
      ALL_RECEIVER_CODES[index]
    )),
    selected_units: 6,
    reason: 'the first two authored three-credit receivers form the deterministic legal Figure 6 route',
    proof: exact.proof,
  };
}

function evaluateVmiConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (kind !== RULE_KIND && !OPEN_RULE_PATHS[kind]) return null;
  if (!claimsVmi(context.document)) {
    return fail('the evaluator is restricted to the exact VMI source tuple');
  }
  if (OPEN_RULE_PATHS[kind]) return evaluateVmiOpenRule(kind, container, context);
  const exact = exactVmiCarrier(context.document);
  if (!exact.supported) return exact;
  const carrierIssue = ruleContainerIssue(container, context);
  if (carrierIssue) return fail(carrierIssue);
  const coverage = vmiCoverageSelection(context.document);
  const figure6 = vmiFigure6Selection(context.document);
  if (!coverage.ready || !figure6.ready) {
    return fail(coverage.reason || figure6.reason || 'the VMI exact route is unavailable');
  }
  return {
    supported: true,
    reason: 'the exact reader roster excludes only the one-credit lab, so every choose-two route supplies the published six credits',
    proof: {
      ...exact.proof,
      rule_path: RULE_PATH,
      ask: 2,
      required_units: 6,
      eligible_receiver_indices: [...LEGAL_RECEIVER_INDICES],
      eligible_receiver_codes: LEGAL_RECEIVER_INDICES.map((index) => ALL_RECEIVER_CODES[index]),
      excluded_receiver_code: 'CIS303L',
      excluded_receiver_units: 1,
      figure_6_receiver_indices: [...FIGURE_6_RECEIVER_INDICES],
    },
  };
}

module.exports = {
  ALL_RECEIVER_CODES,
  CARRIER_SHA256,
  FIGURE_6_RECEIVER_INDICES,
  LEGAL_RECEIVER_INDICES,
  OFFICIAL_RESPONSE_RECEIPTS,
  OPEN_RULE_CARRIER_SHA256,
  OPEN_RULE_EVIDENCE_SHA256,
  OPEN_RULE_PATHS,
  RULE_KIND,
  RULE_PATH,
  SOURCE_RECEIPTS,
  evaluateVmiConstraint,
  exactVmiCarrier,
  exactVmiOpenRuleCarrier,
  normalizedCarrier,
  normalizedVmiOpenRuleCarrier,
  vmiCarrierFingerprint,
  vmiCoverageSelection,
  vmiFigure6Selection,
  vmiOpenRuleCarrierFingerprint,
};
