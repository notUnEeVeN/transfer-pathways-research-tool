/**
 * Exact capability audit for source-authored Virginia bachelor constraints.
 *
 * A constraint label is not an implementation.  This module deliberately
 * keeps the default closed and reports support only when the stored Boolean
 * tree makes the rule mathematically redundant with choices every shared
 * figure consumer already evaluates.  In particular, no overlap, distinct,
 * residence, prerequisite, open-roster, adviser, or course-attribute rule is
 * accepted here. A small set of exact, zero-credit student-performance rules
 * remains unsupported for complete-degree analysis but is proven to have no
 * Figures 3/4 course-or-credit impact; grade/application mixtures still fail
 * closed.
 *
 * The supported cases below all have the same proof obligation:
 *
 *   - the source requires N distinct receiver choices;
 *   - every receiver has a fixed, positive credit value; and
 *   - even the N lowest-credit receivers meet the authored credit floor.
 *
 * Figures 1, 3, 4, and 6 already consume that choose-N tree.  The evaluator
 * therefore proves that a second credit-only solver cannot change the valid
 * choice set.  If the source composition changes, the proof fails closed.
 */

const FIGURES = Object.freeze(['1', '3', '4', '6']);
const {
  evaluateVirginiaResidencyTransferPolicy,
} = require('./virginiaResidencyTransferCaps');
const {
  evaluateJmuAdministrativePolicy,
  proveCorrelatedVariableMajorAndElectiveUnits,
  proveMinimumCourseNumberDistribution,
} = require('./jamesMadisonConstraintProofs');
const {
  proveUmwCapacityContainsOverlappingGeGates,
  proveUmwConditionalTransferWaiver,
  proveUmwDistinctMethodsCategories,
  proveUmwOverlappingAttributeAndCourseRequirements,
  proveWmCapacityReallocationAfterOverlap,
  proveWmColl350AttributeOverlap,
  proveWmCollMajorOverlapLimit,
  sourceSpecificAffectedFigures,
} = require('./maryWashingtonWilliamMaryConstraintProofs');
const {
  evaluateGmuOduStructuralRule,
  evaluateOduAdministrativePolicy,
  evaluateOduRequiredCsGradePolicy,
  proveGmuDistinctCoursesAcrossSections,
  proveGmuNoDoubleCountWithOtherGroups,
  proveGmuPrerequisiteOrDifferentSubject,
  proveOduMinimumUpperLevelCreditsAcrossMenu,
  proveOduNoDoubleCountWithOtherDegreeRequirement,
  proveOduNoDoubleCountWithRequiredMajorChoices,
  proveOduUpperDivisionGeAlternatePath,
} = require('./georgeMasonOldDominionConstraintProofs');
const {
  bridgewaterQualityFlagAffectedFigures,
  bridgewaterSourceSpecificAffectedFigures,
  evaluateBridgewaterConstraint,
  evaluateBridgewaterMajorFieldPolicy,
} = require('./bridgewaterConstraintProofs');
const {
  cnuQualityFlagAffectedFigures,
  cnuSourceSpecificAffectedFigures,
  evaluateCnuConstraint,
} = require('./christopherNewportConstraintProofs');
const {
  evaluateNorfolkStateAdministrativePolicy,
  evaluateNorfolkStateConstraint,
  evaluateNorfolkStateStructuralRule,
  norfolkStateQualityFlagAffectedFigures,
} = require('./norfolkStateConstraintProofs');
const {
  evaluateLongwoodConstraint,
  longwoodQualityFlagAffectedFigures,
  longwoodSourceSpecificAffectedFigures,
} = require('./longwoodConstraintProofs');
const {
  evaluateUvaWiseConstraint,
  evaluateUvaWiseGeConstraint,
  evaluateUvaWiseStructuralRule,
  uvaWiseQualityFlagAffectedFigures,
  uvaWiseSourceSpecificAffectedFigures,
} = require('./uvaWiseConstraintProofs');
const {
  evaluateRadfordConstraint,
  evaluateRadfordStructuralRule,
  radfordQualityFlagAffectedFigures,
  radfordSourceSpecificAffectedFigures,
} = require('./radfordConstraintProofs');
const {
  shenandoahQualityFlagAffectedFigures,
  shenandoahSourceSpecificAffectedFigures,
} = require('./shenandoahConstraintProofs');
const {
  evaluateVcuAdministrativePolicy,
  evaluateVcuConstraint,
  vcuQualityFlagAffectedFigures,
  vcuSourceSpecificAffectedFigures,
} = require('./vcuConstraintProofs');
const {
  evaluateVirginiaTechConstraint,
  virginiaTechQualityFlagAffectedFigures,
  virginiaTechSourceSpecificAffectedFigures,
} = require('./virginiaTechConstraintProofs');
const {
  evaluateVirginiaStateConstraint,
  virginiaStateQualityFlagAffectedFigures,
  virginiaStateSourceSpecificAffectedFigures,
} = require('./virginiaStateConstraintProofs');
const {
  evaluateVmiConstraint,
} = require('./virginiaMilitaryInstituteConstraintProofs');
const {
  evaluateRandolphMaconConstraint,
  randolphMaconQualityFlagAffectedFigures,
  randolphMaconSourceSpecificAffectedFigures,
} = require('./randolphMaconConstraintProofs');
const {
  proveVirginiaBachelorPerformancePolicy,
  virginiaBachelorPerformanceAffectedFigures,
} = require('./virginiaBachelorPerformanceProofs');

const CAPABILITY_STATUSES = new Set([
  'supported',
  // Historical source artifacts recorded this before an evaluator existed.
  // Code capability may supersede it, but never a source-uncertainty status.
  'evaluator_not_implemented',
]);

// A source-authored `block_analysis` flag may describe missing evaluator
// engineering rather than missing catalog evidence.  It is superseded only
// when an explicit mapping points to active exact rules and every mapped rule
// passes its source-bound evaluator.  Unmapped flags, stronger `block`
// severities, duplicate/missing rules, and any proof drift remain blocking.
const ANALYSIS_QUALITY_FLAG_RULES = Object.freeze({
  required_track_choice_correlation: Object.freeze([
    'correlated_required_track_choice',
  ]),
  connected_learning_overlap_and_choice_rules: Object.freeze([
    'transfer_status_course_selection',
    'cross_layer_course_overlap',
    'quantitative_placement_or_course_choice',
    'prerequisite_and_ge_overlap',
    'closed_current_ge_course_menus',
    'full_stack_art321_overlap',
    'capacity_contains_nonadditive_ge_gates',
  ]),
  approved_associate_transfer_exception: Object.freeze([
    'approved_transfer_associate_conditional_exemption',
  ]),
  advanced_selection_variable_topic_credit: Object.freeze([
    'variable_topics_credit_must_close_selection',
  ]),
  liberal_learning_distribution_constraints: Object.freeze([
    'area_of_inquiry_discipline_limits',
    'writing_intensive_attribute_within_capacity',
  ]),
  correlated_major_and_elective_ranges: Object.freeze([
    'correlated_variable_major_and_elective_units',
  ]),
  upper_cs_elective_number_constraint: Object.freeze([
    'minimum_course_number_distribution',
  ]),
  cross_section_science_and_elective_distinctness: Object.freeze([
    'distinct_course_ids_across_sections',
    'distinct_laboratory_science_sequences',
  ]),
  cross_group_variable_credit_dependency: Object.freeze([
    'dependent_elective_capacity',
  ]),
  multiple_languages_overlap_dependency: Object.freeze([
    'major_elective_overlap',
  ]),
  connected_overlap_evaluator_required: Object.freeze([
    'connected_category_distribution_and_overlap',
  ]),
  placement_dependent_cmsc_254: Object.freeze([
    'placement_dependent_introductory_course',
  ]),
  variable_credit_major_electives: Object.freeze([
    'variable_credit_selection_and_repeatability',
  ]),
  variable_credit_cis_elective_menu: Object.freeze([
    'choose_six_credits_from_variable_credit_menu',
    'variable_credit_internship',
  ]),
  major_subject_course_grade_requirement: Object.freeze([
    'minimum_course_grade_by_subject',
  ]),
});

const ANALYSIS_QUALITY_FLAG_RULE_COUNTS = Object.freeze({
  // This is one cross-group policy deliberately repeated on all four exact
  // carriers. Fewer or additional receipts indicate source drift.
  required_track_choice_correlation: Object.freeze({
    correlated_required_track_choice: 4,
  }),
  cross_section_science_and_elective_distinctness: Object.freeze({
    distinct_course_ids_across_sections: 2,
  }),
});

