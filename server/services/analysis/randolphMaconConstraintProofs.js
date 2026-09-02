/**
 * Exact supplemental proofs for Randolph-Macon College's 2026-2027
 * Collegiate Requirements.
 *
 * The current public attribute lists are useful positive evidence, but the
 * catalog expressly says they omit temporary designations, special-topics
 * courses, and recent approvals.  This evaluator therefore proves only the
 * Writing Attentive rule's zero-increment effect on Figures 1/3/4. Its open
 * identity and prerequisites remain a Figure 6 blocker. Every rule that
 * depends on exhaustive attribute membership, an open project route, or the
 * Registrar's proficiency decision also remains fail-closed.
 */

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { receivingCourseIdForDocument } = require('../virginia/courseIdentity');
const COLLEGIATE_ATTRIBUTE_EVIDENCE = require(
  '../../.va-catalogs/research/randolph-macon-collegiate-attribute-evidence.json'
);

const SLUG = 'randolph-macon-college';
const SCHOOL = 'Randolph-Macon College';
const SCHOOL_ID = 9221;
const SOURCE_DEGREE_ID = 'va:degree:randolph-macon-college:cs';
const SOURCE_INSTITUTION_ID = 'va:uni:randolph-macon-college';
const FINAL_DEGREE_ID = 'degree:9221:va-cs';
const FINAL_INSTITUTION_ID = 'va:uni:9221';
const PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2026-2027';
const SOURCE_BUNDLE_SHA256 = 'f3efd5b6da4e2344d788b1849f26d16ee9163b6505482928a0e058256c2ff966';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: 'b82aef8d9f415b854f40314193d78b00f6d03946fa896fb6ae7b556f33ff449c',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: '5febc73e8b641b323b84ae8c344322f9a89921c63621cb6834ec6e36f4f43f82',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: '1b2c8f1d0f7dcc41a2864aa5fe9a73de4145d4240a586467b713552a03ae2788',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: 'd319a0206bde101e620aad429807e04bb219bd1a38fd46d3fbca8330c1e8931b',
  }),
  Object.freeze({
    id: 'policy_2', role: 'policy', kind: 'policy',
    sha256: 'ec101b09ed346cda4d0f7bb821b67be849e1d6dad1d991425a8a18658734f59b',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: 'b6ee05eb964575f1e93cec4dd9899c8fc62ceb5782bcbd2ae93a8ff4072ee494',
  }),
]);

// Hash of normalizedRandolphMaconProofTree() for the checked-in composition,
// accepted source, and final numeric projection.  Wrapper ids and derived
// parent ids are excluded; every authored requirement, accounting field,
// source ref, note, flag, and course title is retained.
const PROOF_TREE_SHA256 = '5bfafbcfd654a836b1b3b9cdb6735b0b2acaf0e4b8ac6547a1fbbfbd698a89d9';
const EVIDENCE_ARTIFACT_BYTES_SHA256 =
  '0c59e006eb90b44631bf7dcd150f73af819e0755646890f220336805a6ab9c1c';
const EVIDENCE_ARTIFACT_SEMANTIC_SHA256 =
  'e9f70d1dcbee7a37f322cc914994aab98a253e40ff1767c96710a06a5c442554';
