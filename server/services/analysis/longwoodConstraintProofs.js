/**
 * Exact paper-figure proofs for Longwood University's 2026-2027 Computer
 * Science B.S. canonical path.
 *
 * This module proves only facts closed by the complete reviewed Boolean tree,
 * exact accounting declarations, projected course identities, the six
 * retained catalog receipts, and a separately retained current first-party
 * Computer Science course-listing response.  The latter supplies one
 * deterministic, fixed-credit major-elective route; it does not rewrite the
 * authored open menu.  Civitae distribution attributes, grades, and
 * administrative conditions remain outside the proof and therefore fail
 * closed.
 */

const { createHash } = require('node:crypto');
const {
  courseIdFor,
  receivingCourseIdForDocument,
} = require('../virginia/courseIdentity');
const CIVITAE_FIGURE_34_EVIDENCE = require(
  '../../.va-catalogs/research/longwood-civitae-figure34-evidence.json'
);

const SLUG = 'longwood-university';
const SCHOOL = 'Longwood University';
const SCHOOL_ID = 9214;
const SOURCE_DEGREE_ID = 'va:degree:longwood-university:cs';
const SOURCE_INSTITUTION_ID = 'va:uni:longwood-university';
const FINAL_DEGREE_ID = 'degree:9214:va-cs';
const FINAL_INSTITUTION_ID = 'va:uni:9214';
const PROGRAM = 'Computer Science, B.S.';
const CATALOG_YEAR = '2026-2027';
const SOURCE_BUNDLE_SHA256 = 'f0a03d0d941e647ba1808d6b9b73ad705286a9c0c6681be818bf585f3c64373d';

const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'major', role: 'program', kind: 'major',
    sha256: '4a606eb3c72ad6cd10fb96dab19c5fde56c69a187349ff18099c7f2d947f27f0',
  }),
  Object.freeze({
    id: 'general_education', role: 'ge', kind: 'general_education',
    sha256: 'fae1bd018d79fd6b92d6c0df855c3d6997d874bda8efa911396b0adbb2d907e0',
  }),
  Object.freeze({
    id: 'college', role: 'college', kind: 'college',
    sha256: '1686f20e48ef0e17c6e7614bd0cd0d69968b9e0121735087cc04b37579924727',
  }),
  Object.freeze({
    id: 'graduation', role: 'graduation', kind: 'graduation',
    sha256: 'beb39c87d4bcd983b0ffef856926652c2c6592accede12c365a0c865e9494ab7',
  }),
  Object.freeze({
    id: 'policy', role: 'policy', kind: 'policy',
    sha256: '3aa4238bf096fcf8772ec26002d939d3935366c261f2bfa4ee3bd865f7bc01c9',
  }),
  Object.freeze({
    id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
    sha256: '7a8378f7e9249dce4f138e5fa62c487853ce3ca2c2a044ef8cb80c2ab248d36a',
  }),
]);

// Filled after composition -> accepted source -> final numeric projection
// parity is established. Wrapper ids and derived display categories are
// excluded; every authored group, receiver, source ref, constraint, note,
// accounting declaration, quality flag, and used title remains in the hash.
const PROOF_TREE_SHA256 = '5926ef44b66d491623f861c1e9840d6fc7dc12c198f238aae7f96b9ccb83ff68';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const RULE_PATHS = Object.freeze({
  language_placement_route: 'requirement_groups[3]',
  perspectives_sequence: 'requirement_groups[7]',
  civitae_single_count_and_distribution: 'requirement_groups[7]',
  course_level_menu_and_exclusion: 'requirement_groups[11]',
  distinct_course_and_exclusion_pool: 'requirement_groups[12]',
  major_elective_overlap: 'requirement_groups[13]',
  prerequisite_gate: 'requirement_groups[14]',
  upper_level_distribution_across_degree: 'requirement_groups[15]',
  dependent_elective_capacity: 'requirement_groups[16]',
  future_civitae_major_overlap: 'requirement_groups[16]',
});
const FIGURE_ONE_INVARIANT_PATHS = Object.freeze({
  language_placement_route: 'requirement_groups[3]',
  civitae_single_count_and_distribution: 'requirement_groups[7]',
  future_civitae_major_overlap: 'requirement_groups[16]',
});

const VARIABLE_GROUP_INDICES = Object.freeze({
  global: 3,
  bs: 14,
  remainder: 16,
});
const CANONICAL_SECTION_INDICES = Object.freeze({ 3: 0, 14: 0, 16: 0 });
const VARIABLE_UNIT_MATRIX = Object.freeze([
  Object.freeze({ global: 0, bs: 0, remainder: 0, units: Object.freeze([3, 3, 21]) }),
  Object.freeze({ global: 0, bs: 1, remainder: 1, units: Object.freeze([3, 4, 20]) }),
  Object.freeze({ global: 1, bs: 0, remainder: 1, units: Object.freeze([4, 3, 20]) }),
  Object.freeze({ global: 1, bs: 1, remainder: 2, units: Object.freeze([4, 4, 19]) }),
]);