const NON_FIGURE_KINDS = new Set([
  // These are genuine graduation requirements, but neither adds/selects a
  // course, changes credit application, nor adds a prerequisite edge.  They
  // remain unsupported for general degree-completion analysis; this mapping
  // only makes their paper-figure impact explicit.
  'general_education_assessment',
  'gpa_and_administrative_completion',
]);

const FIGURE_3_4_ONLY_KINDS = new Set([
  'articulation_agreement_residency_treatment',
  'conditional_residency_by_advanced_standing',
  'focused_inquiry_grade_and_postmatriculation_transfer_rule',
  'gpa_and_residency',
  'minimum_course_grade',
  'minimum_course_grade_by_subject',
  'minimum_course_grades_and_gpas',
  'overlapping_residency_rules',
  'residency_and_transfer_caps',
  'residency_overlap',
  'transfer_cap_and_residence_overlap',
  'transfer_grade_and_application_review',
]);

const FIGURE_6_ONLY_KINDS = new Set([
  // The selected courses are already fixed elsewhere; these rules add an
  // ordering/dependency condition, which matters to the prerequisite graph.
  'perspectives_sequence',
]);

// These rules cannot be implemented from the stored Boolean tree alone.  The
// official source must first be revisited to close an ambiguous connector,
// enumerate an approved/open roster, or attach the course attributes on which
// the rule depends.  Keeping this list explicit makes the remediation report
// reviewable; a newly invented kind defaults to evaluator engineering rather
// than being silently labeled a scrape problem by a loose text heuristic.
const TARGETED_SOURCE_RESEARCH_KINDS = new Set([
  'area_of_inquiry_discipline_limits',
  'approved_math_elective_level_floor',
  'approved_math_science_menu_with_no_duplicate',
  'approved_science_sequence',
  'civitae_single_count_and_distribution',
  'closed_current_ge_course_menus',
  'connected_category_distribution_and_overlap',
  'contextual_disciplinary_breadth',
  'contextual_subarea_minimums',
  'credit_based_pool_with_unpublished_submenu_distribution',
  'credit_based_variable_science_and_lab_selection',
  'cross_area_course_or_project_forms',
  'cross_dimension_credit_distribution',
  'distinct_laboratory_science_sequences',
  'distinct_methods_categories',
  'foreign_language_proficiency_variable_credit',
  'foreign_language_sequence_or_proficiency',
  'ge_designated_credit_minimum',
  'general_education_single_area_and_major_overlap',
  'humanities_attribute',
  'inclusive_excellence_designation',
  'laboratory_science_attribute',
  'major_discipline_substitution_limit',
  'mathematics_attribute',
  'missing_source_connector',
  'no_double_count_with_prior_major_requirements',
  'nontechnical_course_distribution',
  'official_catalog_wording_conflict',
  'open_course_category_with_exclusions',
  'open_cs_3000_plus_category_with_exclusions',
  'open_subject_level_credit_menu',
  'prefix_and_level_course_menu',
  'prefix_level_exclusion_and_approval_rule',
  'published_total_exceeds_enumerated_rows',
  'school_approved_hss_category',
  'pathways_1a_inside_existing_capacity',
  'pathways_concept_4_natural_science_overlap',
  'pathways_no_degree_core_overlap',
  'pillar_distribution_attributes',
  'two_distinct_lab_sciences_from_approved_disciplines',
  'two_sciences_one_laboratory',
  'upper_level_writing_intensive_course',
  'writing_attentive_overlap',
  'writing_intensive_attribute_within_capacity',
]);

// These are real graduation conditions, but they require student records,
// non-credit participation, or administrative decisions that the paper's
// course/credit figures do not model.  Classification does not make them
// supported: the complete-degree gate remains closed.
const OUT_OF_SCOPE_ADMINISTRATIVE_KINDS = new Set([
  ...NON_FIGURE_KINDS,
  'approved_experience_and_plan',
  'cohort_specific_noncredit_experiences',
  'course_attribute_or_cocurricular_experience',
]);

function classifyFourYearBlocker(value) {
  if (value?.supported === true || value?.blocking === false) return null;
  const kind = kindOf(value);
  const sourceStatus = String(value?.source_status || value?.status || '').trim().toLowerCase();
  if ((sourceStatus && !CAPABILITY_STATUSES.has(sourceStatus))
      || TARGETED_SOURCE_RESEARCH_KINDS.has(kind)
      || value?.disposition === 'exact_accounting_gate') {
    return {
      category: 'targeted_source_research',
      reason: sourceStatus && !CAPABILITY_STATUSES.has(sourceStatus)
        ? `source status ${sourceStatus} is not an evaluator-ready declaration`
        : (value?.disposition === 'exact_accounting_gate'
          ? 'the official totals and selected source tree must first be reconciled'
          : 'the stored tree lacks the closed roster or course attributes required by this rule'),
    };
  }
  if (value?.paper_impact_proven === true
      && Array.isArray(value?.affected_figures)
      && value.affected_figures.length === 0) {
    return {
      category: 'out_of_scope_administrative_rule',
      reason: 'an exact source-bound proof establishes that this student-performance rule changes no course identity or credit consumed by the paper figures',
    };
  }
  if (OUT_OF_SCOPE_ADMINISTRATIVE_KINDS.has(kind)
      || (value?.disposition === 'policy_rule_requires_evaluator'
        && Array.isArray(value?.affected_figures)
        && value.affected_figures.length === 0)) {
    return {
      category: 'out_of_scope_administrative_rule',
      reason: 'the rule depends on student performance, non-credit completion, or administrative state outside the paper model',
    };
  }
  return {
    category: 'evaluator_engineering',
    reason: 'the source rule is explicit, but the current solver does not enforce it',
  };
}

function withRemediation(row) {
  const remediation = classifyFourYearBlocker(row);
  return remediation ? { ...row, remediation } : row;
}

const valueOf = (left, right) => left != null ? left : right;
const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

function kindOf(value) {
  return String(typeof value === 'string' ? value : value?.kind || '').trim();
}

function sectionAsk(section) {
  return Number(valueOf(section?.section_advisement, section?.select));
}

function sectionUnits(section) {
  return Number(valueOf(section?.unit_advisement, section?.units));
}

function receiverUnits(receiver) {
  return Number(valueOf(receiver?.receiving?.units, receiver?.units));
}

function receiverKind(receiver) {
  return String(receiver?.receiving?.kind || receiver?.kind || '').trim().toLowerCase();
}

