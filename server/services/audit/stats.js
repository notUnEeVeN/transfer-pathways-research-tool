// The internal audit stats layer.
//
// Pure math (wilsonUpperPct, templateMatchConfidence, computeAuditStats,
// clusterKey) has no DB dependency and is unit-tested in stats.test.js — it's
// the single source of the stats payload that the bootstrap buildScope also
// uses. The DB-coupled _statsData gathers its inputs from Mongo and delegates
// the math to computeAuditStats; it's pinned against a seeded DB in
// statsPipeline.test.js.
const cache = require('../auditCache');
const {
  AUDIT_RESULTS,
  SYSTEM_BY_KEY,
  CELLS_PER_RECEIVER,
  activeSystems,
  systemMatch,
  verdictMatch,
  scopeKey,
} = require('./filters');
const { _ensureVerdictDenorm, _partitionLiveStale } = require('./staleness');

/**
 * Wilson score interval upper bound for k "successes" (errors) in n trials,
 * returned as a percentage rounded to `decimals` (null when n === 0). This
 * underwrites every "≤ X% error" trust number on the audit page — the cell CI
 * runs well under 1% in practice, so percentages keep 2 decimals by default.
 */
function wilsonUpper(k, n) {
  if (n === 0) return null;
  const z = 1.96;
  const phat = k / n;
  const denom = 1 + (z * z) / n;
  const center = phat + (z * z) / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  return (center + margin) / denom; // unrounded fraction in [0, 1]
}

function wilsonUpperPct(k, n, decimals = 2) {
  const f = wilsonUpper(k, n);
  return f == null ? null : +(f * 100).toFixed(decimals);
}

/**
 * Wilson upper bound with a finite-population correction. N = size of the
 * population being sampled (e.g. templates in scope). When the sample covers the
 * whole population (n ≥ N) there is no sampling uncertainty left, so it returns
 * the observed rate; otherwise it shrinks the margin by √((N−n)/(N−1)). N null/0
 * → plain Wilson (no correction). Returns an unrounded fraction in [0, 1].
 */
function wilsonUpperFinite(k, n, N) {
  if (n === 0) return null;
  if (N != null && N > 0 && n >= N) return k / n; // full census → observed rate, no sampling uncertainty
  const z = 1.96;
  const phat = k / n;
  const denom = 1 + (z * z) / n;
  const center = phat + (z * z) / (2 * n);
  let margin = z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  if (N != null && N > 1) margin *= Math.sqrt(Math.max(0, (N - n) / (N - 1)));
  return (center + margin) / denom;
}

/**
 * Per-template confidence factor used in template propagation.
 *
 * Today: returns 1.0 unconditionally. raw_template_hash is a byte-exact
 * identity hash of the ASSIST raw template — two docs sharing it are
 * structurally identical with no uncertainty, so the "template-matching
 * confidence" is 1.
 *
 * Future: when (and if) we introduce a fuzzy template-matching layer (e.g.
 * clustering by template_fp with a learned similarity threshold), this becomes
 * `1 − template_match_error_upper` from a cross-validation pass. Threading the
 * call through every propagation site now makes that change a one-function edit.
 * Callers may pass per-template context to vary the factor later; unused today.
 */
// eslint-disable-next-line no-unused-vars
function templateMatchConfidence(_tplCtx) {
  return 1.0;
}

// CELLS_PER_RECEIVER (imported from ./filters, the single source of truth):
// each UC receiver counts as 2 cells (UC side + CC side) — both are
// parse-checked per verdict. The DB stores raw receiver counts; the doubling
// is applied at read time.

// Random-sample sources that qualify for the direct Wilson CIs. 'verify' and
// 'random_template_weighted' are both mathematically uniform random doc
// selection; auditor-chosen 'template' picks are excluded. Source defaults to
// 'verify' for legacy rows.
const RANDOM_SOURCES = new Set(['verify', 'random_template_weighted']);

// Tier ordering for cluster worst-tier propagation: correct < flagged <
// conservative < error.
const TIER_RANK = { correct: 0, flagged: 1, conservative: 2, error: 3 };

