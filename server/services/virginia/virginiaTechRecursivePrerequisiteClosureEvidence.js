/**
 * Exact, standalone disposition of the remaining Virginia Tech recursive
 * Figure 6 prerequisite rows.
 *
 * The shared review promotes only the three ordinary corequisite-only entries.
 * One explicit high-school preparation requirement has a lossless source
 * formula but remains unparsed because Figure 6 has no binding for its typed
 * non-course conditions. The reciprocal ISC pair remains blocked because the
 * production Figure 6 parent-map contract rejects its two directed
 * corequisite edges as a cycle; this module does not invent a one-way
 * canonicalization. CHEM 1014 and CS 3704 remain source blockers.
 */

const { createHash } = require('node:crypto');
const {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  COURSELEAF_STRUCTURED_REQUISITE_FIELD_RECEIPT_CONTRACT,
  requisiteMarkerCounts,
} = require('./universityPrerequisiteAcquisition');

const CONTRACT = 'virginia_tech_recursive_prerequisite_exact_receipts_v1';
const SCHOOL_ID = 9230;
const SLUG = 'virginia-polytechnic-institute-and-state-university';
const OWNER = 'va:uni:9230';
const CATALOG_YEAR = '2026-2027';
const FORMULA = 'paths_or__conditions_and';

const SAFE_COREQUISITE_CODES = Object.freeze([
  'ESM2114',
  'MATH1454',
  'ME4584',
]);
const RECIPROCAL_COREQUISITE_CODES = Object.freeze(['ISC1105', 'ISC1115']);
const SAFE_NON_COURSE_CODES = Object.freeze(['MATH1014']);
const UNDERSPECIFIED_KNOWLEDGE_CODES = Object.freeze(['CHEM1014']);
const CONFLICTING_SOURCE_CODES = Object.freeze(['CS3704']);
const TARGET_CODES = Object.freeze([
  ...SAFE_COREQUISITE_CODES,
  ...RECIPROCAL_COREQUISITE_CODES,
  ...SAFE_NON_COURSE_CODES,
  ...UNDERSPECIFIED_KNOWLEDGE_CODES,
  ...CONFLICTING_SOURCE_CODES,
]);
const TARGET_CODE_SET = new Set(TARGET_CODES);

// Fingerprint the complete candidate and source objects. These values bind the
// browser/robots/sitemap receipts when present, exact response bytes, complete
// courseblock, HTML boundary, units, structured fields, and marker controls.
const EXACT_CANDIDATE_SHA256 = Object.freeze({
  ESM2114: 'cd40f3a1d6c70249c2628ba75b7289fc16dc9341e3e8c115b6b46bc97b93ce89',
  ISC1105: '288d9745cd6db1235f5a94d9df4a5a1bceb1c33906c165b0f932771bbacaf902',
  ISC1115: 'c41a82208eee28084d8b7ab8f6c156f8e209461e359bada234774261200dfea4',
  MATH1454: '55a5d0dfb888acf81fe9fef852706a0bc5d3bc188135df1b6401562a3879175c',
  ME4584: 'a49c92fb537e9a920d04d1ddad03d7190f4716b440c6aea6154d7cbd085693c3',
  MATH1014: '0369444a3172acafa54568e2ddfe8f566a07bd9836504b425ea10e0c9feded9d',
  CHEM1014: 'd8db59d0ddbc5a354c34c91d14784a5ff9e2bc52960cb6df653968c6551ee7d0',
  CS3704: 'a978ff14d08b9ea29331aa694ac79708c76cd4a18e2e43da5647dc3c79b3c366',
});

const EXACT_SOURCE_SHA256 = Object.freeze({
  ESM2114: 'd0d6ac76290120b7e2ebb7a5f0844c31963262427dfb8a45dc2b5516ae52f354',
  ISC1105: 'eae1660929c9c948f82baf000fdfc98e5bad247bf4178be48e8b57a75f551e44',
  ISC1115: '04e0b13e0805842ef8a3d575178193f1738ca1e7e0a2049c5be74319317c1327',
  MATH1454: 'bec7ddd96d920a333d0100f39b960ea20db4ec5abb5f040fdaa282d53192ba27',
  ME4584: '1239a09caed4cbb78e012108d98089639d0e48d7f9439769782b67fbc1abe137',
  MATH1014: 'affb6f1f8dc6370894c72e49139a7947a0d5b0bf4d8f7eb79d8d42a42baf394c',
  CHEM1014: '0cff1e77f512d2ebe58215028b4336dab26772bf8e5cbd8b000e8c5d318e956e',
  CS3704: 'acbfcc93b4ab70ea773bef1b9d93f22f0bd88b90fd818ad903eff4c7e7cae936',
});

