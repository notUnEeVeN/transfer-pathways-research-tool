/**
 * Exact paper-figure proofs for Norfolk State's 2025-2026 Computer Science
 * Standard Track.
 *
 * The proof is deliberately bound to the complete reviewed requirement tree,
 * its accounting declarations, projected course identities, and the six-role
 * official source bundle.  The shared readers may therefore choose two
 * different laboratory-science series and six different upper-level
 * electives only while that complete receipt remains unchanged.
 *
 * Residency is bound independently to the exact plan-of-study receipt. NSU's
 * official fourth-year row totals 31 credits; because all community-college
 * work precedes the university segment, reserving those 31 resident credits
 * enforces both the 30-credit floor and the senior-curriculum rule. The two
 * required resident semesters are a feasible scheduling condition inside that
 * segment and do not permit any additional transfer credit.
 */

const { createHash } = require('node:crypto');
const { receivingCourseIdForDocument } = require('../virginia/courseIdentity');

const SLUG = 'norfolk-state-university';
const SCHOOL = 'Norfolk State University';
const SCHOOL_ID = 9217;
const SOURCE_DEGREE_ID = 'va:degree:norfolk-state-university:cs';
const SOURCE_INSTITUTION_ID = 'va:uni:norfolk-state-university';
const FINAL_DEGREE_ID = 'degree:9217:va-cs';
const FINAL_INSTITUTION_ID = 'va:uni:9217';
const SOURCE_PROGRAM = 'Bachelor of Science in Computer Science - Standard Track';
const FINAL_PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2025-2026';
const SOURCE_BUNDLE_SHA256 = '738d651eae6b31e1f3237612878f9a6770981cc660ce7fea54d317c14c9d07c6';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: 'f223ee32c51b1597a85aa3f82be17c1018cc257a969de3fca3e222be71746ac1',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: 'a582c2e01a83134b609086ea218dfcad27a4c8327515ee9038bbf1f00e6c451c',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: 'c6f34f1f976e77b9925b2c0897cac59251ff3615dee6dee7f997a1b08dab1292',
  }),
  Object.freeze({
    id: 'college_2', role: 'college', kind: 'college',
    sha256: 'c715d597e0898ad7655c59675b164324d21fea5a3c3ceda8148500662825f718',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: '81623b45aa0703da5465a94bf914370430c4afc4069a58dd41e0e82ace73c476',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: '9d2f4b6142ac40a1c71c382bd53e4c92447d27a43156d50ce82504bc519fe86f',
  }),
]);

// Filled from normalizedNsuProofTree() after composition -> accepted source ->
// final numeric projection parity is established.  Wrapper ids and derived
// display categories are excluded; every authored group, section, receiver,
// source ref, constraint, accounting field, note, flag, and used title is in.
const PROOF_TREE_SHA256 = '62aa82541e3be4e17f1531092501c83628414bd9f1bac464afbbd1afdd06c621';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const SCIENCE_GROUP_INDEX = 1;
const GE_OVERLAP_GROUP_INDEX = 3;
const ELECTIVE_GROUP_INDEX = 4;
const SCIENCE_RULE_PATH = 'requirement_groups[1]';
const GE_OVERLAP_RULE_PATH = 'requirement_groups[3]';
const MAJOR_MENU_RULE_PATH = 'requirement_groups[4]';
const STRUCTURAL_PATHS = Object.freeze([
  'requirement_groups[1].distinct_course_ids_across_sections',
  'requirement_groups[4].distinct_course_ids_across_sections',
]);

const SCIENCE_SERIES = Object.freeze([
  Object.freeze(['BIO110', 'BIO110L']),
  Object.freeze(['PHY152', 'PHY152L']),
  Object.freeze(['CHM221', 'CHM221L']),
]);
const MAJOR_MENU_CODES = Object.freeze([
  'CSC312', 'CSC313', 'CSC314', 'CSC316', 'CSC360', 'CSC369', 'CSC390',
  'CSC373', 'CSC395', 'CSC411', 'CSC420', 'CSC422', 'CSC432', 'CSC435',
  'CSC445', 'CSC449', 'CSC466', 'CSC467', 'CSC470', 'CSC471', 'CSC472',
  'CSC476', 'CSC477', 'CSC485', 'CSC486', 'CSC487', 'CSC488', 'CSC490',
  'CSC492', 'CSC494',
]);

