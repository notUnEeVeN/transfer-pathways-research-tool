/**
 * Exact, source-shape-bound proofs for the two Virginia bachelor documents
 * whose remaining machine-evaluable rules are course-reuse/selection rules.
 *
 * Nothing in this module accepts a prose label as capability.  Institution
 * identity, source references, section counts, choose counts, credit bounds,
 * receiver kinds/codes/units, overlap keys, and the complete relevant marker
 * inventory must all match.  A changed source tree therefore fails closed.
 */

const {
  courseIdFor,
  receivingCourseIdForDocument,
} = require('../virginia/courseIdentity');
const { institutionIdentityBySlug } = require('../virginia/institutionIds');

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);

const GMU_SLUG = 'george-mason-university';
const ODU_SLUG = 'old-dominion-university';

const GMU_SOURCE_BUNDLE_SHA256 = '7c987cf7e141b7dfb0b7cb3a965676f92b3821dddde9248323b8c65af25ac599';
const GMU_SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: 'e084c90525cdd2053e3ad60577fe5716c953b92b4d1abba0b3043f5820822948',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: 'f1faa1bbfec307a2f5cb717055d3aa3a8eca1b7307b198503bb56b19b75db393',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: 'f01e68c161c07ea274dcbc9895e12064a99eaa9cc32114380f863a0b37c5b8bf',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: 'b09c9e0763fcf6d55b426a23eae2067d92bf7fc70caa4e0093612e996b557756',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: '449099325c92f9c4da7bb34a84a5dcc3b91a942b07016afe925b4c72c61600ee',
  }),
]);
const ODU_SOURCE_BUNDLE_SHA256 = '2b7625065edb243d9b8702ab6c4fa8c05342a49a12db3108dc5855628253a9ab';
const ODU_SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: 'a64306fb6678b08559f0c1ca523fcfe632b898606c4498002e9a0c33bfdad0e2',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: '43b3871305c51b7bc67fe3f8932246a57ac12b7ec1d7714d1cd9b7c4e84360f0',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: '69e30828e2f0f74dfee47d5e574758c5ab28e4c10a2469450d4511cf46af03e9',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: '57886ed1986992d659c59a6ebb21f2175665447765ff39b89c8375cdb8161955',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: '975130484364dbe7ca82a179712a7556cb714739357979a98ecefa7d363ceefc',
  }),
]);
const ODU_RESIDENCY_RULE = 'At least 30 credits overall and at least 12 upper-level credits in the major must be completed at Old Dominion University; the writing-intensive major course must also be taken at ODU.';
const ODU_GRADE_GATE = 'Earn C or better in every required non-elective CS course, every CS prerequisite course, and the writing-intensive course in the major';
const ODU_ASSESSMENT_GATE = "Complete Old Dominion University's Senior Assessment";
const ODU_UPPER_GE_SOURCE_TEXT = 'Option D. Two Upper-Division Courses from outside the College of Sciences and not required by the major (6 hours)';
const ODU_UPPER_GE_SAMPLE_ROW = 'Upper-Division General Education Course (Option D)';
const ODU_MAJOR_GRADE_SOURCE_TEXT = 'Computer science majors must earn a grade of C or better in all (non-elective) computer science courses required for the major and in all computer science prerequisite courses and in the writing intensive (W) course in the major.';
const ODU_GENERAL_TRANSFER_GRADE_SOURCE_TEXT = 'Students must earn a grade of C (2.0) or better in order to receive the credit hours associated with classes taken at other regionally accredited institutions.';
const ODU_PROGRAM = 'Computer Science (BSCS)';
const ODU_FINAL_PROGRAM = 'Computer Science, B.S.';

const GMU_SYSTEMS = Object.freeze(['CS455', 'CS468', 'CS475']);
const GMU_SCIENCE_SEQUENCES = Object.freeze([
  Object.freeze(['BIOL102', 'BIOL106', 'BIOL103', 'BIOL105']),
  Object.freeze(['BIOL107', 'BIOL103', 'BIOL105']),
  Object.freeze(['CHEM211', 'CHEM213', 'CHEM212', 'CHEM214']),
  Object.freeze(['GEOL101', 'GEOL103', 'GEOL102', 'GEOL104']),
  Object.freeze(['PHYS160', 'PHYS161', 'PHYS260', 'PHYS261']),
]);
const GMU_SELECTED_SCIENCE_SEQUENCE_INDEX = 2;
const GMU_SELECTED_SCIENCE_SEQUENCE = GMU_SCIENCE_SEQUENCES[
  GMU_SELECTED_SCIENCE_SEQUENCE_INDEX
];
const GMU_ADDITIONAL_SCIENCE = 'BIOL102';
const GMU_FIXED_RESIDENT_MAJOR = Object.freeze([
  ['CS310', 3], ['CS321', 3], ['CS330', 3], ['CS367', 4],
  ['CS405', 3], ['CS450', 3], ['CS471', 3], ['CS483', 3],
]);
const GMU_RESIDENCY_RULE = 'At least one-fourth of the degree must be earned at Mason, including at least 12 upper-level Mason credits in the major.';
const GMU_SENIOR = Object.freeze([
  'CS425', 'CS440', 'CS450', 'CS451', 'CS452', 'CS453', 'CS455', 'CS463',
  'CS465', 'ECE445', 'CS468', 'CS475', 'CS477', 'CS478', 'CS480', 'CS482',
  'CS484', 'CS485', 'CS487', 'CS489', 'CS491', 'CS499', 'MATH446', 'OR481',
]);

const ODU_UPPER_CS = Object.freeze([
  'CS222', 'CS312', 'CS337', 'CS402', 'CS418', 'CS422', 'CS431', 'CS432',
  'CS433', 'CS441', 'CS445', 'CS450', 'CS455', 'CS460', 'CS462', 'CS463',
  'CS464', 'CS465', 'CS466', 'CS467', 'CS469', 'CS472', 'CS475', 'CS476',
  'CS478', 'CS480', 'CS481', 'CS486', 'CS487', 'CS488', 'CS491', 'CS492',
  'CS499W', 'CS367', 'CS368',
]);

const ODU_TECHNICAL = Object.freeze([
  'BIOL121N', 'BIOL123N', 'BIOL136N', 'BIOL138N',
  'CHEM105N', 'CHEM107N', 'CHEM121N', 'CHEM123N',
  'OEAS106N', 'OEAS108N', 'OEAS110N', 'OEAS111N', 'OEAS112N', 'OEAS126N',
  'OEAS250N', 'PHYS111N', 'PHYS112N', 'PHYS226N', 'PHYS227N', 'PHYS231N',
  'PHYS232N',
]);

const ODU_SCIENCE_SEQUENCES = Object.freeze([
  ['BIOL121N', 'BIOL122N', 'BIOL123N', 'BIOL124N'],
  ['BIOL136N', 'BIOL137N', 'BIOL138N', 'BIOL139N'],
  ['CHEM105N', 'CHEM106N', 'CHEM107N', 'CHEM108N'],
  ['CHEM121N', 'CHEM122N', 'CHEM123N', 'CHEM124N'],
  ['OEAS106N', 'OEAS108N'],
  ['OEAS106N', 'OEAS250N'],
  ['OEAS126N', 'OEAS108N'],
  ['OEAS126N', 'OEAS250N'],
  ['PHYS111N', 'PHYS112N'],
  ['PHYS226N', 'PHYS227N'],
  ['PHYS231N', 'PHYS232N'],
]);

