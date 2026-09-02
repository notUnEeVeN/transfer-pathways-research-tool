/**
 * Receiver-bound Figure 3/4 proof for New River Community College.
 *
 * New River prints two Computer Science Requirement rows (3 credits and
 * 3-5 credits) and a six-to-eight-credit total.  Its approved list mixes
 * singleton courses, four explicit two-course sequences, and the open
 * categories `CSC 1XX` and `World Languages`.  That is not a universal
 * course roster or cardinality rule, so the degree remains closed for every
 * receiver unless a real pair supplies a source-legal route that cannot be
 * improved by any omitted category choice.
 *
 * Virginia Tech initially appeared to have one lower-bound witness: CSC 205 +
 * MTH 266.  The retained Transfer Virginia course entry supplies a decisive
 * condition that the requirement-tree join omitted, however: CSC 205 must be
 * taken with CSC 215 to receive CS 2505 plus elective credit.  The apparent
 * two-course route is therefore invalid.  This module preserves that negative
 * receipt so neither the pair-specific hook nor a later optimistic category
 * heuristic can silently reopen the cell.
 */

const { createHash } = require('node:crypto');
const {
  courseIdFor,
  institutionCourseIdFor,
} = require('../virginia/courseIdentity');
const {
  COLLEGES,
  associateConflictProofTreeFingerprint,
  exactReviewedDocument,
} = require('./associateCollegeConstraintProofs');
const { exactVirginiaTechTree } = require('./virginiaTechConstraintProofs');
const VCCS_REQUISITES = require('../../../scripts/data/va_course_requisites.json');

const FIGURES = Object.freeze(['3', '4']);
const SOURCE_RULE = 'new_river_virginia_tech_six_credit_floor_route';
const TARGET_FIGURE_CONSTRAINT_PATH =
  'requirement_groups[9].analysis_constraints[0]';
const TARGET_FIGURE_CONSTRAINT_KIND =
  'variable_credit_category_with_sequences';
const NEW_RIVER_PROOF_TREE_SHA256 =
  'f8cbfa7a7426ef8aba554b8acdd5bf84b14d1d8ede669477d9caae25fbe109c7';
const VIRGINIA_TECH_SCHOOL_ID = 9230;
const VIRGINIA_TECH_RECEIVING_OWNER = `va:uni:${VIRGINIA_TECH_SCHOOL_ID}`;
const AGREEMENT_ID = 'va:agreement:9230:9311';
const ROUTE_CODES = Object.freeze(['MTH266', 'CSC205']);
const ROUTE_IDS = Object.freeze(ROUTE_CODES.map(courseIdFor));
const REQUIRED_CREDITS_MINIMUM = 6;
const REQUIRED_CREDITS_MAXIMUM = 8;
const RETRACTED_EDGE = Object.freeze({
  sending_code: 'CSC205',
  companion_sending_code: 'CSC215',
  receiving_identifier: 'CS2505',
  receiving_name: 'Intro Computer Organization',
  source_url:
    'https://www.transfervirginia.org/course/D37A690E1F9411F082AC0242AC15010A',
  notes:
    'Must take CSC 205 + 215 to receive CS 2505 + 2XXX. Elective equivalent credit hours varies based on transfer course.',
});

const NAMED_COURSES = Object.freeze([
  'MTH161', 'MTH162', 'MTH167', 'MTH245', 'MTH264', 'MTH265', 'MTH266',
  'BIO101', 'BIO102', 'CHM111', 'CHM112', 'GOL105', 'PHY241', 'PHY242',
  'PHY201', 'CSC205',
]);
const PRINTED_SEQUENCES = Object.freeze([
  Object.freeze(['MTH161', 'MTH162']),
  Object.freeze(['BIO101', 'BIO102']),
  Object.freeze(['CHM111', 'CHM112']),
  Object.freeze(['PHY241', 'PHY242']),
]);
const CATEGORICAL_ALLOWANCES = Object.freeze(['CSC 1XX', 'World Languages']);

