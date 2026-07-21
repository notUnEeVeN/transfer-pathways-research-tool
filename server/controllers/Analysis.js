/**
 * Analysis + export endpoints. Each analysis serves JSON by default and a
 * flat CSV with `?format=csv` (nested cells JSON-encoded). The analysis routes
 * power the built-in Visuals cards and remain useful to local notebooks; bulk
 * exports support analyses that should be computed entirely on-device.
 *
 * Query params shared by all endpoints:
 *   scope=all|uc|csu           (default all)
 *   majorContains=<substring>  (case-insensitive; usually the whole point)
 *   groupBy=college|district|county  (coverage only; default college)
 *   requirements=degree|assist|paper (coverage only; default assist)
 * choice-cost additionally takes schoolIds=1,2,3 — an ORDERED list.
 *
 * Results are cached briefly per (endpoint × params); curation edits or a
 * re-port show up within a minute without a restart.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { asDegreesExportData } = require('../services/asDegreeView');
const { majorScope, scopeTag } = require('../services/majorVisibility');
const { getReleasedIds, getDisabledIds } = require('../services/analysisReleases');
const {
  coverageData, requirementComparisonData, creditLossData, choiceCostData,
  categoryGapsData, complexityData, timeToDegreeData,
  agreementsExportData, receiversExportData, coursesExportData, universityCoursesExportData,
} = require('../services/analysis/pathways');
const { transferCreditRateData } = require('../services/analysis/transferCreditRate');

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

async function parseParams(req) {
  return {
    majorContains: String(req.query.majorContains || '').trim(),
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
    // pin=paper: the paper-port figures' fixed major set (pathways.js
    // PAPER_MAJORS) — exact scraped programs, visibility scoping not applied.
    // pin=settings: those same figures' ASSIST view, resolving each campus's
    // program from the working-dataset selection instead (see settingsMajors).
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
    const params = await parseParams(req);
    if (needsSchoolIds && !params.schoolIds.length) {
      return res.status(400).json({ error: 'schoolIds=<ordered,comma,list> required' });
    }
    const key = `${name}|${params.majorContains}|${params.schoolIds.join(',')}|g:${params.groupBy}|r:${params.requirements}|p:${params.pin || ''}|v:${scopeTag(params.visiblePairs)}`;
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
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const key = `requirement-comparison|${schoolId}|${communityCollegeId}|${major}`;
  const data = await cached(key, () => requirementComparisonData(db, auditDb, { schoolId, major, communityCollegeId }));
  res.json(data);
});

// Whole-degree transfer-credit model: per (college with a CS associate degree ×
// campus), the share of the associate degree that applies to the full, curated
// graduation plan. Degree and associate-degree structures are editable in the
// Data tab, so this endpoint deliberately bypasses the short analysis cache;
// an explicit frontend refresh must never receive a pre-edit result.
exports.transferCreditRate = asyncHandler(async (req, res) => {
  const degreeType = ['ast', 'local_cs_as'].includes(req.query.degree_type)
    ? req.query.degree_type
    : 'local_cs_as';
  const db = req.app.locals.db;
  const rows = await transferCreditRateData(db, null, { degreeType });
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transfer-credit-rate.csv"');
    return res.send(toCsv(rows));
  }
  res.json({ params: { degree_type: degreeType, method: 'full_degree_v2' }, n: rows.length, rows });
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
