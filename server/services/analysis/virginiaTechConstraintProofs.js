/**
 * Exact paper-figure proofs for Virginia Tech's 2026-2027 Computer Science
 * B.S. canonical source.
 *
 * The proof is bound to the complete reviewed requirement tree, exact unit
 * audit, all source refs/constraints/notes, projected course identities, and
 * all six retained official source receipts. It deliberately does not invent
 * the under-specified standalone MATH 2405H credit adjustment: shared readers
 * preserve its legal three-credit substitution and the unit allocator fails
 * an affected cell closed if the unplaced surplus appears. Open CS menus,
 * Pathways identities, student-grade/permission state, and the two ENGE Career
 * Bridge codes missing from the retained course catalog remain explicit gates.
 */

const { createHash } = require('node:crypto');
const {
  courseIdFor,
  receivingCourseIdForDocument,
} = require('../virginia/courseIdentity');
const PATHWAYS_CAPACITY_EVIDENCE = require(
  '../../.va-catalogs/research/virginia-tech-pathways-capacity-evidence.json'
);

const SLUG = 'virginia-polytechnic-institute-and-state-university';
const SCHOOL = 'Virginia Polytechnic Institute and State University';
const SCHOOL_ID = 9230;
const SOURCE_DEGREE_ID = `va:degree:${SLUG}:cs`;
const SOURCE_INSTITUTION_ID = `va:uni:${SLUG}`;
const FINAL_DEGREE_ID = `degree:${SCHOOL_ID}:va-cs`;
const FINAL_INSTITUTION_ID = `va:uni:${SCHOOL_ID}`;
const SOURCE_PROGRAM = 'Computer Science Major, Bachelor of Science in Computer Science';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2026-2027';
const SOURCE_BUNDLE_SHA256 = 'f5e40722ad7608e153d4e7d68192ada50abc6875645316c6e433508747407075';
const PATHWAYS_CAPACITY_EVIDENCE_SHA256 = 'aa100d28eb84d2230745383c6178b1502459a45fc059244736090990014095e8';
const SUPPLEMENTAL_USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';
const SUPPLEMENTAL_SOURCE_PATHS = Object.freeze({
  pathways_host_robots: Object.freeze([
    Object.freeze({
      source_id: 'pathways_guide_2026_27',
      path: '/content/dam/pathways_prov_vt_edu/1AboutPathways/course-catalog/Pathways%20Course%20Guide%20by%20Concept%2026-27.pdf',
      allowed: true,
    }),
  ]),
  catalog_host_robots: Object.freeze([
    Object.freeze({
      source_id: 'visual_arts_course_descriptions',
      path: '/course-descriptions/art/art.pdf', allowed: true,
    }),
    Object.freeze({
      source_id: 'psychology_course_descriptions',
      path: '/course-descriptions/psyc/psyc.pdf', allowed: true,
    }),
    Object.freeze({
      source_id: 'sociology_course_descriptions',
      path: '/course-descriptions/soc/soc.pdf', allowed: true,
    }),
  ]),
});

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: '5734621e7745782d5018255d94884f5a56c0351dda2e25783fdb14bb945cfcf5',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: '1fd916f3737867768eec86ae07218907112c598bd1323a6d715a885402a76251',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: 'f528785a2ea8c8a37442ed618c72c61dd9064f7781084849613631e7820e618e',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: 'a89d241281d8d9d9676f798ce772f3dbc383556e0a7bdc49f054270971c1a0cb',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: '1fd916f3737867768eec86ae07218907112c598bd1323a6d715a885402a76251',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: '3cc64422c0972d8f98279440741314669b420a50c135bb343f15ef518fb16ac2',
  }),
]);

// Filled only after composition -> accepted source -> final numeric projection
// parity is established. Wrapper ids and derived display fields are excluded;
// every authored requirement, receipt, note, flag, and accounting fact remains
// bound below.
const PROOF_TREE_SHA256 = '7914e1e4ebff823fdc00d3e345f8db2c604109c7a15739960a7122ea5fb49376';

// The stored, human-verified Virginia Tech tree.  It is the reviewed candidate
// tree above minus the five candidate-only alternative receivers pinned in
// CANDIDATE_ONLY_ALTERNATIVES; that protected-core difference is unresolved and
// deliberately still blocks the raw candidate import.  Only the Figure 3/4
// resolver entry point below accepts it -- see exactVirginiaTechFigure34Tree.
const PROTECTED_PROOF_TREE_SHA256 =
  '14bc69c7b2e40a83e875f41ef0a3d8cb980348e25e6b643ad1f3571d88ba6c67';

const CANDIDATE_TREE_ROLE = 'reviewed_candidate';
const PROTECTED_TREE_ROLE = 'stored_verified';
const CANDIDATE_TREE_ROLE_ONLY = Object.freeze([CANDIDATE_TREE_ROLE]);
const FIGURE_34_TREE_ROLES = Object.freeze([
  CANDIDATE_TREE_ROLE,
  PROTECTED_TREE_ROLE,
]);
const FIGURE_34_SCOPE = Object.freeze(['3', '4']);
const TREE_ROLE_BY_FINGERPRINT = new Map([
  [PROOF_TREE_SHA256, CANDIDATE_TREE_ROLE],
  [PROTECTED_PROOF_TREE_SHA256, PROTECTED_TREE_ROLE],
]);

// The exact receivers the candidate capture appends to the stored verified
// tree, in the same order and at the same paths the publication verification
// review reports them.  Each `receiver_index` is the position the alternative
// occupies in the candidate tree.
const CANDIDATE_ONLY_ALTERNATIVES = Object.freeze([
  Object.freeze({
    code: 'CS2064', units: 3, group_index: 0, section_index: 0, receiver_index: 1,
  }),
  Object.freeze({
    code: 'ECE2564', units: 3, group_index: 0, section_index: 1, receiver_index: 1,
  }),
  Object.freeze({
    code: 'MATH2405H', units: 5, group_index: 0, section_index: 5, receiver_index: 1,
  }),
  Object.freeze({
    code: 'MATH2406H', units: 5, group_index: 0, section_index: 6, receiver_index: 2,
  }),
  Object.freeze({
    code: 'ECE3514', units: 3, group_index: 3, section_index: 1, receiver_index: 1,
  }),
]);

