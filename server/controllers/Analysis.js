/**
 * Analysis + export endpoints. Each analysis serves JSON by default and a
 * flat CSV with `?format=csv` (nested cells JSON-encoded). The analysis routes
 * power the built-in Visuals cards and remain useful to local notebooks; bulk
 * exports support analyses that should be computed entirely on-device.
 *
 * Query params shared by all endpoints:
 *   scope=all|uc|csu           (default all)
 *   majorSlug=<configured slug> (exact campus/program pairs; preferred)
 *   majorContains=<substring>  (legacy California-only free-text search)
 *   groupBy=college|district|county  (coverage only; default college)
 *   requirements=degree|assist|paper (coverage only; default assist)
 * choice-cost additionally takes schoolIds=1,2,3 — an ORDERED list.
 * multi-campus-pathways takes schoolIds as an UNORDERED set, plus an optional
 * communityCollegeId and native semester/quarter unit-load assumptions.
 *
 * Results are cached briefly per (endpoint × params); curation edits or a
 * re-port show up within a minute without a restart.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  majorScopeFromQuery, getMajor, listMajors, defaultMajor, programPairs,
} = require('../config/majors');
const { AS_DEGREE_SLOTS } = require('../config/asDegreeSlots');
const { stateClause } = require('../config/stateScope');
const { pathwayComplexityCached } = require('../services/analysis/pathwayComplexity');
const {
  unavailableVirginiaFigure6PrerequisiteReport,
} = require('../services/virginia/pathwayComplexityPrerequisites');
const {
  VA_ANALYSIS_PUBLICATION_CONTRACT,
  virginiaAnalysisPublicationStatus,
} = require('../services/virginia/analysisPublicationGate');

// Committed Figure-6 reproductions for paper corpora (prerequisite edges come
// from the papers' own recovered workbooks, not from a live prerequisite
// projection). One entry per paper state.
const PAPER_COMPLEXITY_SNAPSHOTS = {
  ma: require('../data/ma/complexity-validation.json'),
};
const { asDegreesExportData } = require('../services/asDegreeView');
const { majorScope, scopeTag } = require('../services/majorVisibility');
const { getReleasedIds, getDisabledIds } = require('../services/analysisReleases');
const {
  coverageData, requirementComparisonData, creditLossData, choiceCostData,
  categoryGapsData, complexityData, timeToDegreeData,
  agreementsExportData, receiversExportData, coursesExportData, universityCoursesExportData,
} = require('../services/analysis/pathways');
const { transferCreditRateData } = require('../services/analysis/transferCreditRate');
const { multiCampusPathwaysData } = require('../services/analysis/pathwayPlanner');
const { loadMultiCampusSnapshot } = require('../services/analysis/pathwaySnapshot');
const { curationEpoch } = require('../services/curationEpoch');

const TTL_MS = 60 * 1000;
const cache = new Map(); // key → { at, rows }

// Presentation settings for the built-in Visuals cards. The route is console-
// gated; the frontend uses the same response for the admin and partner views.
exports.getReleases = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  res.json({
    released_ids: await getReleasedIds(auditDb),
    disabled_ids: await getDisabledIds(auditDb),
  });
});

async function cached(key, compute) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  const rows = await compute();
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

/**
 * Major-scoped publication is independent of the globally released renderer
 * id. Most majors need no extra receipt. A major that declares a publication
 * gate cannot reach any shared analysis reader until the exact runtime receipt
 * validates against the current database state.
 *
 * Returns true after writing the fail-closed response, false when the caller
 * may continue.
 */
