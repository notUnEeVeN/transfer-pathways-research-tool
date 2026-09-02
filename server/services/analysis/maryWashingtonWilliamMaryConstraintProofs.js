/**
 * Exact, source-bound paper-figure proofs for Mary Washington and William &
 * Mary.
 *
 * These evaluators do not interpret labels or catalog prose.  They accept only
 * the reviewed institution identity, structured requirement layers/source
 * references, exact category carriers, and the reconciled unit-audit fields
 * preserved in both the composition and canonical projection.  A changed
 * roster, ask, unit value, layer, source reference, or accounting total fails
 * closed.
 *
 * The proofs are deliberately narrower than complete degree completion:
 *
 * - UMW's GE attributes/method categories are zero-unit gates inside one
 *   explicit 74-credit capacity block.  The transfer-only FSEM waiver is also
 *   encoded as a zero-unit gate.  No paper consumer can gross-add those gates.
 * - William & Mary's selected canonical route explicitly keeps 34 COLL/arts
 *   credits distinct from the 48-credit major and uses 38 remaining credits.
 *   That zero-overlap route is legal under an overlap *limit*, and COLL 350 is
 *   encoded as a zero-credit attribute.
 *
 * Open course identities, variable language coursework, and residency rules
 * are intentionally not inferred from labels. William & Mary's exact
 * residency receipt is handled only through a retained whole-source evidence
 * digest and an exact zero-unit carrier/tree proof. For Figures 3/4 only, the
 * optimistic/lower-bound paper method may select one of the catalog's three
 * exact zero-course language-proficiency routes; Figure 6 remains blocked
 * because that student-specific rule does not identify one prerequisite graph.
 */

const { createHash } = require('node:crypto');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const WM_CURRENT_FIGURE_EVIDENCE = require(
  '../../.va-catalogs/research/william-mary-current-catalog-figure-evidence.json'
);

const UMW = 'university-of-mary-washington';
const WM = 'william-mary';
const UMW_RESIDENCY_RULE = 'At least 30 academic credits must be earned at UMW, at least half of the major must be earned at UMW, and at least 15 of the final 21 credits must be earned at UMW subject to the published active-duty military waiver.';
const UMW_FIXED_RESIDENT_MAJOR = Object.freeze([
  ['CPSC302', 3], ['CPSC305', 4], ['CPSC326', 4],
  ['CPSC340', 4], ['CPSC350', 4], ['CPSC405', 4], ['CPSC430', 4],
  ['UMW-CPSC-CYBR-400', 3], ['UMW-CPSC-CYBR-MATH-300', 3],
]);
const NUMERIC_INSTITUTION_IDS = Object.freeze({
  [UMW]: '9228',
  [WM]: '9233',
});
const WM_SOURCE_BUNDLE_SHA256 =
  '7e26dbfdf181bea3d29b1ffbfc7e81765a0b6cf9bde23d7d183a4785f83a5354';
const WM_SOURCE_SHA256 = Object.freeze({
  major: '61508bd1e00785b92456b51c694a3cdeb3e187e99cfa4d0ebf7b06e0706c088f',
  general_education: 'c4096bde6c76f6c56e6799d02ab0fd979e634c020efa91564ade90e0237ab579',
  college: '1069ac471cd4f93387642686ef2aa3e187f7b9d39147ed00193fe544eec65539',
  policy: '6f056eae90a36f2c88ab604394d0c3eb4b6bcb415c131c5eb99d439693b495b4',
  course_catalog: '28ea797fb6cdb750e5b5cb7547e5441b7918dbb352611280400b32c9ba92812f',
});
const WM_RESIDENCY_GROUP_SEMANTIC_SHA256 =
  '7871a8d6cbbbc56ff3d5a9ccb4bdc9754545b6ba03f84f616166560922a32e25';
const WM_MAJOR_GROUPS_SEMANTIC_SHA256 =
  '2aacd0a632e3dc0c976bc7cbce0b80fd3903f669c9d67532d17c75661653d3d1';
const WM_TRANSFER_RESIDENCY_EVIDENCE_SHA256 =
  '518407893a55cb261507a521eb075246a575aa8d8313663048cc39ee56821a3b';
const WM_GENERAL_CONCENTRATION_EVIDENCE_SHA256 =
  'c868492c1a861c2f5ba80c11bea55410e765925b40d6638c14e7d9cd6d45bd76';
const WM_FOREIGN_LANGUAGE_EVIDENCE_SHA256 =
  '2c106b159602e73decdc9238b3ba1abebb3e1510fe1bdcebd552bf822c991a7f';
const WM_DEGREE_POLICY_RESPONSE_SHA256 =
  '0fa9acb97573a446ebf90ed18e6a22fbba2c010d776f620e42847452030dfa37';
const WM_FIXED_RESIDENT_UPPER_CORE = Object.freeze([
  'CSCI301', 'CSCI303', 'CSCI304', 'CSCI312', 'CSCI423',
]);

const UMW_GE_SECTIONS = Object.freeze([
  { ask: 1, units: 0, codes: ['UMW-GE-FSEM'] },
  { ask: 1, units: 0, codes: ['UMW-GE-WRITING-INTENSIVE-3'] },
  { ask: 1, units: 0, codes: ['UMW-GE-SPEAKING-INTENSIVE'] },
  { ask: 1, units: 0, codes: ['UMW-GE-LANGUAGE-201'] },
  { ask: 1, units: 0, codes: ['UMW-GE-ARTS-LITERATURE'] },
  { ask: 1, units: 0, codes: ['UMW-GE-HUMANITIES'] },
  { ask: 1, units: 0, codes: ['UMW-GE-NATURAL-SCIENCE-LAB'] },
  { ask: 1, units: 0, codes: ['UMW-GE-QUANTITATIVE-REASONING'] },
  { ask: 1, units: 0, codes: ['UMW-GE-SOCIAL-SCIENCE'] },
  {
    ask: 2,
    units: 0,
    codes: [
      'UMW-GE-ADDITIONAL-ARTS-LITERATURE',
      'UMW-GE-ADDITIONAL-HUMANITIES',
      'UMW-GE-ADDITIONAL-NATURAL-SCIENCE',
      'UMW-GE-ADDITIONAL-QUANTITATIVE',
      'UMW-GE-ADDITIONAL-SOCIAL-SCIENCE',
    ],
  },
  { ask: 1, units: 0, codes: ['UMW-GE-DIGITAL-INTENSIVE'] },
  { ask: 1, units: 0, codes: ['UMW-GE-DIVERSE-GLOBAL'] },
  { ask: 1, units: 0, codes: ['UMW-GE-BEYOND-CLASSROOM'] },
  { ask: 1, units: 0, codes: ['UMW-GE-AFTER-MARY-WASHINGTON'] },
  { ask: 1, units: 0, codes: ['UMW-GE-WRITING-IN-MAJOR'] },
  { ask: 1, units: 0, codes: ['UMW-GE-SPEAKING-IN-MAJOR'] },
]);