// Every (group, section, receiver) path a Virginia Tech Figure 3/4 selected
// equivalency resolver reads, with the exact receiver it must land on.  The
// first four are the split-credit and atomic-pair routes in
// virginiaTransferEquivalencyConditions; the rest are the Passport/UCGS
// Pathways edges in virginiaTechTransferableAssociatePolicy.  Adding a resolver
// path means adding it here.
const FIGURE_34_RESOLVER_ANCHORS = Object.freeze([
  Object.freeze({
    group_index: 0, section_index: 0, receiver_index: 0,
    codes: Object.freeze(['CS1114']), kind: 'course', units: 3,
    resolver: 'csc222_split_credit',
  }),
  Object.freeze({
    group_index: 0, section_index: 1, receiver_index: 0,
    codes: Object.freeze(['CS2505']), kind: 'course', units: 3,
    resolver: 'csc205_csc215_atomic_pair',
  }),
  Object.freeze({
    group_index: 3, section_index: 1, receiver_index: 0,
    codes: Object.freeze(['CS2114']), kind: 'course', units: 3,
    resolver: 'csc223_split_credit',
  }),
  Object.freeze({
    group_index: 15, section_index: 1, receiver_index: 0,
    codes: Object.freeze(['ENGE1215', 'ENGE1216']), kind: 'series', units: 4,
    resolver: 'egr121_egr122_split_credit',
  }),
  Object.freeze({
    group_index: 6, section_index: 0, receiver_index: 2,
    codes: Object.freeze(['PHYS2305']), kind: 'course', units: 4,
    resolver: 'passport_pathway_4',
  }),
  Object.freeze({
    group_index: 7, section_index: 0, receiver_index: 2,
    codes: Object.freeze(['PHYS2306']), kind: 'course', units: 4,
    resolver: 'passport_pathway_4',
  }),
  Object.freeze({
    group_index: 8, section_index: 0, receiver_index: 0,
    codes: Object.freeze(['COMM2004']), kind: 'course', units: 3,
    resolver: 'passport_pathway_1a',
  }),
  Object.freeze({
    group_index: 8, section_index: 0, receiver_index: 1,
    codes: Object.freeze(['COMM2014']), kind: 'course', units: 3,
    resolver: 'passport_pathway_3',
  }),
  Object.freeze({
    group_index: 11, section_index: 0, receiver_index: 0,
    codes: Object.freeze(['ENGL1105']), kind: 'course', units: 3,
    resolver: 'passport_pathway_1f',
  }),
  Object.freeze({
    group_index: 11, section_index: 1, receiver_index: 0,
    codes: Object.freeze(['ENGL1106']), kind: 'course', units: 3,
    resolver: 'passport_pathway_1f',
  }),
]);

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const HONORS_MATH_PATH = 'requirement_groups[0]';
const CONCEPT_FOUR_PATH = 'requirement_groups[17]';
const SCOPED_RULE_PATHS = Object.freeze({
  no_double_count_across_cs_elective_groups: Object.freeze({
    path: 'requirement_groups[1]', figures: Object.freeze(['6']),
  }),
  conditional_5000_level_undergraduate_eligibility: Object.freeze({
    path: 'requirement_groups[1]', figures: Object.freeze(['6']),
  }),
  approved_experience_and_plan: Object.freeze({
    path: 'requirement_groups[2]', figures: Object.freeze(['6']),
  }),
  eligible_course_exclusions_and_distinctness: Object.freeze({
    path: 'requirement_groups[4]', figures: Object.freeze(['6']),
  }),
  department_approval_and_no_double_count: Object.freeze({
    path: 'requirement_groups[5]', figures: Object.freeze(['6']),
  }),
  pathways_no_degree_core_overlap: Object.freeze({
    path: 'requirement_groups[17]', figures: Object.freeze(['6']),
  }),
  nontechnical_course_distribution: Object.freeze({
    path: 'requirement_groups[18]', figures: Object.freeze(['6']),
  }),
  foreign_language_proficiency: Object.freeze({
    path: 'requirement_groups[20]', figures: Object.freeze(['6']),
  }),
});

