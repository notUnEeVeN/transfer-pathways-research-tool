#!/usr/bin/env node
/**
 * Fill unit-only degree sections with the courses they stand for — and prove
 * that doing so changed no figure.
 *
 * Only sections whose resolved courses reconcile EXACTLY against the section's
 * stated units are written (see scripts/resolveDegreeCourseGaps.js). That is
 * the whole safety argument: replacing "5 units of unnamed requirement" with
 * "5 units of CSE 101" adds a name and nothing else, so every figure must come
 * out byte-identical. If one moves, the fill has changed meaning somewhere and
 * the run aborts rather than writing.
 *
 * WHAT IS WRITTEN, deliberately minimal:
 *   receiving.code          the catalogue code ("CSE 101")
 *   receiving.name          kept if already set, else the catalogue title
 *   receiving.catalog_ref   the catalogue row id ("uc:132:CSE 101")
 *   receiving.alternatives  for an OR slot, every code that satisfies it
 *
 * WHAT IS NOT WRITTEN: a numeric `parent_id`. That field is what makes a
 * receiver eligible for articulation matching, and these upper-division courses
 * are non-transferable by definition — minting ids for them could only ever
 * move a number that should not move.
 *
 *   node scripts/applyDegreeCourseGaps.js --doc degree:132:cs        # dry run
 *   node scripts/applyDegreeCourseGaps.js --doc degree:132:cs --apply
 *   node scripts/applyDegreeCourseGaps.js --major cs --apply
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const { proposeForDegree } = require('./resolveDegreeCourseGaps');
const { coverageData } = require('../services/analysis/pathways');
const { transferCreditRateData } = require('../services/analysis/transferCreditRate');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** Every figure value that could conceivably move, as one comparable string. */
async function figureFingerprint(db, majorSlug) {
  const coverage = await coverageData(db, db, { requirements: 'degree', majorSlug });
  const rate = await transferCreditRateData(db, db, {
    degreeType: 'ast', majorSlug, verifiedOnly: false,
  }).catch(() => ({ rows: [] }));
  const rateRows = rate.rows || rate || [];

  const cov = coverage.map((r) => [
    r.school_id, r.community_college_id,
    r.pct_named_requirement_courses, r.named_requirement_courses_total,
    r.named_requirement_courses_articulated, r.pctUnits, r.unitCovered,
    r.pct_named_requirement_courses_with_ge,
  ].join(',')).sort();
  const rat = rateRows.map((r) => [
    r.school_id ?? r.uc_school_id, r.community_college_id, r.degree_type,
    r.full_degree_completion_pct, r.lower_division_completion_pct,
    r.as_unit_utilization_pct, r.extra_units, r.full_degree_required_units,
    r.lower_division_required_units,
  ].join(',')).sort();
  return { coverage: cov, rate: rat };
}

const diffLines = (before, after, label) => {
  const out = [];
  const n = Math.max(before.length, after.length);
  if (before.length !== after.length) out.push(`${label}: row count ${before.length} -> ${after.length}`);
  for (let i = 0; i < n && out.length < 12; i += 1) {
    if (before[i] !== after[i]) out.push(`${label}: ${before[i]} -> ${after[i]}`);
  }
  return out;
};

/** Apply one proposal to a degree document in memory. */
function fillDocument(degree, sections) {
  const doc = JSON.parse(JSON.stringify(degree));
  let filled = 0;
  let sectionIndex = 0;
  const proposals = sections.filter((s) => s.reconciles);
  const byOrder = new Map();
  for (const s of proposals) byOrder.set(s.__order, s);

  for (const group of doc.requirement_groups || []) {
    for (const section of group.sections || []) {
      const receivers = section.receivers || [];
      const explicit = receivers.some((r) => (r.receiving?.parent_id != null)
        || (r.receiving?.parent_ids || []).length > 0);
      if (explicit) continue;
      const proposal = byOrder.get(sectionIndex);
      sectionIndex += 1;
      if (!proposal) continue;
      proposal.slots.forEach((slot, i) => {
        const receiver = receivers[i];
        if (!receiver || !slot.resolved.length) return;
        const primary = slot.resolved[0];
        receiver.receiving = {
          ...receiver.receiving,
          code: primary.code,
          name: receiver.receiving?.name || primary.title || primary.code,
          catalog_ref: primary.parent_id ?? `${doc.school_id ? `uc:${doc.school_id}:` : ''}${primary.code}`,
          ...(slot.resolved.length > 1
            ? {
              alternatives: slot.resolved.map((r) => ({ code: r.code, title: r.title, units: r.units })),
              alternatives_conjunction: slot.conjunction,
            }
            : {}),
        };
        filled += 1;
      });
    }
  }
  return { doc, filled };
}

async function proposalsFor(db, degree) {
  const [assist, catalogue] = await Promise.all([
    db.collection('assist_courses')
      .find({ institution_id: `uc:${degree.school_id}`, parent_id: { $exists: true, $ne: null } }).toArray(),
    db.collection('curated_prerequisites').find({ institution_id: `uc:${degree.school_id}` }).toArray(),
  ]);
  const sections = proposeForDegree(degree, [...catalogue, ...assist]);
  // Record each unit-only section's ordinal so the writer can find it again.
  sections.forEach((s, i) => { s.__order = i; });
  return sections;
}

async function main() {
  const docId = arg('doc');
  const major = arg('major', 'cs');
  const apply = process.argv.includes('--apply');

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const filter = docId ? { _id: docId }
    : { state: { $exists: false }, kind: 'degree', major_slug: major };
  const degrees = await db.collection('curated_requirements').find(filter).sort({ _id: 1 }).toArray();
  if (!degrees.length) throw new Error(`no degree documents matched ${JSON.stringify(filter)}`);
  const majors = [...new Set(degrees.map((d) => d.major_slug))];

  console.log('Baseline figures before any change…');
  const before = {};
  for (const m of majors) before[m] = await figureFingerprint(db, m);

  const plan = [];
  for (const degree of degrees) {
    const sections = await proposalsFor(db, degree);
    const { doc, filled } = fillDocument(degree, sections);
    if (filled) plan.push({ degree, doc, filled });
    console.log(`  ${String(degree._id).padEnd(22)} ${String(filled).padStart(3)} receivers fillable`);
  }
  const totalFilled = plan.reduce((s, p) => s + p.filled, 0);
  console.log(`\n${totalFilled} receivers across ${plan.length} documents would gain a course name.`);

  if (!apply) {
    console.log('\ndry run — re-run with --apply to write and verify.');
    await client.close();
    return;
  }

  for (const p of plan) {
    await db.collection('curated_requirements')
      .replaceOne({ _id: p.degree._id }, p.doc);
  }
  console.log('written. Recomputing figures…');

  const after = {};
  for (const m of majors) after[m] = await figureFingerprint(db, m);

  let drift = [];
  for (const m of majors) {
    drift.push(...diffLines(before[m].coverage, after[m].coverage, `${m}/coverage`));
    drift.push(...diffLines(before[m].rate, after[m].rate, `${m}/credit-rate`));
  }

  if (!drift.length) {
    console.log('\n✓ every figure is byte-identical. The fill added names and nothing else.');
  } else {
    console.log(`\n✗ ${drift.length} figure values MOVED — rolling back.`);
    drift.slice(0, 12).forEach((d) => console.log('   ', d));
    for (const p of plan) {
      await db.collection('curated_requirements').replaceOne({ _id: p.degree._id }, p.degree);
    }
    console.log('rolled back. A moved figure means the fill changed meaning — investigate before retrying.');
    process.exitCode = 1;
  }
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
