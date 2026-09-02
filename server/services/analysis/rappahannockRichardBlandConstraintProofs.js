/**
 * Negative, source-bound Figure 3/4 proofs for Rappahannock and Richard Bland.
 *
 * Both sources contain an apparently convenient 60-credit witness. Neither
 * witness is enough to authorize the paper's transfer-oriented optimizer:
 *
 * - Rappahannock's calculus recommendation crosses two printed mathematics
 *   rows and six transfer-elective rows without saying how MTH 167's five
 *   credits or the two four-credit calculus courses occupy those rows. Its
 *   electives must also be selected for the *particular* receiving degree.
 * - Richard Bland prints a 60-credit total but also expressly permits a
 *   19-20-credit quantitative component and 15-16 electives. The resulting
 *   source-authored plans span 60-62 credits; the page never calls 60 a cap.
 *
 * This module deliberately returns `ready: false`, even when it can construct
 * a valid lower-bound witness. The witnesses are diagnostic counterexamples,
 * not publication selectors. Source/projection identity, complete official
 * source receipts, the entire authored requirement/rule tree, and the exact
 * Richard Bland local course identities are all drift-checked first.
 */

const { createHash } = require('node:crypto');
const { courseIdFor, institutionCourseIdentity } = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const {
  associateConflictProofTreeFingerprint,
} = require('./associateCollegeConstraintProofs');

const FIGURES = Object.freeze(['3', '4']);
const RAPP_ASSOCIATE_FIGURES = Object.freeze(['3', '4', '6']);

const PLANS = Object.freeze({
  rappahannock: Object.freeze({
    slug: 'rappahannock-community-college',
    numericId: 9316,
    name: 'Rappahannock Community College',
    sourceId: 'va:as:rappahannock-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Associate of Science in Science (Computer Science transfer use)',
    totalUnits: 60,
    totalUnitsMax: 62,
    catalogUrl: 'https://catalog.rappahannock.edu/preview_program.php?catoid=9&poid=695&returnto=1600',
    sourceBundleSha256: 'c804c0c017e4c78c22cb76e757c3b5ca8f4ae99bddb12f83cb6ba402ddd49555',
    proofTreeSha256: '98ce2c3ee9fab823f861432f15ee56f112b7ac77f5c98a4bb97358438f882c0a',
    // The protected operational tree predates the corrected composition. It
    // has one exact, reviewable wrapper defect: MTH 154 was copied from the
    // mathematics carrier into the approved-transfer-elective dictionary.
    // The complete tuple is accepted only so the combination proof can use
    // the exact published 123-course subcarrier; the separate mathematics and
    // receiving-program rules remain fail-closed.
    reviewedTuples: Object.freeze({
      'c804c0c017e4c78c22cb76e757c3b5ca8f4ae99bddb12f83cb6ba402ddd49555':
        Object.freeze({
          proofTreeSha256: '98ce2c3ee9fab823f861432f15ee56f112b7ac77f5c98a4bb97358438f882c0a',
          tupleStyle: 'checked_in_candidate',
        }),
      '542140ae69475ff93426ef6c1dc5de6c0f65988f610b046fc0d539b87fe1cf25':
        Object.freeze({
          proofTreeSha256: '78afc9788818298561bfa2473ee3e859a8de8d3040e2a95aae7ab84370e6286a',
          tupleStyle: 'protected_operational',
        }),
    }),
    sources: Object.freeze([
      Object.freeze({
        id: 'catalog', role: 'catalog', kind: 'catalog', secure: true,
        url: 'https://catalog.rappahannock.edu/index.php?catoid=9',
        sha256: '160120baa9202fb0a802bd1026270c3d369700184596594c4004a0923dc5bf82',
      }),
      Object.freeze({
        id: 'major', role: 'program', kind: 'major', secure: true,
        url: 'https://catalog.rappahannock.edu/preview_program.php?catoid=9&poid=695&returnto=1600',
        sha256: '1b267573b6902007e0d234c2cce0542e56afc9da2d122dc95fe63587cfc5790d',
      }),
      Object.freeze({
        id: 'program_intent', role: 'program_intent', kind: 'program_intent', secure: true,
        url: 'https://www.rappahannock.edu/explore-programs/programs/transfer-programs-transfer-va.html',
        sha256: '246bff0dffc992d2981d2959f39df9adb660f66eb0b3e853d1c7bec3ba71fb41',
      }),
      Object.freeze({
        id: 'general_education', role: 'ge', kind: 'general_education', secure: true,
        url: 'https://catalog.rappahannock.edu/preview_program.php?catoid=9&poid=614',
        sha256: 'd4a00d980a67da44f62239535d21fb8c8859e2a809583234b78a5ba6939e81b5',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation', secure: true,
        url: 'https://catalog.rappahannock.edu/content.php?catoid=9&navoid=1592',
        sha256: 'e76312dc5e933781a236783101474e77f54e9b878e8615bf4eb8e5b1b19e7d24',
      }),
      Object.freeze({
        id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog', secure: true,
        url: 'https://catalog.rappahannock.edu/content.php?catoid=9&navoid=1602',
        sha256: '140fca396b87ad8a830ea50ade3cc26a371184a4e3bfbc0ee49d04295834b91e',
      }),
    ]),
  }),
  richardBland: Object.freeze({
    slug: 'richard-bland-college',
    numericId: 9317,
    name: 'Richard Bland College',
    sourceId: 'va:as:richard-bland-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Math/Computer Science, Associate of Science — Computer Science branch',
    totalUnits: 60,
    totalUnitsMax: 60,
    catalogUrl: 'http://catalog.rbc.edu/preview_program.php?catoid=10&poid=197&returnto=412&print=1',
    sourceBundleSha256: 'eaae55d519535782ad80339e3365627a7855dededae58b8326bf643478d94186',
    proofTreeSha256: 'ba04550ca9751b192132c5afd3b3b7231d0a250e4ca6e05287c612bc3b0653e5',
    sources: Object.freeze([
      Object.freeze({
        id: 'major', role: 'program', kind: 'major', secure: false,
        url: 'http://catalog.rbc.edu/preview_program.php?catoid=10&poid=197&returnto=412&print=1',
        sha256: 'a77c485b8d11292d18c445a8f956b7a75e59ef84a909d336b801e3f5acf48a89',
      }),
      Object.freeze({
        id: 'catalog', role: 'catalog', kind: 'catalog', secure: true,
        url: 'https://www.rbc.edu/academics/programs-degree/',
        sha256: '7f1555ee6f7295feb35241768e611a907b81b999baf3b0f64c7b73ee6dd76411',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation', secure: false,
        url: 'http://catalog.rbc.edu/content.php?catoid=10&navoid=406',
        sha256: '9cb44e7bddd0a3c1e054149aa9e9ad8bac80b82e1fa6beba2e0fc5d442280045',
      }),
      Object.freeze({
        id: 'policy', role: 'policy', kind: 'policy', secure: true,
        url: 'https://www.rbc.edu/academics/apibclep-credit/',
        sha256: '3a0e2d2bf6a210a51d6f4696a88ba9c0d50e26faebdcad44cebb83cc03a48367',
      }),
      Object.freeze({
        id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog', secure: false,
        url: 'http://catalog.rbc.edu/content.php?catoid=10&navoid=418',
        sha256: '78eea4aeea15caeec616923d90834025c1bfdfbb0a4e151a1b27f504e1a8a9f5',
      }),
    ]),
  }),
});