async function requireAnalysisPublication(req, res, majorOrSlug) {
  const major = typeof majorOrSlug === 'string' ? getMajor(majorOrSlug) : majorOrSlug;
  const gate = major?.publicationGate;
  if (!gate) return false;
  if (gate.contract !== VA_ANALYSIS_PUBLICATION_CONTRACT) {
    res.status(503).json({
      error: 'publication_receipt_required',
      capability: 'analysisPublicationReceipt',
      major: major?.slug || null,
      publication_blocker: {
        ready: false,
        blocker: 'analysis_publication_gate_configuration_error',
        contract: gate.contract || null,
        issues: [{ code: 'unsupported_publication_gate_contract' }],
      },
    });
    return true;
  }
  const status = await virginiaAnalysisPublicationStatus(req.app.locals.db);
  req.analysisPublicationStatus = status;
  if (status.ready === true && status.major_slug === major.slug
      && status.contract === gate.contract) return false;
  res.status(503).json({
    error: 'publication_receipt_required',
    capability: 'analysisPublicationReceipt',
    major: major.slug,
    detail: 'Virginia analysis is unavailable until one exact, current publication receipt passes every figure gate.',
    publication_blocker: status,
  });
  return true;
}

// ?majorSlug=<slug> (preferred) or the legacy California-only
// ?majorContains=<substring>. State corpora require a configured slug so a
// free-text search cannot bypass a major-scoped publication gate.
// The param is majorSlug, not major, because `major` already means the exact
// ASSIST program name elsewhere in this API (requirement-comparison, the
// visible-pairs shape). A known slug returns its exact campus/program mapping;
// it is never converted into a substring search.
function resolveMajorScope(query = {}) {
  // Analysis endpoints fail safe to the established CS study. A newly
  // configured major must be requested explicitly; merely onboarding it can
  // never widen an existing figure or an older API client's result.
  const majorSlug = query.majorSlug
    || (String(query.majorContains || '').trim() ? '' : defaultMajor().slug);
  return majorScopeFromQuery({
    major: majorSlug,
    majorContains: query.majorContains,
  });
}

function requiresCompleteDistrictMatrix(scope, { groupBy, requirements }) {
  return Boolean(
    scope.slug
    && groupBy === 'district'
    && requirements === 'assist'
    && programPairs(scope.majorPrograms).length
  );
}

async function parseParams(req, scope) {
  const groupBy = ['college', 'district', 'county'].includes(req.query.groupBy)
    ? req.query.groupBy
    : 'college';
  const requirements = ['degree', 'assist', 'paper'].includes(req.query.requirements)
    ? req.query.requirements
    : 'assist';
  const visiblePairs = await majorScope(req);
  return {
    majorSlug: scope.slug,
    majorPrograms: scope.majorPrograms,
    majorContains: scope.majorContains,
    schoolIds: String(req.query.schoolIds || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter(Number.isFinite),
    groupBy,
    requirements,
    // Compatibility aliases retained for existing figure URLs. Both resolve
    // to the configured canonical major; neither reads a historical union or
    // mutable settings selection anymore.
    pin: ['paper', 'settings'].includes(req.query.pin) ? req.query.pin : null,
    // Partner visibility (null = admin, unrestricted). Applied inside every
    // pathways query, so partners' analyses cover exactly the granted subset.
    visiblePairs,
    // Built-in district figures must never paint a partial configured-major
    // matrix as genuine zero coverage. This remains fail-closed when a
    // partner's visible scope is partial; only the legacy free-text query keeps
    // its generic sparse-response behavior.
    requireCompleteDistrictMatrix: requiresCompleteDistrictMatrix(scope, {
      groupBy, requirements, visiblePairs,
    }),
  };
}

// Flat-ish CSV: header union of all row keys; nested values JSON-encoded.
function toCsv(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

function makeEndpoint(name, computeFn, { needsSchoolIds = false, responseParams = null } = {}) {
  return asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const auditDb = req.app.locals.auditDb || db;
    const scope = resolveMajorScope(req.query);
    if (scope.error) return res.status(400).json({ error: scope.error, known: scope.known });
    if (scope.slug && await requireAnalysisPublication(req, res, scope.slug)) return undefined;
    const params = await parseParams(req, scope);
    if (needsSchoolIds && !params.schoolIds.length) {
      return res.status(400).json({ error: 'schoolIds=<ordered,comma,list> required' });
    }
    const exactScope = programPairs(params.majorPrograms)
      .map((pair) => `${pair.school_id}:${pair.major}`).join(',');
    // The curation epoch is part of the key, so any write to hand-curated data
    // retires every memoized analysis at once. Without it the client's
    // post-save refetch is answered out of this cache with the pre-edit rows,
    // and the browser then holds that answer as fresh.
    const key = `${name}|e:${curationEpoch()}|${params.majorSlug || ''}|x:${exactScope}|q:${params.majorContains}|${params.schoolIds.join(',')}|g:${params.groupBy}|r:${params.requirements}|p:${params.pin || ''}|complete:${params.requireCompleteDistrictMatrix ? 1 : 0}|v:${scopeTag(params.visiblePairs)}`;
    // Degree templates are editable in the Data tab, and `?refresh=1` is the
    // reader asking for a recomputation outright — neither may be served from
    // the memo.
    const liveDegreeCoverage = name === 'coverage' && params.requirements === 'degree';
    const forced = String(req.query.refresh || '') === '1';
    const rows = (liveDegreeCoverage || forced)
      ? await computeFn(db, auditDb, params)
      : await cached(key, () => computeFn(db, auditDb, params));
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name}.csv"`
      );
      return res.send(toCsv(rows));
    }
    res.json({ params: responseParams ? { ...params, ...responseParams } : params, n: rows.length, rows });
  });
}

