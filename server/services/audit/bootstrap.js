// Agreement reads + the single-call bootstrap payload.
//
// _nextData (random unaudited doc) backs the Verify tab and is also consumed by
// _buildBootstrapPayload,
// which computes the whole audit page's data in one pass (verdicts + per-system
// agreements/clusters/counts + tier rows + templates + per-scope stats). The
// course/university lookup helpers enrich a single doc for the Verify view.
// Delegates stats math to services/audit/stats.js and reuses the filters /
// staleness / templates leaves.

const { ObjectId } = require('mongodb');
const cache = require('../auditCache');
const {
  AUDIT_RESULTS,
  COURSES,
  UNIVERSITY_COURSES,
  SYSTEMS,
  SYSTEM_BY_KEY,
  ASSIST_URL,
  activeSystems,
  systemMatch,
  verdictMatch,
  scopeKey,
  _strid,
  _countCells,
  _countReceivers,
} = require('./filters');
const { _ensureVerdictDenorm, _partitionLiveStaleFromMap } = require('./staleness');
const { _ucTemplateFp } = require('./templates');
const { computeAuditStats, clusterKey } = require('./stats');

// ───────── doc enrichment helpers ─────────

function _collectCourseIds(doc) {
  const out = new Set();
  for (const g of (doc.requirement_groups || [])) {
    for (const s of (g.sections || [])) {
      for (const r of (s.receivers || [])) {
        for (const opt of (r.options || [])) {
          for (const id of (opt.course_ids || [])) out.add(id);
        }
      }
    }
  }
  return [...out];
}

function _collectUniversityParentIds(doc) {
  const out = new Set();
  for (const g of (doc.requirement_groups || [])) {
    for (const s of (g.sections || [])) {
      for (const r of (s.receivers || [])) {
        const recv = r.receiving;
        if (!recv) continue;
        if (recv.kind === 'course' && recv.parent_id != null) out.add(recv.parent_id);
        if (recv.kind === 'series') {
          for (const pid of (recv.parent_ids || [])) if (pid != null) out.add(pid);
        }
      }
    }
  }
  return [...out];
}

async function _courseMap(db, cc_id, doc) {
  const ids = _collectCourseIds(doc);
  if (ids.length === 0) return {};
  const rows = await db.collection(COURSES).find(
    { community_college_id: Number(cc_id), course_id: { $in: ids } },
    { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, _id: 0 } }
  ).toArray();
  const out = {};
  for (const r of rows) {
    out[String(r.course_id)] = {
      code:  `${r.prefix || ''} ${r.number || ''}`.trim(),
      title: r.title || '',
      units: r.units ?? null,
    };
  }
  return out;
}

async function _universityCoursesMap(db, doc) {
  const pids = _collectUniversityParentIds(doc);
  if (pids.length === 0) return {};
  const rows = await db.collection(UNIVERSITY_COURSES).find(
    { parent_id: { $in: pids } },
    { projection: { parent_id: 1, prefix: 1, number: 1, title: 1, min_units: 1, max_units: 1, _id: 0 } }
  ).toArray();
  const out = {};
  for (const r of rows) {
    out[String(r.parent_id)] = {
      prefix:    r.prefix    || '',
      number:    r.number    || '',
      title:     r.title     || '',
      min_units: r.min_units ?? null,
      max_units: r.max_units ?? null,
    };
  }
  return out;
}

// ───────── reads ─────────

/**
 * Random doc from the filtered pool the caller hasn't audited yet.
 *   ?scope, ?schoolIds, ?majorContains — see filter docstring in filters.js
 *   ?skip=id1,id2 — session reroll list, excluded in addition to audited ids
 *
 * Sampling across multiple systems uses $unionWith so the per-system match
 * filters compose with $sample's reservoir at the aggregation level (the
 * alternative — sample per-system + pick — would bias toward small systems).
 */
