#!/usr/bin/env node
/**
 * Import the Massachusetts paper's data, snapshot-first.
 *
 *   node scripts/ma/importMassachusetts.js            # build + validate + snapshot only
 *   node scripts/ma/importMassachusetts.js --apply    # upsert into the database
 *
 * Reads the converter's raw JSON (server/data/ma/raw), builds documents in
 * the California schemas, and refuses to write anything when the round-trip
 * validation fails — a failed validation means the documents cannot
 * reproduce the source workbooks' own numbers. The dry run always writes
 * server/data/ma/snapshot.json for review. Warnings never block; they are
 * the paper's internal drifts and feed the reproduction report.
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildMaDocuments, validateMaDocuments } = require('./buildMaDocuments');

const RAW_DIR = path.resolve(__dirname, '../../data/ma/raw');
const SNAPSHOT = path.resolve(__dirname, '../../data/ma/snapshot.json');

function loadRaw() {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, name), 'utf8'));
  const raw = {
    heatmap: read('heatmap.json'),
    as_degrees: read('as_degrees.json'),
    pathways: read('pathways.json'),
    baselines: read('baselines.json'),
  };
  return mergePdfFigures(raw, loadPdfFigures());
}

function loadPdfFigures() {
  const file = path.resolve(__dirname, '../../data/ma/pdf-figures.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const figurePairs = (cells = {}) => Object.entries(cells)
  .flatMap(([cc, byUni]) => Object.entries(byUni).map(([uni, value]) => ({
    cc, uni, value, key: `${cc}|${uni}`,
  })));

function validatePrintedAverages(label, cells, printedAverages, tolerance, failures) {
  const columns = {};
  for (const { uni, value } of figurePairs(cells)) {
    (columns[uni] = columns[uni] || []).push(value);
  }
  for (const [uni, printed] of Object.entries(printedAverages || {})) {
    const values = columns[uni] || [];
    const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    if (Math.abs(mean - printed) > tolerance) {
      failures.push(`${label}: ${uni} column mean ${mean.toFixed(1)} does not reproduce the printed average ${printed}`);
    }
  }
}

/**
 * Fold the final PDF's printed Figures 3–5 in as distinct baseline measures.
 * The PDF is a NEWER revision than the repo workbook, so published values and
 * our reconstruction ride side by side instead of one silently replacing the
 * other. Figure 3 must cover the repo tally's whole studied-pair universe;
 * Figures 4 and 5 share the same 49-pair subset and are one arithmetic chain.
 */