// The relevant receipt includes the complete current agreement metadata,
// complete VT Degree Core group metadata, both complete target sections, and
// a whole-tree occurrence audit for the two sending ids.  It is filled from
// the read-only real-data probe and intentionally changes if either edge is
// moved, duplicated, widened, or relabelled.
const AGREEMENT_RECEIPT_SHA256 =
  '637b0853b6dc998a91f91f6682d77154be17cb31e4bc8485d59c7d3af3b9784f';

const TARGET_EDGES = Object.freeze([
  Object.freeze({
    code: 'CSC205', group_index: 0, section_index: 1, receiver_index: 0,
    receiving_code: 'CS2505',
    receiving_parent_id: institutionCourseIdFor(VIRGINIA_TECH_RECEIVING_OWNER, 'CS2505'),
  }),
  Object.freeze({
    code: 'MTH266', group_index: 0, section_index: 5, receiver_index: 0,
    receiving_code: 'MATH2114',
    receiving_parent_id: institutionCourseIdFor(VIRGINIA_TECH_RECEIVING_OWNER, 'MATH2114'),
  }),
]);

const UNIT_RECEIPTS = Object.freeze({
  CSC205: Object.freeze({
    course_id: 1072566431,
    course_key: 'va:CSC205',
    title: 'Computer Organization',
    credits: 3,
    source_url: 'https://courses.vccs.edu/courses/CSC205',
    content_sha256: '8eebc3738da5ae39b63b0852140f51a63a1b561f40f060f2cf70a7296937f445',
    source_page_content_sha256:
      'd12e32d42970aab40937317d9b0384c9347e67f3a623e50bb266c7f33409741e',
    record_html_sha256:
      'be9ef2ec4991077f2a9c78aa76da1cadc14527029ef5a43b4d877c69ace90168',
  }),
  MTH266: Object.freeze({
    course_id: 1032049332,
    course_key: 'va:MTH266',
    title: 'Linear Algebra',
    credits: 3,
    source_url: 'https://courses.vccs.edu/courses/MTH266',
    content_sha256: 'a715f113300a6423f3e61bda98a055fd709c213fa3225621a2ccd25d20214c1f',
    source_page_content_sha256:
      'cdce58889e69cfc3bcbef004f5aa85539fa8edbf0da1a9b360b07a46f8ad4afd',
    record_html_sha256:
      '58de4e8868dc0ff8052221bb7e3eb3e2600568e93143f7f0b626ff890d87e06c',
  }),
});

// Read-only probe result for all current 16 receiver rows when the complete
// named source list is intersected with the real projected bachelor joins.
// It is diagnostic only: a seven-credit witness does not close a row because
// an unenumerated, generally transferable six-credit category route wins the
// planner's smaller-total tie break.
const REAL_PAIR_NAMED_ELIGIBILITY = Object.freeze([
  Object.freeze({ school_id: 9205, school: 'Bridgewater College', codes: Object.freeze(['MTH161', 'MTH245']) }),
  Object.freeze({ school_id: 9206, school: 'Christopher Newport University', codes: Object.freeze(['MTH264', 'MTH266']) }),
  Object.freeze({ school_id: 9210, school: 'George Mason University', codes: Object.freeze(['MTH264', 'MTH265', 'MTH266']) }),
  Object.freeze({ school_id: 9213, school: 'James Madison University', codes: Object.freeze(['MTH245']) }),
  Object.freeze({ school_id: 9214, school: 'Longwood University', codes: Object.freeze(['MTH245']) }),
  Object.freeze({ school_id: 9217, school: 'Norfolk State University', codes: Object.freeze(['CSC205', 'MTH162', 'MTH264']) }),
  Object.freeze({ school_id: 9218, school: 'Old Dominion University', codes: Object.freeze(['BIO101', 'BIO102', 'CHM111', 'CHM112', 'CSC205', 'GOL105', 'MTH264', 'PHY201', 'PHY241', 'PHY242']) }),
  Object.freeze({ school_id: 9219, school: 'Radford University', codes: Object.freeze(['CSC205']) }),
  Object.freeze({ school_id: 9221, school: 'Randolph-Macon College', codes: Object.freeze(['CSC205']) }),
  Object.freeze({ school_id: 9224, school: 'Shenandoah University', codes: Object.freeze([]) }),
  Object.freeze({ school_id: 9226, school: "The University of Virginia's College at Wise", codes: Object.freeze(['MTH264']) }),
  Object.freeze({ school_id: 9228, school: 'University of Mary Washington', codes: Object.freeze([]) }),
  Object.freeze({ school_id: 9229, school: 'Virginia Commonwealth University', codes: Object.freeze(['MTH245', 'MTH264']) }),
  Object.freeze({ school_id: 9230, school: 'Virginia Polytechnic Institute and State University', codes: Object.freeze(['CSC205', 'MTH264', 'MTH266', 'PHY241', 'PHY242']) }),
  Object.freeze({ school_id: 9231, school: 'Virginia State University', codes: Object.freeze([]) }),
  Object.freeze({ school_id: 9233, school: 'William & Mary', codes: Object.freeze(['MTH264']) }),
]);

