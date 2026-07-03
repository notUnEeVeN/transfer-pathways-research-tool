/**
 * Analysis + export endpoints. Each analysis serves JSON by default and a
 * flat CSV with `?format=csv` (nested cells JSON-encoded) — the export-first
 * contract: partners reproduce the papers' figures in notebooks against
 * these, so every payload carries the dataset_version it was computed from.
 *
 * Query params shared by all endpoints:
 *   scope=all|uc|csu           (default all)
 *   majorContains=<substring>  (case-insensitive; usually the whole point)
 * choice-cost additionally takes schoolIds=1,2,3 — an ORDERED list.
 *
 * Results are cached briefly per (endpoint × params); curation edits or a
 * re-port show up within a minute without a restart.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { currentDatasetVersion } = require('../services/datasetVersion');
const { majorScope, scopeTag } = require('../services/majorVisibility');
const {
  coverageData, creditLossData, choiceCostData,
  categoryGapsData, complexityData, timeToDegreeData,
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
    const key = `${name}|${params.majorContains}|${params.schoolIds.join(',')}|v:${scopeTag(params.visiblePairs)}`;
    const rows = await cached(key, () => computeFn(db, auditDb, params));
    const dataset_version = await currentDatasetVersion(db);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name}-${dataset_version || 'unversioned'}.csv"`
      );
      // The version rides in the filename + a header (a CSV column would be
      // pure repetition); notebooks read the X-Dataset-Version header.
      res.setHeader('X-Dataset-Version', dataset_version || '');
      return res.send(toCsv(rows));
    }
    res.json({ dataset_version, params, n: rows.length, rows });
  });
}

exports.coverage = makeEndpoint('coverage', coverageData);
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

// Raw curated/reference exports for notebooks that want the underlying data.
const RAW_EXPORTS = new Set([
  'curation_course_categories', 'curation_receiver_overrides', 'curation_prereqs',
  'curation_assoc_degrees', 'ref_campus_calendars', 'ref_tuition',
  'ref_cc_districts', 'ref_locations', 'audit_results',
]);

exports.rawExport = asyncHandler(async (req, res) => {
  const coll = req.params.collection;
  if (!RAW_EXPORTS.has(coll)) return res.status(404).json({ error: 'unknown export' });
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const rows = await auditDb.collection(coll).find().toArray();
  const dataset_version = await currentDatasetVersion(db);
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${coll}-${dataset_version || 'unversioned'}.csv"`);
    res.setHeader('X-Dataset-Version', dataset_version || '');
    return res.send(toCsv(rows));
  }
  res.json({ dataset_version, n: rows.length, rows });
});

exports._toCsv = toCsv;