const GMU_MARKERS = Object.freeze([
  ['requirement_groups[0].sections[9].receivers[0].overlap_key', 'course:CS450', 'CS450'],
  ['requirement_groups[1].sections[0].receivers[0].overlap_key', 'course:CS455', 'CS455'],
  ['requirement_groups[1].sections[0].receivers[1].overlap_key', 'course:CS468', 'CS468'],
  ['requirement_groups[1].sections[0].receivers[2].overlap_key', 'course:CS475', 'CS475'],
  ['requirement_groups[1].sections[1].receivers[2].overlap_key', 'course:CS450', 'CS450'],
  ['requirement_groups[1].sections[1].receivers[6].overlap_key', 'course:CS455', 'CS455'],
  ['requirement_groups[1].sections[1].receivers[10].overlap_key', 'course:CS468', 'CS468'],
  ['requirement_groups[1].sections[1].receivers[11].overlap_key', 'course:CS475', 'CS475'],
  ['requirement_groups[1].sections[1].receivers[22].overlap_key', 'equivalent:MATH446:OR481', 'MATH446'],
  ['requirement_groups[1].sections[1].receivers[23].overlap_key', 'equivalent:MATH446:OR481', 'OR481'],
]);

const ODU_MARKERS = Object.freeze([
  ['requirement_groups[0].sections[6].receivers[0].overlap_key', 'odu-impact-technology', 'CS330'],
  ['requirement_groups[0].sections[7].receivers[0].overlap_key', 'odu-impact-technology', 'CS350'],
  ['requirement_groups[0].sections[12].receivers[0].overlap_key', 'odu-impact-technology', 'CS410'],
  ['requirement_groups[0].sections[13].receivers[0].overlap_key', 'odu-impact-technology', 'CS411W'],
  ['requirement_groups[0].sections[15].receivers[0].overlap_key', 'odu-cs422', 'CS422'],
  ['requirement_groups[0].sections[15].receivers[1].overlap_key', 'odu-cs480', 'CS480'],
  ['requirement_groups[0].sections[16].receivers[0].overlap_key', 'odu-cs450', 'CS450'],
  ['requirement_groups[0].sections[16].receivers[1].overlap_key', 'odu-cs418', 'CS418'],
  ['requirement_groups[1].sections[0].receivers[4].overlap_key', 'odu-cs418', 'CS418'],
  ['requirement_groups[1].sections[0].receivers[5].overlap_key', 'odu-cs422', 'CS422'],
  ['requirement_groups[1].sections[0].receivers[11].overlap_key', 'odu-cs450', 'CS450'],
  ['requirement_groups[1].sections[0].receivers[25].overlap_key', 'odu-cs480', 'CS480'],
  ['requirement_groups[2].sections[0].receivers[0].overlap_key', 'odu-ge-mathematics', 'MATH211'],
  ['requirement_groups[6].sections[0].receivers[0].overlap_key', 'odu-ge-mathematics', 'MATH211'],
  ['requirement_groups[11].sections[0].receivers[0].overlap_key', 'odu-impact-technology', 'CS330+CS350+CS410+CS411W'],
]);

const asArray = (value) => Array.isArray(value) ? value : [];
const token = (value) => String(value ?? '').trim();
const normalizedCode = (value) => token(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const number = (value) => Number(value);

function institutionSlug(document) {
  for (const slug of [GMU_SLUG, ODU_SLUG]) {
    const identity = institutionIdentityBySlug(slug, 'four_year');
    if (!identity) continue;
    const sourceId = `va:degree:${slug}:cs`;
    const sourceShape = token(document?.slug) === slug
      && !token(document?._id)
      && !token(document?.school_id)
      && !token(document?.institution_id)
      && !token(document?.va_requirement_id);
    const sourceProjectionShape = !token(document?.slug)
      && token(document?._id) === sourceId
      && token(document?.school_id) === `va:uni:${slug}`
      && token(document?.institution_id) === `va:uni:${slug}`
      && !token(document?.va_requirement_id)
      && token(document?.school) === identity.name
      && token(document?.kind) === 'degree'
      && token(document?.major_slug) === 'cs';
    const finalProjectionShape = !token(document?.slug)
      && token(document?._id) === `degree:${identity.id}:va-cs`
      && document?.school_id === identity.id
      && token(document?.institution_id) === `va:uni:${identity.id}`
      && token(document?.va_requirement_id) === sourceId
      && token(document?.school) === identity.name
      && token(document?.kind) === 'degree'
      && token(document?.major_slug) === 'va-cs';
    if (sourceShape || sourceProjectionShape || finalProjectionShape) return slug;
  }
  return null;
}

function receiverKind(receiver) {
  return token(receiver?.receiving?.kind || receiver?.kind).toLowerCase();
}

function receiverUnits(receiver) {
  return number(receiver?.receiving?.units ?? receiver?.units);
}

function receiverCodes(receiver) {
  const direct = receiver?.code_seen
    ?? receiver?.receiving?.code
    ?? receiver?.code
    ?? receiver?.receiving?.codes
    ?? receiver?.codes
    ?? [];
  const raw = Array.isArray(direct) ? direct : [direct];
  return raw.flatMap((value) => token(value).split(/\s*\+\s*|\s+and\s+/i))
    .map(normalizedCode).filter(Boolean);
}

function sectionAsk(section) {
  return number(section?.section_advisement ?? section?.select);
}

function sectionUnits(section) {
  return number(section?.unit_advisement ?? section?.units);
}

function sectionMaximum(section) {
  return number(section?.unit_advisement_max ?? section?.units_max
    ?? section?.unit_advisement ?? section?.units);
}

function conjunction(group) {
  return token(group?.group_conjunction || group?.conjunction).toLowerCase();
}

function refsEqual(value, expected) {
  const actual = asArray(value).map(token).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((entry, index) => entry === wanted[index]);
}

function constraintKinds(group) {
  return asArray(group?.analysis_constraints).map((entry) => token(entry?.kind));
}

function arraysEqual(actual, expected) {
  return actual.length === expected.length
    && actual.every((entry, index) => entry === expected[index]);
}

function exactRoster(section, expected, {
  document = null, kind = 'course', units = null, unitByCode = null,
} = {}) {
  const receivers = asArray(section?.receivers);
  if (receivers.length !== expected.length) return false;
  return receivers.every((receiver, index) => {
    const codes = receiverCodes(receiver);
    const expectedCodes = Array.isArray(expected[index]) ? expected[index] : [expected[index]];
    const expectedUnits = unitByCode?.[expectedCodes.join('+')] ?? units;
    const receiving = receiver?.receiving;
    const expectedParentIds = expectedCodes
      .map((code) => receivingCourseIdForDocument(document, code));
    const projectedIdentityExact = !receiving || (expectedCodes.length > 1
      ? arraysEqual(asArray(receiving.parent_ids).map(number), expectedParentIds)
      : number(receiving.parent_id) === expectedParentIds[0]);
    return receiverKind(receiver) === (expectedCodes.length > 1 ? 'series' : kind)
      && arraysEqual(codes, expectedCodes)
      && projectedIdentityExact
      && (expectedUnits == null || receiverUnits(receiver) === expectedUnits);
  });
}

function markerInventory(document) {
  const rows = [];
  const visit = (value, path) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (token(value.overlap_key)) {
      rows.push([`${path}.overlap_key`, token(value.overlap_key), receiverCodes(value).join('+')]);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'overlap_key') visit(child, `${path}.${key}`);
    }
  };
  visit(asArray(document?.requirement_groups), 'requirement_groups');
  return rows.sort((a, b) => a[0].localeCompare(b[0]));
}