async function _nextData(db, filter, skipParam, auditDb = db) {
  const sys = activeSystems(filter);

  // Audited ids — restricted to the active scope so we don't waste an
  // exclusion list slot on irrelevant rows. From auditDb (the audit handle);
  // the agreement sample below stays on db (reference).
  const auditedIds = (await auditDb.collection(AUDIT_RESULTS).find(
    sys.length === 1 ? { system: sys[0].key } : {},
    { projection: { doc_id: 1 } }
  ).toArray()).map((r) => r.doc_id);

  const skip = String(skipParam || '').trim();
  const skipOids = skip
    ? skip.split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => { try { return new ObjectId(s); } catch { return null; } })
        .filter(Boolean)
    : [];
  const excludeOids = [...auditedIds, ...skipOids];

  let totalDocs = 0;
  for (const s of sys) {
    totalDocs += await db.collection(s.coll).countDocuments(systemMatch(s, filter));
  }

  const pipelineFor = (sysEntry) => {
    const match = { ...systemMatch(sysEntry, filter) };
    if (excludeOids.length) match._id = { $nin: excludeOids };
    return [{ $match: match }, { $addFields: { __system: sysEntry.key } }];
  };

  let docs;
  if (sys.length === 1) {
    docs = await db.collection(sys[0].coll)
      .aggregate([...pipelineFor(sys[0]), { $sample: { size: 1 } }])
      .toArray();
  } else {
    // $unionWith merges per-system pipelines, then $sample picks uniformly
    // across the combined pool (avoids small-system bias).
    docs = await db.collection(sys[0].coll).aggregate([
      ...pipelineFor(sys[0]),
      ...sys.slice(1).map((s) => ({
        $unionWith: { coll: s.coll, pipeline: pipelineFor(s) }
      })),
      { $sample: { size: 1 } }
    ]).toArray();
  }

  if (!docs.length) {
    return { done: true, n_audited: auditedIds.length, total_docs: totalDocs };
  }

  const doc = docs[0];
  const systemKey = doc.__system;
  delete doc.__system;
  const sysEntry = SYSTEM_BY_KEY.get(systemKey);
  const universityId = doc[sysEntry.idField];

  const [courseNames, universityCourses] = await Promise.all([
    _courseMap(db, doc.community_college_id, doc),
    _universityCoursesMap(db, doc),
  ]);
  return {
    done: false,
    system: systemKey,
    doc: _strid(doc),
    course_names: courseNames,
    university_courses: universityCourses,
    assist_url: ASSIST_URL(doc.community_college_id, universityId, doc.major_id),
    n_audited: auditedIds.length,
    total_docs: totalDocs,
  };
}

// ───────── bootstrap payload ─────────

// Load the slim agreement docs for the doc_ids referenced by `verdicts` — the
// ONLY docs the bootstrap needs at (near-)full fidelity: the live/stale hash
// partition and the tier/stale row enrichment. Memory here is O(verdicts), not
// O(collection). Mirrors _partitionLiveStale's per-system `{_id: $in}` lookup
// (no scope match — verdicts are already scope-filtered by verdictMatch, so
// every loaded verdict's doc is in scope or deleted).
async function _loadVerdictDocs(db, verdicts) {
  const currentHashByDocId = new Map();
  const currentFpByDocId = new Map();
  const currentParserOutputByDocId = new Map();
  const slimById = new Map();
  if (!verdicts.length) {
    return { currentHashByDocId, currentFpByDocId, currentParserOutputByDocId, slimById };
  }
  const idsBySystem = new Map();
  for (const v of verdicts) {
    const sysKey = v.system || 'uc';
    if (!idsBySystem.has(sysKey)) idsBySystem.set(sysKey, []);
    idsBySystem.get(sysKey).push(v.doc_id);
  }
  await Promise.all([...idsBySystem.entries()].map(async ([sysKey, ids]) => {
    const s = SYSTEM_BY_KEY.get(sysKey);
    if (!s) return;
    const docs = await db.collection(s.coll).find(
      { _id: { $in: ids } },
      { projection: {
        _id: 1, raw_template_hash: 1, template_fp: 1, parser_output_hash: 1,
        community_college: 1, community_college_id: 1,
        [s.idField]: 1, [s.nameField]: 1, major: 1, major_id: 1,
      } }
    ).toArray();
    for (const d of docs) {
      const id = String(d._id);
      currentHashByDocId.set(id, d.raw_template_hash ?? null);
      currentFpByDocId.set(id, d.template_fp ?? null);
      currentParserOutputByDocId.set(id, d.parser_output_hash ?? null);
      slimById.set(id, { d, sysKey });
    }
  }));
  return { currentHashByDocId, currentFpByDocId, currentParserOutputByDocId, slimById };
}

