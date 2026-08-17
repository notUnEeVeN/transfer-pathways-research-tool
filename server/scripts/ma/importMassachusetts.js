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

/**
 * Fold the final PDF's printed Figure 3 matrix in as its own baseline
 * measure (`pct_as_pdf`). The PDF is a NEWER revision of the tally than the
 * repo workbook, so the two ride side by side — repo (`pct_as`), PDF
 * (`pct_as_pdf`) — and the console's source selector can show either against
 * our recomputation. Two gates guard the transcription: every column mean
 * must reproduce the figure's own printed Average row, and the studied-pair
 * universe must be exactly the repo tally's.
 */
function mergePdfFigures(raw, pdf) {
  if (!pdf?.fig3_pct_as) return raw;
  const { cells, printed_average_row: printedAverages } = pdf.fig3_pct_as;
  const failures = [];
  const columns = {};
  for (const [cc, byUni] of Object.entries(cells)) {
    for (const [uni, value] of Object.entries(byUni)) {
      (columns[uni] = columns[uni] || []).push(value);
      if (raw.baselines?.pct_as?.cells?.[cc]?.[uni] == null) {
        failures.push(`pdf-figures: ${uni}/${cc} is not a studied pair in the repo tally`);
      }
    }
  }
  for (const [uni, printed] of Object.entries(printedAverages)) {
    const values = columns[uni] || [];
    const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    // The figure prints integers; allow the half-point rounding band.
    if (Math.abs(mean - printed) > 0.6) {
      failures.push(`pdf-figures: ${uni} column mean ${mean.toFixed(1)} does not reproduce the printed average ${printed}`);
    }
  }
  const repoPairs = Object.entries(raw.baselines?.pct_as?.cells || {})
    .flatMap(([cc, byUni]) => Object.keys(byUni).map((uni) => `${cc}|${uni}`));
  const pdfPairs = Object.entries(cells)
    .flatMap(([cc, byUni]) => Object.keys(byUni).map((uni) => `${cc}|${uni}`));
  if (repoPairs.length !== pdfPairs.length) {
    failures.push(`pdf-figures: ${pdfPairs.length} transcribed pairs vs ${repoPairs.length} in the repo tally`);
  }
  if (failures.length) {
    const error = new Error(`pdf-figures transcription failed validation:\n  ${failures.join('\n  ')}`);
    error.failures = failures;
    throw error;
  }
  const scaled = {};
  for (const [cc, byUni] of Object.entries(cells)) {
    scaled[cc] = Object.fromEntries(Object.entries(byUni).map(([uni, value]) => [uni, value / 100]));
  }
  return {
    ...raw,
    baselines: { ...raw.baselines, pct_as_pdf: { cells: scaled } },
  };
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
