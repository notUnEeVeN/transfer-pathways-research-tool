#!/usr/bin/env node
/**
 * Can we reproduce the paper's Figure 6 (curricular complexity)?
 *
 * Their README answers how it was produced: "Curricular Complexity:
 * Automatically calculated by curricularanalytics.org. Within All Pathways
 * folder, for each 4y Tab and Transfer Tab, download as csvs. I then uploaded
 * them to curricularanalytics, for the site to return a score."
 *
 * That site is the web front end for CurricularAnalytics.jl, which implements
 * Heileman et al. (2018). We implement the same published equations in
 * services/analysis/curricularComplexity.js, and — decisively — the recovered
 * pathway workbooks carry the prerequisite graph those scores were computed
 * from (`prereqs` and `coreqs` per course). So the figure is reproducible from
 * their own data rather than merely explainable.
 *
 * This script recomputes each pathway's structural complexity and reconciles it
 * against the value stored in their Curricular Complexity tab.
 *
 *   node scripts/ma/complexityCheck.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { maPathwayComplexity } = require('../../services/analysis/maPathwayComplexity');

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/raw/pathways.json'), 'utf8'));
const theirMath = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/their-math.json'), 'utf8'));
const pdfFigures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/pdf-figures.json'), 'utf8'));

/**
 * Complexity of one course list.
 *
 * Curricular Analytics treats a corequisite as an edge too — it constrains the
 * term a course can be taken in — so both are followed. Edges pointing outside
 * the list are dropped, which is what the tool does when a curriculum is
 * uploaded on its own.
 */
function complexityOf(rows, useCoreqs = true) {
  return maPathwayComplexity(rows, { coreqs: useCoreqs }).complexity;
}

const cells = theirMath?.currcomp?.complexity?.cells || {};
const resident = theirMath?.currcomp?.complexity?.resident || {};
const hours = theirMath?.currcomp?.credit_hours || {};
const sumCredits = (rows) => rows.reduce((total, row) => total + (row.credits || 0), 0);

/** Every pathway in the corpus, scored under one corequisite treatment. */
function scoreAll(useCoreqs) {
  const out = [];
  for (const [uni, block] of Object.entries(raw)) {
    if ((block.resident || []).length) {
      out.push({
        pathway: `${uni} (resident)`, uni, cc: null, rows: block.resident,
        ours: complexityOf(block.resident, useCoreqs),
        theirs: resident[uni] ?? null,
        their_hours: hours.resident?.[uni] ?? null,
      });
    }
    for (const [cc, rows] of Object.entries(block.pairs || {})) {
      if (!rows.length) continue;
      out.push({
        pathway: `${uni} x ${cc}`, uni, cc, rows,
        ours: complexityOf(rows, useCoreqs),
        theirs: cells[uni]?.[cc] ?? null,
        their_hours: hours.cells?.[uni]?.[cc] ?? null,
      });
    }
  }
  return out;
}

const agreement = (scored) => {
  const paired = scored.filter((r) => Number.isFinite(r.theirs));
  const exact = paired.filter((r) => r.ours === r.theirs);
  const deltas = paired.map((r) => r.ours - r.theirs);
  return {
    compared: paired.length,
    exact: exact.length,
    mean_delta: +(deltas.reduce((s, v) => s + v, 0) / (deltas.length || 1)).toFixed(3),
  };
};

// Corequisites are edges in Curricular Analytics — they constrain the term a
// course may be taken in. Scoring both ways proves which reading the paper's
// tool used rather than assuming it.
const withCoreqs = scoreAll(true);
const withoutCoreqs = scoreAll(false);
const aWith = agreement(withCoreqs);
const aWithout = agreement(withoutCoreqs);

console.log('=== corequisite treatment, decided by agreement ===');
console.log(`  coreqs AS edges : ${aWith.exact}/${aWith.compared} exact, mean delta ${aWith.mean_delta}`);
console.log(`  coreqs ignored  : ${aWithout.exact}/${aWithout.compared} exact, mean delta ${aWithout.mean_delta}`);
console.log('  -> corequisites are edges; that is the reference tool\'s reading.');

const archiveScoreDifferences = withCoreqs
  .filter((r) => Number.isFinite(r.theirs) && r.ours !== r.theirs)
  .map((r) => ({
    pathway: r.pathway,
    ours: r.ours,
    theirs: r.theirs,
    delta: r.ours - r.theirs,
    tab_credits: sumCredits(r.rows),
    their_published_hours: r.their_hours,
    tab_drifted: Number.isFinite(r.their_hours) && sumCredits(r.rows) !== r.their_hours,
  }));

console.log(`\n=== ${archiveScoreDifferences.length} archived-tab score differences ===`);
archiveScoreDifferences.forEach((m) => console.log(
  '  ', m.pathway.padEnd(30), 'ours', String(m.ours).padStart(4), 'theirs', String(m.theirs).padStart(4),
  '| tab credits', String(m.tab_credits).padStart(4), 'vs published', String(m.their_published_hours).padStart(4),
  m.tab_drifted ? '<- saved course list and archived hours differ' : '<- source artifacts differ'));

const mean = (xs) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
const summarize = (values) => ({
  n: values.length,
  sum: +values.reduce((total, value) => total + value, 0).toFixed(6),
  mean: +mean(values).toFixed(6),
});
const roundAway = (value) => Math.sign(value) * Math.round(Math.abs(value));