const RAPP_QUANTITATIVE_ROUTES = Object.freeze([
  Object.freeze(['MTH154', 'MTH245']),
  Object.freeze(['MTH161', 'MTH245']),
]);
const RAPP_CALCULUS_ROUTE_TOPOLOGY = Object.freeze([
  Object.freeze({ precursor: Object.freeze(['MTH161', 'MTH162']), continuation: Object.freeze(['MTH261']) }),
  Object.freeze({ precursor: Object.freeze(['MTH161', 'MTH162']), continuation: Object.freeze(['MTH263', 'MTH264']) }),
  Object.freeze({ precursor: Object.freeze(['MTH167']), continuation: Object.freeze(['MTH261']) }),
  Object.freeze({ precursor: Object.freeze(['MTH167']), continuation: Object.freeze(['MTH263', 'MTH264']) }),
]);

const RAPP_APPROVED_TRANSFER_ELECTIVE_RULE =
  'rappahannock_exact_123_course_six_row_bundle_solver';
const RAPP_MATHEMATICS_GROUP_INDEX = 5;
const RAPP_MATHEMATICS_OPTION_SET_SHA256 =
  'f44bc1e4cc9beac0577ee5185b6ff67f334ace2079e512200f87bf4eae8601cc';
const RAPP_MATHEMATICS_GROUP_SHA256 =
  '66efb21b6a2e9a36d7612227738bcbd100d9ccdee151e2362e46c9097a379493';
const RAPP_APPROVED_TRANSFER_ELECTIVE_GROUP_INDEX = 12;
const RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256 =
  '664856d7abf2ca1489ede01ef2fd1c6dcf5618b0260a19d5b0c904266dacf163';
const RAPP_PROTECTED_OPERATIONAL_ELECTIVE_DICTIONARY_SHA256 =
  'b2e2434a2a6571924955a31cbd7bc2d9fb3ee062aba1cda07e8bfd44b5db7b9e';
const RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE = 'MTH154';
const RAPP_APPROVED_TRANSFER_ELECTIVE_ROW_RANGES = Object.freeze([
  Object.freeze({ minimum: 3, maximum: 3 }),
  Object.freeze({ minimum: 3, maximum: 3 }),
  Object.freeze({ minimum: 3, maximum: 3 }),
  Object.freeze({ minimum: 3, maximum: 3 }),
  Object.freeze({ minimum: 3, maximum: 3 }),
  Object.freeze({ minimum: 3, maximum: 4 }),
]);