// BIO has no published required prerequisite. CHM 221 requires fixed MTH 153;
// its high-school-chemistry and algebra-proficiency statements are non-course
// entry competencies, not prerequisite-course vertices. CHM 221L is already
// kept in the indivisible four-credit series. This avoids the catalog's
// anomalous self-prerequisite printed on PHY 152.
const SCIENCE_SELECTION_INDICES = Object.freeze([0, 2]);
// These six legal CSC choices are distinct. Their official entries either have
// no required prerequisite statement or require fixed CSC 260 / CSC 372.
const FIRST_MENU_SELECTION_INDICES = Object.freeze([4, 7, 10, 13, 16]);
const FINAL_MENU_SELECTION_INDEX = 18;
const NON_COURSE_SECTION_KEYS = Object.freeze([
  '3:0', '3:1', '3:2',
  '6:0', '6:1', '6:2', '6:3', '6:4', '6:5',
]);
const NSU_RESIDENCY_RULE = 'Bachelor candidates must spend at least two semesters in residence and earn at least 30 semester hours during that period, including all courses required by the senior-year curriculum.';
const NSU_CUMULATIVE_GPA_SOURCE_TEXT =
  'Have a minimum cumulative grade point average of 2.0.';
const SENIOR_CURRICULUM_COMPONENTS = Object.freeze({
  fixed_major_courses: 7,
  upper_cs_or_math_electives: 15,
  cultural_perspectives: 6,
  free_elective: 3,
});

const SELECTED_PREREQUISITE_EVIDENCE = Object.freeze({
  BIO110: Object.freeze({
    sha256: '3f40503571456914ee01778bd7c8f7fda4fa6e0a5f05468f03eb92097374d86d',
    prerequisite_codes: Object.freeze([]),
  }),
  BIO110L: Object.freeze({
    sha256: '8d8b5fe17ed2aa6bb2df064f8780f13a9c6db988822ce3168537b69935586018',
    prerequisite_codes: Object.freeze([]),
  }),
  CHM221: Object.freeze({
    sha256: 'd1b3e3bfc34ab8c680652452470272baf1081631f01844062bc5a9c2293c0dff',
    prerequisite_codes: Object.freeze(['MTH153']),
  }),
  CHM221L: Object.freeze({
    sha256: '97f90c47c1455d48366fd9f433dbe1ae656cb66e382710166fc18a2fb43c3eff',
    prerequisite_codes: Object.freeze([]),
  }),
  CSC360: Object.freeze({
    sha256: '437b5b239121267c322578bee06dff8b33494d90a4991ddc8694deeda0042084',
    prerequisite_codes: Object.freeze(['CSC260']),
  }),
  CSC373: Object.freeze({
    sha256: '35829af5e30504451c11a78a6fba93d06ce1c9d4ecd46b8f4f44894d5aea221a',
    prerequisite_codes: Object.freeze(['CSC372']),
  }),
  CSC420: Object.freeze({
    sha256: '532ecf978c2b245add0b7b351851992c8ab5a29b12b9abb5ab1853cc5783ce66',
    prerequisite_codes: Object.freeze(['CSC260']),
  }),
  CSC435: Object.freeze({
    sha256: '46e0186e7ce2299658b99db8f6deaae5cc0a7a77008540e07c80bd7cf3b4fafb',
    prerequisite_codes: Object.freeze([]),
  }),
  CSC466: Object.freeze({
    sha256: '73bafde4025d87d7c834c9632e1bfc5ebcbdd55b023500fc9b114842b9bd7308',
    prerequisite_codes: Object.freeze([]),
  }),
  CSC470: Object.freeze({
    sha256: '8c253f1042d1115f0ad5fe84a1baffc4b9717b661e9f05f9faa4f0eee229c435',
    prerequisite_codes: Object.freeze([]),
  }),
});

const REGISTRY_NOTE = 'The previously recorded URL was Computer Engineering Technology, a different degree. Norfolk State publishes five CS tracks; the Standard Track is the plain B.S.';

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
  const program = text(value);
  return program === FINAL_PROGRAM ? SOURCE_PROGRAM : program;
}

