#!/usr/bin/env node
/**
 * Move as_degree rows onto major-scoped ids and major-neutral slots.
 *
 *   110:ast              -> 110:cs:ast
 *   110:local_cs_as      -> 110:cs:local_as
 *   110:local_computing  -> 110:cs:local_other
 *
 * Every existing row is Computer Science, so the major is a constant here.
 * Because _id encodes the row id, a rewrite is an insert of the new document
 * followed by a delete of the old one — not an update.
 *
 * Default is a read-only plan. `--apply` writes, and always dumps the two
 * affected collections to ./as-degree-backup-<timestamp>.json first — a fresh
 * file per run, never overwriting an earlier one. Re-running after a successful
 * apply plans no degree rewrites and no template updates, so it is a no-op
 * against the database (it still writes a new backup file).
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const {
  LEGACY_TYPE_TO_SLOT,
  asDegreeRowId,
  parseAsDegreeRowId,
} = require('../config/asDegreeSlots');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAJOR = 'cs';
const PREFIX = 'as_degree:';

/**
 * The college a row belongs to, agreed on by all three places that record it.
 * Curated research data moved to the wrong college is worse than a failed run,
 * so a disagreement stops the migration before anything is written.
 */
function resolveCollegeId(doc) {
  const rawLegacy = String(doc.legacy_id ?? '');
  const fromLegacy = Number(rawLegacy.split(':')[0]);
  const fromDoc = Number(doc.community_college_id);
  const rawCollege = String(doc.college_id ?? '');
  const collegeMatch = /^cc:(\d+)$/.exec(rawCollege);
  const fromCollege = collegeMatch ? Number(collegeMatch[1]) : NaN;
  if (!Number.isFinite(fromDoc)) {
    throw new Error(`community_college_id is not a number: ${doc.community_college_id} (${doc._id})`);
  }
  if (!Number.isFinite(fromLegacy) || fromLegacy !== fromDoc || fromCollege !== fromDoc) {
    throw new Error(
      `college id disagreement on ${doc._id}: legacy_id=${doc.legacy_id} `
      + `community_college_id=${doc.community_college_id} college_id=${doc.college_id}`,
    );
  }
  return fromDoc;
}

/**
 * Pure: what the apply pass would do. `degrees` carries the full rewritten
 * document so the caller inserts exactly what was reviewed in the dry run.
 *
 * A row counts as migrated when its legacy_id already parses as a three-segment
 * id — major_slug alone would let a row with a stale two-segment id slip past.
 */
function planMigration(docs, templates) {
  const degrees = [];
  let alreadyMigrated = 0;
  for (const doc of docs) {
    if (parseAsDegreeRowId(doc.legacy_id)) { alreadyMigrated += 1; continue; }
    const collegeId = resolveCollegeId(doc);
    const slot = LEGACY_TYPE_TO_SLOT[doc.degree_type];
    if (!slot) throw new Error(`unrecognised degree_type: ${doc.degree_type} (${doc._id})`);
    const legacyId = asDegreeRowId(collegeId, MAJOR, slot);
    degrees.push({
      from: doc._id,
      to: `${PREFIX}${legacyId}`,
      doc: {
        ...doc,
        _id: `${PREFIX}${legacyId}`,
        legacy_id: legacyId,
        degree_type: slot,
        major_slug: MAJOR,
      },
    });
  }
  // major_slug is the migrated signal here too, so a second apply touches nothing.
  const templateUpdates = templates
    .filter((t) => !t.major_slug)
    .map((t) => {
      // A template without a degree_type is legal (validateAsDegreeTemplate never
      // requires one); it only needs the major stamped on it.
      if (t.degree_type === undefined || t.degree_type === null || t.degree_type === '') {
        return { _id: t._id, major_slug: MAJOR };
      }
      const slot = LEGACY_TYPE_TO_SLOT[t.degree_type];
      if (!slot) throw new Error(`unrecognised template degree_type: ${t.degree_type} (${t._id})`);
      return { _id: t._id, degree_type: slot, major_slug: MAJOR };
    });
  return { degrees, templates: templateUpdates, alreadyMigrated };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'pmt_research';
  if (!uri) throw new Error('MONGO_URI is required');
  const client = await MongoClient.connect(uri);
  try {
    const col = client.db(dbName).collection('curated_requirements');
    const docs = await col.find({ kind: 'as_degree' }).toArray();
    const templates = await col.find({ kind: 'as_degree_template' }).toArray();
    const plan = planMigration(docs, templates);

    console.log(`as_degree rows: ${docs.length} (${plan.alreadyMigrated} already migrated)`);
    console.log(`to rewrite: ${plan.degrees.length}, templates to touch: ${plan.templates.length}`);
    for (const d of plan.degrees) console.log(`  ${d.from}  ->  ${d.to}`);
    if (!apply) return console.log('\nDry run. Re-run with --apply to write.');

    // Unique per run, and `wx` so a re-run can never write a partially migrated
    // state over the backup that holds the pristine rows.
    const stamp = new Date(Date.now()).toISOString().replace(/[:.]/g, '-');
    const backup = path.resolve(process.cwd(), `as-degree-backup-${stamp}.json`);
    fs.writeFileSync(backup, JSON.stringify({ docs, templates }, null, 2), { flag: 'wx' });
    console.log(`\nBacked up ${docs.length + templates.length} rows to ${backup}`);

    for (const d of plan.degrees) {
      await col.insertOne(d.doc);
      await col.deleteOne({ _id: d.from });
    }
    for (const t of plan.templates) {
      const { _id, ...fields } = t;
      await col.updateOne({ _id }, { $set: fields });
    }
    console.log('Applied.');
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { planMigration };
