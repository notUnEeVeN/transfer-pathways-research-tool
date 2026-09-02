/**
 * Standalone evidence for the prerequisite rows that remain after the two
 * existing tail contracts are removed from the finite university audit.
 *
 * This module is intentionally not wired into the shared review. It replays
 * retained official bytes, exact entry boundaries, and marker controls. Seven
 * VCU population/enrollment rows have zero course-edge effect for Figure 6.
 * Three exact formulas are preserved, but remain runtime-blocked; neither a
 * missing closure row nor an unbound placement alternative is erased.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  BROWSER_CHALLENGE_CONTRACT,
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  catalogYearSeen,
  extractCourseLeafEntries,
  requisiteMarkerCounts,
  validateBrowserChallengeReceipt,
  validateBrowserRobotsReceipt,
} = require('./universityPrerequisiteAcquisition');
const {
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
  LONGWOOD_BANNER_URL,
  extractLongwoodBannerEntries,
} = require('./longwoodBannerCourseAcquisition');
const {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CATALOG_YEAR,
  RADFORD_PROGRAM_CACHE_PATH,
  RADFORD_PROGRAM_HTML_SHA256,
  extractRadfordCourseEntry,
  verifyRadfordProgramDiscovery,
} = require('./radfordAcalogPrerequisiteAcquisition');
const {
  CONTRACT: VCU_SOURCE_CONTRACT,
  PAGES: VCU_PAGES,
  ROWS: VCU_ROWS,
} = require('./vcuPrerequisiteClosureEvidence');
const {
  CONTRACT: UNIVERSITY_TAIL_CONTRACT,
  DECISIONS: UNIVERSITY_TAIL_DECISIONS,
  EXPECTED_FACTS_SHA256: UNIVERSITY_TAIL_FACTS_SHA256,
  SOURCES: UNIVERSITY_TAIL_SOURCES,
} = require('./universityPrerequisiteTailClosureEvidence');
const {
  CONTRACT: RADFORD_RMC_TAIL_CONTRACT,
  EXPECTED_FACTS_SHA256: RADFORD_RMC_TAIL_FACTS_SHA256,
} = require('./radfordRandolphMaconPrerequisiteTailEvidence');
const {
  CONTRACT: SMALL_UNIVERSITY_CONTRACT,
  DECISIONS: SMALL_UNIVERSITY_DECISIONS,
} = require('./smallUniversityPrerequisiteClosureEvidence');
const {
  CONTRACT: VIRGINIA_TECH_RECURSIVE_CONTRACT,
  EXACT_STATEMENTS: VIRGINIA_TECH_EXACT_STATEMENTS,
} = require('./virginiaTechRecursivePrerequisiteClosureEvidence');

const ARTIFACT = 'va_remaining_university_prerequisite_closure_evidence';
const CONTRACT = 'va_residual_exact_prerequisite_formula_and_zero_course_edge_v1';
const FORMULA = 'paths_or__conditions_and';
const CATALOG_YEAR = '2026-2027';
const CACHE_ROOT = path.resolve(__dirname, '../../.va-catalogs');
const EVIDENCE_PATH = path.join(
  CACHE_ROOT,
  'research/va-remaining-university-prerequisite-closure-evidence.json',
);

// Filled after replaying the retained bytes. The artifact cannot be changed
// independently of this code pin.
const EXPECTED_FACTS_SHA256 =
  'f2f9e8fd4e11d005813cec8bade78b5facc11af86eef908e57fdad233563763b';

const CANDIDATE_PATH = 'research/va-university-prerequisite-candidates.json';
const FIGURE6_ZERO_EDGE_REASON =
  'exact_noncourse_population_or_enrollment_signal_has_zero_figure6_course_edge_effect';
const FORMULA_REVIEW_REASON =
  'exact_source_formula_preserved_but_recursive_or_noncourse_runtime_blocked';

const sha256 = (value) => crypto.createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || '')))
  .digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

function assertExact(condition, label) {
  if (!condition) throw new Error(label);
}

function absoluteCachePath(relative) {
  const resolved = path.resolve(CACHE_ROOT, relative);
  if (!resolved.startsWith(`${CACHE_ROOT}${path.sep}`)) {
    throw new Error(`unsafe cache path: ${relative}`);
  }
  return resolved;
}

function defaultReadFile(relative) {
  return fs.readFileSync(absoluteCachePath(relative));
}

function readJson(readFile, relative) {
  return JSON.parse(readFile(relative).toString('utf8'));
}

const course = (code, raw, extra = {}) => Object.freeze({
  type: 'course', code, raw, ...extra,
});
const nonCourse = (condition, raw, extra = {}) => Object.freeze({
  type: 'non_course', condition, raw, ...extra,
});
const group = (raw, paths, extra = {}) => Object.freeze({
  kind: 'prerequisite', raw,
  paths: Object.freeze(paths.map((row) => Object.freeze(row))),
  ...extra,
});

const VCU_ZERO_EDGE_CODES = Object.freeze([
  'CLSE101',
  'EGRE101',
  'ENGR395',
  'HONR230',
  'HONR240',
  'UNIV101',
  'UNIV191',
]);

const FORMULA_TARGETS = Object.freeze({
  'va:uni:9213:MATH233': Object.freeze({
    school_id: 9213,
    slug: 'james-madison-university',
    owner_namespace: 'va:uni:9213',
    course_code: 'MATH233',
    scope_role: 'induced_recursive_closure',
    source_kind: 'courseleaf',
    source_id: 'jmu_math',
    raw_requisites:
      'Prerequisites: MATH 155 or MATH 156 or Appropriate Placement Score.',
    groups: Object.freeze([group(
      'MATH 155 or MATH 156 or Appropriate Placement Score.',
      [
        [course('MATH155', 'MATH 155')],
        [course('MATH156', 'MATH 156')],
        [nonCourse(
          'appropriate_jmu_math_placement_score',
          'Appropriate Placement Score',
          {
            placement_domain: 'mathematics',
            appropriate_score_required: true,
            threshold_published: false,
          },
        )],
      ],
      {
        statement_raw:
          'Prerequisites: MATH 155 or MATH 156 or Appropriate Placement Score.',
        grammar: 'exact_three_way_course_course_or_placement_score',
      },
    )]),
    signals: Object.freeze([Object.freeze({
      kind: 'prior_credit_exclusion',
      raw:
        'Not open to students who have already earned credit for MATH 232 or MATH 235.',
      excluded_course_codes: Object.freeze(['MATH232', 'MATH235']),
      figure6_course_edge_effect: false,
    })]),
    runtime_blockers: Object.freeze([
      'non_course_condition_binding_required',
    ]),
    expected_entry: Object.freeze({
      courseblock_index: 20,
      raw_entry_sha256:
        '21b9537ca68d2dd1aceda2c0d0ad84311eb3178ff0b79f21f0e47fdc934ee79b',
      raw_entry_html_sha256:
        '1780b82ac17a9241052f0066362d0514d2290cd0565af94f248b04855a27d335',
      structured_field_sha256:
        'b3e923d3cd4baac2209b34e56e732b22f9c9b76694ce3f3ef693c58bbd13e303',
    }),
  }),
  'va:uni:9214:SPAN212': Object.freeze({
    school_id: 9214,
    slug: 'longwood-university',
    owner_namespace: 'va:uni:9214',
    course_code: 'SPAN212',
    scope_role: 'recursive_closure',
    source_kind: 'longwood_banner',
    source_id: 'longwood_banner',
    raw_requisites:
      'Prerequisite: SPAN 211 or an appropriate placement score.',
    groups: Object.freeze([group(
      'SPAN 211 or an appropriate placement score.',
      [
        [course('SPAN211', 'SPAN 211')],
        [nonCourse(
          'appropriate_spanish_placement_score',
          'an appropriate placement score',
          {
            placement_domain: 'spanish',
            appropriate_score_required: true,
            threshold_published: false,
          },
        )],
      ],
      {
        statement_raw:
          'Prerequisite: SPAN 211 or an appropriate placement score.',
        grammar: 'exact_course_or_placement_score',
      },
    )]),
    signals: Object.freeze([]),
    runtime_blockers: Object.freeze([
      'recursive_reference_formula_ambiguous',
      'non_course_condition_binding_required',
    ]),
    expected_entry: Object.freeze({
      raw_entry_sha256:
        '042e3a8025c9ffc3764713d8c2c627a5bb020467e0f93c31a6e46b2692b70452',
      raw_entry_html_sha256:
        '3fcf1af468c61622834ee3aaa24d128fad0ea72691a27c0205d52dbb2aaa9450',
    }),
  }),
  'va:uni:9219:CS322': Object.freeze({
    school_id: 9219,
    slug: 'radford-university',
    owner_namespace: 'va:uni:9219',
    course_code: 'CS322',
    scope_role: 'direct_remediation',
    source_kind: 'radford',
    source_id: 'radford_cs322',
    raw_requisites:
      'Prerequisites: CS 220 (Grade of “C” or better) and MATH 171 , MATH 169 , or MATH 151 .',
    groups: Object.freeze([group(
      'CS 220 (Grade of “C” or better) and MATH 171 , MATH 169 , or MATH 151 .',
      [
        [
          course('CS220', 'CS 220', { minimum_grade: 'C' }),
          course('MATH171', 'MATH 171'),
        ],
        [
          course('CS220', 'CS 220', { minimum_grade: 'C' }),
          course('MATH169', 'MATH 169'),
        ],
        [
          course('CS220', 'CS 220', { minimum_grade: 'C' }),
          course('MATH151', 'MATH 151'),
        ],
      ],
      {
        statement_raw:
          'Prerequisites: CS 220 (Grade of “C” or better) and MATH 171 , MATH 169 , or MATH 151 .',
        grammar: 'exact_common_course_and_three_math_alternatives',
        grade_scope: 'parenthetical_grade_attaches_only_to_cs220',
      },
    )]),
    signals: Object.freeze([]),
    runtime_blockers: Object.freeze([
      'recursive_reference_missing_exact_entry',
    ]),
    expected_entry: Object.freeze({
      raw_entry_sha256:
        'a43ab5b50c8e64f7ed7e2d5cc8ebe22e4c201489640624c839371d69182f5b24',
      raw_entry_html_sha256:
        '5ab2cb5cc47e41b9ba1efd0f33b2f06afeaee613c5472a8dd0da27918c30f3e6',
      required_clause_sha256:
        '7ad66cfbe703575c2fc8c303a41e4e2aaba08d8190ea34391b9a885bc63a8cb2',
    }),
  }),
});

const TARGET_KEYS = Object.freeze([
  ...Object.keys(FORMULA_TARGETS),
  ...VCU_ZERO_EDGE_CODES.map((code) => `va:uni:9229:${code}`),
].sort());

const NEW_BLOCKED_REFERENCES = Object.freeze([
  Object.freeze({
    required_by_course_key: 'va:uni:9219:CS322',
    course_key: 'va:uni:9219:MATH151',
    course_code: 'MATH151',
    blocker: 'no_retained_exact_owner_course_entry',
    formula_rewritten_or_dropped: false,
  }),
  Object.freeze({
    required_by_course_key: 'va:uni:9214:SPAN212',
    course_key: 'va:uni:9214:SPAN211',
    course_code: 'SPAN211',
    blocker: 'implicit_comma_boolean_formula_not_source_grouped',
    exact_source_raw:
      'Prerequisites: SPAN 111, SPAN 210 or an appropriate placement score.',
    formula_rewritten_or_dropped: false,
  }),
]);

const EXISTING_CONTRACT_ACCOUNTING = Object.freeze({
  university_tail: Object.freeze({
    contract: UNIVERSITY_TAIL_CONTRACT,
    facts_sha256: UNIVERSITY_TAIL_FACTS_SHA256,
    excluded_course_keys: Object.freeze([
      'va:uni:9213:MATH234',
      'va:uni:9218:MATH100',
      'va:uni:9233:CSCI141L',
    ]),
  }),
  radford_randolph_macon_tail: Object.freeze({
    contract: RADFORD_RMC_TAIL_CONTRACT,
    facts_sha256: RADFORD_RMC_TAIL_FACTS_SHA256,
    excluded_course_keys: Object.freeze([
      'va:uni:9219:ENGL111',
      'va:uni:9221:CSCI111',
      'va:uni:9221:CSCI382',
      'va:uni:9221:CSEC121',
      'va:uni:9221:ENGL185',
      'va:uni:9221:MATH131',
    ]),
  }),
});

const CONFLICT_RECONCILIATIONS = Object.freeze([
  Object.freeze({
    course_key: 'va:uni:9230:CHEM1014',
    owner_contract: VIRGINIA_TECH_RECURSIVE_CONTRACT,
    raw: VIRGINIA_TECH_EXACT_STATEMENTS.CHEM1014.raw,
    disposition: 'blocked_underspecified_required_knowledge',
    policy_comparison:
      'Unlike a population restriction, the statement expressly requires prior knowledge but publishes no satisfying course, assessment, or threshold. It cannot become a zero-edge none row.',
  }),
  Object.freeze({
    course_key: 'va:uni:9233:MATH111',
    owner_contract: SMALL_UNIVERSITY_CONTRACT,
    raw: SMALL_UNIVERSITY_DECISIONS['william-mary:MATH111'].signals[1].raw,
    disposition: 'blocked_unnamed_required_lab_corequisite',
    policy_comparison:
      'Unlike an integrated activity description, the statement expressly requires concurrent lab enrollment but does not publish a bounded course identity. No lab code may be invented.',
  }),
]);

function metadataPath(htmlPath) {
  return htmlPath.replace(/\.html$/, '.json');
}

function verifyReceiptCacheRows(readFile, receipt) {
  for (const row of asArray(receipt?.document_responses)) {
    const bytes = readFile(row.cache_path);
    assertExact(bytes.length === row.byte_length, `${row.cache_path}:receipt_bytes`);
    assertExact(sha256(bytes) === row.content_sha256,
      `${row.cache_path}:receipt_sha256`);
  }
}

function verifyRetainedHtmlSource(readFile, page, { browserChallenge = false } = {}) {
  const bytes = readFile(page.cache_path);
  const metadata = readJson(readFile, metadataPath(page.cache_path));
  assertExact(bytes.length === page.source_response_bytes, `${page.cache_path}:source_bytes`);
  assertExact(sha256(bytes) === page.source_response_sha256,
    `${page.cache_path}:source_sha256`);
  assertExact(metadata.requested_url === page.official_url,
    `${page.cache_path}:requested_url`);
  assertExact(metadata.final_url === page.official_url,
    `${page.cache_path}:final_url`);
  assertExact(metadata.byte_length === page.source_response_bytes,
    `${page.cache_path}:metadata_bytes`);
  assertExact(metadata.content_sha256 === page.source_response_sha256,
    `${page.cache_path}:metadata_sha256`);
  assertExact(String(metadata.content_type || '').toLowerCase().includes('text/html'),
    `${page.cache_path}:content_type`);
  if (browserChallenge) {
    const document = validateBrowserChallengeReceipt(
      metadata.browser_challenge_receipt,
      {
        expectedUrl: page.official_url,
        expectedFinalContentType: 'text/html',
        expectedFinalSha256: page.source_response_sha256,
        expectedContract: BROWSER_CHALLENGE_CONTRACT,
      },
    );
    const robots = validateBrowserRobotsReceipt(metadata.robots_receipt, {
      origin: new URL(page.official_url).origin,
      checkedPath: new URL(page.official_url).pathname,
    });
    assertExact(document.valid, `${page.cache_path}:browser_receipt`);
    assertExact(robots.valid, `${page.cache_path}:robots_receipt`);
    verifyReceiptCacheRows(readFile, metadata.browser_challenge_receipt);
    verifyReceiptCacheRows(readFile, metadata.robots_receipt?.capture);
  } else {
    assertExact(metadata.capture_status === 'official_html_captured',
      `${page.cache_path}:capture_status`);
    assertExact(metadata.http_status === 200, `${page.cache_path}:http_status`);
    const host = new URL(page.official_url).hostname.toLowerCase();
    const robotsPath = `university-prerequisites/raw/_robots/${host}.txt`;
    const robotsBytes = readFile(robotsPath);
    assertExact(metadata.robots?.http_status === 200,
      `${page.cache_path}:robots_status`);
    assertExact(sha256(robotsBytes) === metadata.robots?.content_sha256,
      `${page.cache_path}:robots_sha256`);
  }
  return { bytes, metadata };
}

function exactSpan(text, raw, label) {
  const first = String(text || '').indexOf(raw);
  assertExact(first >= 0, `${label}:missing`);
  assertExact(String(text).indexOf(raw, first + raw.length) < 0, `${label}:not_unique`);
  return {
    raw,
    raw_sha256: sha256(raw),
    relative_start: first,
    relative_end: first + raw.length,
    source_content_preserved: true,
  };
}

function candidateMap(readFile) {
  const artifact = readJson(readFile, CANDIDATE_PATH);
  assertExact(artifact?.artifact === 'virginia_figure6_university_prerequisite_entry_candidates',
    'candidate_artifact');
  const candidates = asArray(artifact.candidates);
  const byKey = new Map();
  for (const candidate of candidates) {
    assertExact(!byKey.has(candidate.course_key), `duplicate_candidate:${candidate.course_key}`);
    byKey.set(candidate.course_key, candidate);
  }
  return byKey;
}

function candidateEntryIssues(candidate, target, entry, page) {
  const source = candidate?.source || {};
  const issues = [];
  if (candidate?.school_id !== target.school_id
      || candidate?.slug !== target.slug
      || candidate?.owner_namespace !== target.owner_namespace
      || candidate?.course_code !== target.course_code
      || candidate?.course_key !== `${target.owner_namespace}:${target.course_code}`) {
    issues.push('identity');
  }
  if (candidate?.row_status !== 'candidate_review_required'
      || candidate?.formula_status !== 'unparsed_review_required') issues.push('candidate_status');
  if (source.official_url !== page.official_url
      || source.cache_path !== page.cache_path
      || source.source_response_sha256 !== page.source_response_sha256
      || source.source_response_bytes !== page.source_response_bytes
      || source.raw_entry_sha256 !== entry.raw_entry_sha256
      || source.raw_entry_html_sha256 !== entry.raw_entry_html_sha256
      || source.raw_entry_text !== entry.raw_entry_text
      || source.character_start !== 0
      || source.character_end !== entry.raw_entry_text.length) issues.push('source_projection');
  if (source.boundary_contract !== page.boundary_contract) issues.push('boundary_contract');
  if (page.catalog_year && source.catalog_year_verified !== page.catalog_year) {
    issues.push('catalog_year');
  }
  if (entry.complete_entry_receipt
      && !same(source.complete_entry_receipt, entry.complete_entry_receipt)) {
    issues.push('marker_receipt');
  }
  if (entry.structured_requisite_fields
      && !same(source.structured_requisite_fields, entry.structured_requisite_fields)) {
    issues.push('structured_requisite_fields');
  }
  return issues;
}

function sourceFact(page, extraction, extra = {}) {
  return {
    official_url: page.official_url,
    cache_path: page.cache_path,
    source_response_sha256: page.source_response_sha256,
    source_response_bytes: page.source_response_bytes,
    boundary_contract: page.boundary_contract,
    catalog_year: page.catalog_year || null,
    source_courseblock_count: extraction?.courseblock_count ?? null,
    source_complete_entry_count: extraction?.complete_entry_count ?? null,
    source_positive_count:
      extraction?.complete_entries_with_required_requisite_marker_count ?? null,
    ...extra,
  };
}

function vcuSignalDisposition(signal) {
  const classifications = {
    class_enrollment_restriction: 'population_enrollment_restriction_zero_course_edge',
    descriptive_internship_requirements_phrase: 'course_description_zero_course_edge',
    honors_attribute_enrollment_restriction:
      'population_enrollment_restriction_zero_course_edge',
    program_and_class_enrollment_prerequisite:
      'population_enrollment_restriction_zero_course_edge',
    program_enrollment_restriction: 'population_enrollment_restriction_zero_course_edge',
    repeat_credit_limit: 'negative_credit_rule_zero_course_edge',
  };
  const classification = classifications[signal.kind];
  assertExact(Boolean(classification), `unclassified_vcu_signal:${signal.kind}`);
  return {
    ...signal,
    classification,
    incoming_course_edge: false,
    figure6_h_g_effect: false,
  };
}

function buildVcuRows(readFile, candidates) {
  const rows = [];
  const sourcePages = {};
  const codesByPage = new Map();
  for (const code of VCU_ZERO_EDGE_CODES) {
    const expected = VCU_ROWS[code];
    assertExact(expected?.blocker === 'vcu_enrollment_condition_requires_explicit_figure6_model',
      `${code}:expected_residual_vcu_blocker`);
    const codes = codesByPage.get(expected.page) || [];
    codes.push(code);
    codesByPage.set(expected.page, codes);
  }
  for (const [pageId, codes] of codesByPage.entries()) {
    const page = {
      ...VCU_PAGES[pageId],
      catalog_year: CATALOG_YEAR,
      boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
    };
    const { bytes } = verifyRetainedHtmlSource(readFile, page);
    const html = bytes.toString('utf8');
    assertExact(catalogYearSeen(html, CATALOG_YEAR), `${pageId}:catalog_year`);
    const extraction = extractCourseLeafEntries(html, codes);
    assertExact(!extraction.missing.length && !extraction.ambiguous.length,
      `${pageId}:target_inventory`);
    assertExact(extraction.courseblock_count === page.source_courseblock_count
      && extraction.complete_entry_count === page.source_complete_entry_count
      && extraction.complete_entries_with_required_requisite_marker_count
        === page.source_positive_count,
    `${pageId}:population_control`);
    sourcePages[`vcu_${pageId}`] = sourceFact(page, extraction, {
      same_source_positive_control: true,
      source_control_contract: VCU_SOURCE_CONTRACT,
    });
    const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
    for (const code of codes) {
      const expected = VCU_ROWS[code];
      const entry = byCode.get(code);
      assertExact(entry?.raw_entry_sha256 === expected.raw_entry_sha256,
        `${code}:raw_entry_sha256`);
      assertExact(entry?.raw_entry_html_sha256 === expected.raw_entry_html_sha256,
        `${code}:raw_entry_html_sha256`);
      assertExact(entry?.courseblock_index === expected.courseblock_index,
        `${code}:courseblock_index`);
      assertExact(same(entry?.published_units, expected.units), `${code}:published_units`);
      const markers = requisiteMarkerCounts(entry.raw_entry_text);
      assertExact(same([
        markers.required, markers.corequisite, markers.marker_like, markers.constraint_like,
      ], expected.marker_counts), `${code}:marker_counts`);
      assertExact(entry.complete_entry_receipt?.receipt_contract === COURSELEAF_RECEIPT_CONTRACT
        && entry.complete_entry_receipt?.same_source_positive_control === true,
      `${code}:positive_control`);
      const candidate = candidates.get(`va:uni:9229:${code}`);
      const candidateIssues = candidateEntryIssues(candidate, {
        school_id: 9229,
        slug: 'virginia-commonwealth-university',
        owner_namespace: 'va:uni:9229',
        course_code: code,
      }, entry, page);
      assertExact(!candidateIssues.length, `${code}:candidate:${candidateIssues.join(',')}`);
      const signals = expected.signals.map((signal, index) => {
        const typed = vcuSignalDisposition(signal);
        return { ...typed, ...exactSpan(entry.raw_entry_text, signal.raw, `${code}:signal:${index}`) };
      });
      rows.push({
        course_key: `va:uni:9229:${code}`,
        school_id: 9229,
        slug: 'virginia-commonwealth-university',
        owner_namespace: 'va:uni:9229',
        course_code: code,
        scope_role: expected.scope === 'direct'
          ? 'direct_remediation' : 'recursive_closure',
        disposition: 'safe_zero_course_edge',
        publication_status_recommendation: 'none',
        review_reason: FIGURE6_ZERO_EDGE_REASON,
        raw_requisites: null,
        groups: [],
        incoming_course_edge_count: 0,
        structural_none_safe_for_figure6_course_graph: true,
        literal_no_requirement_statement: false,
        source: {
          ...sourcePages[`vcu_${pageId}`],
          courseblock_index: entry.courseblock_index,
          raw_entry_sha256: entry.raw_entry_sha256,
          raw_entry_html_sha256: entry.raw_entry_html_sha256,
          published_units: entry.published_units,
        },
        marker_control: entry.complete_entry_receipt,
        preserved_signals: signals,
        content_accounting: {
          exact_complete_present_entry: true,
          same_source_positive_control: true,
          every_constraint_like_signal_span_preserved: true,
          source_content_discarded: false,
        },
        graph_effect: {
          added_course_vertices: 0,
          added_prerequisite_edges: 0,
          added_corequisite_edges: 0,
        },
        inference_boundary:
          'Status none is limited to the Figure 6 owner-local course graph. The exact population, class, program, repeat-credit, and descriptive signals remain attached and may constrain other analyses.',
      });
    }
  }
  return { rows, sourcePages };
}

function formulaGroupReceipts(target, entry) {
  return target.groups.map((sourceGroup, groupIndex) => {
    const statement = exactSpan(
      entry.raw_entry_text, sourceGroup.statement_raw,
      `${target.course_code}:group:${groupIndex}:statement`,
    );
    const rawWithinStatement = sourceGroup.statement_raw.indexOf(sourceGroup.raw);
    assertExact(rawWithinStatement >= 0
      && sourceGroup.statement_raw.indexOf(
        sourceGroup.raw, rawWithinStatement + sourceGroup.raw.length,
      ) < 0,
    `${target.course_code}:group:${groupIndex}:raw_boundary`);
    const groupId = `${target.owner_namespace}:${target.course_code}:prerequisite:${groupIndex}`;
    return {
      id: groupId,
      kind: 'prerequisite',
      raw: sourceGroup.raw,
      formula: FORMULA,
      flags: [
        'strict_full_text_accounting',
        'exact_retained_official_source_formula',
        sourceGroup.grammar,
      ],
      paths: sourceGroup.paths.map((conditions, pathIndex) => ({
        id: `${groupId}:path:${pathIndex}`,
        raw: sourceGroup.raw,
        all_of: conditions.map((condition) => condition.type === 'course' ? {
          ...condition,
          course_key: `${target.owner_namespace}:${condition.code}`,
        } : { ...condition }),
      })),
      source_receipt: {
        statement_relative_start: statement.relative_start,
        statement_relative_end: statement.relative_end,
        statement_sha256: statement.raw_sha256,
        raw_relative_start: statement.relative_start + rawWithinStatement,
        raw_relative_end:
          statement.relative_start + rawWithinStatement + sourceGroup.raw.length,
        raw_sha256: sha256(sourceGroup.raw),
      },
      ...(sourceGroup.grade_scope ? { grade_scope: sourceGroup.grade_scope } : {}),
    };
  });
}

function formulaRow(target, entry, source, markerControl, candidates) {
  assertExact(entry.raw_entry_sha256 === target.expected_entry.raw_entry_sha256,
    `${target.course_code}:raw_entry_sha256`);
  assertExact(entry.raw_entry_html_sha256 === target.expected_entry.raw_entry_html_sha256,
    `${target.course_code}:raw_entry_html_sha256`);
  const candidate = candidates.get(`${target.owner_namespace}:${target.course_code}`);
  const issues = candidateEntryIssues(candidate, target, entry, source);
  assertExact(!issues.length, `${target.course_code}:candidate:${issues.join(',')}`);
  const groups = formulaGroupReceipts(target, entry);
  const signals = target.signals.map((signal, index) => ({
    ...signal,
    ...exactSpan(entry.raw_entry_text, signal.raw, `${target.course_code}:signal:${index}`),
  }));
  const referencedCourseKeys = [...new Set(groups.flatMap((sourceGroup) => (
    sourceGroup.paths.flatMap((formulaPath) => formulaPath.all_of
      .filter((condition) => condition.type === 'course')
      .map((condition) => condition.course_key))
  )))].sort();
  const edgeCounts = groups.flatMap((sourceGroup) => sourceGroup.paths.map((formulaPath) => (
    formulaPath.all_of.filter((condition) => condition.type === 'course').length
  )));
  return {
    course_key: `${target.owner_namespace}:${target.course_code}`,
    school_id: target.school_id,
    slug: target.slug,
    owner_namespace: target.owner_namespace,
    course_code: target.course_code,
    scope_role: target.scope_role,
    disposition: 'exact_formula_runtime_blocked',
    publication_status_recommendation: 'unparsed',
    review_reason: FORMULA_REVIEW_REASON,
    source_formula_status: 'exact',
    runtime_ready: false,
    raw_requisites: target.raw_requisites,
    groups,
    preserved_signals: signals,
    referenced_course_keys: referencedCourseKeys,
    possible_incoming_course_edge_count_by_path: edgeCounts,
    runtime_blockers: [...target.runtime_blockers],
    source: {
      official_url: source.official_url,
      cache_path: source.cache_path,
      source_response_sha256: source.source_response_sha256,
      source_response_bytes: source.source_response_bytes,
      boundary_contract: source.boundary_contract,
      catalog_year: source.catalog_year || null,
      courseblock_index: entry.courseblock_index ?? null,
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_html_sha256: entry.raw_entry_html_sha256,
      published_units: entry.published_units,
    },
    marker_control: markerControl,
    content_accounting: {
      exact_complete_present_entry: true,
      every_formula_group_span_exact: true,
      every_nonformula_signal_span_preserved: true,
      formula_rewritten_or_dropped: false,
      source_content_discarded: false,
    },
    inference_boundary:
      'The source formula is exact, but it is not publication-ready until every owner-local course reference has a closed exact row and every non-course alternative has an explicit production binding. The formula is neither flattened nor treated as zero edge.',
  };
}

function buildJmuFormula(readFile, candidates) {
  const sourceConfig = UNIVERSITY_TAIL_SOURCES.jmu_math;
  const page = {
    ...sourceConfig,
    cache_path:
      'university-prerequisites/raw/james-madison-university/james-madison-university__math.html',
    catalog_year: CATALOG_YEAR,
    boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
  };
  const { bytes } = verifyRetainedHtmlSource(readFile, page, { browserChallenge: true });
  const html = bytes.toString('utf8');
  assertExact(catalogYearSeen(html, CATALOG_YEAR), 'jmu_math:catalog_year');
  const extraction = extractCourseLeafEntries(html, ['MATH220', 'MATH233', 'MATH234']);
  assertExact(!extraction.missing.length && !extraction.ambiguous.length,
    'jmu_math:target_inventory');
  assertExact(extraction.courseblock_count === sourceConfig.source_courseblock_count
    && extraction.complete_entry_count === sourceConfig.source_complete_entry_count
    && extraction.complete_entries_with_required_requisite_marker_count
      === sourceConfig.source_positive_count,
  'jmu_math:population_control');
  const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
  const positive = byCode.get('MATH220');
  assertExact(positive?.raw_entry_sha256 === sourceConfig.positive_control_raw_entry_sha256
    && positive?.raw_entry_html_sha256
      === sourceConfig.positive_control_raw_entry_html_sha256,
  'jmu_math:positive_control');
  const upstream = byCode.get('MATH234');
  const upstreamDecision = UNIVERSITY_TAIL_DECISIONS['james-madison-university:MATH234'];
  assertExact(upstream?.raw_entry_sha256 === upstreamDecision.entry.raw_entry_sha256
    && upstream?.raw_entry_html_sha256 === upstreamDecision.entry.raw_entry_html_sha256,
  'MATH234:external_owner_source');
  assertExact(upstreamDecision.groups[0].paths[0][0].code === 'MATH233',
    'MATH234:induced_reference');
  const target = FORMULA_TARGETS['va:uni:9213:MATH233'];
  const entry = byCode.get('MATH233');
  assertExact(entry?.structured_requisite_fields?.length === 1
    && entry.structured_requisite_fields[0].raw_field_text_sha256
      === target.expected_entry.structured_field_sha256,
  'MATH233:structured_field');
  return {
    row: formulaRow(target, entry, page, entry.complete_entry_receipt, candidates),
    sourcePage: sourceFact(page, extraction, {
      same_source_positive_control: true,
      positive_control_course_code: 'MATH220',
    }),
    inductionReceipt: {
      owner_contract: UNIVERSITY_TAIL_CONTRACT,
      owner_contract_facts_sha256: UNIVERSITY_TAIL_FACTS_SHA256,
      upstream_course_key: 'va:uni:9213:MATH234',
      upstream_disposition_owned_elsewhere: true,
      upstream_raw_entry_sha256: upstream.raw_entry_sha256,
      upstream_raw_entry_html_sha256: upstream.raw_entry_html_sha256,
      exact_reference_course_key: 'va:uni:9213:MATH233',
      minimum_grade: 'C-',
      same_source_response_sha256: page.source_response_sha256,
    },
  };
}

function buildRadfordFormula(readFile, candidates) {
  const target = FORMULA_TARGETS['va:uni:9219:CS322'];
  const candidate = candidates.get(target.owner_namespace + ':' + target.course_code);
  const page = {
    official_url: candidate?.source?.official_url,
    cache_path:
      'university-prerequisites/raw/radford-university/radford-university__cs322.html',
    source_response_sha256:
      'd758a62ec2310f5e1a8652d9a9669a518a391afb2ba9589845700d9096ec9b74',
    source_response_bytes: 79125,
    catalog_year: RADFORD_CATALOG_YEAR,
    boundary_contract: RADFORD_BOUNDARY_CONTRACT,
  };
  const { bytes, metadata } = verifyRetainedHtmlSource(readFile, page);
  const programBytes = readFile(RADFORD_PROGRAM_CACHE_PATH);
  assertExact(sha256(programBytes) === RADFORD_PROGRAM_HTML_SHA256,
    'radford_program_sha256');
  const discovery = verifyRadfordProgramDiscovery(
    programBytes.toString('utf8'), ['CS322'],
  );
  assertExact(discovery.verified && discovery.links.length === 1,
    `CS322:discovery:${discovery.issues.join(',')}`);
  const extraction = extractRadfordCourseEntry(bytes.toString('utf8'), 'CS322', {
    finalUrl: metadata.final_url,
  });
  assertExact(extraction.verified && extraction.entries.length === 1,
    `CS322:entry:${extraction.issues.join(',')}`);
  const entry = extraction.entries[0];
  assertExact(entry.required_requisite_clause?.raw_sha256
    === target.expected_entry.required_clause_sha256,
  'CS322:required_clause');
  assertExact(!candidates.has('va:uni:9219:MATH151'),
    'CS322:MATH151_unexpected_candidate');
  return {
    row: formulaRow(target, entry, page, {
      contract: 'radford_exact_current_course_required_clause_receipt_v1',
      required_requisite_clause: entry.required_requisite_clause,
      exact_program_discovery: true,
      program_source_sha256: RADFORD_PROGRAM_HTML_SHA256,
    }, candidates),
    sourcePage: sourceFact(page, null, {
      exact_program_discovery: true,
      program_source_sha256: RADFORD_PROGRAM_HTML_SHA256,
      catoid: entry.catoid,
      coid: entry.coid,
    }),
  };
}

function buildLongwoodFormula(readFile, candidates) {
  const target = FORMULA_TARGETS['va:uni:9214:SPAN212'];
  const page = {
    official_url: LONGWOOD_BANNER_URL,
    cache_path:
      'university-prerequisites/raw/longwood-university/longwood-university__courses_from_banner.html',
    source_response_sha256:
      '2f4fc77307b8b4f045ed0f3809a6c57e534fbe7145ad8d5142fb1ca7adb37841',
    source_response_bytes: 973047,
    catalog_year: null,
    boundary_contract: LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  };
  const { bytes } = verifyRetainedHtmlSource(readFile, page);
  const extraction = extractLongwoodBannerEntries(
    bytes.toString('utf8'), ['SPAN211', 'SPAN212'],
  );
  assertExact(extraction.verified && !extraction.missing.length,
    `longwood_span:${extraction.issues.join(',')}`);
  const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
  const span211 = byCode.get('SPAN211');
  const blocked = NEW_BLOCKED_REFERENCES.find((row) => row.course_code === 'SPAN211');
  assertExact(span211?.raw_entry_sha256
    === 'aa5ebda2cc7de6e90245fd7a3141f40144b2b931c9736e71e740a022cedaa652',
  'SPAN211:raw_entry_sha256');
  assertExact(span211?.raw_entry_html_sha256
    === '216ce07d9db1b646c3b02d4f554839c04ca5bd52dd5a04ccb9b9c302e36c279a',
  'SPAN211:raw_entry_html_sha256');
  exactSpan(span211.raw_entry_text, blocked.exact_source_raw, 'SPAN211:blocker_formula');
  const entry = byCode.get('SPAN212');
  return {
    row: formulaRow(target, entry, page, {
      contract: 'longwood_banner_exact_positive_formula_entry_v1',
      exact_formula_marker_present: true,
      missing_result_inference_used: false,
      edition_status: 'unversioned_current_first_party_page',
    }, candidates),
    sourcePage: sourceFact(page, null, {
      edition_boundary: LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
      exact_positive_formula_entry: true,
    }),
    blockedReferenceReceipt: {
      course_key: 'va:uni:9214:SPAN211',
      raw_entry_sha256: span211.raw_entry_sha256,
      raw_entry_html_sha256: span211.raw_entry_html_sha256,
      exact_source_raw: blocked.exact_source_raw,
      exact_source_raw_sha256: sha256(blocked.exact_source_raw),
      blocker: blocked.blocker,
    },
  };
}

function buildEvidence({ readFile = defaultReadFile } = {}) {
  const candidates = candidateMap(readFile);
  const vcu = buildVcuRows(readFile, candidates);
  const jmu = buildJmuFormula(readFile, candidates);
  const radford = buildRadfordFormula(readFile, candidates);
  const longwood = buildLongwoodFormula(readFile, candidates);
  const rows = [
    ...vcu.rows,
    jmu.row,
    radford.row,
    longwood.row,
  ].sort((left, right) => left.course_key.localeCompare(right.course_key));
  const policy = {
    graph_measure: 'Figure 6 Curricular Analytics h(G)',
    graph_vertices: 'selected curriculum courses',
    graph_edges: 'required owner-local prerequisite and corequisite course dependencies',
    zero_edge_dimensions: [
      'population enrollment restriction',
      'program enrollment restriction',
      'absolute class standing restriction',
      'negative repeat-credit limit',
      'descriptive use of requirements',
    ],
    fail_closed_dimensions: [
      'required prior knowledge without a satisfaction rule',
      'unnamed required course or lab',
      'unbound assessment or placement alternative',
      'missing or ambiguous recursive course formula',
    ],
    missing_result_inference_allowed: false,
  };
  const facts = {
    policy,
    existing_contract_accounting: EXISTING_CONTRACT_ACCOUNTING,
    conflict_reconciliations: CONFLICT_RECONCILIATIONS,
    source_pages: {
      ...vcu.sourcePages,
      jmu_math: jmu.sourcePage,
      longwood_banner: longwood.sourcePage,
      radford_cs322: radford.sourcePage,
    },
    induction_receipt: jmu.inductionReceipt,
    target_rows: rows,
    new_blocked_references: NEW_BLOCKED_REFERENCES.map((row) => (
      row.course_code === 'SPAN211'
        ? { ...row, source_receipt: longwood.blockedReferenceReceipt }
        : row
    )),
  };
  const factsSha256 = sha256(canonicalJson(facts));
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    contract: CONTRACT,
    snapshot_date: '2026-08-25',
    publication_ready: false,
    publication_blockers: [
      'three_exact_formulas_not_runtime_ready',
      'two_new_recursive_course_references_blocked',
      'human_publication_verification_not_requested',
    ],
    summary: {
      residual_target_rows: rows.length,
      exact_complete_entry_rows: rows.filter((row) => (
        row.content_accounting.exact_complete_present_entry
      )).length,
      safe_zero_course_edge_rows: rows.filter((row) => (
        row.disposition === 'safe_zero_course_edge'
      )).length,
      exact_formula_rows: rows.filter((row) => (
        row.disposition === 'exact_formula_runtime_blocked'
      )).length,
      runtime_ready_formula_rows: rows.filter((row) => row.runtime_ready === true).length,
      direct_rows: rows.filter((row) => row.scope_role === 'direct_remediation').length,
      recursive_closure_rows: rows.filter((row) => row.scope_role === 'recursive_closure').length,
      induced_recursive_closure_rows: rows.filter((row) => (
        row.scope_role === 'induced_recursive_closure'
      )).length,
      outside_scope_rows: rows.filter((row) => (
        row.scope_role === 'newly_discovered_outside_reference'
      )).length,
      new_blocked_reference_rows: NEW_BLOCKED_REFERENCES.length,
      externally_owned_accounting_rows: Object.values(EXISTING_CONTRACT_ACCOUNTING)
        .reduce((count, owner) => count + owner.excluded_course_keys.length, 0),
      adversarial_conflict_rows: CONFLICT_RECONCILIATIONS.length,
    },
    facts_sha256: factsSha256,
    facts,
  };
}

function evidenceIssues(artifact) {
  const issues = [];
  if (artifact?.schema_version !== 1) issues.push('schema_version');
  if (artifact?.artifact !== ARTIFACT) issues.push('artifact');
  if (artifact?.contract !== CONTRACT) issues.push('contract');
  if (artifact?.publication_ready !== false) issues.push('publication_ready');
  if (artifact?.facts_sha256 !== EXPECTED_FACTS_SHA256) issues.push('facts_sha256_pin');
  if (sha256(canonicalJson(artifact?.facts || null)) !== artifact?.facts_sha256) {
    issues.push('facts_sha256_replay');
  }
  const rows = asArray(artifact?.facts?.target_rows);
  if (!same(rows.map((row) => row.course_key).sort(), TARGET_KEYS)) {
    issues.push('target_inventory');
  }
  const expectedSummary = {
    residual_target_rows: 10,
    exact_complete_entry_rows: 10,
    safe_zero_course_edge_rows: 7,
    exact_formula_rows: 3,
    runtime_ready_formula_rows: 0,
    direct_rows: 6,
    recursive_closure_rows: 3,
    induced_recursive_closure_rows: 1,
    outside_scope_rows: 0,
    new_blocked_reference_rows: 2,
    externally_owned_accounting_rows: 9,
    adversarial_conflict_rows: 2,
  };
  if (!same(artifact?.summary, expectedSummary)) issues.push('summary');
  const zero = rows.filter((row) => row.disposition === 'safe_zero_course_edge');
  if (zero.length !== 7 || zero.some((row) => (
    row.publication_status_recommendation !== 'none'
      || row.incoming_course_edge_count !== 0
      || row.structural_none_safe_for_figure6_course_graph !== true
      || row.literal_no_requirement_statement !== false
      || row.graph_effect?.added_prerequisite_edges !== 0
      || row.graph_effect?.added_corequisite_edges !== 0
  ))) issues.push('zero_edge_partition');
  const formulas = rows.filter((row) => row.disposition === 'exact_formula_runtime_blocked');
  if (formulas.length !== 3 || formulas.some((row) => (
    row.source_formula_status !== 'exact'
      || row.runtime_ready !== false
      || row.publication_status_recommendation !== 'unparsed'
      || !row.groups?.length
      || row.groups.some((sourceGroup) => sourceGroup.formula !== FORMULA)
      || !row.runtime_blockers?.length
  ))) issues.push('formula_partition');
  if (rows.some((row) => (
    row.content_accounting?.source_content_discarded !== false
      || row.content_accounting?.exact_complete_present_entry !== true
  ))) issues.push('content_accounting');
  const blockedRefs = asArray(artifact?.facts?.new_blocked_references);
  if (!same(blockedRefs.map((row) => row.course_key).sort(), [
    'va:uni:9214:SPAN211',
    'va:uni:9219:MATH151',
  ])) issues.push('new_blocked_references');
  if (asArray(artifact?.facts?.conflict_reconciliations).some((row) => (
    !String(row.disposition).startsWith('blocked_')
  ))) issues.push('conflict_reconciliations');
  return [...new Set(issues)].sort();
}

function loadEvidenceArtifact() {
  const artifact = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  const issues = evidenceIssues(artifact);
  if (issues.length) {
    throw new Error(`remaining university prerequisite evidence invalid: ${issues.join(', ')}`);
  }
  return artifact;
}

function evidenceRow(artifact, courseKey) {
  return asArray(artifact?.facts?.target_rows)
    .find((row) => row.course_key === courseKey);
}

function isScopedRemainingUniversityPrerequisite(candidate) {
  return TARGET_KEYS.includes(candidate?.course_key);
}

function candidateReceiptIssues(candidate, artifact = loadEvidenceArtifact()) {
  if (!isScopedRemainingUniversityPrerequisite(candidate)) return ['not_scoped'];
  const row = evidenceRow(artifact, candidate.course_key);
  const source = candidate?.source || {};
  const issues = [...evidenceIssues(artifact)];
  if (candidate?.school_id !== row?.school_id || candidate?.slug !== row?.slug
      || candidate?.owner_namespace !== row?.owner_namespace
      || candidate?.course_code !== row?.course_code) issues.push('identity');
  if (source.official_url !== row?.source?.official_url
      || source.cache_path !== row?.source?.cache_path
      || source.source_response_sha256 !== row?.source?.source_response_sha256
      || source.source_response_bytes !== row?.source?.source_response_bytes
      || source.boundary_contract !== row?.source?.boundary_contract
      || source.raw_entry_sha256 !== row?.source?.raw_entry_sha256
      || source.raw_entry_html_sha256 !== row?.source?.raw_entry_html_sha256
      || !same(source.published_units, row?.source?.published_units)
      || sha256(source.raw_entry_text) !== row?.source?.raw_entry_sha256) {
    issues.push('source_receipt');
  }
  return [...new Set(issues)];
}

function absoluteSignals(signals, entryStart) {
  return asArray(signals).map((signal) => ({
    ...signal,
    source_character_start: entryStart + signal.relative_start,
    source_character_end: entryStart + signal.relative_end,
  }));
}

function rowProof(row) {
  return {
    kind: row.disposition === 'safe_zero_course_edge'
      ? 'exact_complete_entry_zero_figure6_course_edge'
      : 'exact_source_formula_runtime_blocker',
    contract: CONTRACT,
    course_key: row.course_key,
    source: row.source,
    marker_control: row.marker_control,
    content_accounting: row.content_accounting,
    graph_effect: row.graph_effect || null,
    inference_boundary: row.inference_boundary,
  };
}

function resolveRemainingUniversityPrerequisite(
  candidate,
  artifact = loadEvidenceArtifact(),
) {
  if (!isScopedRemainingUniversityPrerequisite(candidate)) {
    return { applicable: false, ready: false, blocked: false, issues: [] };
  }
  const row = evidenceRow(artifact, candidate.course_key);
  const issues = candidateReceiptIssues(candidate, artifact);
  if (issues.length) return {
    applicable: true,
    ready: false,
    blocked: row.disposition !== 'safe_zero_course_edge',
    issues,
    review_reason: 'remaining_university_exact_source_receipt_changed',
  };
  const signals = absoluteSignals(row.preserved_signals, candidate.source.character_start);
  if (row.disposition === 'exact_formula_runtime_blocked') return {
    applicable: true,
    ready: false,
    blocked: true,
    issues: [],
    review_reason: FORMULA_REVIEW_REASON,
    raw_requisites: row.raw_requisites,
    preserved_source_formulas: row.groups,
    preserved_signals: signals,
    blocker_evidence: {
      ...rowProof(row),
      source_formula_status: row.source_formula_status,
      source_formulas: row.groups,
      referenced_course_keys: row.referenced_course_keys,
      runtime_blockers: row.runtime_blockers,
      formula_rewritten_or_dropped: false,
      partial_course_edges_emitted: false,
      structural_none_inferred: false,
    },
  };
  return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: 'none',
    raw_requisites: null,
    groups: [],
    review_status: 'promoted_structural_none',
    review_reason: FIGURE6_ZERO_EDGE_REASON,
    ignored_nonrequired_requisites: signals,
    proof: {
      ...rowProof(row),
      literal_none_statement: false,
      incoming_course_edge_count: 0,
      preserved_signals: row.preserved_signals,
    },
  };
}

function replayCandidateFromReviewRow(row) {
  const evidence = row?.review_evidence || {};
  return {
    school_id: row?.school_id,
    slug: row?.slug,
    owner_namespace: row?.owner_namespace,
    course_key: row?.course_key,
    course_code: row?.code,
    source: {
      official_url: evidence.official_url,
      cache_path: evidence.cache_path,
      source_response_sha256: evidence.source_response_sha256,
      source_response_bytes: evidence.source_response_bytes,
      boundary_contract: evidence.boundary_contract,
      raw_entry_sha256: evidence.raw_entry_sha256,
      raw_entry_html_sha256: evidence.raw_entry_html_sha256,
      raw_entry_text: evidence.raw_entry_text,
      published_units: evidence.published_units,
      character_start: evidence.entry_character_start,
    },
  };
}

function resolutionRowIssues(row, artifact = loadEvidenceArtifact()) {
  if (!isScopedRemainingUniversityPrerequisite(row)) return [];
  const expected = evidenceRow(artifact, row.course_key);
  const resolved = resolveRemainingUniversityPrerequisite(
    replayCandidateFromReviewRow(row), artifact,
  );
  const issues = [];
  if (expected.disposition === 'exact_formula_runtime_blocked') {
    if (resolved.ready || !resolved.blocked || row.status !== 'unparsed'
        || row.review_status !== 'not_promoted'
        || row.review_reason !== FORMULA_REVIEW_REASON
        || row.raw_requisites !== resolved.raw_requisites
        || !same(row.groups, [])
        || !same(row.preserved_source_formulas, resolved.preserved_source_formulas)
        || !same(row.preserved_prerequisite_signals, resolved.preserved_signals)
        || !same(row.prerequisite_constraint_blocker_evidence,
          resolved.blocker_evidence)) issues.push('blocked_projection');
  } else if (!resolved.ready) issues.push('source_receipt');
  else if (row.status !== 'none' || row.review_status !== 'promoted_structural_none'
      || row.review_reason !== FIGURE6_ZERO_EDGE_REASON
      || row.raw_requisites !== null || !same(row.groups, [])
      || !same(row.ignored_nonrequired_requisites,
        resolved.ignored_nonrequired_requisites)
      || !same(row.structural_none_evidence, resolved.proof)) {
    issues.push('zero_edge_projection');
  }
  return issues;
}

module.exports = {
  ARTIFACT,
  CACHE_ROOT,
  CATALOG_YEAR,
  CONFLICT_RECONCILIATIONS,
  CONTRACT,
  EVIDENCE_PATH,
  EXPECTED_FACTS_SHA256,
  EXISTING_CONTRACT_ACCOUNTING,
  FIGURE6_ZERO_EDGE_REASON,
  FORMULA,
  FORMULA_REVIEW_REASON,
  FORMULA_TARGETS,
  NEW_BLOCKED_REFERENCES,
  TARGET_KEYS,
  VCU_ZERO_EDGE_CODES,
  buildEvidence,
  candidateReceiptIssues,
  canonicalJson,
  defaultReadFile,
  evidenceIssues,
  isScopedRemainingUniversityPrerequisite,
  loadEvidenceArtifact,
  replayCandidateFromReviewRow,
  resolutionRowIssues,
  resolveRemainingUniversityPrerequisite,
  sha256,
};