function normalizedNsuProofTree(document) {
  const authoredCodes = new Set(array(document?.requirement_groups)
    .flatMap((group) => array(group?.sections))
    .flatMap((section) => array(section?.receivers))
    .flatMap(receiverCodes));
  const courseTitles = Object.fromEntries(Object.entries(document?.course_titles || {})
    .filter(([code]) => authoredCodes.has(code)));
  return {
    catalog_year: text(document?.catalog_year),
    program: canonicalProgram(document?.program),
    total_units: number(document?.total_units),
    academic_unit: text(document?.academic_unit),
    college: text(document?.college),
    ge_authority: text(document?.ge_authority),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: array(document?.modeling_notes).filter((note) => note !== REGISTRY_NOTE),
    data_quality_flags: array(document?.data_quality_flags),
    course_titles: courseTitles,
    groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function nsuProofTreeFingerprint(document) {
  return hash(normalizedNsuProofTree(document));
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
      ? null : 'the composed NSU source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== 'server/.va-catalogs/composed/norfolk-state-university.json') {
    return 'the retained NSU source-bundle receipt changed';
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
      })) return 'the retained official NSU source roles or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactNsuTree(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact NSU composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the NSU catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = nsuProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed NSU source tree, source refs, constraints, or accounting declarations changed');
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
            return fail('one or more projected NSU course identities changed');
          }
        }
      }
    }
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed NSU 2025-2026 tree and six-role official source receipt match',
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

