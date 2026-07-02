// Dashboard aggregations that sit alongside the core stats payload.
//   _matrixData — coverage heatmap (UC campus × major area) + the largest
//                 unverified templates worklist, from a single cluster scan.
//
// Math (cluster keys) is delegated to stats.js so there is one source of truth;
// this only gathers + groups the DB inputs. Memoized per filter like the other
// data functions.

const cache = require('../auditCache');
const {
  AUDIT_RESULTS,
  SYSTEM_BY_KEY,
  activeSystems,
  systemMatch,
  verdictMatch,
} = require('./filters');
const { _ensureVerdictDenorm, _partitionLiveStale } = require('./staleness');
const { clusterKey } = require('./stats');
const { AREAS, classifyArea } = require('./majorAreas');

// Worst-tier ordering (mirrors stats.js): correct < flagged < conservative < error.
const TIER_RANK = { correct: 0, flagged: 1, conservative: 2, error: 3 };

// Worst live verdict tier per cluster (keyed by the canonical clusterKey). Stale
// verdicts are excluded, matching every other stat.
async function _liveClusterTiers(db, filter, auditDb = db) {
  await _ensureVerdictDenorm(db, auditDb);
  const raw = await auditDb.collection(AUDIT_RESULTS).find(verdictMatch(filter)).toArray();
  const { live } = await _partitionLiveStale(db, raw);
  const worst = new Map(); // clusterKey -> tier
  for (const v of live) {
    const hash = v.raw_template_hash || v.template_fp;
    if (hash == null) continue;
    const sysKey = v.system || 'uc';
    const sEntry = SYSTEM_BY_KEY.get(sysKey);
    if (!sEntry) continue;
    const schoolId = v[sEntry.idField];
    if (schoolId == null) continue;
    const key = clusterKey(sysKey, schoolId, v.major, hash);
    const cur = worst.get(key);
    if (!cur || TIER_RANK[v.result] > TIER_RANK[cur]) worst.set(key, v.result);
  }
  return worst;
}

// Coverage matrix (UC campus × major area) + largest unverified templates.
async function _matrixData(db, filter, auditDb = db) {
  return cache.memoize('matrix', filter, async () => {
    const sys = activeSystems(filter);

    // ── Distinct template clusters with doc counts (one scan) ──
    // cluster = (school, major, raw_template_hash); docs in it differ only by CC.
    const rowsByCampus = new Map(); // `${system}|${schoolId}` -> row accumulator
    const clusters = [];            // { key, system, schoolId, school, major, area, nDocs }
    const ensureRow = (system, schoolId, school) => {
      const k = `${system}|${schoolId}`;
      let r = rowsByCampus.get(k);
      if (!r) { r = { system, school_id: schoolId, school, total: 0, cells: new Map() }; rowsByCampus.set(k, r); }
      return r;
    };
    const ensureCell = (row, area) => {
      let c = row.cells.get(area);
      if (!c) { c = { total: 0, audited: 0, errors: 0 }; row.cells.set(area, c); }
      return c;
    };

    for (const s of sys) {
      const agg = await db.collection(s.coll).aggregate([
        { $match: {
          ...systemMatch(s, filter),
          raw_template_hash: { $exists: true, $ne: null },
          'requirement_groups.0': { $exists: true },
        } },
        { $group: {
          _id: { school: `$${s.idField}`, name: `$${s.nameField}`, major: '$major', hash: '$raw_template_hash' },
          n_docs: { $sum: 1 },
        } },
      ]).toArray();
      for (const c of agg) {
        const area = classifyArea(c._id.major);
        const row = ensureRow(s.key, c._id.school, c._id.name);
        row.total += 1;
        ensureCell(row, area).total += 1;
        clusters.push({
          key: clusterKey(s.key, c._id.school, c._id.major, c._id.hash),
          system: s.key, schoolId: c._id.school, school: c._id.name,
          major: c._id.major, area, nDocs: c.n_docs,
        });
      }
    }

    // ── Audited / errored per (campus, area) from live verdicts ──
    const worst = await _liveClusterTiers(db, filter, auditDb);
    for (const cl of clusters) {
      const tier = worst.get(cl.key);
      if (!tier) continue;
      const row = rowsByCampus.get(`${cl.system}|${cl.schoolId}`);
      if (!row) continue;
      const cell = ensureCell(row, cl.area);
      cell.audited += 1;
      if (tier === 'error') cell.errors += 1;
    }

    // Only surface areas that actually contain templates somewhere.
    const categories = AREAS.filter((a) =>
      [...rowsByCampus.values()].some((r) => (r.cells.get(a)?.total || 0) > 0)
    );

    const rows = [...rowsByCampus.values()]
      .sort((a, b) => a.system.localeCompare(b.system) || (a.school || '').localeCompare(b.school || ''))
      .map((r) => ({
        campus: r.school,
        system: r.system,
        school_id: r.school_id,
        templatesTotal: r.total,
        templatesAudited: [...r.cells.values()].reduce((n, c) => n + c.audited, 0),
        cells: categories.map((area) => {
          const c = r.cells.get(area) || { total: 0, audited: 0, errors: 0 };
          return { area, total: c.total, audited: c.audited, errors: c.errors };
        }),
      }));

    // ── Largest unverified templates (no verdict on any of their docs) ──
    const largestUnverified = clusters
      .filter((cl) => !worst.has(cl.key))
      .sort((a, b) => b.nDocs - a.nDocs || (a.major || '').localeCompare(b.major || ''))
      .slice(0, 8)
      .map((cl) => ({ campus: cl.school, major: cl.major, docs: cl.nDocs, area: cl.area }));

    return { categories, rows, largestUnverified };
  });
}

module.exports = { _matrixData };
