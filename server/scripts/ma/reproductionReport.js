#!/usr/bin/env node
/**
 * Diff our recomputation of the Massachusetts figures against the paper's
 * published values, cell by cell, and bucket every delta by cause.
 *
 *   node scripts/ma/reproductionReport.js
 *
 * Writes server/data/ma/reproduction-report.json. The buckets:
 *   - exact             |Δ| ≤ 0.05pp
 *   - close             |Δ| ≤ 5pp
 *   - published-sum-drift  the pair's own pathway tab disagrees with the
 *                          published Credit Hours sheet (9 pairs)
 *   - tally-vs-overlay  the residual: the published '% Credit Hours' hand
 *                       tally and the recovered pathway overlay disagree
 *                       about the pair — two artifacts of the same study
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { coverageData } = require('../../services/analysis/pathways');
const { transferCreditRateData } = require('../../services/analysis/transferCreditRate');
const { loadRaw, runMaImport } = require('./importMassachusetts');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const raw = loadRaw();
  const { warnings } = await runMaImport(db, raw, { apply: false });
  const sumDriftPairs = new Set(warnings
    .filter((warning) => /pathway sums .* against the published/.test(warning))
    .map((warning) => warning.split(':')[0]));

  // ── Figure 1: per-cell course-articulation ratio ───────────────────────
  const cov = await coverageData(db, null, { requirements: 'degree', majorSlug: 'ma-cs' });
  const fig1 = { cells: 0, exact: 0, worst: 0 };
  const ratioByPair = new Map();
  for (const university of raw.heatmap.universities) {
    for (const [cc, ratio] of Object.entries(university.all_ratio)) {
      ratioByPair.set(`${university.name}|${cc}`, ratio * 100);
    }
  }
  for (const row of cov) {
    const key = `${row.school}|${String(row.community_college).replace(/ Community College$/, '')}`;
    const published = ratioByPair.get(key);
    if (published == null || !Number.isFinite(row.pct_named_requirement_courses)) continue;
    const delta = Math.abs(row.pct_named_requirement_courses - published);
    fig1.cells += 1;
    if (delta <= 0.05) fig1.exact += 1;
    fig1.worst = Math.max(fig1.worst, delta);
  }

  // ── Figure 3: AS-side transfer credit rate ─────────────────────────────
  const rate = await transferCreditRateData(db, null, { degreeType: 'local_as', majorSlug: 'ma-cs' });
  const baselines = await db.collection('ma_paper_baselines')
    .find({ measure: 'pct_as', community_college_id: { $ne: null } }).toArray();
  const byPair = new Map(baselines.map((row) => [`${row.school_id}|${row.community_college_id}`, row]));
  const fig3 = { cells: [], buckets: { exact: 0, close: 0, 'published-sum-drift': 0, 'tally-vs-overlay': 0 } };
  for (const row of rate) {
    const published = byPair.get(`${row.school_id}|${row.community_college_id}`);
    if (!published || !Number.isFinite(row.as_unit_utilization_pct)) continue;
    const theirs = published.value * 100;
    const delta = row.as_unit_utilization_pct - theirs;
    const pairLabel = `${published.school}/${String(published.college_name || '').replace(/ Community College$/, '')}`;
    let bucket = 'tally-vs-overlay';
    if (Math.abs(delta) <= 0.05) bucket = 'exact';
    else if (Math.abs(delta) <= 5) bucket = 'close';
    else if (sumDriftPairs.has(pairLabel)) bucket = 'published-sum-drift';
    fig3.buckets[bucket] += 1;
    fig3.cells.push({
      pair: pairLabel, ours: +row.as_unit_utilization_pct.toFixed(1), theirs: +theirs.toFixed(1),
      delta: +delta.toFixed(1), bucket,
    });
  }
  fig3.cells.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const ours = fig3.cells.map((cell) => cell.ours);
  const theirs = fig3.cells.map((cell) => cell.theirs);
  const mean = (values) => +(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);

  const report = {
    generated_at: new Date().toISOString(),
    fig1_requirements_heatmap: {
      ...fig1,
      verdict: fig1.exact === fig1.cells
        ? 'EXACT: every cell reproduces the published ratio'
        : `${fig1.exact}/${fig1.cells} exact; worst |Δ| ${fig1.worst.toFixed(2)}pp`,
    },
    fig3_transfer_credit_rate: {
      pairs: fig3.cells.length,
      our_mean: mean(ours),
      their_mean: mean(theirs),
      buckets: fig3.buckets,
      note: 'Aggregate means nearly coincide while individual cells spread: the published tallies and the recovered pathway overlays are two hand artifacts of one study, and they disagree with each other per pair. Our recomputation follows the overlays (the course-level record).',
      cells: fig3.cells,
    },
    known_source_drifts: warnings,
  };
  fs.writeFileSync(path.resolve(__dirname, '../../data/ma/reproduction-report.json'),
    JSON.stringify(report, null, 1));
  console.log('Fig 1:', report.fig1_requirements_heatmap.verdict);
  console.log(`Fig 3: ${fig3.cells.length} pairs; our mean ${mean(ours)}% vs published ${mean(theirs)}%; buckets ${JSON.stringify(fig3.buckets)}`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