// Mongo aggregation expression that sums receivers across a doc's
// requirement_groups → sections. Shared by the cell-catalog total and the
// per-cluster receiver projection in _statsData (one inert BSON literal,
// never mutated, so it is safe to reference from multiple pipeline stages).
const RECEIVER_COUNT_EXPR = {
  $reduce: {
    input: { $ifNull: ['$requirement_groups', []] },
    initialValue: 0,
    in: { $add: ['$$value', {
      $sum: { $map: {
        input: { $ifNull: ['$$this.sections', []] },
        in: { $size: { $ifNull: ['$$this.receivers', []] } },
      } },
    }] },
  },
};

/**
 * Canonical cluster key shared by both stats pipelines. A "cluster" is a
 * (system, school_id, major, raw_template_hash) tuple — docs sharing it are
 * byte-identical ASSIST templates. Both _statsData (DB-aggregated) and the
 * bootstrap buildScope (in-memory) MUST build cluster-aggregate keys and
 * verdict keys with this same format so worst-tier lookups line up.
 */
function clusterKey(system, schoolId, major, hash) {
  return `${system}|${schoolId}|${major}|${hash}`;
}

/**
 * The audit stats payload, computed from normalized inputs. Single source of
 * the ~25-field stats object; its two callers (_statsData over DB aggregations
 * and the bootstrap buildScope over in-memory data) gather these inputs their
 * own way and delegate the math here.
 *
 * @param {object}   args
 * @param {object[]} args.verdicts          LIVE verdicts in scope (stale excluded by the caller).
 * @param {number}   args.totalDocs         Agreement docs in scope.
 * @param {number}   args.nTemplates        Distinct template variants in scope.
 * @param {number}   args.nMajors           Distinct (school, major) clusters in scope.
 * @param {number}   args.nCellsTotal       Total cells across in-scope docs (already ×CELLS_PER_RECEIVER).
 * @param {number}   args.nStale            Stale verdict count in scope (surfaced separately).
 * @param {object[]} args.clusterAggregates [{ key, system, nDocs, avgReceivers }] per template cluster.
 * @param {Map}      args.systemByKey       sysKey → { idField } for resolving a verdict's school id.
 */