exports.coverage = makeEndpoint('coverage', coverageData);

// Per-college ASSIST-vs-website minimums comparison (one campus × major ×
// college). Single object, not a row list, so it can't ride makeEndpoint;
// same per-key cache.
exports.requirementComparison = asyncHandler(async (req, res) => {
  const schoolId = Number(req.query.school_id);
  const communityCollegeId = Number(req.query.community_college_id);
  const major = String(req.query.major || '').trim();
  if (!Number.isFinite(schoolId) || !Number.isFinite(communityCollegeId) || !major) {
    return res.status(400).json({ error: 'school_id, major, and community_college_id are required' });
  }
  const configuredMajor = listMajors({ includeStates: true }).find((entry) => programPairs(entry).some((pair) => (
    pair.school_id === schoolId && pair.major.trim() === major
  )));
  if (!configuredMajor) {
    return res.status(400).json({ error: 'major is not configured for this campus' });
  }
  if (await requireAnalysisPublication(req, res, configuredMajor)) return undefined;
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const key = `requirement-comparison|${configuredMajor.slug}|${schoolId}|${communityCollegeId}|${major}`;
  const data = await cached(key, () => requirementComparisonData(db, auditDb, { schoolId, major, communityCollegeId }));
  res.json(data);
});

// Associate-degree contribution model: per (college with an associate degree ×
// campus), the share of the full bachelor's plan and of its lower-division
// requirements fulfilled by that associate degree. Legacy AS-unit utilization
// fields remain for the separate replacement-coursework figure. Both degree
// structures are editable in the Data tab, so this endpoint deliberately
// bypasses the short analysis cache;
// an explicit frontend refresh must never receive a pre-edit result.
exports.pathwayComplexity = asyncHandler(async (req, res) => {
  // The MA paper's Figure 6 measure over our pathways. The scorer reproduces
  // 59/60 archived workbook scores; paper, archive and recomputation remain
  // separately labelled because agreement on the equation does not make their
  // graph provenance interchangeable.
  const slug = String(req.query.majorSlug || '').trim() || defaultMajor().slug;
  const major = getMajor(slug);
  if (!major) return res.status(400).json({ error: `unknown major: ${slug}` });
  if (await requireAnalysisPublication(req, res, major)) return undefined;
  if (major.capabilities.pathwayComplexityPrerequisites === false) {
    return res.status(400).json({
      error: 'capability_required',
      capability: 'pathwayComplexityPrerequisites',
      major: major.slug,
      detail: 'Figure 6 requires exact community-college and university-local prerequisite formulas.',
      publication_blocker: unavailableVirginiaFigure6PrerequisiteReport(),
    });
  }
  // A paper corpus without prerequisite data serves its committed Figure-6
  // reproduction instead of a live assembly: our scorer run over the paper's
  // own recovered pathway workbooks, which carry the prerequisite/corequisite
  // edges the published scores were computed from. Regenerate with
  // scripts/ma/complexityCheck.js; keyed by state so a future paper corpus
  // cannot inherit Massachusetts's snapshot.
  if (!major.capabilities.prerequisites && major.capabilities.paperBaselines) {
    const snapshot = PAPER_COMPLEXITY_SNAPSHOTS[major.state];
    if (!snapshot) {
      return res.status(400).json({ error: 'capability_required', capability: 'prerequisites', major: major.slug });
    }
    return res.json({ mode: 'paper', ...snapshot });
  }
  for (const capability of ['asDegrees', 'degreeTemplates', 'prerequisites']) {
    if (!major.capabilities[capability]) {
      return res.status(400).json({ error: 'capability_required', capability, major: major.slug });
    }
  }
  const requestedType = String(req.query.degree_type || '').trim();
  if (requestedType && !AS_DEGREE_SLOTS.includes(requestedType)) {
    return res.status(400).json({ error: `degree_type must be one of ${AS_DEGREE_SLOTS.join(', ')}` });
  }
  // Figure 6 is presented on the statewide A.S.-T cohort unless the caller
  // pins another slot. Several majors list local_as first for older analyses;
  // inheriting that array order here was what made Foothill's broad local
  // catalogue pool silently replace its ten-course A.S.-T pathway.
  const configuredDefault = (major.degreeAnalysisSlots || []).includes('ast')
    ? 'ast'
    : (major.degreeAnalysisSlots || []).find((slot) => AS_DEGREE_SLOTS.includes(slot));
  const degreeType = requestedType || configuredDefault || 'ast';
  const verifiedOnlyParam = String(req.query.verified_only ?? '').trim().toLowerCase();
  if (verifiedOnlyParam && !['true', 'false', '1', '0'].includes(verifiedOnlyParam)) {
    return res.status(400).json({ error: 'verified_only must be true or false' });
  }
  // Presentation-safe default: scraped associate-degree records enter Figure 6
  // only after their explicit human-verification flag is set. The all-resolved
  // sensitivity remains available through verified_only=false.
  const verifiedOnly = verifiedOnlyParam
    ? verifiedOnlyParam === 'true' || verifiedOnlyParam === '1'
    : true;
  const pairs = await majorScope(req);
  // Served from the analysis cache — the ~10s full-corpus assembly runs once
  // (or on ?refresh=1) and visibility scoping is applied to the cached rows,
  // mirroring the service's own degree-level check.
  const {
    rows, computed_at, cached, model_version,
  } = await pathwayComplexityCached(req.app.locals.db, {
    majorSlug: slug,
    degreeType,
    verifiedOnly,
    refresh: String(req.query.refresh || '') === '1',
    // A Virginia cache key must include the exact selected-equivalency audit
    // used by the current publication receipt. The publication guard above
    // guarantees this value exists before a VA computation can start.
    publicationConditionDigest:
      req.analysisPublicationStatus?.transfer_equivalency_condition_report_sha256 || null,
  });
  const visible = pairs === null ? rows : rows.filter((row) => {
    const programs = major.programs?.[row.school_id] || [];
    return programs.some((program) => pairs.some(
      (pair) => pair.school_id === Number(row.school_id) && pair.major === program,
    ));
  });
  const excluded = visible.filter((row) => row.method_status === 'excluded');
  const excludedDegrees = new Map(excluded.map((row) => [String(row.record_id), {
    record_id: row.record_id,
    community_college_id: row.community_college_id,
    college_name: row.college_name,
    reason: row.exclusion_reason,
    warning: row.method_warning,
  }]));
  const sourceScope = {
    ...stateClause(major.state),
    kind: 'as_degree',
    status: 'found',
    major_slug: slug,
    degree_type: degreeType,
  };
  const sourceDegrees = await req.app.locals.db.collection('curated_requirements')
    .find(sourceScope)
    .project({ _id: 1, community_college_id: 1, 'verification.verified': 1 })
    .sort({ _id: 1 })
    .toArray();
  const sourceDegreeCount = sourceDegrees.length;
  const verifiedSourceDegreeCount = sourceDegrees
    .filter((degree) => degree.verification?.verified === true).length;
  const omittedSourceDegrees = verifiedOnly
    ? sourceDegrees.filter((degree) => degree.verification?.verified !== true) : [];
  const omittedCollegeIds = [...new Set(omittedSourceDegrees
    .map((degree) => Number(degree.community_college_id)).filter(Number.isFinite))];
  const omittedCollegeRows = omittedCollegeIds.length
    ? await req.app.locals.db.collection('assist_institutions').find({
      ...stateClause(major.state),
      kind: 'community_college',
      source_id: { $in: omittedCollegeIds },
    }).project({ source_id: 1, name: 1 }).toArray()
    : [];
  const omittedCollegeNames = new Map(omittedCollegeRows
    .map((row) => [Number(row.source_id), row.name]));
  res.json({
    rows: visible,
    degree_type: degreeType,
    verified_only: verifiedOnly,
    computed_at,
    cached,
    model_version,
    source_cohort: {
      degree_documents_total: sourceDegreeCount,
      degree_documents_verified: verifiedSourceDegreeCount,
      degree_documents_included: verifiedOnly ? verifiedSourceDegreeCount : sourceDegreeCount,
      unverified_degree_documents_omitted: verifiedOnly
        ? sourceDegreeCount - verifiedSourceDegreeCount : 0,
      omitted_unverified_degree_documents: omittedSourceDegrees.map((degree) => ({
        record_id: degree._id,
        community_college_id: degree.community_college_id,
        college_name: omittedCollegeNames.get(Number(degree.community_college_id)) || null,
      })),
    },
    exclusions: {
      degree_count: excludedDegrees.size,
      pathway_count: excluded.length,
      degrees: [...excludedDegrees.values()],
    },
  });
});

