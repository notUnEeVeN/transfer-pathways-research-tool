// Template-variant clustering for the Templates tab. One row per distinct
// (school_id, major, cluster), where cluster = raw_template_hash (ASSIST
// byte-identity) with template_fp / a JS recomputation as fallback. Each row
// carries a sample doc + a worst-of-its-docs verdict tier. Depends on the
// filters leaf + the shared cache.

const crypto = require('crypto');
const cache = require('../auditCache');
const {
  AUDIT_RESULTS,
  SYSTEM_BY_KEY,
  activeSystems,
  systemMatch,
  verdictMatch,
  _countReceivers,
} = require('./filters');

// Fallback fp for docs missing the precomputed `template_fp`. The Python
// pipeline (data_parse_script/pipeline/parser/template_fp.py) is the source of
// truth; this exists so the Templates tab doesn't crash on un-backfilled docs.
function _ucTemplateFp(doc) {
  const canon = (doc.requirement_groups || []).map((g) => ({
    is_required:           !!g.is_required,
    group_conjunction:     g.group_conjunction || 'And',
    group_advisement:      g.group_advisement ?? null,
    group_unit_advisement: g.group_unit_advisement ?? null,
    sections: (g.sections || []).map((s) => ({
      section_advisement: s.section_advisement ?? null,
      unit_advisement:    s.unit_advisement ?? null,
      receivers: (s.receivers || []).map((r) => r.hash_id || ''),
    })),
  }));
  return crypto.createHash('md5').update(JSON.stringify(canon)).digest('hex');
}

/**
 * Template variants — one row per distinct (uc_school_id, major, template_fp).
 * Each row carries a sample doc the Templates tab can render. Sampling:
 *
 *   unaudited template → random unaudited doc within the cluster (so each
 *                        refresh may show a different CC's articulation —
 *                        informative AND counts toward audited-doc stats
 *                        when the auditor renders a verdict)
 *   audited template   → the doc that carries the verdict, so the auditor
 *                        can review what was approved or why it was flagged.
 *                        Error verdicts win over correct verdicts when
 *                        choosing which doc to surface.
 *
 * Template result is DERIVED from per-doc verdicts: error if any doc has
 * result='error', else correct if any has result='correct', else null.
 */
async function _templateVariantsData(db, filter, auditDb = db) {
  return cache.memoize('templates', filter, async () => {
  const sys = activeSystems(filter);

  // Cluster key: raw_template_hash when available (ASSIST byte-identity,
  // proven sound after the 2026-05-21 cluster cross-validation), falling
  // back to template_fp and then a JS recomputation when neither is set.
  // The cross-validation pass showed template_fp over-collapses 11.3% of
  // (school, major) pairs (parser merges distinct ASSIST templates), so
  // basing audit propagation on raw_template_hash is the correctness-safe
  // choice. Empty `requirement_groups` are dropped — see _statsData.
  const buckets = new Map();
  for (const s of sys) {
    // Stream the scan instead of .toArray()-ing the whole collection: with
    // scope='all' this would otherwise buffer every agreement at once and
    // churn the WiredTiger cache. batchSize bounds memory to one batch; the
    // per-doc bucketing below collapses the corpus into O(clusters) anyway.
    const cursor = db.collection(s.coll).find(
      systemMatch(s, filter),
      { projection: {
        _id: 1, community_college: 1,
        [s.idField]: 1, [s.nameField]: 1,
        major: 1, major_id: 1, raw_template_hash: 1, template_fp: 1,
        'requirement_groups.is_required': 1,
        'requirement_groups.group_conjunction': 1,
        'requirement_groups.group_advisement': 1,
        'requirement_groups.group_unit_advisement': 1,
        'requirement_groups.sections.section_advisement': 1,
        'requirement_groups.sections.unit_advisement': 1,
        'requirement_groups.sections.receivers.hash_id': 1,
      } }
    ).batchSize(2000);
    for await (const d of cursor) {
      if (!(d.requirement_groups || []).length) continue;
      const clusterKey = d.raw_template_hash || d.template_fp || _ucTemplateFp(d);
      const key = `${s.key}|${d[s.idField]}|${d.major}|${clusterKey}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          system: s.key,
          school_id: d[s.idField],
          school: d[s.nameField],
          major: d.major,
          cluster_hash: clusterKey,     // raw_template_hash (or fallback) — the cluster identity
          parser_shapes: new Set(),     // distinct template_fp values inside this raw cluster (over-fragment indicator)
          n_groups: (d.requirement_groups || []).length,
          n_receivers: _countReceivers(d),
          docs: [],
        });
      }
      const b = buckets.get(key);
      if (d.template_fp) b.parser_shapes.add(d.template_fp);
      b.docs.push(d);
    }
  }

  // Verdicts also restricted to the active filter so the Templates tab
  // doesn't pull in verdicts from outside the current scope.
  const verdicts = await auditDb.collection(AUDIT_RESULTS).find(verdictMatch(filter)).toArray();
  const verdictByDocId = new Map(verdicts.map((v) => [String(v.doc_id), v]));

  const out = [];
  for (const b of buckets.values()) {
    const verdictsHere = [];
    const unaudited    = [];
    for (const d of b.docs) {
      const v = verdictByDocId.get(String(d._id));
      if (v) verdictsHere.push({ doc: d, verdict: v });
      else   unaudited.push(d);
    }
    // Template-level result is worst-of-its-docs: tier 3 dominates tier 2,
    // which dominates tier 1. Without any verdict the cluster has no tier.
    const erroredEntry      = verdictsHere.find((e) => e.verdict.result === 'error');
    const conservativeEntry = verdictsHere.find((e) => e.verdict.result === 'conservative');
    const correctEntry      = verdictsHere.find((e) => e.verdict.result === 'correct');
    const chosen = erroredEntry || conservativeEntry || correctEntry || null;

    const sampleDoc = chosen
      ? chosen.doc
      : unaudited[Math.floor(Math.random() * unaudited.length)];
    if (!sampleDoc) continue;  // bucket somehow empty (defensive)

    const sysEntry = SYSTEM_BY_KEY.get(b.system);
    const parserShapes = [...b.parser_shapes];
    out.push({
      system: b.system,
      school_id: b.school_id,
      school: b.school,
      major: b.major,
      // `fp_hash` stays as the field name for frontend compat; semantically
      // this is now the cluster identity (raw_template_hash when available).
      fp_hash: b.cluster_hash,
      raw_template_hash: b.cluster_hash,
      // n_parser_shapes > 1 means the parser produced multiple distinct
      // template_fp values from this one ASSIST raw template (benign over-
      // fragmentation). Useful signal — auditor may want to spot-check a
      // doc with each parser shape.
      n_parser_shapes: parserShapes.length,
      source: `${b.system}_template`,
      sample_doc_id: String(sampleDoc._id),
      sample_cc: sampleDoc.community_college,
      sample_university_id: sampleDoc[sysEntry.idField],
      n_groups: b.n_groups,
      n_receivers: b.n_receivers,
      n_docs: b.docs.length,
      n_audited_docs: verdictsHere.length,
      result: chosen ? chosen.verdict.result : null,
      notes: chosen ? (chosen.verdict.notes || '') : '',
      // status may be 'open' (current error) or 'resolved' (was an error,
      // now correct). UI renders the "resolved" badge.
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
  });
}

module.exports = { _ucTemplateFp, _templateVariantsData };
