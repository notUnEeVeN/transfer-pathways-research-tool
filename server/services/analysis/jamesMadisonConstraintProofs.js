/**
 * Exact source-shape proofs for the two James Madison Computer Science B.S.
 * rules that look more expressive than the shared paper-figure readers.
 *
 * These are deliberately not general-purpose evaluators.  They prove that the
 * current, verified JMU source tree already encodes the rule on the canonical
 * path consumed by Figures 1, 3, 4, and 6.  A source refresh, reordered or
 * renamed requirement, changed course identity, altered unit range, or changed
 * accounting declaration invalidates the proof until it is reviewed again.
 */

const { createHash } = require('node:crypto');
const {
  courseIdFor,
  receivingCourseIdForDocument,
} = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');

const JMU_SLUG = 'james-madison-university';
const JMU_DEGREE_ID = 'va:degree:james-madison-university:cs';
const JMU_INSTITUTION_ID = 'va:uni:james-madison-university';
const JMU_SHARED_DEGREE_ID = 'degree:9213:va-cs';
const JMU_SHARED_INSTITUTION_ID = 'va:uni:9213';
const JMU_CATALOG_YEAR = '2026-2027';
const JMU_PROGRAM = 'Computer Science, B.S.';
const JMU_SOURCE_BUNDLE_HASH = '592e332b48e76889ea2041565dc0acf4b149a1cca4d363f71c3c2d318cff3d8f';
const JMU_CUMULATIVE_GPA_SOURCE_TEXT =
  'earn at least 120 cumulative credit hours with a cumulative GPA of 2.0 or better';
const JMU_MAJOR_GPA_SOURCE_TEXT =
  'satisfy course requirements for the major program with a 2.0 GPA or better';

const SOURCE_BUNDLE = Object.freeze([
  ['major', 'program', 'major', '10fdfbb0c011fdde2beaab4a3b6f3de02b914a5dbf339ec6e10e1abced86bf28'],
  ['general_education', 'ge', 'general_education', 'b542d974c0373eeac5e57cea33c5bb28f05a56096f018e4e6da7f7839c563e4b'],
  ['college', 'college', 'college', '7a68eb6bf13727acd4ebbd774603904a420a1800856a3428aa32f82d875036bb'],
  ['graduation', 'graduation', 'graduation', '1a9588f1714951d73ca5e146e1ac57cabcb9c8510d58e92e2d7ff08ffcf07567'],
  ['policy', 'policy', 'policy', 'a70dc513cc5436ac180aff595c01149a4a0c5bd3b174b914dbf0c3772c0dccf8'],
  ['course_catalog', 'course_catalog', 'course_catalog', '866d0306b8f7218bd74a04c390cdeb218f4f8499113f781c7822199894711a29'],
  ['general_education_detail', 'ge_detail', 'general_education', '1a62e25d4117107d671c310542c28a2bc6904835f76c6f08106e17170158569c'],
]);

const REQUIRED_SOURCE_IDS = Object.freeze([
  'major',
  'general_education',
  'general_education_detail',
  'college',
  'graduation',
  'policy',
  'course_catalog',
]);

const CAPTURE_LAYERS = Object.freeze({
  major: ['major'],
  general_education: ['major', 'general_education', 'general_education_detail'],
  college: ['college'],
  graduation: ['major', 'graduation'],
  academic_policy: ['policy'],
  course_catalog: ['course_catalog'],
});

const RULES = Object.freeze({
  minimum_course_number_distribution: Object.freeze({
    groupIndex: 1,
    path: 'requirement_groups[1]',
    description: 'Select three CS courses numbered 300 or above, at least two of which must be numbered above CS 332.',
  }),
  correlated_variable_major_and_elective_units: Object.freeze({
    groupIndex: 9,
    path: 'requirement_groups[9]',
    description: 'This block is 27 credits only on the 49-credit canonical major path and must fall one-for-one to 24 when longer major options are selected.',
  }),
});

// SHA-256 of normalizedJmuProofTree() for both the checked-in composition and
// its exact shared-schema projection.  The normalized view includes every
// group, section, receiver, source reference, role field, unit declaration,
// constraint declaration, course title, quality flag, and modeling note.
const JMU_PROOF_TREE_SHA256 = '0f76ef886722eebee859c6cc2902b1e254d2090f9625b72164bc0b7723085e73';