const RESIDENCY_RULE = 'At least 25 percent of degree credits must be completed at Virginia Tech; no more than 18 transfer credits may appear among the final 45 credits; and no more than 50 percent of degree requirements may transfer from two-year institutions.';
const MODELING_NOTES = Object.freeze([
  'The authoritative Program Curriculum closes at 123 credits. The 37-credit elective subtotal includes the separately detailed eight-credit Natural Science Electives rule; those same eight credits satisfy Pathways Concept 4 and are removed once from the 47-credit gross Pathways subtotal, leaving 39 net Pathways credits.',
  'Pathways Concept 7 is suspended effective fall 2025. The program table nevertheless preserves three credits needed to maintain the 123-credit minimum when Concept 7 is double-counted or suspended; this is modeled as three credits of minimum-total elective capacity, not as a current Concept 7 course requirement.',
  'Pathways 1a is not an additional three-credit block: the program expressly requires it to be fulfilled through the Communications, Professional Writing, or Free Elective capacity.',
  'The MATH 2405H plus MATH 2406H substitution consumes the two ordinary mathematics core slots and four free-elective credits. The pair is exposed in the relevant slots, with its cross-slot/free-credit dependency retained as an unsupported exact constraint.',
  'Any eligible CS 3/4/5000 or 4/5000 course permitted by the published rule remains a real undergraduate elective option. The named graduate courses expressly barred by the program are absent, and use of a 5000-level course remains subject to the published two-semesters-to-graduation, GPA, and permission/accelerated-program conditions.',
  'The program requires 30 credits of non-technical coursework as a distribution overlay. It is represented as a zero-additional-unit policy because the 30 credits come from already modeled Pathways, communications, writing, and elective coursework.',
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

function supplementalPathwaysCapacityEvidence(evidence = PATHWAYS_CAPACITY_EVIDENCE) {
  if (hash(evidence) !== PATHWAYS_CAPACITY_EVIDENCE_SHA256) {
    return fail('the supplemental official Virginia Tech Pathways capacity receipt changed');
  }
  const expectedWitness = {
    pathways_concept_1f: ['ENGL1105', 'ENGL1106'],
    pathways_concept_2: ['ART1104', 'ART1334'],
    pathways_concept_3: ['PSYC1004', 'SOC1004'],
    pathways_concept_6a: ['ART1004'],
    communications_and_writing: ['COMM2004', 'ENGL3764'],
    free_elective: ['ART1204'],
  };
  for (const [kind, codes] of Object.entries(expectedWitness)) {
    const rows = array(evidence?.witness?.[kind]);
    if (JSON.stringify(rows.map((row) => text(row?.code))) !== JSON.stringify(codes)
        || rows.some((row) => number(row?.units) !== 3)) {
      return fail(`the exact supplemental ${kind} witness changed`);
    }
  }
  const witnessCodes = Object.values(expectedWitness).flat();
  const robotsReceipts = array(evidence?.robots_receipts);
  const robotsById = Object.fromEntries(robotsReceipts.map((receipt) => [
    text(receipt?.id), receipt,
  ]));
  const robotsValid = robotsReceipts.length === 2
    && Object.entries(SUPPLEMENTAL_SOURCE_PATHS).every(([id, decisions]) => {
      const receipt = robotsById[id];
      return receipt?.official_https === true
        && number(receipt?.status) === 200
        && number(receipt?.bytes) > 0
        && /^[a-f0-9]{64}$/.test(text(receipt?.sha256) || '')
        && text(receipt?.user_agent) === SUPPLEMENTAL_USER_AGENT
        && JSON.stringify(receipt?.exact_path_decisions) === JSON.stringify(decisions);
    });
  if (new Set(witnessCodes).size !== witnessCodes.length
      || evidence?.schema_version !== 1
      || text(evidence?.catalog_year) !== CATALOG_YEAR
      || !robotsValid
      || array(evidence?.sources).length !== 4
      || array(evidence?.sources).some((source) => (
        source?.official_https !== true
        || text(source?.content_type) !== 'application/pdf'
        || number(source?.response_status) !== 200
        || !/^application\/pdf\b/i.test(text(source?.response_content_type) || '')
        || text(source?.requested_url) !== text(source?.final_url)
        || !/^[a-f0-9]{64}$/.test(text(source?.sha256) || '')
        || number(source?.bytes) <= 0
      ))
      || number(evidence?.arithmetic?.total_nontechnical_units) !== 30
      || number(evidence?.arithmetic?.additional_degree_units) !== 0
      || array(evidence?.exclusions_checked_against_reviewed_program
        ?.witness_codes_on_cs_technical_elective_list).length !== 0) {
    return fail('the supplemental official Pathways witness no longer proves 30 disjoint nontechnical credits inside degree capacity');
  }
  return {
    supported: true,
    evidence_sha256: PATHWAYS_CAPACITY_EVIDENCE_SHA256,
    robots_receipts: robotsReceipts.map((receipt) => ({
      id: receipt.id,
      url: receipt.final_url,
      bytes: receipt.bytes,
      sha256: receipt.sha256,
      exact_path_decisions: structuredClone(receipt.exact_path_decisions),
    })),
    source_receipts: evidence.sources.map((source) => ({
      id: source.id,
      url: source.final_url,
      bytes: source.bytes,
      sha256: source.sha256,
    })),
    witness: structuredClone(evidence.witness),
    witness_codes: witnessCodes,
    arithmetic: { ...evidence.arithmetic },
  };
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

function standaloneCourseTitles(document) {
  const rows = array(document?.requirement_groups)
    .flatMap((group) => array(group?.sections))
    .flatMap((section) => array(section?.receivers))
    .filter((receiver) => text(receiverBody(receiver).kind)?.toLowerCase() === 'course');
  const codes = [...new Set(rows.flatMap(receiverCodes))].sort();
  const authored = Object.fromEntries(rows.flatMap((receiver) => {
    const code = receiverCodes(receiver)[0];
    const title = text(receiverBody(receiver).title);
    return code && title ? [[code, title]] : [];
  }));
  return Object.fromEntries(codes.map((code) => [
    code, authored[code] ?? text(document?.course_titles?.[code]),
  ]));
}

function normalizedVirginiaTechProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    total_units: number(document?.total_units),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: [...array(document?.modeling_notes)],
    data_quality_flags: [...array(document?.data_quality_flags)],
    course_titles: standaloneCourseTitles(document),
    groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function virginiaTechProofTreeFingerprint(document) {
  return hash(normalizedVirginiaTechProofTree(document));
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
    return required.length === expected.length
      && required.every((id, index) => id === expected[index])
      ? null : 'the composed Virginia Tech source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== `server/.va-catalogs/composed/${SLUG}.json`) {
    return 'the retained Virginia Tech source-bundle receipt changed';
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
      })) return 'the retained official Virginia Tech source roles or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

/**
 * Re-proves, on the document in hand, the two facts that let a Figure 3/4
 * resolver read the stored verified tree and the reviewed candidate tree
 * interchangeably:
 *
 *   1. every resolver anchor holds the exact receiver the resolver expects, and
 *   2. no candidate-only alternative is appended at or before an anchor in its
 *      own section, so no anchor index can silently shift between the trees.
 *
 * Fact 2 is a property of the pinned path tables, not of the document, so it is
 * checked unconditionally: if someone later adds a resolver anchor that a
 * candidate-only alternative would displace, this fails closed instead of
 * resolving against the wrong receiver.
 */
function figure34ResolverAnchorIssue(document) {
  for (const alternative of CANDIDATE_ONLY_ALTERNATIVES) {
    const displaced = FIGURE_34_RESOLVER_ANCHORS.find((entry) => (
      entry.group_index === alternative.group_index
      && entry.section_index === alternative.section_index
      && entry.receiver_index >= alternative.receiver_index
    ));
    if (displaced) {
      return `the candidate-only ${alternative.code} alternative displaces the exact`
        + ` ${displaced.resolver} Figure 3/4 anchor`;
    }
  }
  for (const entry of FIGURE_34_RESOLVER_ANCHORS) {
    const receiver = array(
      array(array(document?.requirement_groups)[entry.group_index]?.sections)[
        entry.section_index
      ]?.receivers,
    )[entry.receiver_index];
    const body = receiverBody(receiver);
    const codes = receiverCodes(receiver);
    if (!receiver
        || JSON.stringify(codes) !== JSON.stringify(entry.codes)
        || text(body.kind)?.toLowerCase() !== entry.kind
        || number(body.units) !== entry.units) {
      return `the exact ${entry.resolver} Figure 3/4 receiver at`
        + ` requirement_groups[${entry.group_index}].sections[${entry.section_index}]`
        + `.receivers[${entry.receiver_index}] changed`;
    }
  }
  return null;
}

function virginiaTechTreeProof(document, {
  acceptedTreeRoles = CANDIDATE_TREE_ROLE_ONLY,
  affectedFigures = ALL_FIGURES,
  figureScope = null,
} = {}) {
  const scopedFail = (reason) => fail(reason, affectedFigures);
  const style = documentStyle(document);
  if (!style) {
    return scopedFail('document identity is not an exact Virginia Tech composition/source/projection tuple');
  }
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 123) {
    return scopedFail('the Virginia Tech catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return scopedFail(bundleIssue);
  const fingerprint = virginiaTechProofTreeFingerprint(document);
  const treeRole = TREE_ROLE_BY_FINGERPRINT.get(fingerprint) || null;
  if (!treeRole || !acceptedTreeRoles.includes(treeRole)) {
    return scopedFail('the reviewed Virginia Tech tree, source refs, rules, titles, flags, or accounting declarations changed');
  }
  if (JSON.stringify(array(document?.modeling_notes)) !== JSON.stringify(MODELING_NOTES)) {
    return scopedFail('the reviewed Virginia Tech accounting interpretation changed');
  }
  const titles = standaloneCourseTitles(document);
  if (titles.ENGE2724 !== null || titles.ENGE4724 !== null) {
    return scopedFail('the source proof requires ENGE 2724 and ENGE 4724 to remain unresolved');
  }
  if (style !== 'composition') {
    for (const group of array(document?.requirement_groups)) {
      for (const section of array(group?.sections)) {
        for (const receiver of array(section?.receivers)) {
          const body = receiverBody(receiver);
          if (!['course', 'series'].includes(text(body.kind)?.toLowerCase())) continue;
          const expected = receiverCodes(receiver)
            .map((code) => receivingCourseIdForDocument(document, code));
          const actual = body.kind === 'series' ? array(body.parent_ids) : [body.parent_id];
          if (!expected.length || actual.length !== expected.length
              || actual.some((id, index) => Number(id) !== expected[index])) {
            return scopedFail('one or more projected Virginia Tech course identities changed');
          }
        }
      }
    }
  }
  if (figureScope) {
    const anchorIssue = figure34ResolverAnchorIssue(document);
    if (anchorIssue) return scopedFail(anchorIssue);
  }
  const proof = {
    institution_slug: SLUG,
    document_style: style,
    source_bundle_sha256: SOURCE_BUNDLE_SHA256,
    proof_tree_sha256: fingerprint,
    source_receipts: SOURCE_RECEIPTS.map((row) => ({ ...row })),
  };
  if (figureScope) {
    proof.figure_scope = [...figureScope];
    proof.tree_role = treeRole;
  }
  return {
    supported: true,
    affected_figures: [],
    reason: 'the complete retained Virginia Tech source tree and projection identity match',
    proof,
  };
}

function exactVirginiaTechTree(document) {
  return virginiaTechTreeProof(document);
}

/**
 * Figure 3/4-scoped Virginia Tech tree proof.
 *
 * The stored, human-verified Virginia Tech tree and the newer unsigned
 * candidate capture are not the same document: the candidate appends exactly
 * the five alternative receivers pinned in CANDIDATE_ONLY_ALTERNATIVES.  That
 * difference is unresolved, so `exactVirginiaTechTree` above still recognizes
 * only the candidate and every other consumer keeps failing closed.
 *
 * The Figure 3/4 selected-equivalency resolvers are a narrower question.  Each
 * one reads exactly one of the FIGURE_34_RESOLVER_ANCHORS paths below, and
 * every candidate-only alternative is appended at a receiver index strictly
 * greater than the anchor in its own section.  The two trees are therefore
 * path-identical at every anchor a Figure 3/4 resolver can reach, which this
 * function re-proves on the document in hand rather than assuming.  Nothing
 * here blesses the candidate tree for any other figure, and an unrecognized
 * third shape still fails closed.
 */
function exactVirginiaTechFigure34Tree(document) {
  return virginiaTechTreeProof(document, {
    acceptedTreeRoles: FIGURE_34_TREE_ROLES,
    affectedFigures: FIGURE_34_SCOPE,
    figureScope: FIGURE_34_SCOPE,
  });
}

function groupConjunction(group) {
  return text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and';
}

function constraintKinds(group) {
  return array(group?.analysis_constraints).map((entry) => text(entry?.kind));
}

function exactSingleReceiverSection(section, {
  ask, units, kind, codes = [], name = null,
} = {}) {
  const receivers = array(section?.receivers);
  const receiver = receivers[0];
  const body = receiverBody(receiver);
  return receivers.length === 1
    && number(section?.section_advisement ?? section?.select) === ask
    && number(section?.unit_advisement ?? section?.units) === units
    && number(section?.unit_advisement_max ?? section?.units_max
      ?? section?.unit_advisement ?? section?.units) === units
    && text(body?.kind)?.toLowerCase() === kind
    && JSON.stringify(receiverCodes(receiver)) === JSON.stringify(codes)
    && (name == null || text(body?.name) === name)
    && number(body?.units) === units;
}

function conceptFourProof(document) {
  const science = document?.requirement_groups?.[6];
  const policy = document?.requirement_groups?.[17];
  const scienceSection = science?.sections?.[0];
  const policySection = policy?.sections?.[0];
  const scienceReceivers = array(scienceSection?.receivers);
  if (groupConjunction(science) !== 'and'
      || text(science?.requirement_layer) !== 'major'
      || text(science?.tier) !== 'breadth'
      || JSON.stringify(array(science?.source_refs))
        !== JSON.stringify(['major', 'general_education', 'course_catalog'])
      || number(scienceSection?.section_advisement ?? scienceSection?.select) !== 2
      || number(scienceSection?.unit_advisement ?? scienceSection?.units) !== 8
      || scienceReceivers.length !== 3
      || JSON.stringify(scienceReceivers.map(receiverCodes)) !== JSON.stringify([
        ['BIOL1105', 'BIOL1115'], ['CHEM1035', 'CHEM1045'], ['PHYS2305'],
      ])
      || scienceReceivers.some((receiver) => number(receiverBody(receiver)?.units) !== 4)) {
    return fail('the exact eight-credit Natural Science carrier changed');
  }
  if (groupConjunction(policy) !== 'and'
      || text(policy?.requirement_layer) !== 'general_education'
      || text(policy?.tier) !== 'nontransferable'
      || JSON.stringify(array(policy?.source_refs))
        !== JSON.stringify(['major', 'general_education'])
      || JSON.stringify(constraintKinds(policy)) !== JSON.stringify([
        'pathways_1a_inside_existing_capacity',
        'pathways_concept_4_natural_science_overlap',
        'pathways_no_degree_core_overlap',
      ])
      || !exactSingleReceiverSection(policySection, {
        ask: 1,
        units: 0,
        kind: 'requirement',
        codes: [],
        name: 'Satisfy Pathways 1a and Concept 4 inside the designated modeled degree blocks without prohibited Degree Core or CS 3114 overlap',
      })) {
    return fail('the exact zero-unit Pathways policy receipt changed');
  }
  if (number(document?.unit_audit?.elective_subtotal_units) !== 37
      || number(document?.unit_audit?.net_pathways_units_after_natural_science_overlap) !== 39
      || number(document?.unit_audit?.modeled_units) !== 123) {
    return fail('the Virginia Tech Pathways overlap accounting changed');
  }
  return {
    supported: true,
    carrier_path: 'requirement_groups[6].sections[0]',
    carrier_units: 8,
    policy_receipt_path: 'requirement_groups[17].sections[0]',
    policy_receipt_units: 0,
    gross_pathways_units: 47,
    net_pathways_units: 39,
    duplicate_units_removed_once: 8,
  };
}

/**
 * One fully enumerated, distinct, non-5000-level witness for the campus-only
 * CS choice capacity. Figure 1 counts required course observations but never
 * evaluates university-course prerequisites, permissions, or student GPA, so
 * this exact named witness closes its cross-menu identity rules. Figure 6
 * still needs a prerequisite-complete named route; several entire retained
 * menus currently have no such official course-entry evidence and stay
 * fail-closed there. The same witness also establishes that the rules cannot
 * change the fixed Figure 3/4 unit demand.
 */
function fixedCampusMenuWitness(document) {
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return exact;
  const selections = [
    { group: 1, section: 2, indices: [0], codes: ['CS4104'], units: 3 },
    { group: 1, section: 3, indices: [1], codes: ['BIT4614'], units: 3 },
    { group: 1, section: 4, indices: [0], codes: ['CS4094'], units: 3 },
    { group: 4, section: 0, indices: [2, 6], codes: ['CMDA3654', 'MATH3414'], units: 6 },
    { group: 5, section: 0, indices: [2], codes: ['AOE4434'], units: 3 },
  ];
  const selectedCodes = [];
  for (const selection of selections) {
    const group = document?.requirement_groups?.[selection.group];
    const section = group?.sections?.[selection.section];
    const receivers = array(section?.receivers);
    const chosen = selection.indices.map((index) => receivers[index]);
    if (text(group?.tier) !== 'nontransferable'
        || group?.cc_articulable !== false
        || number(section?.section_advisement ?? section?.select) !== selection.indices.length
        || number(section?.unit_advisement ?? section?.units) !== selection.units
        || chosen.some((receiver) => !receiver)
        || JSON.stringify(chosen.flatMap(receiverCodes)) !== JSON.stringify(selection.codes)
        || chosen.some((receiver) => number(receiverBody(receiver)?.units) !== 3)) {
      return fail('the exact fixed-unit Virginia Tech campus-menu witness changed');
    }
    selectedCodes.push(...selection.codes);
  }
  if (new Set(selectedCodes).size !== selectedCodes.length
      || selectedCodes.some((code) => /5\d{3}$/.test(code))) {
    return fail('the Virginia Tech campus-menu witness is no longer distinct and non-5000-level');
  }
  return {
    supported: true,
    constrained_campus_units: 18,
    figure_1_supported: true,
    figure_6_supported: false,
    figure_6_blocker: 'selected campus-menu identities lack complete official prerequisite evidence',
    selected_codes: selectedCodes,
    section_receiver_indices: Object.fromEntries(selections.map((selection) => [
      `${selection.group}:${selection.section}`, [...selection.indices],
    ])),
  };
}

/**
 * Select one exact Natural Science route for Figure 1.
 *
 * The section is choose two of BIOL+lab (two course observations), CHEM+lab
 * (two), and PHYS (one).  Consequently the legal denominator is route-bound:
 * it is four observations for the two-series route and three for either
 * series-plus-PHYS route. Choose the best articulated ratio, then the smaller
 * denominator, then authored order. A series counts only when every receiving
 * parent is articulated. This is the same optimistic-path semantics as the
 * paper's Figure 1, without the generic reader's invalid three-observation
 * clamp when only both two-course series articulate.
 */
function figureOneNaturalScienceSelection(document, {
  articulated = null,
  articulatedCodes = null,
} = {}) {
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  const section = document?.requirement_groups?.[6]?.sections?.[0];
  const receivers = array(section?.receivers);
  const expected = [
    { index: 0, kind: 'series', codes: ['BIOL1105', 'BIOL1115'], units: 4 },
    { index: 1, kind: 'series', codes: ['CHEM1035', 'CHEM1045'], units: 4 },
    { index: 2, kind: 'course', codes: ['PHYS2305'], units: 4 },
  ];
  if (number(section?.section_advisement ?? section?.select) !== 2
      || number(section?.unit_advisement ?? section?.units) !== 8
      || number(section?.unit_advisement_max ?? section?.units_max
        ?? section?.unit_advisement ?? section?.units) !== 8
      || receivers.length !== expected.length
      || expected.some((row) => {
        const receiver = receivers[row.index];
        const body = receiverBody(receiver);
        return text(body?.kind)?.toLowerCase() !== row.kind
          || JSON.stringify(receiverCodes(receiver)) !== JSON.stringify(row.codes)
          || number(body?.units) !== row.units
          || (exact.proof.document_style !== 'composition' && row.kind === 'series'
            && array(body?.parent_ids).length !== row.codes.length)
          || (exact.proof.document_style !== 'composition'
            && row.kind === 'course' && body?.parent_id == null);
      })) {
    return { ready: false, reason: 'the exact Virginia Tech Natural Science menu changed' };
  }

  const receiverCovered = (receiver) => {
    const body = receiverBody(receiver);
    const parentIds = body?.kind === 'series'
      ? array(body?.parent_ids) : [body?.parent_id].filter((value) => value != null);
    const codes = receiverCodes(receiver);
    const byParent = articulated instanceof Set
      && parentIds.length > 0 && parentIds.every((id) => articulated.has(id));
    const byCode = articulatedCodes instanceof Set
      && codes.length > 0 && codes.every((code) => articulatedCodes.has(code));
    return byParent || byCode;
  };
  const observations = (receiver) => receiverBody(receiver)?.kind === 'series'
    ? (array(receiverBody(receiver)?.parent_ids).length || receiverCodes(receiver).length)
    : 1;
  const routes = [
    { indices: [0, 2], codes: ['BIOL1105', 'BIOL1115', 'PHYS2305'] },
    { indices: [1, 2], codes: ['CHEM1035', 'CHEM1045', 'PHYS2305'] },
    { indices: [0, 1], codes: ['BIOL1105', 'BIOL1115', 'CHEM1035', 'CHEM1045'] },
  ].map((route, authoredIndex) => {
    const selected = route.indices.map((index) => receivers[index]);
    const total = selected.reduce((sum, receiver) => sum + observations(receiver), 0);
    const covered = selected.reduce((sum, receiver) => (
      sum + (receiverCovered(receiver) ? observations(receiver) : 0)
    ), 0);
    return { ...route, authoredIndex, total, covered };
  });
  const better = (candidate, selected) => {
    const ratioOrder = candidate.covered * selected.total
      - selected.covered * candidate.total;
    if (ratioOrder !== 0) return ratioOrder > 0;
    if (candidate.total !== selected.total) return candidate.total < selected.total;
    return candidate.authoredIndex < selected.authoredIndex;
  };
  const selected = routes.slice(1).reduce(
    (best, candidate) => (better(candidate, best) ? candidate : best),
    routes[0],
  );
  return {
    ready: true,
    section_path: 'requirement_groups[6].sections[0]',
    receiver_indices: [...selected.indices],
    selected_codes: [...selected.codes],
    total_course_observations: selected.total,
    covered_course_observations: selected.covered,
    proof: exact.proof,
  };
}

/**
 * Exact reader-safe mathematics and Pathways selection.
 *
 * MATH 2405H is a standalone substitute for MATH 2114, while MATH 2406H is
 * legal only as the second half of the correlated honors pair. Figures 1/3/4
 * therefore choose atomically between the ordinary/standalone family and the
 * honors pair; an uncovered half may be completed resident, but a mixed route
 * can never be constructed. Figures 1/3/4 leave the
 * Communications and Professional Writing menus intact: Pathways 1a may also
 * be completed inside free-elective capacity, so forcing both named carriers
 * would needlessly change articulation results. Figure 6 uses the ordinary
 * MATH 2114 + MATH 2204 route plus COMM 2004 and ENGL 3764 as a deterministic,
 * source-valid identity witness.
 */
function standardMathAndPathwaysSelection(document, {
  figure6 = false,
  articulated = null,
  articulatedCodes = null,
} = {}) {
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  const ordinaryMath = [
    {
      group: 0, section: 5, indices: [0, 1],
      codes: ['MATH2114', 'MATH2405H'], receiverUnits: [3, 5], units: 3,
    },
    {
      group: 0, section: 6, indices: [0, 1],
      codes: ['MATH2204', 'CMDA2005'], receiverUnits: [3, 3], units: 3,
    },
  ];
  const honorsMath = [
    {
      group: 0, section: 5, indices: [1],
      codes: ['MATH2405H'], receiverUnits: [5], units: 3,
    },
    {
      group: 0, section: 6, indices: [2],
      codes: ['MATH2406H'], receiverUnits: [5], units: 3,
    },
  ];
  const fixedFigure6Math = [
    {
      group: 0, section: 5, indices: [0],
      codes: ['MATH2114'], receiverUnits: [3], units: 3,
    },
    {
      group: 0, section: 6, indices: [0],
      codes: ['MATH2204'], receiverUnits: [3], units: 3,
    },
  ];
  const isArticulated = (receiver) => {
    const parent = receiverBody(receiver)?.parent_id;
    const code = receiverCodes(receiver)[0];
    return (articulated instanceof Set && parent != null && articulated.has(parent))
      || (articulatedCodes instanceof Set && code != null && articulatedCodes.has(code));
  };
  const routeCoverage = (rows) => rows.reduce((sum, row) => {
    const receivers = array(
      document?.requirement_groups?.[row.group]?.sections?.[row.section]?.receivers,
    );
    return sum + (row.indices.some((index) => isArticulated(receivers[index])) ? 1 : 0);
  }, 0);
  // A missing half of the honors pair is completed at Virginia Tech; these
  // figures measure partial transfer coverage, not an all-transfer schedule.
  // Select the pair atomically only when it covers more slots than the legal
  // ordinary/standalone family. Ties keep that broader ordinary family.
  const honorsRoute = !figure6
    && routeCoverage(honorsMath) > routeCoverage(ordinaryMath);
  const selectedMath = figure6
    ? fixedFigure6Math : (honorsRoute ? honorsMath : ordinaryMath);
  const science = figure6 ? null : figureOneNaturalScienceSelection(document, {
    articulated, articulatedCodes,
  });
  if (science && !science.ready) return science;
  const campus = figure6 ? null : fixedCampusMenuWitness(document);
  if (campus && !campus.supported) return { ready: false, reason: campus.reason };
  const specifications = [
    ...selectedMath,
    ...(figure6 ? [
      {
        group: 8, section: 0, indices: [0], codes: ['COMM2004'],
        receiverUnits: [3], units: 3,
      },
      {
        group: 9, section: 0, indices: [0], codes: ['ENGL3764'],
        receiverUnits: [3], units: 3,
      },
    ] : []),
  ];
  for (const specification of specifications) {
    const group = document?.requirement_groups?.[specification.group];
    const section = group?.sections?.[specification.section];
    const receivers = array(section?.receivers);
    const chosen = specification.indices.map((index) => receivers[index]);
    if (number(section?.section_advisement ?? section?.select) !== 1
        || number(section?.unit_advisement ?? section?.units) !== specification.units
        || chosen.some((receiver) => !receiver)
        || JSON.stringify(chosen.flatMap(receiverCodes)) !== JSON.stringify(specification.codes)
        || JSON.stringify(chosen.map((receiver) => number(receiverBody(receiver)?.units)))
          !== JSON.stringify(specification.receiverUnits)) {
      return { ready: false, reason: 'the exact ordinary mathematics or Pathways 1a route changed' };
    }
  }
  return {
    ready: true,
    institution: SLUG,
    section_receiver_indices: {
      ...Object.fromEntries(specifications.map((specification) => [
        `${specification.group}:${specification.section}`, [...specification.indices],
      ])),
      ...(science ? { '6:0': [...science.receiver_indices] } : {}),
      ...(campus ? structuredClone(campus.section_receiver_indices) : {}),
    },
    ordinary_math_route_codes: ['MATH2114', ...(figure6
      ? ['MATH2204'] : ['MATH2204', 'CMDA2005'])],
    eligible_math_route_codes: specifications.slice(0, 2).flatMap((row) => row.codes),
    math_route: honorsRoute ? 'honors_pair' : 'ordinary_or_standalone_2405h',
    honors_math_2406_enabled: honorsRoute,
    pathways_1a_codes: figure6 ? ['COMM2004', 'ENGL3764'] : [],
    figure_1_natural_science_codes: science ? [...science.selected_codes] : [],
    figure_1_natural_science_course_observations:
      science?.total_course_observations ?? null,
    figure_1_campus_menu_codes: campus ? [...campus.selected_codes] : [],
    figure6,
    proof: exact.proof,
  };
}

/**
 * Figures 3/4 consume fixed credit demand, not the identities of open Pathways
 * or free-elective choices.  This exact witness proves the source tree has at
 * least 30 already-budgeted nontechnical credits and keeps every forbidden
 * Degree-Core reuse out of the additive Pathways capacity. Open identities
 * remain a Figure 6 blocker.
 */
function pathwaysFigure34CapacityProof(document) {
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return exact;
  const supplemental = supplementalPathwaysCapacityEvidence();
  if (!supplemental.supported) return supplemental;
  const selection = standardMathAndPathwaysSelection(document);
  if (!selection.ready) return fail(selection.reason);
  const conceptFour = conceptFourProof(document);
  if (!conceptFour.supported) return conceptFour;

  const expected = [
    { group: 11, units: 6, layer: 'general_education' },
    { group: 12, units: 6, layer: 'general_education' },
    { group: 13, units: 6, layer: 'general_education' },
    { group: 15, section: 0, units: 3, layer: 'general_education' },
  ];
  for (const row of expected) {
    const group = document?.requirement_groups?.[row.group];
    const sections = row.section == null ? array(group?.sections) : [group?.sections?.[row.section]];
    const units = sections.reduce((sum, section) => (
      sum + (number(section?.unit_advisement ?? section?.units) || 0)
    ), 0);
    if (text(group?.requirement_layer) !== row.layer || units !== row.units) {
      return fail('the exact additive Pathways nontechnical capacity changed');
    }
  }

  const freePaths = array(document?.requirement_groups?.[10]?.sections);
  const freeUnits = freePaths.map((section) => {
    const receiver = array(section?.receivers).find((candidate) => (
      text(receiverBody(candidate)?.kind)?.toLowerCase() === 'requirement'
    ));
    return number(receiverBody(receiver)?.units);
  });
  if (groupConjunction(document?.requirement_groups?.[10]) !== 'or'
      || freePaths.length !== 6
      || freeUnits.some((units) => units == null || units < 4)) {
    return fail('the exact path-adjusted free-elective capacity changed');
  }

  const fixedNontechnicalUnits = 6 + 6 + 6 + 3 + 3 + 3;
  const freeElectiveWitnessUnits = 3;
  if (fixedNontechnicalUnits + freeElectiveWitnessUnits !== 30
      || supplemental.arithmetic.total_nontechnical_units !== 30
      || supplemental.arithmetic.additional_degree_units !== 0) {
    return fail('the nontechnical witness no longer closes at 30 credits');
  }
  const degreeCoreCodes = new Set(array(document?.requirement_groups?.[0]?.sections)
    .flatMap((section) => array(section?.receivers)).flatMap(receiverCodes));
  const selectedPathwaysCodes = [
    ...supplemental.witness_codes.filter((code) => code !== 'ART1204'),
    'MATH1225', 'MATH1226', 'CS3114',
    'BIOL1105', 'BIOL1115', 'CHEM1035', 'CHEM1045',
    'ENGE1215', 'ENGE1216',
  ];
  if (selectedPathwaysCodes.some((code) => degreeCoreCodes.has(code))) {
    return fail('a fixed Pathways witness now overlaps a Degree Core identity');
  }
  const technicalCodes = new Set(array(document?.requirement_groups?.[5]?.sections)
    .flatMap((section) => array(section?.receivers)).flatMap(receiverCodes));
  if (supplemental.witness_codes.some((code) => technicalCodes.has(code))) {
    return fail('a supplemental nontechnical witness is now listed as a CS technical elective');
  }
  return {
    supported: true,
    reason: 'the exact additive Pathways tree preserves all Degree Core units and supplies a 30-credit nontechnical witness inside existing capacity',
    proof: {
      ...exact.proof,
      ordinary_route: selection.section_receiver_indices,
      concept_4: conceptFour,
      fixed_nontechnical_units: fixedNontechnicalUnits,
      free_elective_witness_units: freeElectiveWitnessUnits,
      total_nontechnical_witness_units: 30,
      minimum_free_elective_capacity_units: Math.min(...freeUnits),
      supplemental_evidence_sha256: supplemental.evidence_sha256,
      supplemental_source_receipts: supplemental.source_receipts,
      supplemental_nontechnical_witness_codes: supplemental.witness_codes,
      selected_pathways_codes: selectedPathwaysCodes,
      fixed_pathways_degree_core_overlap_codes: [],
    },
  };
}

function ruleContainerIssue(kind, container, context, paths = null) {
  const expected = (paths || { pathways_concept_4_natural_science_overlap: CONCEPT_FOUR_PATH })[kind];
  const expectedPath = typeof expected === 'string' ? expected : expected?.path;
  const index = Number(/^requirement_groups\[(\d+)\]$/.exec(expectedPath || '')?.[1]);
  const group = context?.document?.requirement_groups?.[index];
  if (!group || container !== group || context?.path !== expectedPath) {
    return `the ${kind} rule moved from its exact source container`;
  }
  const matches = array(group?.analysis_constraints).filter((entry) => text(entry?.kind) === kind);
  if (matches.length !== 1 || (context?.constraint && context.constraint !== matches[0])) {
    return `the ${kind} source receipt is missing, duplicated, or detached`;
  }
  return null;
}

function evaluateVirginiaTechConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  const paths = {
    honors_math_substitution_and_free_credit_adjustment: HONORS_MATH_PATH,
    pathways_1a_inside_existing_capacity: CONCEPT_FOUR_PATH,
    pathways_concept_4_natural_science_overlap: CONCEPT_FOUR_PATH,
  };
  if (!paths[kind]) {
    return fail('no exact Virginia Tech evaluator handles this rule');
  }
  const exact = exactVirginiaTechTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context, paths);
  if (issue) return fail(issue);
  if (kind === 'honors_math_substitution_and_free_credit_adjustment') {
    const selection = standardMathAndPathwaysSelection(context.document);
    if (!selection.ready) return fail(selection.reason);
    const capacity = pathwaysFigure34CapacityProof(context.document);
    if (!capacity.supported) return capacity;
    const honorsFirstParent = receiverBody(
      context.document?.requirement_groups?.[0]?.sections?.[5]?.receivers?.[1],
    )?.parent_id;
    const correlatedSelection = standardMathAndPathwaysSelection(context.document, {
      articulatedCodes: new Set(['MATH2405H', 'MATH2406H']),
    });
    if (!correlatedSelection.ready || !correlatedSelection.honors_math_2406_enabled) {
      return fail('the exact honors mathematics correlation is no longer enforced');
    }
    return {
      ...exact,
      evaluator: 'evaluateVirginiaTechConstraint',
      reason: 'shared readers atomically choose a legal ordinary/standalone or honors-pair route; Figure 3 keeps sending credits separate, Figure 4 accounts for pair-bound elective credit and receiving-credit bonus under the two-year cap, an unproved standalone surplus fails closed, and Figure 6 uses the ordinary identity witness',
      proof: {
        ...exact.proof,
        rule_path: context.path,
        section_receiver_indices: selection.section_receiver_indices,
        ordinary_math_route_codes: selection.ordinary_math_route_codes,
        eligible_math_route_codes_without_honors_parent: selection.eligible_math_route_codes,
        eligible_math_route_codes_with_honors_pair:
          correlatedSelection.eligible_math_route_codes,
        honors_pair_codes: ['MATH2405H', 'MATH2406H'],
        honors_pair_first_parent_id: honorsFirstParent ?? null,
        modeled_math_units: 6,
        ordinary_free_elective_capacity_units: 8,
        honors_pair_remaining_free_elective_capacity_units: 4,
        standalone_surplus_policy: 'fail_closed_if_articulated',
        figure_3_receiving_bonus_policy: 'excluded',
        figure_4_receiving_bonus_policy: 'separate_and_transfer_cap_bound',
        honors_route_selected_for_figure_6: false,
      },
    };
  }
  if (kind === 'pathways_1a_inside_existing_capacity') {
    const capacity = pathwaysFigure34CapacityProof(context.document);
    if (!capacity.supported) return capacity;
    const figure6Selection = standardMathAndPathwaysSelection(
      context.document, { figure6: true },
    );
    if (!figure6Selection.ready) return fail(figure6Selection.reason);
    return {
      ...exact,
      evaluator: 'evaluateVirginiaTechConstraint',
      reason: 'Pathways 1a remains inside the authored Communications, Professional Writing, or free-elective capacity; Figures 1/3/4 retain their legal alternative menus, while Figure 6 uses the exact COMM 2004 witness',
      proof: {
        ...capacity.proof,
        rule_path: context.path,
        figure_1_3_4_alternative_menus_preserved: true,
        figure_6_section_receiver_indices: figure6Selection.section_receiver_indices,
        figure_6_selected_pathways_1a_codes: figure6Selection.pathways_1a_codes,
        additional_units: 0,
      },
    };
  }
  const overlap = conceptFourProof(context.document);
  if (!overlap.supported) return overlap;
  return {
    ...exact,
    evaluator: 'evaluateVirginiaTechConstraint',
    reason: 'the eight Natural Science credits are represented once, while the Pathways Concept 4 receipt is exactly zero-unit and the 47-minus-8 accounting closes at 39',
    proof: { ...exact.proof, rule_path: context.path, ...overlap },
  };
}

function virginiaTechSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  const scoped = SCOPED_RULE_PATHS[kind];
  if (!scoped) return null;
  const exact = exactVirginiaTechTree(context.document);
  if (!exact.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  }, SCOPED_RULE_PATHS)) return null;

  if ([
    'no_double_count_across_cs_elective_groups',
    'conditional_5000_level_undergraduate_eligibility',
    'eligible_course_exclusions_and_distinctness',
    'department_approval_and_no_double_count',
  ].includes(kind) && !fixedCampusMenuWitness(context.document).supported) return null;
  if (['pathways_no_degree_core_overlap', 'nontechnical_course_distribution'].includes(kind)
      && !pathwaysFigure34CapacityProof(context.document).supported) return null;

  // The four CS-menu rules are confined to exact fixed campus-only capacity:
  // 15 + 6 + 3 units cannot move Figures 3/4, and the exact named, distinct,
  // non-5000 witness closes Figure 1's required-course observation count.
  // Their open identities and incomplete prerequisite evidence still matter
  // to Figure 6. Career Bridge is a zero-unit
  // completion whose course-bearing routes earn their credits elsewhere, so
  // only Figure 6 can depend on its unresolved identity/conditions. Figure 1
  // excludes GE, making the open Pathways course identities irrelevant there.
  // Foreign-language college credit is expressly outside the 123-credit
  // degree, but its open sequence can still add prerequisite vertices.
  return [...scoped.figures];
}