exports.transferCreditRate = asyncHandler(async (req, res) => {
  // Asking for a major whose associate-degree layer has not been gathered is
  // a client bug, not an empty result, so say so plainly.
  const slug = String(req.query.majorSlug || '').trim() || defaultMajor().slug;
  const major = getMajor(slug);
  if (!major) return res.status(400).json({ error: `unknown major: ${slug}` });
  if (await requireAnalysisPublication(req, res, major)) return undefined;
  if (!major.capabilities.asDegrees) {
    return res.status(400).json({
      error: 'capability_required',
      capability: 'asDegrees',
      major: major.slug,
    });
  }
  const requestedType = String(req.query.degree_type || '').trim();
  if (requestedType && !AS_DEGREE_SLOTS.includes(requestedType)) {
    return res.status(400).json({
      error: `degree_type must be one of ${AS_DEGREE_SLOTS.join(', ')}`,
    });
  }
  const configuredDefault = (major.degreeAnalysisSlots || [])
    .find((slot) => AS_DEGREE_SLOTS.includes(slot));
  const degreeType = requestedType || configuredDefault || 'local_as';
  const verifiedOnlyParam = String(req.query.verified_only ?? '').trim().toLowerCase();
  if (verifiedOnlyParam && !['true', 'false', '1', '0'].includes(verifiedOnlyParam)) {
    return res.status(400).json({ error: 'verified_only must be true or false' });
  }
  const verifiedOnly = verifiedOnlyParam === 'true' || verifiedOnlyParam === '1';
  const db = req.app.locals.db;
  const rows = await transferCreditRateData(db, null, {
    degreeType,
    majorSlug: major.slug,
    majorPrograms: major.programs,
    verifiedOnly,
    // `verified_only` scopes the associate-degree side only. Bachelor
    // templates carry and report their own verification records; one source's
    // status must never silently authorize the other side of the model.
    assumeDegreeTemplatesValid: false,
  });
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transfer-credit-rate.csv"');
    return res.send(toCsv(rows));
  }
  res.json({
    params: {
      degree_type: degreeType,
      majorSlug: major.slug,
      verified_only: verifiedOnly,
      degree_templates_assumed_valid: false,
      degree_template_evidence: 'per-template explicit verification record',
      method: 'bachelors_completion_v4',
    },
    n: rows.length,
    rows,
  });
});