const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const number = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function exactArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => (
      Array.isArray(expected[index])
        ? exactArray(value, expected[index]) : value === expected[index]
    ));
}

function fail(reason, proof = {}) {
  return {
    handled: true,
    ready: false,
    supported: false,
    affected_figures: [...FIGURES],
    reason,
    proof,
  };
}

function normalizedAgreementMetadata(agreement) {
  return {
    _id: agreement?._id ?? null,
    university_id: agreement?.university_id ?? null,
    college_id: agreement?.college_id ?? null,
    uc_school_id: number(agreement?.uc_school_id),
    community_college_id: number(agreement?.community_college_id),
    university_name: agreement?.university_name ?? null,
    college_name: agreement?.college_name ?? null,
    major: agreement?.major ?? null,
    state: agreement?.state ?? null,
    source: agreement?.source ?? null,
    pairing: agreement?.pairing ?? null,
    derived_from: agreement?.derived_from ?? null,
    articulated_receivers: number(agreement?.articulated_receivers),
    considered_receivers: number(agreement?.considered_receivers),
  };
}

function targetOccurrences(agreement, courseId) {
  const out = [];
  for (const [groupIndex, group] of array(agreement?.requirement_groups).entries()) {
    for (const [sectionIndex, section] of array(group?.sections).entries()) {
      for (const [receiverIndex, receiver] of array(section?.receivers).entries()) {
        for (const [optionIndex, option] of array(receiver?.options).entries()) {
          if (array(option?.course_ids).map(Number).includes(courseId)) {
            out.push({ groupIndex, sectionIndex, receiverIndex, optionIndex });
          }
        }
      }
    }
  }
  return out;
}

function normalizedNewRiverVirginiaTechAgreementReceipt(agreement) {
  const group = agreement?.requirement_groups?.[0] || null;
  return {
    metadata: normalizedAgreementMetadata(agreement),
    degree_core_metadata: group ? Object.fromEntries(
      Object.entries(group).filter(([key]) => key !== 'sections'),
    ) : null,
    target_sections: [group?.sections?.[1] || null, group?.sections?.[5] || null],
    target_occurrences: Object.fromEntries(ROUTE_CODES.map((code) => [
      code, targetOccurrences(agreement, courseIdFor(code)),
    ])),
  };
}

function newRiverVirginiaTechAgreementFingerprint(agreement) {
  return sha256(normalizedNewRiverVirginiaTechAgreementReceipt(agreement));
}

