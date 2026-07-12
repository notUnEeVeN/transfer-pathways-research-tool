// Live/stale verdict partitioning + the one-shot verdict-denorm backfill.
//
// A verdict is "stale" when the parsed structure it was audited against has
// drifted (raw_template_hash / template_fp / parser_output_hash) or the doc
// was deleted entirely. Stale verdicts are excluded from every downstream stat
// and surface only in the Stale tab. Depends on the filters leaf for system
// metadata + the receiver counter.

const { AUDIT_RESULTS, SYSTEM_BY_KEY, _countReceivers } = require('./filters');

// Lazy one-shot backfill: ensure every agreement_reviews row carries the
// per-doc fields the audit reads (receivers_checked for the cell-level
// stat; raw_template_hash for cluster-key dispatch). Both are derived
// from the agreement doc the verdict pointed to. Idempotent — only
// touches rows missing the relevant field. Fires once per process.
let _ensureVerdictDenormP = null;
// auditDb holds agreement_reviews (defaults to db); db holds the agreement docs the
// denorm fields are derived from.
function _ensureVerdictDenorm(db, auditDb = db) {
  if (!_ensureVerdictDenormP) {
    _ensureVerdictDenormP = (async () => {
      const missing = await auditDb.collection(AUDIT_RESULTS).find(
        { $or: [
          { receivers_checked: { $exists: false } },
          { raw_template_hash: { $exists: false } },
        ] },
        { projection: { doc_id: 1, system: 1, receivers_checked: 1, raw_template_hash: 1 } }
      ).toArray();
      if (missing.length === 0) return;

      // Group by system so we hit each agreements collection once.
      const idsBySystem = new Map();
      for (const r of missing) {
        const sysKey = r.system || 'uc';
        if (!idsBySystem.has(sysKey)) idsBySystem.set(sysKey, []);
        idsBySystem.get(sysKey).push(r.doc_id);
      }
      const denormByDocId = new Map();
      for (const [sysKey, ids] of idsBySystem) {
        const s = SYSTEM_BY_KEY.get(sysKey);
        if (!s) continue;
        const docs = await db.collection(s.coll).find(
          { _id: { $in: ids } },
          { projection: {
            _id: 1,
            raw_template_hash: 1,
            'requirement_groups.sections.receivers': 1,
          } }
        ).toArray();
        for (const d of docs) {
          denormByDocId.set(String(d._id), {
            receivers_checked: _countReceivers(d),
            raw_template_hash: d.raw_template_hash ?? null,
          });
        }
      }
      const ops = missing
        .map((r) => {
          const denorm = denormByDocId.get(String(r.doc_id));
          if (!denorm) return null;
          const set = {};
          if (r.receivers_checked == null) set.receivers_checked = denorm.receivers_checked;
          if (r.raw_template_hash == null) set.raw_template_hash = denorm.raw_template_hash;
          if (Object.keys(set).length === 0) return null;
          return { updateOne: { filter: { _id: r._id }, update: { $set: set } } };
        })
        .filter(Boolean);
      if (ops.length) {
        await auditDb.collection(AUDIT_RESULTS).bulkWrite(ops, { ordered: false });
      }
    })().catch((err) => {
      _ensureVerdictDenormP = null;
      throw err;
    });
  }
  return _ensureVerdictDenormP;
}

/**
 * Live/stale partition for a list of audit verdicts.
 *
 * A verdict is "stale" iff ANY of:
 *   - `raw_template_hash` drifted (raw ASSIST structure changed — a re-scrape
 *     introduced a new template variant), OR
 *   - `template_fp` drifted (parser logic changed how it interprets the
 *     UC-side structure — e.g. the 2026-05 NFromArea/NFromConjunction
 *     refinement, or the is_required reclassification), OR
 *   - `parser_output_hash` drifted (any other parser-output change,
 *     including CC-side option building that `template_fp` doesn't hash)
 * OR the doc has been deleted entirely.
 *
 * All three signals matter. `raw_template_hash` catches upstream-ASSIST
 * changes; `template_fp` catches UC-side parser refactors and serves as
 * the cluster-propagation key; `parser_output_hash` is the catch-all that
 * covers parser changes `template_fp` ignores (CC-side options,
 * conjunctions between options, etc.). Comparing all three ensures Stale
 * surfaces a verdict whenever the parsed structure the auditor verified
 * against has shifted, regardless of cause.
 *
 * Carve-outs:
 *   - Verdicts predating a given hash (stored value is null) don't drift
 *     on that field — the comparison short-circuits via the
 *     `storedX != null` guard. This is how the first deploy of
 *     `parser_output_hash` doesn't mass-stale every existing verdict.
 *   - Legacy rows with no stored hash on ANY field are treated as live —
 *     no comparison basis. Production was backfilled, so this only matters
 *     for very old dev data.
 *   - We only hit each system collection once with `{_id: {$in: ids}}` for
 *     the audited doc set — a single indexed lookup, not a full scan.
 *
 * Returns `{ live, stale, currentHashByDocId, currentFpByDocId,
 * currentParserOutputByDocId }`.
 */
