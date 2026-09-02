/**
 * Source contract for a publishable Virginia Figure 6 prerequisite graph.
 *
 * Virginia's existing graph tab owns the exact VCCS formulas. Figure 6 also
 * needs the equivalent university-local corpus; Transfer Virginia landing
 * equivalencies are not evidence of a university course's prerequisites.
 * Both sides use an OR-of-AND formula so alternatives such as
 * `(A + B) OR (C + D)` survive without being flattened to an AND-of-OR.
 */

const crypto = require('node:crypto');
const {
  BRIDGEWATER_BOUNDARY_CONTRACT,
  BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT,
  bridgewaterUnmodeledTimingSignals,
} = require('./bridgewaterCleanCatalogPrerequisiteAcquisition');
const {
  projectionRowIssues: vsuEnglishProjectionRowIssues,
} = require('./virginiaStateEnglishPrerequisiteEvidence');
const {
  CONTRACT: VSU_PREREQUISITE_CLOSURE_CONTRACT,
  resolutionRowIssues: vsuPrerequisiteClosureResolutionRowIssues,
} = require('./virginiaStatePrerequisiteClosureEvidence');
const {
  CONTRACT: NORFOLK_STATE_PREREQUISITE_CLOSURE_CONTRACT,
  resolutionRowIssues: norfolkStatePrerequisiteClosureResolutionRowIssues,
} = require('./norfolkStatePrerequisiteClosureEvidence');
const {
  CONTRACT: VCU_PREREQUISITE_CLOSURE_CONTRACT,
  vcuPrerequisiteResolutionRowIssues,
} = require('./vcuPrerequisiteClosureEvidence');
const {
  CONTRACT: SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
  loadEvidenceArtifact: loadSmallUniversityPrerequisiteEvidence,
  resolutionRowIssues: smallUniversityPrerequisiteResolutionRowIssues,
} = require('./smallUniversityPrerequisiteClosureEvidence');
const {
  CONTRACT: UNIVERSITY_PREREQUISITE_TAIL_CONTRACT,
  loadUniversityPrerequisiteTailControl,
  resolutionRowIssues: universityPrerequisiteTailResolutionRowIssues,
} = require('./universityPrerequisiteTailClosureEvidence');
const {
  CONTRACT: RADFORD_RANDOLPH_MACON_TAIL_CONTRACT,
  loadEvidenceArtifact: loadRadfordRandolphMaconTailEvidence,
  resolutionRowIssues: radfordRandolphMaconTailResolutionRowIssues,
} = require('./radfordRandolphMaconPrerequisiteTailEvidence');
const {
  CONTRACT: REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT,
  isScopedRemainingUniversityPrerequisite,
  loadEvidenceArtifact: loadRemainingUniversityPrerequisiteEvidence,
  resolutionRowIssues: remainingUniversityPrerequisiteResolutionRowIssues,
} = require('./remainingUniversityPrerequisiteClosureEvidence');
const {
  CONTRACT: VCU_EGMN_PREREQUISITE_CONTRACT,
  isScopedVcuEgmnPrerequisite,
  loadEvidenceArtifact: loadVcuEgmnPrerequisiteEvidence,
  resolutionRowIssues: vcuEgmnPrerequisiteResolutionRowIssues,
} = require('./vcuEgmnOutsideScopePrerequisiteEvidence');
const {
  loadEvidenceArtifact: loadRadfordUvaWiseRecursiveEvidence,
  resolutionRowIssues: radfordUvaWiseRecursiveResolutionRowIssues,
} = require('./radfordUvaWiseRecursivePrerequisiteEvidence');
const {
  resolutionRowIssues: virginiaTechRecursivePrerequisiteResolutionRowIssues,
} = require('./virginiaTechRecursivePrerequisiteClosureEvidence');
const {
  CONTRACT: GEORGE_MASON_SILENCE_CONTRACT,
  resolutionRowIssues: georgeMasonSilenceResolutionRowIssues,
} = require('./georgeMasonPrerequisiteSilenceEvidence');
const {
  CONTRACT: GEORGE_MASON_CLOSURE_CONTRACT,
  cachedCyseResolutionRowIssues: georgeMasonCachedCyseResolutionRowIssues,
  closureResolutionRowIssues: georgeMasonClosureResolutionRowIssues,
} = require('./georgeMasonPrerequisiteClosureAudit');
const {
  CNU_ENGL123_STRUCTURAL_NONE_KIND,
  cnuEngl123ResolutionRowIssues,
} = require('./christopherNewportEngl123PrerequisiteEvidence');
const {
  ODU_STRUCTURAL_NONE_KIND,
  oldDominionResolutionRowIssues,
} = require('./oldDominionPrerequisiteClosureEvidence');
const {
  STRUCTURAL_NONE_KIND: FIGURE6_NONCOURSE_STRUCTURAL_NONE_KIND,
  figure6NonCourseDispositionResolutionRowIssues,
} = require('./figure6NonCoursePrerequisiteDisposition');

const FORMULA = 'paths_or__conditions_and';
const BLOCKER = 'virginia_figure6_prerequisite_model_unavailable';
const VCCS_OWNER_NAMESPACE = 'va:vccs';
const VCCS_MASTER_RECORD_CONTRACT = 'vccs-master-dt-dd-endtext-v1';
const SOUTHWEST_OWNER_RECORD_CONTRACT = 'southwest-courseleaf-single-course-record-v1';
const SOUTHWEST_RESPONSE_CAPTURE_CONTRACT = 'southwest-courseleaf-preview-course-fragment-v1';
const COURSELEAF_UNIVERSITY_BOUNDARY_CONTRACT =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_UNIVERSITY_RECEIPT_CONTRACT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const COURSELEAF_UNIVERSITY_STRUCTURAL_NONE_KIND =
  'official_complete_entry_structural_silence_with_same_source_positive_control';
const BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT =
  'bridgewater_cleancatalog_complete_entry_cross_response_requisite_marker_control_v1';
const BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_KIND =
  'official_complete_bridgewater_cleancatalog_entry_structural_silence_with_same_edition_positive_controls';
const UVA_WISE_UNIVERSITY_BOUNDARY_CONTRACT =
  'uva_wise_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1';
const UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT =
  'uva_wise_acalog_complete_entry_cross_response_required_marker_control_v1';
const UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_KIND =
  'official_complete_entry_structural_silence_with_same_catalog_positive_control';
const SHENANDOAH_UNIVERSITY_BOUNDARY_CONTRACT =
  'shenandoah_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1';
const SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT =
  'shenandoah_acalog_complete_entry_cross_response_required_marker_control_v1';
const SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_KIND =
  'official_complete_shenandoah_acalog_entry_structural_silence_with_same_catalog_positive_control';
const VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT =
  'virginia_tech_current_graduate_cs_unique_heading_to_next_heading_v1';
const VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_RECEIPT_CONTRACT =
  'virginia_tech_current_graduate_cs_complete_entry_zero_marker_with_same_page_controls_v1';
const VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_KIND =
  'official_current_virginia_tech_graduate_cs_complete_entry_structural_silence';
const SHA256 = /^[a-f0-9]{64}$/;
const RECEIPT_DECISION = 'approved_for_figure6_publication';
const RECEIPT_METHOD = 'independent_human_review';
const RECEIPT_ARTIFACT = 'virginia_figure6_prerequisite_verification_receipt';
const RECEIPT_STATEMENT = 'I independently reviewed this exact Virginia Figure 6 prerequisite generation and approve it for publication.';
const RECEIPT_ATTESTATIONS = Object.freeze([
  'official_source_hosts_and_content',
  'complete_direct_and_recursive_closure',
  'lossless_formula_transcription',
  'explicit_none_findings',
]);

const VA_FIGURE6_PREREQUISITE_CONTRACT = Object.freeze({
  version: 'va-figure6-prerequisites-v2',
  formula: FORMULA,
  community_college: Object.freeze({
    collection: 'va_course_requisites',
    owner_namespace: 'va:vccs',
    authority: 'vccs_master_course_file',
    owner_complete_authority: 'official_owner_catalog_course_entry',
    explicit_no_prerequisite_status: 'none',
  }),
  university: Object.freeze({
    collection: 'va_university_course_requisites',
    owner_namespace: 'va:uni:<school_id>',
    authority: 'institution_catalog',
    explicit_no_prerequisite_status: 'none',
  }),
  publication: Object.freeze({
    generation: 'sha256 of both canonical corpora, both required direct sets, source evidence, and official-host allowlists',
    source_evidence_kind: 'official_course_entry',
    receipt_decision: RECEIPT_DECISION,
    receipt_method: RECEIPT_METHOD,
  }),
});

const asArray = (value) => Array.isArray(value) ? value : [];
const keyOf = (row) => String(row?.course_key || '').trim();
const normalizedCourseCode = (value) => {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
};

function canonicalValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { $binary_base64: value.toString('base64') };
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    if (value._bsontype) {
      const rendered = typeof value.toHexString === 'function'
        ? value.toHexString() : String(value);
      return { $bson_type: value._bsontype, value: rendered };
    }
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

