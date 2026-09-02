/**
 * Exact paper-figure proofs for VCU's 2026-2027 ordinary Computer Science B.S.
 *
 * The reviewed source tree exposes one explicit, source-valid canonical route
 * for the two variable major blocks: the CMSC 254 placement route and three
 * fixed three-credit CMSC electives.  Those selections are not inferred from
 * labels.  They are bound to the complete source tree, the six retained
 * official-source receipts, and the same course identities after projection.
 *
 * A separately captured official transfer-policy receipt closes the lower-
 * division ConnectED distribution and residence ceilings only for the paper's
 * exact transfer-oriented A.S. cohort.  The pair-level runtime guard checks the
 * actual sending award before applying that waiver.  The Focused Inquiry
 * timing rule is likewise executable only for this explicit transfer-entry
 * pathway: community-college credit is applied before the VCU segment, the
 * ordinary UNIV route is selected, and successful completion is conditioned
 * on the published C threshold.
 */

const { createHash } = require('node:crypto');
const {
  courseIdFor,
  receivingCourseIdForDocument,
} = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const VCU_TRANSFER_POLICY_EVIDENCE = require(
  '../../.va-catalogs/research/virginia-commonwealth-university-transfer-policy-evidence.json'
);

const SLUG = 'virginia-commonwealth-university';
const SCHOOL = 'Virginia Commonwealth University';
const SCHOOL_ID = 9229;
const SOURCE_DEGREE_ID = 'va:degree:virginia-commonwealth-university:cs';
const SOURCE_INSTITUTION_ID = 'va:uni:virginia-commonwealth-university';
const FINAL_DEGREE_ID = 'degree:9229:va-cs';
const FINAL_INSTITUTION_ID = 'va:uni:9229';
const SOURCE_PROGRAM = 'Computer Science, Bachelor of Science (B.S.)';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2026-2027';
const SOURCE_BUNDLE_SHA256 = 'f3e563b886ea0adaf469f68fb825c9afc21a05df14c001bcc43e416337cbc3e5';
const FOCUSED_INQUIRY_SOURCE_TEXT = 'A minimum grade of C is required in UNIV 200. Transfer credits are not accepted for the two UNIV courses after a student is enrolled at the university.';
const RESIDENCY_ACCREDITATION_SOURCE_TEXT = 'Note that the requirements of a minimum cumulative GPA of 2.0, a minimum of 120 semester credits and completion of at least 25% of the credit semester hours required for a bachelor’s degree program at VCU are accreditation requirements and cannot be appealed to the Academic Regulations Appeals Committee.';
const RESIDENCY_SOURCE_TEXT = 'Degree candidates must complete at least 25 percent of the credit semester hours required for their bachelor’s degree program at VCU, including at least 30 of the last 45 credits.';
const RESIDENCY_EXCEPTION_SOURCE_TEXT = 'Active-duty service members, reservists and National Guardsmen may complete the minimum of 25 percent of their degree requirements at any time while enrolled at VCU and are exempt from the “30 of the last 45 credits” requirement. Other exceptions to this rule may be granted by the Academic Regulations Appeals Committee.';
const RESIDENCY_EXCHANGE_SOURCE_TEXT = 'This requirement does not apply to students who participate in VCU-sponsored programs abroad or who earn course credit at a cooperating university through VCU domestic and international university exchanges or who are pursuing an undergraduate certificate independently of a baccalaureate degree.';
const REAL_SOURCE_TEXT = 'This requirement may be satisfied by successfully completing a 300-level (or higher) course that has received a REAL attribute of Level 2, 3 or 4 or through an approved “REAL” co-curricular experience that has received a REAL attribute of Level 3 or 4.';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: 'ed94403fe3bcccbe16d2d017421df63620c75750503a0082f5f4b17d72d38e48',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: '6ec33ca815bf2c9ac9ed09e0080603ef8c27ec7f9040ad81b0cbc25a23fa5b99',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: 'b1972c5be96b13bdbc7d602d79f2e5d8c3e6439f005e4c6676104fb49aad619e',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: '51f159f928a8291883425ee9db96c5cc32d258b4327a18f308a7782708a9ecd5',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: '917605bfa0691b554dba2f102998a50e76221a7f09a2424d5bb5fb4232e91881',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: '609f2b3def7f4a44227495bedbac581554ba5d799e60510cfceefa5c23994212',
  }),
]);

