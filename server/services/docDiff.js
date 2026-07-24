// A field-level diff between two curated documents, used to record what a human
// changed when hand-verifying an AI-scraped record. Emits one entry per changed
// leaf as { path, from, to }, where `path` is a dotted/bracketed JSON path
// (e.g. `verification.verified`, `requirement_groups[0].sections[1].units`).
//
// Auto-stamped bookkeeping fields carry no curation signal and would only add
// noise, so any path whose LAST segment is in IGNORED_KEYS is skipped. These
// are matched by leaf name at every depth (group-level stamps included).
const IGNORED_KEYS = new Set([
  'updated_at', 'curated_at', 'curated_by',
  'verified_at', 'verified_by', 'verified_by_label',
  'covered_concepts', // server-recomputed from the requirement groups
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// A stable, comparable rendering of a leaf value for equality + display.
function leaf(value) {
  return value === undefined ? null : value;
}

function equal(a, b) {
  return JSON.stringify(leaf(a)) === JSON.stringify(leaf(b));
}

function walk(before, after, path, out) {
  if (equal(before, after)) return;

  // Recurse into objects, comparing the union of keys.
  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (IGNORED_KEYS.has(key)) continue;
      walk(before[key], after[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }

  // Recurse into arrays by index; length changes surface as added/removed cells.
  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i += 1) {
      walk(before[i], after[i], `${path}[${i}]`, out);
    }
    return;
  }

  // Leaf (or a type change between object/array/scalar): record it whole.
  out.push({ path, from: leaf(before), to: leaf(after) });
}

/**
 * Diff two documents. Returns [] when they are equivalent (ignoring the
 * bookkeeping fields above). `before` may be null for a first-time creation, in
 * which case every present field reads as an addition (from: null).
 */
function diffDocs(before, after) {
  const out = [];
  walk(before ?? {}, after ?? {}, '', out);
  return out;
}

module.exports = { diffDocs, IGNORED_KEYS };