function exactUnitEvidence(rows = VCCS_REQUISITES) {
  const artifactRows = Array.isArray(rows) ? rows : array(rows?.rows);
  const byCode = new Map(artifactRows.map((row) => [text(row?.code), row]));
  const receipts = {};
  for (const [code, expected] of Object.entries(UNIT_RECEIPTS)) {
    const row = byCode.get(code);
    const source = row?.source_evidence || {};
    if (!row
        || number(row.course_id) !== expected.course_id
        || text(row.course_key) !== expected.course_key
        || text(row.title) !== expected.title
        || text(row.status) !== 'parsed'
        || text(row.source) !== 'vccs_master_course_file'
        || text(row.source_url) !== expected.source_url
        || number(row.credits) !== expected.credits
        || text(source.kind) !== 'official_course_entry'
        || text(source.content_sha256) !== expected.content_sha256
        || text(source.source_page_content_sha256) !== expected.source_page_content_sha256
        || text(source.record_html_sha256) !== expected.record_html_sha256
        || text(source.record_boundary) !== 'dl > dt + dd'
        || text(source.requisite_text_boundary) !== '.endtext'
        || text(source.parser_contract) !== 'vccs-master-dt-dd-endtext-v1'
        || !text(source.raw_text).endsWith('3 credits')) {
      return fail(`the exact official VCCS ${code} three-credit entry changed`);
    }
    receipts[code] = {
      course_id: expected.course_id,
      course_key: expected.course_key,
      credits: expected.credits,
      source_url: expected.source_url,
      content_sha256: expected.content_sha256,
      source_page_content_sha256: expected.source_page_content_sha256,
      record_html_sha256: expected.record_html_sha256,
    };
  }
  return { handled: true, ready: true, supported: true, receipts };
}

function exactCarrier(document) {
  const reviewed = exactReviewedDocument(document, COLLEGES.newRiver);
  if (!reviewed.supported) return fail(reviewed.reason, reviewed.proof);
  const proofTreeSha256 = associateConflictProofTreeFingerprint(document);
  if (proofTreeSha256 !== NEW_RIVER_PROOF_TREE_SHA256) {
    return fail('the reviewed New River authored requirement/rule/accounting tree changed');
  }
  const group = document?.requirement_groups?.[9];
  const constraints = array(group?.analysis_constraints);
  const section = group?.sections?.[0];
  const optionSet = document?.option_sets?.computer_science_requirements;
  if (text(group?.title) !== 'Computer Science Requirements'
      || text(group?.group_conjunction).toLowerCase() !== 'and'
      || text(group?.ge_area) !== 'new_river_computer_science_requirements'
      || !exactArray(group?.source_refs, ['major'])
      || group?.units_fill === true
      || constraints.length !== 2
      || text(constraints[0]?.kind) !== 'variable_credit_category_with_sequences'
      || text(constraints[0]?.status) !== 'evaluator_not_implemented'
      || text(constraints[1]?.kind) !== 'no_double_count_across_requirement_slots'
      || text(constraints[1]?.status) !== 'evaluator_not_implemented'
      || array(group?.sections).length !== 1
      || section?.section_advisement != null
      || number(section?.unit_advisement) !== REQUIRED_CREDITS_MINIMUM
      || number(section?.unit_advisement_max) !== REQUIRED_CREDITS_MAXIMUM
      || !exactArray(section?.source_refs, ['major'])
      || array(section?.receivers).length !== 0
      || !optionSet
      || !exactArray(optionSet.source_refs, ['major'])
      || number(optionSet.required_credits_minimum) !== REQUIRED_CREDITS_MINIMUM
      || number(optionSet.required_credits_maximum) !== REQUIRED_CREDITS_MAXIMUM
      || !exactArray(optionSet.named_courses, NAMED_COURSES)
      || !exactArray(optionSet.printed_sequences, PRINTED_SEQUENCES)
      || !exactArray(optionSet.categorical_allowances, CATEGORICAL_ALLOWANCES)) {
    return fail('the exact New River two-slot variable-credit carrier or approved-choice declaration changed');
  }
  const usedOutsideCarrier = new Set();
  for (const [groupIndex, candidateGroup] of array(document?.requirement_groups).entries()) {
    if (groupIndex === 9) continue;
    for (const candidateSection of array(candidateGroup?.sections)) {
      for (const receiver of array(candidateSection?.receivers)) {
        for (const option of array(receiver?.options)) {
          array(option?.course_ids).map(Number).forEach((id) => usedOutsideCarrier.add(id));
        }
      }
    }
  }
  if (ROUTE_IDS.some((id) => usedOutsideCarrier.has(id))) {
    return fail('the exact New River route now overlaps another authored requirement carrier');
  }
  return {
    handled: true,
    ready: true,
    supported: true,
    group,
    group_index: 9,
    aggregate_units_replaced: REQUIRED_CREDITS_MINIMUM,
    source_wide_lower_bound_units: REQUIRED_CREDITS_MINIMUM,
    source_wide_upper_bound_units: REQUIRED_CREDITS_MAXIMUM,
    route_codes: [...ROUTE_CODES],
    route_ids: [...ROUTE_IDS],
    runtime_section: {
      section_advisement: 1,
      unit_advisement: REQUIRED_CREDITS_MINIMUM,
      unit_advisement_max: REQUIRED_CREDITS_MINIMUM,
      source_refs: ['major'],
      receivers: [{
        articulation_status: 'articulated',
        options_conjunction: 'or',
        options: [{
          course_ids: [...ROUTE_IDS],
          course_keys: ROUTE_CODES.map((code) => `va:${code}`),
          course_conjunction: 'and',
        }],
      }],
      groupLabel: 'Computer Science Requirements — exact Virginia Tech route',
      groupIndex: 9,
      sectionIndex: 'source_bound_virginia_tech_floor_route',
      groupConjunction: 'And',
      groupStatedCredits: '6',
      analysisConstraints: [],
      constraintKinds: ['no_double_count_across_requirement_slots'],
      sourceBoundRule: SOURCE_RULE,
    },
    proof: {
      ...reviewed.proof,
      proof_tree_sha256: proofTreeSha256,
      source_bound_rule: SOURCE_RULE,
      source_wide_lower_bound_units: REQUIRED_CREDITS_MINIMUM,
      source_wide_upper_bound_units: REQUIRED_CREDITS_MAXIMUM,
      named_course_count: NAMED_COURSES.length,
      printed_sequence_count: PRINTED_SEQUENCES.length,
      open_categories: [...CATEGORICAL_ALLOWANCES],
      route_codes: [...ROUTE_CODES],
      route_is_universal: false,
    },
  };
}