async function _partitionLiveStale(db, verdicts) {
  if (verdicts.length === 0) {
    return {
      live: [], stale: [],
      currentHashByDocId: new Map(),
      currentFpByDocId: new Map(),
      currentParserOutputByDocId: new Map(),
    };
  }
  const idsBySystem = new Map();
  for (const v of verdicts) {
    const sysKey = v.system || 'uc';
    if (!idsBySystem.has(sysKey)) idsBySystem.set(sysKey, []);
    idsBySystem.get(sysKey).push(v.doc_id);
  }
  const currentHashByDocId = new Map();
  const currentFpByDocId = new Map();
  const currentParserOutputByDocId = new Map();
  for (const [sysKey, ids] of idsBySystem) {
    const s = SYSTEM_BY_KEY.get(sysKey);
    if (!s) continue;
    const docs = await db.collection(s.coll).find(
      { _id: { $in: ids } },
      { projection: { _id: 1, raw_template_hash: 1, template_fp: 1, parser_output_hash: 1 } }
    ).toArray();
    for (const d of docs) {
      currentHashByDocId.set(String(d._id), d.raw_template_hash ?? null);
      currentFpByDocId.set(String(d._id), d.template_fp ?? null);
      currentParserOutputByDocId.set(String(d._id), d.parser_output_hash ?? null);
    }
  }
  const live = [];
  const stale = [];
  for (const v of verdicts) {
    const storedHash = v.raw_template_hash ?? null;
    const storedFp   = v.template_fp ?? null;
    const storedPo   = v.parser_output_hash ?? null;
    if (storedHash == null && storedFp == null && storedPo == null) { live.push(v); continue; }  // legacy, no basis
    const curHash = currentHashByDocId.get(String(v.doc_id));
    const curFp   = currentFpByDocId.get(String(v.doc_id));
    const curPo   = currentParserOutputByDocId.get(String(v.doc_id));
    if (curHash === undefined && curFp === undefined && curPo === undefined) { stale.push(v); continue; }  // doc deleted
    const rawDrift   = storedHash != null && curHash != null && curHash !== storedHash;
    const fpDrift    = storedFp   != null && curFp   != null && curFp   !== storedFp;
    const poDrift    = storedPo   != null && curPo   != null && curPo   !== storedPo;
    if (rawDrift || fpDrift || poDrift) stale.push(v);
    else                                live.push(v);
  }
  return { live, stale, currentHashByDocId, currentFpByDocId, currentParserOutputByDocId };
}

// In-memory variant used by the bootstrap path, which already has every
// doc's raw_template_hash + template_fp + parser_output_hash in
// `agreementsDocs`. Caller passes the precomputed maps; we just partition.
// Identical semantics to `_partitionLiveStale`.
function _partitionLiveStaleFromMap(verdicts, currentHashByDocId, currentFpByDocId, currentParserOutputByDocId) {
  const live = [];
  const stale = [];
  for (const v of verdicts) {
    const storedHash = v.raw_template_hash ?? null;
    const storedFp   = v.template_fp ?? null;
    const storedPo   = v.parser_output_hash ?? null;
    if (storedHash == null && storedFp == null && storedPo == null) { live.push(v); continue; }
    const curHash = currentHashByDocId.get(String(v.doc_id));
    const curFp   = currentFpByDocId ? currentFpByDocId.get(String(v.doc_id)) : undefined;
    const curPo   = currentParserOutputByDocId ? currentParserOutputByDocId.get(String(v.doc_id)) : undefined;
    if (curHash === undefined && curFp === undefined && curPo === undefined) { stale.push(v); continue; }
    const rawDrift   = storedHash != null && curHash != null && curHash !== storedHash;
    const fpDrift    = storedFp   != null && curFp   != null && curFp   !== storedFp;
    const poDrift    = storedPo   != null && curPo   != null && curPo   !== storedPo;
    if (rawDrift || fpDrift || poDrift) stale.push(v);
    else                                live.push(v);
  }
  return { live, stale };
}

module.exports = { _ensureVerdictDenorm, _partitionLiveStale, _partitionLiveStaleFromMap };
