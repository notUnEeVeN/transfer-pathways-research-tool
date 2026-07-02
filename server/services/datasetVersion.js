/**
 * Dataset snapshot identity for the research cluster.
 *
 * scripts/port.py maintains a single doc in `dataset_meta`:
 *   { _id: 'current', dataset_version, updated_at, majors, counts }
 * Every audit verdict and analysis/export payload is stamped with
 * `dataset_version` so results are attributable to an exact dataset state.
 * Cached with a short TTL — port.py bumps the version from outside the
 * server's process, so a forever-cache would go stale.
 */
const TTL_MS = 30 * 1000;
let cached = { at: 0, value: undefined };

async function currentDatasetVersion(db) {
  const now = Date.now();
  if (cached.value !== undefined && now - cached.at < TTL_MS) return cached.value;
  try {
    const meta = await db.collection('dataset_meta').findOne({ _id: 'current' });
    cached = { at: now, value: meta?.dataset_version ?? null };
  } catch {
    cached = { at: now, value: null };
  }
  return cached.value;
}

// Test hook.
function _resetDatasetVersionCache() {
  cached = { at: 0, value: undefined };
}

module.exports = { currentDatasetVersion, _resetDatasetVersionCache };