const asArray = (value) => Array.isArray(value) ? value : [];
const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function exactSet(actual, expected) {
  if (!Array.isArray(actual)) return false;
  const left = [...new Set(actual.map(clean).filter(Boolean))].sort();
  const right = [...new Set(expected.map(clean).filter(Boolean))].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

function documentStyle(document, plan) {
  const source = document?._id === plan.sourceId
    && document?.kind === 'as_degree'
    && document?.va_requirement_id == null
    && document?.community_college_id === `va:cc:${plan.slug}`
    && document?.college_id === `va:cc:${plan.slug}`;
  const projection = document?._id === `as_degree:${plan.numericId}:va-cs:local_as`
    && document?.kind === 'as_degree'
    && document?.state === 'va'
    && document?.major_slug === 'va-cs'
    && document?.va_requirement_id === plan.sourceId
    && Number(document?.community_college_id) === plan.numericId
    && document?.college_id === `va:cc:${plan.numericId}`
    && document?.college_name === plan.name;
  if (source === projection) return null;
  return source ? 'accepted_source' : 'final_projection';
}

function exactSources(document, plan) {
  const actual = asArray(document?.sources);
  if (actual.length !== plan.sources.length) return false;
  const byId = new Map(actual.map((source) => [clean(source?.id), source]));
  if (byId.size !== actual.length) return false;
  return plan.sources.every((expected) => {
    const row = byId.get(expected.id);
    return row
      && clean(row.role) === expected.role
      && clean(row.kind) === expected.kind
      && clean(row.url) === expected.url
      && clean(row.requested_url) === expected.url
      && clean(row.sha256) === expected.sha256
      && row.official === true
      && row.secure === expected.secure;
  });
}

function exactReviewedDocument(document, plan) {
  const style = documentStyle(document, plan);
  if (!style) return fail(`document identity is not the reviewed ${plan.name} source/projection tuple`);
  if (style === 'final_projection' && !usesCanonicalSourceContract(document)) {
    return fail(`the reviewed ${plan.name} canonical projection contract changed or is missing`);
  }
  if (clean(document?.catalog_year) !== plan.catalogYear
      || clean(document?.degree_title_seen) !== plan.degreeTitle
      || finite(document?.total_units) !== plan.totalUnits
      || finite(document?.total_units_max) !== plan.totalUnitsMax
      || clean(document?.source) !== 'institution_catalog'
      || clean(document?.source_method) !== 'official_catalog_composition'
      || clean(document?.catalog_url) !== plan.catalogUrl) {
    return fail(`the reviewed ${plan.name} degree identity, cohort, or published unit declaration changed`);
  }
  const sourceBundleSha256 = clean(document?.provenance?.source_bundle_hash);
  const tuple = plan.reviewedTuples?.[sourceBundleSha256]
    || (sourceBundleSha256 === plan.sourceBundleSha256
      ? { proofTreeSha256: plan.proofTreeSha256, tupleStyle: 'checked_in_candidate' }
      : null);
  if (!tuple || !exactSources(document, plan)) {
    return fail(`the reviewed ${plan.name} official source bundle or exact source receipts changed`);
  }
  const treeSha256 = associateConflictProofTreeFingerprint(document);
  if (treeSha256 !== tuple.proofTreeSha256) {
    return fail(`the reviewed ${plan.name} authored requirement/rule/accounting tree changed`);
  }
  return {
    handled: true,
    ready: true,
    supported: true,
    proof: {
      document_style: style,
      tuple_style: tuple.tupleStyle,
      source_bundle_sha256: sourceBundleSha256,
      proof_tree_sha256: treeSha256,
      official_source_sha256: Object.fromEntries(plan.sources.map((source) => (
        [source.id, source.sha256]
      ))),
    },
  };
}

function optionCodes(option) {
  const keys = asArray(option?.source_course_keys).length
    ? option.source_course_keys : asArray(option?.course_keys);
  return keys.map((key) => clean(key).split(':').at(-1)).filter(Boolean);
}

function fixedRappahannockSections(document) {
  return asArray(document?.requirement_groups)
    .filter((group) => group?.ge_area == null)
    .flatMap((group) => asArray(group?.sections).map((section) => ({
      title: clean(group?.title),
      ask: finite(section?.section_advisement),
      units: finite(section?.unit_advisement),
      options: asArray(section?.receivers).flatMap((receiver) => (
        asArray(receiver?.options).map((option) => ({
          codes: optionCodes(option),
          ids: asArray(option?.course_ids).map(Number).filter(Number.isFinite),
        }))
      )),
    })));
}

function fixedRappahannockWitness(document, blockedIds) {
  const sections = fixedRappahannockSections(document);
  if (sections.length !== 12 || sections.some((section) => (
    section.ask !== 1 || !section.options.length
      || section.options.some((option) => option.ids.length !== 1 || option.codes.length !== 1)
  ))) return null;
  const ordered = sections.map((section, index) => ({
    ...section,
    index,
    options: section.options.filter((option) => !option.ids.some((id) => blockedIds.has(id))),
  })).sort((left, right) => left.options.length - right.options.length || left.index - right.index);
  const used = new Set(blockedIds);
  const selected = [];
  const visit = (index) => {
    if (index === ordered.length) return true;
    const section = ordered[index];
    for (const option of section.options) {
      if (option.ids.some((id) => used.has(id))) continue;
      option.ids.forEach((id) => used.add(id));
      selected.push({
        section_index: section.index,
        title: section.title,
        course_codes: [...option.codes],
        course_ids: [...option.ids],
        units: section.units,
      });
      if (visit(index + 1)) return true;
      selected.pop();
      option.ids.forEach((id) => used.delete(id));
    }
    return false;
  };
  return visit(0) ? selected.sort((a, b) => a.section_index - b.section_index) : null;
}

function approvedElectiveUnitVariants(optionSet, code) {
  const value = optionSet?.course_credit_overrides?.[code]
    ?? optionSet?.default_course_credits;
  if (Number.isFinite(Number(value))) return [Number(value)];
  const minimum = finite(value?.minimum);
  const maximum = finite(value?.maximum);
  if (minimum == null || maximum == null || minimum <= 0 || maximum < minimum
      || !Number.isInteger(minimum) || !Number.isInteger(maximum)) return [];
  return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
}

function exactCreditBundles(optionSet, allowedIds, targetUnits) {
  const courses = asArray(optionSet?.courses).map(clean).filter(Boolean)
    .map((code) => ({
      code,
      id: courseIdFor(code),
      units: approvedElectiveUnitVariants(optionSet, code),
    }))
    .filter((course) => course.id != null && allowedIds.has(course.id) && course.units.length)
    .sort((left, right) => left.code.localeCompare(right.code));
  const out = [];
  const visit = (start, remaining, selected) => {
    if (remaining === 0) {
      out.push({
        course_codes: selected.map((entry) => entry.code),
        course_ids: selected.map((entry) => entry.id),
        units_by_course: Object.fromEntries(selected.map((entry) => [entry.code, entry.units])),
        units: targetUnits,
      });
      return;
    }
    // Every retained elective is at least one credit; a three-credit printed
    // row therefore cannot require more than three different courses.
    if (selected.length >= targetUnits) return;
    for (let index = start; index < courses.length; index += 1) {
      const course = courses[index];
      for (const units of course.units) {
        if (units > remaining) continue;
        selected.push({ ...course, units });
        visit(index + 1, remaining - units, selected);
        selected.pop();
      }
    }
  };
  visit(0, targetUnits, []);
  const unique = new Map();
  for (const bundle of out) {
    const key = `${bundle.course_ids.join(',')}|${Object.values(bundle.units_by_course).join(',')}`;
    if (!unique.has(key)) unique.set(key, bundle);
  }
  return [...unique.values()].sort((left, right) => (
    left.course_ids.length - right.course_ids.length
    || left.course_codes.join(',').localeCompare(right.course_codes.join(','))
    || JSON.stringify(left.units_by_course).localeCompare(JSON.stringify(right.units_by_course))
  ));
}

function rappahannockDocumentClaim(document) {
  const plan = PLANS.rappahannock;
  return [
    document?._id,
    document?.va_requirement_id,
    document?.community_college_id,
    document?.college_id,
    document?.college_name,
  ].map(clean).some((value) => [
    plan.sourceId,
    `va:cc:${plan.slug}`,
    `va:cc:${plan.numericId}`,
    String(plan.numericId),
    plan.name,
    `as_degree:${plan.numericId}:va-cs:local_as`,
  ].includes(value));
}

function exactRappahannockApprovedTransferElectiveCarrier(
  document,
  owner = null,
  value = null,
  constraintIndex = 0,
) {
  const groups = asArray(document?.requirement_groups);
  const group = groups[RAPP_APPROVED_TRANSFER_ELECTIVE_GROUP_INDEX];
  const constraints = asArray(group?.analysis_constraints);
  const section = asArray(group?.sections)[0];
  const sourceOptionSet = document?.option_sets?.approved_transfer_electives;
  const sourceCourses = asArray(sourceOptionSet?.courses);
  const sourceBundleSha256 = clean(document?.provenance?.source_bundle_hash);
  const protectedOperational = sourceBundleSha256
    === '542140ae69475ff93426ef6c1dc5de6c0f65988f610b046fc0d539b87fe1cf25';
  const checkedInCandidate = sourceBundleSha256 === PLANS.rappahannock.sourceBundleSha256;
  const sourceDictionarySha256 = protectedOperational
    ? RAPP_PROTECTED_OPERATIONAL_ELECTIVE_DICTIONARY_SHA256
    : RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256;
  const expectedSourceCourseCount = protectedOperational ? 124 : 123;
  const excludedSourceCodes = protectedOperational
    ? [RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE] : [];
  const optionSet = protectedOperational && sourceOptionSet
    ? {
      ...sourceOptionSet,
      courses: sourceCourses.filter((code) => (
        clean(code) !== RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE
      )),
    }
    : sourceOptionSet;
  const courses = asArray(optionSet?.courses);
  const ids = courses.map(courseIdFor);
  const exactTarget = constraints[0];
  const attachedTarget = constraints[constraintIndex];
  if (!group || (!protectedOperational && !checkedInCandidate)
      || !Number.isInteger(constraintIndex) || constraintIndex < 0
      || (owner != null && owner !== group)
      || (value != null && value !== attachedTarget)) {
    return {
      ready: false,
      reason: 'the Rappahannock combination declaration is moved, duplicated, or detached from its exact elective carrier',
    };
  }
  if (clean(group?.title) !== 'Advisor-selected approved transfer electives'
      || clean(group?.group_conjunction).toLowerCase() !== 'and'
      || !exactSet(group?.source_refs, ['major', 'general_education', 'program_intent'])
      || clean(group?.ge_area) !== 'rcc_approved_transfer_electives_for_receiving_major'
      || group?.distinct_areas != null
      || group?.stated_credits != null
      || asArray(group?.sections).length !== 1
      || finite(section?.section_advisement) != null
      || finite(section?.unit_advisement) !== 18
      || finite(section?.unit_advisement_max) !== 19
      || !exactSet(section?.source_refs, ['major', 'general_education', 'program_intent'])
      || asArray(section?.receivers).length !== 0) {
    return {
      ready: false,
      reason: 'the exact Rappahannock six-row 18-19-credit elective carrier changed',
    };
  }
  if (constraints.length !== 3
      || clean(exactTarget?.kind) !== 'variable_credit_category_with_course_combinations'
      || clean(exactTarget?.status).toLowerCase() !== 'evaluator_not_implemented'
      || clean(exactTarget?.description) !== 'Five printed rows require three credits each and one requires three to four; one- and two-credit roster courses may need combinations.'
      || clean(constraints[1]?.kind) !== 'receiving_program_alignment_required'
      || clean(constraints[2]?.kind) !== 'no_double_count_with_other_degree_slots') {
    return {
      ready: false,
      reason: 'the exact Rappahannock combination declaration or its independent sibling rules changed',
    };
  }
  if (!sourceOptionSet
      || fingerprint(sourceOptionSet) !== sourceDictionarySha256
      || sourceCourses.length !== expectedSourceCourseCount
      || new Set(sourceCourses).size !== expectedSourceCourseCount
      || (protectedOperational && (
        sourceCourses.filter((code) => (
          clean(code) === RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE
        )).length !== 1
        || courses.includes(RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE)
      ))
      || fingerprint(optionSet) !== RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256
      || courses.length !== 123
      || new Set(courses).size !== 123
      || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
      || new Set(ids).size !== 123
      || !exactSet(optionSet?.source_refs, ['major', 'general_education', 'program_intent'])
      || finite(optionSet?.required_credits_minimum) !== 18
      || finite(optionSet?.required_credits_maximum) !== 19
      || finite(optionSet?.default_course_credits) !== 3
      || JSON.stringify(optionSet?.printed_slots) !== JSON.stringify([
        { count: 5, credits_each: 3 },
        { count: 1, credits_minimum: 3, credits_maximum: 4 },
      ])
      || courses.some((code) => approvedElectiveUnitVariants(optionSet, code).length === 0)) {
    return {
      ready: false,
      reason: 'the exact hash-bound 123-course Rappahannock elective dictionary changed',
    };
  }
  const threeCreditBundles = exactCreditBundles(optionSet, new Set(ids), 3);
  const fourCreditBundles = exactCreditBundles(optionSet, new Set(ids), 4);
  if (threeCreditBundles.length !== 117 || fourCreditBundles.length !== 432) {
    return {
      ready: false,
      reason: 'the exact Rappahannock roster no longer produces the reviewed 117 three-credit and 432 four-credit bundles',
    };
  }
  return {
    ready: true,
    group,
    section,
    constraint: exactTarget,
    optionSet,
    sourceOptionSet,
    sourceCourseCount: sourceCourses.length,
    excludedSourceCodes,
    courseIds: ids,
    threeCreditBundles,
    fourCreditBundles,
  };
}

function rappahannockElectiveCarrierProof(carrier) {
  return {
    source_wrapper_course_count: carrier.sourceCourseCount,
    excluded_nonpublished_wrapper_codes: [...carrier.excludedSourceCodes],
    exact_source_roster_course_count: carrier.courseIds.length,
    exact_published_named_roster_course_count: carrier.courseIds.length,
    protected_wrapper_normalized_in_memory_only: carrier.excludedSourceCodes.length > 0,
    source_document_or_database_changed_by_this_proof: false,
  };
}

function rappahannockMathematicsCarrierFingerprint(group) {
  return fingerprint({
    title: clean(group?.title),
    group_conjunction: clean(group?.group_conjunction).toLowerCase(),
    source_refs: asArray(group?.source_refs),
    ge_area: clean(group?.ge_area),
    human_review: clean(group?.human_review),
    analysis_constraints: asArray(group?.analysis_constraints),
    sections: asArray(group?.sections).map((section) => ({
      section_advisement: finite(section?.section_advisement),
      unit_advisement: finite(section?.unit_advisement),
      unit_advisement_max: finite(section?.unit_advisement_max),
      source_refs: asArray(section?.source_refs),
      receiver_count: asArray(section?.receivers).length,
    })),
  });
}

function exactRappahannockMathematicsCarrier(document, owner = null, value = null) {
  const group = asArray(document?.requirement_groups)[RAPP_MATHEMATICS_GROUP_INDEX];
  const constraints = asArray(group?.analysis_constraints);
  const exactTarget = constraints[0];
  const optionSet = document?.option_sets?.mathematics_requirements;
  if (!group || (owner != null && owner !== group) || (value != null && value !== exactTarget)) {
    return {
      ready: false,
      reason: 'the Rappahannock paired-mathematics declaration is moved, duplicated, or detached from its exact carrier',
    };
  }
  if (rappahannockMathematicsCarrierFingerprint(group) !== RAPP_MATHEMATICS_GROUP_SHA256
      || fingerprint(optionSet) !== RAPP_MATHEMATICS_OPTION_SET_SHA256
      || constraints.length !== 1
      || clean(exactTarget?.kind) !== 'paired_math_slots_with_cross_row_routes'
      || clean(exactTarget?.status).toLowerCase() !== 'evaluator_not_implemented') {
    return {
      ready: false,
      reason: 'the exact hash-bound Rappahannock mathematics carrier, routes, or exclusions changed',
    };
  }
  return { ready: true, group, constraint: exactTarget, optionSet };
}

function exactCourseIdSet(value) {
  const values = value instanceof Set ? [...value] : value;
  if (!Array.isArray(values) || values.some((id) => (
    !Number.isSafeInteger(Number(id)) || Number(id) <= 0
  ))) return null;
  return new Set(values.map(Number));
}

function chooseDisjointBundles(candidates, count, initiallyUsed) {
  const used = new Set(initiallyUsed);
  const selected = [];
  const visit = (start) => {
    if (selected.length === count) return true;
    if (candidates.length - start < count - selected.length) return false;
    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (candidate.course_ids.some((id) => used.has(id))) continue;
      candidate.course_ids.forEach((id) => used.add(id));
      selected.push(candidate);
      if (visit(index + 1)) return true;
      selected.pop();
      candidate.course_ids.forEach((id) => used.delete(id));
    }
    return false;
  };
  return visit(0) ? [...selected] : null;
}