// Stream every in-scope agreement doc through a cursor (never materialised into
// one array) to build, per system: the template-variant buckets, the
// cell-catalog total, and the per-cluster propagation aggregates. Peak memory is
// O(distinct clusters) + one cursor batch. `verdictByDocId` (live verdicts)
// classifies each doc as audited/unaudited for the buckets; the unaudited sample
// is chosen by reservoir sampling so we never retain the per-bucket doc list.
async function _streamSystemAggregates(db, noScope, verdictByDocId) {
  const perSystemAgg = {};
  await Promise.all(SYSTEMS.map(async (s) => {
    const match = systemMatch(s, noScope);
    const cursor = db.collection(s.coll).find(match, { projection: {
      _id: 1, community_college: 1, community_college_id: 1,
      [s.idField]: 1, [s.nameField]: 1,
      major: 1, major_id: 1, raw_template_hash: 1, template_fp: 1, parser_output_hash: 1,
      'requirement_groups.is_required': 1,
      'requirement_groups.group_conjunction': 1,
      'requirement_groups.group_advisement': 1,
      'requirement_groups.group_unit_advisement': 1,
      'requirement_groups.sections.section_advisement': 1,
      'requirement_groups.sections.unit_advisement': 1,
      'requirement_groups.sections.receivers.hash_id': 1,
    } }).batchSize(2000); // ~5MB/batch of projected docs — bounds memory while
                          // keeping round-trips low (the cursor streams batch by
                          // batch; we never hold the whole collection).

    const buckets = new Map();
    let nCellsTotal = 0;
    const clusterAgg = new Map();

    for await (const d of cursor) {
      // Cell-catalog total spans every in-scope doc (incl. empty-rg / no-hash).
      nCellsTotal += _countCells(d);

      // Per-cluster propagation aggregate — same filter (raw_template_hash +
      // non-empty requirement_groups) and canonical clusterKey as _statsData.
      if (d.raw_template_hash && (d.requirement_groups || []).length) {
        const ck = clusterKey(s.key, d[s.idField], d.major, d.raw_template_hash);
        let c = clusterAgg.get(ck);
        if (!c) { c = { n: 0, sumR: 0 }; clusterAgg.set(ck, c); }
        c.n += 1;
        c.sumR += _countReceivers(d);
      }

      // Template buckets — same skip + cluster-by-raw_template_hash rule as
      // _templateVariantsData (comments live there).
      if (!(d.requirement_groups || []).length) continue;
      const clusterHash = d.raw_template_hash || d.template_fp || _ucTemplateFp(d);
      const key = `${s.key}|${d[s.idField]}|${d.major}|${clusterHash}`;
      let b = buckets.get(key);
      if (!b) {
        b = {
          system: s.key,
          school_id: d[s.idField],
          school: d[s.nameField],
          major: d.major,
          cluster_hash: clusterHash,
          parser_shapes: new Set(),
          n_groups: (d.requirement_groups || []).length,
          n_receivers: _countReceivers(d),
          n_docs: 0,
          n_unaudited: 0,
          verdictsHere: [],     // {sample, verdict} for docs carrying a LIVE verdict
          sampleUnaudited: null, // reservoir-sampled unaudited representative
        };
        buckets.set(key, b);
      }
      if (d.template_fp) b.parser_shapes.add(d.template_fp);
      b.n_docs += 1;
      const sample = { _id: d._id, community_college: d.community_college, university_id: d[s.idField] };
      const v = verdictByDocId.get(String(d._id));
      if (v) {
        b.verdictsHere.push({ sample, verdict: v });
      } else {
        // Reservoir sampling: keep a uniform-random unaudited representative
        // without holding the per-bucket doc list. Matches the "random
        // unaudited sample" intent of _templateVariantsData.
        b.n_unaudited += 1;
        if (Math.random() < 1 / b.n_unaudited) b.sampleUnaudited = sample;
      }
    }
    perSystemAgg[s.key] = { buckets, nCellsTotal, clusterAgg };
  }));
  return perSystemAgg;
}