function virginiaTechQualityFlagAffectedFigures(flag, document) {
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return null;
  const code = text(flag?.code);
  if (code === 'cross_group_elective_distinctness'
      || code === 'variable_credit_and_conditional_5000_level_options') {
    return fixedCampusMenuWitness(document).supported ? ['6'] : null;
  }
  if (code === 'pathways_attribute_and_overlap_evaluator_required') {
    return pathwaysFigure34CapacityProof(document).supported ? ['6'] : null;
  }
  if (code === 'program_listed_codes_absent_from_course_catalog') return ['6'];
  return null;
}

function virginiaTechRequirementRole(document, group, section) {
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return null;
  const groupIndex = document?.requirement_groups?.indexOf(group);
  const sectionIndex = group?.sections?.indexOf(section);
  if (groupIndex === 2 && [0, 1].includes(sectionIndex)) {
    const sections = array(group?.sections);
    if (text(group?.requirement_layer) !== 'major'
        || text(group?.tier) !== 'nontransferable'
        || text(group?.course_level) !== 'nonunit_experience'
        || sections.some((candidate) => (
          number(candidate?.unit_advisement ?? candidate?.units) !== 0
          || array(candidate?.receivers).some((receiver) => number(receiverBody(receiver)?.units) !== 0)
        ))) return null;
    return {
      applies: true,
      exact: true,
      role: 'zero_unit_requirement',
      issues: [],
      evidence: {
        source_bound_evaluator: 'virginiaTechRequirementRole',
        proof_tree_sha256: exact.proof.proof_tree_sha256,
        path: `requirement_groups[2].sections[${sectionIndex}]`,
        exact_capacity_units: 0,
      },
    };
  }
  if (groupIndex === 16 && sectionIndex === 0
      && text(group?.requirement_layer) === 'general_education'
      && text(group?.tier) === 'breadth'
      && exactSingleReceiverSection(section, {
        ask: 1, units: 3, kind: 'ge_area', codes: ['VT-MINIMUM-TOTAL-CAPACITY'],
        name: 'Three applicable elective credits maintaining the 123-credit minimum while Pathways Concept 7 is suspended',
      })) {
    return {
      applies: true,
      exact: true,
      role: 'elective_capacity',
      issues: [],
      evidence: {
        source_bound_evaluator: 'virginiaTechRequirementRole',
        proof_tree_sha256: exact.proof.proof_tree_sha256,
        path: 'requirement_groups[16].sections[0]',
        exact_capacity_units: 3,
      },
    };
  }
  return null;
}