/**
 * Solve the exact six printed RCC elective rows against a caller-supplied
 * eligible-course universe. Eligibility is deliberately an input: this
 * combinatorics proof does not claim that the 123-course college roster is
 * aligned to any particular receiving Computer Science program.
 *
 * `globallySelectedCourseIds` is the already-committed degree-plan state. A
 * returned course is disjoint from that set and from every other returned
 * row. The five fixed rows remain exactly three credits apiece; only the sixth
 * row may carry four credits. Variable-credit courses retain the exact unit
 * assignment chosen for their row.
 */
function solveRappahannockApprovedTransferElectiveBundles(document, {
  eligibleCourseIds,
  globallySelectedCourseIds = [],
  targetUnits = 18,
} = {}) {
  const exact = exactReviewedDocument(document, PLANS.rappahannock);
  if (!exact.ready) return { ...exact, feasible: false };
  const carrier = exactRappahannockApprovedTransferElectiveCarrier(document);
  if (!carrier.ready) {
    return {
      handled: true,
      ready: false,
      supported: false,
      feasible: false,
      affected_figures: [...FIGURES],
      reason: carrier.reason,
      proof: exact.proof,
    };
  }
  const eligible = exactCourseIdSet(eligibleCourseIds);
  const globallySelected = exactCourseIdSet(globallySelectedCourseIds);
  if (!eligible || !globallySelected || ![18, 19].includes(Number(targetUnits))) {
    return {
      handled: true,
      ready: false,
      supported: false,
      feasible: false,
      affected_figures: [...FIGURES],
      reason: 'eligible/global course ids must be exact positive integer sets and targetUnits must be 18 or 19',
      proof: exact.proof,
    };
  }
  const allowed = new Set([...eligible].filter((id) => !globallySelected.has(id)));
  const threeCreditBundles = exactCreditBundles(carrier.optionSet, allowed, 3);
  const fourCreditBundles = Number(targetUnits) === 19
    ? exactCreditBundles(carrier.optionSet, allowed, 4) : [];
  let bundles = null;
  if (Number(targetUnits) === 18) {
    bundles = chooseDisjointBundles(threeCreditBundles, 6, globallySelected);
  } else {
    for (const finalBundle of fourCreditBundles) {
      if (finalBundle.course_ids.some((id) => globallySelected.has(id))) continue;
      const used = new Set([...globallySelected, ...finalBundle.course_ids]);
      const fixed = chooseDisjointBundles(threeCreditBundles, 5, used);
      if (fixed) {
        bundles = [...fixed, finalBundle];
        break;
      }
    }
  }
  if (!bundles) {
    return {
      handled: true,
      ready: true,
      supported: true,
      feasible: false,
      affected_figures: [...FIGURES],
      reason: 'no disjoint eligible-course assignment satisfies all six exact printed elective rows',
      proof: {
        ...exact.proof,
        source_bound_rule: RAPP_APPROVED_TRANSFER_ELECTIVE_RULE,
        elective_dictionary_sha256: RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256,
        ...rappahannockElectiveCarrierProof(carrier),
        eligible_roster_course_count: [...allowed].filter((id) => carrier.courseIds.includes(id)).length,
        globally_selected_course_count: globallySelected.size,
        target_units: Number(targetUnits),
        candidate_bundle_counts: {
          three_credit: threeCreditBundles.length,
          four_credit: fourCreditBundles.length,
        },
      },
    };
  }
  const rows = bundles.map((bundle, rowIndex) => ({
    row_index: rowIndex,
    units_minimum: RAPP_APPROVED_TRANSFER_ELECTIVE_ROW_RANGES[rowIndex].minimum,
    units_maximum: RAPP_APPROVED_TRANSFER_ELECTIVE_ROW_RANGES[rowIndex].maximum,
    course_codes: [...bundle.course_codes],
    course_ids: [...bundle.course_ids],
    units_by_course: { ...bundle.units_by_course },
    units: bundle.units,
  }));
  const selectedIds = rows.flatMap((row) => row.course_ids);
  const selectedUnits = rows.reduce((sum, row) => sum + row.units, 0);
  if (selectedUnits !== Number(targetUnits)
      || new Set(selectedIds).size !== selectedIds.length
      || selectedIds.some((id) => globallySelected.has(id))
      || rows.some((row, index) => (
        row.units < RAPP_APPROVED_TRANSFER_ELECTIVE_ROW_RANGES[index].minimum
          || row.units > RAPP_APPROVED_TRANSFER_ELECTIVE_ROW_RANGES[index].maximum
      ))) {
    return {
      handled: true,
      ready: false,
      supported: false,
      feasible: false,
      affected_figures: [...FIGURES],
      reason: 'the Rappahannock bundle solver produced an internally invalid row assignment',
      proof: exact.proof,
    };
  }
  return {
    handled: true,
    ready: true,
    supported: true,
    feasible: true,
    affected_figures: [...FIGURES],
    reason: 'all six exact printed elective rows have a disjoint eligible-course assignment',
    target_units: Number(targetUnits),
    rows,
    selected_course_ids: selectedIds,
    proof: {
      ...exact.proof,
      source_bound_rule: RAPP_APPROVED_TRANSFER_ELECTIVE_RULE,
      elective_dictionary_sha256: RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256,
      ...rappahannockElectiveCarrierProof(carrier),
      published_named_roster_is_closed_feasible_universe: false,
      unlisted_courses_may_require_faculty_advisor_approval: true,
      eligible_roster_course_count: [...allowed].filter((id) => carrier.courseIds.includes(id)).length,
      globally_selected_course_count: globallySelected.size,
      candidate_bundle_counts: {
        three_credit: threeCreditBundles.length,
        four_credit: fourCreditBundles.length,
      },
      row_units: rows.map((row) => row.units),
      selected_units: selectedUnits,
      selected_course_count: selectedIds.length,
      global_no_double_count: true,
      destination_alignment_proven_by_this_solver: false,
    },
  };
}