function receiverCodes(receiver) {
  const raw = receiver?.code_seen
    ?? receiver?.receiving?.code
    ?? receiver?.code
    ?? receiver?.codes
    ?? receiver?.receiving?.codes
    ?? [];
  return (Array.isArray(raw) ? raw : [raw])
    .flatMap((code) => String(code || '').split(/\s*\+\s*|\s+and\s+/i))
    .map((code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
}

function receiverIdentity(receiver) {
  const receiving = receiver?.receiving || {};
  if (receiving.kind === 'series' && Array.isArray(receiving.parent_ids)) {
    return `ids:${receiving.parent_ids.join('+')}`;
  }
  if (receiving.parent_id != null) return `id:${receiving.parent_id}`;
  const codes = receiverCodes(receiver);
  return codes.length ? `codes:${codes.join('+')}` : null;
}

function exactReceiverRoster(section, expectedCodes, {
  openCode = null,
} = {}) {
  const receivers = Array.isArray(section?.receivers) ? section.receivers : [];
  const codes = receivers.map(receiverCodes);
  if (codes.some((entry) => entry.length !== 1)) {
    return { supported: false, reason: 'every source-specific receiver must have one exact course/category code' };
  }
  const actual = codes.flat().sort();
  const expected = [...expectedCodes].sort();
  if (actual.length !== expected.length || actual.some((code, index) => code !== expected[index])) {
    return { supported: false, reason: 'the source-specific receiver roster changed' };
  }
  const invalidKind = receivers.some((receiver, index) => {
    const code = codes[index][0];
    return receiverKind(receiver) !== (code === openCode ? 'ge_area' : 'course');
  });
  if (invalidKind) {
    return { supported: false, reason: 'the source-specific course/category receiver kinds changed' };
  }
  return null;
}

function sectionsOf(container) {
  return Array.isArray(container?.sections) ? container.sections : [];
}

function proveFixedCreditFloor(section, {
  ask = sectionAsk(section),
  floor = sectionUnits(section),
  receiverPredicate = () => true,
} = {}) {
  const receivers = Array.isArray(section?.receivers) ? section.receivers : [];
  if (!Number.isInteger(ask) || ask <= 0 || ask > receivers.length) {
    return { supported: false, reason: 'choose count is absent or exceeds the receiver roster' };
  }
  if (!finitePositive(floor)) {
    return { supported: false, reason: 'credit floor is absent or non-positive' };
  }
  if (!receivers.every(receiverPredicate)) {
    return { supported: false, reason: 'one or more receivers fall outside the evaluator roster' };
  }
  const units = receivers.map(receiverUnits);
  if (units.some((value) => !finitePositive(value))) {
    return { supported: false, reason: 'one or more receiver credit values are open or missing' };
  }
  const identities = receivers.map(receiverIdentity);
  if (identities.some((identity) => !identity)
      || new Set(identities).size !== identities.length) {
    return { supported: false, reason: 'receiver identities are missing or duplicated' };
  }
  const minimum = [...units].sort((a, b) => a - b)
    .slice(0, ask).reduce((sum, value) => sum + value, 0);
  if (minimum + 1e-7 < floor) {
    return {
      supported: false,
      reason: `choose-${ask} can supply only ${minimum} credits against a ${floor}-credit floor`,
    };
  }
  return {
    supported: true,
    reason: `every choose-${ask} selection supplies at least ${minimum} credits for the ${floor}-credit floor`,
    proof: { ask, floor, minimum_receiver_sum: minimum, receiver_count: receivers.length },
  };
}

function singleSectionFloor(container, options = {}) {
  const sections = sectionsOf(container);
  if (sections.length !== 1) {
    return { supported: false, reason: 'evaluator requires exactly one authored section' };
  }
  return proveFixedCreditFloor(sections[0], options);
}

function exactSectionShape(section, { ask, floor, label }) {
  if (sectionAsk(section) !== ask || sectionUnits(section) !== floor) {
    return {
      supported: false,
      reason: `${label} must remain an authored choose-${ask}, ${floor}-credit section`,
    };
  }
  return null;
}

function minimumCreditSelection(container, context = {}) {
  const virginiaState = evaluateVirginiaStateConstraint(container, context);
  if (virginiaState) return virginiaState;
  const sections = sectionsOf(container);
  if (sections.length !== 1) {
    return { supported: false, reason: 'credit-floor evaluator requires exactly one authored section' };
  }
  const section = sections[0];
  if (!(section.receivers || []).every((receiver) => receiverKind(receiver) === 'course')) {
    return { supported: false, reason: 'credit-floor evaluator requires concrete course receivers' };
  }
  const result = proveFixedCreditFloor(section);
  if (!result.supported) return result;
  const ask = sectionAsk(section);
  const maximum = (section.receivers || []).map(receiverUnits)
    .sort((a, b) => b - a).slice(0, ask)
    .reduce((sum, units) => sum + units, 0);
  const authoredMaximum = Number(valueOf(section.unit_advisement_max, section.units_max));
  if (!Number.isFinite(authoredMaximum) || authoredMaximum !== maximum) {
    return {
      supported: false,
      reason: `the authored section ceiling must preserve every legal route through ${maximum} credits`,
    };
  }
  return {
    ...result,
    reason: `${result.reason}; the ${authoredMaximum}-credit ceiling preserves the highest-credit legal selection`,
    proof: { ...result.proof, maximum_receiver_sum: maximum, ceiling: authoredMaximum },
  };
}

function variableTopicsCloseSelection(container) {
  const sections = sectionsOf(container);
  if (sections.length !== 1) {
    return { supported: false, reason: 'topics evaluator requires exactly one authored section' };
  }
  const section = sections[0];
  const rosterIssue = exactReceiverRoster(section, [
    'CPSC425', 'CPSC440', 'CPSC470', 'CPSC471', 'CPSC472', 'CPSC475',
    'CPSC480', 'CPSC495', 'MATH380', 'PCSE495', 'PHYS421', 'PHYS441',
    'CYBR428', 'CNUCPSC500',
  ], { openCode: 'CNUCPSC500' });
  if (rosterIssue) return rosterIssue;
  const shapeIssue = exactSectionShape(section, {
    ask: 3, floor: 9, label: 'topics selection',
  });
  if (shapeIssue) return shapeIssue;
  const result = proveFixedCreditFloor(section, { ask: 3, floor: 9 });
  if (!result.supported) return result;
  const topics = (section.receivers || []).filter((receiver) => (
    receiverCodes(receiver).some((code) => /^(?:CPSC|PCSE)495$/.test(code))
  ));
  if (topics.length !== 2 || topics.some((receiver) => receiverUnits(receiver) !== 3)) {
    return {
      supported: false,
      reason: 'CPSC 495 and PCSE 495 are not both modeled as three-credit qualifying attempts',
    };
  }
  return {
    ...result,
    reason: `${result.reason}; both variable-topics identities are restricted to three-credit qualifying attempts`,
  };
}

function variableCreditInternship(container) {
  const sections = sectionsOf(container);
  if (sections.length !== 1) {
    return { supported: false, reason: 'internship evaluator requires exactly one authored section' };
  }
  const section = sections[0];
  const rosterIssue = exactReceiverRoster(section, [
    'CIS401', 'CIS402', 'CIS477', 'CIS431', 'CIS432', 'CIS434',
    'CIS476W', 'CIS412', 'CIS421', 'CIS422', 'CIS424', 'EE428',
  ]);
  if (rosterIssue) return rosterIssue;
  const shapeIssue = exactSectionShape(section, {
    ask: 1, floor: 3, label: 'internship selection',
  });
  if (shapeIssue) return shapeIssue;
  const result = proveFixedCreditFloor(section, { ask: 1, floor: 3 });
  if (!result.supported) return result;
  const internship = (section.receivers || []).filter((receiver) => (
    receiverCodes(receiver).includes('CIS476W')
  ));
  if (internship.length !== 1 || receiverUnits(internship[0]) !== 3) {
    return {
      supported: false,
      reason: 'CIS 476W is not modeled as one three-credit qualifying attempt',
    };
  }
  return {
    ...result,
    reason: `${result.reason}; CIS 476W is restricted to a three-credit qualifying attempt`,
  };
}

function minimumMajorMenuUnits(container) {
  const sections = sectionsOf(container);
  if (sections.length !== 2) {
    return { supported: false, reason: 'major-menu evaluator requires exactly two authored sections' };
  }
  const majorCodes = [
    'CSC312', 'CSC313', 'CSC314', 'CSC316', 'CSC360', 'CSC369', 'CSC390',
    'CSC373', 'CSC395', 'CSC411', 'CSC420', 'CSC422', 'CSC432', 'CSC435',
    'CSC445', 'CSC449', 'CSC466', 'CSC467', 'CSC470', 'CSC471', 'CSC472',
    'CSC476', 'CSC477', 'CSC485', 'CSC486', 'CSC487', 'CSC488', 'CSC490',
    'CSC492', 'CSC494',
  ];
  const majorRosterIssue = exactReceiverRoster(sections[0], majorCodes);
  if (majorRosterIssue) return { ...majorRosterIssue, reason: `five-course major menu: ${majorRosterIssue.reason}` };
  const sixthRosterIssue = exactReceiverRoster(
    sections[1], [...majorCodes, 'NSUMATH300'], { openCode: 'NSUMATH300' },
  );
  if (sixthRosterIssue) return { ...sixthRosterIssue, reason: `sixth-course menu: ${sixthRosterIssue.reason}` };
  const majorShapeIssue = exactSectionShape(sections[0], {
    ask: 5, floor: 15, label: 'five-course major menu',
  });
  if (majorShapeIssue) return majorShapeIssue;
  const sixthShapeIssue = exactSectionShape(sections[1], {
    ask: 1, floor: 3, label: 'sixth-course menu',
  });
  if (sixthShapeIssue) return sixthShapeIssue;
  const major = proveFixedCreditFloor(sections[0], {
    ask: 5,
    floor: 15,
    receiverPredicate: (receiver) => receiverCodes(receiver).length > 0
      && receiverCodes(receiver).every((code) => /^CSC\d/.test(code)),
  });
  if (!major.supported) return { ...major, reason: `five-course major menu: ${major.reason}` };
  const sixth = proveFixedCreditFloor(sections[1], { ask: 1, floor: 3 });
  if (!sixth.supported) return { ...sixth, reason: `sixth-course menu: ${sixth.reason}` };
  return {
    supported: true,
    reason: 'the first section requires five fixed-credit CSC choices and the second requires one additional three-credit choice',
    proof: { major_menu: major.proof, sixth_menu: sixth.proof },
  };
}

function exactSeriesRoute(receiver, expectedCodes, expectedUnits) {
  if (receiverKind(receiver) !== 'series') {
    return { supported: false, reason: 'the programming bridge route is no longer an indivisible series' };
  }
  const conjunction = String(
    receiver?.receiving?.conjunction ?? receiver?.conjunction ?? 'and',
  ).trim().toLowerCase();
  if (conjunction !== 'and') {
    return { supported: false, reason: 'the programming bridge series no longer requires every course in its route' };
  }
  const actualCodes = receiverCodes(receiver);
  if (actualCodes.length !== expectedCodes.length
      || actualCodes.some((code, index) => code !== expectedCodes[index])) {
    return { supported: false, reason: 'the published programming bridge route roster changed' };
  }
  if (receiverUnits(receiver) !== expectedUnits) {
    return {
      supported: false,
      reason: `the ${expectedCodes.join('+')} route must remain ${expectedUnits} credits`,
    };
  }
  return null;
}

/**
 * ODU publishes three closed programming-language bridge routes.  The source
 * tree stores each route as one indivisible series, so choosing one receiver
 * already enforces both the five-credit minimum and six-credit ceiling.
 */
function variableCreditProgrammingBridge(container) {
  const bridgeSections = sectionsOf(container).filter((section) => (
    String(section?.label ?? section?.label_seen ?? '').trim()
      === 'Programming-language bridge'
  ));
  if (bridgeSections.length !== 1) {
    return { supported: false, reason: 'evaluator requires one published programming-language bridge section' };
  }
  const section = bridgeSections[0];
  const shapeIssue = exactSectionShape(section, {
    ask: 1, floor: 5, label: 'programming-language bridge',
  });
  if (shapeIssue) return shapeIssue;
  if (Number(valueOf(section?.unit_advisement_max, section?.units_max)) !== 6) {
    return { supported: false, reason: 'programming-language bridge must retain its six-credit ceiling' };
  }
  const receivers = Array.isArray(section.receivers) ? section.receivers : [];
  const expected = [
    [['CS251', 'CS260'], 5],
    [['CS253', 'CS260', 'CS261'], 6],
    [['CS250', 'CS261'], 5],
  ];
  if (receivers.length !== expected.length) {
    return { supported: false, reason: 'the published programming bridge route count changed' };
  }
  for (let index = 0; index < expected.length; index += 1) {
    const issue = exactSeriesRoute(receivers[index], expected[index][0], expected[index][1]);
    if (issue) return issue;
  }
  const floor = proveFixedCreditFloor(section, { ask: 1, floor: 5 });
  if (!floor.supported) return floor;
  const maximum = Math.max(...receivers.map(receiverUnits));
  if (maximum !== 6) {
    return { supported: false, reason: 'a legal programming bridge route exceeds the authored ceiling' };
  }
  return {
    supported: true,
    reason: 'every closed bridge route is an indivisible five- or six-credit series inside the authored 5-6 credit bounds',
    proof: {
      ...floor.proof,
      maximum_receiver_units: maximum,
      route_count: receivers.length,
    },
  };
}

/**
 * ODU's only work-experience choices are CS 367 and CS 368.  Each is one
 * distinct three-credit receiver, so a choose-three menu can apply at most the
 * published six work-experience credits without any additional solver state.
 */
function workExperienceCap(container) {
  const sections = sectionsOf(container);
  if (sections.length !== 1) {
    return { supported: false, reason: 'work-experience cap evaluator requires exactly one authored section' };
  }
  const section = sections[0];
  const shapeIssue = exactSectionShape(section, {
    ask: 3, floor: 9, label: 'upper-level CS elective menu',
  });
  if (shapeIssue) return shapeIssue;
  const receivers = Array.isArray(section.receivers) ? section.receivers : [];
  if (!receivers.length || receivers.some((receiver) => (
    receiverKind(receiver) !== 'course' || receiverCodes(receiver).length !== 1
  ))) {
    return { supported: false, reason: 'work-experience cap evaluator requires a closed concrete-course menu' };
  }
  const identities = receivers.map(receiverIdentity);
  if (identities.some((identity) => !identity)
      || new Set(identities).size !== identities.length) {
    return { supported: false, reason: 'upper-level elective receiver identities are missing or duplicated' };
  }
  const workExperience = receivers.filter((receiver) => (
    ['CS367', 'CS368'].includes(receiverCodes(receiver)[0])
  ));
  if (workExperience.length !== 2
      || workExperience.some((receiver) => receiverUnits(receiver) !== 3)) {
    return { supported: false, reason: 'CS 367 and CS 368 must remain the two distinct three-credit work-experience choices' };
  }
  const floor = proveFixedCreditFloor(section, { ask: 3, floor: 9 });
  if (!floor.supported) return floor;
  const maximumWorkExperienceUnits = workExperience.reduce(
    (sum, receiver) => sum + receiverUnits(receiver), 0,
  );
  if (maximumWorkExperienceUnits !== 6) {
    return { supported: false, reason: 'the closed menu can exceed the six-credit work-experience cap' };
  }
  return {
    supported: true,
    reason: 'the closed menu contains only two distinct work-experience receivers at three credits each',
    proof: {
      ...floor.proof,
      work_experience_receiver_count: workExperience.length,
      maximum_work_experience_units: maximumWorkExperienceUnits,
    },
  };
}

function residencyTransferCaps(container, {
  document = null,
  path = null,
  constraint = null,
} = {}) {
  const report = evaluateVirginiaResidencyTransferPolicy(document || {}, {
    container, path, constraint,
  });
  return {
    supported: report.supported,
    reason: report.reason,
    proof: {
      source_policy_id: report.source_policy_id,
      evaluator_version: report.evaluator_version,
      declared_subrules: report.declared_subrules,
      overall_transfer_cap_units: report.overall_transfer_cap_units,
      two_year_transfer_cap_units: report.two_year_transfer_cap_units,
      final_window_transfer_cap_units: report.final_window_transfer_cap_units,
      effective_two_year_transfer_cap_units:
        report.effective_two_year_transfer_cap_units,
      issues: report.issues,
      ...(report.proof ? { source_bound_policy_proof: report.proof } : {}),
    },
  };
}

function evaluateInstitutionSpecificNoDoubleCountWithCore(container, context = {}) {
  const uvaWiseFigures = uvaWiseSourceSpecificAffectedFigures(
    context.constraint,
    {
      container,
      document: context.document,
      path: context.path,
    },
  );
  if (uvaWiseFigures) {
    return {
      supported: false,
      affected_figures: uvaWiseFigures,
      reason: 'the exact UVA Wise upper-major carrier is outside Figures 3/4, but its open course identity and Core reuse rule remain unproved for Figures 1/6',
    };
  }
  return evaluateVcuConstraint(container, context);
}

const EVALUATORS = Object.freeze({
  capacity_contains_nonadditive_ge_gates: evaluateBridgewaterConstraint,
  capacity_contains_overlapping_collegiate_requirements: evaluateRandolphMaconConstraint,
  capacity_contains_overlapping_ge_gates:
    proveUmwCapacityContainsOverlappingGeGates,
  capacity_reallocation_after_overlap: proveWmCapacityReallocationAfterOverlap,
  coll350_attribute_overlap: proveWmColl350AttributeOverlap,
  coll_major_overlap_limit: proveWmCollMajorOverlapLimit,
  conditional_transfer_waiver: proveUmwConditionalTransferWaiver,
  contextual_disciplinary_breadth: evaluateUvaWiseGeConstraint,
  contextual_subarea_minimums: evaluateUvaWiseGeConstraint,
  correlated_required_track_choice: evaluateBridgewaterConstraint,
  correlated_variable_major_and_elective_units:
    proveCorrelatedVariableMajorAndElectiveUnits,
  civitae_single_count_and_distribution: evaluateLongwoodConstraint,
  course_level_menu_and_exclusion: evaluateLongwoodConstraint,
  choose_six_credits_from_variable_credit_menu: evaluateVmiConstraint,
  approved_math_elective_level_floor: evaluateVmiConstraint,
  core_overlay_inside_free_electives: evaluateVmiConstraint,
  cross_layer_course_overlap: evaluateBridgewaterConstraint,
  distinct_laboratory_science_sequences: evaluateNorfolkStateConstraint,
  distinct_methods_categories: proveUmwDistinctMethodsCategories,
  distinct_course_and_exclusion_pool: evaluateLongwoodConstraint,
  distinct_courses_across_sections: proveGmuDistinctCoursesAcrossSections,
  dependent_elective_capacity: evaluateLongwoodConstraint,
  accelerated_composition_credit_award: evaluateUvaWiseConstraint,
  accelerated_language_core_substitution: evaluateUvaWiseConstraint,
  general_education_major_overlap: evaluateNorfolkStateConstraint,
  future_civitae_major_overlap: evaluateLongwoodConstraint,
  honors_math_substitution_and_free_credit_adjustment:
    evaluateVirginiaTechConstraint,
  minimum_credit_selection: minimumCreditSelection,
  minimum_course_number_distribution: proveMinimumCourseNumberDistribution,
  major_course_substitutes_for_core_area: evaluateUvaWiseConstraint,
  major_area_overlap: evaluateRadfordConstraint,
  minimum_major_menu_units: evaluateNorfolkStateConstraint,
  language_placement_route: evaluateLongwoodConstraint,
  major_elective_overlap: evaluateLongwoodConstraint,
  no_double_count_with_core: evaluateInstitutionSpecificNoDoubleCountWithCore,
  no_core_cross_area_double_count: evaluateUvaWiseGeConstraint,
  connected_category_distribution_and_overlap: evaluateVcuConstraint,
  course_attribute_or_cocurricular_experience: evaluateVcuConstraint,
  overlapping_attribute_and_course_requirements:
    proveUmwOverlappingAttributeAndCourseRequirements,
  minimum_upper_level_credits_across_menu:
    proveOduMinimumUpperLevelCreditsAcrossMenu,
  no_double_count_with_other_degree_requirement:
    proveOduNoDoubleCountWithOtherDegreeRequirement,
  no_double_count_with_other_groups: proveGmuNoDoubleCountWithOtherGroups,
  prerequisite_or_different_subject: proveGmuPrerequisiteOrDifferentSubject,
  prerequisite_gate: evaluateLongwoodConstraint,
  perspectives_sequence: evaluateLongwoodConstraint,
  placement_dependent_introductory_course: evaluateVcuConstraint,
  focused_inquiry_grade_and_postmatriculation_transfer_rule: evaluateVcuConstraint,
  gpa_and_residency: evaluateVcuConstraint,
  pathways_concept_4_natural_science_overlap: evaluateVirginiaTechConstraint,
  pathways_1a_inside_existing_capacity: evaluateVirginiaTechConstraint,
  pillar_distribution_attributes: evaluateRandolphMaconConstraint,
  published_first_year_experience_range: evaluateUvaWiseConstraint,
  real_minimum_unique_credit_capacity: evaluateRadfordConstraint,
  no_double_count_with_required_major_choices:
    proveOduNoDoubleCountWithRequiredMajorChoices,
  upper_division_ge_alternate_path: proveOduUpperDivisionGeAlternatePath,
  variable_credit_programming_bridge: variableCreditProgrammingBridge,
  variable_credit_selection_and_repeatability: evaluateVcuConstraint,
  variable_credit_internship: variableCreditInternship,
  variable_topics_credit_must_close_selection: variableTopicsCloseSelection,
  special_topics_and_500_level_limit: evaluateCnuConstraint,
  work_experience_cap: workExperienceCap,
  overlapping_residency_rules: residencyTransferCaps,
  residency_and_transfer_caps: residencyTransferCaps,
  residency_overlap: residencyTransferCaps,
  transfer_cap_and_residence_overlap: residencyTransferCaps,
  transfer_status_course_selection: evaluateBridgewaterConstraint,
  upper_level_distribution_across_degree: evaluateLongwoodConstraint,
  foreign_language_sequence_or_proficiency: evaluateRandolphMaconConstraint,
  distinct_pillar_courses: evaluateRandolphMaconConstraint,
  major_to_pillar_overlap_limit: evaluateRandolphMaconConstraint,
  writing_attentive_overlap: evaluateRandolphMaconConstraint,
  cross_area_overlap_limit: evaluateRandolphMaconConstraint,
  cross_area_course_or_project_forms: evaluateRandolphMaconConstraint,
  elective_minimum_course_level: evaluateRandolphMaconConstraint,
  no_double_count_with_programming_emphasis: evaluateRandolphMaconConstraint,
  special_topics_range_membership: evaluateRandolphMaconConstraint,
  cohort_specific_noncredit_experiences: evaluateRandolphMaconConstraint,
});

function affectedFiguresForConstraint(value, context = {}) {
  const kind = kindOf(value);
  const performance = virginiaBachelorPerformanceAffectedFigures(value, context);
  if (performance !== null) return performance;
  const bridgewater = bridgewaterSourceSpecificAffectedFigures(value, context);
  if (bridgewater) return bridgewater;
  const cnu = cnuSourceSpecificAffectedFigures(value, context);
  if (cnu) return cnu;
  const longwood = longwoodSourceSpecificAffectedFigures(value, context);
  if (longwood) return longwood;
  const randolphMacon = randolphMaconSourceSpecificAffectedFigures(value, context);
  if (randolphMacon) return randolphMacon;
  const radford = radfordSourceSpecificAffectedFigures(value, context);
  if (radford) return radford;
  const shenandoah = shenandoahSourceSpecificAffectedFigures(value, context);
  if (shenandoah) return shenandoah;
  const uvaWise = uvaWiseSourceSpecificAffectedFigures(value, context);
  if (uvaWise) return uvaWise;
  const vcu = vcuSourceSpecificAffectedFigures(value, context);
  if (vcu) return vcu;
  const virginiaTech = virginiaTechSourceSpecificAffectedFigures(value, context);
  if (virginiaTech) return virginiaTech;
  const virginiaState = virginiaStateSourceSpecificAffectedFigures(value, context);
  if (virginiaState) return virginiaState;
  const sourceSpecific = sourceSpecificAffectedFigures(value, context);
  if (sourceSpecific) return sourceSpecific;
  if (NON_FIGURE_KINDS.has(kind)) return [];
  if (FIGURE_3_4_ONLY_KINDS.has(kind)) return ['3', '4'];
  if (FIGURE_6_ONLY_KINDS.has(kind)) return ['6'];
  // Unknown rules are conservatively treated as affecting every paper figure.
  return [...FIGURES];
}

function evaluateFourYearConstraint(value, {
  container = null,
  document = null,
  path = null,
} = {}) {
  const kind = kindOf(value);
  const sourceStatus = String(value?.status || '').trim().toLowerCase() || null;
  const sourceDescription = typeof value?.description === 'string'
    ? value.description.trim() || null : null;
  const affectedFigures = affectedFiguresForConstraint(value, { container, document, path });
  const performance = proveVirginiaBachelorPerformancePolicy(value, {
    container, document, path,
  });
  if (performance) {
    return withRemediation({
      kind: kind || null,
      source_status: sourceStatus,
      source_description: sourceDescription,
      supported: false,
      evaluator: proveVirginiaBachelorPerformancePolicy.name,
      affected_figures: performance.proven === true ? [] : affectedFigures,
      paper_impact_proven: performance.paper_impact_proven === true,
      reason: performance.reason,
      ...(performance.proof ? { proof: performance.proof } : {}),
    });
  }
  const evaluator = EVALUATORS[kind];
  if (!evaluator) {
    return withRemediation({
      kind: kind || null,
      source_status: sourceStatus,
      source_description: sourceDescription,
      supported: false,
      evaluator: null,
      affected_figures: affectedFigures,
      reason: kind ? 'no exact four-year evaluator is registered' : 'constraint kind is missing',
    });
  }
  if (!CAPABILITY_STATUSES.has(sourceStatus)) {
    return withRemediation({
      kind,
      source_status: sourceStatus,
      source_description: sourceDescription,
      supported: false,
      evaluator: evaluator.name,
      affected_figures: affectedFigures,
      reason: `source status ${sourceStatus || '<missing>'} cannot be superseded by evaluator capability`,
    });
  }
  const result = evaluator(container || {}, { document, path, constraint: value });
  return withRemediation({
    kind,
    source_status: sourceStatus,
    source_description: sourceDescription,
    evaluator: evaluator.name,
    affected_figures: affectedFigures,
    ...result,
  });
}

function hasFourYearConstraintEvaluator(value, context = {}) {
  return evaluateFourYearConstraint(value, context).supported === true;
}

function auditConstraintTree(value, {
  active = true,
  rootPath = 'requirement_groups',
  document = null,
} = {}) {
  const rows = [];
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (node.distinct_course_ids_across_sections === true) {
      const structuralContext = {
        kind: 'distinct_course_ids_across_sections',
        path: `${path}.distinct_course_ids_across_sections`,
        document,
      };
      const structural = evaluateGmuOduStructuralRule(structuralContext)
        || evaluateNorfolkStateStructuralRule(structuralContext);
      rows.push(withRemediation({
        path: `${path}.distinct_course_ids_across_sections`,
        kind: 'distinct_course_ids_across_sections',
        active,
        supported: false,
        evaluator: null,
        affected_figures: [...FIGURES],
        reason: 'four-year cross-section distinct-course assignment is not implemented',
        ...(structural || {}),
      }));
    }
    if (finitePositive(node.distinct_areas)) {
      rows.push(withRemediation({
        path: `${path}.distinct_areas`,
        kind: 'distinct_areas',
        active,
        supported: false,
        evaluator: null,
        affected_figures: [...FIGURES],
        reason: 'four-year distinct-area assignment is not implemented',
      }));
    }
    if (typeof node.overlap_key === 'string' && node.overlap_key.trim()) {
      const structural = evaluateGmuOduStructuralRule({
        kind: 'overlap_key',
        path: `${path}.overlap_key`,
        document,
      }) || evaluateRadfordStructuralRule({
        kind: 'overlap_key',
        path: `${path}.overlap_key`,
        document,
      }) || evaluateUvaWiseStructuralRule({
        kind: 'overlap_key',
        path: `${path}.overlap_key`,
        document,
      });
      rows.push(withRemediation({
        path: `${path}.overlap_key`,
        kind: 'overlap_key',
        active,
        supported: false,
        evaluator: null,
        affected_figures: [...FIGURES],
        reason: 'four-year cross-requirement overlap allocation is not implemented',
        ...(structural || {}),
      }));
    }
    (node.analysis_constraints || []).forEach((constraint, index) => {
      rows.push({
        path: `${path}.analysis_constraints[${index}]`,
        active,
        ...evaluateFourYearConstraint(constraint, { container: node, path, document }),
      });
    });
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'analysis_constraints') visit(child, `${path}.${key}`);
    }
  };
  visit(value, rootPath);
  return rows;
}