function markerInventoryExact(document, expected) {
  const actual = markerInventory(document);
  const wanted = [...expected].map((row) => [...row]).sort((a, b) => a[0].localeCompare(b[0]));
  return actual.length === wanted.length && actual.every((row, index) => (
    arraysEqual(row, wanted[index])
  ));
}

function externalCourseIntersections(document, targetGroupIndex, targetCodes) {
  const target = new Set(targetCodes);
  const rows = [];
  asArray(document?.requirement_groups).forEach((group, groupIndex) => {
    if (groupIndex === targetGroupIndex) return;
    asArray(group.sections).forEach((section, sectionIndex) => {
      asArray(section.receivers).forEach((receiver, receiverIndex) => {
        receiverCodes(receiver).forEach((code) => {
          if (target.has(code)) rows.push(`${code}@${groupIndex}:${sectionIndex}:${receiverIndex}`);
        });
      });
    });
  });
  return rows.sort();
}

function exactDocumentHeader(document, slug) {
  return institutionSlug(document) === slug
    && token(document?.catalog_year) === '2026-2027'
    && number(document?.total_units) === 120;
}

function sourceBundleIssue(document, {
  slug, bundleSha256, receipts,
}) {
  const composition = token(document?.slug) === slug;
  if (composition) {
    const actual = asArray(document?.source_bundle_required).map(token);
    const expected = receipts.map((receipt) => receipt.id);
    return arraysEqual(actual, expected)
      ? null : `the composed ${slug} source-bundle role inventory changed`;
  }
  if (document?.provenance?.source_bundle_hash !== bundleSha256
      || document?.provenance?.composition_artifact
        !== `server/.va-catalogs/composed/${slug}.json`) {
    return `the retained ${slug} source-bundle receipt changed`;
  }
  const sources = asArray(document?.sources);
  if (sources.length !== receipts.length
      || sources.some((source, index) => {
        const expected = receipts[index];
        return token(source?.id) !== expected.id
          || token(source?.role) !== expected.role
          || token(source?.kind) !== expected.kind
          || token(source?.sha256) !== expected.sha256
          || source?.official !== true
          || source?.secure !== true;
      })) return `the retained official ${slug} source roles or text hashes changed`;
  return null;
}

function gmuSourceBundleIssue(document) {
  return sourceBundleIssue(document, {
    slug: GMU_SLUG,
    bundleSha256: GMU_SOURCE_BUNDLE_SHA256,
    receipts: GMU_SOURCE_RECEIPTS,
  });
}

function oduSourceBundleIssue(document) {
  return sourceBundleIssue(document, {
    slug: ODU_SLUG,
    bundleSha256: ODU_SOURCE_BUNDLE_SHA256,
    receipts: ODU_SOURCE_RECEIPTS,
  });
}

function exactZeroUnitRequirement(section, name) {
  const receivers = asArray(section?.receivers);
  const receiver = receivers[0];
  const body = receiver?.receiving || receiver || {};
  return receivers.length === 1
    && sectionAsk(section) === 1
    && sectionUnits(section) === 0
    && sectionMaximum(section) === 0
    && receiverKind(receiver) === 'requirement'
    && receiverCodes(receiver).length === 0
    && receiverUnits(receiver) === 0
    && token(body?.name) === name
    && body?.parent_id == null
    && asArray(body?.parent_ids).length === 0
    && asArray(receiver?.options).length === 0;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return {
    supported: false,
    reason,
    affected_figures: [...affectedFigures],
  };
}

function pass(reason, proof = {}) {
  return {
    supported: true,
    reason,
    affected_figures: [...ALL_FIGURES],
    proof,
  };
}

function exactGmuSeniorShape(document) {
  if (!exactDocumentHeader(document, GMU_SLUG)) {
    return fail('evaluator is bound to the 2026-2027 120-credit George Mason source document');
  }
  const sourceIssue = gmuSourceBundleIssue(document);
  if (sourceIssue) return fail(sourceIssue);
  const groups = asArray(document?.requirement_groups);
  const core = groups[0];
  const senior = groups[1];
  if (!core || !senior || groups.length < 7) return fail('the George Mason requirement tree changed');
  if (!refsEqual(core.source_refs, ['major', 'course_catalog'])
      || !refsEqual(senior.source_refs, ['major'])
      || token(senior.requirement_layer) !== 'major'
      || token(senior.tier) !== 'nontransferable'
      || token(senior.course_level) !== 'upper_division'
      || senior.cc_articulable !== false
      || senior.distinct_course_ids_across_sections !== true
      || !arraysEqual(constraintKinds(senior), [
        'distinct_courses_across_sections', 'no_double_count_with_other_groups',
      ])) return fail('the George Mason Senior Computer Science authority or constraint shape changed');
  const sections = asArray(senior.sections);
  if (sections.length !== 2
      || sectionAsk(sections[0]) !== 1 || sectionUnits(sections[0]) !== 3
      || sectionAsk(sections[1]) !== 3 || sectionUnits(sections[1]) !== 9
      || !exactRoster(sections[0], GMU_SYSTEMS, { document, units: 3 })
      || !exactRoster(sections[1], GMU_SENIOR, { document, units: 3 })) {
    return fail('the George Mason Senior Computer Science choose counts, units, or receiver roster changed');
  }
  const fixedCs450 = asArray(core.sections)?.[9];
  if (!fixedCs450 || sectionAsk(fixedCs450) !== 1 || sectionUnits(fixedCs450) !== 3
      || !exactRoster(fixedCs450, ['CS450'], { document, units: 3 })
      || token(fixedCs450.receivers[0].overlap_key) !== 'course:CS450'
      || !markerInventoryExact(document, GMU_MARKERS)) {
    return fail('the George Mason fixed-course or overlap-marker inventory changed');
  }
  const externalIntersections = externalCourseIntersections(
    document, 1, [...GMU_SYSTEMS, ...GMU_SENIOR],
  );
  if (!arraysEqual(externalIntersections, ['CS450@0:9:0'])) {
    return fail('the George Mason cross-group receiver intersection changed');
  }
  return pass(
    'the exact source tree admits four distinct three-credit senior choices without reusing fixed CS 450',
    {
      selected_systems: ['CS455'],
      selected_additional: ['CS425', 'CS440', 'CS451'],
      selected_units: 12,
      marker_count: GMU_MARKERS.length,
    },
  );
}