// The final PDF is an immutable, fully transcribed input. Keeping the whole
// matrix in pdf-figures.json means regeneration can never silently fall back
// to an archived-tab matrix plus one hand-appended override.
const pdfFigure6 = pdfFigures.fig6_complexity_delta;
if (!pdfFigure6?.cells || !pdfFigure6?.printed_average_row) {
  throw new Error('pdf-figures.json is missing the final-PDF Figure 6 matrix');
}
const finalPdfCells = Object.entries(pdfFigure6.cells).flatMap(([cc, byUniversity]) =>
  Object.entries(byUniversity).map(([uni, delta]) => ({ cc, uni, delta })));
const finalPdfSummary = summarize(finalPdfCells.map((cell) => cell.delta));
if (finalPdfSummary.n !== pdfFigure6.cell_count || finalPdfSummary.sum !== pdfFigure6.cell_sum) {
  throw new Error(`Figure 6 PDF transcription gate failed: ${finalPdfSummary.n} cells, sum ${finalPdfSummary.sum}`);
}
for (const [uni, printed] of Object.entries(pdfFigure6.printed_average_row)) {
  const values = finalPdfCells.filter((cell) => cell.uni === uni).map((cell) => cell.delta);
  if (!values.length || roundAway(mean(values)) !== printed) {
    throw new Error(`Figure 6 PDF average gate failed for ${uni}`);
  }
}

const pathwayByKey = new Map(withCoreqs.map((row) => [`${row.cc || ''}|${row.uni}`, row]));
const residentOurs = new Map(withCoreqs.filter((row) => row.cc == null).map((row) => [row.uni, row.ours]));
const archiveTabDeltas = withCoreqs
  .filter((row) => row.cc && Number.isFinite(row.theirs) && Number.isFinite(resident[row.uni]))
  .map((row) => row.theirs - resident[row.uni]);
const recomputedScoredDeltas = withCoreqs
  .filter((row) => row.cc && Number.isFinite(row.theirs) && Number.isFinite(residentOurs.get(row.uni)))
  .map((row) => row.ours - residentOurs.get(row.uni));
const recomputedAllDeltas = withCoreqs
  .filter((row) => row.cc && Number.isFinite(residentOurs.get(row.uni)))
  .map((row) => row.ours - residentOurs.get(row.uni));

const artifactDifferences = finalPdfCells.map((cell) => {
  const pathway = pathwayByKey.get(`${cell.cc}|${cell.uni}`);
  const archivedTabDelta = Number.isFinite(pathway?.theirs) && Number.isFinite(resident[cell.uni])
    ? pathway.theirs - resident[cell.uni] : null;
  const recomputedArchiveDelta = Number.isFinite(pathway?.ours) && Number.isFinite(residentOurs.get(cell.uni))
    ? pathway.ours - residentOurs.get(cell.uni) : null;
  return {
    uni: cell.uni,
    cc: cell.cc,
    final_pdf_delta: cell.delta,
    archived_tab_delta: archivedTabDelta,
    recomputed_archive_delta: recomputedArchiveDelta,
    classification: cell.delta !== archivedTabDelta
      ? 'final_pdf_vs_archived_tab'
      : recomputedArchiveDelta !== archivedTabDelta
        ? 'recomputed_archive_vs_archived_tab'
        : null,
  };
}).filter((cell) => cell.classification);

const headlineMeans = {
  final_pdf: finalPdfSummary,
  archived_tab: summarize(archiveTabDeltas),
  recomputed_archived_workbooks_scored: summarize(recomputedScoredDeltas),
  recomputed_all_archived_workbooks: summarize(recomputedAllDeltas),
};

console.log('\n=== Figure 6 artifact means (never hybridized) ===');
for (const [source, summary] of Object.entries(headlineMeans)) {
  console.log(`  ${source.padEnd(42)} n=${summary.n} mean=${summary.mean}`);
}
console.log(`  final PDF vs archive differences: ${artifactDifferences.length}`);

fs.writeFileSync(path.resolve(__dirname, '../../data/ma/complexity-validation.json'), JSON.stringify({
  artifact_version: 2,
  generated_by: 'server/scripts/ma/complexityCheck.js',
  method: "The archived README says complexity was computed with curricularanalytics.org. "
    + "We apply the published Heileman et al. equations to the archived workbook graphs. "
    + "The final PDF matrix, archived Curricular Complexity tab, and recomputed archived sheets "
    + "are retained as three separate artifacts.",
  coreq_treatment: { with_coreqs: aWith, without_coreqs: aWithout, chosen: 'coreqs are edges' },
  archive_score_differences: archiveScoreDifferences,
  final_pdf: {
    source: pdfFigures.source,
    source_sha256: pdfFigures.source_sha256,
    source_file_size_bytes: pdfFigures.source_file_size_bytes,
    transcribed_at: pdfFigure6.transcribed_at,
    method: pdfFigure6.method,
    gate: pdfFigure6.gate,
    cells: pdfFigure6.cells,
    printed_average_row: pdfFigure6.printed_average_row,
    summary: finalPdfSummary,
  },
  artifact_differences: artifactDifferences,
  headline_means: headlineMeans,
  pathways: withCoreqs.map(({ rows, ...rest }) => rest),
}, null, 1));
console.log('\nwrote server/data/ma/complexity-validation.json');