function exactAgreement(agreements) {
  const rows = array(agreements);
  if (rows.length !== 1) {
    return fail('the New River/Virginia Tech runtime requires exactly one matched agreement');
  }
  const agreement = rows[0];
  const fingerprint = newRiverVirginiaTechAgreementFingerprint(agreement);
  if (fingerprint !== AGREEMENT_RECEIPT_SHA256) {
    return fail('the exact current New River/Virginia Tech agreement edges or pair metadata changed', {
      agreement_receipt_sha256: fingerprint,
    });
  }
  for (const edge of TARGET_EDGES) {
    const section = agreement?.requirement_groups?.[edge.group_index]
      ?.sections?.[edge.section_index];
    const receiver = section?.receivers?.[edge.receiver_index];
    const option = receiver?.options?.[0];
    if (number(section?.section_advisement) !== 1
        || number(section?.unit_advisement) !== 3
        || number(section?.unit_advisement_max) !== 3
        || text(receiver?.articulation_status) !== 'articulated'
        || text(receiver?.code_seen) !== edge.receiving_code
        || text(receiver?.receiving?.kind) !== 'course'
        || number(receiver?.receiving?.parent_id) !== edge.receiving_parent_id
        || number(receiver?.receiving?.units) !== 3
        || array(receiver?.options).length !== 1
        || !exactArray(option?.course_ids, [courseIdFor(edge.code)])
        || !exactArray(option?.course_keys, [`va:${edge.code}`])
        || text(option?.course_conjunction).toLowerCase() !== 'and') {
      return fail(`the exact ${edge.code} to ${edge.receiving_code} agreement edge changed`);
    }
  }
  if (TARGET_EDGES[0].receiving_parent_id === TARGET_EDGES[1].receiving_parent_id
      || TARGET_EDGES[0].section_index === TARGET_EDGES[1].section_index) {
    return fail('the two New River courses no longer map to distinct Virginia Tech requirements');
  }
  return {
    handled: true,
    ready: true,
    supported: true,
    agreement,
    proof: {
      agreement_id: AGREEMENT_ID,
      agreement_receipt_sha256: fingerprint,
      supply_edges: 185,
      articulated_receivers: 13,
      considered_receivers: 36,
      target_edges: TARGET_EDGES.map((edge) => ({ ...edge })),
    },
  };
}