function computeAuditStats({ verdicts, totalDocs, nTemplates, nMajors, nCellsTotal, nStale, clusterAggregates, systemByKey, sampleScope = 'all' }) {
  // ── Tier counts (live verdicts only) ──
  const nAudited      = verdicts.length;
  const nConservative = verdicts.filter((v) => v.result === 'conservative').length;
  const nFlagged      = verdicts.filter((v) => v.result === 'flagged').length;
  const k             = verdicts.filter((v) => v.result === 'error').length;        // Tier 3
  const nResolved     = verdicts.filter((v) => v.status === 'resolved').length;
  const nCorrect      = nAudited - nConservative - nFlagged - k;

  // ── Random-sample subset for the headline bound ──
  // Only verdicts drawn by a RANDOM mechanism over the SAME population this view
  // reports on (sampleScope). This is what keeps grouping-scoped random draws
  // OUT of the global bound. Legacy rows (no provenance) infer method from
  // source and default their scope to 'all' (their effective historical meaning).
  const methodOf = (v) => v.sample_method || (RANDOM_SOURCES.has(v.source || 'verify') ? 'random' : 'targeted');
  const scopeOf  = (v) => v.sample_scope || 'all';
  const directVerdicts = verdicts.filter((v) => methodOf(v) === 'random' && scopeOf(v) === sampleScope);
  const nAuditedDirect = directVerdicts.length;
  const kDirect        = directVerdicts.filter((v) => v.result === 'error').length;
  const nConsDirect    = directVerdicts.filter((v) => v.result === 'conservative').length;
  const nFlagDirect    = directVerdicts.filter((v) => v.result === 'flagged').length;

  // ── Cell-level layer ──
  const nCellsAudited       = verdicts.reduce((sum, v)       => sum + (v.receivers_checked || 0), 0) * CELLS_PER_RECEIVER;
  const nCellsInError       = verdicts.reduce((sum, v)       => sum + (v.cells_in_error    || 0), 0);
  const nCellsAuditedDirect = directVerdicts.reduce((sum, v) => sum + (v.receivers_checked || 0), 0) * CELLS_PER_RECEIVER;
  const nCellsInErrorDirect = directVerdicts.reduce((sum, v) => sum + (v.cells_in_error    || 0), 0);
  const ciUpperCellPct = wilsonUpperPct(nCellsInErrorDirect, nCellsAuditedDirect);

  // ── Template rollups (cluster keys derived from the denormalized verdicts) ──
  const auditedTplKeys = new Set();
  const erroredTplKeys = new Set();
  for (const v of verdicts) {
    const clusterHash = v.raw_template_hash || v.template_fp;
    if (clusterHash == null) continue;
    const sysKey = v.system || 'uc';
    const s = systemByKey.get(sysKey);
    if (!s) continue;
    const schoolId = v[s.idField];
    if (schoolId == null) continue;
    const key = clusterKey(sysKey, schoolId, v.major, clusterHash);
    auditedTplKeys.add(key);
    if (v.result === 'error') erroredTplKeys.add(key);
  }
  const nTemplatesAudited = auditedTplKeys.size;
  const nTemplatesErrors  = erroredTplKeys.size;
  const nTemplatesCorrect = nTemplatesAudited - nTemplatesErrors;

  // ── Headline student-risk bound: TEMPLATE-level, over RANDOMLY-DRAWN in-scope
  // templates, with a finite-population correction. A byte-identical template is
  // one deterministic observation (the template, not the doc, is the unit), and
  // the draws must be uniform over the SAME population the bound reports on
  // (directVerdicts is already scoped above). FPC tightens the bound as auditing
  // covers the scope's templates — which matters for small groupings. safety =
  // Tier 3 (under-prepare); strict = any deviation incl. safe over-prep.
  const randomClusterWorst = new Map();
  for (const v of directVerdicts) {
    const clusterHash = v.raw_template_hash || v.template_fp;
    if (clusterHash == null) continue;
    const sysKey = v.system || 'uc';
    const s = systemByKey.get(sysKey);
    if (!s) continue;
    const schoolId = v[s.idField];
    if (schoolId == null) continue;
    const key = clusterKey(sysKey, schoolId, v.major, clusterHash);
    const cur = randomClusterWorst.get(key);
    if (!cur || TIER_RANK[v.result] > TIER_RANK[cur]) randomClusterWorst.set(key, v.result);
  }
  const nRandomClusters = randomClusterWorst.size;
  let kRandomError = 0, kRandomStrict = 0;
  for (const tier of randomClusterWorst.values()) {
    if (tier === 'error') kRandomError++;
    if (tier === 'error' || tier === 'conservative' || tier === 'flagged') kRandomStrict++;
  }
  const safetyFrac = wilsonUpperFinite(kRandomError, nRandomClusters, nTemplates);
  const strictFrac = wilsonUpperFinite(kRandomStrict, nRandomClusters, nTemplates);
  const ciUpperSafetyPct = safetyFrac != null ? +(safetyFrac * 100).toFixed(2) : null;
  const ciUpperStrictPct = strictFrac != null ? +(strictFrac * 100).toFixed(2) : null;
  const estMaxUnsafe = safetyFrac != null ? Math.round(safetyFrac * totalDocs) : null;
  const estMaxStrict = strictFrac != null ? Math.round(strictFrac * totalDocs) : null;

  // ── Row 4: cell-discounted template propagation ──
  // Each audited cluster gets its worst observed tier; effective count
  // eff_t = N_t × (1 − p_e)^K_t × templateMatchConfidence(t).
  const pE = ciUpperCellPct != null ? ciUpperCellPct / 100 : 1; // worst case 100% when no cells audited
  const clusterWorstTier = new Map();
  for (const v of verdicts) {
    const clusterHash = v.raw_template_hash || v.template_fp;
    if (clusterHash == null) continue;
    const sysKey = v.system || 'uc';
    const s = systemByKey.get(sysKey);
    if (!s) continue;
    const schoolId = v[s.idField];
    if (schoolId == null) continue;
    const key = clusterKey(sysKey, schoolId, v.major, clusterHash);
    const current = clusterWorstTier.get(key);
    if (!current || TIER_RANK[v.result] > TIER_RANK[current]) {
      clusterWorstTier.set(key, v.result);
    }
  }
  const safetyAuditedClusters = new Set();
  let kClusterError = 0;   // audited clusters whose worst verdict is an error
  let kClusterStrict = 0;  // audited clusters with any deviation (incl. safe over-prep)
  for (const [key, tier] of clusterWorstTier) {
    if (tier !== 'error') safetyAuditedClusters.add(key);
    if (tier === 'error') kClusterError++;
    if (tier === 'error' || tier === 'conservative' || tier === 'flagged') kClusterStrict++;
  }
  let nPropagated = 0;                // safety-only doc count (legacy)
  let nPropagatedAllAudited = 0;      // doc count across every audited cluster (any tier)
  let safeSum = 0;
  let tplPropTotal = 0;                // effective (cell-discounted) doc total across audited clusters
  for (const c of clusterAggregates) {
    const tier = clusterWorstTier.get(c.key);
    if (!tier) continue;                                                 // cluster has no audits
    const avgCells = c.avgReceivers * CELLS_PER_RECEIVER;
    const eff = c.nDocs * Math.pow(1 - pE, avgCells) * templateMatchConfidence({ system: c.system });
    nPropagatedAllAudited += c.nDocs;
    tplPropTotal += eff;
    if (tier !== 'error') {
      nPropagated += c.nDocs;
      safeSum += eff;
    }
  }
  const effectiveVerified = safeSum;

  return {
    n_audited: nAudited,
    n_audited_direct: nAuditedDirect,                         // random in-scope doc audits
    n_errors_direct: kDirect,                                 // errors among those doc audits
    n_strict_direct: nConsDirect + nFlagDirect + kDirect,     // any deviation among those doc audits
    n_random_clusters: nRandomClusters,                       // distinct randomly-drawn in-scope templates (the bound's n)
    n_random_clusters_error: kRandomError,                    // of those, how many errored
    sample_scope: sampleScope,                                // which population the bound is computed over
    n_correct: nCorrect,
    n_conservative: nConservative,
    n_flagged: nFlagged,
    n_errors: k,                                              // Tier 3 only
    n_resolved: nResolved,
    n_stale: nStale,
    total_docs: totalDocs,
    sample_coverage_pct: totalDocs ? +((nAudited / totalDocs) * 100).toFixed(1) : 0,

    // Rates
    strict_rate_pct: nAudited > 0 ? +(((nConservative + nFlagged + k) / nAudited) * 100).toFixed(1) : null,
    safety_rate_pct: nAudited > 0 ? +((k / nAudited) * 100).toFixed(1) : null,

    // CIs
    ci_upper_strict_pct: ciUpperStrictPct,
    ci_upper_safety_pct: ciUpperSafetyPct,
    estimated_max_strict: estMaxStrict,
    estimated_max_unsafe: estMaxUnsafe,
    ci_note: '95% Wilson upper bound · per randomly-drawn template, scope-restricted, finite-population corrected',

    // Legacy aliases (kept for back-compat) mapped to safety semantics.
    observed_error_pct: nAudited > 0 ? +((k / nAudited) * 100).toFixed(1) : null,
    ci_upper_pct: ciUpperSafetyPct,
    estimated_max_errors: estMaxUnsafe,

    n_templates: nTemplates,
    n_majors: nMajors,
    n_templates_audited: nTemplatesAudited,
    n_templates_correct: nTemplatesCorrect,
    n_templates_errors:  nTemplatesErrors,

    // Cell-level layer
    n_cells_total:        nCellsTotal,
    n_cells_audited:      nCellsAudited,
    n_cells_in_error:     nCellsInError,
    cell_coverage_pct:    nCellsTotal   ? +((nCellsAudited / nCellsTotal)  * 100).toFixed(4) : 0,
    cell_observed_pct:    nCellsAudited ? +((nCellsInError / nCellsAudited) * 100).toFixed(2) : null,
    ci_upper_cell_pct:    ciUpperCellPct,
    estimated_max_cell_errors: nCellsTotal && wilsonUpper(nCellsInErrorDirect, nCellsAuditedDirect) != null
      ? Math.round(wilsonUpper(nCellsInErrorDirect, nCellsAuditedDirect) * nCellsTotal)
      : null,

    // Row 4 — Template propagation layer.
    n_safety_audited_clusters:                     safetyAuditedClusters.size,
    n_audited_clusters:                            clusterWorstTier.size,
    n_verified_via_templates:                      nPropagated,
    template_coverage_pct:                         totalDocs ? +((nPropagated / totalDocs) * 100).toFixed(2) : 0,
    effective_verified:                            +effectiveVerified.toFixed(2),
    effective_coverage_pct:                        totalDocs ? +((effectiveVerified / totalDocs) * 100).toFixed(4) : 0,
    n_propagated_all_audited:                      nPropagatedAllAudited,
    raw_template_coverage_pct:                     totalDocs ? +((nPropagatedAllAudited / totalDocs) * 100).toFixed(4) : 0,
    effective_template_coverage_pct:               totalDocs ? +((tplPropTotal           / totalDocs) * 100).toFixed(4) : 0,
    propagation_multiplier:                        clusterWorstTier.size > 0
                                                     ? +(tplPropTotal / clusterWorstTier.size).toFixed(1)
                                                     : null,
    avg_rows_per_agreement:                        totalDocs ? +((nCellsTotal / CELLS_PER_RECEIVER) / totalDocs).toFixed(1) : null,
    template_propagated_total:                     +tplPropTotal.toFixed(2),
    // Confidence bound at the CLUSTER level (n = audited templates, k = errored
    // templates). Statistically honest: every doc in a byte-identical template
    // is one deterministic verdict, so the template — not the doc — is the
    // independent observation. The coverage/exposure numbers above are NOT
    // confidence bounds and must never be presented as one.
    cluster_student_risk_upper_pct:                wilsonUpperPct(kClusterError, clusterWorstTier.size),
    cluster_strict_mismatch_upper_pct:             wilsonUpperPct(kClusterStrict, clusterWorstTier.size),
  };
}