function arraysEqual(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function scienceShape(document) {
  const group = document?.requirement_groups?.[SCIENCE_GROUP_INDEX];
  const sections = array(group?.sections);
  if (sections.length !== 2 || group?.distinct_course_ids_across_sections !== true) {
    return fail('the NSU science group no longer has two cross-section-distinct slots');
  }
  for (const section of sections) {
    if (number(section?.section_advisement ?? section?.select) !== 1
        || number(section?.unit_advisement ?? section?.units) !== 4) {
      return fail('each NSU science slot must remain choose-one for four credits');
    }
    const receivers = array(section.receivers);
    if (receivers.length !== SCIENCE_SERIES.length) {
      return fail('the NSU science sequence count changed');
    }
    for (let index = 0; index < SCIENCE_SERIES.length; index += 1) {
      const receiver = receivers[index];
      if (text(receiverBody(receiver).kind)?.toLowerCase() !== 'series'
          || number(receiverBody(receiver).units) !== 4
          || !arraysEqual(receiverCodes(receiver), SCIENCE_SERIES[index])) {
        return fail('the NSU lecture/laboratory series roster or units changed');
      }
    }
  }
  return { supported: true, group, sections };
}

function electiveShape(document) {
  const group = document?.requirement_groups?.[ELECTIVE_GROUP_INDEX];
  const sections = array(group?.sections);
  if (sections.length !== 2 || group?.distinct_course_ids_across_sections !== true) {
    return fail('the NSU elective group no longer has two cross-section-distinct slots');
  }
  const first = sections[0];
  const final = sections[1];
  if (number(first?.section_advisement ?? first?.select) !== 5
      || number(first?.unit_advisement ?? first?.units) !== 15
      || number(final?.section_advisement ?? final?.select) !== 1
      || number(final?.unit_advisement ?? final?.units) !== 3) {
    return fail('the NSU five-plus-one elective choose counts or credit floors changed');
  }
  const firstCodes = array(first.receivers).map((receiver) => receiverCodes(receiver)[0]);
  const finalCodes = array(final.receivers).map((receiver) => receiverCodes(receiver)[0]);
  if (!arraysEqual(firstCodes, MAJOR_MENU_CODES)
      || !arraysEqual(finalCodes.slice(0, -1), MAJOR_MENU_CODES)
      || finalCodes.at(-1) !== 'NSU-MATH-300'
      || array(first.receivers).some((receiver) => (
        text(receiverBody(receiver).kind)?.toLowerCase() !== 'course'
        || number(receiverBody(receiver).units) !== 3
      ))
      || array(final.receivers).slice(0, -1).some((receiver) => (
        text(receiverBody(receiver).kind)?.toLowerCase() !== 'course'
        || number(receiverBody(receiver).units) !== 3
      ))
      || text(receiverBody(array(final.receivers).at(-1)).kind)?.toLowerCase() !== 'ge_area'
      || number(receiverBody(array(final.receivers).at(-1)).units) !== 3) {
    return fail('the NSU major/sixth elective receiver roster, kinds, or units changed');
  }
  return { supported: true, group, sections };
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}) {
  const expectedPath = {
    distinct_laboratory_science_sequences: SCIENCE_RULE_PATH,
    general_education_major_overlap: GE_OVERLAP_RULE_PATH,
    minimum_major_menu_units: MAJOR_MENU_RULE_PATH,
  }[kind];
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

function selectedCodes(section, indices) {
  return indices.map((index) => receiverCodes(section?.receivers?.[index]));
}

/**
 * The deterministic source-valid selection used by Figure 1 and Figure 6.
 * Figures 3/4 may optimize among the six exact distinct science pairs, but use
 * the same proof and never reuse a receiver identity across the two slots.
 */
function norfolkStateFigureSelection(document) {
  const exact = exactNsuTree(document);
  if (!exact.supported) return { ready: false, institution: SLUG, reason: exact.reason };
  const science = scienceShape(document);
  if (!science.supported) return { ready: false, institution: SLUG, reason: science.reason };
  const electives = electiveShape(document);
  if (!electives.supported) return { ready: false, institution: SLUG, reason: electives.reason };

  const scienceCodes = [
    receiverCodes(science.sections[0].receivers[SCIENCE_SELECTION_INDICES[0]]),
    receiverCodes(science.sections[1].receivers[SCIENCE_SELECTION_INDICES[1]]),
  ];
  const firstMenuCodes = selectedCodes(
    electives.sections[0], FIRST_MENU_SELECTION_INDICES,
  ).flat();
  const finalMenuCodes = selectedCodes(
    electives.sections[1], [FINAL_MENU_SELECTION_INDEX],
  ).flat();
  const selectedElectiveCodes = [...firstMenuCodes, ...finalMenuCodes];
  if (scienceCodes.some((codes) => !codes.length)
      || new Set(scienceCodes.flat()).size !== scienceCodes.flat().length
      || firstMenuCodes.length !== 5
      || finalMenuCodes.length !== 1
      || new Set(selectedElectiveCodes).size !== 6) {
    return {
      ready: false,
      institution: SLUG,
      reason: 'the deterministic NSU selection no longer satisfies both distinctness rules',
    };
  }
  return {
    ready: true,
    institution: SLUG,
    section_receiver_indices: {
      '1:0': [SCIENCE_SELECTION_INDICES[0]],
      '1:1': [SCIENCE_SELECTION_INDICES[1]],
      '4:0': [...FIRST_MENU_SELECTION_INDICES],
      '4:1': [FINAL_MENU_SELECTION_INDEX],
    },
    selected_science_codes: scienceCodes,
    selected_elective_codes: selectedElectiveCodes,
    prerequisite_evidence: SELECTED_PREREQUISITE_EVIDENCE,
    non_course_section_keys: [...NON_COURSE_SECTION_KEYS],
    proof: exact.proof,
  };
}

/** All six legal ordered pairs for the two authored science slots. */
function norfolkStateSciencePairs(document) {
  const exact = exactNsuTree(document);
  if (!exact.supported) return { ready: false, institution: SLUG, reason: exact.reason, pairs: [] };
  const science = scienceShape(document);
  if (!science.supported) {
    return { ready: false, institution: SLUG, reason: science.reason, pairs: [] };
  }
  const pairs = [];
  for (let firstIndex = 0; firstIndex < SCIENCE_SERIES.length; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < SCIENCE_SERIES.length; secondIndex += 1) {
      if (firstIndex === secondIndex) continue;
      pairs.push({
        first_index: firstIndex,
        second_index: secondIndex,
        first_receiver: science.sections[0].receivers[firstIndex],
        second_receiver: science.sections[1].receivers[secondIndex],
        selected_codes: [SCIENCE_SERIES[firstIndex], SCIENCE_SERIES[secondIndex]],
      });
    }
  }
  return { ready: true, institution: SLUG, pairs, proof: exact.proof };
}