function exactGmuConditionalScienceShape(document) {
  const senior = exactGmuSeniorShape(document);
  if (!senior.supported) return senior;
  const groups = asArray(document?.requirement_groups);
  const sequenceGroup = groups[5];
  const group = groups[6];
  const sequenceSections = asArray(sequenceGroup?.sections);
  if (!sequenceGroup
      || !refsEqual(sequenceGroup.source_refs, ['major'])
      || token(sequenceGroup.requirement_layer) !== 'major'
      || token(sequenceGroup.tier) !== 'transferable'
      || token(sequenceGroup.course_level) !== 'lower_division'
      || sequenceGroup.cc_articulable !== true
      || !['', 'and'].includes(conjunction(sequenceGroup))
      || constraintKinds(sequenceGroup).length !== 0
      || sequenceSections.length !== 1
      || sectionAsk(sequenceSections[0]) !== 1
      || sectionUnits(sequenceSections[0]) !== 8
      || sectionMaximum(sequenceSections[0]) !== 8
      || !exactRoster(sequenceSections[0], GMU_SCIENCE_SEQUENCES, { document, units: 8 })) {
    return fail('the George Mason approved laboratory-sequence authority, roster, or credit shape changed');
  }
  if (!group
      || !refsEqual(group.source_refs, ['major', 'general_education'])
      || token(group.requirement_layer) !== 'major'
      || token(group.tier) !== 'breadth'
      || token(group.course_level) !== 'lower_division'
      || group.cc_articulable !== true
      || !['', 'and'].includes(conjunction(group))
      || !arraysEqual(constraintKinds(group), ['prerequisite_or_different_subject'])) {
    return fail('the George Mason conditional-science authority or aggregate carrier changed');
  }
  const sections = asArray(group.sections);
  const section = sections[0];
  const receivers = asArray(section?.receivers);
  const receiver = receivers[0];
  const receiving = receiver?.receiving;
  if (sections.length !== 1
      || sectionAsk(section) !== 1
      || sectionUnits(section) !== 4
      || sectionMaximum(section) !== 4
      || receivers.length !== 1
      || receiverKind(receiver) !== 'ge_area'
      || !arraysEqual(receiverCodes(receiver), ['MASONCORENATURALSCIENCECONDITIONAL'])
      || receiverUnits(receiver) !== 4
      || asArray(receiver?.options).length !== 0
      || asArray(group?.ge_areas).length !== 0
      || asArray(section?.ge_areas).length !== 0
      || asArray(receiver?.ge_areas).length !== 0
      || token(group?.assist_requirement)
      || token(section?.assist_requirement)
      || token(receiver?.assist_requirement)
      || group?.assume_satisfiable === true
      || section?.assume_satisfiable === true
      || receiver?.assume_satisfiable === true
      || token(receiver?.overlap_key)
      || (receiving && (receiving.parent_id != null
        || asArray(receiving.parent_ids).length > 0))) {
    return fail('the George Mason conditional-science count, units, or identity-free carrier changed');
  }
  if (externalCourseIntersections(
    document, 6, ['MASONCORENATURALSCIENCECONDITIONAL'],
  ).length) {
    return fail('the George Mason conditional-science carrier gained a cross-group identity');
  }
  return pass(
    'the exact source admits the four-credit BIOL 102 Mason Core course after the selected Chemistry sequence because Biology is a different subject',
    {
      section_count: 1,
      course_count: 1,
      campus_units: 4,
      receiver_kind: 'ge_area',
      concrete_parent_ids: 0,
      articulation_options: 0,
      selected_sequence_receiver_index: GMU_SELECTED_SCIENCE_SEQUENCE_INDEX,
      selected_sequence_codes: [...GMU_SELECTED_SCIENCE_SEQUENCE],
      selected_sequence_subject: 'CHEM',
      selected_additional_science_code: GMU_ADDITIONAL_SCIENCE,
      selected_additional_science_subject: 'BIOL',
      subjects_distinct: true,
      selected_additional_science_units: 4,
      selection_basis: 'published_mason_core_natural_science_different_subject_branch',
    },
  );
}

/**
 * Mason's two residency clauses are both executable in the paper model.
 * The overall 30-credit minimum is an exact 90-credit transfer ceiling.  The
 * narrower 12-credit upper-major clause is already stricter than necessary in
 * the canonical tree: eight fixed upper-major sections (25 credits total) are
 * explicitly non-articulable.  This proof checks those exact carriers rather
 * than assuming every 300-level course is resident.
 */
function evaluateGmuResidencyPolicy(document) {
  const exact = exactGmuSeniorShape(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  const residency = audit.residency || {};
  if (token(residency.status).toLowerCase() !== 'required'
      || number(residency.minimum_units) !== 30
      || token(residency.rule) !== GMU_RESIDENCY_RULE
      || !refsEqual(residency.source_refs, ['graduation'])) return null;

  const core = asArray(document?.requirement_groups)[0];
  const residentSections = asArray(core?.sections).slice(4, 12);
  if (residentSections.length !== GMU_FIXED_RESIDENT_MAJOR.length) return null;
  for (let index = 0; index < GMU_FIXED_RESIDENT_MAJOR.length; index += 1) {
    const [code, units] = GMU_FIXED_RESIDENT_MAJOR[index];
    const section = residentSections[index];
    if (sectionAsk(section) !== 1
        || sectionUnits(section) !== units
        || sectionMaximum(section) !== units
        || token(section?.course_level) !== 'upper_division'
        || section?.cc_articulable !== false
        || !exactRoster(section, [code], { document, units })) return null;
  }
  const fixedResidentMajorUnits = GMU_FIXED_RESIDENT_MAJOR
    .reduce((sum, [, units]) => sum + units, 0);
  if (fixedResidentMajorUnits < 12) return null;

  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 30,
    residency_percentage_exact_units: 30,
    overall_transfer_cap_units: 90,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: null,
    effective_two_year_transfer_cap_units: 90,
    evidence: [{ source: 'total_units - exact residency minimum', units: 90 }],
    inventory: { fields: {}, unclassified_fields: [] },
    source_policy_id: GMU_SLUG,
    declared_subrules: ['overall_residency', 'major_upper_level_residency'],
    evaluator: 'evaluateGmuResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the two-year pathway is capped at 90 credits and 25 fixed, non-articulable upper-major credits exceed the 12-credit Mason major-residence minimum',
    issues: [],
    proof: {
      fixed_nonarticulable_upper_major_units: fixedResidentMajorUnits,
      upper_major_residency_minimum_units: 12,
      exact_fixed_codes: GMU_FIXED_RESIDENT_MAJOR.map(([code]) => code),
    },
  };
}