const PROOF_TREE_SHA256 = 'a981f29abd6a414d03a676f2526c44b5ccf370d664e13fe17c8aa3096fff497b';
const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const SUPPORTED_RULE_PATHS = Object.freeze({
  placement_dependent_introductory_course: 'requirement_groups[0]',
  variable_credit_selection_and_repeatability: 'requirement_groups[2]',
  no_double_count_with_core: 'requirement_groups[2]',
  focused_inquiry_grade_and_postmatriculation_transfer_rule: 'requirement_groups[8]',
});
const OPEN_RULE_PATHS = Object.freeze({
  connected_category_distribution_and_overlap: 'requirement_groups[9]',
  course_attribute_or_cocurricular_experience: 'requirement_groups[11]',
  gpa_and_residency: 'requirement_groups[12]',
});
const SELECTED_ELECTIVE_INDICES = Object.freeze([0, 1, 2]);
const SELECTED_ELECTIVE_CODES = Object.freeze(['CMSC410', 'CMSC411', 'CMSC412']);
const TRANSFER_POLICY_FACTS_SHA256 =
  '19f6d869fc73c6f5596cad3705450ff003e66393db11b151227f058ca675bce6';
const TRANSFER_POLICY_RESPONSE_SHA256 =
  'e87fcb75ab376d05a0a975ce6737ba1a282afa404b6098e15a67ff233976bcc5';
const TRANSFER_POLICY_ROBOTS_SHA256 =
  '7cb68a0d3fc3b70b5e94820ae1d9671871111601361a38fab7024e2b97f667ea';

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

function canonicalProgram(value) {
  return text(value) === FINAL_PROGRAM ? SOURCE_PROGRAM : text(value);
}

function normalizedVcuProofTree(document) {
  const courseTitles = Object.fromEntries(array(document?.requirement_groups)
    .flatMap((group) => array(group?.sections))
    .flatMap((section) => array(section?.receivers))
    .filter((receiver) => text(receiverBody(receiver).kind)?.toLowerCase() === 'course')
    .flatMap((receiver) => receiverCodes(receiver).map((code) => [
      code,
      text(receiverBody(receiver).title) || text(document?.course_titles?.[code]),
    ]))
    .filter(([, title]) => title));
  return {
    catalog_year: text(document?.catalog_year),
    program: canonicalProgram(document?.program),
    total_units: number(document?.total_units),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: [...array(document?.modeling_notes)],
    data_quality_flags: [...array(document?.data_quality_flags)],
    course_titles: courseTitles,
    groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function vcuProofTreeFingerprint(document) {
  return hash(normalizedVcuProofTree(document));
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
    const actual = array(document?.source_bundle_required);
    const expected = SOURCE_RECEIPTS.map((row) => row.id);
    return actual.length === expected.length
      && actual.every((id, index) => id === expected[index])
      ? null : 'the composed VCU source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== 'server/.va-catalogs/composed/virginia-commonwealth-university.json') {
    return 'the retained VCU source-bundle receipt changed';
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
      })) return 'the retained official VCU source roles or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactVcuTree(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact VCU composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the VCU catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = vcuProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed VCU source tree, source refs, constraints, or accounting declarations changed');
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
            return fail('one or more projected VCU course identities changed');
          }
        }
      }
    }
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed VCU 2026-2027 tree and six-role official source receipt match',
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