function parseMultiCampusPathwayParams(query = {}) {
  const rawSchoolIds = String(query.schoolIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!rawSchoolIds.length || rawSchoolIds.some((value) => !/^\d+$/.test(value))) {
    return { error: 'schoolIds must be a comma-separated list of campus ids' };
  }
  const schoolIds = [...new Set(rawSchoolIds.map(Number))].sort((a, b) => a - b);
  if (!schoolIds.length || schoolIds.length > 9 || schoolIds.some((id) => id <= 0)) {
    return { error: 'Choose between 1 and 9 campus goals' };
  }

  if (query.mode === 'average' && query.communityCollegeId != null) {
    return { error: 'communityCollegeId is only used in college mode' };
  }
  const mode = query.mode === 'college' || (query.mode == null && query.communityCollegeId != null)
    ? 'college'
    : 'average';
  if (query.mode != null && !['average', 'college'].includes(query.mode)) {
    return { error: 'mode must be average or college' };
  }
  let communityCollegeId = null;
  if (mode === 'college') {
    const rawCollegeId = String(query.communityCollegeId ?? '').trim();
    if (!/^\d+$/.test(rawCollegeId) || Number(rawCollegeId) <= 0) {
      return { error: 'communityCollegeId is required in college mode' };
    }
    communityCollegeId = Number(rawCollegeId);
  }

  const semesterLoad = query.semesterLoad == null || query.semesterLoad === ''
    ? 15
    : Number(query.semesterLoad);
  const quarterLoad = query.quarterLoad == null || query.quarterLoad === ''
    ? 15
    : Number(query.quarterLoad);
  if (!Number.isFinite(semesterLoad) || semesterLoad < 6 || semesterLoad > 24) {
    return { error: 'semesterLoad must be between 6 and 24 units' };
  }
  if (!Number.isFinite(quarterLoad) || quarterLoad < 6 || quarterLoad > 30) {
    return { error: 'quarterLoad must be between 6 and 30 units' };
  }

  return { schoolIds, mode, communityCollegeId, semesterLoad, quarterLoad };
}