const text = (value) => value == null ? null : String(value).trim();
const finite = (value) => Number.isFinite(Number(value));
const number = (value) => finite(value) ? Number(value) : null;
const array = (value) => Array.isArray(value) ? value : [];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
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
    .map((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
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
    name: text(body.name),
    units: number(body.units),
    conjunction: text(body.conjunction)?.toLowerCase() || (body.kind === 'series' ? 'and' : null),
    articulation_status: text(receiver?.articulation_status),
    not_articulated_reason: text(receiver?.not_articulated_reason),
    options_conjunction: text(receiver?.options_conjunction)?.toLowerCase() || 'or',
    options: array(receiver?.options),
    tier: text(receiver?.tier),
    course_level: text(receiver?.course_level),
    cc_articulable: receiver?.cc_articulable ?? null,
    overlap_key: text(receiver?.overlap_key),
    note: text(receiver?.note),
    human_review: receiver?.human_review ?? null,
  };
}

function sectionAsk(section) {
  return number(section?.section_advisement ?? section?.select);
}

function sectionUnits(section) {
  return number(section?.unit_advisement ?? section?.units);
}

function sectionUnitsMax(section) {
  const minimum = sectionUnits(section);
  return number(section?.unit_advisement_max ?? section?.units_max ?? minimum);
}

function normalizedSection(section, group) {
  return {
    ask: sectionAsk(section),
    units: sectionUnits(section),
    units_max: sectionUnitsMax(section),
    label: text(section?.label_seen ?? section?.label),
    tier: text(effective(section, group, 'tier')),
    course_level: text(effective(section, group, 'course_level')),
    cc_articulable: effective(section, group, 'cc_articulable'),
    source_refs: array(section?.source_refs).length
      ? [...section.source_refs] : [...array(group?.source_refs)],
    overlap_key: text(section?.overlap_key),
    note: text(section?.note),
    human_review: section?.human_review ?? null,
    assume_satisfiable: section?.assume_satisfiable === true,
    analysis_constraints: array(section?.analysis_constraints).map(normalizedConstraint),
    receivers: array(section?.receivers).map(normalizedReceiver),
  };
}

function normalizedGroup(group) {
  return {
    title: text(group?.title),
    is_required: group?.is_required !== false,
    group_conjunction: text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and',
    requirement_layer: text(group?.requirement_layer),
    tier: text(group?.tier),
    course_level: text(group?.course_level),
    cc_articulable: group?.cc_articulable ?? null,
    source_refs: [...array(group?.source_refs)],
    stated_credits: text(group?.stated_credits),
    distinct_course_ids_across_sections: group?.distinct_course_ids_across_sections === true,
    overlap_key: text(group?.overlap_key),
    note: text(group?.note),
    human_review: group?.human_review ?? null,
    analysis_constraints: array(group?.analysis_constraints).map(normalizedConstraint),
    sections: array(group?.sections).map((section) => normalizedSection(section, group)),
  };
}

function normalizedJmuProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    program: text(document?.program),
    total_units: number(document?.total_units),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: array(document?.modeling_notes),
    data_quality_flags: array(document?.data_quality_flags),
    course_titles: document?.course_titles || null,
    requirement_groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function jmuProofTreeFingerprint(document) {
  return hash(normalizedJmuProofTree(document));
}

function documentStyle(document) {
  const composed = document?.slug === JMU_SLUG
    && document?._id == null && document?.institution_id == null;
  const source = document?._id === JMU_DEGREE_ID
    && document?.institution_id === JMU_INSTITUTION_ID
    && document?.slug == null;
  const canonical = document?._id === JMU_SHARED_DEGREE_ID
    && document?.institution_id === JMU_SHARED_INSTITUTION_ID
    && Number(document?.school_id) === 9213
    && document?.slug == null;
  if ([composed, source, canonical].filter(Boolean).length !== 1) return null;
  if (composed) return 'composed';
  return canonical ? 'canonical' : 'source';
}