function vcuTransferPolicyEvidenceIssue() {
  const evidence = VCU_TRANSFER_POLICY_EVIDENCE;
  const facts = evidence?.policy_facts || {};
  const residency = facts.residency || {};
  const waiver = facts.transfer_degree_general_education || {};
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== 'vcu_2026_2027_transfer_pathway_policy_evidence'
      || evidence?.catalog_year !== CATALOG_YEAR
      || evidence?.institution?.slug !== SLUG
      || evidence?.institution?.school_id !== SCHOOL_ID
      || evidence?.verified !== true
      || array(evidence?.issues).length !== 0
      || evidence?.policy_facts_sha256 !== TRANSFER_POLICY_FACTS_SHA256
      || evidence?.source?.response_sha256 !== TRANSFER_POLICY_RESPONSE_SHA256
      || evidence?.source?.response_bytes !== 38101
      || evidence?.source?.preliminary !== true
      || evidence?.robots?.response_sha256 !== TRANSFER_POLICY_ROBOTS_SHA256
      || evidence?.robots?.policy_path_allowed !== true
      || facts?.accepted_transfer_credit?.contributes_to_hours_earned !== true
      || facts?.accepted_transfer_credit?.contributes_toward_degree_requirements !== true
      || facts?.transfer_ceiling?.maximum_units !== 90
      || residency.degree_fraction_minimum !== 0.25
      || residency.degree_units_minimum_at_120 !== 30
      || residency.final_window_units !== 45
      || residency.final_window_resident_units_minimum !== 30
      || residency.upper_level_units_minimum !== 45
      || residency.major_external_course_fraction_maximum !== 0.5
      || waiver.timing !== 'earned_prior_to_vcu_enrollment'
      || JSON.stringify(waiver.qualifying_awards)
        !== JSON.stringify(['AA', 'AS', 'AA&S', 'AFA', 'bachelors'])
      || waiver.lower_division_general_education_met !== true
      || waiver.native_program_requirements_still_apply !== true
      || evidence?.paper_interpretation?.incoming_award !== 'AS'
      || evidence?.paper_interpretation?.award_earned_before_vcu_enrollment !== true
      || evidence?.paper_interpretation
        ?.lower_division_connected_category_distribution_waived !== true
      || evidence?.paper_interpretation?.accepted_transfer_units_may_apply_to_degree_hours !== true
      || evidence?.paper_interpretation?.maximum_transfer_units !== 90
      || evidence?.paper_interpretation?.figure_3_4_exact_for_qualifying_as !== true
      || evidence?.paper_interpretation?.figure_6_connected_course_identity_increment !== 0) {
    return 'the retained official VCU transfer-degree policy evidence changed';
  }
  return null;
}

function vcuMajorResidencyCourseProof(document) {
  const exact = exactVcuTree(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  const core = document.requirement_groups?.[0];
  const residentCore = document.requirement_groups?.[1];
  const electives = document.requirement_groups?.[2];
  const lowerCodes = array(core?.sections).flatMap((section) => (
    array(section?.receivers).flatMap(receiverCodes)
  ));
  const fixedResidentCodes = array(residentCore?.sections).flatMap((section) => (
    array(section?.receivers).flatMap(receiverCodes)
  ));
  const route = selectedVcuRoute(document);
  if (!route.ready
      || JSON.stringify(lowerCodes) !== JSON.stringify([
        'CMSC235', 'CMSC254', 'CMSC255', 'CMSC256',
      ])
      || fixedResidentCodes.length !== 14
      || new Set(fixedResidentCodes).size !== fixedResidentCodes.length
      || array(electives?.sections).length !== 1
      || route.elective_codes.length !== 3
      || new Set(route.elective_codes).size !== 3
      || route.elective_codes.some((code) => fixedResidentCodes.includes(code))) {
    return { ready: false, reason: 'the exact VCU major-course residency witness changed' };
  }
  const totalMajorCourses = lowerCodes.length
    + fixedResidentCodes.length + route.elective_codes.length;
  const residentMajorCourses = 1
    + fixedResidentCodes.length + route.elective_codes.length;
  const minimumResidentMajorCourses = Math.ceil(totalMajorCourses / 2);
  if (totalMajorCourses !== 21 || residentMajorCourses !== 18
      || minimumResidentMajorCourses !== 11) {
    return { ready: false, reason: 'the VCU major-course residency arithmetic changed' };
  }
  return {
    ready: true,
    total_major_course_attempts: totalMajorCourses,
    fixed_resident_major_course_attempts: residentMajorCourses,
    resident_major_course_attempts_minimum: minimumResidentMajorCourses,
    potentially_external_lower_major_codes: ['CMSC235', 'CMSC255', 'CMSC256'],
    fixed_resident_lower_major_code: 'CMSC254',
    fixed_resident_upper_core_codes: fixedResidentCodes,
    selected_resident_elective_codes: [...route.elective_codes],
  };
}

/**
 * Pair-level runtime guard for the policy proof.  The bachelor audit can prove
 * what VCU does for a qualifying transfer-oriented A.S.; this guard proves
 * that the actual sending document in each Figure 3/4 cell is that award and
 * that both sides still carry the canonical source contract.
 */
function vcuTransferOrientedAsWaiver(document, associateDocument) {
  const claimsVcu = [
    document?.slug, document?._id, document?.va_requirement_id,
    document?.institution_id, document?.school_id, document?.school,
  ].map((value) => String(value ?? '').trim()).some((value) => [
    SLUG, SOURCE_DEGREE_ID, SOURCE_INSTITUTION_ID, FINAL_DEGREE_ID,
    FINAL_INSTITUTION_ID, String(SCHOOL_ID), SCHOOL,
  ].includes(value));
  if (!claimsVcu) return { applicable: false, ready: false };
  const exact = exactVcuTree(document);
  if (!exact.supported) return { applicable: true, ready: false, reason: exact.reason };
  const evidenceIssue = vcuTransferPolicyEvidenceIssue();
  if (evidenceIssue) return { applicable: true, ready: false, reason: evidenceIssue };
  const communityCollegeId = Number(associateDocument?.community_college_id);
  if (!associateDocument || associateDocument?.kind !== 'as_degree'
      || text(associateDocument?.degree_type) !== 'local_as'
      || text(associateDocument?.source_degree_type)?.toUpperCase() !== 'AS'
      || text(associateDocument?.state)?.toLowerCase() !== 'va'
      || text(associateDocument?.status) !== 'found'
      || text(associateDocument?.va_requirement_status) !== 'extracted'
      || !Number.isInteger(communityCollegeId)
      || text(associateDocument?.college_id) !== `va:cc:${communityCollegeId}`
      || !/^as_degree:\d+:va-cs:local_as$/.test(text(associateDocument?._id) || '')
      || !/^va:as:[a-z0-9-]+:cs$/.test(text(associateDocument?.va_requirement_id) || '')
      || !usesCanonicalSourceContract(associateDocument)
      || !associateDocument?.provenance?.source_bundle_hash) {
    return {
      applicable: true,
      ready: false,
      reason: 'the VCU policy proof requires an exact pre-enrollment Virginia transfer-oriented A.S. source document',
    };
  }
  return {
    applicable: true,
    ready: true,
    award: 'AS',
    earned_before_vcu_enrollment: true,
    lower_division_general_education_met: true,
    accepted_transfer_credit_applies_to_degree_hours: true,
    transfer_ceiling_units: 90,
    evidence_sha256: TRANSFER_POLICY_FACTS_SHA256,
  };
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}) {
  const expectedPath = SUPPORTED_RULE_PATHS[kind] || OPEN_RULE_PATHS[kind];
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
    return `the ${kind} source declaration is absent, duplicated, or detached from its container`;
  }
  return null;
}