// Joint, overlap-aware major-preparation planner. Unlike choice-cost, campus
// order has no meaning: the same set of goals always shares one cache entry.
exports.multiCampusPathways = asyncHandler(async (req, res) => {
  const parsed = parseMultiCampusPathwayParams(req.query);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const visiblePairs = await majorScope(req);
  // A campus can only be planned for if the major has a program pinned there.
  // config/majors.js is the definition, so it is what we validate against.
  const scopeMajor = getMajor(String(req.query.majorSlug || '').trim() || defaultMajor().slug);
  if (!scopeMajor) return res.status(400).json({ error: `unknown major: ${req.query.majorSlug}` });
  if (await requireAnalysisPublication(req, res, scopeMajor)) return undefined;
  const available = new Set(Object.keys(scopeMajor.programs).map(Number));
  const unavailable = parsed.schoolIds.filter((schoolId) => !available.has(schoolId));
  if (unavailable.length) {
    return res.status(400).json({
      error: 'One or more selected campuses do not have a configured program in this dataset',
    });
  }
  const key = [
    'multi-campus-pathways-v2',
    scopeMajor.slug,
    parsed.schoolIds.join(','),
    parsed.mode,
    parsed.communityCollegeId || '',
    parsed.semesterLoad,
    parsed.quarterLoad,
    `v:${scopeTag(visiblePairs)}`,
  ].join('|');
  const data = await cached(key, () => multiCampusPathwaysData(db, auditDb, {
    ...parsed,
    majorSlug: scopeMajor.slug,
    // The planner resolves one target per campus by order. Give it only this
    // major's exact pairs so adding another configured field can never change
    // which program it selects.
    visiblePairs: programPairs(scopeMajor),
  }));

  if (req.query.format === 'csv') {
    const rows = data.rows || [];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="multi-campus-pathways.csv"');
    return res.send(toCsv(rows));
  }
  return res.json(data);
});

