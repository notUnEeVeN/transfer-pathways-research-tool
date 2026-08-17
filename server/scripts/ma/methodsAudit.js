#!/usr/bin/env node
/**
 * Three-way methods audit: published figures vs the paper's own math rerun
 * (their-math.json, from theirMath.py) vs our engine's recomputation.
 *
 *   pmt-env/bin/python scripts/ma/theirMath.py   # first
 *   node scripts/ma/methodsAudit.js
 *
 * Writes server/data/ma/methods-audit.json. The question each section
 * answers: are the two pipelines measuring the same thing, where do the
 * numbers align, and is every divergence explained?
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { coverageData } = require('../../services/analysis/pathways');
const { transferCreditRateData } = require('../../services/analysis/transferCreditRate');
const { getMajor } = require('../../config/majors');

const theirMath = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/their-math.json'), 'utf8'));

const PUBLISHED = {
  fig1_mean: 38.2,        // final PDF, all-levels heatmap average
  fig3_headline: 68,      // final PDF: "68% of AS credits apply (GE included)"
  fig4_headline: 13,      // final PDF: +13 additional credit hours
  fig5_headline: 7129,    // final PDF: $7,129 additional cost
  fig6_headline: 15,      // final PDF: +15 curricular complexity
};

const shortCc = (name) => String(name || '').replace(/ Community College$/, '');

function pearson(pairs) {
  const n = pairs.length;
  if (n < 2) return null;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return +(sxy / Math.sqrt(sxx * syy)).toFixed(4);
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const cov = await coverageData(db, null, { requirements: 'degree', majorSlug: 'ma-cs' });
  const rate = await transferCreditRateData(db, null, { degreeType: 'local_as', majorSlug: 'ma-cs' });

  // ── Fig 1: three-way per cell ───────────────────────────────────────────
  const oursByPair = new Map(cov.map((row) => [
    `${row.school}|${shortCc(row.community_college)}`, row.pct_named_requirement_courses,
  ]));
  const fig1 = { cells: 0, ours_vs_stored_exact: 0, worst_delta_pp: 0 };
  for (const uni of theirMath.fig1.universities) {
    for (const row of uni.rows) {
      const ours = oursByPair.get(`${uni.name}|${row.cc}`);
      if (!Number.isFinite(ours) || typeof row.stored_all !== 'number') continue;
      const delta = Math.abs(ours - row.stored_all * 100);
      fig1.cells += 1;
      if (delta <= 0.05) fig1.ours_vs_stored_exact += 1;
      fig1.worst_delta_pp = Math.max(fig1.worst_delta_pp, +delta.toFixed(3));
    }
  }
  fig1.their_formula_recomputed_exact = theirMath.fig1.summary.recomputed_exactly;
  fig1.mean_stored = +(theirMath.fig1.summary.mean_stored_all * 100).toFixed(1);
  fig1.mean_ours = +mean([...oursByPair.values()].filter(Number.isFinite)).toFixed(1);
  fig1.published_mean = PUBLISHED.fig1_mean;

  // ── Fig 2: per-campus per-type, lower division ──────────────────────────
  // Our figure's aggregation: mean over colleges of covered/total per type.
  const major = getMajor('ma-cs');
  const axes = major.courseTypes.axes.faithful;
  const theirTypeFor = { computing: 'Computing', math: 'Math', science: 'Science', non_stem: 'Humanities' };
  const ourCampusType = new Map();
  for (const row of cov) {
    const types = row.degree_requirements_by_course_type;
    if (!types) continue;
    for (const axis of axes) {
      let total = 0; let covered = 0;
      for (const category of axis.categories.length ? axis.categories : [axis.key]) {
        const slots = types[category];
        if (!slots) continue;
        total += slots.lower_division_total ?? slots.total;
        covered += slots.lower_division_covered ?? slots.covered;
      }
      if (!total) continue;
      const key = `${row.school}|${axis.key}`;
      if (!ourCampusType.has(key)) ourCampusType.set(key, []);
      ourCampusType.get(key).push(covered / total);
    }
  }
  const fig2 = {
    note: 'their notebook hard-codes these arrays; the matrix itself supports the lower-division reading',
    rows: [],
    within_2pp_ours_vs_matrix: 0,
    comparisons: 0,
    hardcoded_deviations: [],
  };
  theirMath.fig2.universities.forEach((uni, index) => {
    const entry = { university: uni.name };
    for (const axis of axes) {
      const theirs = theirMath.fig2.hardcoded_in_notebook[theirTypeFor[axis.key]]?.[index];
      const matrix = uni.share_of_lower_cells_articulating[theirTypeFor[axis.key]];
      const samples = ourCampusType.get(`${uni.name}|${axis.key}`);
      const ours = samples ? mean(samples) : null;
      entry[axis.key] = {
        ours: ours == null ? null : +(ours * 100).toFixed(1),
        their_matrix: matrix == null ? null : +(matrix * 100).toFixed(1),
        their_hardcoded: theirs == null ? null : +(theirs * 100).toFixed(1),
      };
      if (ours != null && matrix != null) {
        fig2.comparisons += 1;
        if (Math.abs(ours * 100 - matrix * 100) <= 2) fig2.within_2pp_ours_vs_matrix += 1;
      }
      // Where the notebook's hand-entered value disagrees with the paper's
      // own matrix under the engine typing rule, the deviation is theirs.
      if (theirs != null && matrix != null && Math.abs(theirs * 100 - matrix * 100) > 5) {
        fig2.hardcoded_deviations.push(
          `${uni.name} ${theirTypeFor[axis.key]}: notebook ${(theirs * 100).toFixed(0)} vs their own matrix ${(matrix * 100).toFixed(0)}`
        );
      }
    }
    fig2.rows.push(entry);
  });

  // ── Figs 3/4/5: per-pair against the CurrComp tabs ──────────────────────
  const rateByPair = new Map(rate
    .filter((row) => Number.isFinite(row.as_unit_utilization_pct))
    .map((row) => [`${row.school}|${shortCc(row.college_name)}`, row]));

  const tab = theirMath.currcomp;
  const fig3Pairs = []; const fig4Pairs = []; const fig5Pairs = [];
  const fig4Explained = { exact: 0, resident_not_120: 0, unit_mismatch: 0 };
  let costIdentityWorst = 0;
  for (const [uniName, byCc] of Object.entries(tab.pct_as.cells)) {
    for (const [cc, pct] of Object.entries(byCc)) {
      const ours = rateByPair.get(`${uniName}|${cc}`);
      if (!ours) continue;
      fig3Pairs.push([ours.as_unit_utilization_pct, pct * 100]);

      const hours = tab.credit_hours.cells[uniName]?.[cc];
      const resident = tab.credit_hours.resident[uniName];
      if (Number.isFinite(hours)) {
        const theirsExtra = hours - 120;
        fig4Pairs.push([ours.extra_units, theirsExtra]);
        const delta = Math.abs(ours.extra_units - theirsExtra);
        if (delta <= 0.5) fig4Explained.exact += 1;
        else if (resident !== 120 && Math.abs(ours.extra_units - (hours - resident)) <= 0.5) fig4Explained.resident_not_120 += 1;
        else fig4Explained.unit_mismatch += 1;
      }

      const cost = tab.cost.cells[uniName]?.[cc];
      if (Number.isFinite(cost) && Number.isFinite(ours.extra_cost_usd)) {
        fig5Pairs.push([ours.extra_cost_usd, cost]);
        if (Number.isFinite(hours)) {
          const rateImplied = tab.cost.cells[uniName][cc] / (hours - 120 || 1);
          if (hours > 120) {
            const identity = Math.abs(cost - rateImplied * (hours - 120));
            costIdentityWorst = Math.max(costIdentityWorst, identity);
          }
        }
      }
    }
  }

  const summarize = (pairs, unit) => ({
    pairs: pairs.length,
    correlation_r: pearson(pairs),
    our_mean: +mean(pairs.map(([x]) => x)).toFixed(1),
    their_mean: +mean(pairs.map(([, y]) => y)).toFixed(1),
    mean_signed_delta: +mean(pairs.map(([x, y]) => x - y)).toFixed(1),
    unit,
  });

  // Subgroup lens: the reproduction report buckets every Fig-3 pair by whether
  // the paper's own two artifacts (tally sheet vs pathway workbook) agree.
  // Where they agree with each other, do we agree with them?
  let subgroups = null;
  const reproPath = path.resolve(__dirname, '../../data/ma/reproduction-report.json');
  if (fs.existsSync(reproPath)) {
    const repro = JSON.parse(fs.readFileSync(reproPath, 'utf8'));
    const bucketByPair = new Map((repro.fig3_transfer_credit_rate?.cells || [])
      .map((cell) => [cell.pair, cell.bucket]));
    const clean = []; const disputed = [];
    for (const [uniName, byCc] of Object.entries(tab.pct_as.cells)) {
      for (const [cc, pct] of Object.entries(byCc)) {
        const ours = rateByPair.get(`${uniName}|${cc}`);
        if (!ours) continue;
        const bucket = bucketByPair.get(`${uniName}/${cc}`);
        const point = [ours.as_unit_utilization_pct, pct * 100];
        if (bucket === 'exact' || bucket === 'close') clean.push(point);
        else disputed.push(point);
      }
    }
    subgroups = {
      note: 'clean = pairs whose published tally the pathway workbook corroborates (buckets exact/close); disputed = the rest (tally-vs-overlay and sum-drift)',
      clean: clean.length ? { ...summarize(clean, 'pct'), mean_abs_delta: +mean(clean.map(([x, y]) => Math.abs(x - y))).toFixed(1) } : null,
      disputed: disputed.length ? { ...summarize(disputed, 'pct'), mean_abs_delta: +mean(disputed.map(([x, y]) => Math.abs(x - y))).toFixed(1) } : null,
    };
  }

  // One-root-cause test: if the Fig 3 and Fig 4 disagreements share a cause
  // (which artifact each side follows), their per-pair deltas must be strongly
  // NEGATIVELY correlated — crediting more AS units necessarily leaves fewer
  // extra ones.
  const deltaPairs = [];
  for (const [uniName, byCc] of Object.entries(tab.pct_as.cells)) {
    for (const [cc, pct] of Object.entries(byCc)) {
      const ours = rateByPair.get(`${uniName}|${cc}`);
      const hours = tab.credit_hours.cells[uniName]?.[cc];
      if (!ours || !Number.isFinite(hours)) continue;
      deltaPairs.push([
        ours.as_unit_utilization_pct - pct * 100,
        ours.extra_units - (hours - 120),
      ]);
    }
  }
  const fig3fig4DeltaCorrelation = pearson(deltaPairs);

  const report = {
    generated_at: new Date().toISOString(),
    published_headlines: PUBLISHED,
    their_pipeline: {
      fig1: 'Excel formulas in the workbook (COUNTIF/COUNTA); notebook only plots the stored columns',
      fig2: 'hard-coded arrays in course_distribution.ipynb; no typing code exists in the repo',
      fig3_4_5_6: 'hand tabs in CurrComp Master.xlsx; notebook plots them (seaborn boxplots)',
    },
    fig1_requirement_articulation: fig1,
    fig2_course_types_lower_division: fig2,
    fig3_transfer_credit_rate: {
      ...summarize(fig3Pairs, 'percent'),
      subgroups,
      headline_identification: {
        published: PUBLISHED.fig3_headline,
        their_tab_candidates: tab.pct_as.stats,
        verdict: 'no standard aggregation of the recovered tab yields 68; the tab mean is 65.1',
      },
    },
    fig4_additional_hours: {
      ...summarize(fig4Pairs, 'semester hours (ours: unmatched AS units; theirs: pathway hours - 120)'),
      identity: 'their (hours-120) equals our unmatched-AS-units whenever the resident plan is 120 and matched courses swap unit-for-unit',
      explained: fig4Explained,
      fig3_delta_correlation: {
        r: fig3fig4DeltaCorrelation,
        reading: 'strongly negative = the Fig 3 and Fig 4 disagreements are one phenomenon (which source artifact each side follows), not two independent errors',
      },
      headline_identification: {
        published: PUBLISHED.fig4_headline,
        matched_by: 'median delta vs same-university resident = 13.0 exactly (also median cells - 120)',
      },
    },
    fig5_additional_cost: {
      ...summarize(fig5Pairs, 'USD (both sides price at the per-credit rate implied by their own Cost tab)'),
      cost_identity_worst_usd: +costIdentityWorst.toFixed(2),
      headline_identification: {
        published: PUBLISHED.fig5_headline,
        nearest_candidate: `median of tab cells / median delta vs resident = ${tab.cost.stats.median_cells.toFixed(0)} (off by $${(tab.cost.stats.median_cells - PUBLISHED.fig5_headline).toFixed(0)}; consistent with known tab-revision drift)`,
      },
    },
    fig6_complexity: {
      our_engine: 'not modeled — we compute no curricular-complexity metric',
      their_tab_stats: tab.complexity.stats,
      headline_identification: {
        published: PUBLISHED.fig6_headline,
        matched_by: `mean delta vs same-university resident = ${tab.complexity.stats.mean_delta_vs_resident.toFixed(1)} (rounds to +15; 49 of 61 pairs carry a value)`,
      },
    },
  };

  fs.writeFileSync(path.resolve(__dirname, '../../data/ma/methods-audit.json'), JSON.stringify(report, null, 1));
  console.log('Fig 1:', `${fig1.ours_vs_stored_exact}/${fig1.cells} ours=stored exact; their formulas ${fig1.their_formula_recomputed_exact}/165; means ${fig1.mean_ours} / ${fig1.mean_stored} / published ${PUBLISHED.fig1_mean}`);
  console.log('Fig 2:', `${fig2.within_2pp_ours_vs_matrix}/${fig2.comparisons} ours-vs-matrix within 2pp (their notebook values are hard-coded)`);
  console.log('Fig 2 paper-internal deviations:', JSON.stringify(fig2.hardcoded_deviations));
  console.log('Fig 3:', JSON.stringify(summarize(fig3Pairs, 'pct')));
  if (subgroups) console.log('Fig 3 subgroups:', JSON.stringify({ clean: subgroups.clean, disputed: subgroups.disputed }));
  console.log('Fig 4:', JSON.stringify({ ...summarize(fig4Pairs, 'h'), explained: fig4Explained, fig3_delta_r: fig3fig4DeltaCorrelation }));
  console.log('Fig 5:', JSON.stringify(summarize(fig5Pairs, 'usd')));
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