// Build the template-variant rows for one system from its streamed buckets.
// Identical row shape, worst-tier selection, and sort as _templateVariantsData,
// but sourced from bounded bucket state instead of a full doc array.
function _templateRowsFromBuckets(buckets) {
  const out = [];
  for (const b of buckets.values()) {
    const erroredEntry      = b.verdictsHere.find(e => e.verdict.result === 'error');
    const conservativeEntry = b.verdictsHere.find(e => e.verdict.result === 'conservative');
    const correctEntry      = b.verdictsHere.find(e => e.verdict.result === 'correct');
    const chosen = erroredEntry || conservativeEntry || correctEntry || null;
    const sample = chosen ? chosen.sample : b.sampleUnaudited;
    if (!sample) continue;
    const parserShapes = [...b.parser_shapes];
    out.push({
      system: b.system,
      school_id: b.school_id,
      school: b.school,
      major: b.major,
      fp_hash: b.cluster_hash,
      raw_template_hash: b.cluster_hash,
      n_parser_shapes: parserShapes.length,
      source: `${b.system}_template`,
      sample_doc_id: String(sample._id),
      sample_cc: sample.community_college,
      sample_university_id: sample.university_id,
      n_groups: b.n_groups,
      n_receivers: b.n_receivers,
      n_docs: b.n_docs,
      n_audited_docs: b.verdictsHere.length,
      result: chosen ? chosen.verdict.result : null,
      notes: chosen ? (chosen.verdict.notes || '') : '',
      status: chosen ? (chosen.verdict.status || null) : null,
      resolution_notes: chosen ? (chosen.verdict.resolution_notes || '') : '',
      verified_at: chosen ? chosen.verdict.verified_at : null,
    });
  }
  out.sort((a, b) =>
    a.system.localeCompare(b.system) ||
    (a.school || '').localeCompare(b.school || '') ||
    (a.major || '').localeCompare(b.major || '') ||
    b.n_docs - a.n_docs
  );
  return out;
}

/**
 * Single-call bootstrap for the audit page. Computes shared data ONCE
 * (verdicts list, per-system clusters/counts, errors enrichment, templates
 * buckets) then partitions in JS to build per-scope payloads for `all` and
 * `uc` (UC-only for now; CSU was removed). When a grouping is active it
 * returns a single `grouping` payload with `all`/`uc` set to null instead.
 *
 * Scope on the request is ignored. Filters (schoolIds, majorContains) still
 * apply.
 *
 * Memory: the agreements collection is NEVER materialised into one array. The
 * only full-fidelity docs held are those a verdict points at (_loadVerdictDocs,
 * O(verdicts)); the catalog-wide work (template buckets, cell totals, cluster
 * aggregates) is computed by streaming a cursor (_streamSystemAggregates), so
 * peak heap is O(distinct clusters) + one batch rather than the whole 120k-doc
 * collection. This is the fix for the audit-page OOM.
 *
 * The 30s server-side cache (cache.memoize) wraps the whole payload, so repeat
 * hits on the same filter are instant. Verdict submits clear it.
 */
