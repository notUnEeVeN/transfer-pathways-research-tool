const crypto = require('node:crypto');
const {
  longwoodFigureSelection,
} = require('../analysis/longwoodConstraintProofs');

const FORMULA = 'paths_or__conditions_and';
const TARGET_COLLECTION = 'va_university_course_requisites';

const ACTIVE_UNIVERSITY_COHORT = Object.freeze([
  { school_id: 9205, slug: 'bridgewater-college' },
  { school_id: 9206, slug: 'christopher-newport-university' },
  { school_id: 9210, slug: 'george-mason-university' },
  { school_id: 9213, slug: 'james-madison-university' },
  { school_id: 9214, slug: 'longwood-university' },
  { school_id: 9217, slug: 'norfolk-state-university' },
  { school_id: 9218, slug: 'old-dominion-university' },
  { school_id: 9219, slug: 'radford-university' },
  { school_id: 9221, slug: 'randolph-macon-college' },
  { school_id: 9224, slug: 'shenandoah-university' },
  { school_id: 9226, slug: 'the-university-of-virginia-s-college-at-wise' },
  { school_id: 9228, slug: 'university-of-mary-washington' },
  { school_id: 9229, slug: 'virginia-commonwealth-university' },
  { school_id: 9230, slug: 'virginia-polytechnic-institute-and-state-university' },
  { school_id: 9231, slug: 'virginia-state-university' },
  { school_id: 9233, slug: 'william-mary' },
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function normalizeCourseCode(value) {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(normalized) ? normalized : null;
}

function requirementReceiverInventory(composition) {
  const codes = new Set();
  const unnamed = {};
  for (const group of composition?.requirement_groups || []) {
    for (const section of group?.sections || []) {
      for (const receiver of section?.receivers || []) {
        if (receiver?.kind === 'course') {
          const code = normalizeCourseCode(receiver.code);
          if (code) codes.add(code);
        } else if (receiver?.kind === 'series') {
          for (const rawCode of receiver.codes || []) {
            const code = normalizeCourseCode(rawCode);
            if (code) codes.add(code);
          }
        } else {
          const kind = String(receiver?.kind || 'unknown');
          unnamed[kind] = (unnamed[kind] || 0) + 1;
        }
      }
    }
  }
  return {
    direct_named_course_codes: [...codes].sort(),
    unnamed_receiver_counts: Object.fromEntries(Object.entries(unnamed).sort()),
  };
}

function exactCodeTokenSeen(text, code) {
  const normalized = normalizeCourseCode(code);
  if (!normalized) return false;
  const match = normalized.match(/^([A-Z]+)(\d+[A-Z]?)$/);
  const pattern = `(?<![A-Z0-9])${match[1]}[\\s-]*${match[2]}(?![A-Z0-9])`;
  return new RegExp(pattern, 'i').test(String(text || ''));
}

function courseCatalogSource(requirements) {
  return (requirements?.sources || []).find((source) => source?.role === 'course_catalog') || null;
}

function deterministicResidentPath(composition, slug, directCodes) {
  if (slug !== 'longwood-university') {
    return { codes: [], receipt: null };
  }
  const selection = longwoodFigureSelection(composition);
  if (!selection.ready) {
    throw new Error(`Longwood deterministic resident path is not exact: ${selection.reason}`);
  }
  const direct = new Set(directCodes);
  const codes = [...new Set([
    ...selection.selected_course_codes,
    ...selection.selected_perspective_course_codes,
  ])].filter((code) => !direct.has(code)).sort();
  if (JSON.stringify(codes) !== JSON.stringify([
    'CMSC360', 'CMSC415', 'CMSC455', 'MATH301', 'PSYC335', 'RELI301', 'SPAN320',
  ])) {
    throw new Error('Longwood deterministic resident path prerequisite target set drifted');
  }
  return {
    codes,
    receipt: {
      evaluator: 'longwoodFigureSelection',
      proof_tree_sha256: selection.proof.proof_tree_sha256,
      source_response_sha256:
        selection.proof.electives.source_response.response_sha256,
      selected_course_codes: [...selection.selected_course_codes],
      selected_course_keys: [...selection.selected_course_keys],
      selected_perspective_course_codes: [
        ...selection.selected_perspective_course_codes,
      ],
      selected_perspective_course_keys: [
        ...selection.selected_perspective_course_keys,
      ],
      civitae_evidence_sha256:
        selection.proof.civitae.proof.evidence_sha256,
      scope_reason: 'three source-valid open-menu CMSC courses and four exact source-selected resident Perspective courses become required prerequisite targets only for the deterministic canonical paper path; CMSC210 is already in the authored direct named set',
    },
  };
}

function requiredResidentPathCourseCodes(university) {
  return [...new Set([
    ...(university?.direct_named_course_codes || []),
    ...(university?.deterministic_resident_path_course_codes || []),
  ])].sort();
}

function buildUniversityScopeEntry({ schoolId, slug, composition, requirements, catalogText }) {
  if (!composition) throw new Error(`missing composition for ${slug}`);
  if (!requirements) throw new Error(`missing extracted requirements for ${slug}`);
  const source = courseCatalogSource(requirements);
  if (!source?.url || !source?.sha256) throw new Error(`missing course_catalog source for ${slug}`);

  const ownerNamespace = `va:uni:${schoolId}`;
  const inventory = requirementReceiverInventory(composition);
  const deterministic = deterministicResidentPath(
    composition, slug, inventory.direct_named_course_codes,
  );
  const tokenSeen = inventory.direct_named_course_codes
    .filter((code) => exactCodeTokenSeen(catalogText, code));
  const tokenMissing = inventory.direct_named_course_codes
    .filter((code) => !tokenSeen.includes(code));
  const textHash = sha256(String(catalogText || ''));
  const prerequisiteMarkerCount = (
    String(catalogText || '').match(/\b(?:pre|co)requisites?\b/gi) || []
  ).length;

  return {
    school_id: Number(schoolId),
    slug,
    owner_namespace: ownerNamespace,
    catalog_year: composition.catalog_year || requirements.catalog_year || null,
    catalog_platform: requirements.platform || null,
    direct_named_course_count: inventory.direct_named_course_codes.length,
    direct_named_course_codes: inventory.direct_named_course_codes,
    deterministic_resident_path_course_count: deterministic.codes.length,
    deterministic_resident_path_course_codes: deterministic.codes,
    deterministic_resident_path_receipt: deterministic.receipt,
    course_key_rule: `${ownerNamespace}:<NORMALIZED_COURSE_CODE>`,
    unnamed_receiver_counts: inventory.unnamed_receiver_counts,
    cached_course_catalog: {
      official_url: source.url,
      declared_normalized_text_sha256: source.sha256,
      retained_normalized_text_sha256: textHash,
      byte_match: source.sha256 === textHash,
      exact_code_token_count: tokenSeen.length,
      prerequisite_text_marker_count: prerequisiteMarkerCount,
      exact_code_tokens_seen: tokenSeen,
      direct_codes_not_seen: tokenMissing,
      evidence_boundary: 'A token hit proves only that the exact code occurs in the retained official text. It is not a parsed course entry, a prerequisite formula, or evidence of no prerequisite.',
    },
    checked_in_contract_rows: 0,
    collection_status: 'blocked_pending_owner_scoped_formula_collection',
  };
}

function buildUniversityPrerequisiteScope({ compositions, requirements, catalogTexts }) {
  const universities = ACTIVE_UNIVERSITY_COHORT.map(({ school_id: schoolId, slug }) => (
    buildUniversityScopeEntry({
      schoolId,
      slug,
      composition: compositions[slug],
      requirements: requirements[slug],
      catalogText: catalogTexts[slug],
    })
  ));
  const sum = (selector) => universities.reduce((total, row) => total + selector(row), 0);
  const directNamed = sum((row) => row.direct_named_course_count);
  const deterministicResidentPath = sum(
    (row) => row.deterministic_resident_path_course_count,
  );
  const tokenSeen = sum((row) => row.cached_course_catalog.exact_code_token_count);
  const unnamedRequirement = sum((row) => row.unnamed_receiver_counts.requirement || 0);
  const unnamedGe = sum((row) => row.unnamed_receiver_counts.ge_area || 0);

  return {
    schema_version: 1,
    artifact: 'virginia_figure6_university_prerequisite_collection_scope',
    snapshot_date: '2026-08-23',
    target_collection: TARGET_COLLECTION,
    formula_contract: FORMULA,
    authority: 'institution_catalog',
    publication_ready: false,
    summary: {
      active_universities: universities.length,
      direct_named_courses: directNamed,
      deterministic_resident_path_courses: deterministicResidentPath,
      required_resident_path_courses: directNamed + deterministicResidentPath,
      exact_code_tokens_in_cached_official_text: tokenSeen,
      direct_course_detail_capture_floor: directNamed - tokenSeen,
      unnamed_requirement_receivers: unnamedRequirement,
      ge_area_receivers: unnamedGe,
      checked_in_owner_scoped_rows: 0,
      recursive_closure_courses: null,
    },
    evidence_boundary: {
      direct_scope: 'All uniquely named course and series codes in the 16 active bachelor compositions. Open requirement and GE receivers are counted separately and do not silently become courses.',
      deterministic_resident_path_scope: 'A separate field may add a course only when an exact source-bound paper evaluator fixes one legal resident path through an authored open menu. The authored direct named inventory remains unchanged.',
      cached_text: 'The retained course-catalog text hashes match the normalized official-source hashes recorded by the degree collector. Exact code-token occurrence is discovery evidence only.',
      completeness: 'The direct named set is a lower bound. Prerequisite courses discovered while parsing must be recursively collected until closure, and open degree menus need deterministic source-backed resolution before a resident path can be fixed.',
    },
    blockers: [
      'No checked-in row currently satisfies the va:uni:<school_id> owner-specific prerequisite contract.',
      'Explicit status=none rows are required for courses whose official entry publishes no prerequisite; absence of text cannot be interpreted as none.',
      'Recursive prerequisite closure is unknown until the direct course entries are parsed.',
      'Open requirement and GE receivers prevent the named direct-course list from representing every possible resident pathway.',
    ],
    collection_plan: {
      phase_1: 'Reuse byte-matched cached official text for exact course entries that are actually present; capture an official owner course-detail page for each direct code not present.',
      phase_2: `Parse each entry into ${FORMULA}; preserve prerequisite and corequisite groups, grades, concurrency, placement, consent, and raw unresolved clauses.`,
      phase_3: 'Recursively enqueue every referenced owner-local course until all formula references resolve or carry a source-backed non-course condition.',
      phase_4: 'Emit an explicit parsed or none row for every direct and closure course. Never infer none from a missing marker, search index, or department landing page.',
      phase_5: 'Hash the exact retained source bundle per university, independently review formula paths, then import all 16 owners in one generation before enabling Figure 6.',
    },
    universities,
  };
}

function validateUniversityPrerequisiteScope(scope) {
  const issues = [];
  if (scope?.schema_version !== 1) issues.push('schema_version');
  if (scope?.target_collection !== TARGET_COLLECTION) issues.push('target_collection');
  if (scope?.formula_contract !== FORMULA) issues.push('formula_contract');
  if (scope?.publication_ready !== false) issues.push('publication_ready_must_remain_false');
  const rows = Array.isArray(scope?.universities) ? scope.universities : [];
  if (rows.length !== ACTIVE_UNIVERSITY_COHORT.length) issues.push('active_university_count');

  let direct = 0;
  let deterministicResidentPath = 0;
  let seen = 0;
  let missing = 0;
  let unnamedRequirement = 0;
  let unnamedGe = 0;
  const owners = new Set();
  const expectedById = new Map(ACTIVE_UNIVERSITY_COHORT.map((row) => [row.school_id, row.slug]));
  for (const row of rows) {
    const codes = row?.direct_named_course_codes || [];
    const deterministicCodes = row?.deterministic_resident_path_course_codes || [];
    const present = row?.cached_course_catalog?.exact_code_tokens_seen || [];
    const absent = row?.cached_course_catalog?.direct_codes_not_seen || [];
    if (row?.owner_namespace !== `va:uni:${row?.school_id}`) issues.push(`${row?.slug}:owner_namespace`);
    if (expectedById.get(row?.school_id) !== row?.slug) issues.push(`${row?.slug}:active_cohort_identity`);
    if (owners.has(row?.owner_namespace)) issues.push(`${row?.slug}:duplicate_owner`);
    owners.add(row?.owner_namespace);
    if (codes.length !== new Set(codes).size || codes.some((code) => normalizeCourseCode(code) !== code)) {
      issues.push(`${row?.slug}:course_codes`);
    }
    if (row?.direct_named_course_count !== codes.length) issues.push(`${row?.slug}:direct_count`);
    if (row?.deterministic_resident_path_course_count !== deterministicCodes.length) {
      issues.push(`${row?.slug}:deterministic_resident_path_count`);
    }
    if (deterministicCodes.length !== new Set(deterministicCodes).size
        || deterministicCodes.some((code) => normalizeCourseCode(code) !== code)
        || deterministicCodes.some((code) => codes.includes(code))) {
      issues.push(`${row?.slug}:deterministic_resident_path_codes`);
    }
    if (row?.slug === 'longwood-university') {
      const receipt = row?.deterministic_resident_path_receipt;
      if (JSON.stringify(deterministicCodes) !== JSON.stringify([
        'CMSC360', 'CMSC415', 'CMSC455', 'MATH301', 'PSYC335', 'RELI301', 'SPAN320',
      ])
          || receipt?.evaluator !== 'longwoodFigureSelection'
          || receipt?.proof_tree_sha256
            !== '5926ef44b66d491623f861c1e9840d6fc7dc12c198f238aae7f96b9ccb83ff68'
          || receipt?.source_response_sha256
            !== '01802e9aff48430af3064550c8b8bb6eb5011953282e3c18633f16101788609d'
          || JSON.stringify(receipt?.selected_course_codes)
            !== JSON.stringify(['CMSC415', 'CMSC455', 'CMSC210', 'CMSC360'])
          || JSON.stringify(receipt?.selected_perspective_course_codes)
            !== JSON.stringify(['PSYC335', 'RELI301', 'MATH301', 'SPAN320'])
          || receipt?.civitae_evidence_sha256
            !== '157a03c4b1c576863d4debce15e834e9df9905a9b584d94b53dfeac5ff265df6') {
        issues.push(`${row?.slug}:deterministic_resident_path_receipt`);
      }
    } else if (deterministicCodes.length || row?.deterministic_resident_path_receipt != null) {
      issues.push(`${row?.slug}:unexpected_deterministic_resident_path`);
    }
    if (present.length + absent.length !== codes.length
        || new Set([...present, ...absent]).size !== codes.length
        || [...present, ...absent].some((code) => !codes.includes(code))) {
      issues.push(`${row?.slug}:capture_partition`);
    }
    if (row?.cached_course_catalog?.byte_match !== true) issues.push(`${row?.slug}:source_hash`);
    if (row?.checked_in_contract_rows !== 0) issues.push(`${row?.slug}:unexpected_contract_rows`);
    direct += codes.length;
    deterministicResidentPath += deterministicCodes.length;
    seen += present.length;
    missing += absent.length;
    unnamedRequirement += row?.unnamed_receiver_counts?.requirement || 0;
    unnamedGe += row?.unnamed_receiver_counts?.ge_area || 0;
  }
  if (scope?.summary?.direct_named_courses !== direct) issues.push('summary_direct_named_courses');
  if (scope?.summary?.deterministic_resident_path_courses !== deterministicResidentPath) {
    issues.push('summary_deterministic_resident_path_courses');
  }
  if (scope?.summary?.required_resident_path_courses !== direct + deterministicResidentPath) {
    issues.push('summary_required_resident_path_courses');
  }
  if (scope?.summary?.exact_code_tokens_in_cached_official_text !== seen) issues.push('summary_token_count');
  if (scope?.summary?.direct_course_detail_capture_floor !== missing) issues.push('summary_capture_floor');
  if (scope?.summary?.unnamed_requirement_receivers !== unnamedRequirement) {
    issues.push('summary_unnamed_requirement_receivers');
  }
  if (scope?.summary?.ge_area_receivers !== unnamedGe) issues.push('summary_ge_area_receivers');
  if (scope?.summary?.checked_in_owner_scoped_rows !== 0) issues.push('summary_contract_rows');
  return { valid: issues.length === 0, issues };
}

module.exports = {
  ACTIVE_UNIVERSITY_COHORT,
  FORMULA,
  TARGET_COLLECTION,
  buildUniversityPrerequisiteScope,
  buildUniversityScopeEntry,
  exactCodeTokenSeen,
  normalizeCourseCode,
  requiredResidentPathCourseCodes,
  requirementReceiverInventory,
  sha256,
  validateUniversityPrerequisiteScope,
};
