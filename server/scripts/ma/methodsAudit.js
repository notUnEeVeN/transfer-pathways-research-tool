#!/usr/bin/env node
/**
 * Version-aware methods audit: June 2026 final-PDF headlines, the deposited
 * repository's 2024-12-12 math rerun (their-math.json), and our engine.
 *
 * The archived spreadsheets/notebooks predate the final PDF. Archive↔PDF
 * disagreement is version divergence, not by itself a final-paper error.
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
const pdfFigures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/pdf-figures.json'), 'utf8'));

const FINAL_PDF_HEADLINES = {
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
const literalPdfSummary = (figure) => {
  const values = Object.values(figure.cells || {})
    .flatMap((byUniversity) => Object.values(byUniversity))
    .filter(Number.isFinite);
  const sum = values.reduce((total, value) => total + value, 0);
  return { cells: values.length, sum, mean: +(sum / values.length).toFixed(6) };
};

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
  fig1.scope = 'archive workbook and our archive-input recomputation';
  fig1.archive_formula_recomputed_exact = theirMath.fig1.summary.recomputed_exactly;
  fig1.archive_mean_stored = +(theirMath.fig1.summary.mean_stored_all * 100).toFixed(1);
  fig1.archive_mean_ours = +mean([...oursByPair.values()].filter(Number.isFinite)).toFixed(1);
  fig1.final_pdf_prose_mean = FINAL_PDF_HEADLINES.fig1_mean;
  fig1.final_pdf_archive_rounding_gate = pdfFigures.fig1_course_articulation.archive_rounding_gate;
  fig1.final_pdf_printed_matrix_gate = pdfFigures.fig1_course_articulation.printed_matrix_gate;
  fig1.version_reading = 'The engine reproduces the 2024 archive. The June 2026 final PDF differs visibly in one cell, so 165/165 archive agreement is not 165/165 final-PDF agreement.';

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
    scope: '2024 archived notebook and matrix only; not a transcription of final-PDF Figure 2',
    note: 'The archived notebook hard-codes these arrays; the archived matrix supports the lower-division reading. Differences here diagnose the archive, not the June 2026 final PDF.',
    rows: [],
    within_2pp_ours_vs_archive_matrix: 0,
    comparisons: 0,
    archive_hardcoded_deviations: [],
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
        archive_matrix: matrix == null ? null : +(matrix * 100).toFixed(1),
        archive_notebook_hardcoded: theirs == null ? null : +(theirs * 100).toFixed(1),
      };
      if (ours != null && matrix != null) {
        fig2.comparisons += 1;
        if (Math.abs(ours * 100 - matrix * 100) <= 2) fig2.within_2pp_ours_vs_archive_matrix += 1;
      }
      // These are disagreements internal to the archived repository. They do
      // not establish what the later final PDF used.
      if (theirs != null && matrix != null && Math.abs(theirs * 100 - matrix * 100) > 5) {
        fig2.archive_hardcoded_deviations.push(
          `${uni.name} ${theirTypeFor[axis.key]}: archive notebook ${(theirs * 100).toFixed(0)} vs archive matrix ${(matrix * 100).toFixed(0)}`
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
    archive_mean: +mean(pairs.map(([, y]) => y)).toFixed(1),
    mean_signed_delta: +mean(pairs.map(([x, y]) => x - y)).toFixed(1),
    unit,
  });

  // Subgroup lens: the reproduction report buckets every Fig-3 pair by whether
  // the archive's two artifacts (tally sheet vs pathway workbook) agree.
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
      note: 'clean = pairs whose archived tally the archived pathway workbook corroborates (buckets exact/close); disputed = the rest (tally-vs-overlay and sum-drift)',
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
  const finalPdfFig3 = literalPdfSummary(pdfFigures.fig3_pct_as);
  const finalPdfFig4 = literalPdfSummary(pdfFigures.fig4_extra_hours);
  const finalPdfFig5 = literalPdfSummary(pdfFigures.fig5_extra_cost);
  const finalPdfFig6 = literalPdfSummary(pdfFigures.fig6_complexity_delta);

  const report = {
    generated_at: new Date().toISOString(),
    artifact_scope: 'Version-aware comparison of our engine, the repository snapshot last committed 2024-12-12, and literal transcriptions of the final PDF created 2026-06-26. Unless a field says final_pdf, a recovered notebook/tab value is archival.',
    source_warning: 'Archive↔PDF disagreement establishes version divergence, not a final-paper error. A final-paper error requires an internal arithmetic, population, or scope contradiction in the final artifact.',
    source_vintages: {
      archived_repository: { as_of: '2024-12-12', math_rerun: 'server/data/ma/their-math.json' },
      final_pdf: { created: '2026-06-26', transcription: 'server/data/ma/pdf-figures.json' },
    },
    final_pdf_headlines: FINAL_PDF_HEADLINES,
    archived_repository_pipeline: {
      fig1: 'Archived Excel formulas in the workbook (COUNTIF/COUNTA); archived notebook plots stored columns',
      fig2: 'Hard-coded arrays in archived course_distribution.ipynb; no typing code exists in the deposited repo',
      fig3_4_5_6: 'Typed/formula tabs in archived CurrComp Master.xlsx; archived notebook plots them',
    },
    fig1_requirement_articulation: fig1,
    fig2_course_types_lower_division: fig2,
    fig3_transfer_credit_rate: {
      scope: 'Our engine compared with the 2024 archive tab; final-PDF transcription summarized separately',
      ...summarize(fig3Pairs, 'percent'),
      subgroups,
      final_pdf: finalPdfFig3,
      headline_reconciliation: {
        final_pdf_headline: FINAL_PDF_HEADLINES.fig3_headline,
        archive_tab_candidates: tab.pct_as.stats,
        reading: 'The final-PDF 61-cell transcription averages 67.7377% and rounds to 68%. The older archive tab averages 65.15%; that gap is version divergence, not evidence that the final headline was aggregated incorrectly.',
      },
    },
    fig4_additional_hours: {
      scope: 'Our engine compared with the 2024 archive tab; all 49 final-PDF cells are separately transcribed',
      ...summarize(fig4Pairs, 'semester hours (ours: unmatched AS units; archive: pathway hours - 120)'),
      final_pdf: { ...finalPdfFig4, gate: pdfFigures.fig4_extra_hours.gate },
      identity: 'Archive (hours-120) equals our unmatched-AS-units whenever the resident plan is 120 and matched courses swap unit-for-unit',
      explained: fig4Explained,
      fig3_delta_correlation: {
        r: fig3fig4DeltaCorrelation,
        reading: 'strongly negative = the Fig 3 and Fig 4 disagreements are one phenomenon (which source artifact each side follows), not two independent errors',
      },
      headline_reconciliation: {
        final_pdf_headline: FINAL_PDF_HEADLINES.fig4_headline,
        reading: `The final-PDF transcription has ${finalPdfFig4.cells} cells totaling ${finalPdfFig4.sum}; mean ${finalPdfFig4.mean.toFixed(4)} rounds to +13. The archive tab's median also equals 13, but that coincidence does not make the archive cells final-PDF inputs.`,
      },
    },
    fig5_additional_cost: {
      scope: 'Our engine compared with the 2024 archive Cost tab; final-PDF Figure 5 is separately transcribed',
      ...summarize(fig5Pairs, 'USD (our engine and the archived tab each use the per-credit rate implied by the archive Cost tab)'),
      final_pdf: { ...finalPdfFig5, gate: pdfFigures.fig5_extra_cost.gate },
      cost_identity_worst_usd: +costIdentityWorst.toFixed(2),
      headline_reconciliation: {
        final_pdf_headline: FINAL_PDF_HEADLINES.fig5_headline,
        reading: `The final-PDF 49-cell transcription averages $${finalPdfFig5.mean.toFixed(2)}, which rounds to $7,129. The archive median $${tab.cost.stats.median_cells.toFixed(0)} is a different statistic from an older artifact and must not be presented as the paper's aggregation.`,
      },
    },
    fig6_complexity: {
      scope: 'Final-PDF transcription, archived score tab, and archived workbook recomputation are kept as separate artifacts',
      our_engine: 'Modeled. The Curricular Analytics equations are implemented and the archived workbook graphs are recomputed in server/scripts/ma/complexityCheck.js; see server/data/ma/complexity-validation.json.',
      final_pdf: { ...finalPdfFig6, gate: pdfFigures.fig6_complexity_delta.gate },
      archive_tab_stats: tab.complexity.stats,
      headline_reconciliation: {
        final_pdf_headline: FINAL_PDF_HEADLINES.fig6_headline,
        reading: `The final-PDF ${finalPdfFig6.cells}-cell mean is ${finalPdfFig6.mean.toFixed(4)} and rounds to +15. The older archive-tab mean is ${tab.complexity.stats.mean_delta_vs_resident.toFixed(4)} and rounds to +16, not +15. The headline is supported by the final transcription, not by rounding the archive mean.`,
      },
    },
  };

  fs.writeFileSync(path.resolve(__dirname, '../../data/ma/methods-audit.json'), JSON.stringify(report, null, 1));
  console.log('Fig 1:', `${fig1.ours_vs_stored_exact}/${fig1.cells} ours=archive stored exact; archive formulas ${fig1.archive_formula_recomputed_exact}/165; archive means ${fig1.archive_mean_ours} / ${fig1.archive_mean_stored}; final-PDF prose ${FINAL_PDF_HEADLINES.fig1_mean}`);
  console.log('Fig 2:', `${fig2.within_2pp_ours_vs_archive_matrix}/${fig2.comparisons} ours-vs-archive-matrix within 2pp (archive notebook values are hard-coded)`);
  console.log('Fig 2 archive-internal deviations:', JSON.stringify(fig2.archive_hardcoded_deviations));
  console.log('Fig 3:', JSON.stringify(summarize(fig3Pairs, 'pct')));
  if (subgroups) console.log('Fig 3 subgroups:', JSON.stringify({ clean: subgroups.clean, disputed: subgroups.disputed }));
  console.log('Fig 4:', JSON.stringify({ ...summarize(fig4Pairs, 'h'), explained: fig4Explained, fig3_delta_r: fig3fig4DeltaCorrelation }));
  console.log('Fig 5:', JSON.stringify(summarize(fig5Pairs, 'usd')));
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