const WM_COLL_SECTIONS = Object.freeze([
  { ask: 1, units: 4, codes: ['WM-COLL100'] },
  { ask: 1, units: 4, codes: ['WM-COLL150'] },
  { ask: 1, units: 9, codes: ['WM-COLL200-DOMAINS'] },
  { ask: 1, units: 9, codes: ['WM-COLL-DOMAIN-ADDITIONAL'] },
  { ask: 1, units: 3, codes: ['WM-COLL300'] },
  { ask: 1, units: 0, codes: ['WM-COLL350'] },
  { ask: 1, units: 3, codes: ['WM-COLL400'] },
  { ask: 1, units: 2, codes: ['WM-ARTS-PROFICIENCY'] },
  { ask: 1, units: 0, codes: ['WM-LANGUAGE-202-203'] },
  { ask: 1, units: 0, codes: ['WM-WRITING-PROFICIENCY'] },
  { ask: 1, units: 0, codes: ['WM-MATHEMATICS-PROFICIENCY'] },
]);

const finite = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;
const fail = (reason) => ({ supported: false, reason });
const pass = (reason, proof) => ({ supported: true, reason, proof });

function exactInstitution(doc, expected) {
  const numeric = NUMERIC_INSTITUTION_IDS[expected];
  let checked = 0;
  const exactField = (value, allowed) => {
    const actual = String(value || '').trim();
    if (!actual) return true;
    checked += 1;
    return allowed.includes(actual);
  };
  if (!exactField(doc?.slug, [expected])
      || !exactField(doc?.institution_id, [`va:uni:${expected}`, `va:uni:${numeric}`])
      || !exactField(doc?._id, [
        `va:degree:${expected}:cs`,
        `degree:${numeric}:va-cs`,
      ])
      || !exactField(doc?.va_requirement_id, [`va:degree:${expected}:cs`])) {
    return fail('one or more document identity fields name a different institution');
  }
  if (!checked) return fail('the reviewed institution identity is absent');
  return null;
}