/**
 * Source-bound negative capability receipt for RCC's mathematics footnote.
 * Two quantitative/statistics routes are exact and executable, but the same
 * official footnote also recommends calculus routes which do not fit the two
 * printed row ceilings without an unstated cross-row allocation. A partial
 * route witness cannot turn that unresolved feasible set into a selector.
 */
function proveRappahannockPairedMathematics(value, {
  owner = null,
  doc = null,
} = {}) {
  if (clean(value?.kind) !== 'paired_math_slots_with_cross_row_routes'
      || !rappahannockDocumentClaim(doc)) return { handled: false };
  const exact = exactReviewedDocument(doc, PLANS.rappahannock);
  if (!exact.ready) return { ...exact, affected_figures: [...RAPP_ASSOCIATE_FIGURES] };
  const carrier = exactRappahannockMathematicsCarrier(doc, owner, value);
  if (!carrier.ready) {
    return {
      handled: true,
      ready: false,
      supported: false,
      affected_figures: [...RAPP_ASSOCIATE_FIGURES],
      reason: carrier.reason,
      proof: exact.proof,
    };
  }
  return {
    handled: true,
    ready: false,
    supported: false,
    affected_figures: [...RAPP_ASSOCIATE_FIGURES],
    reason: 'the exact quantitative/statistics routes are known, but the official source does not allocate every recommended calculus route across the two mathematics rows and six transfer-elective rows',
    proof: {
      ...exact.proof,
      mathematics_option_set_sha256: RAPP_MATHEMATICS_OPTION_SET_SHA256,
      mathematics_group_sha256: RAPP_MATHEMATICS_GROUP_SHA256,
      printed_mathematics_rows: [
        { units_minimum: 3, units_maximum: 3 },
        { units_minimum: 3, units_maximum: 4 },
      ],
      exact_quantitative_route_witnesses: RAPP_QUANTITATIVE_ROUTES.map((route) => [...route]),
      unresolved_calculus_topology: RAPP_CALCULUS_ROUTE_TOPOLOGY.map((route) => ({
        precursor: [...route.precursor],
        continuation: [...route.continuation],
      })),
      exact_mutual_exclusion: {
        course: 'MTH167',
        cannot_also_receive_credit_for: ['MTH161', 'MTH162'],
      },
      complete_calculus_row_allocation_proven: false,
      partial_quantitative_witness_is_publication_selector: false,
      missing_source_fact:
        'an official row-by-row allocation for MTH 167 and every MTH 261 / MTH 263 / MTH 264 continuation route',
    },
  };
}