function identityIssue(document) {
  const style = documentStyle(document);
  if (!style) return 'proof requires exactly the verified JMU composition or its exact canonical projection';
  if (document.catalog_year !== JMU_CATALOG_YEAR
      || document.program !== JMU_PROGRAM
      || Number(document.total_units) !== 120) {
    return 'JMU catalog year, program identity, or 120-credit degree declaration changed';
  }
  if (style === 'composed') {
    if (document.schema_version !== 1
        || document.composition_status !== 'composed_full_degree'
        || document.award !== 'BS'
        || !sameArray(document.source_bundle_required, REQUIRED_SOURCE_IDS)) {
      return 'the checked-in JMU composition identity or required source bundle changed';
    }
    return null;
  }
  if (document.kind !== 'degree'
      || document.source !== 'institution_catalog'
      || document.source_method !== 'official_catalog_composition'
      || document.status !== 'extracted'
      || document.degree_variant !== 'BS'
      || document.unit_system !== 'semester') {
    return 'the projected JMU degree identity or extraction status changed';
  }
  if (style === 'canonical'
      && (document.state !== 'va'
        || document.va_requirement_id !== JMU_DEGREE_ID
        || document.va_requirement_status !== 'extracted'
        || !usesCanonicalSourceContract(document))) {
    return 'the shared JMU projection link or canonical analysis contract changed';
  }
  if (document?.provenance?.source_bundle_hash !== JMU_SOURCE_BUNDLE_HASH) {
    return 'the projected JMU official source-bundle hash changed';
  }
  return null;
}

function projectedSourceIssue(document) {
  if (documentStyle(document) === 'composed') return null;
  const sources = array(document.sources);
  if (sources.length !== SOURCE_BUNDLE.length) return 'the projected JMU official source roster changed';
  for (const [index, [id, role, kind, sha256]] of SOURCE_BUNDLE.entries()) {
    const source = sources[index];
    if (source?.id !== id || source?.role !== role || source?.kind !== kind
        || source?.sha256 !== sha256 || source?.official !== true
        || source?.secure !== true || !/^https:\/\//.test(String(source?.url || ''))) {
      return `the projected JMU source receipt changed at ${id}`;
    }
  }
  const capture = document.capture_layers;
  if (!capture || Object.keys(capture).length !== Object.keys(CAPTURE_LAYERS).length) {
    return 'the projected JMU capture-layer roster changed';
  }
  for (const [layer, refs] of Object.entries(CAPTURE_LAYERS)) {
    if (capture[layer]?.status !== 'captured'
        || !sameArray(capture[layer]?.source_refs, refs)) {
      return `the projected JMU ${layer} capture status or source references changed`;
    }
  }
  return null;
}

function projectedReceiverIdentityIssue(document) {
  if (documentStyle(document) === 'composed') return null;
  for (const [groupIndex, group] of array(document.requirement_groups).entries()) {
    for (const [sectionIndex, section] of array(group.sections).entries()) {
      for (const [receiverIndex, receiver] of array(section.receivers).entries()) {
        const path = `requirement_groups[${groupIndex}].sections[${sectionIndex}].receivers[${receiverIndex}]`;
        const body = receiverBody(receiver);
        const codes = receiverCodes(receiver);
        if (!Array.isArray(receiver.options) || receiver.options.length
            || receiver.options_conjunction !== 'or') {
          return `${path} no longer has the exact empty projected option shape`;
        }
        if (body.kind === 'course') {
          if (codes.length !== 1
            || body.parent_id !== receivingCourseIdForDocument(document, codes[0])) {
            return `${path} no longer has the deterministic JMU course identity`;
          }
        } else if (body.kind === 'series') {
          const expectedIds = codes.map((code) => receivingCourseIdForDocument(document, code));
          if (body.conjunction !== 'and' || expectedIds.some((id) => id == null)
              || !sameArray(body.parent_ids, expectedIds)) {
            return `${path} no longer has the deterministic conjunctive series identity`;
          }
        } else if (body.parent_id != null || codes.some((code) => courseIdFor(code) != null)) {
          return `${path} turns a category or policy receiver into a course identity`;
        }
      }
    }
  }
  return null;
}