function exactSet(actual, expected) {
  if (!Array.isArray(actual)) return false;
  const left = [...new Set(actual.map(String))].sort();
  const right = [...new Set(expected.map(String))].sort();
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function groupMetadataIssue(group, {
  layer, tier, courseLevel, ccArticulable, sourceRefs,
}) {
  if (String(group?.requirement_layer || '') !== layer
      || String(group?.tier || '') !== tier
      || String(group?.course_level || '') !== courseLevel
      || group?.cc_articulable !== ccArticulable) {
    return fail('the source-specific requirement-layer metadata changed');
  }
  if (!exactSet(group?.source_refs, sourceRefs)) {
    return fail('the source-specific official source references changed');
  }
  return null;
}

function sectionAsk(section) {
  return finite(section?.section_advisement ?? section?.select);
}

function sectionUnits(section) {
  return finite(section?.unit_advisement ?? section?.units);
}

function sectionUnitsMax(section) {
  return finite(section?.unit_advisement_max ?? section?.units_max);
}

function receiverKind(receiver) {
  return String(receiver?.receiving?.kind ?? receiver?.kind ?? '').trim().toLowerCase();
}

function receiverCode(receiver) {
  return String(
    receiver?.receiving?.code ?? receiver?.code ?? receiver?.code_seen ?? '',
  ).toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function receiverUnits(receiver) {
  return finite(receiver?.receiving?.units ?? receiver?.units);
}

function receiverBody(receiver) {
  return receiver?.receiving && typeof receiver.receiving === 'object'
    ? receiver.receiving : receiver || {};
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sectionKey(codes) {
  return [...codes].sort().join('|');
}

function exactCategorySections(group, expectedSections) {
  const sections = Array.isArray(group?.sections) ? group.sections : [];
  if (sections.length !== expectedSections.length) {
    return fail('the source-specific category section count changed');
  }
  const expectedByKey = new Map(expectedSections.map((section) => [
    sectionKey(section.codes), section,
  ]));
  if (expectedByKey.size !== expectedSections.length) {
    return fail('the evaluator roster contains a duplicate section');
  }
  const seen = new Set();
  for (const section of sections) {
    const receivers = Array.isArray(section?.receivers) ? section.receivers : [];
    const codes = receivers.map(receiverCode);
    if (!receivers.length || codes.some((code) => !code)
        || new Set(codes).size !== codes.length) {
      return fail('a source-specific category section has missing or duplicate receiver identities');
    }
    const key = sectionKey(codes);
    const expected = expectedByKey.get(key);
    if (!expected || seen.has(key)) {
      return fail('the source-specific category receiver roster changed');
    }
    seen.add(key);
    if (sectionAsk(section) !== expected.ask || sectionUnits(section) !== expected.units) {
      return fail('a source-specific category ask or unit value changed');
    }
    const maximum = sectionUnitsMax(section);
    if (maximum != null && maximum !== expected.units) {
      return fail('a fixed source-specific category acquired a different unit ceiling');
    }
    if (receivers.some((receiver) => (
      receiverKind(receiver) !== 'ge_area'
        || receiverUnits(receiver) !== expected.units / receivers.length
    ))) {
      // All reviewed multi-receiver sections here are zero-unit category gates;
      // every positive section is one aggregate category carrier.
      return fail('a source-specific category receiver kind or unit value changed');
    }
  }
  if (seen.size !== expectedByKey.size) {
    return fail('one or more source-specific category sections are absent');
  }
  return null;
}

function groupsOf(doc) {
  return Array.isArray(doc?.requirement_groups) ? doc.requirement_groups : [];
}

function groupsWithConstraint(doc, kind) {
  return groupsOf(doc).filter((group) => (
    (group?.analysis_constraints || []).some((constraint) => constraint?.kind === kind)
  ));
}

function groupsWithReceiverCode(doc, code) {
  return groupsOf(doc).filter((group) => (
    (group?.sections || []).some((section) => (
      (section?.receivers || []).some((receiver) => receiverCode(receiver) === code)
    ))
  ));
}

function exactOne(values, description) {
  return values.length === 1 ? { value: values[0] }
    : { issue: fail(`the document must contain exactly one ${description}`) };
}

function groupSelectedUnits(group) {
  let total = 0;
  for (const section of group?.sections || []) {
    const units = sectionUnits(section);
    const ask = sectionAsk(section);
    if (units == null || units < 0 || !Number.isInteger(ask) || ask <= 0) return null;
    total += units;
  }
  return total;
}

function selectedUnits(groups) {
  let total = 0;
  for (const group of groups) {
    const units = groupSelectedUnits(group);
    if (units == null) return null;
    total += units;
  }
  return total;
}

function exactSingletonCapacity(group, {
  code, units, sourceRefs,
}) {
  const metadata = groupMetadataIssue(group, {
    layer: 'ge_college',
    tier: 'breadth',
    courseLevel: 'mixed',
    ccArticulable: true,
    sourceRefs,
  });
  if (metadata) return metadata;
  return exactCategorySections(group, [{ ask: 1, units, codes: [code] }]);
}

function umwGeGroupIssue(group) {
  const metadata = groupMetadataIssue(group, {
    layer: 'ge_college',
    tier: 'breadth',
    courseLevel: 'mixed',
    ccArticulable: true,
    sourceRefs: ['general_education', 'college'],
  });
  return metadata || exactCategorySections(group, UMW_GE_SECTIONS);
}

function umwCanonicalRepresentation(doc) {
  const identity = exactInstitution(doc, UMW);
  if (identity) return identity;
  if (finite(doc?.total_units) !== 120
      || (finite(doc?.total_units_max) != null && finite(doc.total_units_max) !== 120)) {
    return fail('UMW degree totals changed from the reviewed 120-credit source');
  }
  const audit = doc?.unit_audit || {};
  if (finite(audit.graduation_minimum) !== 120
      || finite(audit.modeled_units) !== 120
      || finite(audit.canonical_major_path_units) !== 46
      || finite(audit.general_education_and_elective_capacity_units) !== 74) {
    return fail('UMW canonical unit-audit fields no longer reconcile 46 + 74 = 120');
  }
  const gateMatch = exactOne(
    groupsWithConstraint(doc, 'overlapping_attribute_and_course_requirements'),
    'UMW overlapping-GE gate group',
  );
  if (gateMatch.issue) return gateMatch.issue;
  const gateIssue = umwGeGroupIssue(gateMatch.value);
  if (gateIssue) return gateIssue;

  const capacityMatch = exactOne(
    groupsWithReceiverCode(doc, 'UMW-GE-ELECTIVE-CAPACITY'),
    'UMW GE/elective capacity group',
  );
  if (capacityMatch.issue) return capacityMatch.issue;
  const capacityIssue = exactSingletonCapacity(capacityMatch.value, {
    code: 'UMW-GE-ELECTIVE-CAPACITY',
    units: 74,
    sourceRefs: ['general_education', 'college', 'graduation'],
  });
  if (capacityIssue) return capacityIssue;

  const majorGroups = groupsOf(doc).filter((group) => group?.requirement_layer === 'major');
  if (majorGroups.length !== 1 || selectedUnits(majorGroups) !== 46) {
    return fail('UMW selected major tree no longer contributes exactly 46 credits');
  }
  if (selectedUnits(groupsOf(doc)) !== 120) {
    return fail('UMW selected requirement tree no longer closes at 120 credits');
  }
  return pass(
    'the selected tree keeps all reviewed GE/attribute gates at zero units inside one 74-credit capacity block after the 46-credit major path',
    {
      canonical_major_units: 46,
      ge_and_elective_capacity_units: 74,
      zero_unit_gate_sections: UMW_GE_SECTIONS.length,
      degree_total_units: 120,
    },
  );
}

/**
 * UMW's extra residency clauses are redundant with stronger, explicit
 * carriers in the reviewed transfer-pathway tree.  Thirty total campus
 * credits imply that the last 21 credits are resident because every modeled
 * transfer credit precedes the university segment.  Independently, nine
 * fixed upper-major sections carry 33 non-articulable credits, exceeding half
 * of the exact 46-credit major (23 credits).  The military rule is a waiver,
 * so proving the unwaived path also proves every relaxed path.
 */
function evaluateUmwResidencyPolicy(document) {
  const representation = umwCanonicalRepresentation(document);
  if (!representation.supported) return null;
  const residency = document?.unit_audit?.residency || {};
  if (String(residency.status || '').trim().toLowerCase() !== 'required'
      || finite(residency.minimum_units) !== 30
      || String(residency.rule || '').trim() !== UMW_RESIDENCY_RULE
      || !exactSet(residency.source_refs, ['graduation'])) return null;

  const majorGroups = groupsOf(document).filter((group) => (
    group?.requirement_layer === 'major'
  ));
  if (majorGroups.length !== 1) return null;
  const major = majorGroups[0];
  const metadata = groupMetadataIssue(major, {
    layer: 'major',
    tier: 'nontransferable',
    courseLevel: 'mixed',
    ccArticulable: false,
    sourceRefs: ['major', 'course_catalog'],
  });
  if (metadata || (major.sections || []).length !== 13) return null;
  const byCode = new Map();
  for (const section of major.sections || []) {
    const receivers = section.receivers || [];
    if (receivers.length !== 1) continue;
    const code = receiverCode(receivers[0]);
    if (code) {
      if (byCode.has(code)) return null;
      byCode.set(code, section);
    }
  }
  let fixedResidentMajorUnits = 0;
  for (const [code, units] of UMW_FIXED_RESIDENT_MAJOR) {
    const section = byCode.get(code);
    const receiver = section?.receivers?.[0];
    if (!section || sectionAsk(section) !== 1 || sectionUnits(section) !== units
        || (sectionUnitsMax(section) != null && sectionUnitsMax(section) !== units)
        || String(section.course_level || '') !== 'upper_division'
        || section.cc_articulable !== false
        || receiverCode(receiver) !== code
        || receiverUnits(receiver) !== units) return null;
    fixedResidentMajorUnits += units;
  }
  const majorUnits = finite(document?.unit_audit?.canonical_major_path_units);
  const residentMajorMinimum = Math.ceil(majorUnits / 2);
  if (majorUnits !== 46 || residentMajorMinimum !== 23
      || fixedResidentMajorUnits < residentMajorMinimum) return null;

  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 30,
    residency_percentage_exact_units: null,
    overall_transfer_cap_units: 90,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: 105,
    effective_two_year_transfer_cap_units: 90,
    evidence: [
      { source: 'total_units - exact residency minimum', units: 90 },
      { source: 'total_units - final-21 resident minimum', units: 105 },
    ],
    inventory: { fields: {}, unclassified_fields: [] },
    source_policy_id: UMW,
    declared_subrules: [
      'overall_residency', 'major_residency_fraction',
      'final_window_residency', 'military_waiver',
    ],
    evaluator: 'evaluateUmwResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the two-year pathway is capped at 90 credits; 33 fixed non-articulable major credits exceed the 23-credit half-major minimum, and pre-entry sequencing satisfies the final-window rule',
    issues: [],
    proof: {
      fixed_nonarticulable_major_units: fixedResidentMajorUnits,
      half_major_residency_minimum_units: residentMajorMinimum,
      final_credit_window_units: 21,
      final_credit_window_residency_units_minimum: 15,
      active_duty_waiver_is_relaxation: true,
      exact_fixed_codes: UMW_FIXED_RESIDENT_MAJOR.map(([code]) => code),
    },
  };
}

function requireSameGroup(container, expectedGroup, validator, description) {
  const issue = validator(container);
  if (issue) return issue;
  if (container !== expectedGroup) {
    // Source and projection audits pass the exact group object.  Requiring
    // identity prevents a structurally copied rule from being attached to a
    // second container in the same reviewed document.
    return fail(`${description} is attached to a different source container`);
  }
  return null;
}

function proveUmwOverlappingAttributeAndCourseRequirements(container, { document } = {}) {
  const representation = umwCanonicalRepresentation(document);
  if (!representation.supported) return representation;
  const match = exactOne(
    groupsWithConstraint(document, 'overlapping_attribute_and_course_requirements'),
    'UMW overlapping-GE gate group',
  );
  if (match.issue) return match.issue;
  const containerIssue = requireSameGroup(
    container, match.value, umwGeGroupIssue, 'the UMW overlap rule',
  );
  if (containerIssue) return containerIssue;
  return pass(
    'all attribute and course gates are exact zero-unit category carriers, so the shared figures cannot add them on top of the reconciled capacity',
    representation.proof,
  );
}

function proveUmwDistinctMethodsCategories(container, { document } = {}) {
  const representation = umwCanonicalRepresentation(document);
  if (!representation.supported) return representation;
  const match = exactOne(
    groupsWithConstraint(document, 'distinct_methods_categories'),
    'UMW distinct-methods group',
  );
  if (match.issue) return match.issue;
  const containerIssue = requireSameGroup(
    container, match.value, umwGeGroupIssue, 'the UMW methods rule',
  );
  if (containerIssue) return containerIssue;
  const methods = (container.sections || []).filter((section) => (
    (section.receivers || []).some((receiver) => (
      receiverCode(receiver) === 'UMW-GE-ADDITIONAL-ARTS-LITERATURE'
    ))
  ));
  if (methods.length !== 1) return fail('the exact UMW methods category section is absent or duplicated');
  const identities = methods[0].receivers.map(receiverCode);
  if (sectionAsk(methods[0]) !== 2 || identities.length !== 5
      || new Set(identities).size !== 5) {
    return fail('UMW methods must remain choose two from five distinct category identities');
  }
  return pass(
    'the authored choose-two section contains five unique Methods category identities, so choosing two receiver alternatives already enforces two distinct categories',
    { ask: 2, distinct_method_categories: 5, canonical_increment_units: 0 },
  );
}

function proveUmwConditionalTransferWaiver(container, { document } = {}) {
  const representation = umwCanonicalRepresentation(document);
  if (!representation.supported) return representation;
  const match = exactOne(
    groupsWithConstraint(document, 'conditional_transfer_waiver'),
    'UMW transfer-waiver group',
  );
  if (match.issue) return match.issue;
  const containerIssue = requireSameGroup(
    container, match.value, umwGeGroupIssue, 'the UMW transfer waiver',
  );
  if (containerIssue) return containerIssue;
  const fsem = (container.sections || []).filter((section) => (
    (section.receivers || []).some((receiver) => receiverCode(receiver) === 'UMW-GE-FSEM')
  ));
  if (fsem.length !== 1 || sectionAsk(fsem[0]) !== 1 || sectionUnits(fsem[0]) !== 0) {
    return fail('the transfer-waived UMW FSEM gate is absent, duplicated, or nonzero');
  }
  return pass(
    'the transfer-pathway tree represents the reviewed FSEM waiver as one zero-unit GE gate, so it contributes no paper-figure course or unit demand',
    { transfer_waived_gate: 'UMW-GE-FSEM', canonical_increment_units: 0 },
  );
}

function proveUmwCapacityContainsOverlappingGeGates(container, { document } = {}) {
  const representation = umwCanonicalRepresentation(document);
  if (!representation.supported) return representation;
  const match = exactOne(
    groupsWithConstraint(document, 'capacity_contains_overlapping_ge_gates'),
    'UMW capacity group',
  );
  if (match.issue) return match.issue;
  const validator = (group) => exactSingletonCapacity(group, {
    code: 'UMW-GE-ELECTIVE-CAPACITY',
    units: 74,
    sourceRefs: ['general_education', 'college', 'graduation'],
  });
  const containerIssue = requireSameGroup(
    container, match.value, validator, 'the UMW capacity rule',
  );
  if (containerIssue) return containerIssue;
  return pass(
    'the exact 74-credit capacity plus the exact 46-credit major closes at 120 while every overlapping GE gate remains zero-unit',
    representation.proof,
  );
}

function wmCollGroupIssue(group) {
  const metadata = groupMetadataIssue(group, {
    layer: 'ge_college',
    tier: 'breadth',
    courseLevel: 'mixed',
    ccArticulable: true,
    sourceRefs: ['general_education', 'college'],
  });
  return metadata || exactCategorySections(group, WM_COLL_SECTIONS);
}

function wmCanonicalDistinctRepresentation(doc) {
  const identity = exactInstitution(doc, WM);
  if (identity) return identity;
  if (finite(doc?.total_units) !== 120
      || (finite(doc?.total_units_max) != null && finite(doc.total_units_max) !== 120)) {
    return fail('William & Mary degree totals changed from the reviewed 120-credit source');
  }
  const audit = doc?.unit_audit || {};
  if (finite(audit.graduation_minimum) !== 120
      || finite(audit.modeled_units) !== 120
      || finite(audit.canonical_major_units) !== 48
      || finite(audit.canonical_distinct_coll_and_arts_units) !== 34
      || finite(audit.remaining_elective_capacity_units) !== 38) {
    return fail('William & Mary canonical unit-audit fields no longer reconcile 48 + 34 + 38 = 120');
  }
  const collMatch = exactOne(
    groupsWithConstraint(doc, 'coll_major_overlap_limit'),
    'William & Mary COLL group',
  );
  if (collMatch.issue) return collMatch.issue;
  const collIssue = wmCollGroupIssue(collMatch.value);
  if (collIssue) return collIssue;

  const capacityMatch = exactOne(
    groupsWithReceiverCode(doc, 'WM-DEGREE-ELECTIVE-CAPACITY'),
    'William & Mary elective-capacity group',
  );
  if (capacityMatch.issue) return capacityMatch.issue;
  const capacityIssue = exactSingletonCapacity(capacityMatch.value, {
    code: 'WM-DEGREE-ELECTIVE-CAPACITY',
    units: 38,
    sourceRefs: ['general_education'],
  });
  if (capacityIssue) return capacityIssue;

  const majorGroups = groupsOf(doc).filter((group) => group?.requirement_layer === 'major');
  if (majorGroups.length !== 3 || selectedUnits(majorGroups) !== 48) {
    return fail('William & Mary selected major tree no longer contributes exactly 48 credits');
  }
  if (groupSelectedUnits(collMatch.value) !== 34) {
    return fail('William & Mary COLL/arts tree no longer contributes exactly 34 distinct credits');
  }
  if (selectedUnits(groupsOf(doc)) !== 120) {
    return fail('William & Mary selected requirement tree no longer closes at 120 credits');
  }
  return pass(
    'the selected canonical route is the source-audited zero-major-overlap path: 48 major + 34 distinct COLL/arts + 38 remaining = 120',
    {
      canonical_major_units: 48,
      canonical_distinct_coll_and_arts_units: 34,
      remaining_elective_capacity_units: 38,
      degree_total_units: 120,
    },
  );
}

function wmResidencyGroupSemanticSnapshot(group) {
  return {
    requirement_layer: String(group?.requirement_layer || '').trim(),
    tier: String(group?.tier || '').trim(),
    course_level: String(group?.course_level || '').trim(),
    cc_articulable: group?.cc_articulable,
    source_refs: Array.isArray(group?.source_refs) ? group.source_refs : [],
    analysis_constraints: (group?.analysis_constraints || []).map((constraint) => ({
      kind: String(constraint?.kind || '').trim(),
      status: String(constraint?.status || '').trim(),
      description: String(constraint?.description || '').trim(),
    })),
    sections: (group?.sections || []).map((section) => ({
      ask: sectionAsk(section),
      units: sectionUnits(section),
      units_max: sectionUnitsMax(section) ?? sectionUnits(section),
      label: String(section?.label_seen ?? section?.label ?? '').trim(),
      tier: String(section?.tier || group?.tier || '').trim(),
      course_level: String(section?.course_level || group?.course_level || '').trim(),
      cc_articulable: section?.cc_articulable ?? group?.cc_articulable,
      source_refs: Array.isArray(section?.source_refs)
        ? section.source_refs : (group?.source_refs || []),
      receivers: (section?.receivers || []).map((receiver) => {
        const body = receiverBody(receiver);
        return {
          kind: String(body?.kind || '').trim(),
          name: String(body?.name || '').trim(),
          units: finite(body?.units),
          code: String(body?.code || '').trim(),
          parent_id: body?.parent_id ?? null,
          parent_ids: Array.isArray(body?.parent_ids) ? body.parent_ids : [],
          option_count: Array.isArray(receiver?.options) ? receiver.options.length : 0,
        };
      }),
    })),
  };
}

function wmMajorGroupsSemanticSnapshot(document) {
  return groupsOf(document).slice(0, 3).map((group) => ({
    requirement_layer: String(group?.requirement_layer || '').trim(),
    tier: String(group?.tier || '').trim(),
    course_level: String(group?.course_level || '').trim(),
    cc_articulable: group?.cc_articulable,
    source_refs: Array.isArray(group?.source_refs) ? group.source_refs : [],
    analysis_constraints: (group?.analysis_constraints || []).map((constraint) => ({
      kind: String(constraint?.kind || '').trim(),
      status: String(constraint?.status || '').trim(),
      description: String(constraint?.description || '').trim(),
    })),
    sections: (group?.sections || []).map((section) => ({
      ask: sectionAsk(section),
      units: sectionUnits(section),
      units_max: sectionUnitsMax(section) ?? sectionUnits(section),
      label: String(section?.label_seen ?? section?.label ?? '').trim(),
      tier: String(section?.tier || group?.tier || '').trim(),
      course_level: String(section?.course_level || group?.course_level || '').trim(),
      cc_articulable: section?.cc_articulable ?? group?.cc_articulable,
      source_refs: Array.isArray(section?.source_refs)
        ? section.source_refs : (group?.source_refs || []),
      receivers: (section?.receivers || []).map((receiver) => ({
        kind: receiverKind(receiver),
        code: receiverCode(receiver),
        units: receiverUnits(receiver),
      })),
    })),
  }));
}

function wmOfficialEvidenceIssue(document) {
  const evidence = WM_CURRENT_FIGURE_EVIDENCE;
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== 'william_mary_2026_2027_current_catalog_figure_evidence'
      || evidence?.catalog_year !== '2026-2027'
      || evidence?.institution?.slug !== WM
      || evidence?.institution?.school_id !== 9233
      || sha256Json(evidence?.transfer_and_residency_policy)
        !== WM_TRANSFER_RESIDENCY_EVIDENCE_SHA256
      || sha256Json(evidence?.general_concentration)
        !== WM_GENERAL_CONCENTRATION_EVIDENCE_SHA256
      || sha256Json(evidence?.foreign_language_proficiency)
        !== WM_FOREIGN_LANGUAGE_EVIDENCE_SHA256) {
    return fail('the retained William & Mary current-catalog evidence artifact changed');
  }
  const sourceRows = Array.isArray(document?.sources) ? document.sources : [];
  if (sourceRows.length) {
    if (sourceRows.length !== Object.keys(WM_SOURCE_SHA256).length
        || Object.entries(WM_SOURCE_SHA256).some(([id, hash]) => {
          const matches = sourceRows.filter((source) => source?.id === id);
          return matches.length !== 1 || matches[0]?.sha256 !== hash
            || matches[0]?.official !== true || matches[0]?.secure !== true;
        })
        || document?.provenance?.source_bundle_hash !== WM_SOURCE_BUNDLE_SHA256) {
      return fail('the William & Mary official source receipt or bundle hash changed');
    }
  } else if (!exactSet(document?.source_bundle_required, Object.keys(WM_SOURCE_SHA256))) {
    return fail('the William & Mary composition no longer requires the exact official source bundle');
  }
  if ((document?._id === 'degree:9233:va-cs'
      || document?.va_requirement_id === 'va:degree:william-mary:cs'
        && Number(document?.school_id) === 9233)
      && !usesCanonicalSourceContract(document)) {
    return fail('the William & Mary final projection lacks the canonical source contract');
  }
  return null;
}

/**
 * Figures 3/4 deliberately optimize one source-valid transfer plan. W&M's
 * current catalog publishes three ways to satisfy foreign-language
 * proficiency with zero additional college courses or credits. This proof
 * permits that exact minimizing witness for those two figures only; it does
 * not claim the zero-increment route is universal and cannot satisfy Figure 6.
 */
function proveWmForeignLanguageFigure34BestCase(container, {
  document,
  constraint = null,
} = {}) {
  const representation = wmCanonicalDistinctRepresentation(document);
  if (!representation.supported) return representation;
  const sourceIssue = wmOfficialEvidenceIssue(document);
  if (sourceIssue) return sourceIssue;
  const match = exactOne(
    groupsWithConstraint(document, 'foreign_language_proficiency_variable_credit'),
    'William & Mary language-proficiency group',
  );
  if (match.issue) return match.issue;
  const group = match.value;
  if (container !== group || wmCollGroupIssue(group)) {
    return fail('the William & Mary language-proficiency carrier changed');
  }
  const constraints = (group.analysis_constraints || []).filter((row) => (
    String(row?.kind || '').trim() === 'foreign_language_proficiency_variable_credit'
  ));
  if (constraints.length !== 1 || constraint && constraint !== constraints[0]) {
    return fail('the William & Mary language-proficiency rule identity changed');
  }
  const sections = (group.sections || []).filter((section) => (
    (section.receivers || []).some((receiver) => (
      receiverCode(receiver) === 'WM-LANGUAGE-202-203'
    ))
  ));
  const section = sections[0];
  const receiver = section?.receivers?.[0];
  if (sections.length !== 1 || (section.receivers || []).length !== 1
      || sectionAsk(section) !== 1 || sectionUnits(section) !== 0
      || receiverKind(receiver) !== 'ge_area'
      || receiverCode(receiver) !== 'WM-LANGUAGE-202-203'
      || receiverUnits(receiver) !== 0) {
    return fail('the exact zero-unit William & Mary language carrier changed');
  }
  const evidence = WM_CURRENT_FIGURE_EVIDENCE.foreign_language_proficiency;
  const interpretation = evidence?.paper_interpretation;
  const routes = Array.isArray(evidence?.source_rule?.routes)
    ? evidence.source_rule.routes : [];
  const zeroRoutes = routes.filter((route) => [1, 2, 6].includes(route?.option));
  if (evidence?.source_rule?.verified !== true
      || !exactSet(evidence?.source_rule?.issues, [])
      || evidence?.source_rule?.source_response_sha256
        !== WM_DEGREE_POLICY_RESPONSE_SHA256
      || !exactSet(interpretation?.exact_zero_increment_options, [1, 2, 6])
      || !exactSet(interpretation?.open_course_or_credit_options, [3, 4, 5, 7])
      || interpretation?.zero_increment_route_exists !== true
      || interpretation?.zero_increment_is_universal !== false
      || zeroRoutes.length !== 3
      || zeroRoutes.some((route) => route.college_course_increment !== 0
        || route.college_credit_increment !== 0)
      || interpretation?.figure_3?.ready !== true
      || interpretation?.figure_4?.ready !== true
      || interpretation?.figure_3?.method
        !== 'optimistic_best_case_source_valid_zero_increment_route'
      || interpretation?.figure_4?.method
        !== 'optimistic_best_case_source_valid_zero_increment_route'
      || interpretation?.figure_6?.ready !== false) {
    return fail('the retained William & Mary zero-increment route proof changed');
  }
  return pass(
    'Figures 3/4 select a catalog-published zero-course language-proficiency route under the documented optimistic/lower-bound method; variable coursework routes remain visible and Figure 6 remains blocked',
    {
      method: 'optimistic_best_case_source_valid_zero_increment_route',
      selected_source_options: [1, 2, 6],
      selected_college_course_increment: 0,
      selected_college_credit_increment: 0,
      zero_increment_is_universal: false,
      source_bundle_sha256: WM_SOURCE_BUNDLE_SHA256,
      official_degree_policy_text_sha256: WM_SOURCE_SHA256.general_education,
      official_degree_policy_response_sha256: WM_DEGREE_POLICY_RESPONSE_SHA256,
      current_language_evidence_sha256: WM_FOREIGN_LANGUAGE_EVIDENCE_SHA256,
      figure_6_supported: false,
      ...representation.proof,
    },
  );
}

function wmExactResidentMajorRoute(document) {
  const groups = groupsOf(document);
  if (groups.length !== 6) return fail('the William & Mary group count changed');
  if (sha256Json(wmMajorGroupsSemanticSnapshot(document))
      !== WM_MAJOR_GROUPS_SEMANTIC_SHA256) {
    return fail('the William & Mary major-course residency tree changed');
  }
  const [core, math, upper] = groups;
  const coreMetadata = groupMetadataIssue(core, {
    layer: 'major', tier: 'nontransferable', courseLevel: 'mixed',
    ccArticulable: false, sourceRefs: ['major', 'course_catalog'],
  });
  const mathMetadata = groupMetadataIssue(math, {
    layer: 'major', tier: 'transferable', courseLevel: 'lower_division',
    ccArticulable: true, sourceRefs: ['major'],
  });
  const upperMetadata = groupMetadataIssue(upper, {
    layer: 'major', tier: 'breadth', courseLevel: 'upper_division',
    ccArticulable: false, sourceRefs: ['major', 'course_catalog'],
  });
  if (coreMetadata || mathMetadata || upperMetadata) {
    return fail('the William & Mary major residency carrier metadata changed');
  }
  if ((core.sections || []).length !== 8 || (math.sections || []).length !== 3
      || (core.sections || []).some((section) => sectionAsk(section) !== 1)
      || (math.sections || []).some((section) => sectionAsk(section) !== 1)) {
    return fail('the William & Mary minimum major-course count carriers changed');
  }
  const fixed = new Map();
  for (const section of core.sections || []) {
    const receivers = section.receivers || [];
    if (receivers.length !== 1) continue;
    const code = receiverCode(receivers[0]);
    if (WM_FIXED_RESIDENT_UPPER_CORE.includes(code)) fixed.set(code, section);
  }
  if (fixed.size !== WM_FIXED_RESIDENT_UPPER_CORE.length) {
    return fail('the five fixed William & Mary resident upper-core courses changed');
  }
  for (const code of WM_FIXED_RESIDENT_UPPER_CORE) {
    const section = fixed.get(code);
    const receiver = section?.receivers?.[0];
    if (sectionAsk(section) !== 1 || sectionUnits(section) !== 3
        || sectionUnitsMax(section) != null && sectionUnitsMax(section) !== 3
        || String(section?.course_level || '') !== 'upper_division'
        || section?.cc_articulable !== false
        || receiverKind(receiver) !== 'course'
        || receiverCode(receiver) !== code || receiverUnits(receiver) !== 3) {
      return fail('a fixed William & Mary resident upper-core carrier changed');
    }
  }
  const upperShape = exactCategorySections(upper, [{
    ask: 1, units: 12, codes: ['WM-CSCI-GENERAL-UPPER-12'],
  }]);
  if (upperShape) return upperShape;
  const evidence = WM_CURRENT_FIGURE_EVIDENCE.general_concentration?.paper_interpretation;
  if (!exactSet(evidence?.exact_feasible_credit_contributing_course_counts, [4, 5, 6])
      || evidence?.zero_credit_entries_do_not_reduce_the_twelve_credit_floor !== true
      || evidence?.required_upper_core_reuse_not_assumed !== true) {
    return fail('the retained William & Mary upper-elective cardinality proof changed');
  }
  return pass('the exact major tree selects a legal all-resident upper-level route', {
    minimum_major_course_count: 15,
    resident_major_course_count_minimum: 9,
    half_major_course_count_minimum: 8,
    resident_major_units: 27,
    external_300_400_major_courses_selected: 0,
    external_300_400_major_courses_maximum: 2,
    fixed_resident_upper_core_codes: [...WM_FIXED_RESIDENT_UPPER_CORE],
    upper_elective_credit_contributing_course_count_minimum: 4,
  });
}

/**
 * Exact W&M Figure 3/4 residency proof. The proof chooses the deterministic
 * legal route already represented by the canonical tree: every 300/400-level
 * major carrier is non-articulable, so zero external upper courses are used.
 * The retained source evidence—not a label regex—binds that zero to the
 * official maximum of two.
 */
function evaluateWmResidencyPolicy(document, context = {}) {
  const representation = wmCanonicalDistinctRepresentation(document);
  if (!representation.supported) return null;
  const sourceIssue = wmOfficialEvidenceIssue(document);
  if (sourceIssue) return null;
  const group = groupsOf(document)[5];
  const matches = groupsWithConstraint(document, 'overlapping_residency_rules');
  if (matches.length !== 1 || matches[0] !== group
      || sha256Json(wmResidencyGroupSemanticSnapshot(group))
        !== WM_RESIDENCY_GROUP_SEMANTIC_SHA256) return null;
  const constraint = group.analysis_constraints[0];
  if (context.container && context.container !== group) return null;
  if (context.path && context.path !== 'requirement_groups[5]') return null;
  if (context.constraint && context.constraint !== constraint) return null;
  const audit = document?.unit_audit || {};
  const residency = audit.residency || {};
  if (String(residency.status || '').trim().toLowerCase() !== 'required'
      || finite(residency.minimum_units) !== 60
      || !exactSet(residency.source_refs, ['major', 'general_education'])) return null;
  const major = wmExactResidentMajorRoute(document);
  if (!major.supported) return null;
  const policy = WM_CURRENT_FIGURE_EVIDENCE.transfer_and_residency_policy;
  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 60,
    residency_percentage_exact_units: null,
    overall_transfer_cap_units: 60,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: null,
    effective_two_year_transfer_cap_units: 60,
    evidence: [{ source: 'total_units - exact residency minimum', units: 60 }],
    inventory: { fields: {}, unclassified_fields: [] },
    source_policy_id: WM,
    declared_subrules: [
      'overall_residency', 'major_residency_units',
      'major_course_count_fraction', 'external_upper_major_course_maximum',
    ],
    evaluator: 'evaluateWmResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the exact pathway is capped at 60 transfer credits and selects 27 resident major credits across at least nine resident major courses, with zero external 300/400-level major courses against the official maximum of two',
    issues: [],
    proof: {
      ...major.proof,
      source_bundle_sha256: WM_SOURCE_BUNDLE_SHA256,
      official_program_text_sha256: WM_SOURCE_SHA256.major,
      official_degree_policy_text_sha256: WM_SOURCE_SHA256.general_education,
      major_groups_semantic_sha256: WM_MAJOR_GROUPS_SEMANTIC_SHA256,
      residency_group_semantic_sha256: WM_RESIDENCY_GROUP_SEMANTIC_SHA256,
      current_policy_evidence_sha256: WM_TRANSFER_RESIDENCY_EVIDENCE_SHA256,
      current_general_concentration_evidence_sha256:
        WM_GENERAL_CONCENTRATION_EVIDENCE_SHA256,
      external_upper_rule_path: 'requirement_groups[5].sections[5]',
      transfer_grade_threshold: {
        minimum_letter_grade: policy.transfer_grade_threshold.minimum_letter_grade,
        c_minus_acceptable: policy.transfer_grade_threshold.c_minus_acceptable,
        conditioned_input:
          policy.transfer_grade_threshold.paper_method.conditioned_input,
        separately_blocks_paper_figures:
          policy.transfer_grade_threshold.paper_method.separately_blocks_paper_figures,
      },
    },
  };
}