const EXACT_RECIPROCAL_FORMULA_SHA256 = Object.freeze({
  ISC1105: '0861b54cc107dd6a6cd03f4baa8fc8ba022993cd69fb0d54b0f700cde62be5e6',
  ISC1115: '823339ee8b3a0e2e6a6d360381aed21c604ef9f8463a960e0bb15982084f58d1',
});
const EXACT_CONTROL_RECEIPT_SHA256 =
  '3c9a959eeeb6d80e7963272c48d6d1dd63f6a3337a3acd54489e196a7db8a5a5';

const COREQUISITE_ROUTES = Object.freeze({
  ESM2114: Object.freeze({
    raw: 'MATH 2204 or MATH 2204H or MATH 2406H.',
    paths: Object.freeze([
      Object.freeze([{ code: 'MATH2204', raw: 'MATH 2204' }]),
      Object.freeze([{ code: 'MATH2204H', raw: 'MATH 2204H' }]),
      Object.freeze([{ code: 'MATH2406H', raw: 'MATH 2406H' }]),
    ]),
  }),
  ISC1105: Object.freeze({
    raw: 'ISC 1115',
    paths: Object.freeze([Object.freeze([{ code: 'ISC1115', raw: 'ISC 1115' }])]),
  }),
  ISC1115: Object.freeze({
    raw: 'ISC 1105',
    paths: Object.freeze([Object.freeze([{ code: 'ISC1105', raw: 'ISC 1105' }])]),
  }),
  MATH1454: Object.freeze({
    raw: 'MATH 1225',
    paths: Object.freeze([Object.freeze([{ code: 'MATH1225', raw: 'MATH 1225' }])]),
  }),
  ME4584: Object.freeze({
    raw: 'ME 4524 or ECE 4704',
    paths: Object.freeze([
      Object.freeze([{ code: 'ME4524', raw: 'ME 4524' }]),
      Object.freeze([{ code: 'ECE4704', raw: 'ECE 4704' }]),
    ]),
  }),
});