function contextIssue(kind, container, { document, path, constraint } = {}) {
  const rule = RULES[kind];
  if (!rule) return 'unknown JMU proof rule';
  const identity = identityIssue(document);
  if (identity) return identity;
  const source = projectedSourceIssue(document);
  if (source) return source;
  const identityBinding = projectedReceiverIdentityIssue(document);
  if (identityBinding) return identityBinding;
  if (path !== rule.path
      || document.requirement_groups?.[rule.groupIndex] !== container) {
    return `constraint must remain attached to ${rule.path} of the verified JMU tree`;
  }
  const constraints = array(container?.analysis_constraints);
  if (constraints.length !== 1 || constraints[0] !== constraint
      || constraint?.kind !== kind
      || constraint?.status !== 'evaluator_not_implemented'
      || constraint?.description !== rule.description) {
    return 'the source-authored JMU constraint declaration changed';
  }
  const fingerprint = jmuProofTreeFingerprint(document);
  if (fingerprint !== JMU_PROOF_TREE_SHA256) {
    return `the verified JMU requirement tree changed (${fingerprint})`;
  }
  return null;
}

function exactJmuTree(document) {
  const identity = identityIssue(document);
  if (identity) return { supported: false, reason: identity };
  const source = projectedSourceIssue(document);
  if (source) return { supported: false, reason: source };
  const identityBinding = projectedReceiverIdentityIssue(document);
  if (identityBinding) return { supported: false, reason: identityBinding };
  const fingerprint = jmuProofTreeFingerprint(document);
  if (fingerprint !== JMU_PROOF_TREE_SHA256) {
    return {
      supported: false,
      reason: `the verified JMU requirement tree changed (${fingerprint})`,
    };
  }
  const style = documentStyle(document);
  return {
    supported: true,
    affected_figures: ['1', '3', '4', '6'],
    reason: 'the complete reviewed JMU tree and official source receipt match',
    proof: {
      document_style: style,
      source_tree_sha256: fingerprint,
      source_bundle_sha256: style === 'composed' ? null : JMU_SOURCE_BUNDLE_HASH,
      official_source_sha256: Object.fromEntries(SOURCE_BUNDLE.map(([
        id, , , sha256,
      ]) => [id, sha256])),
    },
  };
}

/**
 * Source-bound disposition for JMU's two graduation GPA gates.  They remain
 * real student-performance conditions, while the exact zero-credit,
 * identity-free policy carriers prove that satisfying them cannot change a
 * paper-figure course choice, prerequisite edge, or applied credit.
 */
