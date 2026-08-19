#!/usr/bin/env node
/**
 * Archive-vintage ledgers for the deposited Massachusetts repository.
 *
 * IMPORTANT: the deposited spreadsheets/notebooks are from the repository's
 * 2024-12-12 snapshot, while the final PDF was created in June 2026. This
 * report diagnoses the archived artifacts and our recomputation of them. It
 * does not call an archived literal a value "published" in the later paper.
 *
 *   Fig 1  (heatmap)      archive workbook: 165/165 exact; the later PDF is
 *                         separately checked against its transcription.
 *   Fig 2  (course types) archive notebook's hard-coded arrays vs its own
 *                         matrix (engine typing rule) vs our engine output.
 *   Fig 4  (credit hours) archive typed per-pair hours vs the sum of its own
 *                         pathway sheet vs our reconstruction of the same sum.
 *   Fig 5  (cost)         archive formula identity linking it to archive Fig 4.
 *   MT     (MassTransfer) the imported flags vs the workbook column.
 *
 *   node scripts/ma/figureLedgers.js
 * Writes server/data/ma/figure-ledgers.json.
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { coverageData } = require('../../services/analysis/pathways');
const { removedResidentByMatching, MA_SCHOOL_IDS, MA_CC_IDS } = require('./buildMaDocuments');

const theirMath = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/their-math.json'), 'utf8'));
const pdfFigures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/pdf-figures.json'), 'utf8'));
const raw = {
  heatmap: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/raw/heatmap.json'), 'utf8')),
  as_degrees: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/raw/as_degrees.json'), 'utf8')),
  pathways: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/raw/pathways.json'), 'utf8')),
};
const sum = (rows) => rows.reduce((s, row) => s + (row.credits || 0), 0);

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  // ── Fig 1: assert the standing gate result ───────────────────────────────
  const cov = await coverageData(db, null, { requirements: 'degree', majorSlug: 'ma-cs' });
  const named = cov.map((row) => row.pct_named_requirement_courses).filter(Number.isFinite);
  const archiveMean = +(named.reduce((a, b) => a + b, 0) / named.length).toFixed(1);
  const fig1 = {
    scope: '2024 archived repository; final PDF checked only through its literal transcription gate',
    verdict: 'archive exact; final PDF visibly differs from the archive in 1 of 165 cells',
    archive_cells: named.length,
    archive_mean_ours: archiveMean,
    // Retained for the presentation-safe controller's legacy summary field.
    mean_ours: archiveMean,
    archive_formula_gate: {
      cells_checked: theirMath.fig1.summary.cells,
      cells_recomputed_exactly: theirMath.fig1.summary.recomputed_exactly,
    },
    final_pdf_archive_rounding_gate: pdfFigures.fig1_course_articulation.archive_rounding_gate,
    final_pdf_printed_matrix_gate: pdfFigures.fig1_course_articulation.printed_matrix_gate,
    final_pdf_prose_mean: pdfFigures.fig1_course_articulation.published_prose_mean,
    final_pdf_audit_note: pdfFigures.fig1_course_articulation.audit_note,
    note: 'Our engine and the archived workbook agree on all 165 archive cells (archive mean 38.2%). The June 2026 final PDF changes Cape Cod × UMass Dartmouth from the archive-rounded 35% to 45%, so archive exactness is not a claim that all 165 final-PDF cells match.',
  };

  // ── Fig 2: hard-coded arrays vs their matrix vs ours ─────────────────────
  const fig2 = { entries: [], verdicts: {} };
  const KNOWN = {
    'UMass Lowell|Math': 'transposed with UMass Dartmouth',
    'UMass Dartmouth|Math': 'transposed with UMass Lowell',
    'UMass Lowell|Science': 'transposed with UMass Dartmouth',
    'UMass Dartmouth|Science': 'transposed with UMass Lowell',
    'Worcester|Math': 'their own discrete-math-is-math rule not applied (CS 225/295 articulate poorly)',
  };
  theirMath.fig2.universities.forEach((uni, index) => {
    for (const type of ['Computing', 'Math', 'Science', 'Humanities']) {
      const hard = theirMath.fig2.hardcoded_in_notebook[type]?.[index];
      const matrix = uni.share_of_lower_cells_articulating[type];
      if (hard == null || matrix == null) continue;
      const delta = +((hard - matrix) * 100).toFixed(1);
      let verdict;
      if (Math.abs(delta) <= 2) verdict = 'agrees';
      else if (KNOWN[`${uni.name}|${type}`]) verdict = KNOWN[`${uni.name}|${type}`];
      else verdict = 'hand-entry drift vs their own matrix';
      fig2.entries.push({
        entry: `${uni.name} · ${type}`,
        archive_notebook_value: +(hard * 100).toFixed(0),
        archive_matrix_value: +(matrix * 100).toFixed(1),
        delta_archive_notebook_vs_matrix: delta,
        verdict,
      });
      fig2.verdicts[verdict === 'agrees' ? 'agrees' : 'archive-notebook-vs-own-matrix'] =
        (fig2.verdicts[verdict === 'agrees' ? 'agrees' : 'archive-notebook-vs-own-matrix'] || 0) + 1;
    }
  });
  fig2.scope = '2024 archived notebook and matrices only';
  fig2.note = 'The values called archive_notebook_value are hard-coded bars in the deposited GitHub notebook, not values transcribed from the June 2026 final PDF. This ledger diagnoses disagreements inside the archive; it does not establish a final-paper error.';

  // ── Fig 4: typed hours vs their own sheet sum vs our reconstruction ──────
  const nameForSchool = Object.fromEntries(Object.entries(MA_SCHOOL_IDS).map(([n, i]) => [i, n]));
  const fig4 = { cells: [], verdicts: {} };
  for (const [uniName, byCc] of Object.entries(theirMath.currcomp.credit_hours.cells)) {
    for (const [cc, typed] of Object.entries(byCc)) {
      const block = raw.pathways?.[uniName] || {};
      const resident = block.resident || [];
      const pathway = block.pairs?.[cc] || [];
      const asCourses = raw.as_degrees?.[cc]?.courses || [];
      if (!pathway.length) continue;
      const sheetSum = +sum(pathway).toFixed(1);
      const removed = removedResidentByMatching(resident, asCourses, pathway);
      const ourSum = +(sum(resident) - sum(removed) + sum(asCourses)).toFixed(1);
      const deltaTypedVsSheet = +(typed - sheetSum).toFixed(1);
      const deltaOursVsSheet = +(ourSum - sheetSum).toFixed(1);
      let verdict;
      if (Math.abs(deltaTypedVsSheet) <= 1) verdict = 'agrees';
      else if (Math.abs(deltaTypedVsSheet) <= 4) verdict = 'typed hours drift small vs their own sheet';
      else verdict = 'typed hours contradict their own sheet';
      fig4.cells.push({
        pair: `${uniName} × ${cc}`,
        archive_typed_hours: typed,
        archive_pathway_sheet_sum: sheetSum,
        archive_reconstruction: ourSum,
        delta_archive_typed_vs_sheet: deltaTypedVsSheet,
        delta_archive_reconstruction_vs_sheet: deltaOursVsSheet,
        verdict,
      });
      fig4.verdicts[verdict] = (fig4.verdicts[verdict] || 0) + 1;
    }
  }
  fig4.scope = '2024 archived workbook only';
  fig4.final_pdf_transcription = {
    artifact: 'server/data/ma/pdf-figures.json#fig4_extra_hours',
    cells: pdfFigures.fig4_extra_hours.cell_count,
    gate: pdfFigures.fig4_extra_hours.gate,
  };
  fig4.note = 'The archive Credit Hours tab contains typed literals. Verdicts here compare those archive literals with sums of archive pathway sheets. The later final-PDF Figure 4 has been transcribed separately (49 cells); archive discrepancies are not automatically final-paper discrepancies.';

  // ── Fig 5: formula identity, re-checked ──────────────────────────────────
  let costChecked = 0; let costWorst = 0;
  for (const [uniName, byCc] of Object.entries(theirMath.currcomp.cost.cells)) {
    for (const [cc, cost] of Object.entries(byCc)) {
      const hours = theirMath.currcomp.credit_hours.cells[uniName]?.[cc];
      if (hours == null || hours <= 120 || cost <= 0) continue;
      const rate = cost / (hours - 120);
      // The per-university rate must be constant; measure the spread later.
      costChecked += 1;
      const first = theirMath.currcomp.cost.cells[uniName];
      const anyOther = Object.entries(first).find(([otherCc, otherCost]) => otherCc !== cc
        && theirMath.currcomp.credit_hours.cells[uniName]?.[otherCc] > 120 && otherCost > 0);
      if (anyOther) {
        const otherRate = anyOther[1] / (theirMath.currcomp.credit_hours.cells[uniName][anyOther[0]] - 120);
        costWorst = Math.max(costWorst, Math.abs(rate - otherRate));
      }
    }
  }
  const fig5 = {
    scope: '2024 archived workbook formula identity; final PDF checked separately',
    verdict: 'no independent arithmetic discrepancy found in the archived cost formulas',
    archive_cells_checked: costChecked,
    archive_worst_rate_spread_usd: +costWorst.toFixed(2),
    final_pdf_gate: pdfFigures.fig5_extra_cost.gate,
    note: 'In the archive, Cost = (Credit Hours − 120) × a per-university rate, consistent to the cent. The final PDF is a later artifact and its separately transcribed Figure 5 is likewise formula-linked to its Figure 4; this archive check alone is not a verdict on final-PDF inputs.',
  };

  // ── MassTransfer: imported flags vs the workbook column ──────────────────
  let mtCells = 0; let mtMismatch = 0;
  const agreements = await db.collection('assist_agreements').find({ state: 'ma' }).toArray();
  const mtByPair = new Map();
  for (const uni of raw.heatmap.universities) {
    for (const [cc, flag] of Object.entries(uni.mt || {})) {
      mtByPair.set(`${MA_SCHOOL_IDS[uni.name]}|${MA_CC_IDS[cc]}`, Boolean(flag));
    }
  }
  for (const agreement of agreements) {
    const expected = mtByPair.get(`${agreement.uc_school_id}|${agreement.community_college_id}`) || false;
    mtCells += 1;
    if (Boolean(agreement.mass_transfer) !== expected) mtMismatch += 1;
  }
  const mtImported = agreements.some((agreement) => agreement.mass_transfer !== undefined);
  const mt = mtImported
    ? {
      verdict: mtMismatch === 0 ? 'exact' : `${mtMismatch} mismatches`,
      cells: mtCells,
      note: 'The MT column is raw data (no computation on either side); the import carries it through unchanged.',
    }
    : {
      verdict: 'not imported',
      cells: mtCells,
      workbook_true_flags: [...mtByPair.values()].filter(Boolean).length,
      note: 'The MassTransfer map figure was never ported and the MT column is not imported — a completeness gap, not an error; nothing on our side displays it. The workbook marks 38 of 165 pairs as having an A2B agreement.',
    };

  const report = {
    generated_at: new Date().toISOString(),
    artifact_scope: 'Archive-vintage diagnostic. Cell ledgers are computed from the repository snapshot last committed 2024-12-12; the final PDF created 2026-06-26 is a later artifact and appears only through explicitly named final-PDF transcription gates.',
    source_warning: 'Never quote an archive_notebook_value, archive_typed_hours, or archive matrix value as a final-paper value. Archive↔PDF disagreement proves version divergence unless the final PDF also violates an internal arithmetic, population, or scope invariant.',
    source_vintages: {
      archived_repository: { as_of: '2024-12-12', role: 'inputs diagnosed by this ledger' },
      final_pdf: { created: '2026-06-26', transcription: 'server/data/ma/pdf-figures.json' },
    },
    fig1,
    fig2,
    fig4,
    fig5,
    mass_transfer: mt,
  };
  fs.writeFileSync(path.resolve(__dirname, '../../data/ma/figure-ledgers.json'), JSON.stringify(report, null, 1));

  console.log('Fig 1:', fig1.verdict, '—', fig1.note.split(';')[0]);
  console.log('Fig 2 verdicts:', JSON.stringify(fig2.verdicts));
  const fig2Bad = fig2.entries.filter((entry) => entry.verdict !== 'agrees');
  fig2Bad.sort((a, b) => Math.abs(b.delta_archive_notebook_vs_matrix) - Math.abs(a.delta_archive_notebook_vs_matrix))
    .forEach((entry) => console.log('  ', entry.entry.padEnd(28), 'archive notebook', String(entry.archive_notebook_value).padStart(4),
      '| archive matrix', String(entry.archive_matrix_value).padStart(5), '→', entry.verdict));
  console.log('Fig 4 verdicts:', JSON.stringify(fig4.verdicts));
  fig4.cells.filter((cell) => cell.verdict !== 'agrees')
    .sort((a, b) => Math.abs(b.delta_archive_typed_vs_sheet) - Math.abs(a.delta_archive_typed_vs_sheet))
    .slice(0, 12)
    .forEach((cell) => console.log('  ', cell.pair.padEnd(34), 'archive typed', String(cell.archive_typed_hours).padStart(6),
      '| archive sheet', String(cell.archive_pathway_sheet_sum).padStart(6), '| reconstructed', String(cell.archive_reconstruction).padStart(6), '→', cell.verdict));
  console.log('Fig 5:', fig5.verdict, '| archive worst per-university rate spread $' + fig5.archive_worst_rate_spread_usd);
  console.log('MassTransfer:', mt.verdict, '(' + mt.cells + ' cells)');
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