/**
 * Source-bound negative capability receipt for RCC's adviser/destination
 * rule. The 123 exact course identities are the currently printed named
 * list, not a closed feasible universe: the same official page directs a
 * student with an unlisted course to seek faculty-adviser approval, while the
 * degree footnote requires choices for the particular receiving degree.
 */
function proveRappahannockReceivingProgramAlignment(value, {
  owner = null,
  doc = null,
} = {}) {
  if (clean(value?.kind) !== 'receiving_program_alignment_required'
      || !rappahannockDocumentClaim(doc)) return { handled: false };
  const exact = exactReviewedDocument(doc, PLANS.rappahannock);
  if (!exact.ready) return { ...exact, affected_figures: [...RAPP_ASSOCIATE_FIGURES] };
  const carrier = exactRappahannockApprovedTransferElectiveCarrier(doc, owner, value, 1);
  if (!carrier.ready) {
    return {
      handled: true,
      ready: false,
      supported: false,
      affected_figures: [...RAPP_ASSOCIATE_FIGURES],
      reason: carrier.reason,
      proof: exact.proof,
    };
  }
  return {
    handled: true,
    ready: false,
    supported: false,
    affected_figures: [...RAPP_ASSOCIATE_FIGURES],
    reason: 'RCC requires selections for the intended receiving degree, publishes no universal Computer Science subset, and permits faculty-adviser review of courses outside its 123-course named list',
    proof: {
      ...exact.proof,
      elective_dictionary_sha256: RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256,
      ...rappahannockElectiveCarrierProof(carrier),
      published_named_roster_is_closed_feasible_universe: false,
      unlisted_courses_may_require_faculty_advisor_approval: true,
      receiving_program_specific_selection_required: true,
      universal_computer_science_subset_published_by_bound_sources: false,
      destination_alignment_proven: false,
      missing_source_fact:
        'a current official destination-specific transfer map or closed approved selection receipt for each receiving Computer Science program in the paper cohort',
    },
  };
}

/**
 * Figure 3/4 capability receipt for the exact RCC combination declaration.
 * The solver closes only the row-credit/no-double-count semantics. Figure 6
 * remains affected because this module does not choose a receiving-program
 * roster or publish prerequisite complexity for the selected combinations.
 */