const MATH250_PREREQUISITE_EVIDENCE = Object.freeze({
  source_content_sha256: 'c45dc167fac980735772cf8cd90e07e9d860105dc0d436884bce9dc83ec6da93',
  paths: Object.freeze([Object.freeze(['MATH175']), Object.freeze(['MATH261'])]),
  selected_path: Object.freeze(['MATH175']),
});
const CURRENT_CMSC_RESPONSE = Object.freeze({
  official_url: 'https://www.longwood.edu/computerscience/computer-science-course-listing/',
  cache_path: 'server/.va-catalogs/university-prerequisites/raw/longwood-university/longwood-university__computer_science_course_listing.html',
  response_sha256: '01802e9aff48430af3064550c8b8bb6eb5011953282e3c18633f16101788609d',
  response_bytes: 44687,
  boundary_contract: 'longwood_department_unique_course_listing_entry_with_published_credits_v1',
  edition_boundary: 'department_course_text_from_unversioned_first_party_page_bound_to_separately_retained_2026_2027_catoid_19_catalog_context',
});
const MAJOR_ELECTIVE_SELECTION = Object.freeze([
  Object.freeze({
    code: 'CMSC415', title: 'Theory of Computation', units: 3,
    group_index: 11, course_level: 'upper_division',
    raw_entry_sha256: '6673910f4cc931c70e81447850a9ef54cbfaa9e5ede07addd2b549799dae6b35',
    raw_entry_html_sha256: 'dd9073a566bfcf1bbd1978375163bc876c792f08ca8ee037d27d8eff44716524',
    prerequisite_paths: Object.freeze([Object.freeze(['CMSC208'])]),
    selected_prerequisite_path: Object.freeze(['CMSC208']),
    current_civitae_designations: Object.freeze([]),
  }),
  Object.freeze({
    code: 'CMSC455', title: 'Network Security Cryptography', units: 3,
    group_index: 11, course_level: 'upper_division',
    raw_entry_sha256: '8731a958a69e0a6455914bac55e22b0d100e0bbf7776bf160ee540627c7fa117',
    raw_entry_html_sha256: 'a797d5ab403674b5ab3554a2638f209fad1395d2b54b662f9588bc37274caa85',
    prerequisite_paths: Object.freeze([Object.freeze(['CMSC160', 'MATH175'])]),
    selected_prerequisite_path: Object.freeze(['CMSC160', 'MATH175']),
    current_civitae_designations: Object.freeze([]),
  }),
  Object.freeze({
    code: 'CMSC210', title: 'Web Page Design and Scripting', units: 3,
    group_index: 12, course_level: 'lower_division',
    raw_entry_sha256: '041f697c0e1fd3bfb84b3fe6c0623bd7c20c4572508614101fceb7d8fa764d39',
    raw_entry_html_sha256: 'ccbea0874f49fb0c9492b3d5d38c7d6448c79d93710a756d6e472d90d31965aa',
    prerequisite_paths: Object.freeze([
      Object.freeze(['CMSC140']), Object.freeze(['CMSC160']),
    ]),
    selected_prerequisite_path: Object.freeze(['CMSC160']),
    current_civitae_designations: Object.freeze([]),
  }),
  Object.freeze({
    code: 'CMSC360', title: 'Computer Network Theory', units: 3,
    group_index: 12, course_level: 'upper_division',
    raw_entry_sha256: '405e1d8348cbef84bc933231f3dee5f1033f7bdc870ec42bd7037496ff1f90b0',
    raw_entry_html_sha256: '68a6ef090ec4379f6513ae3d49f98d972911e2baf05c14f0f0ba4ea57ccc47a7',
    prerequisite_paths: Object.freeze([Object.freeze(['CMSC242'])]),
    selected_prerequisite_path: Object.freeze(['CMSC242']),
    current_civitae_designations: Object.freeze([]),
  }),
]);
const SELECTED_MAJOR_ELECTIVE_CODES = Object.freeze(
  MAJOR_ELECTIVE_SELECTION.map((row) => row.code),
);
const CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL = Object.freeze({
  code: 'CMSC140',
  raw_entry_sha256: '460de2c29cfd071316b38fc27cba8fb97e3ee55b65bbb3158780d6d9230000eb',
  raw_entry_html_sha256: '5660f5f6a7c5466c8b5c4681c92a70380563e46d54628ae15f651d233ea14261',
  designation_tokens: Object.freeze(['FQRC', 'SI']),
});
const CIVITAE_FIGURE_34_EVIDENCE_SHA256 =
  '157a03c4b1c576863d4debce15e834e9df9905a9b584d94b53dfeac5ff265df6';
const CTZN410_SEQUENCE_EVIDENCE = Object.freeze({
  course_key: 'va:uni:9214:CTZN410',
  source_content_sha256: 'd85521b881a574dc2e591cf6039bbc65b08e934dc7c34e9fd7188e902fdcf12f',
  conditions: Object.freeze([
    Object.freeze({
      type: 'non_course',
      condition: 'minimum_three_completed_perspective_level_courses',
      raw: 'Completion of three perspective level courses',
      course_category: 'perspective_level_course',
      minimum_completed_courses: 3,
    }),
    Object.freeze({
      type: 'non_course',
      condition: 'fourth_perspective_level_course_prior_or_concurrent_with_ctzn410',
      raw: 'The fourth perspectives level course must be taken prior to or concurrently with CTZN 410',
      course_category: 'perspective_level_course',
      required_ordinal_course: 4,
      target_course_code: 'CTZN410',
      concurrent_allowed: true,
    }),
  ]),
});
const PROOF_TITLE_CODES = Object.freeze([
  'CTZN110', 'ENGL165', 'MATH171', 'CTZN410', 'CMSC160', 'CMSC161',
  'CMSC162', 'CMSC201', 'CMSC208', 'CMSC242', 'CMSC262', 'CMSC283',
  'CMSC442', 'CMSC461', 'CMSC483', 'ENGL319', 'MATH175',
]);
const REGISTRY_NOTE = 'The current catoid is 19. The catalog publishes one combined BA-or-BS page; this registry context selects the B.S. without collapsing the B.A. degree requirements into it.';
const UPPER_DIVISION_RULE = 'At least 30 upper-level credits must be earned at Longwood. The canonical model contains 18 specifically required or minimum major/Core upper-level credits and reserves 12 upper-level Longwood elective credits to close the published minimum. The international-exchange exception requires advance written college-dean approval and is not selected.';
const RESIDENCY_RULE = 'At least 25 percent of the 120-credit degree must be earned at Longwood University. Independently, all 30 upper-level graduation credits must be earned at Longwood, except for the separately approved international-exchange exception.';

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