const EVIDENCE_ARTIFACT_PATH = require.resolve(
  '../../.va-catalogs/research/randolph-macon-collegiate-attribute-evidence.json',
);
const CURRENT_EVIDENCE_ARTIFACT_BYTES_SHA256 = createHash('sha256')
  .update(fs.readFileSync(EVIDENCE_ARTIFACT_PATH)).digest('hex');

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const RULE_PATHS = Object.freeze({
  foreign_language_sequence_or_proficiency: 'requirement_groups[3]',
  distinct_pillar_courses: 'requirement_groups[4]',
  major_to_pillar_overlap_limit: 'requirement_groups[4]',
  pillar_distribution_attributes: 'requirement_groups[5]',
  writing_attentive_overlap: 'requirement_groups[5]',
  cross_area_overlap_limit: 'requirement_groups[6]',
  cross_area_course_or_project_forms: 'requirement_groups[6]',
  capacity_contains_overlapping_collegiate_requirements: 'requirement_groups[7]',
});
const FIGURE_34_INVARIANT_RULE_PATHS = Object.freeze({
  elective_minimum_course_level: 'requirement_groups[2]',
  no_double_count_with_programming_emphasis: 'requirement_groups[2]',
  special_topics_range_membership: 'requirement_groups[2]',
  cohort_specific_noncredit_experiences: 'requirement_groups[8]',
});
const SOURCE_RULE_PATHS = Object.freeze({
  ...RULE_PATHS,
  ...FIGURE_34_INVARIANT_RULE_PATHS,
});
const MAJOR_MENU_RULES = new Set([
  'elective_minimum_course_level',
  'no_double_count_with_programming_emphasis',
  'special_topics_range_membership',
]);
const PROGRAMMING_EMPHASIS_CODES = Object.freeze([
  'CSCI330', 'CSCI332', 'CSCI335', 'CSCI340', 'CSCI343', 'CSCI350', 'CSCI382',
]);
const ELECTIVE_MENU_CODES = Object.freeze([
  'CSCI229', 'CSCI236', 'RMC-CSCI-280-284', 'CSCI330', 'CSCI332', 'CSCI333',
  'CSCI335', 'CSCI339', 'CSCI340', 'CSCI349', 'CSCI350', 'CSCI363',
  'RMC-CSCI-380-384', 'CSCI485', 'CSEC322', 'CSEC323', 'CSEC353',
]);
const MEMBERSHIP_DEPENDENT_RULES = new Set([
  'distinct_pillar_courses',
  'major_to_pillar_overlap_limit',
  'pillar_distribution_attributes',
  'cross_area_overlap_limit',
  'cross_area_course_or_project_forms',
]);
const EXPECTED_SAFE_RULES = Object.freeze([]);
const EXPECTED_BLOCKED_RULES = Object.freeze([
  'foreign_language_sequence_or_proficiency',
  'distinct_pillar_courses',
  'major_to_pillar_overlap_limit',
  'pillar_distribution_attributes',
  'writing_attentive_overlap',
  'cross_area_overlap_limit',
  'cross_area_course_or_project_forms',
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
    title: text(body.title),
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

function normalizedRandolphMaconProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    program: text(document?.program),
    total_units: number(document?.total_units),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: [...array(document?.modeling_notes)],
    data_quality_flags: [...array(document?.data_quality_flags)],
    course_titles: document?.course_titles || null,
    groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function randolphMaconProofTreeFingerprint(document) {
  return hash(normalizedRandolphMaconProofTree(document));
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
      ? null : 'the composed Randolph-Macon source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== 'server/.va-catalogs/composed/randolph-macon-college.json') {
    return 'the retained Randolph-Macon source-bundle receipt changed';
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
      })) return 'the retained official Randolph-Macon source roles or text hashes changed';
  return null;
}

function fail(reason) {
  return { supported: false, affected_figures: [...ALL_FIGURES], reason };
}

function exactRandolphMaconTree(document) {
  const style = documentStyle(document);
  if (!style) {
    return fail('document identity is not an exact Randolph-Macon composition/source/projection tuple');
  }
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || text(document?.program) !== PROGRAM
      || number(document?.total_units) !== 120) {
    return fail('the Randolph-Macon catalog year, program, or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = randolphMaconProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed Randolph-Macon source tree, source refs, constraints, or accounting declarations changed');
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
            return fail('one or more projected Randolph-Macon course identities changed');
          }
        }
      }
    }
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed Randolph-Macon 2026-2027 tree and six-role official source receipt match',
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

