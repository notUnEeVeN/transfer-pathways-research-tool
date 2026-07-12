/**
 * Process-local memoization for the heavy audit aggregations. Keyed by a
 * stable hash of (data-source-name, filter). 60s TTL bounds staleness for
 * concurrent audits; verdict / resolve mutations call clear() so changes
 * are visible immediately to whoever submitted them. (This is a single-
 * operator tool, so a slightly longer window between manual reads is fine,
 * and the agreement_reviews indexes make the post-clear recompute cheap.)
 *
 * If we ever run multiple server instances, this becomes a per-instance
 * cache (different processes won't share entries). That's acceptable —
 * the worst case is a 60s window of inconsistency, not corruption.
 */
const TTL_MS = 60_000;
const store = new Map();

function stableFilterKey(filter) {
  const groupingId = filter?.groupingId || '';
  // When a grouping is active, scope/schoolIds/majorContains are ignored by
  // the match helpers — collapse them out of the key so two requests with
  // the same grouping but different legacy params share one cache entry.
  if (groupingId) return `g:${groupingId}`;
  const scope = filter?.scope || 'all';
  const ids = [...(filter?.schoolIds || [])].map(Number).filter(Boolean).sort((a, b) => a - b).join(',');
  const major = (filter?.majorContains || '').trim().toLowerCase();
  return `${scope}|${ids}|${major}`;
}

async function memoize(source, filter, fn) {
  const key = `${source}:${stableFilterKey(filter)}`;
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

function clear() {
  store.clear();
}

module.exports = { memoize, clear };