/**
 * The mixed Major Requirements block carries a conservative group-level
 * upper/nontransferable default, but its first section is explicitly authored
 * lower_division + cc_articulable:true. Generic tier resolution only honors a
 * section refinement when the group says `mixed`; this exact override keeps
 * the closed CS 2104/2144/4144 choice from being silently made campus-only.
 */
function virginiaTechSectionTier(document, group, section) {
  if (group !== document?.requirement_groups?.[1]
      || section !== group?.sections?.[0]) return null;
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return null;
  const receivers = array(section?.receivers);
  if (text(group?.requirement_layer) !== 'major'
      || text(group?.tier) !== 'nontransferable'
      || text(group?.course_level) !== 'upper_division'
      || group?.cc_articulable !== false
      || text(section?.course_level) !== 'lower_division'
      || section?.cc_articulable !== true
      || number(section?.section_advisement ?? section?.select) !== 1
      || number(section?.unit_advisement ?? section?.units) !== 3
      || receivers.length !== 3
      || JSON.stringify(receivers.map(receiverCodes)) !== JSON.stringify([
        ['CS2104'], ['CS2144'], ['CS4144'],
      ])
      || receivers.some((receiver) => (
        text(receiverBody(receiver)?.kind)?.toLowerCase() !== 'course'
        || number(receiverBody(receiver)?.units) !== 3
      ))) return null;
  return {
    tier: 'transferable',
    source_bound_evaluator: 'virginiaTechSectionTier',
    proof_tree_sha256: exact.proof.proof_tree_sha256,
    path: 'requirement_groups[1].sections[0]',
    receiver_codes: ['CS2104', 'CS2144', 'CS4144'],
  };
}

