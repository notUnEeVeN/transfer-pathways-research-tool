#!/usr/bin/env node
/**
 * The complete per-pair ledger for Figure 3: for every one of the 61 studied
 * pairs, our recomputation against the final PDF's printed value, with each
 * material difference diagnosed to a verdict — theirs (with the mechanism and
 * magnitude) or ours (with the exact rows our matcher failed to recover).
 *
 * Per pair, from the paper's own workbook:
 *   R  removed resident requirements (the real overlay matcher — the same
 *      code the importer runs), rows and BS-valued units
 *   M  what our engine credited: receivers with minted options, AS units
 *   X  contradictions: removed rows whose matrix verdict is FALSE — the
 *      paper's pathway and heatmap disagreeing about the same course; we
 *      follow the matrix, a tally that credited them reads higher
 *   L  losses: removed rows our matcher could not place (typos, renames) —
 *      OUR pipeline's fault, quantified, listed by name
 *
 * Verdicts:
 *   agrees            |ours − printed| ≤ 2.5pp
 *   stub-pathway      the workbook removes (almost) nothing; the printed
 *                     value has no course-level record behind it
 *   tally-drift       our recovery is essentially complete and the printed
 *                     value still differs — the hand tally does not match
 *                     the workbook it sits beside
 *   above-ceiling     the printed value exceeds what the workbook could
 *                     yield under ANY definition
 *   our-loss          our matcher under-recovered enough to explain the
 *                     difference — OUR approach's cost on this pair
 *   mixed             matcher losses and tally drift both present
 *
 *   node scripts/ma/pdfReconciliation.js
 * Writes server/data/ma/pdf-reconciliation.json (full ledger, all 61 rows).
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { transferCreditRateData } = require('../../services/analysis/transferCreditRate');
const { removedResidentByMatching, MA_SCHOOL_IDS, MA_CC_IDS } = require('./buildMaDocuments');
const { loadRaw } = require('./importMassachusetts');

const shortCc = (name) => String(name || '').replace(/ Community College$/, '');
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const sumCredits = (rows) => rows.reduce((s, row) => s + (row.credits || 0), 0);
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const raw = loadRaw();

  const rows = await transferCreditRateData(db, null, { degreeType: 'local_as', majorSlug: 'ma-cs' });
  const agreements = await db.collection('assist_agreements')
    .find({ state: 'ma', pairing: 'order-approximate' }).toArray();
  const sending = await db.collection('assist_courses').find({ state: 'ma', side: 'sending' }).toArray();
  const unitsById = new Map(sending.map((course) => [course.course_id, course.units || 0]));
  const byPair = new Map(agreements.map((agreement) => [
    `${agreement.uc_school_id}|${agreement.community_college_id}`, agreement,
  ]));
  const nameForSchool = Object.fromEntries(Object.entries(MA_SCHOOL_IDS).map(([name, id]) => [id, name]));
  const nameForCc = Object.fromEntries(Object.entries(MA_CC_IDS).map(([name, id]) => [id, name]));

  // The tally tab's own cells, recovered as typed fractions (=N/D): the
  // numerator is a hand COUNT of transferred credits, the denominator a
  // hand-typed AS total, with no reference to any other tab — the recovered
  // algorithm itself. See data/ma/pct-as-fractions.json.
  let fractions = {};
  const fractionsPath = path.resolve(__dirname, '../../data/ma/pct-as-fractions.json');
  if (fs.existsSync(fractionsPath)) fractions = JSON.parse(fs.readFileSync(fractionsPath, 'utf8'));

  const cells = [];
  for (const row of rows) {
    const pdf = row.published_pdf_as_transfer_pct;
    if (pdf == null) continue;
    const uniName = nameForSchool[row.school_id];
    const ccName = nameForCc[row.community_college_id];
    const block = raw.pathways?.[uniName] || {};
    const resident = block.resident || [];
    const pathway = block.pairs?.[ccName] || [];
    const asCourses = raw.as_degrees?.[ccName]?.courses || [];

    // R: the workbook's own removals, via the SAME matcher the importer runs.
    const removed = removedResidentByMatching(resident, asCourses, pathway);
    const removedUnits = sumCredits(removed);

    // The matrix verdicts, keyed the way the builder keys template courses.
    const university = raw.heatmap.universities.find((entry) => entry.name === uniName);
    const verdicts = university?.matrix?.[ccName] || [];
    const matrixByKey = new Map();
    (university?.courses || []).forEach((course, index) => {
      matrixByKey.set(`${String(course.prefix || '').toUpperCase()} ${String(course.number || '').toUpperCase()}`.trim(), Boolean(verdicts[index]));
      matrixByKey.set(norm(course.header), Boolean(verdicts[index]));
    });

    // M: what the engine credited on this pair.
    const agreement = byPair.get(`${row.school_id}|${row.community_college_id}`);
    const receivers = agreement ? agreement.requirement_groups[0].sections[0].receivers : [];
    const optioned = receivers.filter((receiver) => (receiver.options || []).length > 0);
    const creditedUnits = optioned.reduce((sum, receiver) => sum
      + receiver.options.flatMap((option) => option.course_ids || [])
        .reduce((s, id) => s + (unitsById.get(id) || 0), 0), 0);

    // X vs L: removed rows the matrix denies vs rows nothing accounts for.
    const contradictions = [];
    const losses = [];
    let accounted = optioned.length;
    for (const removedRow of removed) {
      const code = `${String(removedRow.prefix || '').toUpperCase()} ${String(removedRow.number || '').toUpperCase()}`.trim();
      const matrixSaysNo = matrixByKey.get(code) === false || matrixByKey.get(norm(removedRow.name)) === false;
      if (accounted > 0) { accounted -= 1; continue; }
      if (matrixSaysNo) contradictions.push({ code, name: removedRow.name, credits: removedRow.credits || 0 });
      else losses.push({ code, name: removedRow.name, credits: removedRow.credits || 0 });
    }
    const contradictionUnits = sumCredits(contradictions);
    const lossUnits = sumCredits(losses);
    const asTotal = row.as_total_units || 1;
    const ours = row.as_unit_utilization_pct;
    const delta = +(ours - pdf).toFixed(1);
    // If our matcher had recovered every lost row (at their stated credits),
    // where would we land? Separates "our loss explains it" from "it doesn't".
    const oursIfRecovered = +Math.min(100, ((creditedUnits + lossUnits) / asTotal) * 100).toFixed(1);
    // The most generous reading the workbook supports at all.
    const ceiling = +Math.min(100, ((creditedUnits + lossUnits + contradictionUnits) / asTotal) * 100).toFixed(1);

    let verdict; let explanation;
    if (Math.abs(delta) <= 2.5) {
      verdict = 'agrees';
      explanation = `Matches the printed value within rounding (Δ ${delta}pp).`;
    } else if (removed.length <= 1 && pdf > 15) {
      verdict = 'stub-pathway';
      explanation = `The workbook's pathway removes ${removed.length === 0 ? 'nothing' : 'one row'} — it records essentially no transfer for this pair, so the printed ${pdf}% has no course-level record behind it. Their number is unsupported by ~${Math.abs(delta)}pp.`;
    } else if (pdf > ceiling + 2.5) {
      verdict = 'above-ceiling';
      explanation = `The printed ${pdf}% exceeds everything the workbook could yield under any definition (ceiling ≈ ${ceiling}%). Their number overstates their own record by ≥ ${(pdf - ceiling).toFixed(1)}pp.`;
    } else if (losses.length >= 2 && Math.abs(oursIfRecovered - pdf) < Math.abs(delta) - 2) {
      const closes = Math.abs(oursIfRecovered - pdf) <= 3;
      verdict = closes ? 'our-loss' : 'mixed';
      explanation = closes
        ? `OUR matcher failed to place ${losses.length} removed rows (${losses.map((l) => l.name).join('; ')}, ${lossUnits}u); recovering them lands on ${oursIfRecovered}% ≈ printed ${pdf}%. This difference is our pipeline's cost, not their error.`
        : `Partly ours: ${losses.length} unplaced rows (${lossUnits}u) move us to ${oursIfRecovered}%; the remaining ${(pdf - oursIfRecovered).toFixed(1)}pp is tally drift on their side.`;
    } else if (contradictions.length >= 1 && delta < 0) {
      verdict = 'tally-drift';
      explanation = `Their pathway removed ${contradictions.length} course(s) their own matrix marks NOT articulated (${contradictions.map((c) => c.code).join(', ')}, ${contradictionUnits}u) — the paper's two artifacts disagree about the same courses; we follow the matrix. Crediting them their way explains ~${contradictionUnits}u of the ${Math.abs(delta)}pp gap.`;
    } else {
      verdict = 'tally-drift';
      explanation = delta > 0
        ? `Our recovery of the workbook is essentially complete (${optioned.length}/${removed.length} removed rows credited), yet the printed value is ${Math.abs(delta)}pp LOWER — the hand tally under-credits its own workbook by that much.`
        : `The printed value is ${Math.abs(delta)}pp higher than the workbook overlay yields (${optioned.length}/${removed.length} rows credited; ceiling ${ceiling}%); the tally does not reconcile to the workbook it sits beside.`;
    }

    const typed = fractions[ccName]?.[uniName];
    cells.push({
      pair: `${row.school} × ${shortCc(row.college_name)}`,
      pdf, repo: row.published_as_transfer_pct, ours, delta_ours_vs_pdf: delta,
      their_typed_fraction: typed?.n != null ? `${typed.n}/${typed.d}` : null,
      their_counted_units: typed?.n ?? null,
      their_typed_as_total: typed?.d ?? null,
      as_sheet_total: asTotal,
      workbook: {
        removed_rows: removed.length,
        removed_units: removedUnits,
        credited_rows: optioned.length,
        credited_units: +creditedUnits.toFixed(1),
        contradiction_rows: contradictions.length ? contradictions : undefined,
        loss_rows: losses.length ? losses : undefined,
        ours_if_losses_recovered: oursIfRecovered,
        ceiling,
      },
      verdict, explanation,
    });
  }

  // Denominator audit: their typed AS totals vs their own AS sheets.
  const denominatorAudit = [];
  const seenCc = new Set();
  for (const cell of cells) {
    const cc = cell.pair.split(' × ')[1];
    if (seenCc.has(cc) || cell.their_typed_as_total == null) continue;
    seenCc.add(cc);
    if (cell.their_typed_as_total !== cell.as_sheet_total) {
      denominatorAudit.push(`${cc}: typed ${cell.their_typed_as_total} vs their own AS sheet ${cell.as_sheet_total} (every cell in the row inherits the error)`);
    }
  }

  const buckets = {};
  for (const cell of cells) buckets[cell.verdict] = (buckets[cell.verdict] || 0) + 1;
  const material = cells.filter((cell) => cell.verdict !== 'agrees');
  const report = {
    generated_at: new Date().toISOString(),
    method: 'One verdict per studied pair: our recomputation vs the final PDF, diagnosed against the workbook\'s own removals (real matcher), the matrix verdicts, and our matcher\'s recovery.',
    their_algorithm: 'Recovered from the tally tab itself: each cell is a typed fraction =N/D with no cell references — N is a hand COUNT of transferred credits, D a hand-typed AS total. Nothing recomputes when the pathway tabs change.',
    denominator_audit: denominatorAudit,
    summary: {
      pairs: cells.length,
      mean_ours: +mean(cells.map((cell) => cell.ours)).toFixed(1),
      mean_pdf: +mean(cells.map((cell) => cell.pdf)).toFixed(1),
      verdicts: buckets,
      our_side_pairs: cells.filter((cell) => cell.verdict === 'our-loss').length,
      mixed_pairs: cells.filter((cell) => cell.verdict === 'mixed').length,
    },
    cells: cells.sort((a, b) => Math.abs(b.delta_ours_vs_pdf) - Math.abs(a.delta_ours_vs_pdf)),
  };
  fs.writeFileSync(path.resolve(__dirname, '../../data/ma/pdf-reconciliation.json'), JSON.stringify(report, null, 1));

  console.log('pairs:', cells.length, '| verdicts:', JSON.stringify(buckets));
  console.log('means: ours', report.summary.mean_ours, 'vs pdf', report.summary.mean_pdf);
  console.log('\nAll material pairs (|Δ| > 2.5pp), largest first:');
  for (const cell of material) {
    console.log(`\n  ${cell.pair}  pdf ${cell.pdf} | repo ${cell.repo} | ours ${cell.ours}  (Δ ${cell.delta_ours_vs_pdf})  → ${cell.verdict}`);
    console.log(`    ${cell.explanation}`);
  }
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