function exactOduUpperCsShape(document) {
  if (!exactDocumentHeader(document, ODU_SLUG)) {
    return fail('evaluator is bound to the 2026-2027 120-credit Old Dominion source document');
  }
  const groups = asArray(document?.requirement_groups);
  const required = groups[0];
  const elective = groups[1];
  if (!required || !elective || groups.length < 13) return fail('the Old Dominion requirement tree changed');
  if (!refsEqual(required.source_refs, ['major', 'course_catalog'])
      || !refsEqual(elective.source_refs, ['major', 'course_catalog'])
      || token(elective.requirement_layer) !== 'major'
      || token(elective.tier) !== 'nontransferable'
      || token(elective.course_level) !== 'upper_division'
      || elective.cc_articulable !== false
      || !arraysEqual(constraintKinds(elective), [
        'minimum_upper_level_credits_across_menu',
        'no_double_count_with_required_major_choices',
        'work_experience_cap',
      ])) return fail('the Old Dominion upper-level elective authority or constraint shape changed');
  const sections = asArray(elective.sections);
  if (sections.length !== 1 || sectionAsk(sections[0]) !== 3
      || sectionUnits(sections[0]) !== 9
      || !exactRoster(sections[0], ODU_UPPER_CS, { document, units: 3 })) {
    return fail('the Old Dominion upper-level elective choose count, units, or receiver roster changed');
  }
  const requiredChoices = [
    [15, ['CS422', 'CS480']],
    [16, ['CS450', 'CS418']],
  ];
  for (const [sectionIndex, codes] of requiredChoices) {
    const section = asArray(required.sections)[sectionIndex];
    if (!section || sectionAsk(section) !== 1 || sectionUnits(section) !== 3
        || !exactRoster(section, codes, { document, units: 3 })) {
      return fail('the Old Dominion fixed major choice roster changed');
    }
  }
  if (!markerInventoryExact(document, ODU_MARKERS)) {
    return fail('the Old Dominion overlap-marker inventory changed');
  }
  const fixedIntersections = externalCourseIntersections(document, 1, ODU_UPPER_CS);
  if (!arraysEqual(fixedIntersections, [
    'CS418@0:16:1', 'CS422@0:15:0', 'CS450@0:16:0', 'CS480@0:15:1',
  ])) return fail('the Old Dominion fixed/elective receiver intersection changed');
  return pass(
    'the exact menu has a constraint-valid three-course upper-level selection disjoint from both fixed major choices',
    {
      selected_upper_cs: ['CS312', 'CS337', 'CS402'],
      selected_upper_cs_units: 9,
      lower_level_receiver_excluded: 'CS222',
      marker_count: ODU_MARKERS.length,
    },
  );
}

/**
 * Bind Old Dominion's residency and grade policies to the retained official
 * source bundle and to their exact structured carriers. The fixed CS 411W
 * section is the required writing-intensive major course. Together with the
 * exact nine-credit, upper-level, university-only CS elective block, it also
 * supplies the twelve upper-level resident-major credits. This is a lower
 * bound proof: no other course is presumed resident merely from its number.
 */
function exactOduGraduationPolicyShape(document) {
  const upper = exactOduUpperCsShape(document);
  if (!upper.supported) return upper;
  const sourceIssue = oduSourceBundleIssue(document);
  if (sourceIssue) return fail(sourceIssue);
  const expectedProgram = token(document?.slug) === ODU_SLUG
    || token(document?._id) === `va:degree:${ODU_SLUG}:cs`
    ? ODU_PROGRAM : ODU_FINAL_PROGRAM;
  if (token(document?.program) !== expectedProgram) {
    return fail('the exact Old Dominion program identity changed');
  }

  const audit = document?.unit_audit || {};
  const residency = audit.residency || {};
  if (number(audit.graduation_minimum) !== 120
      || number(audit.modeled_units) !== 120
      || number(audit.major_upper_division_residency_minimum) !== 12
      || token(audit.required_non_elective_cs_minimum_grade).toUpperCase() !== 'C'
      || audit.senior_assessment_required !== true
      || token(residency.status).toLowerCase() !== 'required'
      || number(residency.minimum_units) !== 30
      || token(residency.rule) !== ODU_RESIDENCY_RULE
      || !refsEqual(residency.source_refs, ['major', 'policy'])) {
    return fail('the structured Old Dominion residency or grade declaration changed');
  }

  const groups = asArray(document?.requirement_groups);
  const required = groups[0];
  const elective = groups[1];
  const administrative = groups[13];
  if (groups.length !== 14
      || token(required?.title) !== 'Required Computer Science courses'
      || token(required?.requirement_layer) !== 'major'
      || token(required?.tier) !== 'transferable'
      || token(required?.course_level) !== 'mixed'
      || required?.cc_articulable !== true
      || !refsEqual(required?.source_refs, ['major', 'course_catalog'])
      || token(elective?.title) !== 'Upper-level Computer Science electives'
      || token(administrative?.title) !== 'Major grade and university assessment completion gates'
      || token(administrative?.requirement_layer) !== 'university_graduation'
      || token(administrative?.tier) !== 'nontransferable'
      || token(administrative?.course_level) !== 'administrative'
      || administrative?.cc_articulable !== false
      || !refsEqual(administrative?.source_refs, ['major', 'policy'])) {
    return fail('the Old Dominion major or graduation-policy authority changed');
  }

  const requiredSections = asArray(required?.sections);
  const writing = requiredSections[13];
  const writingReceiver = asArray(writing?.receivers)[0];
  const writingBody = writingReceiver?.receiving || writingReceiver || {};
  if (requiredSections.length !== 18
      || sectionAsk(writing) !== 1
      || sectionUnits(writing) !== 3
      || sectionMaximum(writing) !== 3
      || !exactRoster(writing, ['CS411W'], { document, units: 3 })
      || token(writingBody?.title || document?.course_titles?.CS411W)
        !== 'Professional Workforce Development II'
      || token(writingReceiver?.overlap_key) !== 'odu-impact-technology') {
    return fail('the fixed Old Dominion writing-intensive major course changed');
  }
  const administrativeSections = asArray(administrative?.sections);
  if (administrativeSections.length !== 2
      || !exactZeroUnitRequirement(administrativeSections[0], ODU_GRADE_GATE)
      || !exactZeroUnitRequirement(administrativeSections[1], ODU_ASSESSMENT_GATE)) {
    return fail('the Old Dominion zero-unit grade or assessment policy carrier changed');
  }

  return pass(
    'the exact source binds the 30-credit cap, nine resident upper-level elective credits, and fixed three-credit CS 411W residence carrier',
    {
      source_bundle_sha256: ODU_SOURCE_BUNDLE_SHA256,
      source_receipts: ODU_SOURCE_RECEIPTS.map((receipt) => ({ ...receipt })),
      overall_residency_minimum_units: 30,
      upper_major_residency_minimum_units: 12,
      resident_upper_cs_elective_units: 9,
      resident_writing_course: 'CS411W',
      resident_writing_course_units: 3,
      fixed_resident_upper_major_units: 12,
      grade_policy_carrier_path: 'requirement_groups[13].sections[0]',
      grade_policy_carrier_units: 0,
    },
  );
}

function evaluateOduResidencyPolicy(document) {
  const exact = exactOduGraduationPolicyShape(document);
  if (!exact.supported) return null;
  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 30,
    residency_percentage_exact_units: null,
    overall_transfer_cap_units: 90,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: null,
    effective_two_year_transfer_cap_units: 90,
    evidence: [{ source: 'total_units - exact residency minimum', units: 90 }],
    inventory: {
      fields: { major_upper_division_residency_minimum: 12 },
      unclassified_fields: [],
    },
    source_policy_id: ODU_SLUG,
    declared_subrules: [
      'overall_residency', 'major_upper_division_residency',
      'writing_intensive_residency',
    ],
    evaluator: 'evaluateOduResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the 90-credit overall transfer ceiling is enforced, while nine exact university-only upper-level CS elective credits plus fixed university-only CS 411W supply the 12 resident upper-major credits and the writing-at-ODU requirement',
    issues: [],
    proof: { ...exact.proof },
  };
}

/**
 * Both retained C-or-better statements remain real conditions: the major rule
 * governs required CS/prerequisite/writing courses, and the general transfer
 * rule governs acceptance of external credit. Figures 3/4 ask about a
 * hypothetical successful, grade-eligible pathway rather than the distribution
 * of student grades. Under that explicit conditioned input, these categorical
 * minimum-grade predicates do not choose courses, change units, authorize a
 * substitution, or introduce a discretionary/timing-dependent branch. The exact major carrier is
 * identity-free and zero-unit, so the policy remains blocked for complete-
 * degree analysis while having no paper-figure effect.
 */