function selectedVcuRoute(document) {
  const exact = exactVcuTree(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  const placement = document.requirement_groups?.[0]?.sections?.[1];
  const placementReceivers = array(placement?.receivers);
  const placementCodes = placementReceivers.map((receiver) => receiverCodes(receiver)[0] || null);
  if (number(placement?.section_advisement ?? placement?.select) !== 1
      || number(placement?.unit_advisement ?? placement?.units) !== 4
      || placementReceivers.length !== 2
      || placementCodes[0] !== 'CMSC254'
      || number(receiverBody(placementReceivers[0]).units) !== 4
      || text(receiverBody(placementReceivers[1]).kind)?.toLowerCase() !== 'requirement'
      || number(receiverBody(placementReceivers[1]).units) !== 4) {
    return { ready: false, reason: 'the exact equal-capacity VCU placement routes changed' };
  }

  const elective = document.requirement_groups?.[2]?.sections?.[0];
  const selected = SELECTED_ELECTIVE_INDICES.map((index) => elective?.receivers?.[index]);
  const selectedCodes = selected.map((receiver) => receiverCodes(receiver)[0] || null);
  if (number(elective?.section_advisement ?? elective?.select) !== 3
      || number(elective?.unit_advisement ?? elective?.units) !== 9
      || JSON.stringify(selectedCodes) !== JSON.stringify(SELECTED_ELECTIVE_CODES)
      || selected.some((receiver) => number(receiverBody(receiver).units) !== 3)
      || new Set(selectedCodes).size !== selectedCodes.length) {
    return { ready: false, reason: 'the exact fixed-credit VCU elective selection changed' };
  }

  const coreCodes = new Set([0, 1].flatMap((groupIndex) => (
    array(document.requirement_groups?.[groupIndex]?.sections)
      .flatMap((section) => array(section.receivers).flatMap(receiverCodes))
  )));
  const electiveCodes = array(elective?.receivers).flatMap(receiverCodes);
  const overlap = electiveCodes.filter((code) => coreCodes.has(code));
  if (overlap.length) {
    return { ready: false, reason: 'the VCU elective roster now overlaps a fixed core course' };
  }

  const focused = document.requirement_groups?.[8];
  const focusedSections = array(focused?.sections);
  const focusedRosters = focusedSections.map((section) => (
    array(section?.receivers).map((receiver) => receiverCodes(receiver)[0] || null)
  ));
  if (focusedSections.length !== 2
      || JSON.stringify(focusedRosters) !== JSON.stringify([
        ['UNIV111', 'HONR230'], ['UNIV200', 'HONR240'],
      ])
      || focusedSections.some((section) => (
        number(section?.section_advisement ?? section?.select) !== 1
        || number(section?.unit_advisement ?? section?.units) !== 3
        || array(section?.receivers).some((receiver) => number(receiverBody(receiver).units) !== 3)
      ))) {
    return { ready: false, reason: 'the exact ordinary and honors Focused Inquiry routes changed' };
  }

  return {
    ready: true,
    placement_receiver_index: 0,
    placement_code: 'CMSC254',
    placement_units: 4,
    elective_receiver_indices: [...SELECTED_ELECTIVE_INDICES],
    elective_codes: selectedCodes,
    elective_units: 9,
    core_elective_overlap_codes: [],
    focused_inquiry_receiver_indices: [0, 0],
    focused_inquiry_codes: ['UNIV111', 'UNIV200'],
    focused_inquiry_units: 6,
    honors_replacements_selected: 0,
    proof: exact.proof,
  };
}

/**
 * Runtime selection for the paper's transfer-entry model. Requiring the
 * caller to assert transfer entry is what enforces (rather than ignores) the
 * postmatriculation clause: no external credit is introduced after the VCU
 * segment begins.
 */
function vcuFigureSelection(document, { transferEntry = false } = {}) {
  const route = selectedVcuRoute(document);
  if (!route.ready) return route;
  if (transferEntry !== true) {
    return {
      ready: false,
      reason: 'the VCU Focused Inquiry proof applies only when community-college credit precedes VCU matriculation',
    };
  }
  return {
    ready: true,
    transfer_entry: true,
    postmatriculation_external_credit_units: 0,
    section_receiver_indices: {
      '0:1': [route.placement_receiver_index],
      '2:0': [...route.elective_receiver_indices],
      '8:0': [route.focused_inquiry_receiver_indices[0]],
      '8:1': [route.focused_inquiry_receiver_indices[1]],
    },
    proof: {
      ...route.proof,
      focused_inquiry_codes: [...route.focused_inquiry_codes],
      focused_inquiry_units: route.focused_inquiry_units,
      honors_replacements_selected: route.honors_replacements_selected,
    },
  };
}

/**
 * Exact Figure 6 disposition for VCU's REAL requirement.  The retained
 * graduation source makes the approved Level 3-4 co-curricular experience a
 * complete alternative to the attributed-course route.  That branch is a
 * real completion condition, but it contributes no curriculum-course vertex,
 * credit, or prerequisite edge to the paper's graph.
 *
 * This proof is deliberately independent of transfer-entry timing.  Unlike
 * Focused Inquiry, the published REAL alternative applies to both the
 * resident comparison and the transfer pathway.
 */
function vcuFigure6NonCourseSelection(document) {
  const exact = exactVcuTree(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  const group = document.requirement_groups?.[11];
  const section = group?.sections?.[0];
  const constraint = array(group?.analysis_constraints).find((entry) => (
    entry?.kind === 'course_attribute_or_cocurricular_experience'
  ));
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  if (!constraint
      || ruleContainerIssue(constraint.kind, group, {
        document,
        path: 'requirement_groups[11]',
        constraint,
      })
      || array(group?.sections).length !== 1
      || number(section?.section_advisement ?? section?.select) !== 1
      || number(section?.unit_advisement ?? section?.units) !== 0
      || number(section?.unit_advisement_max ?? section?.units_max
        ?? section?.unit_advisement ?? section?.units) !== 0
      || receivers.length !== 1
      || text(body?.kind)?.toLowerCase() !== 'requirement'
      || text(body?.name) !== 'Complete one qualifying VCU REAL experiential-learning activity'
      || number(body?.units) !== 0
      || body?.parent_id != null
      || array(body?.parent_ids).length
      || receiverCodes(receivers[0]).length) {
    return {
      ready: false,
      reason: 'the exact zero-course VCU REAL completion carrier changed',
    };
  }
  return {
    ready: true,
    non_course_section_keys: ['11:0'],
    selected_route: 'approved_REAL_level_3_4_cocurricular_experience',
    selected_route_kind: 'non_course_completion',
    carrier_path: 'requirement_groups[11].sections[0]',
    carrier_units: 0,
    carrier_course_identities: 0,
    added_prerequisite_edges: 0,
    proof: exact.proof,
  };
}

function evaluateVcuConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (!SUPPORTED_RULE_PATHS[kind] && !OPEN_RULE_PATHS[kind]) {
    return fail('no exact VCU evaluator handles this rule');
  }
  const exact = exactVcuTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context);
  if (issue) return fail(issue);
  if (kind === 'course_attribute_or_cocurricular_experience') {
    const selection = vcuFigure6NonCourseSelection(context.document);
    if (!selection.ready) return fail(selection.reason);
    return {
      supported: false,
      affected_figures: [],
      paper_impact_proven: true,
      evaluator: 'evaluateVcuConstraint',
      reason: 'the exact VCU REAL rule permits an approved Level 3-4 co-curricular completion route; selecting that published non-course branch changes no curriculum course identity, prerequisite edge, or credit in Figures 1/3/4/6',
      proof: {
        ...selection.proof,
        rule_path: context.path,
        selected_route: selection.selected_route,
        selected_route_kind: selection.selected_route_kind,
        carrier_path: selection.carrier_path,
        carrier_units: selection.carrier_units,
        carrier_course_identities: selection.carrier_course_identities,
        added_prerequisite_edges: selection.added_prerequisite_edges,
        course_selection_change: 0,
        credit_unit_change: 0,
        complete_degree_completion_still_required: true,
      },
    };
  }
  if (kind === 'connected_category_distribution_and_overlap') {
    const evidenceIssue = vcuTransferPolicyEvidenceIssue();
    if (evidenceIssue) return fail(evidenceIssue, ['3', '4', '6']);
    return {
      supported: true,
      affected_figures: ['3', '4', '6'],
      paper_impact_proven: true,
      reason: 'the fixed paper cohort enters with a completed transfer-oriented A.S.; VCU explicitly treats that award as meeting every lower-division general-education requirement, while accepted transfer credit contributes to degree hours, so the underlying ConnectED category/prefix solver cannot change these Figure 3/4 cells or add a Figure 6 course identity',
      proof: {
        ...exact.proof,
        rule_path: context.path,
        net_connected_capacity_units: 15,
        policy_facts_sha256: TRANSFER_POLICY_FACTS_SHA256,
        qualifying_award: 'AS',
        award_timing: 'earned_prior_to_vcu_enrollment',
        lower_division_general_education_met: true,
        accepted_transfer_credit_contributes_to_degree_hours: true,
        program_specific_named_requirements_waived: false,
        connected_course_identity_increment_for_figure_6: 0,
        enforced_at_runtime_by: 'vcuTransferOrientedAsWaiver',
      },
    };
  }
  if (kind === 'gpa_and_residency') {
    const residency = evaluateVcuResidencyPolicy(context.document);
    if (!residency?.supported) {
      return {
        supported: false,
        affected_figures: ['3', '4'],
        paper_impact_proven: false,
        reason: residency?.reason || 'the exact VCU residency proof is unavailable',
        proof: {
          ...exact.proof,
          rule_path: context.path,
          residency_issues: [...array(residency?.issues)],
        },
      };
    }
    return {
      supported: true,
      affected_figures: ['3', '4'],
      paper_impact_proven: true,
      reason: 'the paper conditions on a successful grade-eligible pathway; the retained transfer policy independently fixes a universal 90-credit ceiling, 25-percent VCU floor, and 50-percent major-course ceiling, all satisfied by the exact source-bound route',
      proof: {
        ...exact.proof,
        rule_path: context.path,
        paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
        cumulative_gpa_condition: 2,
        major_gpa_condition: 2,
        gpa_course_or_credit_effect_when_condition_met: 0,
        residency_supported: true,
        residency_issues: [],
        effective_two_year_transfer_cap_units:
          residency.effective_two_year_transfer_cap_units,
        major_residency: residency.proof.major_residency,
      },
    };
  }
  const route = selectedVcuRoute(context.document);
  if (!route.ready) return fail(route.reason);
  const reasons = {
    placement_dependent_introductory_course:
      'the canonical paper pathway selects the published four-credit CMSC 254 route; the placement-exempt route has the same nontransferable four-credit capacity',
    variable_credit_selection_and_repeatability:
      'the canonical paper pathway selects three distinct fixed three-credit CMSC electives and never relies on either variable-credit receiver',
    no_double_count_with_core:
      'the complete published elective roster has no course identity in common with either fixed VCU core group',
    focused_inquiry_grade_and_postmatriculation_transfer_rule:
      'the exact ordinary route selects UNIV 111 and UNIV 200, community-college credit precedes the VCU segment, and the successful pathway is explicitly conditioned on the published C threshold; no honors eligibility or postmatriculation transfer is assumed',
  };
  return {
    ...exact,
    reason: reasons[kind],
    proof: {
      ...exact.proof,
      rule_path: context.path,
      placement_receiver_index: route.placement_receiver_index,
      placement_code: route.placement_code,
      placement_units: route.placement_units,
      elective_receiver_indices: route.elective_receiver_indices,
      elective_codes: route.elective_codes,
      elective_units: route.elective_units,
      core_elective_overlap_codes: route.core_elective_overlap_codes,
      ...(kind === 'focused_inquiry_grade_and_postmatriculation_transfer_rule' ? {
        focused_inquiry_receiver_indices: route.focused_inquiry_receiver_indices,
        focused_inquiry_codes: route.focused_inquiry_codes,
        focused_inquiry_units: route.focused_inquiry_units,
        honors_replacements_selected: route.honors_replacements_selected,
        paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
        transfer_timing_enforced_by: 'community_college_credit_precedes_university_segment',
        postmatriculation_external_credit_units: 0,
      } : {}),
    },
  };
}