function proveRappahannockApprovedTransferElectiveCombinations(value, {
  owner = null,
  doc = null,
} = {}) {
  if (clean(value?.kind) !== 'variable_credit_category_with_course_combinations'
      || !rappahannockDocumentClaim(doc)) return { handled: false };
  const exact = exactReviewedDocument(doc, PLANS.rappahannock);
  if (!exact.ready) return { ...exact, affected_figures: [...RAPP_ASSOCIATE_FIGURES] };
  const carrier = exactRappahannockApprovedTransferElectiveCarrier(doc, owner, value);
  if (!carrier.ready) {
    return {
      ...fail(carrier.reason, exact.proof),
      affected_figures: [...RAPP_ASSOCIATE_FIGURES],
    };
  }
  const eligibleCourseIds = new Set(carrier.courseIds);
  const lower = solveRappahannockApprovedTransferElectiveBundles(doc, {
    eligibleCourseIds,
    targetUnits: 18,
  });
  const upper = solveRappahannockApprovedTransferElectiveBundles(doc, {
    eligibleCourseIds,
    targetUnits: 19,
  });
  if (!lower.ready || !lower.feasible || !upper.ready || !upper.feasible) {
    return fail(
      'the exact 123-course Rappahannock dictionary no longer closes both published elective total edges',
      exact.proof,
    );
  }
  return {
    handled: true,
    supported: false,
    affected_figures: ['6'],
    reason: 'the hash-bound solver closes the six-row combinatorics within RCC\'s 123-course published named list for Figures 3/4; the adviser-approved open universe, destination alignment, and Figure 6 prerequisite selection remain separate unresolved rules',
    proof: {
      ...exact.proof,
      source_bound_rule: RAPP_APPROVED_TRANSFER_ELECTIVE_RULE,
      elective_dictionary_sha256: RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256,
      ...rappahannockElectiveCarrierProof(carrier),
      published_named_roster_is_closed_feasible_universe: false,
      unlisted_courses_may_require_faculty_advisor_approval: true,
      exact_candidate_bundle_counts: {
        three_credit: carrier.threeCreditBundles.length,
        four_credit: carrier.fourCreditBundles.length,
      },
      exact_row_unit_ranges: RAPP_APPROVED_TRANSFER_ELECTIVE_ROW_RANGES.map((range) => ({
        ...range,
      })),
      exact_total_unit_edges_solved: [lower.target_units, upper.target_units],
      exact_total_edge_witness_row_units: [
        lower.rows.map((row) => row.units),
        upper.rows.map((row) => row.units),
      ],
      global_no_double_count: true,
      figure_3_4_combination_semantics_resolved: true,
      destination_alignment_proven_by_this_solver: false,
      paired_mathematics_topology_proven_by_this_solver: false,
      figure_6_combination_selection_resolved: false,
    },
  };
}

function sixDisjointThreeCreditBundles(candidates, blockedIds, onComplete) {
  const selected = [];
  const used = new Set(blockedIds);
  const visit = (slot, start) => {
    if (slot === 6) return onComplete(selected, used);
    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (candidate.course_ids.some((id) => used.has(id))) continue;
      candidate.course_ids.forEach((id) => used.add(id));
      selected.push(candidate);
      // The five fixed three-credit rows and the lower edge of the sixth
      // 3-4-credit row are exchangeable for this exact 60-credit witness.
      if (visit(slot + 1, index + 1)) return true;
      selected.pop();
      candidate.course_ids.forEach((id) => used.delete(id));
    }
    return false;
  };
  return visit(0, 0) ? [...selected] : null;
}

function rappahannockExactSixtyCreditWitness(document, destinationAlignedCourseIds) {
  const carrier = exactRappahannockApprovedTransferElectiveCarrier(document);
  if (!carrier.ready) return null;
  const optionSet = carrier.optionSet;
  const allowed = new Set(asArray(destinationAlignedCourseIds instanceof Set
    ? [...destinationAlignedCourseIds] : destinationAlignedCourseIds)
    .map(Number).filter(Number.isFinite));
  if (!allowed.size) return null;
  const candidates = exactCreditBundles(optionSet, allowed, 3);
  for (const route of RAPP_QUANTITATIVE_ROUTES) {
    const routeIds = route.map(courseIdFor);
    const blocked = new Set(routeIds);
    let fixed = null;
    const electiveBundles = sixDisjointThreeCreditBundles(
      candidates,
      blocked,
      (_selected, used) => {
        fixed = fixedRappahannockWitness(document, used);
        return Boolean(fixed);
      },
    );
    if (!electiveBundles || !fixed) continue;
    return {
      total_units: 60,
      fixed_units: 36,
      mathematics_units: 6,
      approved_transfer_elective_units: 18,
      mathematics_route: [...route],
      elective_bundles: electiveBundles,
      fixed_sections: fixed,
      selected_course_ids: [
        ...fixed.flatMap((section) => section.course_ids),
        ...routeIds,
        ...electiveBundles.flatMap((bundle) => bundle.course_ids),
      ],
      destination_alignment_contract:
        'every approved-transfer-elective course id is supplied by the exact receiving-program requirement/equivalency join',
    };
  }
  return null;
}

function rappahannockFigure34NegativeProof(document, {
  destinationAlignedCourseIds = null,
} = {}) {
  const exact = exactReviewedDocument(document, PLANS.rappahannock);
  if (!exact.ready) return exact;
  const mathematics = document?.option_sets?.mathematics_requirements;
  const electives = document?.option_sets?.approved_transfer_electives;
  const unitDistribution = {};
  for (const code of asArray(electives?.courses)) {
    const variants = approvedElectiveUnitVariants(electives, code);
    const key = variants.length === 1 ? String(variants[0]) : variants.join('-');
    unitDistribution[key] = (unitDistribution[key] || 0) + 1;
  }
  if (!mathematics || !electives
      || asArray(electives.courses).length !== 123
      || new Set(electives.courses).size !== 123
      || !exactSet(electives.source_refs, ['major', 'general_education', 'program_intent'])
      || finite(electives.required_credits_minimum) !== 18
      || finite(electives.required_credits_maximum) !== 19
      || !exactSet(mathematics.source_refs, ['major', 'general_education'])) {
    return fail('the exact Rappahannock mathematics/elective dictionaries changed', exact.proof);
  }
  const witness = destinationAlignedCourseIds == null ? null
    : rappahannockExactSixtyCreditWitness(document, destinationAlignedCourseIds);
  return fail(
    'a source-valid 60-credit witness is only a lower bound: the official calculus recommendation does not uniquely allocate MTH 167 or the MTH 263/MTH 264 sequence across the printed mathematics/elective rows, so the complete optimistic feasible set is unknown',
    {
      ...exact.proof,
      published_units: { minimum: 60, maximum: 62 },
      printed_open_rows: {
        mathematics: [{ units: 3 }, { units_minimum: 3, units_maximum: 4 }],
        approved_transfer_electives: [
          { count: 5, units_each: 3 },
          { count: 1, units_minimum: 3, units_maximum: 4 },
        ],
      },
      exact_approved_transfer_elective_roster_size: 123,
      exact_approved_transfer_elective_unit_distribution: unitDistribution,
      exact_quantitative_route_witnesses: RAPP_QUANTITATIVE_ROUTES.map((route) => [...route]),
      unresolved_calculus_topology: RAPP_CALCULUS_ROUTE_TOPOLOGY.map((route) => ({
        precursor: [...route.precursor], continuation: [...route.continuation],
      })),
      source_arithmetic_conflicts: [
        'MTH167 carries 5 credits but the two printed mathematics rows have individual ceilings of 3 and 4 credits',
        'MTH263 and MTH264 carry 4 credits each but only one printed transfer-elective row permits 4 credits',
        'the recommendation does not assign continuation courses to mathematics versus approved-transfer-elective rows',
      ],
      receiving_program_alignment_required: true,
      destination_alignment_evidence_supplied: destinationAlignedCourseIds != null,
      exact_60_credit_witness: witness,
      exact_60_credit_witness_is_publication_selector: false,
      missing_source_fact:
        'an official row-by-row allocation of every recommended mathematics route, or a methodology decision that narrows the optimizer to a declared subset',
    },
  );
}