function normalizedLongwoodProofTree(document) {
  const receiverTitles = Object.fromEntries(array(document?.requirement_groups)
    .flatMap((group) => array(group?.sections))
    .flatMap((section) => array(section?.receivers))
    .flatMap((receiver) => {
      const code = receiverCodes(receiver)[0];
      const title = text(receiverBody(receiver).title);
      return code && title ? [[code, title]] : [];
    }));
  const courseTitles = Object.fromEntries(PROOF_TITLE_CODES.map((code) => [
    code, receiverTitles[code] ?? text(document?.course_titles?.[code]),
  ]));
  return {
    catalog_year: text(document?.catalog_year),
    program: text(document?.program),
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

function longwoodProofTreeFingerprint(document) {
  return hash(normalizedLongwoodProofTree(document));
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
      ? null : 'the composed Longwood source-bundle role inventory changed';
  }
  if (document?.provenance?.source_bundle_hash !== SOURCE_BUNDLE_SHA256
      || document?.provenance?.composition_artifact
        !== 'server/.va-catalogs/composed/longwood-university.json') {
    return 'the retained Longwood source-bundle receipt changed';
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
      })) return 'the retained official Longwood source roles or text hashes changed';
  return null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactLongwoodTree(document) {
  const style = documentStyle(document);
  if (!style) return fail('document identity is not an exact Longwood composition/source/projection tuple');
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || number(document?.total_units) !== 120) {
    return fail('the Longwood catalog year or degree total changed');
  }
  const bundleIssue = sourceBundleIssue(document, style);
  if (bundleIssue) return fail(bundleIssue);
  const fingerprint = longwoodProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed Longwood source tree, source refs, constraints, or accounting declarations changed');
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
            return fail('one or more projected Longwood course identities changed');
          }
        }
      }
    }
  }
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed Longwood 2026-2027 tree and six-role official source receipt match',
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