/**
 * Pick the legal distinct science pair that maximizes fully articulated
 * four-credit series. Ties are source-order deterministic. Upper electives
 * stay on the prerequisite-closed deterministic Figure 6 selection because
 * the reviewed tree marks them university-only.
 */
function norfolkStateCoverageSelection(document, articulated = new Set()) {
  const selection = norfolkStateFigureSelection(document);
  if (!selection.ready) return selection;
  const report = norfolkStateSciencePairs(document);
  if (!report.ready) return report;
  const covered = (receiver) => {
    const body = receiverBody(receiver);
    const ids = body.kind === 'series' ? array(body.parent_ids) : [body.parent_id];
    return ids.length > 0 && ids.every((id) => articulated.has(Number(id)));
  };
  const pair = report.pairs.map((candidate) => ({
    ...candidate,
    covered_series: Number(covered(candidate.first_receiver))
      + Number(covered(candidate.second_receiver)),
  })).sort((left, right) => (
    right.covered_series - left.covered_series
    || left.first_index - right.first_index
    || left.second_index - right.second_index
  ))[0];
  if (!pair) return { ready: false, institution: SLUG, reason: 'no legal NSU science pair remains' };
  return {
    ...selection,
    section_receiver_indices: {
      ...selection.section_receiver_indices,
      '1:0': [pair.first_index],
      '1:1': [pair.second_index],
    },
    selected_science_codes: pair.selected_codes,
    covered_science_series: pair.covered_series,
  };
}

function geOverlapProof(document) {
  const group = document?.requirement_groups?.[GE_OVERLAP_GROUP_INDEX];
  const sections = array(group?.sections);
  if (sections.length !== 3
      || sections.some((section) => (
        number(section?.section_advisement ?? section?.select) !== 1
        || number(section?.unit_advisement ?? section?.units) !== 0
        || array(section.receivers).length !== 1
        || text(receiverBody(section.receivers[0]).kind)?.toLowerCase() !== 'requirement'
        || number(receiverBody(section.receivers[0]).units) !== 0
      ))) return fail('the three NSU zero-increment GE overlap gates changed');
  const audit = document?.unit_audit || {};
  const modeled = number(audit.modeled_units);
  const additive = number(audit.fixed_computing_math_and_writing_units)
    + number(audit.laboratory_science_support_units)
    + number(audit.remaining_explicit_general_education_units)
    + number(audit.upper_cs_or_math_elective_units)
    + number(audit.free_elective_units);
  const ge = number(audit.remaining_explicit_general_education_units) + 3 + 3 + 7;
  if (modeled !== 120 || additive !== 120
      || number(audit.published_general_education_units) !== 40 || ge !== 40) {
    return fail('the NSU additive-degree or 40-credit GE overlap arithmetic changed');
  }
  return {
    supported: true,
    proof: {
      zero_increment_gate_count: 3,
      modeled_units: modeled,
      additive_units: additive,
      published_general_education_units: 40,
      explicit_additive_ge_units: 27,
      embedded_digital_units: 3,
      embedded_mathematics_units: 3,
      embedded_natural_science_units: 7,
    },
  };
}

function evaluateNorfolkStateConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (![
    'distinct_laboratory_science_sequences',
    'general_education_major_overlap',
    'minimum_major_menu_units',
  ].includes(kind)) return fail('no exact NSU evaluator handles this rule');
  const exact = exactNsuTree(context.document);
  if (!exact.supported) return exact;
  const containerIssue = ruleContainerIssue(kind, container, context);
  if (containerIssue) return fail(containerIssue);

  if (kind === 'general_education_major_overlap') {
    const overlap = geOverlapProof(context.document);
    if (!overlap.supported) return overlap;
    return {
      ...exact,
      reason: 'the exact 120-credit tree retains all 40 GE credits while the three embedded categories remain zero-increment gates in every reader',
      proof: { ...exact.proof, rule_path: context.path, ...overlap.proof },
    };
  }

  const selection = norfolkStateFigureSelection(context.document);
  if (!selection.ready) return fail(selection.reason);
  if (kind === 'distinct_laboratory_science_sequences') {
    return {
      ...exact,
      reason: 'every reader selects two different source-enumerated four-credit lecture/laboratory series',
      proof: {
        ...exact.proof,
        rule_path: context.path,
        selected_receiver_indices: [...SCIENCE_SELECTION_INDICES],
        selected_codes: selection.selected_science_codes,
        legal_distinct_pair_count: 6,
      },
    };
  }
  return {
    ...exact,
    reason: 'every reader selects five distinct three-credit CSC menu courses plus one different three-credit CSC menu course',
    proof: {
      ...exact.proof,
      rule_path: context.path,
      first_menu_receiver_indices: [...FIRST_MENU_SELECTION_INDICES],
      final_menu_receiver_index: FINAL_MENU_SELECTION_INDEX,
      selected_codes: selection.selected_elective_codes,
      first_menu_units: 15,
      total_elective_units: 18,
    },
  };
}

