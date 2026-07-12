/**
 * Analysis + export endpoints. Each analysis serves JSON by default and a
 * flat CSV with `?format=csv` (nested cells JSON-encoded) — the export-first
 * contract: partners reproduce the papers' figures in notebooks against
 * these. This is a legacy compatibility surface; new work reads the canonical
 * data API and computes locally before publishing a finished figure.
 *
 * Query params shared by all endpoints:
 *   scope=all|uc|csu           (default all)
 *   majorContains=<substring>  (case-insensitive; usually the whole point)
 *   groupBy=college|district|county  (coverage only; default college)
 *   requirements=assist|paper        (coverage only; default assist)
 * choice-cost additionally takes schoolIds=1,2,3 — an ORDERED list.
 *
 * Results are cached briefly per (endpoint × params); curation edits or a
 * re-port show up within a minute without a restart.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { majorScope, scopeTag } = require('../services/majorVisibility');
const {
  coverageData, requirementComparisonData,
  agreementsExportData, receiversExportData, coursesExportData, universityCoursesExportData,
} = require('../services/analysis/pathways');

const TTL_MS = 60 * 1000;
const cache = new Map(); // key → { at, rows }

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
    requirements: ['assist', 'paper'].includes(req.query.requirements)
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

function makeEndpoint(name, computeFn, { needsSchoolIds = false } = {}) {
  return asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const auditDb = req.app.locals.auditDb || db;
    const params = await parseParams(req);
    if (needsSchoolIds && !params.schoolIds.length) {
      return res.status(400).json({ error: 'schoolIds=<ordered,comma,list> required' });
    }
    const key = `${name}|${params.majorContains}|${params.schoolIds.join(',')}|g:${params.groupBy}|r:${params.requirements}|p:${params.pin || ''}|v:${scopeTag(params.visiblePairs)}`;
    const rows = await cached(key, () => computeFn(db, auditDb, params));
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name}.csv"`
      );
      return res.send(toCsv(rows));
    }
    res.json({ params, n: rows.length, rows });
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
// Bulk exports — one call each for the whole scoped corpus (gzip on the wire).
exports.exportAgreements = makeEndpoint('agreements', agreementsExportData);
exports.exportReceivers = makeEndpoint('receivers', receiversExportData);
exports.exportCourses = makeEndpoint('courses', coursesExportData);
exports.exportUniversityCourses = makeEndpoint('university-courses', universityCoursesExportData);

exports._toCsv = toCsv;