function declarationStatus(value) {
  return String(value?.status || '').trim().toLowerCase();
}

function canonicalUnitTotal(doc, { upperDivisionOnly = false } = {}) {
  let total = 0;
  for (const group of doc?.requirement_groups || []) {
    const groupUpper = String(group?.course_level || '').toLowerCase() === 'upper_division';
    const allSections = sectionsOf(group);
    const sections = upperDivisionOnly && !groupUpper
      ? allSections.filter((section) => (
        String(section?.course_level || '').toLowerCase() === 'upper_division'
      ))
      : allSections;
    if (upperDivisionOnly && !groupUpper && !sections.length) continue;
    const authoredGroupUnits = Number(group?.group_unit_advisement);
    if (Number.isFinite(authoredGroupUnits) && authoredGroupUnits >= 0
        && (!upperDivisionOnly || groupUpper)) {
      total += authoredGroupUnits;
      continue;
    }
    const units = sections.map(sectionUnits);
    if (!sections.length || units.some((value) => !Number.isFinite(value) || value < 0)) {
      return { supported: false, total: null, reason: 'one or more selected sections lack exact units' };
    }
    const conjunction = String(group?.group_conjunction || group?.conjunction || '').toLowerCase();
    if (conjunction !== 'or' || sections.length === 1) {
      total += units.reduce((sum, value) => sum + value, 0);
      continue;
    }
    const index = group?.canonical_section_index;
    if (Number.isInteger(index) && index >= 0 && index < allSections.length) {
      const selected = allSections[index];
      if (upperDivisionOnly && !groupUpper
          && String(selected?.course_level || '').toLowerCase() !== 'upper_division') continue;
      const selectedUnits = sectionUnits(selected);
      if (!Number.isFinite(selectedUnits) || selectedUnits < 0) {
        return { supported: false, total: null, reason: 'canonical OR section lacks exact units' };
      }
      total += selectedUnits;
    } else if (units.every((value) => value === units[0])) {
      total += units[0];
    } else {
      return { supported: false, total: null, reason: 'unequal OR routes lack a canonical selection' };
    }
  }
  return { supported: true, total };
}

