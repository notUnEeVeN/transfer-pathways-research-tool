/**
 * Analysis + export endpoints. Each analysis serves JSON by default and a
 * flat CSV with `?format=csv` (nested cells JSON-encoded). The analysis routes
 * power the built-in Visuals cards and remain useful to local notebooks; bulk
 * exports support analyses that should be computed entirely on-device.
 *
 * Query params shared by all endpoints:
 *   scope=all|uc|csu           (default all)
 *   majorSlug=<configured slug> (exact campus/program pairs; preferred)
 *   majorContains=<substring>  (legacy explicit free-text search only)
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

// ?majorSlug=<slug> (preferred) or the legacy ?majorContains=<substring>.
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

async function parseParams(req, scope) {
  return {
    majorSlug: scope.slug,
    majorPrograms: scope.majorPrograms,
    majorContains: scope.majorContains,
    schoolIds: String(req.query.schoolIds || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter(Number.isFinite),
    groupBy: ['college', 'district', 'county'].includes(req.query.groupBy)
      ? req.query.groupBy
      : 'college',
    requirements: ['degree', 'assist', 'paper'].includes(req.query.requirements)
      ? req.query.requirements
      : 'assist',
    // Compatibility aliases retained for existing figure URLs. Both resolve
    // to the configured canonical major; neither reads a historical union or
    // mutable settings selection anymore.
    pin: ['paper', 'settings'].includes(req.query.pin) ? req.query.pin : null,
    // Partner visibility (null = admin, unrestricted). Applied inside every
    // pathways query, so partners' analyses cover exactly the granted subset.
    visiblePairs: await majorScope(req),
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
    const params = await parseParams(req, scope);
    if (needsSchoolIds && !params.schoolIds.length) {
      return res.status(400).json({ error: 'schoolIds=<ordered,comma,list> required' });
    }
    const exactScope = programPairs(params.majorPrograms)
      .map((pair) => `${pair.school_id}:${pair.major}`).join(',');
    const key = `${name}|${params.majorSlug || ''}|x:${exactScope}|q:${params.majorContains}|${params.schoolIds.join(',')}|g:${params.groupBy}|r:${params.requirements}|p:${params.pin || ''}|v:${scopeTag(params.visiblePairs)}`;
    // Degree templates are editable in the Data tab. The frontend invalidates
    // its query after a save; bypassing the short analysis cache here makes the
    // next request reflect that edit immediately.
    const liveDegreeCoverage = name === 'coverage' && params.requirements === 'degree';
    const rows = liveDegreeCoverage
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
  const configuredMajor = listMajors().find((entry) => programPairs(entry).some((pair) => (
    pair.school_id === schoolId && pair.major.trim() === major
  )));
  if (!configuredMajor) {
    return res.status(400).json({ error: 'major is not configured for this campus' });
  }
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const key = `requirement-comparison|${configuredMajor.slug}|${schoolId}|${communityCollegeId}|${major}`;
  const data = await cached(key, () => requirementComparisonData(db, auditDb, { schoolId, major, communityCollegeId }));
  res.json(data);
});

// Whole-degree transfer-credit model: per (college with a CS associate degree ×
// campus), the share of the associate degree that applies to the full, curated
// graduation plan. Degree and associate-degree structures are editable in the
// Data tab, so this endpoint deliberately bypasses the short analysis cache;
// an explicit frontend refresh must never receive a pre-edit result.
exports.transferCreditRate = asyncHandler(async (req, res) => {
  // The AS-degree layer exists only for majors whose associate-degree data has
  // been gathered (cs today). Asking for one without it is a client bug, not an
  // empty result, so say so plainly.
  const slug = String(req.query.majorSlug || '').trim() || defaultMajor().slug;
  const major = getMajor(slug);
  if (!major) return res.status(400).json({ error: `unknown major: ${slug}` });
  if (!major.capabilities.asDegrees) {
    return res.status(400).json({
      error: 'capability_required',
      capability: 'asDegrees',
      major: major.slug,
    });
  }
  const degreeType = ['ast', 'local_cs_as'].includes(req.query.degree_type)
    ? req.query.degree_type
    : 'local_cs_as';
  const db = req.app.locals.db;
  const rows = await transferCreditRateData(db, null, {
    degreeType,
    majorSlug: major.slug,
    majorPrograms: major.programs,
  });
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transfer-credit-rate.csv"');
    return res.send(toCsv(rows));
  }
  res.json({
    params: { degree_type: degreeType, majorSlug: major.slug, method: 'full_degree_v2' },
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
  (db) => asDegreesExportData(db, { degreeType: 'ast' }),
  { responseParams: { degree_type: 'ast' } },
);
// The college's own CS A.S. is a separate construct from the standardized
// A.S.-T. Keep it in a sibling fixed-cohort export so analyses can compare the
// two without mixing in CIS/IT/networking degrees from local_computing.
exports.exportLocalCsAsDegrees = makeEndpoint(
  'local-cs-as-degrees',
  (db) => asDegreesExportData(db, { degreeType: 'local_cs_as' }),
  { responseParams: { degree_type: 'local_cs_as' } },
);

exports._toCsv = toCsv;
exports._parseMultiCampusPathwayParams = parseMultiCampusPathwayParams;
exports._resolveMajorScope = resolveMajorScope;