function evaluateOduRequiredCsGradePolicy(document) {
  const exact = exactOduGraduationPolicyShape(document);
  if (!exact.supported) return null;
  const majorReceipt = ODU_SOURCE_RECEIPTS.find((receipt) => receipt.id === 'major');
  const geReceipt = ODU_SOURCE_RECEIPTS.find((receipt) => receipt.id === 'general_education');
  return {
    supported: false,
    paper_impact_proven: true,
    affected_figures: [],
    evaluator: 'evaluateOduRequiredCsGradePolicy',
    reason: 'the exact major and general-transfer C-or-better thresholds are explicit grade-eligibility conditions; Figures 1/3/4/6 condition on a successful grade-eligible pathway and do not estimate transcript outcomes, while the exact zero-unit carrier introduces no choice, discretionary or timing-dependent branch, substitution, identity, or credit change',
    proof: {
      source_bundle_sha256: ODU_SOURCE_BUNDLE_SHA256,
      grade_source_receipts: {
        major: majorReceipt.sha256,
        general_education: geReceipt.sha256,
      },
      minimum_grade: 'C',
      policy_scope: [
        'required_cs_prerequisite_and_writing_grade_eligibility',
        'general_transfer_credit_grade_eligibility',
      ],
      paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
      general_transfer_grade_threshold_conditioned: true,
      categorical_minimum_grade_predicates: true,
      discretionary_application: false,
      timing_dependent_branch: false,
      course_substitution_or_identity_change: false,
      credit_unit_change_when_condition_met: 0,
      carrier_path: 'requirement_groups[13].sections[0]',
      carrier_units: 0,
      carrier_course_identities: 0,
    },
  };
}

/**
 * ODU's remaining GPA and Senior Assessment declarations are real graduation
 * conditions, but they are not curriculum vertices.  Bind that disposition
 * to the exact official bundle and the two zero-unit policy carriers rather
 * than relying on a kind-wide administrative exemption.
 */