function mergePdfFigures(raw, pdf) {
  if (!pdf) return raw;
  const failures = [];
  const baselines = { ...raw.baselines };
  const repoPairList = figurePairs(raw.baselines?.pct_as?.cells);
  const repoPairs = new Set(repoPairList.map((pair) => pair.key));

  if (pdf.fig3_pct_as) {
    const { cells, printed_average_row: printedAverages } = pdf.fig3_pct_as;
    const pdfPairs = figurePairs(cells);
    for (const { cc, uni } of pdfPairs) {
      if (raw.baselines?.pct_as?.cells?.[cc]?.[uni] == null) {
        failures.push(`pdf-figures: ${uni}/${cc} is not a studied pair in the repo tally`);
      }
    }
    validatePrintedAverages('pdf-figures Figure 3', cells, printedAverages, 0.6, failures);
    if (repoPairList.length !== pdfPairs.length) {
      failures.push(`pdf-figures: ${pdfPairs.length} transcribed Figure-3 pairs vs ${repoPairList.length} in the repo tally`);
    }

    const scaled = {};
    for (const [cc, byUni] of Object.entries(cells)) {
      scaled[cc] = Object.fromEntries(Object.entries(byUni)
        .map(([uni, value]) => [uni, value / 100]));
    }
    baselines.pct_as_pdf = { cells: scaled };
  }

  const hoursFigure = pdf.fig4_extra_hours;
  const costFigure = pdf.fig5_extra_cost;
  if (Boolean(hoursFigure) !== Boolean(costFigure)) {
    failures.push('pdf-figures: Figures 4 and 5 must be transcribed together');
  } else if (hoursFigure && costFigure) {
    const hourPairs = figurePairs(hoursFigure.cells);
    const costPairs = figurePairs(costFigure.cells);
    const hourByKey = new Map(hourPairs.map((pair) => [pair.key, pair]));
    const costByKey = new Map(costPairs.map((pair) => [pair.key, pair]));

    if (hourPairs.length !== 49 || hoursFigure.cell_count !== 49) {
      failures.push(`pdf-figures: Figure 4 must contain exactly 49 cells (found ${hourPairs.length})`);
    }
    if (costPairs.length !== hourPairs.length) {
      failures.push(`pdf-figures: Figure 5 has ${costPairs.length} cells vs Figure 4's ${hourPairs.length}`);
    }
    for (const pair of hourPairs) {
      if (!repoPairs.has(pair.key)) {
        failures.push(`pdf-figures Figure 4: ${pair.uni}/${pair.cc} is not a studied pair in the repo tally`);
      }
      if (!costByKey.has(pair.key)) {
        failures.push(`pdf-figures Figure 5: missing ${pair.uni}/${pair.cc}`);
      }
    }
    for (const pair of costPairs) {
      if (!hourByKey.has(pair.key)) {
        failures.push(`pdf-figures Figure 5: extra ${pair.uni}/${pair.cc}`);
      }
    }

    validatePrintedAverages(
      'pdf-figures Figure 4', hoursFigure.cells,
      hoursFigure.printed_average_row, 0.6, failures
    );
    validatePrintedAverages(
      'pdf-figures Figure 5', costFigure.cells,
      costFigure.printed_average_row, 1.1, failures
    );

    const impliedRates = {};
    for (const pair of hourPairs) {
      const cost = costByKey.get(pair.key)?.value;
      if (!Number.isFinite(cost)) continue;
      if (pair.value === 0) {
        if (cost !== 0) failures.push(`pdf-figures Figure 5: ${pair.uni}/${pair.cc} has zero hours but $${cost} cost`);
        continue;
      }
      (impliedRates[pair.uni] = impliedRates[pair.uni] || []).push(cost / pair.value);
    }
    for (const [uni, rates] of Object.entries(impliedRates)) {
      const spread = Math.max(...rates) - Math.min(...rates);
      // Figure 5 prints whole dollars, so a small implied-rate spread is the
      // expected inverse of cell-level dollar rounding. Anything larger means
      // the two transcriptions no longer encode one measure.
      if (spread > 0.51) {
        failures.push(`pdf-figures Figure 5: ${uni} implied rate spread is $${spread.toFixed(2)}`);
      }
    }

    baselines.extra_hours_pdf = { cells: hoursFigure.cells };
    baselines.extra_cost_pdf = { cells: costFigure.cells };
  }

  if (failures.length) {
    const error = new Error(`pdf-figures transcription failed validation:\n  ${failures.join('\n  ')}`);
    error.failures = failures;
    throw error;
  }
  return { ...raw, baselines };
}

async function upsertAll(collection, docs) {
  if (!docs.length) return;
  await collection.bulkWrite(docs.map((doc) => ({
    replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
  })));
}

async function runMaImport(db, raw, { apply = false } = {}) {
  const built = buildMaDocuments(raw);
  const report = validateMaDocuments(raw, built);
  if (report.failures.length || !apply) return { ...report, built };

  await upsertAll(db.collection('assist_institutions'), built.institutions);
  await upsertAll(db.collection('curated_requirements'), [...built.degrees, ...built.asDegrees]);
  await upsertAll(db.collection('assist_agreements'), built.agreements);
  await upsertAll(db.collection('assist_courses'), built.courses);
  await upsertAll(db.collection('ma_paper_baselines'), built.baselines);
  return { ...report, built };
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  const apply = process.argv.includes('--apply');
  const raw = loadRaw();

  const { MongoClient } = require('mongodb');
  const client = apply ? new MongoClient(process.env.MONGO_URI) : null;
  if (client) await client.connect();
  try {
    const db = client ? client.db(process.env.DB_NAME) : null;
    const report = await runMaImport(db, raw, { apply: apply && !!db });

    const counts = Object.fromEntries(Object.entries(report.built)
      .map(([key, docs]) => [key, docs.length]));
    fs.writeFileSync(SNAPSHOT, JSON.stringify({
      generated_at: new Date().toISOString(),
      counts,
      failures: report.failures,
      warnings: report.warnings,
      documents: report.built,
    }, null, 1));

    console.log('counts:', counts);
    console.log(`${report.failures.length} failure(s), ${report.warnings.length} warning(s)`);
    for (const failure of report.failures) console.log('  FAIL', failure);
    for (const warning of report.warnings.slice(0, 20)) console.log('  warn', warning);
    if (report.warnings.length > 20) console.log(`  … ${report.warnings.length - 20} more warnings in snapshot.json`);
    console.log(apply
      ? (report.failures.length ? 'NOT applied: validation failed.' : 'Applied to the database.')
      : `Dry run only — snapshot at ${path.relative(process.cwd(), SNAPSHOT)}. Re-run with --apply to write.`);
    if (report.failures.length) process.exitCode = 1;
  } finally {
    if (client) await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { runMaImport, loadRaw, loadPdfFigures, mergePdfFigures };