/**
 * Source-bound disposition for the two VCU GPA fields. They remain real
 * complete-degree conditions, while the paper's successful-pathway input and
 * exact zero-unit carriers prove that they cannot alter a course/credit cell.
 */
function evaluateVcuAdministrativePolicy(document, kind) {
  if (!['minimum_cumulative_gpa', 'minimum_major_gpa'].includes(kind)) return null;
  const exact = exactVcuTree(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  if (number(audit[kind]) !== 2) return null;
  const group = document?.requirement_groups?.[12];
  const sectionIndex = kind === 'minimum_cumulative_gpa' ? 0 : 1;
  const expectedLabel = kind === 'minimum_cumulative_gpa' ? 'Cumulative GPA' : 'Major GPA';
  const expectedName = kind === 'minimum_cumulative_gpa'
    ? 'Minimum 2.0 cumulative VCU GPA' : 'Minimum 2.0 major-area GPA';
  const section = array(group?.sections)[sectionIndex];
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  if (text(group?.title) !== 'University graduation GPA and residence policies'
      || text(group?.requirement_layer) !== 'university_graduation'
      || text(group?.tier) !== 'nontransferable'
      || text(group?.course_level) !== 'nonunit_policy'
      || group?.cc_articulable !== false
      || JSON.stringify(array(group?.source_refs)) !== JSON.stringify(['graduation', 'policy'])
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
    evaluator: 'evaluateVcuAdministrativePolicy',
    reason: 'the exact VCU GPA carrier is a zero-credit, identity-free student-performance gate; the paper figures condition on successful completion and do not estimate transcript outcomes',
    proof: {
      ...exact.proof,
      condition: kind,
      threshold: 2,
      carrier_path: `requirement_groups[12].sections[${sectionIndex}]`,
      carrier_units: 0,
      carrier_course_identities: 0,
      course_selection_change_when_condition_met: 0,
      credit_unit_change_when_condition_met: 0,
      paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
    },
  };
}

/**
 * Exact transfer-cohort residency analysis.  The supplemental current
 * transfer-admission policy states a direct maximum of 90 accepted transfer
 * credits and says the 25-percent, final-window, upper-level, and half-major
 * rules apply regardless of accepted-credit volume.  The paper's incoming
 * community-college A.S. segment is neither a VCU-sponsored exchange nor
 * postmatriculation credit, and military/ARAC exceptions only relax timing;
 * none can raise the independently published 90-credit ceiling.
 */
function evaluateVcuResidencyPolicy(document) {
  const exact = exactVcuTree(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  const residency = audit?.residency || {};
  if (text(residency.status)?.toLowerCase() !== 'required'
      || number(residency.minimum_units) !== 30
      || number(residency.minimum_fraction) !== 0.25
      || text(residency.rule) !== 'At least 25 percent of the degree must be completed at VCU, including at least 30 of the final 45 credits at VCU, subject to the published exceptions.'
      || JSON.stringify(array(residency.source_refs)) !== JSON.stringify(['graduation', 'policy'])) {
    return null;
  }
  const evidenceIssue = vcuTransferPolicyEvidenceIssue();
  if (evidenceIssue) return null;
  const majorResidency = vcuMajorResidencyCourseProof(document);
  if (!majorResidency.ready) return null;
  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 30,
    residency_percentage_exact_units: 30,
    overall_transfer_cap_units: 90,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: 90,
    effective_two_year_transfer_cap_units: 90,
    evidence: [
      { source: '120 - exact 25-percent residence minimum', units: 90 },
      { source: '120 - exact final-window resident minimum', units: 90 },
    ],
    inventory: { fields: {}, unclassified_fields: [] },
    source_policy_id: SLUG,
    declared_subrules: [
      'overall_residency', 'final_window_residency', 'military_exception',
      'ARAC_discretionary_waiver', 'VCU_program_and_exchange_exception',
    ],
    evaluator: 'evaluateVcuResidencyPolicy',
    evaluator_version: 2,
    supported: true,
    reason: 'VCU directly caps accepted transfer credit at 90 units; the 30-unit institutional floor and final-window rule imply the same ceiling, and 18 fixed resident major-course attempts exceed the 11-course half-major minimum on the exact route',
    issues: [],
    proof: {
      ...exact.proof,
      policy_facts_sha256: TRANSFER_POLICY_FACTS_SHA256,
      published_transfer_maximum_units: 90,
      overall_transfer_cap_units: 90,
      final_window_transfer_cap_units: 90,
      transfer_timing_enforced_by: 'community_college_credit_precedes_university_segment',
      accreditation_floor_declared_nonappealable: true,
      sponsored_exchange_selected: false,
      postmatriculation_external_credit_units: 0,
      military_or_arac_timing_exception_can_raise_90_credit_ceiling: false,
      major_residency: majorResidency,
    },
  };
}

function vcuSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  if (!OPEN_RULE_PATHS[kind]) return null;
  const exact = exactVcuTree(context.document);
  if (!exact.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  })) return null;
  if (kind === 'connected_category_distribution_and_overlap') {
    // Figure 1 excludes GE capacity. The open category roster can still move
    // applied transfer credit and prerequisite-bearing selections.
    return ['3', '4', '6'];
  }
  if (kind === 'gpa_and_residency') return ['3', '4'];
  // VCU REAL is represented by one zero-unit non-course completion carrier.
  // It changes no Figure 1 observation or Figure 3/4 applied unit. Figure 6
  // still needs an explicit course-versus-cocurricular selection policy, so it
  // remains fail-closed there.
  return ['6'];
}