async function _buildBootstrapPayload(db, baseFilter, skip, auditDb = db) {
  return cache.memoize('bootstrap', baseFilter, async () => {
    // Strip scope from filter for shared work. With scope='all', verdictMatch
    // and systemMatch behave as scope-agnostic — we filter by system in JS
    // when assembling per-scope payloads. Pairs survive on the filter so the
    // grouping path still gets a constrained shared read.
    const noScope = { ...baseFilter, scope: 'all' };
    // When a grouping is active, scope is irrelevant: every system either
    // appears in the grouping's pairs (so its agreements/verdicts get
    // counted) or it doesn't. Per-scope splitting would compute the same
    // payload twice. Branch into a single-payload path that returns under
    // `data.grouping` for the frontend to read.
    const hasGrouping = !!(baseFilter.pairs && baseFilter.pairs.length);

    // Backfill receivers_checked on any pre-existing verdict rows before
    // reading them. One-shot per process; idempotent. Cheap when nothing's
    // missing (a single find + zero writes).
    await _ensureVerdictDenorm(db, auditDb);

    // ────── Stage 1: shared DB reads ──────

    // Per-system count + template clusters (cheap aggregations — no full read).
    const perSystemMetaP = Promise.all(SYSTEMS.map(async (s) => {
      const match = systemMatch(s, noScope);
      const [count, templateClusters] = await Promise.all([
        db.collection(s.coll).countDocuments(match),
        db.collection(s.coll).aggregate([
          { $match: {
              ...match,
              raw_template_hash: { $exists: true, $ne: null },
              'requirement_groups.0': { $exists: true },
          } },
          { $group: { _id: { school: `$${s.idField}`, major: '$major', fp: '$raw_template_hash' } } },
          { $group: { _id: { school: '$_id.school', major: '$_id.major' }, variant_count: { $sum: 1 } } },
        ]).toArray(),
      ]);
      return { sysEntry: s, count, templateClusters };
    }));

    // Next-doc per scope (random sampling, must be scope-aware).
    const nextAllP = _nextData(db, { ...noScope, scope: 'all' }, skip, auditDb);
    const nextUcP  = _nextData(db, { ...noScope, scope: 'uc'  }, skip, auditDb);

    // All verdicts matching (schoolIds, majorContains), no system constraint.
    const verdicts = await auditDb.collection(AUDIT_RESULTS)
      .find(verdictMatch(noScope))
      .toArray();

    // ────── Stage 1.5: live/stale partition ──────
    // Load only the docs a verdict points at (O(verdicts)) for the current-hash
    // maps + the tier/stale row enrichment. Stale verdicts are excluded from
    // every stat and tier list below; they surface only in the Stale tab.
    const {
      currentHashByDocId, currentFpByDocId, currentParserOutputByDocId,
      slimById: verdictDocSlimById,
    } = await _loadVerdictDocs(db, verdicts);
    const { live: liveVerdicts, stale: staleVerdicts } =
      _partitionLiveStaleFromMap(verdicts, currentHashByDocId, currentFpByDocId, currentParserOutputByDocId);
    // Live verdicts drive every downstream stat + tier list.
    const verdictByDocId = new Map(liveVerdicts.map(v => [String(v.doc_id), v]));

    // Catalog-wide aggregates by streaming the agreements cursor (templates +
    // cell totals + cluster aggregates) — needs the live verdict set to
    // classify audited/unaudited docs, so it runs after the partition.
    const perSystemAgg = await _streamSystemAggregates(db, noScope, verdictByDocId);

    const [perSystemArr, nextAll, nextUc] =
      await Promise.all([perSystemMetaP, nextAllP, nextUcP]);
    const perSystem = Object.fromEntries(perSystemArr.map(p => [p.sysEntry.key, p]));

    // ────── Stage 2: error + conservative rows (enriched from verdict docs) ──────
    //
    // Both tier 2 (conservative) and tier 3 (error) need full row data for
    // their tabs, served from verdictDocSlimById (already loaded above).

    const surfacedVerdicts = liveVerdicts.filter(v =>
      (v.result === 'error' && v.status !== 'resolved') ||
      v.result === 'conservative' ||
      v.result === 'flagged'
    );
    const buildRow = (r) => {
      const entry = verdictDocSlimById.get(String(r.doc_id));
      if (!entry) return null;
      const { d, sysKey } = entry;
      const s = SYSTEM_BY_KEY.get(sysKey);
      return {
        id: String(r.doc_id),
        doc_id: String(r.doc_id),
        system: sysKey,
        community_college: d.community_college,
        [s.nameField]: d[s.nameField],
        major: d.major,
        notes: r.notes || '',
        source: r.source || 'verify',
        result: r.result,
        assist_url: ASSIST_URL(d.community_college_id, d[s.idField], d.major_id),
        verified_at: r.verified_at,
      };
    };
    const errorRowsAll = surfacedVerdicts
      .filter(v => v.result === 'error')
      .map(buildRow).filter(Boolean);
    const conservativeRowsAll = surfacedVerdicts
      .filter(v => v.result === 'conservative')
      .map(buildRow).filter(Boolean);
    const flaggedRowsAll = surfacedVerdicts
      .filter(v => v.result === 'flagged')
      .map(buildRow).filter(Boolean);
    errorRowsAll.sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)));
    conservativeRowsAll.sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)));
    flaggedRowsAll.sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)));

    // Stale rows: built from `staleVerdicts` regardless of original tier.
    // Uses verdictDocSlimById for in-scope hash-drift cases; falls back to the
    // audit row's denormalized fields when the doc has been deleted entirely.
    // Row shape mirrors the tier rows so the frontend can reuse the same row
    // component, with `prior_result` + `reason` carrying the extra context.
    const buildStaleRow = (r) => {
      const sysKey = r.system || 'uc';
      const s = SYSTEM_BY_KEY.get(sysKey);
      if (!s) return null;
      const entry = verdictDocSlimById.get(String(r.doc_id));
      const docExists = !!entry;
      const curHash = currentHashByDocId.get(String(r.doc_id));
      const curFp   = currentFpByDocId.get(String(r.doc_id));
      const curPo   = currentParserOutputByDocId.get(String(r.doc_id));
      let reason;
      if (!docExists) reason = 'deleted';
      else {
        const rawDrift = r.raw_template_hash  != null && curHash != null && curHash !== r.raw_template_hash;
        const fpDrift  = r.template_fp        != null && curFp   != null && curFp   !== r.template_fp;
        const poDrift  = r.parser_output_hash != null && curPo   != null && curPo   !== r.parser_output_hash;
        reason = rawDrift && (fpDrift || poDrift) ? 'raw_and_parser_drift'
               : rawDrift                         ? 'raw_drift'
               : (fpDrift || poDrift)             ? 'parser_drift'
               : 'hash_drift';
      }
      const d = entry ? entry.d : null;
      return {
        id: String(r.doc_id),
        doc_id: String(r.doc_id),
        system: sysKey,
        community_college: d ? d.community_college : null,
        [s.nameField]: d ? d[s.nameField] : (r[s.nameField] ?? null),
        major: d ? d.major : (r.major ?? null),
        notes: r.notes || '',
        source: r.source || 'verify',
        prior_result: r.result,
        reason,
        prior_raw_template_hash:    r.raw_template_hash ?? null,
        current_raw_template_hash:  curHash ?? null,
        prior_template_fp:          r.template_fp ?? null,
        current_template_fp:        curFp ?? null,
        prior_parser_output_hash:   r.parser_output_hash ?? null,
        current_parser_output_hash: curPo ?? null,
        assist_url: d ? ASSIST_URL(d.community_college_id, d[s.idField], d.major_id) : null,
        verified_at: r.verified_at,
      };
    };
    const staleRowsAll = staleVerdicts.map(buildStaleRow).filter(Boolean);
    staleRowsAll.sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)));

    // ────── Stage 3: templates per-system (from streamed buckets) ──────

    const templatesPerSystem = {};
    for (const s of SYSTEMS) {
      templatesPerSystem[s.key] = _templateRowsFromBuckets(perSystemAgg[s.key].buckets);
    }

    // ────── Stage 4: per-scope assembly (pure JS) ──────

    const buildScope = (scope) => {
      const sysList = scope === 'all' ? SYSTEMS : SYSTEMS.filter(s => s.key === scope);
      // Live verdicts only — stale audits are excluded from every downstream
      // stat (counts, Wilson, propagation). They surface via the `stale`
      // array in the scope's payload.
      const scopeVerdicts = scope === 'all'
        ? liveVerdicts
        : liveVerdicts.filter(v => (v.system || 'uc') === scope);
      const scopeStale = scope === 'all'
        ? staleRowsAll
        : staleRowsAll.filter(e => e.system === scope);
      const nScopeStale = scope === 'all'
        ? staleVerdicts.length
        : staleVerdicts.filter(v => (v.system || 'uc') === scope).length;

      // Stats (rolled up from perSystem aggregates + verdicts)
      let totalDocs = 0, nTemplates = 0, nMajors = 0;
      for (const s of sysList) {
        totalDocs += perSystem[s.key].count;
        const clusters = perSystem[s.key].templateClusters;
        nTemplates += clusters.reduce((sum, c) => sum + c.variant_count, 0);
        nMajors += clusters.length;
      }

      // Cell-level catalog total + per-cluster propagation aggregates for this
      // scope, both rolled up from the streamed per-system aggregates (same
      // cluster filter + canonical clusterKey as _statsData, so the worst-tier
      // lookup in computeAuditStats lines up).
      let nCellsTotalScope = 0;
      const clusterAggregates = [];
      for (const s of sysList) {
        nCellsTotalScope += perSystemAgg[s.key].nCellsTotal;
        for (const [key, c] of perSystemAgg[s.key].clusterAgg) {
          clusterAggregates.push({ key, system: s.key, nDocs: c.n, avgReceivers: c.sumR / c.n });
        }
      }

      const stats = computeAuditStats({
        verdicts: scopeVerdicts,
        totalDocs,
        nTemplates,
        nMajors,
        nCellsTotal: nCellsTotalScope,
        nStale: nScopeStale,
        clusterAggregates,
        systemByKey: SYSTEM_BY_KEY,
        // Sampling scope is the grouping/legacy filter, not the UC/all system
        // toggle — so both 'all' and 'uc' buildScope passes use the same key.
        sampleScope: scopeKey(baseFilter),
      });

      const errors = scope === 'all' ? errorRowsAll : errorRowsAll.filter(e => e.system === scope);
      const conservative = scope === 'all'
        ? conservativeRowsAll
        : conservativeRowsAll.filter(e => e.system === scope);
      const flagged = scope === 'all'
        ? flaggedRowsAll
        : flaggedRowsAll.filter(e => e.system === scope);
      const template_variants = scope === 'all'
        ? (templatesPerSystem.uc || [])
        : (templatesPerSystem[scope] || []);
      const next = scope === 'uc' ? nextUc : nextAll;

      return { stats, errors, conservative, flagged, stale: scopeStale, template_variants, next };
    };

    if (hasGrouping) {
      // Active grouping → one payload. Scope keys are returned empty so the
      // frontend doesn't have to special-case missing keys; it just reads
      // from `data.grouping` instead of `data[scope]`.
      return {
        grouping: buildScope('all'),
        all: null,
        uc: null,
        filter: baseFilter,
      };
    }
    return {
      all: buildScope('all'),
      uc:  buildScope('uc'),
      grouping: null,
      filter: baseFilter,
    };
  });
}

module.exports = {
  _courseMap,
  _universityCoursesMap,
  _nextData,
  _buildBootstrapPayload,
};