function evaluateOduAdministrativePolicy(document, kind) {
  const exact = exactOduGraduationPolicyShape(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  const administrative = asArray(document?.requirement_groups)[13];
  const sections = asArray(administrative?.sections);
  const facts = {
    minimum_cumulative_gpa: {
      active: number(audit.minimum_cumulative_gpa) === 2,
      carrier_path: 'requirement_groups[13].sections[0]',
      condition: 'minimum_overall_cumulative_gpa',
      threshold: 2,
    },
    minimum_major_gpa: {
      active: number(audit.minimum_major_gpa) === 2,
      carrier_path: 'requirement_groups[13].sections[0]',
      condition: 'minimum_major_cumulative_gpa',
      threshold: 2,
    },
    senior_assessment_required: {
      active: audit.senior_assessment_required === true,
      carrier_path: 'requirement_groups[13].sections[1]',
      condition: 'senior_assessment_completion',
      threshold: true,
    },
  };
  const fact = facts[kind];
  if (!fact?.active
      || sections.length !== 2
      || !exactZeroUnitRequirement(sections[0], ODU_GRADE_GATE)
      || !exactZeroUnitRequirement(sections[1], ODU_ASSESSMENT_GATE)) return null;
  return {
    supported: false,
    paper_impact_proven: true,
    affected_figures: [],
    evaluator: 'evaluateOduAdministrativePolicy',
    reason: kind === 'senior_assessment_required'
      ? 'the exact Senior Assessment carrier is a zero-credit, identity-free completion gate; the paper figures model curriculum courses and credits rather than assessment outcomes'
      : 'the exact ODU GPA carrier is a zero-credit, identity-free student-performance gate; the paper figures condition on successful completion and do not estimate transcript outcomes',
    proof: {
      ...exact.proof,
      condition: fact.condition,
      threshold: fact.threshold,
      carrier_path: fact.carrier_path,
      carrier_units: 0,
      carrier_course_identities: 0,
      course_selection_change_when_condition_met: 0,
      credit_unit_change_when_condition_met: 0,
      paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
    },
  };
}

function oduSectionTier(document, group, section) {
  const exact = exactOduGraduationPolicyShape(document);
  if (!exact.supported) return null;
  if (group === document.requirement_groups[1]
      && section === document.requirement_groups[1].sections[0]) {
    return {
      tier: 'nontransferable',
      evaluator: 'oduSectionTier',
      reason: 'the exact nine-credit upper-level CS elective block is university-only',
      proof: {
        source_bundle_sha256: ODU_SOURCE_BUNDLE_SHA256,
        section_path: 'requirement_groups[1].sections[0]',
        selected_courses: ['CS312', 'CS337', 'CS402'],
        units: 9,
      },
    };
  }
  if (group !== document.requirement_groups[0]
      || section !== document.requirement_groups[0].sections[13]) return null;
  return {
    tier: 'nontransferable',
    evaluator: 'oduSectionTier',
    reason: 'the exact fixed CS 411W writing-intensive major course must be completed at Old Dominion University',
    proof: {
      source_bundle_sha256: ODU_SOURCE_BUNDLE_SHA256,
      section_path: 'requirement_groups[0].sections[13]',
      course: 'CS411W',
      units: 3,
    },
  };
}

function exactOduTechnicalShape(document) {
  const upper = exactOduUpperCsShape(document);
  if (!upper.supported) return upper;
  const groups = asArray(document.requirement_groups);
  const technical = groups[3];
  const science = groups[10];
  if (!technical || !science
      || !refsEqual(technical.source_refs, ['major'])
      || token(technical.requirement_layer) !== 'major'
      || token(technical.tier) !== 'transferable'
      || token(technical.course_level) !== 'lower_division_or_category'
      || technical.cc_articulable !== true
      || conjunction(technical) !== 'or'
      || technical.canonical_section_index !== 0
      || !arraysEqual(constraintKinds(technical), ['no_double_count_with_other_degree_requirement'])) {
    return fail('the Old Dominion technical-elective authority or OR selection changed');
  }
  const technicalSections = asArray(technical.sections);
  if (technicalSections.length !== 2
      || sectionAsk(technicalSections[0]) !== 1
      || sectionUnits(technicalSections[0]) !== 3
      || sectionMaximum(technicalSections[0]) !== 4
      || !exactRoster(technicalSections[0], ODU_TECHNICAL, {
        document,
        unitByCode: Object.fromEntries(ODU_TECHNICAL.map((code) => [
          code, /^(?:BIOL|PHYS)/.test(code) ? 4 : 3,
        ])),
      })
      || sectionAsk(technicalSections[1]) !== 1
      || sectionUnits(technicalSections[1]) !== 3
      || sectionMaximum(technicalSections[1]) !== 4
      || asArray(technicalSections[1].receivers).length !== 1
      || receiverKind(technicalSections[1].receivers[0]) !== 'requirement') {
    return fail('the Old Dominion technical-elective sections or closed science roster changed');
  }
  const scienceSections = asArray(science?.sections);
  if (!science || !refsEqual(science.source_refs, ['major', 'general_education'])
      || token(science.requirement_layer) !== 'ge_college'
      || token(science.tier) !== 'breadth'
      || token(science.course_level) !== 'lower_division'
      || science.cc_articulable !== true
      || !['', 'and'].includes(conjunction(science))
      || scienceSections.length !== 1 || sectionAsk(scienceSections[0]) !== 1
      || sectionUnits(scienceSections[0]) !== 8
      || !exactRoster(scienceSections[0], ODU_SCIENCE_SEQUENCES, { document, units: 8 })) {
    return fail('the Old Dominion required natural-science sequence roster changed');
  }
  const technicalIntersections = externalCourseIntersections(document, 3, ODU_TECHNICAL);
  if (!arraysEqual(technicalIntersections, [
    'BIOL121N@10:0:0', 'BIOL123N@10:0:0',
    'BIOL136N@10:0:1', 'BIOL138N@10:0:1',
    'CHEM105N@10:0:2', 'CHEM107N@10:0:2',
    'CHEM121N@10:0:3', 'CHEM123N@10:0:3',
    'OEAS106N@10:0:4', 'OEAS106N@10:0:5',
    'OEAS108N@10:0:4', 'OEAS108N@10:0:6',
    'OEAS126N@10:0:6', 'OEAS126N@10:0:7',
    'OEAS250N@10:0:5', 'OEAS250N@10:0:7',
    'PHYS111N@10:0:8', 'PHYS112N@10:0:8',
    'PHYS226N@10:0:9', 'PHYS227N@10:0:9',
    'PHYS231N@10:0:10', 'PHYS232N@10:0:10',
  ])) return fail('the Old Dominion technical-elective cross-group intersection changed');
  const scienceIntersections = externalCourseIntersections(
    document, 10, ODU_SCIENCE_SEQUENCES.flat(),
  );
  if (!arraysEqual(scienceIntersections, [
    'BIOL121N@3:0:0', 'BIOL123N@3:0:1',
    'BIOL136N@3:0:2', 'BIOL138N@3:0:3',
    'CHEM105N@3:0:4', 'CHEM107N@3:0:5',
    'CHEM121N@3:0:6', 'CHEM123N@3:0:7',
    'OEAS106N@3:0:8', 'OEAS108N@3:0:9',
    'OEAS126N@3:0:13', 'OEAS250N@3:0:14',
    'PHYS111N@3:0:15', 'PHYS112N@3:0:16',
    'PHYS226N@3:0:17', 'PHYS227N@3:0:18',
    'PHYS231N@3:0:19', 'PHYS232N@3:0:20',
  ])) return fail('the Old Dominion science-sequence cross-group intersection changed');
  return pass(
    'the canonical Figure 6 route selects BIOL 121N for the technical slot and a disjoint OEAS sequence',
    {
      selected_technical: ['BIOL121N'],
      selected_science_sequence: ['OEAS106N', 'OEAS108N'],
    },
  );
}

function exactOduUpperGeShape(document) {
  const graduation = exactOduGraduationPolicyShape(document);
  if (!graduation.supported) return graduation;
  const group = asArray(document.requirement_groups)[12];
  if (!group || !refsEqual(group.source_refs, ['major', 'general_education', 'college'])
      || token(group.requirement_layer) !== 'ge_college'
      || token(group.tier) !== 'breadth'
      || token(group.course_level) !== 'upper_division'
      || group.cc_articulable !== false
      || conjunction(group) !== 'or'
      || group.canonical_section_index !== 3
      || !arraysEqual(constraintKinds(group), ['upper_division_ge_alternate_path'])) {
    return fail('the Old Dominion upper-division GE authority or canonical route changed');
  }
  const sections = asArray(group.sections);
  const expected = [[1, 12, 12], [1, 12, 12], [1, 6, 12], [1, 6, 6]];
  const expectedNames = [
    'Approved disciplinary minor, second degree, or second major',
    'Twelve-credit interdisciplinary minor; up to three credits may be in the major',
    'Approved certification program such as teaching licensure',
    'Two upper-division courses outside the College of Sciences and not required by the major',
  ];
  if (sections.length !== expected.length || sections.some((section, index) => (
    sectionAsk(section) !== expected[index][0]
    || sectionUnits(section) !== expected[index][1]
    || sectionMaximum(section) !== expected[index][2]
    || asArray(section.receivers).length !== 1
    || receiverKind(section.receivers[0]) !== 'requirement'
    || receiverUnits(section.receivers[0]) !== expected[index][1]
    || token((section.receivers[0].receiving || section.receivers[0]).name)
      !== expectedNames[index]
  ))) return fail('the Old Dominion upper-division GE route counts or credit bounds changed');
  return pass(
    'the structured canonical index selects the source-published two-course, six-credit university-only route',
    {
      ...graduation.proof,
      canonical_section_index: 3,
      canonical_units: 6,
      canonical_course_slots: 2,
      canonical_units_per_slot: 3,
      selected_route: 'Option D',
      selected_route_scope: 'outside_college_of_sciences_and_not_required_by_major',
    },
  );
}

function proveGmuDistinctCoursesAcrossSections(_container, { document } = {}) {
  return exactGmuSeniorShape(document);
}

function proveGmuNoDoubleCountWithOtherGroups(_container, { document } = {}) {
  return exactGmuSeniorShape(document);
}

function proveGmuPrerequisiteOrDifferentSubject(_container, { document } = {}) {
  const exact = exactGmuConditionalScienceShape(document);
  if (!exact.supported) return exact;
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the exact paper route selects the published Chemistry laboratory sequence and the source-listed four-credit BIOL 102 Mason Core course through the different-subject branch; shared readers use that same source-bound identity and therefore invent no conditional prerequisite edge',
    proof: {
      ...exact.proof,
      figure_1_fixed_observation: true,
      figures_3_4_fixed_units: true,
      figure_6_concrete_identity: GMU_ADDITIONAL_SCIENCE,
      figure_6_conditional_branch: 'different_subject',
      conditional_prerequisite_edge_required: false,
      figure_6_enforced_by: 'gmuOduFigure6Selection',
    },
  };
}

function proveOduMinimumUpperLevelCreditsAcrossMenu(_container, { document } = {}) {
  return exactOduUpperCsShape(document);
}

function proveOduNoDoubleCountWithRequiredMajorChoices(_container, { document } = {}) {
  return exactOduUpperCsShape(document);
}

function proveOduNoDoubleCountWithOtherDegreeRequirement(_container, { document } = {}) {
  const exact = exactOduTechnicalShape(document);
  if (!exact.supported) return exact;
  return {
    ...exact,
    reason: 'all shared readers use the exact disjoint technical/science pair set; Figures 1/3/4 optimize only within valid pairs and Figure 6 uses a valid deterministic pair',
    proof: {
      ...exact.proof,
      figures_1_3_4_joint_pair_solver: true,
      figure_6_enforced: true,
    },
  };
}

function proveOduUpperDivisionGeAlternatePath(_container, { document } = {}) {
  const exact = exactOduUpperGeShape(document);
  if (!exact.supported) return exact;
  return {
    supported: true,
    reason: 'the official major page and sample plan fix Option D as two separate three-credit upper-division courses; Figure 6 retains two explicit open-course slots without inventing either identity or prerequisite edges',
    affected_figures: [...ALL_FIGURES],
    proof: {
      ...exact.proof,
      figures_1_3_4_enforced: true,
      figure_6_open_course_slots: 2,
      figure_6_open_course_slot_units: 3,
      figure_6_enforced_by: 'gmuOduFigure6Selection',
      prerequisite_knowledge: 'unknown_by_source_for_open_slots',
    },
  };
}