function ruleContainerIssue(kind, container, { document, path, constraint } = {}, paths = RULE_PATHS) {
  const expectedPath = paths[kind];
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

function groupConjunction(group) {
  return text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and';
}

function sectionUnits(section) {
  return number(section?.unit_advisement ?? section?.units);
}

function exactSingleReceiverSection(section, { units, kind, code = null, name = null } = {}) {
  const receivers = array(section?.receivers);
  const body = receiverBody(receivers[0]);
  return number(section?.section_advisement ?? section?.select) === 1
    && sectionUnits(section) === units
    && receivers.length === 1
    && text(body.kind)?.toLowerCase() === kind
    && number(body.units) === units
    && (code == null || receiverCodes(receivers[0])[0] === code)
    && (name == null || text(body.name) === name);
}

function variableCapacityProof(document) {
  const groups = Object.fromEntries(Object.entries(VARIABLE_GROUP_INDICES)
    .map(([name, index]) => [name, document?.requirement_groups?.[index]]));
  const expectedLengths = { global: 2, bs: 2, remainder: 3 };
  for (const [name, group] of Object.entries(groups)) {
    if (groupConjunction(group) !== 'or'
        || group?.canonical_section_index !== CANONICAL_SECTION_INDICES[VARIABLE_GROUP_INDICES[name]]
        || array(group?.sections).length !== expectedLengths[name]) {
      return fail(`the Longwood ${name} variable-credit choice shape changed`);
    }
  }
  const unitRows = {
    global: array(groups.global.sections).map(sectionUnits),
    bs: array(groups.bs.sections).map(sectionUnits),
    remainder: array(groups.remainder.sections).map(sectionUnits),
  };
  if (JSON.stringify(unitRows) !== JSON.stringify({
    global: [3, 4], bs: [3, 4], remainder: [21, 20, 19],
  })) return fail('the Longwood variable-credit or compensating-elective units changed');
  for (const row of VARIABLE_UNIT_MATRIX) {
    const actual = [
      unitRows.global[row.global], unitRows.bs[row.bs], unitRows.remainder[row.remainder],
    ];
    if (JSON.stringify(actual) !== JSON.stringify(row.units)
        || actual.reduce((sum, value) => sum + value, 0) !== 27) {
      return fail('a Longwood 3/4-credit route no longer has its exact compensating remainder');
    }
  }
  const audit = document?.unit_audit || {};
  const canonical = audit.canonical_path || {};
  if (number(audit.graduation_minimum) !== 120
      || number(audit.modeled_units) !== 120
      || number(canonical.civitae_units) !== 39
      || number(canonical.major_units_after_math_171_overlap) !== 45
      || number(canonical.bs_additional_units) !== 3
      || number(canonical.general_elective_units) !== 33
      || number(canonical.total_units) !== 120) {
    return fail('the Longwood canonical 120-credit accounting path changed');
  }
  return {
    supported: true,
    canonical_group_section_indices: { ...CANONICAL_SECTION_INDICES },
    route_units: VARIABLE_UNIT_MATRIX.map((row) => [...row.units]),
    invariant_variable_capacity_units: 27,
  };
}

function effectiveField(group, section, field) {
  return section?.[field] == null ? group?.[field] : section[field];
}

function exactUpperSection(
  document, groupIndex, sectionIndex, units, code = null, { requireNontransferableTier = true } = {},
) {
  const group = document?.requirement_groups?.[groupIndex];
  const section = group?.sections?.[sectionIndex];
  if (text(effectiveField(group, section, 'course_level')) !== 'upper_division'
      || (requireNontransferableTier
        && text(effectiveField(group, section, 'tier')) !== 'nontransferable')
      || effectiveField(group, section, 'cc_articulable') !== false
      || sectionUnits(section) !== units) return false;
  if (code == null) return true;
  return exactSingleReceiverSection(section, { units, kind: 'course', code });
}

function upperLevelProof(document) {
  const fixed = [
    { path: 'requirement_groups[8].sections[0]', units: 3, exact: exactUpperSection(document, 8, 0, 3, 'CTZN410') },
    { path: 'requirement_groups[9].sections[8]', units: 3, exact: exactUpperSection(document, 9, 8, 3, 'CMSC442', { requireNontransferableTier: false }) },
    { path: 'requirement_groups[9].sections[9]', units: 3, exact: exactUpperSection(document, 9, 9, 3, 'CMSC461', { requireNontransferableTier: false }) },
    { path: 'requirement_groups[9].sections[10]', units: 0, exact: exactUpperSection(document, 9, 10, 0, 'CMSC483', { requireNontransferableTier: false }) },
    { path: 'requirement_groups[9].sections[11]', units: 3, exact: exactUpperSection(document, 9, 11, 3, 'ENGL319', { requireNontransferableTier: false }) },
    { path: 'requirement_groups[11].sections[0]', units: 6, exact: exactUpperSection(document, 11, 0, 6) },
    { path: 'requirement_groups[15].sections[0]', units: 12, exact: exactUpperSection(document, 15, 0, 12) },
  ];
  if (fixed.some((row) => !row.exact)) {
    return fail('one or more Longwood canonical upper-level resident carriers changed');
  }
  const upper = document?.unit_audit?.upper_division || {};
  const modeled = fixed.reduce((sum, row) => sum + row.units, 0);
  if (text(upper.status)?.toLowerCase() !== 'required'
      || number(upper.minimum_units) !== 30
      || number(upper.modeled_units) !== 30
      || text(upper.rule) !== UPPER_DIVISION_RULE
      || JSON.stringify(array(upper.source_refs))
        !== JSON.stringify(['major', 'general_education', 'graduation'])
      || modeled !== 30) {
    return fail('the Longwood upper-level 30-credit accounting declaration changed');
  }
  return {
    supported: true,
    fixed_resident_upper_units: modeled,
    carriers: fixed.map(({ path, units }) => ({ path, units })),
  };
}

function prerequisiteGateProof(document) {
  const group = document?.requirement_groups?.[14];
  const sections = array(group?.sections);
  const math175 = document?.requirement_groups?.[10]?.sections?.[0];
  if (groupConjunction(group) !== 'or'
      || group?.canonical_section_index !== 0
      || sections.length !== 2
      || !exactSingleReceiverSection(sections[0], { units: 3, kind: 'course', code: 'MATH250' })
      || !exactSingleReceiverSection(sections[1], { units: 4, kind: 'course', code: 'MATH261' })
      || !exactSingleReceiverSection(math175, { units: 3, kind: 'course', code: 'MATH175' })) {
    return fail('the Longwood MATH 250/261 choice or fixed MATH 175 prerequisite carrier changed');
  }
  return {
    supported: true,
    selected_receiver_code: 'MATH250',
    selected_prerequisite_path: [...MATH250_PREREQUISITE_EVIDENCE.selected_path],
    prerequisite_evidence_sha256: MATH250_PREREQUISITE_EVIDENCE.source_content_sha256,
  };
}

function exactGeAreaSection(section, units, receiverCount = 1) {
  const receivers = array(section?.receivers);
  return number(section?.section_advisement ?? section?.select) === 1
    && sectionUnits(section) === units
    && receivers.length === receiverCount
    && receivers.every((receiver) => {
      const body = receiverBody(receiver);
      return text(body.kind)?.toLowerCase() === 'ge_area'
        && number(body.units) === units
        && receiverCodes(receiver).length <= 1;
    });
}

/**
 * The language-placement fact picks which already-authored Global Citizenship
 * route applies; it never creates a second requirement.  Both routes are one
 * GE vertex.  Their one-credit difference is exactly offset by the authored
 * 21/20/19-credit remainder matrix, so the paper's course/unit outputs are
 * invariant.  The canonical paper path selects the source-authored 3-credit
 * branch without asserting anything about an individual student's placement.
 */
function languagePlacementProof(document) {
  const variable = variableCapacityProof(document);
  if (!variable.supported) return variable;
  const group = document?.requirement_groups?.[3];
  const sections = array(group?.sections);
  if (groupConjunction(group) !== 'or'
      || group?.canonical_section_index !== 0
      || sections.length !== 2
      || !exactGeAreaSection(sections[0], 3)
      || !exactGeAreaSection(sections[1], 4)) {
    return fail('the Longwood language-placement alternatives no longer encode one exact 3- or 4-credit GE route');
  }
  return {
    supported: true,
    selected_section_index: 0,
    route_units: [3, 4],
    requirement_vertices_by_route: [1, 1],
    invariant_degree_units: 120,
    compensating_remainder_units: [21, 20, 19],
  };
}

function perspectivesSequenceProof(document) {
  const group = document?.requirement_groups?.[7];
  const sections = array(group?.sections);
  const symposium = document?.requirement_groups?.[8]?.sections?.[0];
  if (groupConjunction(group) !== 'and'
      || sections.length !== 4
      || sections.some((section, index) => !exactGeAreaSection(
        section, 3, index < 3 ? 2 : 1,
      ))
      || !exactSingleReceiverSection(symposium, {
        units: 3, kind: 'course', code: 'CTZN410',
      })) {
    return fail('the four Longwood Perspective slots or CTZN 410 carrier changed');
  }
  const perspectiveSlotKeys = sections.map((section, index) => (
    `slot:longwood-perspective:${index}`
  ));
  const conditionBindings = Object.fromEntries(
    CTZN410_SEQUENCE_EVIDENCE.conditions.map((condition, index) => [
      hash(condition),
      index === 0 ? perspectiveSlotKeys.slice(0, 3) : perspectiveSlotKeys.slice(3),
    ]),
  );
  return {
    supported: true,
    perspective_slot_keys: perspectiveSlotKeys,
    symposium_course_key: CTZN410_SEQUENCE_EVIDENCE.course_key,
    prerequisite_source_content_sha256:
      CTZN410_SEQUENCE_EVIDENCE.source_content_sha256,
    prerequisite_conditions: CTZN410_SEQUENCE_EVIDENCE.conditions,
    prerequisite_condition_bindings: conditionBindings,
    strictly_prior_slot_count: 3,
    prior_or_concurrent_slot_count: 1,
  };
}

function exactAggregateRequirementSection(section, units, expectedName) {
  return exactSingleReceiverSection(section, {
    units, kind: 'requirement', name: expectedName,
  });
}

function majorElectiveSelectionProof(document) {
  const upperSection = document?.requirement_groups?.[11]?.sections?.[0];
  const remainingSection = document?.requirement_groups?.[12]?.sections?.[0];
  const proficiencySection = document?.requirement_groups?.[13]?.sections?.[0];
  if (!exactAggregateRequirementSection(
    upperSection,
    6,
    'Six credits of distinct CMSC courses at the 300 level or above, excluding CMSC 350',
  ) || !exactAggregateRequirementSection(
    remainingSection,
    6,
    'Six additional credits of distinct CMSC courses at the 200 level or above, excluding CMSC 350',
  )) return fail('the Longwood authored 6+6 major-elective aggregate carriers changed');

  const proficiencyReceivers = array(proficiencySection?.receivers);
  if (number(proficiencySection?.section_advisement ?? proficiencySection?.select) !== 1
      || sectionUnits(proficiencySection) !== 0
      || proficiencyReceivers.length !== 3
      || JSON.stringify(proficiencyReceivers.map((receiver) => receiverCodes(receiver)[0]))
        !== JSON.stringify(['CMSC140', 'CMSC210', 'CMSC280'])
      || proficiencyReceivers.some((receiver) => (
        text(receiverBody(receiver).kind)?.toLowerCase() !== 'course'
        || number(receiverBody(receiver).units) !== 0
      ))) return fail('the Longwood zero-unit programming-proficiency overlay changed');

  const selectedCodes = MAJOR_ELECTIVE_SELECTION.map((row) => row.code);
  const selectedUnits = MAJOR_ELECTIVE_SELECTION.reduce((sum, row) => sum + row.units, 0);
  const upperUnits = MAJOR_ELECTIVE_SELECTION
    .filter((row) => row.course_level === 'upper_division')
    .reduce((sum, row) => sum + row.units, 0);
  if (new Set(selectedCodes).size !== 4
      || selectedUnits !== 12
      || upperUnits < 6
      || selectedCodes.includes('CMSC350')
      || MAJOR_ELECTIVE_SELECTION.some((row) => (
        !/^CMSC(?:2|3|4)\d{2}$/.test(row.code)
        || row.units !== 3
        || ![11, 12].includes(row.group_index)
        || array(row.current_civitae_designations).length
      ))) return fail('the retained deterministic Longwood elective route violates its 12-credit, level, exclusion, distinctness, or current-designation bounds');

  const fixedCoreCodes = new Set(
    [9, 10].flatMap((groupIndex) => array(document?.requirement_groups?.[groupIndex]?.sections))
      .flatMap((section) => array(section?.receivers))
      .flatMap(receiverCodes),
  );
  if (selectedCodes.some((code) => fixedCoreCodes.has(code))
      || MAJOR_ELECTIVE_SELECTION.some((row) => (
        !array(row.prerequisite_paths).some((path) => (
          JSON.stringify(path) === JSON.stringify(row.selected_prerequisite_path)
        ))
        || !array(row.selected_prerequisite_path).length
        || row.selected_prerequisite_path.some((code) => !fixedCoreCodes.has(code))
      ))) return fail('the deterministic Longwood elective route is no longer distinct from the fixed core or prerequisite-closed by it');

  if (!selectedCodes.includes('CMSC210')) {
    return fail('the selected Longwood route no longer absorbs the programming-proficiency overlay');
  }
  return {
    supported: true,
    selected_courses: MAJOR_ELECTIVE_SELECTION,
    selected_course_codes: selectedCodes,
    selected_units: selectedUnits,
    selected_upper_division_units: upperUnits,
    excluded_course_codes: ['CMSC350'],
    proficiency_course_code: 'CMSC210',
    proficiency_incremental_units: 0,
    source_response: CURRENT_CMSC_RESPONSE,
    current_designation_positive_control: CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL,
    selected_current_civitae_designations: [],
  };
}

/**
 * Prove that Civitae's category/distribution/single-count rules cannot change
 * Figures 3/4 on the selected paper path.  This does not claim Figure 6: the
 * four resident Perspective identities and their prerequisite formulas remain
 * mandatory inputs to that graph until the prerequisite publication boundary
 * carries them.
 */
function civitaeFigure34Proof(document, evidence = CIVITAE_FIGURE_34_EVIDENCE) {
  const exact = exactLongwoodTree(document);
  if (!exact.supported) return exact;
  if (hash(evidence) !== CIVITAE_FIGURE_34_EVIDENCE_SHA256) {
    return fail('the retained official Longwood Civitae Figure 3/4 evidence changed');
  }
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== 'longwood_2026_2027_civitae_figure_34_evidence'
      || evidence?.catalog_year !== CATALOG_YEAR
      || evidence?.institution?.slug !== SLUG
      || number(evidence?.institution?.school_id) !== SCHOOL_ID
      || JSON.stringify(evidence?.paper_scope?.figures_proven_zero_impact)
        !== JSON.stringify(['3', '4'])
      || JSON.stringify(evidence?.paper_scope?.figures_still_blocked)
        !== JSON.stringify(['6'])
      || evidence?.source_contract?.retained_general_education_sha256
        !== SOURCE_RECEIPTS.find((receipt) => receipt.id === 'general_education')?.sha256
      || evidence?.source_contract?.retained_program_sha256
        !== SOURCE_RECEIPTS.find((receipt) => receipt.id === 'major')?.sha256) {
    return fail('the Civitae evidence identity, catalog boundary, or retained source link changed');
  }

  const witness = evidence?.deterministic_witness || {};
  const expectedPillars = ['HIST150', 'PSYC230', 'RELI242', 'ART125', 'MATH171', 'ENSC162'];
  const expectedPerspectives = ['PSYC335', 'RELI301', 'MATH301', 'SPAN320'];
  const allCodes = [...expectedPillars, ...expectedPerspectives];
  if (JSON.stringify(witness.selected_pillar_codes) !== JSON.stringify(expectedPillars)
      || JSON.stringify(witness.selected_perspective_codes)
        !== JSON.stringify(expectedPerspectives)
      || JSON.stringify(witness.selected_course_codes) !== JSON.stringify(allCodes)
      || new Set(witness.selected_course_codes).size !== 10
      || JSON.stringify(witness.perspective_sacsco_witnesses) !== JSON.stringify({
        social_behavioral_science: 'PSYC335',
        humanities_fine_arts: 'RELI301',
        mathematics_natural_sciences: 'MATH301',
      })
      || JSON.stringify(witness.major_pillar_overlap_codes) !== JSON.stringify(['MATH171'])
      || array(witness.major_perspective_overlap_codes).length
      || array(witness.selected_current_major_elective_overlap_codes).length
      || number(witness.fixed_first_year_units) !== 6
      || number(witness.pillar_units) !== 18
      || number(witness.perspective_units) !== 12
      || number(witness.symposium_units) !== 3
      || number(witness.total_civitae_units) !== 39
      || number(witness.degree_total_units) !== 120
      || number(witness.additional_units_due_to_distribution_or_single_count) !== 0
      || number(witness.transferable_units_changed_by_resident_perspective_selection) !== 0) {
    return fail('the exact distinct 39-credit Civitae witness or its zero-transfer-impact arithmetic changed');
  }

  const selectedRows = array(witness.selected_courses);
  if (selectedRows.length !== 10 || selectedRows.some((row) => (
    !allCodes.includes(text(row?.code))
      || number(row?.units) !== 3
      || !/^https:\/\/catalog\.longwood\.edu\/ajax\/preview_course\.php\?catoid=19&coid=\d+$/.test(
        text(row?.official_url) || '',
      )
      || !/^[a-f0-9]{64}$/.test(text(row?.exact_entry_sha256) || '')
      || !text(row?.exact_entry_text)?.includes(`Fulfills Civitae Core ${row.designation}`)
  ))) return fail('one selected Civitae course lost its official identity, fixed units, or designation receipt');

  const programSources = array(evidence?.source_contract?.program_sources);
  if (programSources.length !== 12 || programSources.some((source) => (
    !/^https:\/\/catalog\.longwood\.edu\/ajax\/preview_program\.php\?catoid=19&poid=\d+$/.test(
      text(source?.official_url) || '',
    )
      || !/^[a-f0-9]{64}$/.test(text(source?.roster_sha256) || '')
      || !/^[a-f0-9]{64}$/.test(text(source?.child_programs_sha256) || '')
  ))) return fail('the complete official Civitae menu receipt inventory changed');

  const perspectives = perspectivesSequenceProof(document);
  const electives = majorElectiveSelectionProof(document);
  const variable = variableCapacityProof(document);
  if (!perspectives.supported || !electives.supported || !variable.supported) {
    return [perspectives, electives, variable].find((row) => !row.supported);
  }
  if (array(electives.selected_current_civitae_designations).length) {
    return fail('the selected major-elective route acquired a current Civitae designation');
  }

  return {
    supported: true,
    evaluator: 'civitaeFigure34Proof',
    reason: 'four distinct, fixed three-credit resident Perspectives satisfy every SACSCOC distribution category, while six distinct fixed Pillars and the exact MATH 171 overlap close Civitae at 39 credits; the Figure 3/4 allocator already spends unique sending credits and Perspectives cannot transfer or be waived',
    proof: {
      evidence_sha256: CIVITAE_FIGURE_34_EVIDENCE_SHA256,
      catalog_id: evidence.source_contract.catalog_id,
      official_program_receipts: programSources.length,
      selected_pillar_codes: [...witness.selected_pillar_codes],
      selected_perspective_codes: [...witness.selected_perspective_codes],
      perspective_sacsco_witnesses: { ...witness.perspective_sacsco_witnesses },
      cross_listed_course_requirement_maximum:
        evidence.rules.cross_listed_course_requirement_maximum,
      selected_major_pillar_overlap_codes: [...witness.major_pillar_overlap_codes],
      selected_major_perspective_overlap_codes: [],
      selected_current_major_elective_overlap_codes: [],
      resident_perspective_units: witness.perspective_units,
      total_civitae_units: witness.total_civitae_units,
      degree_total_units: witness.degree_total_units,
      additional_units: 0,
      transferable_units_changed: 0,
      figures_proven_zero_impact: ['3', '4'],
      figure_6_blocker: evidence.paper_scope.reason_figure_6_remains_blocked,
    },
  };
}