function auditedCoreUnitField(kind, value, doc) {
  const degreeTotal = Number(doc?.total_units);
  if (kind === 'graduation_minimum' || kind === 'modeled_units') {
    const tree = canonicalUnitTotal(doc);
    const supported = finitePositive(value)
      && finitePositive(degreeTotal)
      && Number(value) === degreeTotal
      && (kind !== 'modeled_units'
        || (tree.supported && Math.abs(tree.total - Number(value)) < 1e-7));
    return {
      path: `unit_audit.${kind}`,
      kind,
      value,
      disposition: 'exact_accounting_gate',
      affected_figures: ['3', '4', '6'],
      implemented_by: kind === 'graduation_minimum'
        ? 'degreeAcceptance.unitAuditIssues'
        : 'degreeAcceptance.canonicalUnits',
      supported,
      blocking: !supported,
      reason: supported
        ? `the selected source tree and degree declaration reconcile exactly at ${degreeTotal} credits`
        : (tree.reason || 'the unit declaration, selected source tree, and degree total do not reconcile'),
    };
  }

  const status = declarationStatus(value);
  if (kind === 'upper_division') {
    const noRule = status === 'none_stated' || status === 'not_applicable';
    const upperTree = canonicalUnitTotal(doc, { upperDivisionOnly: true });
    const supported = noRule || (status === 'required'
      && finitePositive(value?.minimum_units)
      && Number.isFinite(Number(value?.modeled_units))
      && Number(value.modeled_units) >= Number(value.minimum_units)
      && upperTree.supported
      && Math.abs(upperTree.total - Number(value.modeled_units)) < 1e-7);
    return {
      path: 'unit_audit.upper_division',
      kind,
      value: value || null,
      disposition: noRule ? 'source_declares_no_rule' : 'exact_accounting_gate',
      affected_figures: noRule ? [] : ['3', '4', '6'],
      implemented_by: 'degreeAcceptance.unitAuditIssues',
      supported,
      blocking: !supported,
      reason: supported
        ? (noRule
          ? 'the official source declares no aggregate upper-division rule'
          : `the selected upper-division tree reconciles at ${upperTree.total} credits against the published minimum`)
        : (upperTree.reason || 'upper-division declaration is missing or cannot be reconciled exactly'),
    };
  }

  const noRule = status === 'none_stated' || status === 'not_applicable';
  const policy = evaluateVirginiaResidencyTransferPolicy(doc);
  return {
    path: 'unit_audit.residency',
    kind,
    value: value || null,
    disposition: noRule ? 'source_declares_no_rule' : 'policy_rule_runtime_evaluated',
    affected_figures: noRule ? [] : ['3', '4'],
    evaluator: policy.evaluator,
    evaluator_version: policy.evaluator_version,
    supported: policy.supported,
    blocking: !policy.supported,
    reason: policy.reason,
    proof: {
      source_policy_id: policy.source_policy_id,
      declared_subrules: policy.declared_subrules,
      overall_transfer_cap_units: policy.overall_transfer_cap_units,
      two_year_transfer_cap_units: policy.two_year_transfer_cap_units,
      final_window_transfer_cap_units: policy.final_window_transfer_cap_units,
      effective_two_year_transfer_cap_units:
        policy.effective_two_year_transfer_cap_units,
      issues: policy.issues,
    },
  };
}