function evaluateJmuAdministrativePolicy(document, kind) {
  if (!['minimum_cumulative_gpa', 'minimum_major_gpa'].includes(kind)) return null;
  const exact = exactJmuTree(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  if (number(audit[kind]) !== 2) return null;
  const group = document.requirement_groups?.[10];
  const sectionIndex = kind === 'minimum_cumulative_gpa' ? 1 : 5;
  const expectedLabel = kind === 'minimum_cumulative_gpa'
    ? 'Minimum 2.0 cumulative GPA' : 'Minimum 2.0 major GPA';
  const expectedName = kind === 'minimum_cumulative_gpa'
    ? 'Minimum cumulative GPA of 2.0'
    : 'Complete the Computer Science major with a minimum 2.0 GPA';
  const section = array(group?.sections)[sectionIndex];
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  if (text(group?.title) !== 'University graduation and residence requirements'
      || text(group?.requirement_layer) !== 'university_graduation'
      || text(group?.tier) !== 'nontransferable'
      || text(group?.course_level) !== 'policy'
      || group?.cc_articulable !== false
      || !sameArray(group?.source_refs, ['graduation'])
      || array(group?.sections).length !== 6
      || text(section?.label_seen ?? section?.label) !== expectedLabel
      || number(section?.section_advisement ?? section?.select) !== 1
      || number(section?.unit_advisement ?? section?.units) !== 0
      || receivers.length !== 1
      || text(body?.kind)?.toLowerCase() !== 'requirement'
      || text(body?.name) !== expectedName
      || number(body?.units) !== 0
      || body?.parent_id != null
      || array(body?.parent_ids).length
      || receiverCodes(receivers[0]).length) return null;
  return {
    supported: false,
    affected_figures: [],
    paper_impact_proven: true,
    evaluator: 'evaluateJmuAdministrativePolicy',
    reason: 'the exact JMU GPA carrier is a zero-credit, identity-free student-performance gate; the paper figures condition on successful completion and do not estimate transcript outcomes',
    proof: {
      ...exact.proof,
      condition: kind,
      threshold: 2,
      carrier_path: `requirement_groups[10].sections[${sectionIndex}]`,
      carrier_units: 0,
      carrier_course_identities: 0,
      course_selection_change_when_condition_met: 0,
      credit_unit_change_when_condition_met: 0,
      prerequisite_edge_change_when_condition_met: 0,
      paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
    },
  };
}

function groupByTitle(tree, title) {
  const matches = tree.requirement_groups.filter((group) => group.title === title);
  return matches.length === 1 ? matches[0] : null;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function groupUnits(group, maximum = false) {
  if (!group || group.group_conjunction !== 'and') return null;
  const values = group.sections.map((section) => maximum ? section.units_max : section.units);
  return values.every((value) => Number.isFinite(value)) ? sum(values) : null;
}

function proveMinimumCourseNumberDistribution(container, context = {}) {
  const issue = contextIssue('minimum_course_number_distribution', container, context);
  if (issue) return { supported: false, reason: issue };

  const tree = normalizedJmuProofTree(context.document);
  const group = tree.requirement_groups[1];
  const section = group?.sections?.[0];
  const expected = [
    ['JMUCSELECTIVE300', 'CS elective numbered 300 or above'],
    ['JMUCSELECTIVEABOVE332A', 'CS elective numbered above 332'],
    ['JMUCSELECTIVEABOVE332B', 'Second CS elective numbered above 332'],
  ];
  const categories = section?.receivers || [];
  const exactCategories = categories.length === expected.length
    && categories.every((receiver, index) => (
      receiver.kind === 'ge_area'
      && receiver.codes.length === 1
      && receiver.codes[0] === expected[index][0]
      && receiver.name === expected[index][1]
      && receiver.units === 3
    ));
  if (group?.requirement_layer !== 'major'
      || group?.course_level !== 'upper_division'
      || group?.cc_articulable !== false
      || !sameArray(group?.source_refs, ['major'])
      || group.sections.length !== 1
      || section?.ask !== 3 || section?.units !== 9 || section?.units_max !== 9
      || !exactCategories) {
    return { supported: false, reason: 'JMU upper-level CS distribution is no longer three exact, mandatory major-category slots' };
  }

  return {
    supported: true,
    reason: 'the canonical JMU tree requires all three distinct three-credit major-category slots, including two separately identified above-CS-332 slots',
    proof: {
      source_degree_id: JMU_DEGREE_ID,
      source_tree_sha256: JMU_PROOF_TREE_SHA256,
      source_path: RULES.minimum_course_number_distribution.path,
      selected_category_slots: section.ask,
      category_receiver_count: categories.length,
      above_332_slots: categories.filter((receiver) => receiver.codes[0]?.includes('ABOVE332')).length,
      canonical_units: section.units,
      requirement_role: 'named_major_requirement',
      transferable: false,
    },
  };
}

function proveCorrelatedVariableMajorAndElectiveUnits(container, context = {}) {
  const issue = contextIssue('correlated_variable_major_and_elective_units', container, context);
  if (issue) return { supported: false, reason: issue };

  const tree = normalizedJmuProofTree(context.document);
  const majorGroups = tree.requirement_groups.filter((group) => group.requirement_layer === 'major');
  const geGroups = tree.requirement_groups.filter((group) => group.requirement_layer === 'ge_college');
  const elective = groupByTitle(tree, 'University electives on the canonical 49-credit major path');
  const policy = groupByTitle(tree, 'University graduation and residence requirements');
  const calculus = groupByTitle(tree, 'Calculus sequence');
  const statistics = groupByTitle(tree, 'Statistics');

  const canonicalMajor = sum(majorGroups.map((group) => groupUnits(group)));
  const maximumMajor = sum(majorGroups.map((group) => groupUnits(group, true)));
  const geAndBs = sum(geGroups.map((group) => groupUnits(group)));
  const canonicalElectives = groupUnits(elective);
  const policyUnits = groupUnits(policy);
  const canonicalTotal = canonicalMajor + geAndBs + canonicalElectives + policyUnits;
  const audit = tree.unit_audit || {};
  const calculusReceivers = calculus?.sections?.[0]?.receivers || [];
  const statisticsReceivers = statistics?.sections?.[0]?.receivers || [];
  const exactVariableRoutes = calculus?.sections?.[0]?.ask === 1
    && calculus.sections[0].units === 4
    && calculus.sections[0].units_max === 6
    && calculusReceivers.length === 2
    && calculusReceivers[0].kind === 'course'
    && sameArray(calculusReceivers[0].codes, ['MATH235'])
    && calculusReceivers[0].units === 4
    && calculusReceivers[1].kind === 'series'
    && calculusReceivers[1].conjunction === 'and'
    && sameArray(calculusReceivers[1].codes, ['MATH231', 'MATH232'])
    && calculusReceivers[1].units === 6
    && statistics?.sections?.[0]?.ask === 1
    && statistics.sections[0].units === 3
    && statistics.sections[0].units_max === 4
    && statisticsReceivers.length === 3
    && sameArray(statisticsReceivers.map((receiver) => receiver.codes[0]), [
      'MATH220', 'MATH229', 'MATH318',
    ])
    && sameArray(statisticsReceivers.map((receiver) => receiver.units), [3, 3, 4]);
  const electiveSection = elective?.sections?.[0];
  const electiveReceiver = electiveSection?.receivers?.[0];
  const exactElectiveCapacity = elective?.requirement_layer === 'university_graduation'
    && elective?.course_level === 'elective_capacity'
    && elective?.cc_articulable === true
    && sameArray(elective?.source_refs, ['major', 'graduation', 'policy'])
    && elective.sections.length === 1
    && electiveSection.ask === 1
    && electiveSection.units === 27
    && electiveSection.units_max === 27
    && electiveSection.receivers.length === 1
    && electiveReceiver.kind === 'ge_area'
    && sameArray(electiveReceiver.codes, ['JMUUNIVERSITYELECTIVES'])
    && electiveReceiver.name === 'University elective credit'
    && electiveReceiver.units === 27;
  const exactAccounting = canonicalMajor === 49
    && maximumMajor === 52
    && geAndBs === 44
    && canonicalElectives === 27
    && policyUnits === 0
    && canonicalTotal === 120
    && audit.graduation_minimum === 120
    && audit.modeled_units === 120
    && audit.canonical_major_units === 49
    && audit.major_units_maximum === 52
    && audit.general_education_units === 41
    && audit.bs_quantitative_units_beyond_general_education === 3
    && audit.canonical_university_elective_units === 27
    && audit.university_elective_units_minimum === 24
    && maximumMajor + geAndBs + audit.university_elective_units_minimum === 120;

  if (!exactVariableRoutes || !exactElectiveCapacity || !exactAccounting) {
    return { supported: false, reason: 'JMU canonical/longer major paths no longer reconcile one-for-one with the exact 27-to-24 elective capacity' };
  }

  return {
    supported: true,
    reason: 'all paper readers use the exact 49-credit canonical major path, whose 27-credit elective capacity closes at 120; the only longer routes add exactly the three credits removed by the published 24-credit floor',
    proof: {
      source_degree_id: JMU_DEGREE_ID,
      source_tree_sha256: JMU_PROOF_TREE_SHA256,
      source_path: RULES.correlated_variable_major_and_elective_units.path,
      canonical_major_units: canonicalMajor,
      maximum_major_units: maximumMajor,
      fixed_ge_and_bs_units: geAndBs,
      canonical_elective_units: canonicalElectives,
      minimum_elective_units: audit.university_elective_units_minimum,
      canonical_degree_units: canonicalTotal,
      maximum_major_path_degree_units:
        maximumMajor + geAndBs + audit.university_elective_units_minimum,
      correlated_delta_units: maximumMajor - canonicalMajor,
      requirement_role: 'elective_capacity',
    },
  };
}

module.exports = {
  JMU_CUMULATIVE_GPA_SOURCE_TEXT,
  JMU_MAJOR_GPA_SOURCE_TEXT,
  JMU_PROOF_TREE_SHA256,
  evaluateJmuAdministrativePolicy,
  exactJmuTree,
  jmuProofTreeFingerprint,
  normalizedJmuProofTree,
  proveCorrelatedVariableMajorAndElectiveUnits,
  proveMinimumCourseNumberDistribution,
};