// Manually generated all-combinations average. This is one guarded, immutable
// research artifact rather than 511 expensive requests. Specific-college mode
// deliberately remains on the live endpoint above.
exports.multiCampusPathwaysSnapshot = asyncHandler(async (req, res) => {
  let snapshot;
  try {
    snapshot = await loadMultiCampusSnapshot();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return res.status(503).json({
        error: 'The multi-campus snapshot has not been generated yet.',
      });
    }
    return res.status(503).json({
      error: 'The multi-campus snapshot is invalid. Regenerate it before using this view.',
    });
  }

  // A frozen artifact is only valid for the program pins it was computed from.
  // config/majors.js defines those, so refuse the snapshot when its baked-in
  // campus/program pairs no longer match the configured major.
  const snapshotMajor = getMajor(snapshot.major_slug || defaultMajor().slug);
  if (snapshotMajor) {
    const configured = new Set(
      Object.entries(snapshotMajor.programs).flatMap(([schoolId, programs]) =>
        programs.map((program) => `${Number(schoolId)}|${program}`)),
    );
    const snapPairs = new Set(snapshot.campuses.map((campus) =>
      `${Number(campus.school_id)}|${String(campus.major)}`));
    const sameScope = [...snapPairs].every((pair) => configured.has(pair));
    if (!sameScope) {
      return res.status(409).json({
        error: 'The configured programs have changed since this snapshot was generated.',
      });
    }
  }

  const etag = `"${snapshot.artifact_fingerprint}"`;
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('ETag', etag);
  if (String(req.headers?.['if-none-match'] || '') === etag) return res.status(304).send('');
  return res.json(snapshot);
});

exports.creditLoss = makeEndpoint('credit-loss', creditLossData);
exports.choiceCost = makeEndpoint('choice-cost', choiceCostData, { needsSchoolIds: true });
exports.categoryGaps = makeEndpoint('category-gaps', categoryGapsData);
exports.complexity = makeEndpoint('complexity', complexityData);
exports.timeToDegree = makeEndpoint('time-to-degree', timeToDegreeData);

// Bulk exports — one call each for the whole scoped corpus (gzip on the wire).
exports.exportAgreements = makeEndpoint('agreements', agreementsExportData);
exports.exportReceivers = makeEndpoint('receivers', receiversExportData);
exports.exportCourses = makeEndpoint('courses', coursesExportData);
exports.exportUniversityCourses = makeEndpoint('university-courses', universityCoursesExportData);
// Deliberately fixed to Computer Science A.S.-T: this is the stable cohort for
// the transfer-credit visualizations, with full nested requirements + courses.
exports.exportCsAstDegrees = makeEndpoint(
  'cs-ast-degrees',
  (db) => asDegreesExportData(db, { degreeType: 'ast', major: 'cs' }),
  { responseParams: { degree_type: 'ast' } },
);
// The college's own CS A.S. is a separate construct from the standardized
// A.S.-T. Keep it in a sibling fixed-cohort export so analyses can compare the
// two without mixing in other locally-titled CS-adjacent degrees.
exports.exportLocalCsAsDegrees = makeEndpoint(
  'local-cs-as-degrees',
  (db) => asDegreesExportData(db, { degreeType: 'local_as', major: 'cs' }),
  { responseParams: { degree_type: 'local_as' } },
);

exports._toCsv = toCsv;
exports._parseMultiCampusPathwayParams = parseMultiCampusPathwayParams;
exports._requiresCompleteDistrictMatrix = requiresCompleteDistrictMatrix;
exports._resolveMajorScope = resolveMajorScope;