const GPA_FIELD = /(?:^|_)gpa$/i;
const UPPER_LEVEL_ACCOUNTING_FIELD = /(?:upper_division|upper_level)/i;
const RESIDENCY_POLICY_DETAIL_FIELDS = new Set([
  'final_credit_window_units',
  'final_credit_window_residency_units_minimum',
  'final_thirty_resident_units_minimum',
  'four_year_institution_units_minimum',
  'major_residency_fraction_minimum',
  'major_residency_units_minimum',
  'major_upper_division_residency_minimum',
  'major_upper_level_residency_minimum',
  'residency_exact_units_at_25_percent',
  'residency_minimum_percent',
  'resident_semesters_minimum',
  'senior_residency_transfer_units_maximum',
  'senior_residency_derived_institution_units_minimum',
  'senior_residency_window_units',
  'transfer_and_external_credit_units_maximum',
  'transfer_credit_units_maximum',
  'two_year_transfer_maximum_percent',
  'two_year_transfer_units_maximum',
]);
const MAJOR_FIELD_POLICY_FIELDS = new Set([
  'major_field_units_minimum',
  'major_field_units_maximum',
]);
// Exhaustive names currently used only as source/accounting receipts. This is
// deliberately an allowlist: a new scalar, array, or object may encode a real
// policy, so it blocks until a reviewer classifies it here or adds an evaluator.
const KNOWN_ACCOUNTING_FIELDS = new Set([
  'additional_connected_capacity_after_program_overlap',
  'additional_course_units',
  'additional_upper_division_major_units',
  'analysis_constraints',
  'ancillary_and_open_units_on_canonical_path',
  'base_path_upper_level_cs_units',
  'bs_degree_requirement_units_maximum',
  'bs_degree_requirement_units_minimum',
  'bs_quantitative_units_beyond_general_education',
  'canonical_applied_math_units',
  'canonical_closure',
  'canonical_component_units',
  'canonical_core_units',
  'canonical_distinct_coll_and_arts_units',
  'canonical_liberal_arts_core_actual_units',
  'canonical_liberal_arts_core_units_inside_major',
  'canonical_major_and_support_units',
  'canonical_major_path_units',
  'canonical_major_units',
  'canonical_math_and_science_units',
  'canonical_net_liberal_arts_core_units',
  'canonical_path',
  'canonical_real_units_inside_major',
  'canonical_remaining_real_capacity',
  'canonical_university_elective_units',
  'canonical_unrestricted_capacity',
  'closure_basis',
  'computer_competency_required',
  'computer_competency_rule',
  'computer_science_core_units',
  'computer_science_foundation_units',
  'computer_science_specific_prescribed_branch',
  'computer_science_supported_pathway',
  'connected_learning_core_units_maximum',
  'connected_learning_core_units_minimum',
  'core_requirement_units',
  'degree_core_units',
  'elective_subtotal_units',
  'engineering_fixed_general_units',
  'enumerated_major_units',
  'exit_assessment_required',
  'experiential_learning_maximum_percent',
  'fixed_and_choice_units_before_transfer_electives_minimum',
  'fixed_computing_math_and_writing_units',
  'fixed_requirements_before_electives',
  'foundations_of_connected_learning_units_maximum',
  'foundations_of_connected_learning_units_minimum',
  'free_elective_units',
  'general_education_and_elective_capacity_units',
  'general_education_units',
  'general_education_units_maximum',
  'general_education_units_minimum',
  'general_elective_units_maximum',
  'general_elective_units_minimum',
  'generic_multi_pathway_degree',
  'gpa_source_refs',
  'hss_units',
  'laboratory_science_support_units',
  'liberal_learning_unique_nonmajor_units',
  'liberal_learning_units_satisfied_by_major',
  'major_elective_units',
  'major_foundation_units',
  'major_programming_emphasis_units',
  'major_requirement_units',
  'major_scoped_definite_upper_division_units_minimum',
  'major_scoped_upper_division_units_by_track',
  'major_scoped_upper_division_units_minimum',
  'major_shared_core_units',
  'major_units',
  'major_units_maximum',
  'major_upper_division_coursework_units',
  'math_science_elective_units',
  'mathematics_elective_units_minimum',
  'minimum_course_grade',
  'minimum_curriculum_gpa_source_refs',
  'modeled_canonical_units',
  'modeled_units_maximum',
  'modeled_units_minimum',
  'net_pathways_units_after_natural_science_overlap',
  'other_graduation_requirements',
  'post_major_and_general_education_capacity_units',
  'printed_elective_units_maximum',
  'printed_elective_units_minimum',
  'printed_term_subtotals_units',
  'program_core_units',
  'published_component_units_maximum',
  'published_component_units_minimum',
  'published_core_major_units',
  'published_fixed_computer_science_and_mathematics_units',
  'published_general_education_units',
  'published_major_units',
  'published_other_requirement_units',
  'published_program_units',
  'published_program_units_maximum',
  'published_program_units_minimum',
  'published_requirement_table_units_maximum',
  'published_requirement_table_units_minimum',
  'published_requirements_elective_units',
  'published_transfer_elective_units_maximum',
  'published_transfer_elective_units_minimum',
  'remaining_elective_capacity_units',
  'remaining_elective_units',
  'remaining_explicit_general_education_units',
  'required_course_units',
  'restricted_elective_units',
  'rotc_units',
  'selected_track_units',
  'selected_variant_arithmetic',
  'selected_variant_units',
  'software_engineering_and_capstone_units',
  'track_paths',
  'university_elective_units_minimum',
  'unresolved_published_major_difference_units',
  'unrestricted_elective_units',
  'unrestricted_units',
  'upper_cs_elective_units',
  'upper_cs_or_math_elective_units',
  'upper_division_general_education_units_minimum',
  'upper_level_computer_science_elective_units',
  'upper_level_csc_or_data_elective_units',
  'ways_of_learning_units',
]);