function exactRandolphMaconRosterEvidence(
  evidence = COLLEGIATE_ATTRIBUTE_EVIDENCE,
  { artifactBytesSha256 = CURRENT_EVIDENCE_ARTIFACT_BYTES_SHA256 } = {},
) {
  if (artifactBytesSha256 !== EVIDENCE_ARTIFACT_BYTES_SHA256) {
    return fail('the exact Randolph-Macon supplemental evidence artifact bytes changed');
  }
  const semanticSha256 = hash(evidence);
  if (semanticSha256 !== EVIDENCE_ARTIFACT_SEMANTIC_SHA256) {
    return fail('the exact Randolph-Macon supplemental evidence semantics changed');
  }
  const scope = evidence?.roster_scope || {};
  const disposition = evidence?.publication_disposition || {};
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== 'randolph_macon_2026_2027_collegiate_attribute_evidence'
      || evidence?.catalog_year !== CATALOG_YEAR
      || evidence?.institution?.slug !== SLUG
      || evidence?.institution?.school_id !== SCHOOL_ID
      || scope.classification !== 'exact_published_lower_bound_positive_attributes_only'
      || scope.exhaustive_for_current_eligibility !== false
      || scope.negative_membership_inference_allowed !== false
      || scope.transfer_optimizing_feasibility_closed !== false
      || JSON.stringify(disposition.safely_resolved_constraint_kinds)
        !== JSON.stringify(EXPECTED_SAFE_RULES)
      || JSON.stringify(disposition.still_blocked_constraint_kinds)
        !== JSON.stringify(EXPECTED_BLOCKED_RULES)
      || JSON.stringify(disposition.paper_impact_scoped_constraint_kinds)
        !== JSON.stringify({ writing_attentive_overlap: ['6'] })
      || disposition.official_catalog_wording_conflict_resolved !== false
      || disposition.transfer_application_discretion_resolved !== false) {
    return fail('the Randolph-Macon public-roster scope or fail-closed disposition changed');
  }
  const witnesses = evidence?.published_positive_witnesses;
  const pillar = witnesses?.pillars;
  if (pillar?.writing_attentive_course !== 'ARTH201'
      || pillar?.selection_by_pillar?.AE !== 'ARTH201'
      || pillar?.distinct_course_count !== 6
      || pillar?.published_wa_rows_also_listed_as_pillars !== 77
      || !evidence?.rules?.writing_attentive_requirement_is_course_attribute) {
    return fail('the exact published Writing Attentive positive witness changed');
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the exact 2026-2027 public roster evidence matches its published lower-bound scope',
    proof: {
      evidence_artifact_bytes_sha256: artifactBytesSha256,
      evidence_artifact_semantic_sha256: semanticSha256,
      published_roster_occurrences: Object.values(evidence.rosters)
        .reduce((sum, roster) => sum + roster.occurrence_count, 0),
      public_roster_exhaustive: false,
      negative_membership_inference_allowed: false,
      omitted_current_eligibility_classes: [...scope.omitted_by_official_page],
    },
  };
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}) {
  const expectedPath = SOURCE_RULE_PATHS[kind];
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

function receiverCode(receiver) {
  const codes = receiverCodes(receiver);
  return codes.length === 1 ? codes[0] : null;
}

function expandRmcElectiveCode(code) {
  const range = String(code || '').match(/^RMC-CSCI-(280|380)-(284|384)$/);
  if (!range) return [code];
  const first = Number(range[1]);
  const last = Number(range[2]);
  return Array.from({ length: last - first + 1 }, (_, index) => `CSCI${first + index}`);
}

function courseNumber(code) {
  const match = String(code || '').match(/^(?:CSCI|CSEC)(\d{3})$/);
  return match ? Number(match[1]) : null;
}

function choose(values, count, start = 0, selected = [], output = []) {
  if (selected.length === count) {
    output.push([...selected]);
    return output;
  }
  for (let index = start; index <= values.length - (count - selected.length); index += 1) {
    selected.push(values[index]);
    choose(values, count, index + 1, selected, output);
    selected.pop();
  }
  return output;
}

/**
 * Prove the exact shared Programming Emphasis / major-elective selection state.
 * The two printed special-topics ranges are expanded to their actual course
 * identities for distinctness and level checks; they are never treated as one
 * invented placeholder course. Course-entry prerequisites remain deliberately
 * open for Figures 1/6, but every feasible route has exactly four distinct
 * three-credit, nontransferable elective identities.
 */
function majorElectiveSharedSelectionProof(document) {
  const emphasis = document?.requirement_groups?.[1];
  const electives = document?.requirement_groups?.[2];
  const emphasisSection = emphasis?.sections?.[0];
  const electiveSection = electives?.sections?.[0];
  const emphasisReceivers = array(emphasisSection?.receivers);
  const electiveReceivers = array(electiveSection?.receivers);
  const emphasisCodes = emphasisReceivers.map(receiverCode);
  const menuCodes = electiveReceivers.map(receiverCode);
  const expectedShape = text(emphasis?.title) === 'Computer Science Programming Emphasis'
    && text(emphasis?.requirement_layer) === 'major'
    && emphasis?.cc_articulable === false
    && array(emphasis?.sections).length === 1
    && number(emphasisSection?.section_advisement ?? emphasisSection?.select) === 1
    && number(emphasisSection?.unit_advisement ?? emphasisSection?.units) === 3
    && emphasisReceivers.every((receiver) => (
      text(receiverBody(receiver)?.kind)?.toLowerCase() === 'course'
        && number(receiverBody(receiver)?.units) === 3
    ))
    && JSON.stringify(emphasisCodes) === JSON.stringify(PROGRAMMING_EMPHASIS_CODES)
    && text(electives?.title) === 'Computer Science Electives'
    && text(electives?.requirement_layer) === 'major'
    && electives?.cc_articulable === false
    && array(electives?.sections).length === 1
    && number(electiveSection?.section_advisement ?? electiveSection?.select) === 4
    && number(electiveSection?.unit_advisement ?? electiveSection?.units) === 12
    && electiveReceivers.every((receiver) => (
      ['course', 'ge_area'].includes(text(receiverBody(receiver)?.kind)?.toLowerCase())
        && number(receiverBody(receiver)?.units) === 3
    ))
    && JSON.stringify(menuCodes) === JSON.stringify(ELECTIVE_MENU_CODES);
  if (!expectedShape) return fail('the exact Randolph-Macon Programming Emphasis or elective carrier changed');

  const expanded = menuCodes.flatMap(expandRmcElectiveCode);
  if (new Set(expanded).size !== expanded.length
      || expanded.some((code) => !Number.isInteger(courseNumber(code)))) {
    return fail('the exact Randolph-Macon elective ranges do not expand to distinct course identities');
  }
  const feasibleSelectionCounts = {};
  for (const emphasisCode of emphasisCodes) {
    const available = expanded.filter((code) => code !== emphasisCode);
    const feasible = choose(available, 4).filter((selection) => (
      new Set(selection).size === 4
        && selection.filter((code) => courseNumber(code) >= 300).length >= 2
    ));
    if (!feasible.length) {
      return fail(`no exact four-course elective route remains after selecting ${emphasisCode}`);
    }
    feasibleSelectionCounts[emphasisCode] = feasible.length;
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the exact shared selection state preserves four distinct three-credit electives, two at 300-level or above, without reusing the Programming Emphasis identity',
    proof: {
      programming_emphasis_choice_count: emphasisCodes.length,
      printed_elective_menu_entry_count: menuCodes.length,
      expanded_elective_identity_count: expanded.length,
      special_topics_ranges: {
        'RMC-CSCI-280-284': expandRmcElectiveCode('RMC-CSCI-280-284'),
        'RMC-CSCI-380-384': expandRmcElectiveCode('RMC-CSCI-380-384'),
      },
      feasible_selection_counts_by_emphasis: feasibleSelectionCounts,
      selected_elective_course_count: 4,
      selected_elective_units: 12,
      minimum_300_level_courses: 2,
      programming_emphasis_reuse_allowed: false,
      carrier_cc_articulable: false,
      residual_range_course_prerequisites_open: true,
    },
  };
}

function noncreditExperiencePaperProof(document) {
  const group = document?.requirement_groups?.[8];
  const section = group?.sections?.[0];
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  if (text(group?.title) !== 'Physical Education and Wellness experiences'
      || text(group?.requirement_layer) !== 'university_graduation'
      || text(group?.tier) !== 'nontransferable'
      || text(group?.course_level) !== 'noncredit_cocurricular'
      || group?.cc_articulable !== false
      || JSON.stringify(array(group?.source_refs))
        !== JSON.stringify(['general_education', 'graduation'])
      || array(group?.sections).length !== 1
      || number(section?.section_advisement ?? section?.select) !== 1
      || number(section?.unit_advisement ?? section?.units) !== 0
      || receivers.length !== 1
      || text(body?.kind)?.toLowerCase() !== 'requirement'
      || text(body?.name) !== 'Complete two approved Physical Education and Wellness experiences'
      || number(body?.units) !== 0) {
    return fail('the exact Randolph-Macon noncredit experience carrier changed');
  }
  return {
    supported: true,
    affected_figures: [],
    reason: 'the exact retained carrier is non-course, nontransferable, and zero academic credit, so this cohort rule cannot change any paper figure; the separate official-wording conflict remains fail-closed',
    proof: {
      selected_course_count: 0,
      academic_units: 0,
      cc_articulable: false,
      student_completion_outside_paper_model: true,
      official_wording_conflict_resolved: false,
    },
  };
}

function exactZeroUnitArea(section, { label, code, name }) {
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  return text(section?.label_seen ?? section?.label) === label
    && number(section?.section_advisement ?? section?.select) === 1
    && number(section?.unit_advisement ?? section?.units) === 0
    && receivers.length === 1
    && text(body.kind)?.toLowerCase() === 'ge_area'
    && receiverCodes(receivers[0])[0] === code
    && text(body.name) === name
    && number(body.units) === 0;
}

function writingAttentiveOverlayProof(document) {
  const pillars = document?.requirement_groups?.[4];
  const attributes = document?.requirement_groups?.[5];
  const capacity = document?.requirement_groups?.[7];
  const pillarCodes = ['RMC-GE-AE', 'RMC-GE-CL', 'RMC-GE-GE', 'RMC-GE-HC', 'RMC-GE-QS', 'RMC-GE-SP'];
  if (array(pillars?.sections).length !== 6
      || array(pillars?.sections).some((section, index) => (
        number(section?.section_advisement ?? section?.select) !== 1
        || number(section?.unit_advisement ?? section?.units) !== 0
        || array(section?.receivers).length !== 1
        || text(receiverBody(section.receivers[0]).kind)?.toLowerCase() !== 'ge_area'
        || receiverCodes(section.receivers[0])[0] !== pillarCodes[index]
        || number(receiverBody(section.receivers[0]).units) !== 0
      ))) return fail('the six zero-increment Pillar carriers changed');
  if (array(attributes?.sections).length !== 4
      || !exactZeroUnitArea(attributes.sections[0], {
        label: 'Writing Attentive',
        code: 'RMC-GE-WA',
        name: 'At least one Writing Attentive course',
      })) return fail('the zero-increment Writing Attentive attribute carrier changed');
  const capacitySection = capacity?.sections?.[0];
  const capacityReceivers = array(capacitySection?.receivers);
  const capacityReceiver = receiverBody(capacityReceivers[0]);
  if (array(capacity?.sections).length !== 1
      || text(capacitySection?.label_seen ?? capacitySection?.label)
        !== 'Remaining applicable credit to the 120-hour Bachelor of Science minimum'
      || number(capacitySection?.section_advisement ?? capacitySection?.select) !== 1
      || number(capacitySection?.unit_advisement ?? capacitySection?.units) !== 80
      || capacityReceivers.length !== 1
      || text(capacityReceiver.kind)?.toLowerCase() !== 'ge_area'
      || receiverCodes(capacityReceivers[0])[0] !== 'RMC-GE-ELECTIVE-CAPACITY'
      || text(capacityReceiver.name)
        !== 'Collegiate Requirements and remaining applicable coursework'
      || number(capacityReceiver.units) !== 80
      || number(document?.unit_audit?.canonical_path?.major_units) !== 40
      || number(document?.unit_audit?.canonical_path
        ?.remaining_general_education_and_elective_capacity_units) !== 80
      || number(document?.unit_audit?.canonical_path?.total_units) !== 120) {
    return fail('the fixed Randolph-Macon 40+80 capacity accounting changed');
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'one exact published WA/Pillar witness fits the zero-unit attribute carrier inside the fixed 80-credit capacity, so the rule cannot add a Figure 1 observation or move Figure 3/4 applied units; its identity and prerequisites remain open for Figure 6',
    proof: {
      selected_pillar_course_witness: 'ARTH201',
      published_witness_pillar: 'AE',
      additional_course_count: 0,
      additional_units: 0,
      invariant_under_omitted_eligible_courses: true,
      residual_figure_6_identity_and_prerequisites_open: true,
    },
  };
}

/**
 * Prove only the published accounting relationship: the zero-credit
 * Collegiate gates constrain the one 80-credit remainder after the fixed
 * 40-credit major; they do not add another block of credit to the 120-credit
 * degree. This deliberately says nothing about which courses may occupy that
 * capacity, how transfer credit is applied, or how much of the major is
 * resident. Those separate rules remain fail-closed.
 */
function capacityContainsOverlappingCollegiateRequirementsProof(document) {
  const majorGroups = array(document?.requirement_groups).slice(0, 3);
  const collegiateGateGroups = array(document?.requirement_groups).slice(3, 7);
  const capacity = document?.requirement_groups?.[7];
  const majorUnits = majorGroups.reduce((groupTotal, group) => (
    groupTotal + array(group?.sections).reduce((sectionTotal, section) => (
      sectionTotal + (number(section?.unit_advisement ?? section?.units) || 0)
    ), 0)
  ), 0);
  const zeroUnitGates = collegiateGateGroups.length === 4
    && collegiateGateGroups.every((group) => array(group?.sections).length > 0
      && array(group.sections).every((section) => (
        number(section?.unit_advisement ?? section?.units) === 0
        && array(section?.receivers).length > 0
        && array(section.receivers).every((receiver) => (
          number(receiverBody(receiver)?.units) === 0
        ))
      )));
  const section = capacity?.sections?.[0];
  const receivers = array(section?.receivers);
  const receiver = receiverBody(receivers[0]);
  const canonical = document?.unit_audit?.canonical_path || {};
  if (majorUnits !== 40
      || !zeroUnitGates
      || array(capacity?.sections).length !== 1
      || text(capacity?.title)
        !== 'General Education and elective capacity after the Computer Science major'
      || number(section?.section_advisement ?? section?.select) !== 1
      || number(section?.unit_advisement ?? section?.units) !== 80
      || receivers.length !== 1
      || text(receiver?.kind)?.toLowerCase() !== 'ge_area'
      || receiverCodes(receivers[0])[0] !== 'RMC-GE-ELECTIVE-CAPACITY'
      || number(receiver?.units) !== 80
      || number(document?.total_units) !== 120
      || number(document?.unit_audit?.major_units) !== 40
      || number(document?.unit_audit?.general_education_and_elective_capacity_units) !== 80
      || number(canonical?.major_units) !== 40
      || number(canonical?.remaining_general_education_and_elective_capacity_units) !== 80
      || number(canonical?.total_units) !== 120) {
    return fail('the exact Randolph-Macon 40+80 nonadditive capacity carrier changed');
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the exact zero-credit Collegiate gates constrain the single 80-credit remainder after the fixed 40-credit major, so they do not add credit beyond the published 120-credit total',
    proof: {
      fixed_major_units: 40,
      collegiate_gate_group_count: 4,
      collegiate_gate_increment_units: 0,
      remaining_capacity_units: 80,
      degree_total_units: 120,
      exhaustive_capacity_course_membership_proven: false,
      transfer_application_discretion_resolved: false,
      resident_major_allocation_resolved: false,
    },
  };
}

function evaluateRandolphMaconConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (!SOURCE_RULE_PATHS[kind]) return fail('no exact Randolph-Macon evaluator handles this rule');
  const exact = exactRandolphMaconTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context);
  if (issue) return fail(issue);
  if (MAJOR_MENU_RULES.has(kind)) {
    const selection = majorElectiveSharedSelectionProof(context.document);
    if (!selection.supported) return selection;
    return {
      supported: false,
      paper_impact_proven: true,
      affected_figures: ['1', '6'],
      reason: `${selection.reason}; the fixed 12-credit carrier is nontransferable and therefore cannot move Figure 3/4 credit`,
      proof: {
        ...exact.proof,
        ...selection.proof,
        rule_path: context.path,
        rule_kind: kind,
      },
    };
  }
  if (kind === 'cohort_specific_noncredit_experiences') {
    const noncredit = noncreditExperiencePaperProof(context.document);
    if (!noncredit.supported) return noncredit;
    return {
      supported: false,
      paper_impact_proven: true,
      affected_figures: [],
      reason: noncredit.reason,
      proof: {
        ...exact.proof,
        ...noncredit.proof,
        rule_path: context.path,
      },
    };
  }
  if (kind === 'capacity_contains_overlapping_collegiate_requirements') {
    const capacity = capacityContainsOverlappingCollegiateRequirementsProof(context.document);
    if (!capacity.supported) return capacity;
    return {
      ...capacity,
      proof: {
        ...exact.proof,
        ...capacity.proof,
        rule_path: context.path,
      },
    };
  }
  const evidence = exactRandolphMaconRosterEvidence();
  if (!evidence.supported) return evidence;

  const commonProof = {
    ...exact.proof,
    ...evidence.proof,
    rule_path: context.path,
  };
  if (kind === 'writing_attentive_overlap') {
    const overlay = writingAttentiveOverlayProof(context.document);
    if (!overlay.supported) return overlay;
    return {
      supported: false,
      paper_impact_proven: true,
      affected_figures: ['6'],
      reason: overlay.reason,
      proof: { ...commonProof, ...overlay.proof },
    };
  }
  if (kind === 'foreign_language_sequence_or_proficiency') {
    return {
      supported: false,
      affected_figures: [...ALL_FIGURES],
      reason: 'the published FL list is positive lower-bound evidence, but the native-language proficiency route remains a Registrar decision and the public page is not an exhaustive current eligibility roster',
      proof: {
        ...commonProof,
        published_intermediate_sequence_witness_count: 3,
        registrar_proficiency_route_resolved_for_degree_application: false,
      },
    };
  }
  if (MEMBERSHIP_DEPENDENT_RULES.has(kind)) {
    return {
      supported: false,
      affected_figures: [...ALL_FIGURES],
      reason: `the ${kind} rule remains membership-dependent, and the official public catalog expressly excludes current eligible options from its published rosters`,
      proof: {
        ...commonProof,
        positive_witness_available: true,
        exhaustive_transfer_optimizing_membership_available: false,
        curricular_project_membership_closed:
          kind === 'cross_area_course_or_project_forms' ? false : null,
      },
    };
  }
  return fail('no exact Randolph-Macon roster evaluator handles this rule');
}

function randolphMaconSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  if (!['writing_attentive_overlap', ...MAJOR_MENU_RULES,
    'cohort_specific_noncredit_experiences'].includes(kind)) return null;
  const exact = exactRandolphMaconTree(context.document);
  if (!exact.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  })) return null;
  if (kind === 'writing_attentive_overlap') {
    const evidence = exactRandolphMaconRosterEvidence();
    if (!evidence.supported || !writingAttentiveOverlayProof(context.document).supported) return null;
    return ['6'];
  }
  if (MAJOR_MENU_RULES.has(kind)) {
    return majorElectiveSharedSelectionProof(context.document).supported ? ['1', '6'] : null;
  }
  return noncreditExperiencePaperProof(context.document).supported ? [] : null;
}

function randolphMaconQualityFlagAffectedFigures(flag, document) {
  if (text(flag?.code) !== 'major_elective_cross_choice_constraints'
      || text(flag?.severity)?.toLowerCase() !== 'block_analysis') return null;
  const flags = array(document?.data_quality_flags);
  if (flags[1] !== flag || flags.filter((row) => (
    text(row?.code) === 'major_elective_cross_choice_constraints'
  )).length !== 1) return null;
  const exact = exactRandolphMaconTree(document);
  return exact.supported && majorElectiveSharedSelectionProof(document).supported
    ? ['1', '6'] : null;
}

module.exports = {
  COLLEGIATE_ATTRIBUTE_EVIDENCE,
  CURRENT_EVIDENCE_ARTIFACT_BYTES_SHA256,
  EVIDENCE_ARTIFACT_BYTES_SHA256,
  EVIDENCE_ARTIFACT_SEMANTIC_SHA256,
  FIGURE_34_INVARIANT_RULE_PATHS,
  PROOF_TREE_SHA256,
  RULE_PATHS,
  SOURCE_BUNDLE_SHA256,
  SOURCE_RECEIPTS,
  capacityContainsOverlappingCollegiateRequirementsProof,
  evaluateRandolphMaconConstraint,
  exactRandolphMaconRosterEvidence,
  exactRandolphMaconTree,
  majorElectiveSharedSelectionProof,
  noncreditExperiencePaperProof,
  normalizedRandolphMaconProofTree,
  randolphMaconProofTreeFingerprint,
  randolphMaconQualityFlagAffectedFigures,
  randolphMaconSourceSpecificAffectedFigures,
  writingAttentiveOverlayProof,
};