function evaluateVirginiaTechResidencyPolicy(document) {
  const exact = exactVirginiaTechTree(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  const residency = audit?.residency || {};
  if (text(residency?.status)?.toLowerCase() !== 'required'
      || number(residency?.minimum_units) !== 31
      || text(residency?.rule) !== RESIDENCY_RULE
      || JSON.stringify(array(residency?.source_refs)) !== JSON.stringify(['graduation', 'policy'])
      || number(audit?.residency_minimum_percent) !== 25
      || number(audit?.residency_exact_units_at_25_percent) !== 30.75
      || number(audit?.senior_residency_window_units) !== 45
      || number(audit?.senior_residency_transfer_units_maximum) !== 18
      || number(audit?.senior_residency_derived_institution_units_minimum) !== 27
      || number(audit?.two_year_transfer_maximum_percent) !== 50) return null;
  return {
    status: 'required',
    degree_total_units: 123,
    residency_minimum_units: 31,
    residency_percentage_exact_units: 30.75,
    overall_transfer_cap_units: 92,
    two_year_transfer_cap_units: 61.5,
    final_window_transfer_cap_units: 96,
    effective_two_year_transfer_cap_units: 61.5,
    evidence: [
      { source: 'total_units - exact residency minimum', units: 92 },
      { source: 'two_year_transfer_maximum_percent', units: 61.5 },
      { source: 'senior_residency_derived_institution_units_minimum', units: 96 },
    ],
    inventory: { fields: {}, unclassified_fields: [] },
    source_policy_id: SLUG,
    declared_subrules: [
      'overall_residency', 'final_window_transfer_cap',
      'two_year_transfer_percentage_cap',
    ],
    evaluator: 'evaluateVirginiaTechResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the exact 50-percent two-year cap is binding at 61.5 credits; the 31-credit overall residence minimum and 27 resident credits in the final 45 are independently enforced and nonbinding at that cap',
    issues: [],
    proof: {
      ...exact.proof,
      senior_window_units: 45,
      senior_window_transfer_maximum: 18,
      senior_window_resident_minimum: 27,
    },
  };
}

module.exports = {
  CANDIDATE_ONLY_ALTERNATIVES,
  FIGURE_34_RESOLVER_ANCHORS,
  FIGURE_34_SCOPE,
  PATHWAYS_CAPACITY_EVIDENCE_SHA256,
  PROOF_TREE_SHA256,
  PROTECTED_PROOF_TREE_SHA256,
  SOURCE_BUNDLE_SHA256,
  SOURCE_RECEIPTS,
  conceptFourProof,
  evaluateVirginiaTechConstraint,
  evaluateVirginiaTechResidencyPolicy,
  exactVirginiaTechFigure34Tree,
  exactVirginiaTechTree,
  figureOneNaturalScienceSelection,
  fixedCampusMenuWitness,
  normalizedVirginiaTechProofTree,
  pathwaysFigure34CapacityProof,
  standardMathAndPathwaysSelection,
  supplementalPathwaysCapacityEvidence,
  virginiaTechProofTreeFingerprint,
  virginiaTechQualityFlagAffectedFigures,
  virginiaTechRequirementRole,
  virginiaTechSectionTier,
  virginiaTechSourceSpecificAffectedFigures,
};