/**
 * Enumerate every unit_audit field without turning the audit receipt itself
 * into evaluator capability. Component subtotals remain visible as accounting
 * facts (`supported: null`). Actual graduation policies fail closed unless an
 * exact evaluator exists or the source explicitly says no rule was stated.
 */
function auditUnitDeclarations(doc) {
  const audit = doc?.unit_audit && typeof doc.unit_audit === 'object'
    ? doc.unit_audit : {};
  const rows = [];
  for (const [kind, value] of Object.entries(audit)) {
    if (['graduation_minimum', 'modeled_units', 'upper_division', 'residency'].includes(kind)) {
      rows.push(auditedCoreUnitField(kind, value, doc));
      continue;
    }
    if (GPA_FIELD.test(kind)) {
      const noRule = declarationStatus(value) === 'none_stated'
        || declarationStatus(value) === 'not_applicable';
      const exactAdministrative = noRule ? null
        : (evaluateJmuAdministrativePolicy(doc, kind)
          || evaluateNorfolkStateAdministrativePolicy(doc, kind)
          || evaluateOduAdministrativePolicy(doc, kind)
          || evaluateVcuAdministrativePolicy(doc, kind));
      rows.push({
        path: `unit_audit.${kind}`,
        kind,
        value,
        disposition: noRule ? 'source_declares_no_rule'
          : (exactAdministrative?.paper_impact_proven
            ? 'source_bound_out_of_scope_administrative_rule'
            : 'policy_rule_requires_evaluator'),
        affected_figures: exactAdministrative?.paper_impact_proven
          ? [...exactAdministrative.affected_figures] : [],
        evaluator: exactAdministrative?.evaluator || null,
        supported: noRule,
        blocking: !noRule,
        paper_impact_proven: exactAdministrative?.paper_impact_proven === true,
        reason: noRule
          ? 'the official source declares no graduation GPA rule'
          : (exactAdministrative?.reason
            || 'the GPA policy is preserved, but paper figures do not evaluate student performance'),
        ...(exactAdministrative?.proof ? { proof: exactAdministrative.proof } : {}),
      });
      continue;
    }
    if (kind === 'required_non_elective_cs_minimum_grade') {
      const oduGrade = evaluateOduRequiredCsGradePolicy(doc);
      rows.push({
        path: `unit_audit.${kind}`,
        kind,
        value,
        disposition: 'policy_rule_requires_evaluator',
        affected_figures: oduGrade?.paper_impact_proven === true
          ? [...oduGrade.affected_figures] : ['3', '4'],
        evaluator: oduGrade?.evaluator || null,
        supported: false,
        blocking: true,
        paper_impact_proven: oduGrade?.paper_impact_proven === true,
        reason: oduGrade?.reason
          || 'no evaluator applies the minimum course grade to transfer-credit eligibility',
        ...(oduGrade?.proof ? { proof: oduGrade.proof } : {}),
      });
      continue;
    }
    if (kind === 'senior_assessment_required') {
      const exactAdministrative = value === true
        ? evaluateOduAdministrativePolicy(doc, kind) : null;
      rows.push({
        path: `unit_audit.${kind}`,
        kind,
        value,
        disposition: exactAdministrative?.paper_impact_proven
          ? 'source_bound_out_of_scope_administrative_rule'
          : 'policy_rule_requires_evaluator',
        affected_figures: exactAdministrative?.paper_impact_proven
          ? [...exactAdministrative.affected_figures] : [],
        evaluator: exactAdministrative?.evaluator || null,
        supported: value !== true,
        blocking: value === true,
        paper_impact_proven: exactAdministrative?.paper_impact_proven === true,
        reason: value === true
          ? (exactAdministrative?.reason
            || 'the non-course completion requirement is preserved but not evaluated')
          : 'no active senior-assessment rule is declared',
        ...(exactAdministrative?.proof ? { proof: exactAdministrative.proof } : {}),
      });
      continue;
    }
    if (MAJOR_FIELD_POLICY_FIELDS.has(kind)) {
      const bridgewater = evaluateBridgewaterMajorFieldPolicy(doc, kind, value);
      rows.push({
        path: `unit_audit.${kind}`,
        kind,
        value,
        disposition: bridgewater?.supported
          ? 'source_bound_exact_policy_evaluator' : 'policy_rule_requires_evaluator',
        affected_figures: [...FIGURES],
        evaluator: bridgewater?.evaluator || null,
        supported: bridgewater?.supported === true,
        blocking: bridgewater?.supported !== true,
        reason: bridgewater?.reason
          || 'no evaluator proves every selected track remains inside the published major-field range',
        ...(bridgewater?.proof ? { proof: bridgewater.proof } : {}),
      });
      continue;
    }
    if (RESIDENCY_POLICY_DETAIL_FIELDS.has(kind)) {
      rows.push({
        path: `unit_audit.${kind}`,
        kind,
        value,
        disposition: 'policy_detail_covered_by_residency_blocker',
        affected_figures: ['3', '4'],
        evaluator: null,
        // This is not capability. The primary residency row is the single
        // blocker so one policy is not counted repeatedly for every subtotal.
        supported: null,
        blocking: false,
        reason: 'a detailed residency/transfer fact is inventoried under the primary residency policy blocker',
      });
      continue;
    }
    if (!KNOWN_ACCOUNTING_FIELDS.has(kind)) {
      rows.push({
        path: `unit_audit.${kind}`,
        kind,
        value,
        disposition: 'unknown_policy_object_requires_classification',
        affected_figures: [...FIGURES],
        evaluator: null,
        supported: false,
        blocking: true,
        reason: 'an unclassified unit-audit field may encode a graduation policy and must fail closed',
      });
      continue;
    }
    rows.push({
      path: `unit_audit.${kind}`,
      kind,
      value,
      disposition: UPPER_LEVEL_ACCOUNTING_FIELD.test(kind)
        ? 'upper_level_accounting_fact' : 'accounting_fact',
      affected_figures: [],
      evaluator: null,
      // An audit subtotal is evidence used to inspect the selected source
      // tree, not an independently supported constraint.
      supported: null,
      blocking: false,
      reason: 'accounting metadata is inventoried but does not establish evaluator capability',
    });
  }
  for (const required of ['graduation_minimum', 'modeled_units', 'upper_division', 'residency']) {
    if (!Object.prototype.hasOwnProperty.call(audit, required)) {
      rows.push(auditedCoreUnitField(required, null, doc));
    }
  }
  return rows;
}