function newRiverVirginiaTechFigure34PairProof({
  associateDocument,
  bachelorDocument,
  agreements,
  requisiteRows = VCCS_REQUISITES,
} = {}) {
  const carrier = exactCarrier(associateDocument);
  if (!carrier.supported) return carrier;
  const bachelor = exactVirginiaTechTree(bachelorDocument);
  if (!bachelor.supported) return fail(bachelor.reason, carrier.proof);
  const agreement = exactAgreement(agreements);
  if (!agreement.supported) return agreement;
  const unitEvidence = exactUnitEvidence(requisiteRows);
  if (!unitEvidence.supported) return unitEvidence;
  // The rebuilt requirement join records CSC 205 as a singleton CS 2505 edge,
  // but Transfer Virginia's own course record makes that award conditional on
  // also taking CSC 215. New River's six-credit category cannot add CSC 215 to
  // CSC 205 + MTH 266 without becoming a nine-credit route, above the printed
  // 6-8 credit range. Preserve the exact negative receipt and never expose a
  // ready capability from the lossy agreement projection.
  return fail(
    'the apparent CSC 205 to CS 2505 edge is conditional on also taking CSC 215, so CSC 205 + MTH 266 is not a valid six-credit Virginia Tech route',
    {
      ...carrier.proof,
      bachelor_document_style: bachelor.proof?.document_style || null,
      bachelor_proof_tree_sha256: bachelor.proof?.proof_tree_sha256 || null,
      ...agreement.proof,
      unit_receipts: unitEvidence.receipts,
      retracted_route_codes: [...ROUTE_CODES],
      conditional_edge: { ...RETRACTED_EDGE },
      conditional_route_units: 9,
      source_category_maximum_units: carrier.source_wide_upper_bound_units,
      receiver_bound: true,
      other_receiver_rows_opened: 0,
      figure_6_opened: false,
      prior_positive_capability_retracted: true,
    },
  );
}

/**
 * Resolve only the one pair-scoped New River Figure 3/4 capability blocker.
 *
 * `readinessForProjectedFigures` remains the authority for source acceptance,
 * current human review, projection linkage, and every other constraint.  The
 * pair proof can remove one exact active-rule row; it cannot stamp the source
 * verified, clear an unrelated conflict, or turn the complete degree ready.
 * The historical projected `analysis_ready` flag may be false solely because
 * this now-executable rule remains a complete-degree blocker.  Mirror the
 * publication gate's normal exact-evaluator exception only after every other
 * requested-figure blocker (including human review) has passed.
 */
function newRiverVirginiaTechFigure34Readiness(document, readiness, pairProof) {
  const base = readiness && typeof readiness === 'object' ? readiness : {};
  const figureBlockers = array(base.figure_constraint_blockers);
  const capability = pairProof?.ready === true
    && pairProof?.proof?.source_bound_rule === SOURCE_RULE
    && pairProof?.proof?.proof_tree_sha256 === NEW_RIVER_PROOF_TREE_SHA256
    && exactArray(base.figures, FIGURES);
  const matching = figureBlockers.filter((row) => (
    text(row?.path) === TARGET_FIGURE_CONSTRAINT_PATH
      && text(row?.kind) === TARGET_FIGURE_CONSTRAINT_KIND
  ));
  if (!capability || matching.length !== 1) {
    return {
      ...base,
      source_pair_figure_capability: false,
      source_pair_figure_ready: false,
      source_pair_resolved_constraint_count: 0,
      source_pair_resolved_constraint_paths: [],
    };
  }

  const remainingFigureBlockers = figureBlockers.filter((row) => row !== matching[0]);
  let blockers = array(base.blockers);
  if (remainingFigureBlockers.length === 0) {
    blockers = blockers.filter((blocker) => (
      blocker !== 'associate_constraint_evaluator_required'
    ));
  }

  // A false persisted analysis stamp is not independent evidence when the
  // exact rule was its sole requested-figure failure.  Preserve it whenever
  // any real source/review/projection blocker remains.
  const withoutProjectionStamp = blockers.filter((blocker) => (
    blocker !== 'explicit_analysis_ready_projection_required'
  ));
  if (document?.analysis_ready !== true
      && base.complete_degree_ready === false
      && remainingFigureBlockers.length === 0
      && withoutProjectionStamp.length === 0) {
    blockers = withoutProjectionStamp;
  }

  blockers = [...new Set(blockers)];
  const ready = blockers.length === 0;
  const label = text(base.label) || 'Virginia source';
  const figures = exactArray(base.figures, FIGURES) ? [...FIGURES] : array(base.figures);
  return {
    ...base,
    ready,
    blockers,
    route: ready ? 'ready'
      : (blockers.includes('current_human_verification_required')
        ? 'human_verification' : base.route),
    figure_constraint_blockers: remainingFigureBlockers,
    warning: ready ? null
      : `${label} is not publication-ready for figures ${figures.join('/')}`
        + ` (${blockers.join(', ')}).`,
    source_pair_figure_capability: true,
    source_pair_figure_ready: ready,
    source_pair_resolved_constraint_count: 1,
    source_pair_resolved_constraint_paths: [TARGET_FIGURE_CONSTRAINT_PATH],
  };
}

