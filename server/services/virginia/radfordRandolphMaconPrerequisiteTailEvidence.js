/**
 * Standalone, source-bound disposition of the final Radford/Randolph-Macon
 * rows whose current review says only that no explicit required statement was
 * parsed. This module does not alter the shared review. It proves a narrower
 * Figure 6 fact: whether the exact current entry contributes an incoming
 * course edge after every constraint-like phrase is retained and classified.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  extractCourseLeafEntries,
} = require('./universityPrerequisiteAcquisition');
const {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CATALOG_YEAR,
  RADFORD_CATOID,
  RADFORD_DIRECT_COURSE_RECORDS,
  RADFORD_PROGRAM_CACHE_PATH,
  RADFORD_PROGRAM_HTML_SHA256,
  extractRadfordCourseEntry,
  verifyRadfordProgramDiscovery,
} = require('./radfordAcalogPrerequisiteAcquisition');

const ARTIFACT = 'va_radford_randolph_macon_prerequisite_tail_evidence';
const CONTRACT =
  'va_radford_randolph_macon_exact_zero_course_edge_tail_audit_v1';
const CATALOG_YEAR = '2026-2027';
const COURSELEAF_BOUNDARY =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const CACHE_ROOT = path.resolve(__dirname, '../../.va-catalogs');
const EVIDENCE_PATH = path.join(
  CACHE_ROOT,
  'research/va-radford-randolph-macon-prerequisite-tail-evidence.json',
);

// Filled after the deterministic source replay. The checked evidence cannot
// be changed independently of this code pin.
const EXPECTED_FACTS_SHA256 =
  'b131f86d074d010c3a02c677335525bf309423ab059a309828cb9db72642b6b2';

const RMC = Object.freeze({
  school_id: 9221,
  slug: 'randolph-macon-college',
  owner_namespace: 'va:uni:9221',
});
const RADFORD = Object.freeze({
  school_id: 9219,
  slug: 'radford-university',
  owner_namespace: 'va:uni:9219',
});

const RMC_PAGES = Object.freeze({
  csci: Object.freeze({
    official_url: 'https://catalog.rmc.edu/courses-az/csci/',
    html_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__csci.html',
    metadata_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__csci.json',
    source_response_sha256:
      '69a52cffc501f52ae561a0febefb8cc74f2c330bcfa5645a9799d97aa29b5885',
    source_response_bytes: 75071,
    courseblock_count: 39,
    complete_entry_count: 39,
    positive_entry_count: 23,
  }),
  csec: Object.freeze({
    official_url: 'https://catalog.rmc.edu/courses-az/csec/',
    html_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__csec.html',
    metadata_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__csec.json',
    source_response_sha256:
      '23ac40871230481fa2f7cf996334e46a8af97beb690261d6f9783a85f11e3342',
    source_response_bytes: 42600,
    courseblock_count: 9,
    complete_entry_count: 9,
    positive_entry_count: 5,
  }),
  engl: Object.freeze({
    official_url: 'https://catalog.rmc.edu/courses-az/engl/',
    html_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__engl.html',
    metadata_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__engl.json',
    source_response_sha256:
      '8ab982d3bff834d5d5c06f2eb0c4342d4ea10efe421607326ca7c490cb79c5a9',
    source_response_bytes: 104884,
    courseblock_count: 67,
    complete_entry_count: 67,
    positive_entry_count: 36,
  }),
  math: Object.freeze({
    official_url: 'https://catalog.rmc.edu/courses-az/math/',
    html_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__math.html',
    metadata_path:
      'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__math.json',
    source_response_sha256:
      '6fda9e1f512d38460711793372c766f2959dda60cd2201f225fd6b23f0c515a4',
    source_response_bytes: 74742,
    courseblock_count: 36,
    complete_entry_count: 36,
    positive_entry_count: 25,
  }),
});

const TARGETS = Object.freeze({
  'va:uni:9219:ENGL111': Object.freeze({
    ...RADFORD,
    course_code: 'ENGL111',
    scope_role: 'direct_remediation',
    source_kind: 'radford',
    disposition: 'safe_zero_course_edge',
    raw_entry_sha256:
      '2817adeb6614181461a140e1b6d90d893d38d0ff8f2a4d88fcf2d81cd508a0a3',
    raw_entry_html_sha256:
      'c3c3c909dae81c8d695679c88063f1d1df1fe5fb81b5760c91fef0da4fabf5f0',
    signals: Object.freeze([Object.freeze({
      kind: 'mutual_credit_exclusion',
      raw: 'Students cannot receive credit for both ENGL 111 and CORE 101.',
      excluded_course_code: 'CORE101',
      incoming_course_edge: false,
    })]),
  }),
  'va:uni:9221:CSCI111': Object.freeze({
    ...RMC,
    course_code: 'CSCI111',
    scope_role: 'direct_remediation',
    source_kind: 'courseleaf',
    page: 'csci',
    disposition: 'safe_zero_course_edge',
    source_upgrade_from_candidate_projection: true,
    candidate_raw_entry_sha256:
      '8de7f11c61f0fc7a7b88370dcda24d155445df2c602940444b7bc4617e5cc96e',
    courseblock_index: 1,
    raw_entry_sha256:
      '8de7f11c61f0fc7a7b88370dcda24d155445df2c602940444b7bc4617e5cc96e',
    raw_entry_html_sha256:
      '325317cc5e20462733d02aead253bc8fe768eb7a13e150e3015e9f06620e9b69',
    signals: Object.freeze([]),
  }),
  'va:uni:9221:CSCI382': Object.freeze({
    ...RMC,
    course_code: 'CSCI382',
    scope_role: 'direct_remediation',
    source_kind: 'courseleaf',
    page: 'csci',
    disposition: 'safe_zero_course_edge',
    source_upgrade_from_candidate_projection: true,
    candidate_raw_entry_sha256:
      '071ec8952f8bce1a16d83adec2b145fc934d2c3679f7e3321d994d295b3f9225',
    courseblock_index: 27,
    raw_entry_sha256:
      '449f4a7781f8ec49111bd40442babf1e2384ae963fb36f17ce0711fd47d3e892',
    raw_entry_html_sha256:
      'df2cdef0dd1d46a6ac2e7841f974292791f32cbb15a1452c392baa8e7f0d2f8d',
    signals: Object.freeze([]),
  }),
  'va:uni:9221:ENGL185': Object.freeze({
    ...RMC,
    course_code: 'ENGL185',
    scope_role: 'direct_remediation',
    source_kind: 'courseleaf',
    page: 'engl',
    disposition: 'safe_zero_course_edge',
    courseblock_index: 0,
    raw_entry_sha256:
      '742ba5574c81dfc967b1f4306cb30a889aa3575f81c6a19e8323b476a083ea1e',
    raw_entry_html_sha256:
      '36434d66ba57be05bb5f60fe9f2c943a32de1830c5026b006869ea4e3996e528',
    signals: Object.freeze([Object.freeze({
      kind: 'absolute_first_year_timing_constraint',
      raw: "The seminar must be taken during a student's first year at the College.",
      student_year_maximum: 1,
      incoming_course_edge: false,
      figure6_h_g_effect: false,
    })]),
  }),
  'va:uni:9221:CSEC121': Object.freeze({
    ...RMC,
    course_code: 'CSEC121',
    scope_role: 'recursive_closure',
    source_kind: 'courseleaf',
    page: 'csec',
    disposition: 'safe_zero_course_edge',
    courseblock_index: 0,
    raw_entry_sha256:
      'ea9bbef5d885c3625e5014475b678be431c45cb8c6cba32fb8b55736edf1179c',
    raw_entry_html_sha256:
      '09748c66b8ebbbb6d9e018aa5576502b5d74cd974523c8e458d87dc324ed1252',
    signals: Object.freeze([Object.freeze({
      kind: 'course_learning_outcome_not_prior_knowledge',
      raw: 'Students will also develop a working knowledge of the ethical issues related to emerging technologies and social media applications and research issues related to personal privacy, freedom of expression, and respecting and protecting intellectual property.',
      incoming_course_edge: false,
      knowledge_is_developed_by_course: true,
    })]),
  }),
  'va:uni:9221:MATH131': Object.freeze({
    ...RMC,
    course_code: 'MATH131',
    scope_role: 'recursive_closure',
    source_kind: 'courseleaf',
    page: 'math',
    disposition: 'blocked_required_prior_knowledge',
    courseblock_index: 6,
    raw_entry_sha256:
      '70c285495c5b5c7fbaf17936d67b444ee8fe9a4784f1be69686e399e5ec00aba',
    raw_entry_html_sha256:
      'd8aab18e5cd762f4e64824024cf9557c0148fb53db00603bcde6d38fdecd3b84',
    signals: Object.freeze([Object.freeze({
      kind: 'required_prior_knowledge_without_runtime_binding',
      raw: 'A working knowledge of high school algebra, geometry, and trigonometry is required for this course.',
      incoming_prerequisite_effect: 'unresolved',
      named_course_code: null,
      named_assessment: null,
    })]),
  }),
});

const TARGET_KEYS = Object.freeze(Object.keys(TARGETS).sort());
const RADFORD_POPULATION_SHA256 =
  '1fc5ad58e022a83eca138f933865c4812d0b18a489af701ba4fea9adb9ac4994';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
};
const canonicalJson = (value) => JSON.stringify(canonical(value));
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

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

function assertExact(condition, label) {
  if (!condition) throw new Error(label);
}

function exactSignalReceipts(text, signals) {
  return signals.map((signal, index) => {
    const start = text.indexOf(signal.raw);
    assertExact(start >= 0, `signal_${index}:missing`);
    assertExact(text.indexOf(signal.raw, start + signal.raw.length) < 0,
      `signal_${index}:not_unique`);
    return {
      ...signal,
      relative_start: start,
      relative_end: start + signal.raw.length,
      raw_sha256: sha256(signal.raw),
      source_content_preserved: true,
    };
  });
}

function verifyMetadata(metadata, page, bytes) {
  assertExact(metadata.requested_url === page.official_url, 'metadata_requested_url');
  assertExact(metadata.final_url === page.official_url, 'metadata_final_url');
  assertExact(metadata.capture_status === 'official_html_captured', 'metadata_status');
  assertExact(metadata.http_status === 200, 'metadata_http_status');
  assertExact(metadata.byte_length === page.source_response_bytes, 'metadata_bytes');
  assertExact(metadata.content_sha256 === page.source_response_sha256, 'metadata_sha256');
  assertExact(bytes.length === page.source_response_bytes, 'source_bytes');
  assertExact(sha256(bytes) === page.source_response_sha256, 'source_sha256');
}

function candidateByKey(readFile) {
  const artifact = readJson(
    readFile,
    'research/va-university-prerequisite-candidates.json',
  );
  return new Map((artifact.candidates || []).map((row) => [row.course_key, row]));
}

function replayRadford(readFile, candidates) {
  const programBytes = readFile(RADFORD_PROGRAM_CACHE_PATH);
  assertExact(sha256(programBytes) === RADFORD_PROGRAM_HTML_SHA256,
    'radford_program_sha256');
  const codes = Object.keys(RADFORD_DIRECT_COURSE_RECORDS).sort();
  const discovery = verifyRadfordProgramDiscovery(programBytes.toString('utf8'), codes);
  assertExact(discovery.verified && discovery.links.length === codes.length,
    `radford_discovery:${discovery.issues.join(',')}`);
  const population = codes.map((courseCode) => {
    const stem = `university-prerequisites/raw/radford-university/radford-university__${courseCode.toLowerCase()}`;
    const bytes = readFile(`${stem}.html`);
    const metadata = readJson(readFile, `${stem}.json`);
    const expectedUrl = `https://catalog.radford.edu/preview_course_nopop.php?catoid=${RADFORD_CATOID}&coid=${RADFORD_DIRECT_COURSE_RECORDS[courseCode].coid}`;
    verifyMetadata(metadata, {
      official_url: expectedUrl,
      source_response_sha256: metadata.content_sha256,
      source_response_bytes: metadata.byte_length,
    }, bytes);
    const extracted = extractRadfordCourseEntry(bytes.toString('utf8'), courseCode, {
      finalUrl: metadata.final_url,
    });
    assertExact(extracted.verified && extracted.entries.length === 1,
      `${courseCode}:radford_entry:${extracted.issues.join(',')}`);
    const entry = extracted.entries[0];
    return {
      course_code: courseCode,
      coid: entry.coid,
      source_response_sha256: sha256(bytes),
      source_response_bytes: bytes.length,
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_html_sha256: entry.raw_entry_html_sha256,
      required_clause_sha256: entry.required_requisite_clause?.raw_sha256 || null,
      entry,
      metadata,
    };
  });
  const populationFacts = population.map(({ entry, metadata, ...row }) => row);
  assertExact(sha256(JSON.stringify(populationFacts)) === RADFORD_POPULATION_SHA256,
    'radford_population_sha256');
  const positives = population.filter((row) => row.entry.required_requisite_clause);
  assertExact(positives.length === 14, 'radford_positive_control_count');
  const source = population.find((row) => row.course_code === 'ENGL111');
  const expected = TARGETS['va:uni:9219:ENGL111'];
  assertExact(source.entry.required_requisite_clause == null, 'radford_target_clause');
  assertExact(source.entry.raw_entry_sha256 === expected.raw_entry_sha256
    && source.entry.raw_entry_html_sha256 === expected.raw_entry_html_sha256,
  'radford_target_entry');
  const candidate = candidates.get('va:uni:9219:ENGL111');
  assertExact(candidate?.source?.source_response_sha256 === source.source_response_sha256
    && candidate.source.raw_entry_sha256 === source.entry.raw_entry_sha256,
  'radford_candidate_projection');
  return {
    target: expected,
    entry: source.entry,
    source: {
      official_url: source.metadata.final_url,
      cache_path:
        'university-prerequisites/raw/radford-university/radford-university__engl111.html',
      source_response_sha256: source.source_response_sha256,
      source_response_bytes: source.source_response_bytes,
      raw_entry_sha256: source.entry.raw_entry_sha256,
      raw_entry_html_sha256: source.entry.raw_entry_html_sha256,
      boundary_contract: RADFORD_BOUNDARY_CONTRACT,
      catalog_year: RADFORD_CATALOG_YEAR,
      catoid: RADFORD_CATOID,
      coid: source.entry.coid,
      published_units: source.entry.published_units,
    },
    marker_control: {
      contract: 'radford_exact_current_catoid_population_prerequisite_positive_control_v1',
      catalog_year: RADFORD_CATALOG_YEAR,
      catoid: RADFORD_CATOID,
      exact_complete_entry_count: population.length,
      exact_entries_with_required_prerequisite_count: positives.length,
      exact_entries_without_required_prerequisite_count:
        population.length - positives.length,
      positive_control_codes: positives.map((row) => row.course_code),
      population_sha256: RADFORD_POPULATION_SHA256,
      same_catalog_positive_control: true,
      missing_search_result_used: false,
    },
  };
}

function replayRmcPage(readFile, pageName, targetRows) {
  const page = RMC_PAGES[pageName];
  const bytes = readFile(page.html_path);
  const metadata = readJson(readFile, page.metadata_path);
  verifyMetadata(metadata, page, bytes);
  const html = bytes.toString('utf8');
  assertExact((html.match(/2026-2027 Academic Catalog/g) || []).length >= 1,
    `${pageName}:catalog_edition`);
  assertExact(html.includes('/pdf/2026-2027.pdf'), `${pageName}:full_catalog_link`);
  const codes = targetRows.map((row) => row.course_code);
  const extracted = extractCourseLeafEntries(html, codes);
  assertExact(extracted.ambiguous.length === 0 && extracted.missing.length === 0,
    `${pageName}:target_inventory`);
  assertExact(extracted.courseblock_count === page.courseblock_count
    && extracted.complete_entry_count === page.complete_entry_count
    && extracted.complete_entries_with_required_requisite_marker_count
      === page.positive_entry_count,
  `${pageName}:population_control`);
  return new Map(extracted.entries.map((entry) => [entry.course_code, {
    entry,
    source: {
      official_url: page.official_url,
      cache_path: page.html_path,
      source_response_sha256: page.source_response_sha256,
      source_response_bytes: page.source_response_bytes,
      raw_entry_sha256: entry.raw_entry_sha256,
      raw_entry_html_sha256: entry.raw_entry_html_sha256,
      boundary_contract: COURSELEAF_BOUNDARY,
      catalog_year: CATALOG_YEAR,
      courseblock_index: entry.courseblock_index,
      published_units: entry.published_units,
    },
    marker_control: {
      ...entry.complete_entry_receipt,
      exact_current_edition_marker_present: true,
      missing_search_result_used: false,
    },
  }]));
}

function rowFact(target, source, markerControl, entry, candidate) {
  assertExact(entry.raw_entry_sha256 === target.raw_entry_sha256,
    `${target.course_code}:raw_entry_sha256`);
  assertExact(entry.raw_entry_html_sha256 === target.raw_entry_html_sha256,
    `${target.course_code}:raw_entry_html_sha256`);
  assertExact(markerControl.same_source_positive_control === true
    || markerControl.same_catalog_positive_control === true,
  `${target.course_code}:positive_control`);
  const signals = exactSignalReceipts(entry.raw_entry_text, target.signals);
  if (target.source_upgrade_from_candidate_projection) {
    assertExact(candidate?.source?.capture_origin === 'retained_catalog_text'
      && candidate.source.source_response_sha256 == null
      && candidate.source.raw_entry_html_sha256 == null
      && candidate.source.raw_entry_sha256 === target.candidate_raw_entry_sha256,
    `${target.course_code}:weak_candidate_projection`);
  } else {
    assertExact(candidate?.source?.raw_entry_sha256 === target.raw_entry_sha256,
      `${target.course_code}:candidate_raw_entry`);
  }
  const safe = target.disposition === 'safe_zero_course_edge';
  return {
    course_key: `${target.owner_namespace}:${target.course_code}`,
    school_id: target.school_id,
    slug: target.slug,
    owner_namespace: target.owner_namespace,
    course_code: target.course_code,
    scope_role: target.scope_role,
    disposition: target.disposition,
    publication_status_recommendation: safe ? 'none' : 'unparsed',
    incoming_course_edge_count: safe ? 0 : null,
    structural_none_safe_for_figure6_course_graph: safe,
    source_upgrade_from_candidate_projection:
      target.source_upgrade_from_candidate_projection === true,
    source,
    marker_control: markerControl,
    preserved_signals: signals,
    content_accounting: {
      exact_complete_present_entry: true,
      exact_current_catalog_edition: true,
      same_source_or_same_catalog_positive_control: true,
      every_constraint_like_signal_span_preserved: true,
      source_content_discarded: false,
    },
    inference_boundary: safe
      ? 'Zero-edge means only that this exact complete current entry contributes no incoming course edge to Figure 6 h(G). Credit exclusions, absolute cohort/timing rules, and descriptive learning outcomes remain retained facts and are not erased or represented as literal no-requirement statements.'
      : 'The exact entry requires prior knowledge but names neither an owner-local course nor an assessment/runtime binding. It must remain blocked; structural silence and a zero-edge formula are not inferred.',
  };
}

function buildEvidence({ readFile = defaultReadFile } = {}) {
  const candidates = candidateByKey(readFile);
  assertExact(TARGET_KEYS.every((key) => candidates.has(key)), 'candidate_target_inventory');
  const radford = replayRadford(readFile, candidates);
  const rows = [rowFact(
    radford.target, radford.source, radford.marker_control,
    radford.entry, candidates.get('va:uni:9219:ENGL111'),
  )];
  for (const [pageName, page] of Object.entries(RMC_PAGES)) {
    const targets = Object.values(TARGETS).filter((target) => target.page === pageName);
    if (!targets.length) continue;
    const replayed = replayRmcPage(readFile, pageName, targets);
    for (const target of targets) {
      const found = replayed.get(target.course_code);
      assertExact(Boolean(found), `${target.course_code}:replayed_entry`);
      rows.push(rowFact(
        target, found.source, found.marker_control, found.entry,
        candidates.get(`${target.owner_namespace}:${target.course_code}`),
      ));
    }
  }
  rows.sort((left, right) => left.course_key.localeCompare(right.course_key));
  const policy = {
    graph_measure: 'Figure 6 h(G) incoming owner-local course edges',
    zero_edge_boundary:
      'Absolute cohort or first-year timing constraints do not create course edges, but must be retained as source-bound signals. Required prior knowledge, an assessment, an unnamed course, or unresolved enrollment dependency blocks structural-none unless separately modeled.',
    missing_result_inference_allowed: false,
  };
  const facts = { policy, target_rows: rows };
  const factsSha256 = sha256(canonicalJson(facts));
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    contract: CONTRACT,
    snapshot_date: '2026-08-25',
    publication_ready: false,
    summary: {
      target_rows: rows.length,
      exact_current_complete_entry_rows: rows.filter((row) => (
        row.content_accounting.exact_complete_present_entry
      )).length,
      source_upgrade_rows: rows.filter((row) => (
        row.source_upgrade_from_candidate_projection
      )).length,
      safe_zero_course_edge_rows: rows.filter((row) => (
        row.disposition === 'safe_zero_course_edge'
      )).length,
      blocked_required_prior_knowledge_rows: rows.filter((row) => (
        row.disposition === 'blocked_required_prior_knowledge'
      )).length,
      direct_rows: rows.filter((row) => row.scope_role === 'direct_remediation').length,
      closure_rows: rows.filter((row) => row.scope_role === 'recursive_closure').length,
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
  const rows = artifact?.facts?.target_rows || [];
  if (!same(rows.map((row) => row.course_key).sort(), TARGET_KEYS)) {
    issues.push('target_inventory');
  }
  if (!same(artifact?.summary, {
    target_rows: 6,
    exact_current_complete_entry_rows: 6,
    source_upgrade_rows: 2,
    safe_zero_course_edge_rows: 5,
    blocked_required_prior_knowledge_rows: 1,
    direct_rows: 4,
    closure_rows: 2,
  })) issues.push('summary');
  if (rows.some((row) => (
    row.content_accounting?.source_content_discarded !== false
    || row.content_accounting?.same_source_or_same_catalog_positive_control !== true
  ))) issues.push('content_accounting');
  const blocked = rows.filter((row) => row.disposition !== 'safe_zero_course_edge');
  if (blocked.length !== 1 || blocked[0].course_key !== 'va:uni:9221:MATH131'
      || blocked[0].structural_none_safe_for_figure6_course_graph !== false) {
    issues.push('blocked_partition');
  }
  return [...new Set(issues)];
}

function loadEvidenceArtifact() {
  delete require.cache[require.resolve(EVIDENCE_PATH)];
  return require(EVIDENCE_PATH);
}

function evidenceSummary(artifact) {
  return {
    contract: artifact?.contract || null,
    facts_sha256: artifact?.facts_sha256 || null,
    summary: artifact?.summary || null,
    dispositions: Object.fromEntries((artifact?.facts?.target_rows || []).map((row) => [
      row.course_key, row.disposition,
    ])),
  };
}

function targetKey(value = {}) {
  if (TARGETS[value.course_key]) return value.course_key;
  const code = String(value.course_code || value.code || '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
  const owner = String(value.owner_namespace || '');
  return `${owner}:${code}`;
}

function isScopedRadfordRandolphMaconTail(value = {}) {
  const target = TARGETS[targetKey(value)];
  if (!target) return false;
  return (value.school_id == null || value.school_id === target.school_id)
    && (value.slug == null || value.slug === target.slug)
    && (value.owner_namespace == null
      || value.owner_namespace === target.owner_namespace);
}

function artifactRow(artifact, key) {
  return artifact?.facts?.target_rows?.find((row) => row.course_key === key) || null;
}

function exactEntryForArtifactRow(row, { readFile = defaultReadFile } = {}) {
  assertExact(row?.source?.cache_path, `${row?.course_key || 'target'}:source_cache_path`);
  const bytes = readFile(row.source.cache_path);
  assertExact(bytes.length === row.source.source_response_bytes,
    `${row.course_key}:source_bytes`);
  assertExact(sha256(bytes) === row.source.source_response_sha256,
    `${row.course_key}:source_sha256`);
  let entry;
  if (row.slug === RADFORD.slug) {
    const result = extractRadfordCourseEntry(bytes.toString('utf8'), row.course_code, {
      finalUrl: row.source.official_url,
    });
    assertExact(result.verified && result.entries.length === 1,
      `${row.course_key}:radford_entry`);
    [entry] = result.entries;
  } else {
    const result = extractCourseLeafEntries(bytes.toString('utf8'), [row.course_code]);
    assertExact(!result.missing.length && !result.ambiguous.length
      && result.entries.length === 1, `${row.course_key}:courseleaf_entry`);
    [entry] = result.entries;
  }
  assertExact(entry.raw_entry_sha256 === row.source.raw_entry_sha256
    && entry.raw_entry_html_sha256 === row.source.raw_entry_html_sha256,
  `${row.course_key}:entry_hashes`);
  return entry;
}

function candidateIssues(candidate, artifact = loadEvidenceArtifact()) {
  if (!isScopedRadfordRandolphMaconTail(candidate)) return ['not_scoped'];
  const key = targetKey(candidate);
  const target = TARGETS[key];
  const row = artifactRow(artifact, key);
  const source = candidate?.source || {};
  const issues = [...evidenceIssues(artifact)];
  if (!row || row.school_id !== target.school_id || row.slug !== target.slug
      || row.owner_namespace !== target.owner_namespace
      || row.course_code !== target.course_code
      || candidate.school_id !== target.school_id || candidate.slug !== target.slug
      || candidate.owner_namespace !== target.owner_namespace
      || candidate.course_key !== key) issues.push('identity');
  const expectedCandidateHash = target.source_upgrade_from_candidate_projection
    ? target.candidate_raw_entry_sha256 : target.raw_entry_sha256;
  if (source.raw_entry_sha256 !== expectedCandidateHash
      || sha256(String(source.raw_entry_text || '')) !== expectedCandidateHash) {
    issues.push('candidate_projection');
  }
  if (source.official_url !== row?.source?.official_url) issues.push('official_url');
  try {
    exactEntryForArtifactRow(row);
  } catch (error) {
    issues.push(`source_replay:${error.message}`);
  }
  return [...new Set(issues)];
}

function sourceProjection(row, entry) {
  const courseleaf = row.slug === RMC.slug;
  return {
    source_url: row.source.official_url,
    source_content_sha256: row.source.raw_entry_sha256,
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: entry.raw_entry_text,
      content_sha256: row.source.raw_entry_sha256,
    },
    review_evidence_overlay: {
      capture_origin: courseleaf
        ? 'official_acquisition' : 'official_radford_acalog_course_page',
      source_format: courseleaf
        ? 'courseleaf_courseblock' : 'radford_acalog_course_page',
      boundary_contract: row.source.boundary_contract,
      catalog_year_verified: row.source.catalog_year,
      official_url: row.source.official_url,
      source_response_sha256: row.source.source_response_sha256,
      declared_normalized_text_sha256: row.source.source_response_sha256,
      retained_normalized_text_sha256: row.source.source_response_sha256,
      source_response_bytes: row.source.source_response_bytes,
      cache_path: row.source.cache_path,
      courseblock_index: row.source.courseblock_index,
      catoid: row.source.catoid,
      coid: row.source.coid,
      published_units: row.source.published_units,
      raw_entry_html_sha256: row.source.raw_entry_html_sha256,
      raw_entry_sha256: row.source.raw_entry_sha256,
      raw_entry_text: entry.raw_entry_text,
      entry_character_start: 0,
      entry_character_end: entry.raw_entry_text.length,
      heading_text: entry.raw_entry_text.slice(0, 240),
      complete_entry_receipt: courseleaf ? entry.complete_entry_receipt : undefined,
      structured_requisite_fields: courseleaf ? entry.structured_requisite_fields : undefined,
      clauses: [],
    },
  };
}

function proofFor(row) {
  return {
    kind: 'exact_current_complete_entry_zero_figure6_course_edges',
    contract: CONTRACT,
    course_key: row.course_key,
    catalog_year: row.source.catalog_year,
    source_url: row.source.official_url,
    source_response_sha256: row.source.source_response_sha256,
    source_response_bytes: row.source.source_response_bytes,
    raw_entry_sha256: row.source.raw_entry_sha256,
    raw_entry_html_sha256: row.source.raw_entry_html_sha256,
    boundary_contract: row.source.boundary_contract,
    marker_control: row.marker_control,
    literal_none_statement: false,
    retained_non_prerequisite_signals: row.preserved_signals,
    graph_effect: {
      added_course_vertices: 0,
      added_prerequisite_edges: 0,
      added_corequisite_edges: 0,
    },
    content_accounting: row.content_accounting,
    inference_boundary: row.inference_boundary,
  };
}

function blockerFor(row) {
  return {
    contract: CONTRACT,
    disposition: row.disposition,
    course_key: row.course_key,
    source_url: row.source.official_url,
    source_response_sha256: row.source.source_response_sha256,
    raw_entry_sha256: row.source.raw_entry_sha256,
    raw_entry_html_sha256: row.source.raw_entry_html_sha256,
    boundary_contract: row.source.boundary_contract,
    marker_control: row.marker_control,
    preserved_signals: row.preserved_signals,
    prerequisite_formula_inferred: false,
    structural_none_inferred: false,
    source_content_discarded: false,
    blocker_reason:
      'Required prior knowledge names neither an owner-local course nor an assessment/runtime binding.',
    inference_boundary: row.inference_boundary,
  };
}

function resolveRadfordRandolphMaconPrerequisiteTail(
  candidate,
  artifact = loadEvidenceArtifact(),
) {
  if (!isScopedRadfordRandolphMaconTail(candidate)) {
    return { applicable: false, ready: false, blocked: false, issues: [] };
  }
  const key = targetKey(candidate);
  const row = artifactRow(artifact, key);
  const issues = candidateIssues(candidate, artifact);
  if (issues.length) return {
    applicable: true,
    ready: false,
    blocked: row?.disposition === 'blocked_required_prior_knowledge',
    issues,
    review_reason: 'radford_randolph_macon_tail_source_receipt_changed',
  };
  const entry = exactEntryForArtifactRow(row);
  const projection = sourceProjection(row, entry);
  if (row.disposition === 'blocked_required_prior_knowledge') return {
    applicable: true,
    ready: false,
    blocked: true,
    issues: [],
    status: 'unparsed',
    raw_requisites: row.preserved_signals.map((signal) => signal.raw).join(' '),
    groups: [],
    review_status: 'not_promoted',
    review_reason: 'required_prior_knowledge_runtime_binding_unresolved',
    preserved_signals: row.preserved_signals,
    blocker_evidence: blockerFor(row),
    source_projection: projection,
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
    review_reason: 'exact_radford_randolph_macon_zero_course_edge_tail_evidence',
    ignored_nonrequired_requisites: row.preserved_signals,
    structural_none_evidence: proofFor(row),
    source_projection: projection,
  };
}

function absoluteSignals(row, signals) {
  const start = Number(row?.review_evidence?.entry_character_start || 0);
  return (signals || []).map((signal) => ({
    ...signal,
    source_character_start: start + signal.relative_start,
    source_character_end: start + signal.relative_end,
  }));
}

function resolutionRowIssues(row, artifact = loadEvidenceArtifact()) {
  if (!isScopedRadfordRandolphMaconTail(row)) return [];
  const fact = artifactRow(artifact, targetKey(row));
  const issues = [...evidenceIssues(artifact)];
  let entry;
  try {
    entry = exactEntryForArtifactRow(fact);
  } catch (error) {
    return [...new Set([...issues, `source_replay:${error.message}`])];
  }
  const projection = sourceProjection(fact, entry);
  const expectedSignals = absoluteSignals(row, fact.preserved_signals);
  const reviewProjectionChanged = Object.entries(
    projection.review_evidence_overlay,
  ).some(([key, value]) => !same(row.review_evidence?.[key], value));
  if (row.source_url !== projection.source_url
      || row.source_content_sha256 !== projection.source_content_sha256
      || !same(row.source_evidence, projection.source_evidence)
      || reviewProjectionChanged) {
    issues.push('source_projection');
  }
  if (fact.disposition === 'blocked_required_prior_knowledge') {
    if (row.status !== 'unparsed' || row.groups?.length
        || row.review_status !== 'not_promoted'
        || row.review_reason !== 'required_prior_knowledge_runtime_binding_unresolved'
        || row.raw_requisites !== fact.preserved_signals.map((signal) => signal.raw).join(' ')
        || !same(row.preserved_prerequisite_signals, expectedSignals)
        || !same(row.prerequisite_constraint_blocker_evidence, blockerFor(fact))) {
      issues.push('blocked_projection');
    }
  } else if (row.status !== 'none' || row.raw_requisites != null || row.groups?.length
      || row.review_status !== 'promoted_structural_none'
      || row.review_reason !== 'exact_radford_randolph_macon_zero_course_edge_tail_evidence'
      || !same(row.ignored_nonrequired_requisites, expectedSignals)
      || !same(row.structural_none_evidence, proofFor(fact))) {
    issues.push('review_projection');
  }
  return [...new Set(issues)];
}

module.exports = {
  ARTIFACT,
  CACHE_ROOT,
  CONTRACT,
  EVIDENCE_PATH,
  EXPECTED_FACTS_SHA256,
  RADFORD_POPULATION_SHA256,
  RMC_PAGES,
  TARGETS,
  TARGET_KEYS,
  buildEvidence,
  candidateIssues,
  canonicalJson,
  defaultReadFile,
  evidenceIssues,
  evidenceSummary,
  exactEntryForArtifactRow,
  exactSignalReceipts,
  isScopedRadfordRandolphMaconTail,
  loadEvidenceArtifact,
  resolutionRowIssues,
  resolveRadfordRandolphMaconPrerequisiteTail,
  sha256,
  sourceProjection,
  targetKey,
};