const canonicalJson = (value) => JSON.stringify(canonicalValue(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function urlHost(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function officialHostsForPrerequisiteScope(universityScope = {}) {
  const result = {
    [VCCS_OWNER_NAMESPACE]: ['courses.vccs.edu', 'catalog.sw.edu', 'laurelridge.edu'],
  };
  for (const university of asArray(universityScope?.universities)) {
    const owner = String(university?.owner_namespace || '').trim();
    const host = urlHost(university?.cached_course_catalog?.official_url);
    if (/^va:uni:\d+$/.test(owner) && host) {
      result[owner] = [
        host,
        ...(university.slug === 'longwood-university' ? ['www.longwood.edu'] : []),
        ...(university.slug === 'virginia-polytechnic-institute-and-state-university'
          ? ['students.cs.vt.edu'] : []),
      ];
    }
  }
  return result;
}

function normalizedOfficialHosts(officialHostsByOwner = {}) {
  const entries = officialHostsByOwner instanceof Map
    ? [...officialHostsByOwner.entries()] : Object.entries(officialHostsByOwner || {});
  return new Map(entries.map(([owner, hosts]) => [
    String(owner),
    new Set(asArray(hosts).map((host) => String(host || '').toLowerCase()).filter(Boolean)),
  ]));
}

function evidenceForRow(row) {
  const evidence = row?.source_evidence || {};
  return {
    kind: evidence.kind || null,
    raw_text: typeof evidence.raw_text === 'string' ? evidence.raw_text : null,
    content_sha256: evidence.content_sha256 || null,
    document_content_sha256: evidence.document_content_sha256 || null,
    source_page_content_sha256: evidence.source_page_content_sha256 || null,
    record_html_sha256: evidence.record_html_sha256 || null,
    record_boundary: evidence.record_boundary || null,
    requisite_text_boundary: evidence.requisite_text_boundary || null,
    parser_contract: evidence.parser_contract || null,
    source_capture: evidence.source_capture && typeof evidence.source_capture === 'object'
      ? { ...evidence.source_capture } : null,
    catalog_page: evidence.catalog_page ?? null,
    pdf_page: evidence.pdf_page ?? null,
    source_url: String(row?.source_url || ''),
  };
}

function sourceBundleHashForRows(rows = [], ownerNamespace = null) {
  const ownerRows = asArray(rows).filter((row) => (
    ownerNamespace == null || row?.owner_namespace === ownerNamespace
  ));
  const owner = ownerNamespace || String(ownerRows[0]?.owner_namespace || '');
  const sources = [...new Map(ownerRows.map((row) => {
    const evidence = evidenceForRow(row);
    const key = `${evidence.source_url}\u0000${evidence.content_sha256 || ''}`;
    return [key, {
      source_url: evidence.source_url,
      content_sha256: evidence.content_sha256,
    }];
  })).values()].sort((left, right) => {
    const leftJson = canonicalJson(left);
    const rightJson = canonicalJson(right);
    return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
  });
  return sha256(canonicalJson({ owner_namespace: owner, sources }));
}

const PUBLICATION_ROW_FIELDS = new Set([
  '_id',
  'contract_version',
  'import_generation',
  'imported_at',
  'publication_generation',
  'published_at',
  'verification_receipt_id',
  'verification_receipt_sha256',
]);

function rowContentForGeneration(row) {
  return Object.fromEntries(Object.entries(row || {})
    .filter(([key]) => !PUBLICATION_ROW_FIELDS.has(key)));
}

function publicationGenerationFor({
  communityCollegeRows = [],
  universityRows = [],
  requiredCommunityCollegeKeys = [],
  requiredUniversityKeys = [],
  officialHostsByOwner = {},
} = {}) {
  const sortedRows = (rows) => asArray(rows).map(rowContentForGeneration)
    .sort((left, right) => {
      const leftKey = keyOf(left);
      const rightKey = keyOf(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  const officialHosts = Object.fromEntries([...normalizedOfficialHosts(officialHostsByOwner)]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([owner, hosts]) => [owner, [...hosts].sort()]));
  return sha256(canonicalJson({
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    official_source_hosts_by_owner: officialHosts,
    community_college: {
      required_course_keys: [...new Set(requiredCommunityCollegeKeys)].sort(),
      rows: sortedRows(communityCollegeRows),
    },
    university: {
      required_course_keys: [...new Set(requiredUniversityKeys)].sort(),
      rows: sortedRows(universityRows),
    },
  }));
}

function ownerOwnsCourseKey(ownerNamespace, courseKey) {
  const owner = String(ownerNamespace || '').trim();
  const key = String(courseKey || '').trim();
  if (owner === VCCS_OWNER_NAMESPACE) return /^va:[^:]+$/.test(key);
  return /^va:uni:\d+$/.test(owner)
    && key.startsWith(`${owner}:`)
    && key.length > owner.length + 1;
}

function expectedOwnedCourseKey(ownerNamespace, code) {
  return ownerNamespace === VCCS_OWNER_NAMESPACE
    ? `va:${code}` : `${ownerNamespace}:${code}`;
}

function adaptExactRequisiteRow(row) {
  return {
    // Retain source/provenance fields that are not interpreted here.  In
    // particular, raw clauses, parser flags, effective dates, and local-page
    // audits must survive the Figure 6 adapter for independent review.
    ...row,
    course_key: keyOf(row) || null,
    owner_namespace: row?.owner_namespace || null,
    status: row?.status || null,
    source: row?.source || null,
    source_url: row?.source_url || null,
    source_bundle_hash: row?.source_bundle_hash || null,
    groups: asArray(row?.groups).map((group) => ({
      ...group,
      kind: group?.kind || null,
      formula: group?.formula || null,
      // Preserve paths and their all_of members exactly. No graph consumer may
      // replace this with one flat list without changing source semantics.
      paths: asArray(group?.paths).map((path) => ({
        ...path,
        all_of: asArray(path?.all_of).map((condition) => ({ ...condition })),
      })),
    })),
  };
}

const isVccsCollege = (name) => /community college$/i.test(String(name || '').trim());

function requiredVccsCourseKeys(scopeRows = []) {
  return [...new Set(asArray(scopeRows)
    .filter((row) => asArray(row?.colleges).some(isVccsCollege))
    .map((row) => String(row?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
    .map((code) => `va:${code}`))].sort();
}

function requiredUniversityCourseKeys(scope = {}) {
  return [...new Set(asArray(scope?.universities).flatMap((university) => {
    const owner = String(university?.owner_namespace || '').trim();
    if (!/^va:uni:\d+$/.test(owner)) return [];
    return [
      ...asArray(university?.direct_named_course_codes),
      ...asArray(university?.deterministic_resident_path_course_codes),
    ]
      .map((code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .filter(Boolean)
      .map((code) => `${owner}:${code}`);
  }))].sort();
}

/**
 * Project the legacy review artifact into the strict VCCS ownership domain.
 *
 * Richard Bland-only rows are deliberately excluded: Richard Bland is not a
 * VCCS institution and its local prerequisite policy was not collected.  A
 * mixed row remains the statewide VCCS identity; its explicit Richard Bland
 * override is retained as provenance but is not re-owned.
 *
 * Missing and unparsed rows are retained.  Filtering them out would turn a
 * known source gap into apparent coverage; validation below fails closed.
 */
function adaptVccsPrerequisiteArtifact(artifact, scopeRows = []) {
  const requiredKeys = requiredVccsCourseKeys(scopeRows);
  const requiredCodes = new Set(requiredKeys.map((key) => key.slice(3)));
  const rows = asArray(artifact?.rows)
    .filter((row) => (
      row?.scope_role === 'prerequisite_only'
      || requiredCodes.has(String(row?.code || '').toUpperCase())
    ))
    .filter((row) => row?.supply_kind !== 'richard_bland_scope')
    .map((row) => adaptExactRequisiteRow({
      ...row,
      owner_namespace: VCCS_OWNER_NAMESPACE,
    }));
  return {
    rows,
    requiredKeys,
    report: validateVccsFigure6PrerequisiteCorpus({ rows, requiredKeys }),
  };
}

function formulaIssues(row, path) {
  const issues = [];
  if (!['parsed', 'none'].includes(row?.status)) {
    issues.push({ path: `${path}.status`, code: 'requisite_status_not_publishable' });
    return issues;
  }
  if (row.status === 'none' && asArray(row.groups).length) {
    issues.push({ path: `${path}.groups`, code: 'explicit_none_has_formula' });
  }
  if (row.status === 'none' && row?.raw_requisites != null) {
    issues.push({ path: `${path}.raw_requisites`, code: 'explicit_none_has_raw_requisite' });
  }
  if (row.status === 'parsed' && !asArray(row.groups).length) {
    issues.push({ path: `${path}.groups`, code: 'parsed_requisite_missing_formula' });
  }
  if (row.status === 'parsed' && !String(row?.raw_requisites || '').trim()) {
    issues.push({ path: `${path}.raw_requisites`, code: 'parsed_requisite_raw_text_required' });
  }
  asArray(row.groups).forEach((group, groupIndex) => {
    const groupPath = `${path}.groups[${groupIndex}]`;
    if (!['prerequisite', 'corequisite'].includes(group?.kind)) {
      issues.push({ path: `${groupPath}.kind`, code: 'requisite_group_kind_required' });
    }
    if (group?.formula !== FORMULA) {
      issues.push({ path: `${groupPath}.formula`, code: 'lossless_formula_contract_required' });
    }
    if (!asArray(group?.paths).length) {
      issues.push({ path: `${groupPath}.paths`, code: 'formula_paths_required' });
    }
    asArray(group?.paths).forEach((formulaPath, pathIndex) => {
      if (!asArray(formulaPath?.all_of).length) {
        issues.push({
          path: `${groupPath}.paths[${pathIndex}].all_of`,
          code: 'formula_conjunction_required',
        });
      }
    });
  });
  return issues;
}

function normalizedEvidenceText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasUnmodeledConstraintSignal(value) {
  return /\b(?:require(?:d|ment|ments)|permission|consent|standing|placement|minimum\s+(?:score|grade)|concurrent|enroll(?:ed|ing|ment)?|admission|registration\s+restrictions?|recommended|must\s+be\s+(?:taken|passed|completed)|may\s+not\s+(?:take|be\s+taken|register|enroll|receive\s+credit)|cannot\s+(?:take|register|enroll|receive\s+credit)|may\s+receive\s+credit.{0,120}\bonly\s+one|not\s+applicable\s+for\s+credit|open\s+only\s+to|only\s+for\s+students|limited\s+to\s+students|(?:no\s+credit|credit)\s+(?:will\s+not\s+be\s+given|cannot\s+be\s+earned|may\s+not\s+be\s+earned|for\s+more\s+than\s+one)|(?:prior|working|some)\s+(?:knowledge|experience)|background\s+in|proficiency\s+in|competency\s+in|taken\s+in\s+conjunction|(?:advisor|adviser|instructor|department(?:al)?|faculty)\s+approval)\b/i.test(String(value || ''));
}

function evidenceContainsCourseCode(text, courseKey) {
  const code = String(courseKey || '').split(':').at(-1);
  const match = /^([A-Z]{2,8})(\d{2,4}[A-Z]?)$/.exec(String(code || '').toUpperCase());
  if (!match) return false;
  return new RegExp(`(?:^|[^A-Z0-9])${match[1]}[\\s-]*${match[2]}(?:$|[^A-Z0-9])`, 'i')
    .test(String(text || ''));
}

function southwestCaptureIssues(row, path, evidence, source) {
  const issues = [];
  const capture = evidence?.source_capture;
  const code = normalizedCourseCode(String(row?.course_key || '').split(':').at(-1));
  const codeWithSpace = code?.replace(/^([A-Z]+)(\d)/, '$1 $2');
  const catoid = source?.searchParams.get('catoid');
  const coid = source?.searchParams.get('coid');
  const expectedCachePath = catoid && coid
    ? `.va-catalogs/vccs-prerequisites/raw/southwest-virginia-community-college/catoid-${catoid}__coid-${coid}.html`
    : null;
  if (!capture
      || capture.kind !== 'official_http_response_and_single_course_fragment'
      || capture.cache_path !== expectedCachePath
      || !SHA256.test(String(capture.source_response_sha256 || ''))
      || !Number.isInteger(capture.source_response_bytes)
      || capture.source_response_bytes <= 0
      || !SHA256.test(String(capture.course_fragment_html_sha256 || ''))
      || !Number.isInteger(capture.course_fragment_html_bytes)
      || capture.course_fragment_html_bytes <= 0
      || capture.extracted_entry_sha256 !== evidence.content_sha256
      || capture.course_heading_seen !== `${codeWithSpace}: ${String(row?.title || '').trim()}`
      || capture.catalog_name_seen !== `${row?.catalog_year} Catalog`
      || capture.parser_contract !== SOUTHWEST_RESPONSE_CAPTURE_CONTRACT) {
    issues.push({
      path: `${path}.source_evidence.source_capture`,
      code: 'official_response_course_fragment_receipt_required',
    });
  }
  return issues;
}

function structuredUniversityCourseLeafNoneEvidenceIssues(row, path, evidence) {
  const none = row?.structural_none_evidence;
  if (row?.status !== 'none' || !none) return null;
  const issues = [];
  const review = row?.review_evidence;
  const control = none?.marker_control;
  const raw = String(evidence?.raw_text || '');
  const hasRequisiteMarker = /\b(?:pre-?|co-?)?requisites?\b/i.test(raw);
  const hasConstraintSignal = hasUnmodeledConstraintSignal(raw);
  if (row?.explicit_none_evidence != null
      || row?.review_status !== 'promoted_structural_none'
      || row?.review_reason
        !== 'complete_courseleaf_entry_silence_with_same_source_required_marker_control'
      || none.kind !== COURSELEAF_UNIVERSITY_STRUCTURAL_NONE_KIND
      || none.course_entry_status !== 'published_exact_courseleaf_courseblock'
      || none.finding
        !== 'no_required_prerequisite_marker_in_complete_entry_with_same_response_positive_control'
      || none.literal_none_statement !== false
      || none.boundary_contract !== COURSELEAF_UNIVERSITY_BOUNDARY_CONTRACT
      || none.receipt_contract !== COURSELEAF_UNIVERSITY_RECEIPT_CONTRACT
      || review?.capture_origin !== 'official_acquisition'
      || review?.source_format !== 'courseleaf_courseblock'
      || review?.boundary_contract !== none.boundary_contract
      || review?.source_response_sha256 !== none.source_response_sha256
      || review?.raw_entry_sha256 !== none.raw_entry_sha256
      || review?.raw_entry_html_sha256 !== none.raw_entry_html_sha256
      || review?.courseblock_index !== none.courseblock_index
      || canonicalJson(review?.published_units) !== canonicalJson(none.published_units)
      || canonicalJson(review?.complete_entry_receipt) !== canonicalJson(control)
      || review?.source_response_sha256 !== review?.declared_normalized_text_sha256
      || review?.source_response_sha256 !== review?.retained_normalized_text_sha256
      || !SHA256.test(String(none.source_response_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_html_sha256 || ''))
      || none.raw_entry_sha256 !== evidence?.content_sha256
      || row?.source_content_sha256 !== none.raw_entry_sha256
      || !Number.isInteger(none.courseblock_index) || none.courseblock_index < 0
      || !none.published_units || !(none.published_units.credit_hours_min >= 0)
      || none.published_units.credit_hours_max < none.published_units.credit_hours_min
      || control?.receipt_contract !== COURSELEAF_UNIVERSITY_RECEIPT_CONTRACT
      || control.entry_required_requisite_marker_count !== 0
      || control.entry_corequisite_marker_count !== 0
      || control.entry_requisite_marker_like_count !== 0
      || control.entry_constraint_like_signal_count !== 0
      || control.same_source_positive_control !== true
      || !(control.source_complete_entries_with_required_requisite_marker_count > 0)
      || !(control.source_complete_entry_count > 1)
      || control.source_courseblock_count < control.source_complete_entry_count
      || hasRequisiteMarker || hasConstraintSignal
      || !String(none.inference_boundary || '').includes(
        'complete exact CourseLeaf entry is silent',
      )) {
    issues.push({
      path: `${path}.structural_none_evidence`,
      code: 'structured_courseleaf_none_evidence_required',
    });
  }
  return issues;
}

function structuredUniversityGeorgeMasonNoneEvidenceIssues(row, path) {
  const issues = georgeMasonSilenceResolutionRowIssues(row);
  if (row?.explicit_none_evidence != null
      || row?.structural_none_evidence?.contract !== GEORGE_MASON_SILENCE_CONTRACT
      || row?.structural_none_evidence?.receipt_contract
        !== GEORGE_MASON_SILENCE_CONTRACT
      || row?.structural_none_evidence?.literal_none_statement !== false
      || row?.structural_none_evidence?.content_accounting
        ?.every_reviewed_nonrequired_signal_marker_accounted_for !== true
      || row?.structural_none_evidence?.content_accounting?.source_content_discarded !== false) {
    issues.push('publication_contract');
  }
  return issues.length ? [{
    path: `${path}.structural_none_evidence`,
    code: 'structured_gmu_required_requisite_silence_evidence_required',
  }] : [];
}

function structuredUniversityGeorgeMasonClosureNoneEvidenceIssues(row, path) {
  const issues = [
    ...georgeMasonClosureResolutionRowIssues(row),
    ...georgeMasonCachedCyseResolutionRowIssues(row),
  ];
  if (row?.explicit_none_evidence != null
      || row?.structural_none_evidence?.contract !== GEORGE_MASON_CLOSURE_CONTRACT
      || row?.structural_none_evidence?.literal_none_statement !== false
      || row?.structural_none_evidence?.content_accounting
        ?.every_reviewed_nonrequired_signal_marker_accounted_for !== true
      || row?.structural_none_evidence?.content_accounting?.source_content_discarded !== false) {
    issues.push('publication_contract');
  }
  return issues.length ? [{
    path: `${path}.structural_none_evidence`,
    code: 'structured_gmu_recursive_closure_none_evidence_required',
  }] : [];
}

function structuredUniversityUvaWiseNoneEvidenceIssues(row, path, evidence) {
  const none = row?.structural_none_evidence;
  const review = row?.review_evidence;
  const control = none?.marker_control;
  const raw = String(evidence?.raw_text || '');
  const positiveKeys = asArray(control?.positive_control_course_keys);
  const hasRequisiteMarker = /\bPrerequisites?\b/i.test(raw);
  const hasConstraintSignal = hasUnmodeledConstraintSignal(raw);
  const issues = [];
  if (row?.explicit_none_evidence != null
      || row?.review_status !== 'promoted_structural_none'
      || row?.review_reason
        !== 'complete_uva_wise_acalog_entry_silence_with_same_catalog_required_marker_control'
      || none?.kind !== UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_KIND
      || none?.course_entry_status !== 'published_exact_uva_wise_acalog_course_page'
      || none?.finding
        !== 'no_required_prerequisite_field_in_complete_entry_with_same_catalog_positive_control'
      || none?.literal_none_statement !== false
      || none?.boundary_contract !== UVA_WISE_UNIVERSITY_BOUNDARY_CONTRACT
      || none?.receipt_contract !== UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || review?.capture_origin !== 'official_uva_wise_acalog_course_page'
      || review?.source_format !== 'uva_wise_acalog_course_page'
      || review?.boundary_contract !== none.boundary_contract
      || review?.source_response_sha256 !== none.source_response_sha256
      || review?.raw_entry_sha256 !== none.raw_entry_sha256
      || review?.raw_entry_html_sha256 !== none.raw_entry_html_sha256
      || review?.catoid !== none.catoid || review?.coid !== none.coid
      || canonicalJson(review?.published_units) !== canonicalJson(none.published_units)
      || review?.required_requisite_clause !== null
      || !SHA256.test(String(none.source_response_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_html_sha256 || ''))
      || none.raw_entry_sha256 !== evidence?.content_sha256
      || row?.source_content_sha256 !== none.raw_entry_sha256
      || none.catoid !== 9 || !Number.isInteger(none.coid) || none.coid <= 0
      || !none.published_units || !(none.published_units.credit_hours_min > 0)
      || none.published_units.credit_hours_max < none.published_units.credit_hours_min
      || control?.receipt_contract !== UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || control.catalog_year !== '2026-2027' || control.catoid !== 9
      || control.exact_complete_entry_count !== 31
      || control.exact_complete_entries_with_required_requisite_marker_count !== 20
      || control.exact_complete_entries_without_required_requisite_marker_count !== 11
      || control.exact_complete_entries_with_required_requisite_marker_count
        + control.exact_complete_entries_without_required_requisite_marker_count
        !== control.exact_complete_entry_count
      || control.same_catalog_positive_control !== true
      || !SHA256.test(String(control.population_sha256 || ''))
      || !SHA256.test(String(control.positive_control_sha256 || ''))
      || positiveKeys.length !== 20 || new Set(positiveKeys).size !== positiveKeys.length
      || positiveKeys.some((key) => !String(key).startsWith(`${row.owner_namespace}:`))
      || hasRequisiteMarker || hasConstraintSignal
      || !String(none.inference_boundary || '').includes(
        'does not infer a literal none statement',
      )) {
    issues.push({
      path: `${path}.structural_none_evidence`,
      code: 'structured_uva_wise_acalog_none_evidence_required',
    });
  }
  return issues;
}

function structuredUniversityShenandoahNoneEvidenceIssues(row, path, evidence) {
  const none = row?.structural_none_evidence;
  const review = row?.review_evidence;
  const control = none?.marker_control;
  const raw = String(evidence?.raw_text || '');
  const positiveKeys = asArray(control?.positive_control_course_keys);
  const hasStructuredMarker = /(?:Pre|Co)requisite\(s\):/i.test(raw);
  const hasConstraintSignal = hasUnmodeledConstraintSignal(raw);
  const positiveCount = control?.exact_complete_entries_with_required_requisite_marker_count;
  const silentCount = control?.exact_complete_entries_without_required_requisite_marker_count;
  const issues = [];
  if (row?.explicit_none_evidence != null
      || row?.review_status !== 'promoted_structural_none'
      || row?.review_reason
        !== 'complete_shenandoah_acalog_entry_silence_with_same_catalog_required_marker_control'
      || none?.kind !== SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_KIND
      || none?.course_entry_status !== 'published_exact_shenandoah_acalog_course_page'
      || none?.finding
        !== 'no_required_prerequisite_field_in_complete_entry_with_same_catalog_positive_control'
      || none?.literal_none_statement !== false
      || none?.boundary_contract !== SHENANDOAH_UNIVERSITY_BOUNDARY_CONTRACT
      || none?.receipt_contract !== SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || review?.capture_origin !== 'official_shenandoah_acalog_course_page'
      || review?.source_format !== 'shenandoah_acalog_course_page'
      || review?.boundary_contract !== none.boundary_contract
      || review?.source_response_sha256 !== none.source_response_sha256
      || review?.raw_entry_sha256 !== none.raw_entry_sha256
      || review?.raw_entry_html_sha256 !== none.raw_entry_html_sha256
      || review?.catoid !== none.catoid || review?.coid !== none.coid
      || canonicalJson(review?.published_units) !== canonicalJson(none.published_units)
      || review?.required_requisite_clause !== null
      || review?.formal_corequisite_marker_count !== 0
      || !SHA256.test(String(none.source_response_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_html_sha256 || ''))
      || none.raw_entry_sha256 !== evidence?.content_sha256
      || row?.source_content_sha256 !== none.raw_entry_sha256
      || none.catoid !== 33 || !Number.isInteger(none.coid) || none.coid <= 0
      || !none.published_units || !(none.published_units.credit_hours_min > 0)
      || none.published_units.credit_hours_max < none.published_units.credit_hours_min
      || control?.receipt_contract !== SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || control.catalog_year !== '2025-2026' || control.catoid !== 33
      || control.exact_complete_entry_count !== 19
      || !Number.isInteger(positiveCount) || !(positiveCount > 0)
      || !Number.isInteger(silentCount) || !(silentCount > 0)
      || positiveCount + silentCount !== control.exact_complete_entry_count
      || control.same_catalog_positive_control !== true
      || !SHA256.test(String(control.population_sha256 || ''))
      || !SHA256.test(String(control.positive_control_sha256 || ''))
      || positiveKeys.length !== positiveCount
      || new Set(positiveKeys).size !== positiveKeys.length
      || positiveKeys.some((key) => !String(key).startsWith(`${row.owner_namespace}:`))
      || hasStructuredMarker || hasConstraintSignal
      || !String(none.inference_boundary || '').includes(
        'does not infer a literal none statement',
      )) {
    issues.push({
      path: `${path}.structural_none_evidence`,
      code: 'structured_shenandoah_acalog_none_evidence_required',
    });
  }
  return issues;
}

function structuredUniversityBridgewaterNoneEvidenceIssues(row, path, evidence) {
  const none = row?.structural_none_evidence;
  const review = row?.review_evidence;
  const control = none?.marker_control;
  const entryControl = none?.entry_marker_receipt;
  const raw = String(evidence?.raw_text || '');
  const positiveKeys = asArray(control?.positive_control_course_keys);
  const corequisiteKeys = asArray(control?.corequisite_positive_control_course_keys);
  const safeSilentKeys = asArray(control?.safe_silent_course_keys);
  const blockedSilentKeys = asArray(control?.blocked_constraint_course_keys);
  const population = asArray(control?.population_receipts);
  const populationPositive = population.filter((entry) => (
    entry?.prerequisite_field_count > 0
  ));
  const populationCorequisitePositive = population.filter((entry) => (
    entry?.corequisite_field_count > 0
  ));
  const populationSilent = population.filter((entry) => (
    entry?.prerequisite_field_count === 0 && entry?.corequisite_field_count === 0
  ));
  const populationSafeSilent = populationSilent.filter((entry) => (
    entry?.generic_unmodeled_constraint_signal === false
      && asArray(entry?.bridgewater_timing_signals).length === 0
  ));
  const populationBlocked = populationSilent.filter((entry) => (
    !populationSafeSilent.includes(entry)
  ));
  const issues = [];
  if (row?.explicit_none_evidence != null
      || row?.review_status !== 'promoted_structural_none'
      || row?.review_reason
        !== 'complete_bridgewater_cleancatalog_entry_silence_with_same_edition_requisite_marker_controls'
      || none?.kind !== BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_KIND
      || none?.course_entry_status !== 'published_exact_bridgewater_cleancatalog_course_page'
      || none?.finding
        !== 'no_prerequisite_or_corequisite_field_in_complete_entry_with_same_edition_positive_controls'
      || none?.literal_none_statement !== false
      || none?.boundary_contract !== BRIDGEWATER_BOUNDARY_CONTRACT
      || none?.receipt_contract !== BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || review?.capture_origin !== 'official_cleancatalog_course_page'
      || review?.source_format !== 'cleancatalog_course_page'
      || review?.boundary_contract !== none.boundary_contract
      || review?.source_response_sha256 !== none.source_response_sha256
      || review?.raw_entry_sha256 !== none.raw_entry_sha256
      || review?.raw_entry_html_sha256 !== none.raw_entry_html_sha256
      || review?.canonical_path !== none.canonical_path
      || review?.edition_response_sha256 !== none.edition_response_sha256
      || review?.edition_catalog_year !== none.edition_catalog_year
      || canonicalJson(review?.published_units) !== canonicalJson(none.published_units)
      || canonicalJson(review?.requisite_field_receipt) !== canonicalJson(entryControl)
      || !SHA256.test(String(none.source_response_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_html_sha256 || ''))
      || !SHA256.test(String(none.edition_response_sha256 || ''))
      || none.raw_entry_sha256 !== evidence?.content_sha256
      || row?.source_content_sha256 !== none.raw_entry_sha256
      || none.edition_catalog_year !== row?.catalog_year
      || !none.published_units || !(none.published_units.credit_hours_min > 0)
      || none.published_units.credit_hours_max !== none.published_units.credit_hours_min
      || entryControl?.receipt_contract !== BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT
      || entryControl?.exact_prerequisite_field_count !== 0
      || entryControl?.exact_corequisite_field_count !== 0
      || entryControl?.unrecognized_requisite_like_field_count !== 0
      || !Array.isArray(entryControl?.requisite_fields)
      || entryControl.requisite_fields.length !== 0
      || control?.receipt_contract
        !== BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || control.catalog_year !== '2026-2027'
      || control.exact_complete_entry_count !== 30
      || control.exact_complete_entries_with_prerequisite_field_count !== 20
      || control.exact_complete_entries_with_corequisite_field_count !== 1
      || control.exact_complete_entries_without_requisite_fields_count !== 10
      || control.exact_safe_silent_entry_count !== 8
      || control.exact_blocked_constraint_entry_count !== 2
      || control.exact_safe_silent_entry_count + control.exact_blocked_constraint_entry_count
        !== control.exact_complete_entries_without_requisite_fields_count
      || control.same_edition_positive_controls !== true
      || control.edition_response_sha256 !== none.edition_response_sha256
      || population.length !== control.exact_complete_entry_count
      || new Set(population.map((entry) => entry?.course_key)).size !== population.length
      || population.some((entry) => (
        !String(entry?.course_key || '').startsWith(`${row.owner_namespace}:`)
        || !String(entry?.canonical_path || '').startsWith('/')
        || !SHA256.test(String(entry?.source_response_sha256 || ''))
        || !SHA256.test(String(entry?.raw_entry_sha256 || ''))
        || !SHA256.test(String(entry?.raw_entry_html_sha256 || ''))
        || entry?.edition_response_sha256 !== none.edition_response_sha256
        || !SHA256.test(String(entry?.requisite_field_receipt_sha256 || ''))
        || ![0, 1].includes(entry?.prerequisite_field_count)
        || ![0, 1].includes(entry?.corequisite_field_count)
        || typeof entry?.generic_unmodeled_constraint_signal !== 'boolean'
        || !Array.isArray(entry?.bridgewater_timing_signals)
      ))
      || populationPositive.length
        !== control.exact_complete_entries_with_prerequisite_field_count
      || populationCorequisitePositive.length
        !== control.exact_complete_entries_with_corequisite_field_count
      || populationSilent.length
        !== control.exact_complete_entries_without_requisite_fields_count
      || populationSafeSilent.length !== control.exact_safe_silent_entry_count
      || populationBlocked.length !== control.exact_blocked_constraint_entry_count
      || sha256(JSON.stringify(population)) !== control.population_sha256
      || sha256(JSON.stringify(populationPositive)) !== control.positive_control_sha256
      || sha256(JSON.stringify(populationCorequisitePositive))
        !== control.corequisite_positive_control_sha256
      || canonicalJson(populationPositive.map((entry) => entry.course_key))
        !== canonicalJson(positiveKeys)
      || canonicalJson(populationCorequisitePositive.map((entry) => entry.course_key))
        !== canonicalJson(corequisiteKeys)
      || canonicalJson(populationSafeSilent.map((entry) => entry.course_key))
        !== canonicalJson(safeSilentKeys)
      || canonicalJson(populationBlocked.map((entry) => entry.course_key))
        !== canonicalJson(blockedSilentKeys)
      || !SHA256.test(String(control.population_sha256 || ''))
      || !SHA256.test(String(control.positive_control_sha256 || ''))
      || !SHA256.test(String(control.corequisite_positive_control_sha256 || ''))
      || positiveKeys.length !== 20 || new Set(positiveKeys).size !== positiveKeys.length
      || corequisiteKeys.length !== 1 || new Set(corequisiteKeys).size !== 1
      || safeSilentKeys.length !== 8 || new Set(safeSilentKeys).size !== 8
      || blockedSilentKeys.length !== 2 || new Set(blockedSilentKeys).size !== 2
      || [...positiveKeys, ...corequisiteKeys, ...safeSilentKeys, ...blockedSilentKeys]
        .some((key) => !String(key).startsWith(`${row.owner_namespace}:`))
      || !safeSilentKeys.includes(row.course_key)
      || canonicalJson(blockedSilentKeys)
        !== canonicalJson([`${row.owner_namespace}:CL100`, `${row.owner_namespace}:CL150`])
      || /\b(?:Pre|Co)requisites?:/i.test(raw)
      || hasUnmodeledConstraintSignal(raw)
      || bridgewaterUnmodeledTimingSignals(raw).length !== 0
      || !String(none.inference_boundary || '').includes(
        'does not infer a literal none statement',
      )) {
    issues.push({
      path: `${path}.structural_none_evidence`,
      code: 'structured_bridgewater_cleancatalog_none_evidence_required',
    });
  }
  return issues;
}

function structuredUniversityVirginiaTechGraduateCsNoneEvidenceIssues(row, path, evidence) {
  const none = row?.structural_none_evidence;
  const review = row?.review_evidence;
  const control = none?.marker_control;
  const raw = String(evidence?.raw_text || '');
  const issues = [];
  if (row?.explicit_none_evidence != null
      || row?.code !== 'CS5104'
      || row?.review_status !== 'promoted_structural_none'
      || row?.review_reason
        !== 'complete_current_virginia_tech_graduate_cs_entry_silence_with_same_page_pre_controls'
      || none?.kind !== VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_KIND
      || none?.course_entry_status !== 'published_exact_heading_to_next_heading_entry'
      || none?.literal_none_statement !== false
      || none?.boundary_contract !== VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT
      || none?.receipt_contract
        !== VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || review?.source_format !== 'virginia_tech_current_graduate_cs_heading_entry'
      || review?.boundary_contract !== none.boundary_contract
      || review?.source_response_sha256 !== none.source_response_sha256
      || review?.raw_entry_sha256 !== none.raw_entry_sha256
      || review?.raw_entry_html_sha256 !== none.raw_entry_html_sha256
      || review?.evidence_artifact_sha256 !== none.evidence_artifact_sha256
      || review?.facts_sha256 !== none.facts_sha256
      || review?.source_response_sha256 !== review?.declared_normalized_text_sha256
      || review?.source_response_sha256 !== review?.retained_normalized_text_sha256
      || row?.source_content_sha256 !== none.raw_entry_sha256
      || evidence?.content_sha256 !== none.raw_entry_sha256
      || !SHA256.test(String(none.source_response_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_sha256 || ''))
      || !SHA256.test(String(none.raw_entry_html_sha256 || ''))
      || !SHA256.test(String(none.evidence_artifact_sha256 || ''))
      || !SHA256.test(String(none.facts_sha256 || ''))
      || none.catalog_edition_claimed !== false
      || none.next_heading_code !== 'CS5114'
      || control?.receipt_contract
        !== VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || control?.literal_none_statement !== false
      || control?.missing_search_result_used !== false
      || control?.exact_complete_entry_present !== true
      || control?.same_page_positive_control !== true
      || control?.source_bounded_entry_count !== 56
      || control?.source_entries_with_pre_marker_count !== 43
      || control?.source_pre_marker_count !== 46
      || control?.positive_control_course_code !== 'CS5114'
      || control?.positive_control_statement !== 'Pre: CS3114'
      || control?.entry_required_prerequisite_marker_count !== 0
      || control?.entry_corequisite_marker_count !== 0
      || control?.entry_requisite_marker_like_count !== 0
      || control?.entry_constraint_like_signal_count !== 0
      || /\b(?:Pre:|Prerequisite(?:s)?\s*:|Co-?requisite(?:s)?\s*:)/i.test(raw)
      || hasUnmodeledConstraintSignal(raw)
      || !String(none.inference_boundary || '').includes(
        'never inferred from a missing search result',
      )) {
    issues.push({
      path: `${path}.structural_none_evidence`,
      code: 'structured_virginia_tech_graduate_cs_none_evidence_required',
    });
  }
  return issues;
}

function explicitNoneEvidenceIssues(
  row,
  path,
  evidence,
  smallUniversityEvidence = null,
  universityPrerequisiteTailControl = null,
  radfordRandolphMaconTailEvidence = null,
  remainingUniversityPrerequisiteEvidence = null,
  vcuEgmnPrerequisiteEvidence = null,
) {
  if (row?.status !== 'none') return [];
  if (row?.structural_none_evidence?.contract
      === REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT) {
    return remainingUniversityPrerequisiteResolutionRowIssues(
      row, remainingUniversityPrerequisiteEvidence,
    ).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_remaining_university_prerequisite_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract === VCU_EGMN_PREREQUISITE_CONTRACT) {
    return vcuEgmnPrerequisiteResolutionRowIssues(
      row, vcuEgmnPrerequisiteEvidence,
    ).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_vcu_egmn_prerequisite_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract
      === RADFORD_RANDOLPH_MACON_TAIL_CONTRACT) {
    return radfordRandolphMaconTailResolutionRowIssues(
      row, radfordRandolphMaconTailEvidence,
    ).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_radford_randolph_macon_tail_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract
      === UNIVERSITY_PREREQUISITE_TAIL_CONTRACT) {
    return universityPrerequisiteTailResolutionRowIssues(
      row, universityPrerequisiteTailControl,
    ).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_university_prerequisite_tail_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract
      === SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT) {
    return smallUniversityPrerequisiteResolutionRowIssues(
      row, smallUniversityEvidence,
    ).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_small_university_prerequisite_closure_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract
      === VCU_PREREQUISITE_CLOSURE_CONTRACT) {
    return vcuPrerequisiteResolutionRowIssues(row).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_vcu_prerequisite_closure_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract
      === NORFOLK_STATE_PREREQUISITE_CLOSURE_CONTRACT) {
    return norfolkStatePrerequisiteClosureResolutionRowIssues(row).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_nsu_prerequisite_closure_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract === VSU_PREREQUISITE_CLOSURE_CONTRACT) {
    return vsuPrerequisiteClosureResolutionRowIssues(row).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_vsu_prerequisite_closure_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.contract === GEORGE_MASON_CLOSURE_CONTRACT) {
    return structuredUniversityGeorgeMasonClosureNoneEvidenceIssues(row, path, evidence);
  }
  if (row?.structural_none_evidence?.contract === GEORGE_MASON_SILENCE_CONTRACT) {
    return structuredUniversityGeorgeMasonNoneEvidenceIssues(row, path, evidence);
  }
  if (row?.structural_none_evidence?.kind
      === VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_KIND) {
    return structuredUniversityVirginiaTechGraduateCsNoneEvidenceIssues(row, path, evidence);
  }
  if (row?.structural_none_evidence?.kind === CNU_ENGL123_STRUCTURAL_NONE_KIND) {
    return cnuEngl123ResolutionRowIssues(row).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_cnu_engl123_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.kind === ODU_STRUCTURAL_NONE_KIND) {
    return oldDominionResolutionRowIssues(row).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_odu_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.kind === FIGURE6_NONCOURSE_STRUCTURAL_NONE_KIND) {
    return figure6NonCourseDispositionResolutionRowIssues(row).map((code) => ({
      path: `${path}.structural_none_evidence`,
      code: `structured_figure6_noncourse_${code}`,
    }));
  }
  if (row?.structural_none_evidence?.kind === BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_KIND) {
    return structuredUniversityBridgewaterNoneEvidenceIssues(row, path, evidence);
  }
  if (row?.structural_none_evidence?.kind === SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_KIND) {
    return structuredUniversityShenandoahNoneEvidenceIssues(row, path, evidence);
  }
  if (row?.structural_none_evidence?.kind === UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_KIND) {
    return structuredUniversityUvaWiseNoneEvidenceIssues(row, path, evidence);
  }
  const structured = structuredUniversityCourseLeafNoneEvidenceIssues(row, path, evidence);
  if (structured) return structured;
  const issues = [];
  const none = row?.explicit_none_evidence;
  const allowedKinds = new Set([
    'official_explicit_none_statement',
    'human_reviewed_exact_course_entry',
    'structured_vccs_master_record_boundary',
    'structured_owner_catalog_record_boundary',
  ]);
  if (!none || !allowedKinds.has(none.kind)) {
    issues.push({ path: `${path}.explicit_none_evidence`, code: 'explicit_none_evidence_required' });
    return issues;
  }
  if (none.source_content_sha256 !== evidence.content_sha256) {
    issues.push({
      path: `${path}.explicit_none_evidence.source_content_sha256`,
      code: 'explicit_none_source_hash_mismatch',
    });
  }
  if (none.kind === 'official_explicit_none_statement') {
    const statement = normalizedEvidenceText(none.raw_text);
    const explicitNone = /(?:\b(?:pre|co)[ -]?requisites?\b.{0,60}\b(?:none|not required)\b|\bno\s+(?:pre|co)[ -]?requisites?\b)/i
      .test(statement);
    if (!statement || !explicitNone
        || !normalizedEvidenceText(evidence.raw_text).includes(statement)) {
      issues.push({
        path: `${path}.explicit_none_evidence.raw_text`,
        code: 'explicit_none_statement_not_in_source',
      });
    }
  } else if (none.kind === 'structured_vccs_master_record_boundary') {
    if (row?.source !== 'vccs_master_course_file'
        || !/^https:\/\/courses\.vccs\.edu\/courses\//.test(String(row?.source_url || ''))
        || none.course_entry_status !== 'published_exact_vccs_master_course_record'
        || none.finding !== 'no_prerequisite_or_corequisite_published_in_complete_master_record'
        || none.literal_none_statement !== false
        || none.parser_contract !== VCCS_MASTER_RECORD_CONTRACT
        || none.record_boundary !== 'dl > dt + dd'
        || none.requisite_text_boundary !== '.endtext'
        || none.requisite_clause_count !== 0
        || !SHA256.test(String(none.source_page_content_sha256 || ''))
        || !SHA256.test(String(none.record_html_sha256 || ''))
        || evidence.source_page_content_sha256 !== none.source_page_content_sha256
        || evidence.record_html_sha256 !== none.record_html_sha256
        || evidence.parser_contract !== none.parser_contract
        || evidence.record_boundary !== none.record_boundary
        || evidence.requisite_text_boundary !== none.requisite_text_boundary) {
      issues.push({
        path: `${path}.explicit_none_evidence`,
        code: 'structured_master_record_none_evidence_required',
      });
    }
  } else if (none.kind === 'structured_owner_catalog_record_boundary') {
    let source;
    let controlSource;
    try {
      source = new URL(String(row?.source_url || ''));
      controlSource = new URL(String(none?.same_catalog_marker_control?.source_url || ''));
    } catch {
      source = null;
      controlSource = null;
    }
    const control = none?.same_catalog_marker_control;
    const capture = evidence?.source_capture;
    const controlCapture = control?.source_capture;
    const controlCode = normalizedCourseCode(control?.code);
    const controlText = normalizedEvidenceText(control?.raw_requisites);
    if (row?.source !== VA_FIGURE6_PREREQUISITE_CONTRACT.community_college.owner_complete_authority
        || source?.hostname !== 'catalog.sw.edu'
        || source?.pathname !== '/preview_course_nopop.php'
        || controlSource?.hostname !== source?.hostname
        || controlSource?.pathname !== source?.pathname
        || controlSource?.searchParams.get('catoid') !== source?.searchParams.get('catoid')
        || controlSource?.searchParams.get('coid') === source?.searchParams.get('coid')
        || none.course_entry_status !== 'published_exact_owner_course_record'
        || none.finding !== 'no_prerequisite_or_corequisite_published_in_complete_owner_record'
        || none.literal_none_statement !== false
        || none.parser_contract !== SOUTHWEST_OWNER_RECORD_CONTRACT
        || none.record_boundary !== 'single CourseLeaf preview_course_nopop course record'
        || none.requisite_clause_count !== 0
        || none.source_response_sha256 !== capture?.source_response_sha256
        || none.course_fragment_html_sha256 !== capture?.course_fragment_html_sha256
        || none.response_parser_contract !== SOUTHWEST_RESPONSE_CAPTURE_CONTRACT
        || evidence.parser_contract !== none.parser_contract
        || evidence.record_boundary !== none.record_boundary
        || control?.catalog_year !== row?.catalog_year
        || !controlCode
        || !SHA256.test(String(control?.raw_entry_sha256 || ''))
        || controlCapture?.kind !== 'official_http_response_and_single_course_fragment'
        || !SHA256.test(String(controlCapture?.source_response_sha256 || ''))
        || !SHA256.test(String(controlCapture?.course_fragment_html_sha256 || ''))
        || controlCapture?.extracted_entry_sha256 !== control?.raw_entry_sha256
        || controlCapture?.catalog_name_seen !== `${control?.catalog_year} Catalog`
        || controlCapture?.parser_contract !== SOUTHWEST_RESPONSE_CAPTURE_CONTRACT
        || !/^(?:Prerequisite\(s\)|Prerequisites?|Corequisites?)\s*:/i.test(controlText)) {
      issues.push({
        path: `${path}.explicit_none_evidence`,
        code: 'structured_owner_record_none_evidence_required',
      });
    }
  } else if (none.course_entry_status !== 'published_course_entry'
      || none.finding !== 'no_prerequisite_or_corequisite_published') {
    issues.push({
      path: `${path}.explicit_none_evidence`,
      code: 'reviewed_exact_course_entry_finding_required',
    });
  }
  return issues;
}

function officialSourceEvidenceIssues(rows, {
  role,
  officialHostsByOwner = {},
  allowedOwners = null,
} = {}) {
  const issues = [];
  const smallUniversityEvidence = loadSmallUniversityPrerequisiteEvidence();
  const universityPrerequisiteTailControl = loadUniversityPrerequisiteTailControl();
  const radfordRandolphMaconTailEvidence = loadRadfordRandolphMaconTailEvidence();
  const remainingUniversityPrerequisiteEvidence =
    loadRemainingUniversityPrerequisiteEvidence();
  const vcuEgmnPrerequisiteEvidence = loadVcuEgmnPrerequisiteEvidence();
  const radfordUvaWiseRecursiveEvidence = loadRadfordUvaWiseRecursiveEvidence();
  const hostsByOwner = normalizedOfficialHosts(officialHostsByOwner);
  const expectedOwners = allowedOwners ? new Set(allowedOwners) : null;
  const owners = [...new Set(asArray(rows)
    .map((row) => String(row?.owner_namespace || '').trim()).filter(Boolean))];

  for (const [index, row] of asArray(rows).entries()) {
    const path = `${role}[${index}]`;
    const owner = String(row?.owner_namespace || '').trim();
    const evidence = evidenceForRow(row);
    const host = urlHost(evidence.source_url);
    const allowedHosts = hostsByOwner.get(owner);
    if (expectedOwners && !expectedOwners.has(owner)) {
      issues.push({ path: `${path}.owner_namespace`, code: 'unexpected_prerequisite_owner' });
    }
    if (!allowedHosts?.size) {
      issues.push({
        path: `${path}.source_url`,
        code: 'official_source_host_allowlist_missing',
      });
    } else if (!host || !allowedHosts.has(host)) {
      issues.push({ path: `${path}.source_url`, code: 'source_url_not_official_owner_host' });
    }
    if (evidence.kind !== VA_FIGURE6_PREREQUISITE_CONTRACT.publication.source_evidence_kind) {
      issues.push({ path: `${path}.source_evidence.kind`, code: 'official_course_entry_evidence_required' });
    }
    if (!String(evidence.raw_text || '').trim()) {
      issues.push({ path: `${path}.source_evidence.raw_text`, code: 'source_evidence_raw_text_required' });
    }
    if (!SHA256.test(String(evidence.content_sha256 || ''))) {
      issues.push({ path: `${path}.source_evidence.content_sha256`, code: 'source_content_sha256_required' });
    } else if (sha256(evidence.raw_text || '') !== evidence.content_sha256) {
      issues.push({ path: `${path}.source_evidence.content_sha256`, code: 'source_content_hash_mismatch' });
    }
    if (row?.source_content_sha256 !== evidence.content_sha256) {
      issues.push({ path: `${path}.source_content_sha256`, code: 'row_source_content_hash_mismatch' });
    }
    if (evidence.raw_text && !evidenceContainsCourseCode(evidence.raw_text, keyOf(row))) {
      issues.push({ path: `${path}.source_evidence.raw_text`, code: 'source_entry_course_code_missing' });
    }
    if (host === 'catalog.sw.edu') {
      let source;
      try {
        source = new URL(evidence.source_url);
      } catch {
        source = null;
      }
      issues.push(...southwestCaptureIssues(row, path, evidence, source));
    }
    if (row?.status === 'parsed') {
      const sourceText = normalizedEvidenceText(evidence.raw_text);
      const requisiteText = normalizedEvidenceText(row?.raw_requisites);
      const exactSmallUniversityFormula =
        row?.small_university_prerequisite_resolution?.contract
          === SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT
        && smallUniversityPrerequisiteResolutionRowIssues(
          row, smallUniversityEvidence,
        ).length === 0;
      if (requisiteText && !sourceText.includes(requisiteText)
          && !exactSmallUniversityFormula) {
        issues.push({
          path: `${path}.raw_requisites`,
          code: 'parsed_requisite_text_not_in_source_entry',
        });
      }
    }
    for (const issue of vsuPrerequisiteClosureResolutionRowIssues(row)) {
      issues.push({
        path: `${path}.virginia_state_prerequisite_closure`,
        code: `vsu_prerequisite_closure_${issue}`,
      });
    }
    for (const issue of norfolkStatePrerequisiteClosureResolutionRowIssues(row)) {
      issues.push({
        path: `${path}.norfolk_state_prerequisite_closure`,
        code: `nsu_prerequisite_closure_${issue}`,
      });
    }
    if (!isScopedRemainingUniversityPrerequisite(row)
        && !isScopedVcuEgmnPrerequisite(row)) {
      for (const issue of vcuPrerequisiteResolutionRowIssues(row)) {
        issues.push({
          path: `${path}.vcu_prerequisite_closure`,
          code: `vcu_prerequisite_closure_${issue}`,
        });
      }
    }
    for (const issue of virginiaTechRecursivePrerequisiteResolutionRowIssues(row)) {
      issues.push({
        path: `${path}.virginia_tech_recursive_prerequisite`,
        code: `virginia_tech_recursive_prerequisite_${issue}`,
      });
    }
    for (const issue of smallUniversityPrerequisiteResolutionRowIssues(
      row, smallUniversityEvidence,
    )) {
      issues.push({
        path: `${path}.small_university_prerequisite_closure`,
        code: `small_university_prerequisite_closure_${issue}`,
      });
    }
    for (const issue of universityPrerequisiteTailResolutionRowIssues(
      row, universityPrerequisiteTailControl,
    )) {
      issues.push({
        path: `${path}.university_prerequisite_tail_closure`,
        code: `university_prerequisite_tail_closure_${issue}`,
      });
    }
    for (const issue of radfordRandolphMaconTailResolutionRowIssues(
      row, radfordRandolphMaconTailEvidence,
    )) {
      issues.push({
        path: `${path}.radford_randolph_macon_tail`,
        code: `radford_randolph_macon_tail_${issue}`,
      });
    }
    for (const issue of remainingUniversityPrerequisiteResolutionRowIssues(
      row, remainingUniversityPrerequisiteEvidence,
    )) {
      issues.push({
        path: `${path}.remaining_university_prerequisite`,
        code: `remaining_university_prerequisite_${issue}`,
      });
    }
    for (const issue of vcuEgmnPrerequisiteResolutionRowIssues(
      row, vcuEgmnPrerequisiteEvidence,
    )) {
      issues.push({
        path: `${path}.vcu_egmn_prerequisite`,
        code: `vcu_egmn_prerequisite_${issue}`,
      });
    }
    for (const issue of radfordUvaWiseRecursiveResolutionRowIssues(
      row, radfordUvaWiseRecursiveEvidence,
    )) {
      issues.push({
        path: `${path}.radford_uva_wise_recursive_prerequisite`,
        code: `radford_uva_wise_recursive_prerequisite_${issue}`,
      });
    }
    issues.push(...explicitNoneEvidenceIssues(
      row, path, evidence, smallUniversityEvidence,
      universityPrerequisiteTailControl,
      radfordRandolphMaconTailEvidence,
      remainingUniversityPrerequisiteEvidence,
      vcuEgmnPrerequisiteEvidence,
    ));
  }

  for (const owner of owners) {
    const ownerRows = asArray(rows).filter((row) => row?.owner_namespace === owner);
    const expectedHash = sourceBundleHashForRows(ownerRows, owner);
    for (const [index, row] of asArray(rows).entries()) {
      if (row?.owner_namespace !== owner) continue;
      if (!SHA256.test(String(row?.source_bundle_hash || ''))) {
        issues.push({
          path: `${role}[${index}].source_bundle_hash`,
          code: 'source_bundle_hash_required',
        });
      } else if (row.source_bundle_hash !== expectedHash) {
        issues.push({
          path: `${role}[${index}].source_bundle_hash`,
          code: 'source_bundle_hash_not_content_derived',
        });
      }
    }
  }
  return issues;
}

function receiptPayload(receipt = {}) {
  return Object.fromEntries(Object.entries(receipt || {}).filter(([key]) => ![
    '_id',
    'active',
    'deactivated_at',
    'published_at',
    'receipt_sha256',
    'corpus_counts',
  ].includes(key)));
}

const verificationReceiptHash = (receipt) => sha256(canonicalJson(receiptPayload(receipt)));

function verificationReceiptIssues(receipt, {
  publicationGeneration,
  artifactHashes = null,
  now = new Date(),
} = {}) {
  const issues = [];
  if (!receipt || typeof receipt !== 'object') {
    return [{ path: 'verification_receipt', code: 'human_verification_receipt_required' }];
  }
  if (receipt.schema_version !== 1) {
    issues.push({ path: 'verification_receipt.schema_version', code: 'verification_receipt_schema_invalid' });
  }
  if (receipt.artifact !== RECEIPT_ARTIFACT) {
    issues.push({ path: 'verification_receipt.artifact', code: 'verification_receipt_artifact_invalid' });
  }
  if (receipt.contract_version !== VA_FIGURE6_PREREQUISITE_CONTRACT.version) {
    issues.push({ path: 'verification_receipt.contract_version', code: 'verification_receipt_contract_mismatch' });
  }
  if (receipt.decision !== RECEIPT_DECISION) {
    issues.push({ path: 'verification_receipt.decision', code: 'human_publication_approval_required' });
  }
  if (receipt.verification_method !== RECEIPT_METHOD
      || receipt?.verified_by?.kind !== 'human'
      || !String(receipt?.verified_by?.name || '').trim()
      || !String(receipt?.verified_by?.role || '').trim()) {
    issues.push({ path: 'verification_receipt.verified_by', code: 'named_human_verifier_required' });
  }
  const verifiedAt = new Date(receipt.verified_at);
  if (!receipt.verified_at || Number.isNaN(verifiedAt.getTime())
      || verifiedAt.getTime() > new Date(now).getTime() + 5 * 60 * 1000) {
    issues.push({ path: 'verification_receipt.verified_at', code: 'verification_timestamp_invalid' });
  }
  if (receipt.signed_statement !== RECEIPT_STATEMENT) {
    issues.push({ path: 'verification_receipt.signed_statement', code: 'verification_statement_required' });
  }
  if (receipt.publication_generation !== publicationGeneration) {
    issues.push({ path: 'verification_receipt.publication_generation', code: 'verification_generation_mismatch' });
  }
  const expectedReceiptId = publicationGeneration
    ? `va:figure6:prerequisites:${publicationGeneration}` : null;
  if (receipt._id != null && receipt._id !== expectedReceiptId) {
    issues.push({ path: 'verification_receipt._id', code: 'verification_receipt_id_mismatch' });
  }
  for (const attestation of RECEIPT_ATTESTATIONS) {
    if (receipt?.attestations?.[attestation] !== true) {
      issues.push({
        path: `verification_receipt.attestations.${attestation}`,
        code: 'verification_attestation_required',
      });
    }
  }
  const requiredArtifactHashes = [
    'community_college_corpus',
    'university_corpus',
    'vccs_scope',
    'university_scope',
  ];
  for (const name of requiredArtifactHashes) {
    const expected = artifactHashes?.[name];
    if (!SHA256.test(String(receipt?.artifact_sha256?.[name] || ''))
        || (expected && receipt.artifact_sha256[name] !== expected)) {
        issues.push({
          path: `verification_receipt.artifact_sha256.${name}`,
          code: 'verification_artifact_hash_mismatch',
        });
    }
  }
  if (receipt.receipt_sha256 != null
      && receipt.receipt_sha256 !== verificationReceiptHash(receipt)) {
    issues.push({ path: 'verification_receipt.receipt_sha256', code: 'verification_receipt_hash_mismatch' });
  }
  return issues;
}

function ownerCompleteVccsSourceIssues(row, path) {
  const issues = [];
  const sourceUrl = String(row?.source_url || '');
  const southwestSource = /^https:\/\/catalog\.sw\.edu\/preview_course_nopop\.php\?/.test(
    sourceUrl,
  );
  const laurelRidgeSource = sourceUrl
    === 'https://laurelridge.edu/files/documents/current-students/college-catalog/2019-20/2019-20%20CATALOG.pdf';
  if (!southwestSource && !laurelRidgeSource) {
    issues.push({ path: `${path}.source_url`, code: 'owner_catalog_source_url_required' });
  }
  const closureOnly = row?.scope_role === 'prerequisite_only';
  const expectedAuthorityScope = closureOnly
    ? 'owner_complete_for_canonical_dependency_scope'
    : 'owner_complete_for_requirement_scope';
  if (!['parsed', 'none'].includes(row?.status)
      || row?.authority_scope !== expectedAuthorityScope) {
    issues.push({ path: `${path}.authority_scope`, code: 'owner_complete_scope_required' });
  }
  const scopeOwners = asArray(
    closureOnly ? row?.required_by_owner_coverage : row?.scope_colleges,
  ).filter(isVccsCollege).sort();
  const coveredOwners = asArray(row?.owner_coverage).filter(isVccsCollege).sort();
  if (!scopeOwners.length || canonicalJson(scopeOwners) !== canonicalJson(coveredOwners)) {
    issues.push({ path: `${path}.owner_coverage`, code: 'owner_formula_scope_incomplete' });
  }
  if (closureOnly && (!asArray(row?.required_by).length || asArray(row.required_by).some((code) => (
    !normalizedCourseCode(code)
  )))) {
    issues.push({ path: `${path}.required_by`, code: 'canonical_dependency_receipt_required' });
  }
  if (row?.current_vccs_master_evidence?.status !== 'missing'
      || !/^https:\/\/courses\.vccs\.edu\/courses\//.test(
        String(row?.current_vccs_master_evidence?.source_url || ''),
      )) {
    issues.push({
      path: `${path}.current_vccs_master_evidence`,
      code: 'missing_current_master_proof_required',
    });
  }
  const evidence = evidenceForRow(row);
  if (evidence.kind !== VA_FIGURE6_PREREQUISITE_CONTRACT.publication.source_evidence_kind
      || !String(evidence.raw_text || '').trim()) {
    issues.push({ path: `${path}.source_evidence`, code: 'official_course_entry_evidence_required' });
  }
  if (!SHA256.test(String(evidence.content_sha256 || ''))
      || sha256(evidence.raw_text || '') !== evidence.content_sha256
      || row?.source_content_sha256 !== evidence.content_sha256) {
    issues.push({ path: `${path}.source_content_sha256`, code: 'source_content_hash_mismatch' });
  }
  if (!evidenceContainsCourseCode(evidence.raw_text, keyOf(row))) {
    issues.push({ path: `${path}.source_evidence.raw_text`, code: 'source_entry_course_code_missing' });
  }
  if (southwestSource) {
    let source;
    try {
      source = new URL(sourceUrl);
    } catch {
      source = null;
    }
    issues.push(...southwestCaptureIssues(row, path, evidence, source));
  }
  if (row?.status === 'none') {
    issues.push(...explicitNoneEvidenceIssues(row, path, evidence));
  }
  if (row?.status === 'parsed' && !normalizedEvidenceText(evidence.raw_text).includes(
    normalizedEvidenceText(row?.raw_requisites),
  )) {
    issues.push({ path: `${path}.raw_requisites`, code: 'parsed_requisite_text_not_in_source_entry' });
  }
  if (laurelRidgeSource && (
    evidence.document_content_sha256
      !== 'eaf380a923383e2c59c41df590ca6d6e6c3306f1d4d8249dc4446e4aaaac9273'
    || !Number.isInteger(evidence.catalog_page)
    || !Number.isInteger(evidence.pdf_page)
  )) {
    issues.push({ path: `${path}.source_evidence`, code: 'archived_catalog_receipt_required' });
  }
  return issues;
}

function sourceIssues(rows, requiredKeys, contract, role) {
  const issues = [];
  const byKey = new Map();
  asArray(rows).forEach((row, index) => {
    const key = keyOf(row);
    if (key && byKey.has(key)) {
      issues.push({ path: `${role}[${index}].course_key`, code: 'duplicate_course_requisite' });
    } else if (key) {
      byKey.set(key, row);
    }
  });
  if (!rows?.length) issues.push({ path: role, code: 'prerequisite_corpus_missing' });
  for (const key of requiredKeys || []) {
    if (!byKey.has(key)) issues.push({ path: `${role}.${key}`, code: 'required_course_requisite_missing' });
  }
  asArray(rows).forEach((row, index) => {
    const path = `${role}[${index}]`;
    if (!keyOf(row)) issues.push({ path: `${path}.course_key`, code: 'course_key_required' });
    if (role === 'community_college') {
      if (row?.owner_namespace !== contract.owner_namespace) {
        issues.push({ path: `${path}.owner_namespace`, code: 'vccs_owner_namespace_required' });
      }
      if (![contract.authority, contract.owner_complete_authority].includes(row?.source)) {
        issues.push({ path: `${path}.source`, code: 'wrong_prerequisite_authority' });
      } else if (row?.source === contract.owner_complete_authority) {
        issues.push(...ownerCompleteVccsSourceIssues(row, path));
      } else if (!/^https:\/\/courses\.vccs\.edu\/courses\//.test(String(row?.source_url || ''))) {
        issues.push({ path: `${path}.source_url`, code: 'vccs_master_source_url_required' });
      }
    } else {
      if (!/^va:uni:\d+$/.test(String(row?.owner_namespace || ''))) {
        issues.push({ path: `${path}.owner_namespace`, code: 'university_owner_namespace_required' });
      }
      if (row?.source !== contract.authority) {
        issues.push({ path: `${path}.source`, code: 'wrong_prerequisite_authority' });
      }
      if (!row?.source_bundle_hash) {
        issues.push({ path: `${path}.source_bundle_hash`, code: 'source_bundle_hash_required' });
      }
      if (!/^https?:\/\/[^\s/]+(?:\/|$)/.test(String(row?.source_url || ''))) {
        issues.push({ path: `${path}.source_url`, code: 'university_catalog_source_url_required' });
      }
    }
    if (keyOf(row) && !ownerOwnsCourseKey(row?.owner_namespace, keyOf(row))) {
      issues.push({
        path: `${path}.course_key`,
        code: 'course_key_outside_owner_namespace',
      });
    }
    issues.push(...formulaIssues(row, path));
    if (role !== 'community_college') {
      for (const issue of vsuEnglishProjectionRowIssues(row)) {
        issues.push({
          path: `${path}.vsu_english_cs_scope_projection`,
          code: `vsu_english_cs_scope_projection_${issue}`,
        });
      }
    }
    asArray(row?.groups).forEach((group, groupIndex) => {
      asArray(group?.paths).forEach((formulaPath, pathIndex) => {
        asArray(formulaPath?.all_of).forEach((condition, conditionIndex) => {
          const conditionPath = `${path}.groups[${groupIndex}]`
            + `.paths[${pathIndex}].all_of[${conditionIndex}]`;
          if (condition?.type === 'non_course') {
            if (!String(condition?.condition || '').trim()) {
              issues.push({
                path: `${conditionPath}.condition`,
                code: 'non_course_condition_required',
              });
            }
            if (!String(condition?.raw || '').trim()) {
              issues.push({
                path: `${conditionPath}.raw`,
                code: 'non_course_raw_required',
              });
            }
            return;
          }
          if (condition?.type !== 'course') {
            issues.push({ path: `${conditionPath}.type`, code: 'requisite_condition_not_supported' });
            return;
          }
          const conditionKey = String(condition?.course_key || '').trim();
          const conditionCode = normalizedCourseCode(condition?.code);
          if (!conditionCode) {
            issues.push({ path: `${conditionPath}.code`, code: 'course_condition_code_required' });
          }
          if (!conditionKey) {
            issues.push({ path: `${conditionPath}.course_key`, code: 'course_key_required' });
          } else if (!ownerOwnsCourseKey(row?.owner_namespace, conditionKey)) {
            issues.push({
              path: `${conditionPath}.course_key`,
              code: 'prerequisite_key_outside_owner_namespace',
            });
          } else if (conditionCode
              && conditionKey !== expectedOwnedCourseKey(row.owner_namespace, conditionCode)) {
            issues.push({
              path: `${conditionPath}.course_key`,
              code: 'prerequisite_course_code_key_mismatch',
            });
          }
          if (conditionKey && !byKey.has(conditionKey)) {
            issues.push({
              path: conditionPath,
              code: 'prerequisite_formula_closure_missing',
            });
          }
        });
      });
    });
  });
  return issues;
}

function publicationMetadataIssues({
  communityCollegeRows = [],
  universityRows = [],
  requiredCommunityCollegeKeys = [],
  requiredUniversityKeys = [],
  officialHostsByOwner = {},
  verificationReceipt = null,
} = {}) {
  const issues = [];
  const allRows = [...asArray(communityCollegeRows), ...asArray(universityRows)];
  const expectedGeneration = publicationGenerationFor({
    communityCollegeRows,
    universityRows,
    requiredCommunityCollegeKeys,
    requiredUniversityKeys,
    officialHostsByOwner,
  });
  const expectedReceiptHash = verificationReceipt
    ? verificationReceiptHash(verificationReceipt) : null;
  const expectedReceiptId = `va:figure6:prerequisites:${expectedGeneration}`;
  for (const [index, row] of allRows.entries()) {
    const path = `publication_rows[${index}]`;
    if (row?.contract_version !== VA_FIGURE6_PREREQUISITE_CONTRACT.version) {
      issues.push({ path: `${path}.contract_version`, code: 'publication_contract_version_mismatch' });
    }
    if (row?.publication_generation !== expectedGeneration) {
      issues.push({ path: `${path}.publication_generation`, code: 'publication_generation_not_content_derived' });
    }
    if (!SHA256.test(String(row?.verification_receipt_sha256 || ''))) {
      issues.push({ path: `${path}.verification_receipt_sha256`, code: 'verification_receipt_hash_required' });
    } else if (expectedReceiptHash && row.verification_receipt_sha256 !== expectedReceiptHash) {
      issues.push({ path: `${path}.verification_receipt_sha256`, code: 'row_verification_receipt_mismatch' });
    }
    if (row?.verification_receipt_id !== expectedReceiptId) {
      issues.push({ path: `${path}.verification_receipt_id`, code: 'row_verification_receipt_id_mismatch' });
    }
  }
  issues.push(...verificationReceiptIssues(verificationReceipt, {
    publicationGeneration: expectedGeneration,
  }));
  return issues;
}

function validateVccsFigure6PrerequisiteCorpus({ rows = [], requiredKeys = [] } = {}) {
  const issues = sourceIssues(
    rows,
    requiredKeys,
    VA_FIGURE6_PREREQUISITE_CONTRACT.community_college,
    'community_college',
  );
  const requiredSet = new Set(requiredKeys);
  const requiredRows = rows.filter((row) => requiredSet.has(keyOf(row)));
  const statusCounts = Object.fromEntries(
    ['parsed', 'none', 'missing', 'unparsed'].map((status) => [
      status,
      requiredRows.filter((row) => row?.status === status).length,
    ])
  );
  return {
    ready: issues.length === 0,
    blocker: issues.length ? BLOCKER : null,
    owner_namespace: VCCS_OWNER_NAMESPACE,
    formula: FORMULA,
    counts: {
      rows: rows.length,
      required: requiredKeys.length,
      required_present: requiredRows.length,
      ...statusCounts,
    },
    issues,
  };
}

function validateVirginiaFigure6PrerequisiteCorpus({
  communityCollegeRows = [],
  universityRows = [],
  requiredCommunityCollegeKeys = [],
  requiredUniversityKeys = [],
  adapterIntegrated = false,
  requireOfficialSourceEvidence = false,
  officialHostsByOwner = {},
  allowedUniversityOwners = null,
  requirePublicationMetadata = false,
  verificationReceipt = null,
} = {}) {
  const issues = [
    ...sourceIssues(
      communityCollegeRows,
      requiredCommunityCollegeKeys,
      VA_FIGURE6_PREREQUISITE_CONTRACT.community_college,
      'community_college',
    ),
    ...sourceIssues(
      universityRows,
      requiredUniversityKeys,
      VA_FIGURE6_PREREQUISITE_CONTRACT.university,
      'university',
    ),
  ];
  if (requireOfficialSourceEvidence) {
    issues.push(...officialSourceEvidenceIssues(communityCollegeRows, {
      role: 'community_college',
      officialHostsByOwner,
      allowedOwners: [VCCS_OWNER_NAMESPACE],
    }));
    issues.push(...officialSourceEvidenceIssues(universityRows, {
      role: 'university',
      officialHostsByOwner,
      allowedOwners: allowedUniversityOwners,
    }));
  }
  if (requirePublicationMetadata) {
    issues.push(...publicationMetadataIssues({
      communityCollegeRows,
      universityRows,
      requiredCommunityCollegeKeys,
      requiredUniversityKeys,
      officialHostsByOwner,
      verificationReceipt,
    }));
  }
  if (!adapterIntegrated) {
    issues.push({ path: 'figure6_adapter', code: 'exact_formula_adapter_not_integrated' });
  }
  return {
    ready: issues.length === 0,
    blocker: issues.length ? BLOCKER : null,
    contract: VA_FIGURE6_PREREQUISITE_CONTRACT,
    counts: {
      community_college: communityCollegeRows.length,
      university: universityRows.length,
      required_community_college: requiredCommunityCollegeKeys.length,
      required_university: requiredUniversityKeys.length,
    },
    issues,
  };
}

/**
 * Validate either the legacy checked-in/imported VCCS rows or future rows that
 * already satisfy the strict Figure 6 contract.  The moment any row declares
 * an owner namespace, the whole collection is treated as contract-shaped so a
 * mixed or partially migrated corpus fails visibly instead of being repaired
 * in memory.
 */
function validateVirginiaFigure6PrerequisiteSources({
  communityCollegeRows = [],
  universityRows = [],
  vccsScopeRows = [],
  universityScope = {},
  adapterIntegrated = false,
  verificationReceipt = null,
  requirePublicationContract = true,
} = {}) {
  const hasContractOwnership = communityCollegeRows.some((row) => (
    row?.owner_namespace != null
  ));
  const vccs = hasContractOwnership
    ? {
      rows: communityCollegeRows.map(adaptExactRequisiteRow),
      requiredKeys: requiredVccsCourseKeys(vccsScopeRows),
    }
    : adaptVccsPrerequisiteArtifact({ rows: communityCollegeRows }, vccsScopeRows);
  const requiredUniversityKeys = requiredUniversityCourseKeys(universityScope);
  const allowedUniversityOwners = asArray(universityScope?.universities)
    .map((row) => String(row?.owner_namespace || '').trim()).filter(Boolean);
  const report = validateVirginiaFigure6PrerequisiteCorpus({
    communityCollegeRows: vccs.rows,
    universityRows: universityRows.map(adaptExactRequisiteRow),
    requiredCommunityCollegeKeys: vccs.requiredKeys,
    requiredUniversityKeys,
    adapterIntegrated,
    requireOfficialSourceEvidence: requirePublicationContract,
    officialHostsByOwner: officialHostsForPrerequisiteScope(universityScope),
    allowedUniversityOwners,
    requirePublicationMetadata: requirePublicationContract,
    verificationReceipt,
  });
  const requiredSet = new Set(vccs.requiredKeys);
  const requiredVccsRows = vccs.rows.filter((row) => requiredSet.has(keyOf(row)));
  report.counts.community_college_required_status = Object.fromEntries(
    ['parsed', 'none', 'missing', 'unparsed'].map((status) => [
      status,
      requiredVccsRows.filter((row) => row?.status === status).length,
    ]),
  );
  return report;
}

function unavailableVirginiaFigure6PrerequisiteReport() {
  return validateVirginiaFigure6PrerequisiteCorpus();
}

module.exports = {
  BLOCKER,
  FORMULA,
  RECEIPT_ARTIFACT,
  RECEIPT_ATTESTATIONS,
  RECEIPT_DECISION,
  RECEIPT_METHOD,
  RECEIPT_STATEMENT,
  VCCS_OWNER_NAMESPACE,
  VCCS_MASTER_RECORD_CONTRACT,
  BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_KIND,
  BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
  SHENANDOAH_UNIVERSITY_BOUNDARY_CONTRACT,
  SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_KIND,
  SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
  UVA_WISE_UNIVERSITY_BOUNDARY_CONTRACT,
  UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_KIND,
  UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
  VA_FIGURE6_PREREQUISITE_CONTRACT,
  adaptExactRequisiteRow,
  adaptVccsPrerequisiteArtifact,
  canonicalJson,
  officialHostsForPrerequisiteScope,
  officialSourceEvidenceIssues,
  hasUnmodeledConstraintSignal,
  publicationGenerationFor,
  publicationMetadataIssues,
  requiredVccsCourseKeys,
  requiredUniversityCourseKeys,
  sha256,
  sourceBundleHashForRows,
  unavailableVirginiaFigure6PrerequisiteReport,
  validateVccsFigure6PrerequisiteCorpus,
  validateVirginiaFigure6PrerequisiteCorpus,
  validateVirginiaFigure6PrerequisiteSources,
  verificationReceiptHash,
  verificationReceiptIssues,
};