// ───────── DB-coupled data layer ─────────

// Stats payload for a filter. Gathers the DB-derived inputs (doc/template/
// cell counts + per-cluster propagation aggregates + live verdicts) and
// delegates the math to computeAuditStats. Memoized 30s per filter.
//
// Test-only parity oracle: no production caller and no /audit/stats route
// (superseded by /audit/bootstrap → buildScope → computeAuditStats). Kept so
// statsPipeline.test.js's 'dedup guard' can assert the two stats pipelines
// agree. Do NOT delete without removing the dedup guard.
async function _statsData(db, filter, auditDb = db) {
  return cache.memoize('stats', filter, async () => {
  const sys = activeSystems(filter);

  // total_docs: sum across active systems with the filter applied.
  let totalDocs = 0;
  for (const s of sys) {
    totalDocs += await db.collection(s.coll).countDocuments(systemMatch(s, filter));
  }

  // n_templates / n_majors: distinct (school_id, major, raw_template_hash)
  // clusters per system, then summed. raw_template_hash is the ASSIST
  // byte-identity — proven safe for propagation by the cluster cross-
  // validation pass. Empty `requirement_groups` are excluded so the count
  // matches what the Templates tab actually renders.
  let nTemplates = 0;
  let nMajors = 0;
  for (const s of sys) {
    const match = {
      ...systemMatch(s, filter),
      raw_template_hash: { $exists: true, $ne: null },
      'requirement_groups.0': { $exists: true },
    };
    const clusters = await db.collection(s.coll).aggregate([
      { $match: match },
      { $group: { _id: { school: `$${s.idField}`, major: '$major', fp: '$raw_template_hash' } } },
      { $group: { _id: { school: '$_id.school', major: '$_id.major' }, variant_count: { $sum: 1 } } },
    ]).toArray();
    nTemplates += clusters.reduce((sum, c) => sum + c.variant_count, 0);
    nMajors    += clusters.length;
  }

  // All-audit counts (any source). These drive the Row 2 tier breakdown
  // and the "audited so far" coverage numbers.
  // n_correct (Tier 1) / n_conservative (Tier 2) / n_errors (Tier 3).
  // A resolved error has its result flipped to 'correct', so n_errors
  // reflects ONLY current unresolved errors; n_resolved is the historical
  // count of resolutions (status='resolved').
  await _ensureVerdictDenorm(db, auditDb);    // one-shot backfill on pre-cell-counter rows
  const rawVerdicts = await auditDb.collection(AUDIT_RESULTS).find(verdictMatch(filter)).toArray();
  // Live/stale partition. A verdict is stale when the doc's current
  // raw_template_hash no longer matches the hash we stored at audit time —
  // typically because a parser change re-fingerprinted the doc. Stale
  // verdicts are excluded from every downstream stat (counts, Wilson CIs,
  // template propagation) so the numbers reflect only claims that still
  // correspond to current data. They reappear via the Stale tab for re-
  // auditing, and a fresh /audit/verify writes a new row with the current
  // hash — automatically returning the work to the live set.
  const { live: verdicts, stale: staleVerdicts } = await _partitionLiveStale(db, rawVerdicts);
  const nStale = staleVerdicts.length;
  // All verdict-derived counts (tier breakdown, random-direct subset, cell
  // audited/error sums, Wilson CIs, template rollups, propagation) are
  // computed in computeAuditStats below — _statsData's job is to gather the
  // DB-derived inputs.

  // Cell-level catalog total — total cells across every in-scope doc (each UC
  // receiver = CELLS_PER_RECEIVER cells: UC side + CC side).
  let nCellsTotal = 0;
  for (const s of sys) {
    const totals = await db.collection(s.coll).aggregate([
      { $match: systemMatch(s, filter) },
      { $project: { _id: 0, n: RECEIVER_COUNT_EXPR } },
      { $group: { _id: null, total: { $sum: '$n' } } },
    ]).toArray();
    nCellsTotal += (totals[0]?.total ?? 0) * CELLS_PER_RECEIVER;
  }
  // Per-cluster propagation aggregates: (n_docs, avg_receivers) per
  // (system, school, major, raw_template_hash). The cell-discounted
  // worst-tier propagation math itself lives in computeAuditStats.
  const clusterAggregates = [];
  for (const s of sys) {
    const clusters = await db.collection(s.coll).aggregate([
      { $match: {
          ...systemMatch(s, filter),
          raw_template_hash: { $exists: true, $ne: null },
          'requirement_groups.0': { $exists: true },
      } },
      { $project: { _id: 0,
        school_id: `$${s.idField}`,
        major: 1,
        cluster: '$raw_template_hash',
        n_receivers: RECEIVER_COUNT_EXPR,
      } },
      { $group: {
        _id: { school_id: '$school_id', major: '$major', cluster: '$cluster' },
        n_docs: { $sum: 1 },
        avg_receivers: { $avg: '$n_receivers' },
      } },
    ]).toArray();
    for (const c of clusters) {
      clusterAggregates.push({
        key: clusterKey(s.key, c._id.school_id, c._id.major, c._id.cluster),
        system: s.key,
        nDocs: c.n_docs,
        avgReceivers: c.avg_receivers,
      });
    }
  }
  return computeAuditStats({
    verdicts,
    totalDocs,
    nTemplates,
    nMajors,
    nCellsTotal,
    nStale,
    clusterAggregates,
    systemByKey: SYSTEM_BY_KEY,
    sampleScope: scopeKey(filter),
  });
  });
}

module.exports = {
  wilsonUpper,
  wilsonUpperPct,
  wilsonUpperFinite,
  templateMatchConfidence,
  computeAuditStats,
  clusterKey,
  CELLS_PER_RECEIVER,
  _statsData,
};
