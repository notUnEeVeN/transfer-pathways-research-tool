/**
 * Dataset snapshot identity for the research cluster.
 *
 * The seed script (scripts/seed.py) writes a single doc to `dataset_meta`:
 *   { _id: 'current', dataset_version, seeded_at, majors, counts, source_db }
 * Every audit verdict (and, later, every analysis/export payload) is stamped
 * with `dataset_version` so results are attributable to a frozen snapshot and
 * verdicts can be merged back into the production audit store with full
 * provenance. Cached per-process; the version only changes on a re-seed,
 * which redeploys/restarts anyway.
 */
let cached;

async function currentDatasetVersion(db) {
  if (cached !== undefined) return cached;
  try {
    const meta = await db.collection('dataset_meta').findOne({ _id: 'current' });
    cached = meta?.dataset_version ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

// Test hook.
function _resetDatasetVersionCache() {
  cached = undefined;
}

module.exports = { currentDatasetVersion, _resetDatasetVersionCache };