function proveWmCollMajorOverlapLimit(container, { document } = {}) {
  const representation = wmCanonicalDistinctRepresentation(document);
  if (!representation.supported) return representation;
  const match = exactOne(
    groupsWithConstraint(document, 'coll_major_overlap_limit'),
    'William & Mary COLL group',
  );
  if (match.issue) return match.issue;
  const containerIssue = requireSameGroup(
    container, match.value, wmCollGroupIssue, 'the William & Mary overlap-limit rule',
  );
  if (containerIssue) return containerIssue;
  return pass(
    'the paper consumers select the exact source-audited zero-overlap route, which is within a maximum-overlap rule and needs no course reallocation',
    { ...representation.proof, selected_major_coll_overlap_courses: 0 },
  );
}

function proveWmColl350AttributeOverlap(container, { document } = {}) {
  const representation = wmCanonicalDistinctRepresentation(document);
  if (!representation.supported) return representation;
  const match = exactOne(
    groupsWithConstraint(document, 'coll350_attribute_overlap'),
    'William & Mary COLL 350 group',
  );
  if (match.issue) return match.issue;
  const containerIssue = requireSameGroup(
    container, match.value, wmCollGroupIssue, 'the William & Mary COLL 350 rule',
  );
  if (containerIssue) return containerIssue;
  const coll350 = (container.sections || []).filter((section) => (
    (section.receivers || []).some((receiver) => receiverCode(receiver) === 'WM-COLL350')
  ));
  if (coll350.length !== 1 || sectionAsk(coll350[0]) !== 1 || sectionUnits(coll350[0]) !== 0) {
    return fail('the William & Mary COLL 350 attribute gate is absent, duplicated, or nonzero');
  }
  return pass(
    'COLL 350 remains one exact zero-credit attribute carrier, so it cannot be gross-added to the 34 distinct COLL/arts credits',
    { ...representation.proof, coll350_increment_units: 0 },
  );
}