function evaluateNorfolkStateStructuralRule({ kind, path, document } = {}) {
  if (kind !== 'distinct_course_ids_across_sections' || !STRUCTURAL_PATHS.includes(path)) {
    return null;
  }
  const exact = exactNsuTree(document);
  if (!exact.supported) return exact;
  const selection = norfolkStateFigureSelection(document);
  if (!selection.ready) return fail(selection.reason);
  const isScience = path === STRUCTURAL_PATHS[0];
  const codes = isScience
    ? selection.selected_science_codes.flat() : selection.selected_elective_codes;
  if (new Set(codes).size !== codes.length) {
    return fail(`the deterministic NSU ${isScience ? 'science' : 'elective'} selection reuses a course identity`);
  }
  return {
    ...exact,
    evaluator: 'evaluateNorfolkStateStructuralRule',
    reason: `all shared readers use the exact cross-section-distinct NSU ${isScience ? 'science-series' : 'upper-elective'} selection`,
    proof: {
      ...exact.proof,
      structural_path: path,
      selected_codes: codes,
      selected_distinct_course_ids: codes.length,
    },
  };
}

function evaluateNorfolkStateResidencyPolicy(document) {
  if (!documentStyle(document)) return null;
  const exact = exactNsuTree(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  const residency = audit.residency || {};
  if (text(residency.status)?.toLowerCase() !== 'required'
      || number(residency.minimum_units) !== 30
      || text(residency.rule) !== NSU_RESIDENCY_RULE
      || JSON.stringify(array(residency.source_refs)) !== JSON.stringify(['general_education'])
      || number(audit.resident_semesters_minimum) !== 2) return null;

  const fixed = document.requirement_groups?.[0]?.sections || [];
  const fixedSenior = [[14, 'CSC498', 2], [15, 'CSC464', 3], [16, 'CSC499', 2]];
  if (fixedSenior.some(([index, code, units]) => (
    receiverCodes(fixed[index]?.receivers?.[0])[0] !== code
      || number(fixed[index]?.unit_advisement ?? fixed[index]?.units) !== units
      || effective(fixed[index], document.requirement_groups[0], 'cc_articulable') !== false
  ))) return null;
  const ge = document.requirement_groups?.[2]?.sections || [];
  if (text(ge[10]?.label_seen ?? ge[10]?.label) !== 'Social Science Cultural Elective'
      || number(ge[10]?.unit_advisement ?? ge[10]?.units) !== 3
      || text(ge[11]?.label_seen ?? ge[11]?.label) !== 'Humanities Cultural Elective'
      || number(ge[11]?.unit_advisement ?? ge[11]?.units) !== 3) return null;
  const electives = electiveShape(document);
  const free = document.requirement_groups?.[5]?.sections?.[0];
  if (!electives.supported
      || number(free?.unit_advisement ?? free?.units) !== 3
      || receiverCodes(free?.receivers?.[0])[0] !== 'NSU-FREE-ELECTIVE') return null;

  const seniorUnits = Object.values(SENIOR_CURRICULUM_COMPONENTS)
    .reduce((sum, units) => sum + units, 0);
  if (seniorUnits !== 31 || number(document.total_units) !== 120) return null;
  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 30,
    residency_percentage_exact_units: null,
    overall_transfer_cap_units: 90,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: 89,
    effective_two_year_transfer_cap_units: 89,
    evidence: [
      { source: 'total_units - exact residency minimum', units: 90 },
      { source: 'total_units - exact senior-year curriculum', units: 89 },
    ],
    inventory: {
      fields: { resident_semesters_minimum: 2 },
      unclassified_fields: [],
    },
    source_policy_id: SLUG,
    declared_subrules: [
      'overall_residency', 'resident_semesters', 'senior_curriculum_residency',
    ],
    evaluator: 'evaluateNorfolkStateResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the exact official fourth-year curriculum reserves 31 resident credits, which is stronger than the 30-credit floor; the post-transfer segment can span the required two semesters without increasing transferable capacity',
    issues: [],
    proof: {
      ...exact.proof,
      senior_curriculum_units: seniorUnits,
      senior_curriculum_components: { ...SENIOR_CURRICULUM_COMPONENTS },
      resident_semesters_minimum: 2,
      official_program_source_sha256: SOURCE_RECEIPTS[0].sha256,
      official_residency_source_sha256: SOURCE_RECEIPTS[1].sha256,
    },
  };
}