function oduTechnicalSciencePairs(document) {
  const exact = exactOduTechnicalShape(document);
  if (!exact.supported) return { ready: false, reason: exact.reason, pairs: [] };
  const technical = document.requirement_groups[3].sections[0].receivers;
  const science = document.requirement_groups[10].sections[0].receivers;
  const pairs = [];
  technical.forEach((technicalReceiver, technicalIndex) => {
    const technicalCodes = new Set(receiverCodes(technicalReceiver));
    science.forEach((scienceReceiver, scienceIndex) => {
      if (receiverCodes(scienceReceiver).some((code) => technicalCodes.has(code))) return;
      pairs.push({
        technical_index: technicalIndex,
        science_index: scienceIndex,
        technical_receiver: technicalReceiver,
        science_receiver: scienceReceiver,
      });
    });
  });
  return {
    ready: pairs.length > 0,
    reason: pairs.length ? null : 'no disjoint technical/science pair remains',
    pairs,
  };
}

function evaluateGmuOduStructuralRule({ kind, path, document } = {}) {
  const slug = institutionSlug(document);
  if (kind === 'distinct_course_ids_across_sections' && slug === GMU_SLUG) {
    const exact = exactGmuSeniorShape(document);
    if (!exact.supported) return exact;
    if (path !== 'requirement_groups[1].distinct_course_ids_across_sections') {
      return fail('the George Mason distinct-course flag moved from its proven source container');
    }
    return { ...exact, evaluator: 'evaluateGmuOduStructuralRule' };
  }
  if (kind !== 'overlap_key') return null;
  const expected = slug === GMU_SLUG ? GMU_MARKERS : slug === ODU_SLUG ? ODU_MARKERS : null;
  if (!expected) return null;
  const exact = slug === GMU_SLUG
    ? exactGmuSeniorShape(document) : exactOduUpperCsShape(document);
  if (!exact.supported) return exact;
  if (!expected.some(([expectedPath]) => expectedPath === path)) {
    return fail('the overlap marker is outside the exact institution-specific marker inventory');
  }
  return {
    ...exact,
    evaluator: 'evaluateGmuOduStructuralRule',
    reason: slug === GMU_SLUG
      ? 'the exact Figure 6 selection honors every George Mason reuse/equivalence marker; university-only choices cannot receive transfer coverage'
      : 'the exact Figure 6 selection honors Old Dominion fixed/elective reuse markers, while zero-unit GE markers are explicit same-course satisfaction receipts',
  };
}

function gmuConditionalScienceVirtualSection(document) {
  const source = document?.requirement_groups?.[6]?.sections?.[0] || {};
  return {
    ...source,
    section_advisement: 1,
    unit_advisement: 4,
    unit_advisement_max: 4,
    receivers: [{
      articulation_status: null,
      not_articulated_reason: null,
      options: [],
      options_conjunction: 'or',
      tier: 'breadth',
      course_level: 'lower_division',
      cc_articulable: true,
      receiving: {
        kind: 'course',
        parent_id: courseIdFor(GMU_ADDITIONAL_SCIENCE),
        units: 4,
      },
      code_seen: GMU_ADDITIONAL_SCIENCE,
    }],
  };
}

function oduUpperGeVirtualSection(document) {
  const source = document?.requirement_groups?.[12]?.sections?.[3] || {};
  const receiver = (slot) => ({
    articulation_status: null,
    not_articulated_reason: null,
    options: [],
    options_conjunction: 'or',
    tier: 'nontransferable',
    course_level: 'upper_division',
    cc_articulable: false,
    receiving: {
      kind: 'requirement',
      name: `Open upper-division General Education Option D course ${slot}`,
      units: 3,
    },
    code_seen: null,
  });
  return {
    ...source,
    section_advisement: 2,
    unit_advisement: 6,
    unit_advisement_max: 6,
    eligibility: {
      kind: 'source_bound_open_course_slots',
      courses_required: 2,
      units_per_course: 3,
      source_scope: 'outside_college_of_sciences_and_not_required_by_major',
    },
    receivers: [receiver(1), receiver(2)],
  };
}

/**
 * Deterministic selections consumed by Figure 6 after the exact source-shape
 * proof passes. Keys are projected requirement-group/section indices.
 */
function gmuOduFigure6Selection(document) {
  const slug = institutionSlug(document);
  if (slug === GMU_SLUG) {
    const exact = exactGmuConditionalScienceShape(document);
    return exact.supported ? {
      ready: true,
      institution: slug,
      section_receiver_indices: {
        '1:0': [0],
        '1:1': [0, 1, 3],
        '5:0': [GMU_SELECTED_SCIENCE_SEQUENCE_INDEX],
        '6:0': [0],
      },
      group_section_indices: {},
      virtual_sections: { '6:0': gmuConditionalScienceVirtualSection(document) },
      named_general_education_section_keys: ['6:0'],
      proof: exact.proof,
    } : { ready: false, institution: slug, reason: exact.reason };
  }
  if (slug === ODU_SLUG) {
    const technical = exactOduTechnicalShape(document);
    const upperGe = exactOduUpperGeShape(document);
    if (!technical.supported || !upperGe.supported) {
      return {
        ready: false,
        institution: slug,
        reason: technical.supported ? upperGe.reason : technical.reason,
      };
    }
    return {
      ready: true,
      institution: slug,
      section_receiver_indices: {
        '1:0': [1, 2, 3],
        '3:0': [0],
        '10:0': [4],
        '12:3': [0, 1],
      },
      group_section_indices: { 3: 0, 12: 3 },
      virtual_sections: { '12:3': oduUpperGeVirtualSection(document) },
      named_general_education_section_keys: [],
      proof: { ...technical.proof, ...upperGe.proof },
    };
  }
  return { ready: false, institution: null, reason: 'no institution-specific selection applies' };
}

module.exports = {
  GMU_SOURCE_BUNDLE_SHA256,
  GMU_SOURCE_RECEIPTS,
  ODU_GENERAL_TRANSFER_GRADE_SOURCE_TEXT,
  ODU_MAJOR_GRADE_SOURCE_TEXT,
  ODU_UPPER_GE_SAMPLE_ROW,
  ODU_UPPER_GE_SOURCE_TEXT,
  ODU_SOURCE_BUNDLE_SHA256,
  ODU_SOURCE_RECEIPTS,
  evaluateGmuOduStructuralRule,
  evaluateGmuResidencyPolicy,
  evaluateOduAdministrativePolicy,
  evaluateOduRequiredCsGradePolicy,
  evaluateOduResidencyPolicy,
  exactGmuConditionalScienceShape,
  exactGmuSeniorShape,
  exactOduGraduationPolicyShape,
  exactOduTechnicalShape,
  exactOduUpperCsShape,
  exactOduUpperGeShape,
  gmuOduFigure6Selection,
  oduSectionTier,
  oduTechnicalSciencePairs,
  proveGmuDistinctCoursesAcrossSections,
  proveGmuNoDoubleCountWithOtherGroups,
  proveGmuPrerequisiteOrDifferentSubject,
  proveOduMinimumUpperLevelCreditsAcrossMenu,
  proveOduNoDoubleCountWithOtherDegreeRequirement,
  proveOduNoDoubleCountWithRequiredMajorChoices,
  proveOduUpperDivisionGeAlternatePath,
};