function blockingFourYearUnitAuditRules(doc) {
  return auditUnitDeclarations(doc).map(withRemediation)
    .filter((row) => row.blocking === true);
}

/**
 * Inventory both the selected requirement tree and preserved, unselected
 * variants.  Variant constraints remain visible for audit, but cannot block a
 * figure that never projects that variant.
 */
function auditFourYearDocument(doc) {
  const active = [
    ...auditConstraintTree(
      Array.isArray(doc?.analysis_constraints)
        ? { analysis_constraints: doc.analysis_constraints } : {},
      { active: true, rootPath: 'doc', document: doc },
    ),
    ...auditConstraintTree(doc?.unit_audit || {}, {
      active: true,
      rootPath: 'unit_audit',
      document: doc,
    }),
    ...auditConstraintTree(doc?.requirement_groups || [], {
      active: true,
      rootPath: 'requirement_groups',
      document: doc,
    }),
  ];
  const inactive = (doc?.requirement_variants || []).flatMap((variant, index) => (
    auditConstraintTree(variant || {}, {
      active: variant?.selected === true,
      rootPath: `requirement_variants[${index}]`,
      document: doc,
    })
  ));
  const rules = [...active, ...inactive];
  const activeRules = rules.filter((row) => row.active);
  const unitAudit = auditUnitDeclarations(doc).map(withRemediation);
  const blockingRules = [
    ...activeRules.filter((row) => !row.supported),
    ...unitAudit.filter((row) => row.blocking),
  ];
  const remediationCounts = (rows) => Object.fromEntries([
    'targeted_source_research',
    'evaluator_engineering',
    'out_of_scope_administrative_rule',
  ].map((category) => [
      category,
      rows.filter((row) => row.remediation?.category === category).length,
  ]));
  const blockedRulesByFigure = Object.fromEntries(FIGURES.map((figure) => [
    figure,
    blockingRules.filter((row) => row.affected_figures.includes(figure)).length,
  ]));
  return {
    document_id: doc?._id || doc?.slug || null,
    rules,
    active_rules: activeRules,
    inactive_variant_rules: rules.filter((row) => !row.active),
    unit_audit: unitAudit,
    summary: {
      explicit_rules: rules.length,
      active_rules: activeRules.length,
      inactive_variant_rules: rules.filter((row) => !row.active).length,
      supported_active_rules: activeRules.filter((row) => row.supported).length,
      blocked_active_rules: activeRules.filter((row) => !row.supported).length,
      unit_audit_fields: unitAudit.length,
      blocked_unit_audit_rules: unitAudit.filter((row) => row.blocking).length,
      active_rule_remediation: remediationCounts(
        activeRules.filter((row) => !row.supported),
      ),
      all_blocker_remediation: remediationCounts(blockingRules),
      blocked_rules_by_figure: blockedRulesByFigure,
      ready_by_figure: Object.fromEntries(FIGURES.map((figure) => [
        figure, blockedRulesByFigure[figure] === 0,
      ])),
    },
  };
}

/**
 * Re-evaluate implementation-only analysis flags from the current source
 * tree.  The persisted acceptance receipt intentionally remains historical;
 * figure-specific publication can use this audit to distinguish a now-proven
 * evaluator flag from unresolved source evidence without editing the source.
 */
function auditFourYearAnalysisQualityFlags(doc) {
  const constraintAudit = auditFourYearDocument(doc);
  return (Array.isArray(doc?.data_quality_flags) ? doc.data_quality_flags : [])
    .map((flag, index) => {
      const code = String(flag?.code || '').trim() || null;
      const severity = String(flag?.severity || '').trim().toLowerCase();
      const mappedKinds = code ? ANALYSIS_QUALITY_FLAG_RULES[code] || [] : [];
      const ruleReceipts = mappedKinds.map((kind) => {
        const matches = constraintAudit.active_rules.filter((row) => row.kind === kind);
        const expectedCount = ANALYSIS_QUALITY_FLAG_RULE_COUNTS[code]?.[kind] || 1;
        const exactCount = matches.length === expectedCount;
        const allSupported = exactCount && matches.every((row) => (
          row.supported === true
          || (row.paper_impact_proven === true
            && Array.isArray(row.affected_figures)
            && row.affected_figures.length === 0)
        ));
        const evaluators = [...new Set(matches.map((row) => row.evaluator).filter(Boolean))];
        return {
          kind,
          exact_active_rule_count: matches.length,
          expected_active_rule_count: expectedCount,
          supported: allSupported,
          evaluator: allSupported && evaluators.length === 1 ? evaluators[0] : null,
          proof: allSupported
            ? (expectedCount === 1 ? matches[0].proof || null : matches.map((row) => row.proof || null))
            : null,
          reason: !exactCount
            ? (matches.length ? `mapped rule count is ${matches.length}, expected ${expectedCount}` : 'mapped rule is absent')
            : (allSupported
              ? (expectedCount === 1 ? matches[0].reason : `all ${expectedCount} exact source receipts resolve paper-figure impact`)
              : 'one or more exact mapped rule receipts remain unsupported'),
        };
      });
      const implementationOnly = severity === 'block_analysis' && mappedKinds.length > 0;
      const resolved = implementationOnly
        && ruleReceipts.length === mappedKinds.length
        && ruleReceipts.every((row) => row.supported);
      const sourceSpecificFigures = bridgewaterQualityFlagAffectedFigures(flag, doc)
        || cnuQualityFlagAffectedFigures(flag, doc)
        || longwoodQualityFlagAffectedFigures(flag, doc)
        || radfordQualityFlagAffectedFigures(flag, doc)
        || randolphMaconQualityFlagAffectedFigures(flag, doc)
        || shenandoahQualityFlagAffectedFigures(flag, doc)
        || uvaWiseQualityFlagAffectedFigures(flag, doc)
        || vcuQualityFlagAffectedFigures(flag, doc)
        || virginiaTechQualityFlagAffectedFigures(flag, doc)
        || virginiaStateQualityFlagAffectedFigures(flag, doc)
        || norfolkStateQualityFlagAffectedFigures(flag, doc);
      return {
        path: `data_quality_flags[${index}]`,
        code,
        severity,
        message: flag?.message || null,
        blocking_analysis: ['block', 'block_catalog_acceptance', 'block_analysis']
          .includes(severity),
        affected_figures: sourceSpecificFigures || [...FIGURES],
        mapped_constraint_kinds: [...mappedKinds],
        resolved_by_exact_evaluator: resolved,
        rule_receipts: ruleReceipts,
        reason: resolved
          ? 'every explicitly mapped active rule passes its exact source-bound evaluator'
          : (!mappedKinds.length
            ? 'quality flag has no exact evaluator mapping'
            : (severity !== 'block_analysis'
              ? `severity ${severity || '<missing>'} cannot be superseded by evaluator capability`
              : 'one or more mapped rules are absent, duplicated, unsupported, or source-drifted')),
      };
    });
}

module.exports = {
  FIGURES,
  affectedFiguresForConstraint,
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  blockingFourYearUnitAuditRules,
  classifyFourYearBlocker,
  evaluateFourYearConstraint,
  hasFourYearConstraintEvaluator,
  proveFixedCreditFloor,
};