/**
 * Exact paper-scope disposition for NSU's cumulative-GPA graduation gate.
 * The source-bound carrier has no course identity or credit of its own; the
 * requirement remains a complete-degree condition outside the paper model.
 */
function evaluateNorfolkStateAdministrativePolicy(document, kind) {
  if (kind !== 'minimum_cumulative_gpa') return null;
  const exact = exactNsuTree(document);
  if (!exact.supported) return null;
  if (number(document?.unit_audit?.minimum_cumulative_gpa) !== 2) return null;
  const group = document.requirement_groups?.[6];
  const section = array(group?.sections)[0];
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  if (text(group?.title) !== 'University and department graduation requirements'
      || text(group?.requirement_layer) !== 'university_graduation'
      || text(group?.tier) !== 'nontransferable'
      || text(group?.course_level) !== 'policy'
      || group?.cc_articulable !== false
      || JSON.stringify(array(group?.source_refs))
        !== JSON.stringify(['general_education', 'college_2', 'policy'])
      || array(group?.sections).length !== 6
      || number(section?.section_advisement ?? section?.select) !== 1
      || number(section?.unit_advisement ?? section?.units) !== 0
      || receivers.length !== 1
      || text(body?.kind)?.toLowerCase() !== 'requirement'
      || text(body?.name) !== 'Minimum 120 semester hours and minimum 2.0 cumulative GPA'
      || number(body?.units) !== 0
      || body?.parent_id != null
      || array(body?.parent_ids).length
      || receiverCodes(receivers[0]).length) return null;
  return {
    supported: false,
    affected_figures: [],
    paper_impact_proven: true,
    evaluator: 'evaluateNorfolkStateAdministrativePolicy',
    reason: 'the exact NSU cumulative-GPA carrier is a zero-credit, identity-free student-performance gate; the paper figures condition on successful completion and do not estimate transcript outcomes',
    proof: {
      ...exact.proof,
      condition: kind,
      threshold: 2,
      carrier_path: 'requirement_groups[6].sections[0]',
      carrier_units: 0,
      carrier_course_identities: 0,
      course_selection_change_when_condition_met: 0,
      credit_unit_change_when_condition_met: 0,
      prerequisite_edge_change_when_condition_met: 0,
      paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
    },
  };
}

function norfolkStateQualityFlagAffectedFigures(flag, document) {
  if (text(flag?.code) !== 'cross_section_science_and_elective_distinctness') return null;
  const exact = exactNsuTree(document);
  return exact.supported ? [...ALL_FIGURES] : null;
}

module.exports = {
  MAJOR_MENU_CODES,
  NSU_CUMULATIVE_GPA_SOURCE_TEXT,
  SELECTED_PREREQUISITE_EVIDENCE,
  SOURCE_BUNDLE_SHA256,
  SOURCE_RECEIPTS,
  evaluateNorfolkStateConstraint,
  evaluateNorfolkStateResidencyPolicy,
  evaluateNorfolkStateAdministrativePolicy,
  evaluateNorfolkStateStructuralRule,
  exactNsuTree,
  norfolkStateFigureSelection,
  norfolkStateCoverageSelection,
  norfolkStateQualityFlagAffectedFigures,
  norfolkStateSciencePairs,
  normalizedNsuProofTree,
  nsuProofTreeFingerprint,
};