const EXACT_STATEMENTS = Object.freeze({
  MATH1014: Object.freeze({
    raw: 'Two units of high school algebra and one of plane geometry are required.',
    algebra: 'Two units of high school algebra',
    geometry: 'one of plane geometry',
  }),
  CHEM1014: Object.freeze({
    raw: 'Mathematical problem solving skills required for success in general chemistry.',
  }),
  CS3704: Object.freeze({
    narrative: 'A grade of C or better required in CS prerequisite 3114.',
    formal: 'CS 2114',
  }),
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

const canonicalSha256 = (value) => sha256(canonicalJson(value));

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function targetCode(candidate) {
  for (const code of [
    normalizeCode(candidate?.course_code),
    normalizeCode(String(candidate?.course_key || '').split(':').at(-1)),
  ]) {
    if (TARGET_CODE_SET.has(code)) return code;
  }
  const sourceFingerprint = canonicalSha256(candidate?.source || null);
  return TARGET_CODES.find((code) => EXACT_SOURCE_SHA256[code] === sourceFingerprint) || null;
}

function candidateIssues(candidate, code) {
  const source = candidate?.source;
  const issues = [];
  if (candidate?.school_id !== SCHOOL_ID
      || candidate?.slug !== SLUG
      || candidate?.owner_namespace !== OWNER
      || candidate?.course_key !== `${OWNER}:${code}`
      || candidate?.course_code !== code) issues.push('candidate_identity');
  if (source?.capture_origin !== 'official_acquisition'
      || source?.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT
      || source?.source_format !== 'courseleaf_courseblock'
      || source?.catalog_year_verified !== CATALOG_YEAR) issues.push('source_boundary');
  const receipt = source?.complete_entry_receipt;
  if (receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
      || receipt?.same_source_positive_control !== true
      || !Number.isInteger(receipt?.source_courseblock_count)
      || !Number.isInteger(receipt?.source_complete_entry_count)
      || !Number.isInteger(receipt?.source_complete_entries_with_required_requisite_marker_count)
      || receipt.source_complete_entries_with_required_requisite_marker_count <= 0
      || !Number.isInteger(source?.source_response_bytes)
      || source.source_response_bytes <= 0) issues.push('complete_entry_receipt');
  if (sha256(source?.raw_entry_text || '') !== source?.raw_entry_sha256) {
    issues.push('raw_entry_sha256');
  }
  if (canonicalSha256(source) !== EXACT_SOURCE_SHA256[code]) issues.push('source_fingerprint');
  if (canonicalSha256(candidate) !== EXACT_CANDIDATE_SHA256[code]) {
    issues.push('candidate_fingerprint');
  }
  return [...new Set(issues)].sort();
}

function exactUniqueStatement(rawEntryText, raw, kind) {
  const source = String(rawEntryText || '');
  const relativeStart = source.indexOf(raw);
  if (relativeStart < 0 || source.indexOf(raw, relativeStart + raw.length) >= 0) {
    throw new Error(`Virginia Tech ${kind} statement is absent or non-unique`);
  }
  return {
    kind,
    raw,
    raw_sha256: sha256(raw),
    relative_start: relativeStart,
    relative_end: relativeStart + raw.length,
  };
}

function subspan(statement, raw, kind) {
  const relative = statement.raw.indexOf(raw);
  if (relative < 0 || statement.raw.indexOf(raw, relative + raw.length) >= 0) {
    throw new Error(`Virginia Tech ${kind} subspan is absent or non-unique`);
  }
  const relativeStart = statement.relative_start + relative;
  return {
    kind,
    raw,
    raw_sha256: sha256(raw),
    relative_start: relativeStart,
    relative_end: relativeStart + raw.length,
  };
}

function exactStructuredField(candidate, kind) {
  const fields = candidate?.source?.structured_requisite_fields;
  if (!Array.isArray(fields)) throw new Error('Virginia Tech structured fields are missing');
  const matches = fields.filter((field) => field?.kind === kind);
  if (matches.length !== 1) throw new Error(`Virginia Tech ${kind} field is not unique`);
  const field = matches[0];
  const expectedClass = kind === 'corequisite' ? 'detail-coreq' : 'detail-prereq';
  const marker = `${field.label}:`;
  const source = String(candidate.source.raw_entry_text || '');
  if (field.receipt_contract !== COURSELEAF_STRUCTURED_REQUISITE_FIELD_RECEIPT_CONTRACT
      || field.structural_class !== expectedClass
      || sha256(field.raw || '') !== field.raw_sha256
      || sha256(field.raw_field_text || '') !== field.raw_field_text_sha256
      || source.slice(field.relative_start, field.relative_end) !== field.raw
      || source.slice(field.field_relative_start, field.field_relative_end)
        !== field.raw_field_text
      || source.slice(field.statement_relative_start,
        field.statement_relative_start + marker.length) !== marker
      || field.statement_relative_end !== field.relative_end
      || field.field_relative_start > field.statement_relative_start
      || field.field_relative_end < field.statement_relative_end) {
    throw new Error(`Virginia Tech ${kind} field receipt changed`);
  }
  return field;
}

function exactMarkerControl(candidate, expected) {
  const receipt = candidate?.source?.complete_entry_receipt;
  const markers = requisiteMarkerCounts(candidate?.source?.raw_entry_text);
  const expectedMarkers = {
    required: expected.required,
    corequisite: expected.corequisite,
    marker_like: expected.marker_like,
    constraint_like: expected.constraint_like,
  };
  const actualReceipt = {
    required: receipt?.entry_required_requisite_marker_count,
    corequisite: receipt?.entry_corequisite_marker_count,
    marker_like: receipt?.entry_requisite_marker_like_count,
    constraint_like: receipt?.entry_constraint_like_signal_count,
  };
  if (canonicalJson(markers) !== canonicalJson(expectedMarkers)
      || canonicalJson(actualReceipt) !== canonicalJson(expectedMarkers)) {
    throw new Error(`${candidate.course_code} complete-entry marker accounting changed`);
  }
  return { raw_text_marker_counts: markers, complete_entry_receipt_counts: actualReceipt };
}

function courseCondition(code, raw) {
  const normalized = normalizeCode(code);
  if (!normalized) throw new Error(`invalid Virginia Tech course code ${code}`);
  return {
    type: 'course',
    code: normalized,
    course_key: `${OWNER}:${normalized}`,
    raw,
    concurrent_allowed: true,
    source_field_kind: 'corequisite',
  };
}

function nonCourseCondition(condition, raw, extra) {
  return { type: 'non_course', condition, raw, ...extra };
}

function exactGroup(candidate, kind, raw, paths, flags = []) {
  const id = `${candidate.course_key}:${kind}:0`;
  return {
    id,
    kind,
    raw,
    flags: [
      'strict_full_text_accounting',
      `source:${SLUG}`,
      CONTRACT,
      ...flags,
    ],
    formula: FORMULA,
    paths: paths.map((allOf, index) => ({
      id: `${id}:path:${index}`,
      raw: allOf.map((condition) => condition.raw).join(' and '),
      all_of: allOf,
    })),
  };
}

function completeEntryProof(candidate, code, modeledStatements, extra = {}) {
  return {
    contract: CONTRACT,
    candidate_sha256: EXACT_CANDIDATE_SHA256[code],
    source_sha256: EXACT_SOURCE_SHA256[code],
    source_response_sha256: candidate.source.source_response_sha256,
    source_response_bytes: candidate.source.source_response_bytes,
    source_cache_path: candidate.source.cache_path,
    courseblock_index: candidate.source.courseblock_index,
    raw_entry_sha256: candidate.source.raw_entry_sha256,
    raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
    published_units: candidate.source.published_units,
    complete_entry_receipt: candidate.source.complete_entry_receipt,
    modeled_statements: modeledStatements,
    content_accounting: {
      every_required_or_corequisite_marker_accounted_for: true,
      required_content_discarded: false,
      source_content_discarded: false,
    },
    ...extra,
  };
}

function exactCorequisiteFormula(candidate, code) {
  const expected = COREQUISITE_ROUTES[code];
  if (!expected) throw new Error(`no exact Virginia Tech corequisite route for ${code}`);
  const field = exactStructuredField(candidate, 'corequisite');
  const markerControl = exactMarkerControl(candidate, {
    required: 0, corequisite: 1, marker_like: 1, constraint_like: 0,
  });
  if (candidate.source.structured_requisite_fields.length !== 1
      || field.raw !== expected.raw) {
    throw new Error(`${code} exact corequisite-only boundary changed`);
  }
  const group = exactGroup(
    candidate,
    'corequisite',
    field.raw,
    expected.paths.map((path) => path.map((token) => courseCondition(token.code, token.raw))),
    [
      'exact_courseleaf_corequisite_only_entry',
      'zero_required_prerequisite_markers_preserved',
      'status_is_parsed_never_none',
    ],
  );
  return {
    raw_requisites: field.raw_field_text,
    groups: [group],
    proof: completeEntryProof(candidate, code, [field], {
      marker_control: markerControl,
      graph_semantics: {
        corequisites_are_directed_edges: true,
        reciprocal_corequisite_canonicalization_published: false,
      },
    }),
  };
}

function resolveMath1014(candidate) {
  if (candidate.source.structured_requisite_fields.length !== 0) {
    throw new Error('MATH1014 gained a structured requisite field');
  }
  const markerControl = exactMarkerControl(candidate, {
    required: 0, corequisite: 0, marker_like: 0, constraint_like: 1,
  });
  const expected = EXACT_STATEMENTS.MATH1014;
  const statement = exactUniqueStatement(
    candidate.source.raw_entry_text, expected.raw, 'high-school preparation',
  );
  const algebra = subspan(statement, expected.algebra, 'high-school algebra');
  const geometry = subspan(statement, expected.geometry, 'plane geometry');
  const conditions = [
    nonCourseCondition('minimum_high_school_algebra_units', expected.algebra, {
      education_level: 'high_school',
      subject: 'algebra',
      minimum_published_units: 2,
      published_unit_term: 'units',
      required: true,
      source_evidence: algebra,
    }),
    nonCourseCondition('minimum_high_school_plane_geometry_units', expected.geometry, {
      education_level: 'high_school',
      subject: 'plane_geometry',
      minimum_published_units: 1,
      published_unit_term: 'unit',
      required: true,
      source_evidence: geometry,
    }),
  ];
  return {
    raw_requisites: expected.raw,
    groups: [exactGroup(candidate, 'prerequisite', expected.raw, [conditions], [
      'exact_narrative_high_school_preparation_requirement',
      'typed_non_course_conditions',
      'runtime_condition_bindings_required',
    ])],
    proof: completeEntryProof(candidate, 'MATH1014', [statement, algebra, geometry], {
      marker_control: markerControl,
      runtime_graph_semantics: {
        formula_source_ready: true,
        zero_edge_inference_authorized: false,
        explicit_condition_bindings_required_if_course_is_in_pathway: true,
      },
    }),
  };
}

function auditChem1014(candidate) {
  if (candidate.source.structured_requisite_fields.length !== 0) {
    throw new Error('CHEM1014 gained a structured requisite field');
  }
  const markerControl = exactMarkerControl(candidate, {
    required: 0, corequisite: 0, marker_like: 0, constraint_like: 1,
  });
  const statement = exactUniqueStatement(
    candidate.source.raw_entry_text,
    EXACT_STATEMENTS.CHEM1014.raw,
    'required mathematical knowledge',
  );
  return {
    proof: completeEntryProof(candidate, 'CHEM1014', [statement], {
      marker_control: markerControl,
      required_knowledge: {
        raw: statement.raw,
        domain: 'mathematical_problem_solving_skills',
        satisfaction_course_published: false,
        satisfaction_assessment_published: false,
        satisfaction_threshold_published: false,
        formula_emitted: false,
        status_none_authorized: false,
      },
    }),
  };
}

function auditCs3704(candidate) {
  const field = exactStructuredField(candidate, 'prerequisite');
  const markerControl = exactMarkerControl(candidate, {
    required: 1, corequisite: 0, marker_like: 2, constraint_like: 1,
  });
  if (candidate.source.structured_requisite_fields.length !== 1
      || field.raw !== EXACT_STATEMENTS.CS3704.formal) {
    throw new Error('CS3704 formal prerequisite boundary changed');
  }
  const narrative = exactUniqueStatement(
    candidate.source.raw_entry_text,
    EXACT_STATEMENTS.CS3704.narrative,
    'minimum-grade prerequisite',
  );
  return {
    proof: completeEntryProof(candidate, 'CS3704', [narrative, field], {
      marker_control: markerControl,
      source_conflict: {
        narrative_assertion: {
          course_code: 'CS3114', minimum_grade: 'C', evidence: narrative,
        },
        formal_courseleaf_field: {
          course_code: 'CS2114', minimum_grade_published: null, evidence: field,
        },
        conflicting_course_codes: ['CS3114', 'CS2114'],
        typo_resolution_inferred: false,
        formula_emitted: false,
        status_none_authorized: false,
      },
    }),
  };
}

function controlReceipt(control) {
  return {
    contract: control.contract,
    target_codes: control.target_codes,
    candidate_sha256_by_code: control.candidate_sha256_by_code,
    reciprocal_pair: control.reciprocal_pair,
  };
}

function buildVirginiaTechRecursivePrerequisiteControl(candidates = []) {
  const issues = [];
  const byCode = new Map();
  for (const candidate of candidates) {
    if (candidate?.owner_namespace !== OWNER || !TARGET_CODE_SET.has(candidate?.course_code)) continue;
    if (byCode.has(candidate.course_code)) issues.push(`${candidate.course_code}:duplicate_candidate`);
    else byCode.set(candidate.course_code, candidate);
  }
  for (const code of TARGET_CODES) {
    const candidate = byCode.get(code);
    if (!candidate) {
      issues.push(`${code}:candidate_missing`);
      continue;
    }
    issues.push(...candidateIssues(candidate, code).map((issue) => `${code}:${issue}`));
  }
  let reciprocalPair = null;
  if (!issues.length) {
    try {
      const left = exactCorequisiteFormula(byCode.get('ISC1105'), 'ISC1105');
      const right = exactCorequisiteFormula(byCode.get('ISC1115'), 'ISC1115');
      const leftTarget = left.groups[0].paths[0].all_of[0].course_key;
      const rightTarget = right.groups[0].paths[0].all_of[0].course_key;
      if (leftTarget !== `${OWNER}:ISC1115` || rightTarget !== `${OWNER}:ISC1105`) {
        throw new Error('reciprocal ISC corequisite targets changed');
      }
      reciprocalPair = {
        course_keys: [`${OWNER}:ISC1105`, `${OWNER}:ISC1115`],
        directed_edges: [
          { from: `${OWNER}:ISC1115`, to: `${OWNER}:ISC1105`, kind: 'corequisite' },
          { from: `${OWNER}:ISC1105`, to: `${OWNER}:ISC1115`, kind: 'corequisite' },
        ],
        source_formulas: {
          ISC1105: left,
          ISC1115: right,
        },
        source_publishes_canonical_one_way_edge: false,
        production_cycle_exemption_contract_present: false,
      };
    } catch (error) {
      issues.push(`ISC_pair:${error.message}`);
    }
  }
  const control = {
    contract: CONTRACT,
    verified: issues.length === 0,
    issues: [...new Set(issues)].sort(),
    target_codes: [...TARGET_CODES],
    candidate_sha256_by_code: { ...EXACT_CANDIDATE_SHA256 },
    reciprocal_pair: reciprocalPair,
  };
  control.receipt_sha256 = sha256(canonicalJson(controlReceipt(control)));
  return control;
}

function controlIssues(control) {
  const issues = [];
  if (control?.contract !== CONTRACT || control?.verified !== true
      || !Array.isArray(control?.issues) || control.issues.length !== 0) {
    issues.push('control_status');
  }
  if (canonicalJson(control?.target_codes) !== canonicalJson(TARGET_CODES)
      || canonicalJson(control?.candidate_sha256_by_code)
        !== canonicalJson(EXACT_CANDIDATE_SHA256)) issues.push('control_population');
  const pair = control?.reciprocal_pair;
  if (canonicalJson(pair?.course_keys) !== canonicalJson([
    `${OWNER}:ISC1105`, `${OWNER}:ISC1115`,
  ]) || canonicalJson(pair?.directed_edges) !== canonicalJson([
    { from: `${OWNER}:ISC1115`, to: `${OWNER}:ISC1105`, kind: 'corequisite' },
    { from: `${OWNER}:ISC1105`, to: `${OWNER}:ISC1115`, kind: 'corequisite' },
  ]) || pair?.source_publishes_canonical_one_way_edge !== false
      || pair?.production_cycle_exemption_contract_present !== false) {
    issues.push('reciprocal_pair');
  }
  if (canonicalSha256(pair?.source_formulas?.ISC1105)
        !== EXACT_RECIPROCAL_FORMULA_SHA256.ISC1105
      || canonicalSha256(pair?.source_formulas?.ISC1115)
        !== EXACT_RECIPROCAL_FORMULA_SHA256.ISC1115) {
    issues.push('reciprocal_source_formulas');
  }
  if (control?.receipt_sha256 !== EXACT_CONTROL_RECEIPT_SHA256
      || control.receipt_sha256 !== sha256(canonicalJson(controlReceipt(control)))) {
    issues.push('control_receipt_sha256');
  }
  return [...new Set(issues)].sort();
}

function resolveVirginiaTechRecursivePrerequisiteCandidate(candidate, control = null) {
  const code = targetCode(candidate);
  if (!code) return { applicable: false, ready: false, issues: [] };
  const issues = candidateIssues(candidate, code);
  if (issues.length) return {
    applicable: true,
    ready: false,
    code,
    classification: 'exact_receipt_changed',
    issues,
    review_reason: 'virginia_tech_recursive_exact_candidate_or_source_receipt_changed',
  };

  try {
    if (SAFE_COREQUISITE_CODES.includes(code)) {
      return {
        applicable: true,
        ready: true,
        code,
        classification: 'safe_exact_corequisite_formula',
        status: 'parsed',
        issues: [],
        review_reason: 'virginia_tech_exact_recursive_corequisite_resolved',
        ...exactCorequisiteFormula(candidate, code),
      };
    }
    if (RECIPROCAL_COREQUISITE_CODES.includes(code)) {
      const pairIssues = controlIssues(control);
      if (pairIssues.length) throw new Error(`ISC reciprocal control changed: ${pairIssues.join(',')}`);
      return {
        applicable: true,
        ready: false,
        code,
        classification: 'reciprocal_corequisite_cycle_not_supported',
        issues: ['requisite_graph_cycle'],
        review_reason: 'virginia_tech_reciprocal_corequisite_pair_requires_graph_contract',
        proof: {
          ...control.reciprocal_pair.source_formulas[code].proof,
          exact_source_formula: control.reciprocal_pair.source_formulas[code],
          reciprocal_pair: control.reciprocal_pair,
          formula_emitted: false,
          one_way_edge_inferred: false,
          inference_boundary:
            'Both exact entries publish the opposite course as a corequisite. The current Figure 6 parent map treats corequisites as directed edges and rejects their reciprocal cycle. No retained source or production contract authorizes dropping either direction or contracting the pair into one vertex.',
        },
      };
    }
    if (code === 'MATH1014') {
      return {
        applicable: true,
        ready: true,
        code,
        classification: 'safe_exact_typed_non_course_formula',
        status: 'parsed',
        issues: [],
        review_reason: 'virginia_tech_exact_high_school_preparation_resolved',
        ...resolveMath1014(candidate),
      };
    }
    if (code === 'CHEM1014') {
      return {
        applicable: true,
        ready: false,
        code,
        classification: 'underspecified_required_knowledge',
        issues: ['required_knowledge_satisfaction_not_published'],
        review_reason: 'virginia_tech_required_knowledge_has_no_satisfaction_rule',
        ...auditChem1014(candidate),
      };
    }
    return {
      applicable: true,
      ready: false,
      code,
      classification: 'conflicting_source_requirements',
      issues: ['conflicting_prerequisite_course_codes'],
      review_reason: 'virginia_tech_narrative_and_formal_prerequisite_conflict',
      ...auditCs3704(candidate),
    };
  } catch (error) {
    return {
      applicable: true,
      ready: false,
      code,
      classification: 'exact_receipt_changed',
      issues: [error.message],
      review_reason: 'virginia_tech_recursive_exact_candidate_or_source_receipt_changed',
    };
  }
}

function summarizeVirginiaTechRecursivePrerequisites(candidates = []) {
  const control = buildVirginiaTechRecursivePrerequisiteControl(candidates);
  const rows = candidates.map((candidate) => (
    resolveVirginiaTechRecursivePrerequisiteCandidate(candidate, control)
  )).filter((row) => row.applicable).sort((a, b) => a.code.localeCompare(b.code));
  return {
    contract: CONTRACT,
    target_count: TARGET_CODES.length,
    source_formula_ready_count: rows.filter((row) => row.ready).length,
    source_formula_ready_codes: rows.filter((row) => row.ready).map((row) => row.code),
    reciprocal_cycle_blocked_codes: rows.filter((row) => (
      row.classification === 'reciprocal_corequisite_cycle_not_supported'
    )).map((row) => row.code),
    underspecified_knowledge_codes: rows.filter((row) => (
      row.classification === 'underspecified_required_knowledge'
    )).map((row) => row.code),
    conflicting_source_codes: rows.filter((row) => (
      row.classification === 'conflicting_source_requirements'
    )).map((row) => row.code),
    exact_receipt_failures: rows.filter((row) => (
      row.classification === 'exact_receipt_changed'
    )).map((row) => row.code),
  };
}

function reviewProofIssues(row, code, proof) {
  const evidence = row?.review_evidence;
  const issues = [];
  if (proof?.contract !== CONTRACT
      || proof?.candidate_sha256 !== EXACT_CANDIDATE_SHA256[code]
      || proof?.source_sha256 !== EXACT_SOURCE_SHA256[code]) {
    issues.push('exact_fingerprints');
  }
  if (proof?.source_response_sha256 !== evidence?.source_response_sha256
      || proof?.source_response_bytes !== evidence?.source_response_bytes
      || proof?.source_cache_path !== evidence?.cache_path
      || proof?.courseblock_index !== evidence?.courseblock_index
      || proof?.raw_entry_sha256 !== evidence?.raw_entry_sha256
      || proof?.raw_entry_html_sha256 !== evidence?.raw_entry_html_sha256
      || canonicalJson(proof?.published_units) !== canonicalJson(evidence?.published_units)
      || canonicalJson(proof?.complete_entry_receipt)
        !== canonicalJson(evidence?.complete_entry_receipt)) {
    issues.push('source_binding');
  }
  if (proof?.content_accounting?.every_required_or_corequisite_marker_accounted_for !== true
      || proof?.content_accounting?.required_content_discarded !== false
      || proof?.content_accounting?.source_content_discarded !== false) {
    issues.push('content_accounting');
  }
  return issues;
}

function expectedCorequisiteGroup(code) {
  const expected = COREQUISITE_ROUTES[code];
  return exactGroup(
    { course_key: `${OWNER}:${code}` },
    'corequisite',
    expected.raw,
    expected.paths.map((formulaPath) => (
      formulaPath.map((token) => courseCondition(token.code, token.raw))
    )),
    [
      'exact_courseleaf_corequisite_only_entry',
      'zero_required_prerequisite_markers_preserved',
      'status_is_parsed_never_none',
    ],
  );
}

/**
 * Validate the finite shared-review projection without needing the mutable
 * candidate artifact. Artifact replay separately rebuilds from candidates;
 * this check protects the publication adapter from a row whose formula or
 * attached receipt was edited after review generation.
 */
function resolutionRowIssues(row) {
  const code = normalizeCode(row?.code);
  if (row?.owner_namespace !== OWNER || !TARGET_CODE_SET.has(code)) return [];
  const issues = [];
  const resolution = row?.virginia_tech_recursive_prerequisite_resolution;
  if (row?.school_id !== SCHOOL_ID || row?.slug !== SLUG
      || row?.course_key !== `${OWNER}:${code}` || resolution?.code !== code) {
    issues.push('identity');
  }
  const proof = resolution?.proof;
  issues.push(...reviewProofIssues(row, code, proof));

  if (SAFE_COREQUISITE_CODES.includes(code)) {
    if (row?.status !== 'parsed' || row?.review_status !== 'promoted_strict_formula'
        || row?.review_reason !== 'virginia_tech_exact_recursive_corequisite_resolved'
        || row?.raw_requisites
          !== row?.review_evidence?.structured_requisite_fields?.[0]?.raw_field_text
        || canonicalJson(row?.groups) !== canonicalJson([expectedCorequisiteGroup(code)])
        || resolution?.classification !== 'safe_exact_corequisite_formula'
        || resolution?.integration_disposition?.promoted !== true
        || resolution?.integration_disposition?.status !== 'parsed'
        || resolution?.integration_disposition?.formula_emitted !== true
        || resolution?.integration_disposition?.source_evidence_preserved !== true) {
      issues.push('promoted_formula_projection');
    }
    return [...new Set(issues)].sort();
  }

  if (row?.status !== 'unparsed' || row?.review_status !== 'not_promoted'
      || !Array.isArray(row?.groups) || row.groups.length !== 0
      || resolution?.integration_disposition?.promoted !== false
      || resolution?.integration_disposition?.status !== 'unparsed'
      || resolution?.integration_disposition?.formula_emitted !== false
      || resolution?.integration_disposition?.source_evidence_preserved !== true) {
    issues.push('blocked_projection');
  }
  if (code === 'MATH1014') {
    if (row?.raw_requisites !== EXACT_STATEMENTS.MATH1014.raw
        || row?.review_reason
          !== 'virginia_tech_high_school_non_course_condition_runtime_unresolved'
        || row?.parser_error !== 'non_course_formula_path_unresolved'
        || resolution?.classification !== 'safe_exact_typed_non_course_formula'
        || resolution?.integration_disposition?.blocker
          !== 'non_course_formula_path_unresolved'
        || proof?.runtime_graph_semantics?.zero_edge_inference_authorized !== false
        || proof?.runtime_graph_semantics
          ?.explicit_condition_bindings_required_if_course_is_in_pathway !== true) {
      issues.push('math1014_runtime_blocker');
    }
  } else if (RECIPROCAL_COREQUISITE_CODES.includes(code)) {
    if (row?.review_reason
          !== 'virginia_tech_reciprocal_corequisite_pair_requires_graph_contract'
        || row?.parser_error !== 'requisite_graph_cycle'
        || resolution?.classification !== 'reciprocal_corequisite_cycle_not_supported'
        || resolution?.proof?.formula_emitted !== false
        || resolution?.proof?.one_way_edge_inferred !== false
        || resolution?.integration_disposition?.blocker !== 'requisite_graph_cycle') {
      issues.push('reciprocal_cycle_blocker');
    }
  } else if (code === 'CHEM1014') {
    if (row?.review_reason !== 'virginia_tech_required_knowledge_has_no_satisfaction_rule'
        || row?.parser_error !== 'required_knowledge_satisfaction_not_published'
        || resolution?.classification !== 'underspecified_required_knowledge'
        || proof?.required_knowledge?.formula_emitted !== false
        || proof?.required_knowledge?.status_none_authorized !== false) {
      issues.push('knowledge_blocker');
    }
  } else if (code === 'CS3704' && (
    row?.review_reason !== 'strict_formula_parser_rejected'
      || row?.parser_error !== 'conflicting_prerequisite_course_codes'
      || resolution?.classification !== 'conflicting_source_requirements'
      || canonicalJson(proof?.source_conflict?.conflicting_course_codes)
        !== canonicalJson(['CS3114', 'CS2114'])
      || proof?.source_conflict?.formula_emitted !== false
      || proof?.source_conflict?.typo_resolution_inferred !== false
  )) issues.push('source_conflict_blocker');
  return [...new Set(issues)].sort();
}

module.exports = {
  CATALOG_YEAR,
  CONFLICTING_SOURCE_CODES,
  CONTRACT,
  COREQUISITE_ROUTES,
  EXACT_CANDIDATE_SHA256,
  EXACT_CONTROL_RECEIPT_SHA256,
  EXACT_RECIPROCAL_FORMULA_SHA256,
  EXACT_SOURCE_SHA256,
  EXACT_STATEMENTS,
  FORMULA,
  OWNER,
  RECIPROCAL_COREQUISITE_CODES,
  SAFE_COREQUISITE_CODES,
  SAFE_NON_COURSE_CODES,
  SCHOOL_ID,
  SLUG,
  TARGET_CODES,
  UNDERSPECIFIED_KNOWLEDGE_CODES,
  buildVirginiaTechRecursivePrerequisiteControl,
  canonicalJson,
  canonicalSha256,
  exactCorequisiteFormula,
  resolveVirginiaTechRecursivePrerequisiteCandidate,
  resolutionRowIssues,
  sha256,
  summarizeVirginiaTechRecursivePrerequisites,
};