function virtualCourseReceiver(row, style) {
  if (style === 'composition') {
    return {
      kind: 'course', code: row.code, title: row.title, units: row.units,
    };
  }
  return {
    articulation_status: null,
    not_articulated_reason: null,
    options: [],
    options_conjunction: 'or',
    hash_id: null,
    tier: null,
    course_level: null,
    cc_articulable: null,
    overlap_key: null,
    note: null,
    receiving: {
      kind: 'course', parent_id: courseIdFor(row.code), code: row.code,
      title: row.title, units: row.units,
    },
    code_seen: row.code,
    human_review: null,
  };
}

/**
 * Runtime-only exact projection of one legal course selection.  It leaves the
 * authored open-menu source intact, while giving every paper reader the same
 * four identities, the same overlap decision, and the same sequence slots.
 */
function longwoodFigureSelection(document) {
  const exact = exactLongwoodTree(document);
  if (!exact.supported) return { ready: false, institution: SLUG, reason: exact.reason };
  const language = languagePlacementProof(document);
  const perspectives = perspectivesSequenceProof(document);
  const electives = majorElectiveSelectionProof(document);
  const civitae = civitaeFigure34Proof(document);
  if (!language.supported || !perspectives.supported
      || !electives.supported || !civitae.supported) {
    const failed = [language, perspectives, electives, civitae]
      .find((row) => !row.supported);
    return { ready: false, institution: SLUG, reason: failed.reason };
  }
  const style = documentStyle(document);
  const virtualSections = {};
  for (const groupIndex of [11, 12]) {
    const sourceSection = document.requirement_groups[groupIndex].sections[0];
    const rows = MAJOR_ELECTIVE_SELECTION.filter((row) => row.group_index === groupIndex);
    virtualSections[`${groupIndex}:0`] = {
      ...sourceSection,
      ...(style === 'composition'
        ? { select: 2, units: 6 }
        : { section_advisement: 2, unit_advisement: 6, unit_advisement_max: 6 }),
      receivers: rows.map((row) => virtualCourseReceiver(row, style)),
    };
  }
  const perspectiveCourseCodes = [
    ...civitae.proof.selected_perspective_codes,
  ];
  const perspectiveCourseKeys = perspectiveCourseCodes.map(
    (code) => `va:uni:${SCHOOL_ID}:${code}`,
  );
  const perspectiveConditionBindings = Object.fromEntries(
    CTZN410_SEQUENCE_EVIDENCE.conditions.map((condition, index) => [
      hash(condition),
      index === 0 ? perspectiveCourseKeys.slice(0, 3) : perspectiveCourseKeys.slice(3),
    ]),
  );
  return {
    ready: true,
    institution: SLUG,
    group_section_indices: { ...CANONICAL_SECTION_INDICES },
    virtual_sections: virtualSections,
    section_receiver_indices: { '13:0': [1] },
    selected_course_codes: [...electives.selected_course_codes],
    selected_course_keys: electives.selected_course_codes.map(
      (code) => `va:uni:${SCHOOL_ID}:${code}`,
    ),
    proficiency_course_code: electives.proficiency_course_code,
    proficiency_overlay_section_key: '13:0',
    perspective_section_keys: ['7:0', '7:1', '7:2', '7:3'],
    selected_perspective_course_codes: perspectiveCourseCodes,
    selected_perspective_course_keys: perspectiveCourseKeys,
    symposium_course_key: perspectives.symposium_course_key,
    prerequisite_condition_bindings: {
      [perspectives.symposium_course_key]: {
        ...perspectiveConditionBindings,
      },
    },
    proof: {
      ...exact.proof,
      language,
      perspectives,
      electives,
      civitae,
    },
  };
}