function newRiverVirginiaTechRuntimeSectionMatches(section, pairProof) {
  if (pairProof?.ready !== true
      || pairProof?.proof?.source_bound_rule !== SOURCE_RULE
      || section?.sourceBoundRule !== SOURCE_RULE) return false;
  return sha256(section) === sha256(pairProof?.carrier?.runtime_section);
}

function newRiverVariableCategoryNegativeProof(document) {
  const carrier = exactCarrier(document);
  if (!carrier.supported) return carrier;
  return fail(
    'the source has no universal roster/cardinality, and the sole apparent Virginia Tech floor route is invalidated by its omitted CSC 215 condition; all sixteen receiver rows remain closed',
    {
      ...carrier.proof,
      real_receiver_pair_count: REAL_PAIR_NAMED_ELIGIBILITY.length,
      receiver_rows_remaining_closed: REAL_PAIR_NAMED_ELIGIBILITY.length,
      receiver_rows_with_pair_bound_lower_floor_witness: [],
      rejected_receiver_row: VIRGINIA_TECH_SCHOOL_ID,
      rejected_route_codes: [...ROUTE_CODES],
      rejected_route_reason:
        'CSC 205 requires CSC 215 for the CS 2505 award, producing nine category credits with MTH 266 against the published eight-credit maximum',
      conditional_edge: { ...RETRACTED_EDGE },
      named_eligibility_probe: REAL_PAIR_NAMED_ELIGIBILITY.map((row) => ({
        school_id: row.school_id,
        school: row.school,
        codes: [...row.codes],
      })),
      missing_source_fact_for_other_rows:
        'destination-specific exact approved choices that fill the six-credit floor, or a complete current category roster and cardinality/topology rule',
      optimistic_seven_or_eight_credit_witness_is_sufficient: false,
    },
  );
}

module.exports = {
  AGREEMENT_ID,
  AGREEMENT_RECEIPT_SHA256,
  CATEGORICAL_ALLOWANCES,
  FIGURES,
  NAMED_COURSES,
  NEW_RIVER_PROOF_TREE_SHA256,
  PRINTED_SEQUENCES,
  REAL_PAIR_NAMED_ELIGIBILITY,
  RETRACTED_EDGE,
  ROUTE_CODES,
  ROUTE_IDS,
  SOURCE_RULE,
  TARGET_FIGURE_CONSTRAINT_KIND,
  TARGET_FIGURE_CONSTRAINT_PATH,
  TARGET_EDGES,
  UNIT_RECEIPTS,
  VIRGINIA_TECH_SCHOOL_ID,
  exactCarrier,
  exactUnitEvidence,
  newRiverVariableCategoryNegativeProof,
  newRiverVirginiaTechAgreementFingerprint,
  newRiverVirginiaTechFigure34PairProof,
  newRiverVirginiaTechFigure34Readiness,
  newRiverVirginiaTechRuntimeSectionMatches,
  normalizedNewRiverVirginiaTechAgreementReceipt,
};