function proveWmCapacityReallocationAfterOverlap(container, { document } = {}) {
  const representation = wmCanonicalDistinctRepresentation(document);
  if (!representation.supported) return representation;
  const match = exactOne(
    groupsWithConstraint(document, 'capacity_reallocation_after_overlap'),
    'William & Mary capacity group',
  );
  if (match.issue) return match.issue;
  const validator = (group) => exactSingletonCapacity(group, {
    code: 'WM-DEGREE-ELECTIVE-CAPACITY',
    units: 38,
    sourceRefs: ['general_education'],
  });
  const containerIssue = requireSameGroup(
    container, match.value, validator, 'the William & Mary capacity rule',
  );
  if (containerIssue) return containerIssue;
  return pass(
    'the selected zero-overlap source path fixes remaining capacity at 38 credits, so overlap reallocation cannot bind that canonical paper path',
    { ...representation.proof, selected_major_coll_overlap_courses: 0 },
  );
}

/**
 * Narrow the impact of three unresolved rules only when their exact reviewed
 * source container is still present.  Returning null means "unknown" and the
 * caller must conservatively block every figure.  This keeps a future use of
 * the same kind at another institution from inheriting these institution-
 * specific scopes.
 */
function sourceSpecificAffectedFigures(value, { container, document } = {}) {
  const kind = String(value?.kind || '').trim();
  if (kind === 'no_double_count_with_prior_major_requirements') {
    const identity = exactInstitution(document, UMW);
    if (identity) return null;
    const match = exactOne(
      groupsWithConstraint(document, 'no_double_count_with_prior_major_requirements'),
      'UMW major group carrying the no-double-count rule',
    );
    if (match.issue) return null;
    const major = match.value;
    const metadata = groupMetadataIssue(major, {
      layer: 'major',
      tier: 'nontransferable',
      courseLevel: 'mixed',
      ccArticulable: false,
      sourceRefs: ['major', 'course_catalog'],
    });
    if (metadata || finite(document?.unit_audit?.canonical_major_path_units) !== 46
        || groupSelectedUnits(major) !== 46) return null;
    const sections = (major.sections || []).filter((section) => (
      (section.receivers || []).some((receiver) => (
        receiverCode(receiver) === 'UMW-CPSC-CYBR-400'
      ))
    ));
    if (sections.length !== 1) return null;
    const section = sections[0];
    const shape = exactCategorySections(
      { sections: [section] },
      [{ ask: 1, units: 3, codes: ['UMW-CPSC-CYBR-400'] }],
    );
    if (shape
        || String(section?.tier || '') !== 'breadth'
        || String(section?.course_level || '') !== 'upper_division'
        || section?.cc_articulable !== false
        || (container !== major && container !== section)) return null;
    return ['6'];
  }

  if (kind === 'open_course_category_with_exclusions') {
    const identity = exactInstitution(document, WM);
    if (identity) return null;
    const match = exactOne(
      groupsWithConstraint(document, 'open_course_category_with_exclusions'),
      'William & Mary open General-concentration group',
    );
    if (match.issue || container !== match.value) return null;
    const group = match.value;
    const metadata = groupMetadataIssue(group, {
      layer: 'major',
      tier: 'breadth',
      courseLevel: 'upper_division',
      ccArticulable: false,
      sourceRefs: ['major', 'course_catalog'],
    });
    if (metadata || exactCategorySections(group, [{
      ask: 1, units: 12, codes: ['WM-CSCI-GENERAL-UPPER-12'],
    }])) return null;
    return ['1', '6'];
  }

  if (kind === 'foreign_language_proficiency_variable_credit') {
    const proof = proveWmForeignLanguageFigure34BestCase(container, {
      document,
      constraint: value,
    });
    return proof.supported ? ['6'] : null;
  }

  return null;
}

module.exports = {
  evaluateUmwResidencyPolicy,
  evaluateWmResidencyPolicy,
  proveUmwCapacityContainsOverlappingGeGates,
  proveUmwConditionalTransferWaiver,
  proveUmwDistinctMethodsCategories,
  proveUmwOverlappingAttributeAndCourseRequirements,
  proveWmCapacityReallocationAfterOverlap,
  proveWmColl350AttributeOverlap,
  proveWmCollMajorOverlapLimit,
  proveWmForeignLanguageFigure34BestCase,
  sourceSpecificAffectedFigures,
};