function longwoodRuntimeSection(document, groupIndex, sectionIndex) {
  const selection = longwoodFigureSelection(document);
  if (!selection.ready) return null;
  return selection.virtual_sections[`${groupIndex}:${sectionIndex}`]
    || document?.requirement_groups?.[groupIndex]?.sections?.[sectionIndex]
    || null;
}

function evaluateLongwoodConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (!RULE_PATHS[kind]) return fail('no exact Longwood evaluator handles this rule');
  const exact = exactLongwoodTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context);
  if (issue) return fail(issue);

  if (kind === 'dependent_elective_capacity') {
    const proof = variableCapacityProof(context.document);
    if (!proof.supported) return proof;
    return {
      ...exact,
      reason: 'the complete 3/4 by 3/4 choice matrix preserves 27 variable credits, and every shared reader selects the exact 3+3+21 canonical branch',
      proof: { ...exact.proof, rule_path: context.path, ...proof },
    };
  }
  if (kind === 'upper_level_distribution_across_degree') {
    const proof = upperLevelProof(context.document);
    if (!proof.supported) return proof;
    return {
      ...exact,
      reason: 'the canonical tree fixes 30 nontransferable upper-level Longwood credits across exact 3+9+6+12 carriers',
      proof: { ...exact.proof, rule_path: context.path, ...proof },
    };
  }
  if (kind === 'prerequisite_gate') {
    const proof = prerequisiteGateProof(context.document);
    if (!proof.supported) return proof;
    return {
      ...exact,
      reason: 'the exact canonical MATH 250 branch uses its published MATH 175 prerequisite path, and MATH 175 is already fixed in the degree tree',
      proof: { ...exact.proof, rule_path: context.path, ...proof },
    };
  }
  if (kind === 'language_placement_route') {
    const proof = languagePlacementProof(context.document);
    if (!proof.supported) return proof;
    return {
      ...exact,
      reason: 'both authored placement routes are one GE requirement vertex and the exact 3/4-credit branch matrix compensates every unit difference back to 120; the paper path selects the authored three-credit branch without inferring student placement',
      proof: { ...exact.proof, rule_path: context.path, ...proof },
    };
  }
  if (kind === 'perspectives_sequence') {
    const proof = perspectivesSequenceProof(context.document);
    if (!proof.supported) return proof;
    return {
      ...exact,
      reason: 'the exact retained CTZN 410 formula binds three prior Perspective slots plus the fourth prior-or-concurrent slot; no course identity is invented for the four open GE selections',
      proof: { ...exact.proof, rule_path: context.path, ...proof },
    };
  }
  if (kind === 'civitae_single_count_and_distribution') {
    const proof = civitaeFigure34Proof(context.document);
    if (!proof.supported) return proof;
    return {
      supported: false,
      paper_impact_proven: true,
      reason: 'the exact official Civitae witness proves zero Figures 3/4 course-or-credit impact, but Figure 6 remains fail-closed until its four selected resident Perspective formulas pass the university prerequisite publication boundary',
      proof: {
        ...exact.proof,
        rule_path: context.path,
        ...proof.proof,
      },
    };
  }
  const proof = majorElectiveSelectionProof(context.document);
  if (!proof.supported) return proof;
  const reasons = {
    course_level_menu_and_exclusion:
      'the exact current first-party roster supplies CMSC 415 and CMSC 455 as two distinct fixed three-credit upper-level courses, neither CMSC 350, with prerequisites already in the fixed core',
    distinct_course_and_exclusion_pool:
      'the deterministic four-course route totals 12 fixed credits, uses four distinct CMSC 200+-level identities, excludes CMSC 350, and retains nine upper-level credits',
    major_elective_overlap:
      'CMSC 210 is selected once inside the 12-credit elective budget and satisfies the exact zero-increment programming-proficiency overlay through its fixed-core CMSC 160 prerequisite path',
    future_civitae_major_overlap:
      'the selected current course-entry boundaries carry no Civitae designation while the same complete response positively emits designation tokens on CMSC 140; the selected snapshot has zero major/Civitae overlap and preserves the exact 120-credit remainder',
  };
  return {
    ...exact,
    reason: reasons[kind],
    proof: { ...exact.proof, rule_path: context.path, ...proof },
  };
}

function longwoodSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  if (!FIGURE_ONE_INVARIANT_PATHS[kind]) return null;
  const exact = exactLongwoodTree(context.document);
  if (!exact.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  }, FIGURE_ONE_INVARIANT_PATHS)) return null;
  if (kind === 'civitae_single_count_and_distribution') {
    return civitaeFigure34Proof(context.document).supported ? ['6'] : null;
  }
  // Figure 1 excludes GE and elective-capacity observations. Placement changes
  // one GE route's credits, Civitae distribution constrains only GE choices,
  // and future Civitae designations reallocate GE/elective capacity without
  // changing the already-authored named major-course population. Their course
  // identity/credit effects remain blocking in Figures 3/4/6.
  return ['3', '4', '6'];
}

function longwoodQualityFlagAffectedFigures(flag, document) {
  if (text(flag?.code) !== 'civitae_attribute_and_distribution_dependency') return null;
  return civitaeFigure34Proof(document).supported ? ['6'] : null;
}

function evaluateLongwoodResidencyPolicy(document) {
  const exact = exactLongwoodTree(document);
  if (!exact.supported) return null;
  const upper = upperLevelProof(document);
  if (!upper.supported) return null;
  const residency = document?.unit_audit?.residency || {};
  if (text(residency.status)?.toLowerCase() !== 'required'
      || number(residency.minimum_units) !== 30
      || number(residency.minimum_fraction) !== 0.25
      || text(residency.rule) !== RESIDENCY_RULE
      || JSON.stringify(array(residency.source_refs)) !== JSON.stringify(['graduation'])) return null;
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
    source_policy_id: SLUG,
    declared_subrules: ['overall_residency', 'upper_division_residency_minimum'],
    evaluator: 'evaluateLongwoodResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the two-year pathway is capped at 90 credits and the exact canonical tree fixes all 30 required upper-level resident credits as nonarticulable or nontransferable',
    issues: [],
    proof: {
      ...exact.proof,
      ...upper,
      residency_minimum_fraction: 0.25,
      international_exchange_exception_selected: false,
    },
  };
}

module.exports = {
  CIVITAE_FIGURE_34_EVIDENCE,
  CIVITAE_FIGURE_34_EVIDENCE_SHA256,
  CTZN410_SEQUENCE_EVIDENCE,
  CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL,
  CURRENT_CMSC_RESPONSE,
  MAJOR_ELECTIVE_SELECTION,
  MATH250_PREREQUISITE_EVIDENCE,
  SELECTED_MAJOR_ELECTIVE_CODES,
  SOURCE_BUNDLE_SHA256,
  SOURCE_RECEIPTS,
  civitaeFigure34Proof,
  evaluateLongwoodConstraint,
  evaluateLongwoodResidencyPolicy,
  exactLongwoodTree,
  languagePlacementProof,
  longwoodFigureSelection,
  longwoodProofTreeFingerprint,
  longwoodQualityFlagAffectedFigures,
  longwoodRuntimeSection,
  longwoodSourceSpecificAffectedFigures,
  majorElectiveSelectionProof,
  normalizedLongwoodProofTree,
  perspectivesSequenceProof,
  upperLevelProof,
  variableCapacityProof,
};