function vcuQualityFlagAffectedFigures(flag, document) {
  const code = text(flag?.code);
  if (code !== 'connected_overlap_evaluator_required') return null;
  const exact = exactVcuTree(document);
  return exact.supported ? ['3', '4', '6'] : null;
}

module.exports = {
  FOCUSED_INQUIRY_SOURCE_TEXT,
  PROOF_TREE_SHA256,
  RESIDENCY_ACCREDITATION_SOURCE_TEXT,
  RESIDENCY_EXCEPTION_SOURCE_TEXT,
  RESIDENCY_EXCHANGE_SOURCE_TEXT,
  RESIDENCY_SOURCE_TEXT,
  REAL_SOURCE_TEXT,
  SELECTED_ELECTIVE_CODES,
  SELECTED_ELECTIVE_INDICES,
  SOURCE_RECEIPTS,
  TRANSFER_POLICY_FACTS_SHA256,
  evaluateVcuConstraint,
  evaluateVcuAdministrativePolicy,
  evaluateVcuResidencyPolicy,
  exactVcuTree,
  normalizedVcuProofTree,
  selectedVcuRoute,
  vcuFigureSelection,
  vcuFigure6NonCourseSelection,
  vcuMajorResidencyCourseProof,
  vcuProofTreeFingerprint,
  vcuQualityFlagAffectedFigures,
  vcuSourceSpecificAffectedFigures,
  vcuTransferOrientedAsWaiver,
  vcuTransferPolicyEvidenceIssue,
};