function exactRichardBlandEvidence(document, code, units) {
  const matches = asArray(document?.course_unit_evidence).filter((row) => clean(row?.code) === code);
  if (matches.length !== 1) return false;
  const expected = institutionCourseIdentity('va:cc:richard-bland-college', code);
  const row = matches[0];
  return Number(row.course_id) === expected.course_id
    && clean(row.course_key) === expected.course_key
    && clean(row.institution_id) === expected.institution_id
    && clean(row.identity_scope) === expected.identity_scope
    && clean(row.identity_contract) === expected.identity_contract
    && row.vccs_master_applicable === false
    && finite(row.units) === units
    && finite(row.min_units) === units
    && finite(row.max_units) === units
    && exactSet(row.source_refs, ['major'])
    && clean(row.evidence) === 'extracted_single_course_credit_row';
}

function richardBlandFigure34NegativeProof(document) {
  const exact = exactReviewedDocument(document, PLANS.richardBland);
  if (!exact.ready) return exact;
  const namespace = document?.course_namespace;
  if (!namespace
      || clean(namespace.kind) !== 'institution_local'
      || clean(namespace.institution_id) !== 'va:cc:richard-bland-college'
      || namespace.vccs_master_applicable !== false
      || clean(namespace.identity_contract) !== 'owner_plus_course_id'
      || clean(namespace.scoped_key_format) !== 'va:cc:richard-bland-college:<code>'
      || !exactSet(namespace.source_refs, ['major'])) {
    return fail('the exact Richard Bland institution-local course namespace changed', exact.proof);
  }
  const units = Object.freeze({ CSCI222: 4, MATH254: 3, MATH261: 4, MATH271: 3 });
  if (!Object.entries(units).every(([code, value]) => (
    exactRichardBlandEvidence(document, code, value)
  ))) {
    return fail('the exact Richard Bland branch course identities or unit evidence changed', exact.proof);
  }
  const branch = document?.requirement_groups?.[6]?.sections?.[0];
  const routes = asArray(branch?.receivers?.[0]?.options).map((option) => optionCodes(option));
  const expectedRoutes = [
    ['CSCI222', 'MATH254'],
    ['CSCI222', 'MATH261'],
    ['CSCI222', 'MATH271'],
  ];
  if (routes.length !== expectedRoutes.length
      || routes.some((route, index) => !exactSet(route, expectedRoutes[index]))) {
    return fail('the exact Richard Bland Computer Science branch alternatives changed', exact.proof);
  }
  const branchRoutes = routes.map((courseCodes) => ({
    course_codes: courseCodes,
    units: courseCodes.reduce((sum, code) => sum + units[code], 0),
  }));
  const arithmetic = branchRoutes.flatMap((route) => [15, 16].map((electiveUnits) => ({
    branch_course_codes: route.course_codes,
    fixed_units_before_branch_and_electives: 38,
    branch_units: route.units,
    elective_units: electiveUnits,
    total_units: 38 + route.units + electiveUnits,
  })));
  return fail(
    'the official arithmetic does not uniquely support a 60-credit cap: the same page authorizes 60-, 61-, and 62-credit component combinations, so discarding MATH 261 or the 16-credit elective edge would narrow the optimizer without source authority',
    {
      ...exact.proof,
      printed_total_credit_hours: 60,
      printed_component_ranges: {
        general_education: 18,
        quantitative_and_symbolic_reasoning: { minimum: 19, maximum: 20 },
        natural_science: 8,
        electives: { minimum: 15, maximum: 16 },
      },
      exact_branch_course_units: units,
      source_authored_arithmetic: arithmetic,
      totals_represented: [...new Set(arithmetic.map((row) => row.total_units))].sort(),
      exact_60_credit_routes: arithmetic.filter((row) => row.total_units === 60),
      non_60_source_authored_routes: arithmetic.filter((row) => row.total_units !== 60),
      exact_60_credit_routes_are_publication_selector: false,
      published_component_conflict_reconciled: false,
      missing_source_fact:
        'an official statement that Total Credit Hours 60 is a hard cap, or an official filler/offset rule that reconciles every named branch and elective edge',
    },
  );
}

module.exports = {
  FIGURES,
  PLANS,
  RAPP_ASSOCIATE_FIGURES,
  RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256,
  RAPP_APPROVED_TRANSFER_ELECTIVE_GROUP_INDEX,
  RAPP_PROTECTED_OPERATIONAL_ELECTIVE_DICTIONARY_SHA256,
  RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE,
  RAPP_APPROVED_TRANSFER_ELECTIVE_ROW_RANGES,
  RAPP_APPROVED_TRANSFER_ELECTIVE_RULE,
  RAPP_CALCULUS_ROUTE_TOPOLOGY,
  RAPP_MATHEMATICS_GROUP_INDEX,
  RAPP_MATHEMATICS_GROUP_SHA256,
  RAPP_MATHEMATICS_OPTION_SET_SHA256,
  RAPP_QUANTITATIVE_ROUTES,
  exactCreditBundles,
  exactRappahannockApprovedTransferElectiveCarrier,
  exactRappahannockMathematicsCarrier,
  exactReviewedDocument,
  proveRappahannockApprovedTransferElectiveCombinations,
  proveRappahannockPairedMathematics,
  proveRappahannockReceivingProgramAlignment,
  rappahannockExactSixtyCreditWitness,
  rappahannockFigure34NegativeProof,
  richardBlandFigure34NegativeProof,
  solveRappahannockApprovedTransferElectiveBundles,
};
