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
 * affected collections to ./as-degree-backup-<n>.json first. Re-running after
 * a successful apply is a no-op.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const { LEGACY_TYPE_TO_SLOT, asDegreeRowId } = require('../config/asDegreeSlots');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAJOR = 'cs';
const PREFIX = 'as_degree:';

/**
 * Pure: what the apply pass would do. `degrees` carries the full rewritten
 * document so the caller inserts exactly what was reviewed in the dry run.
 */
function planMigration(docs, templates) {
  const degrees = [];
  let alreadyMigrated = 0;
  for (const doc of docs) {
    if (doc.major_slug) { alreadyMigrated += 1; continue; }
    const slot = LEGACY_TYPE_TO_SLOT[doc.degree_type];
    if (!slot) throw new Error(`unrecognised degree_type: ${doc.degree_type} (${doc._id})`);
    const legacyId = asDegreeRowId(doc.community_college_id, MAJOR, slot);
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
  const templateUpdates = templates
    .filter((t) => !t.major_slug || LEGACY_TYPE_TO_SLOT[t.degree_type] !== t.degree_type)
    .map((t) => {
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

    const backup = path.resolve(process.cwd(), `as-degree-backup-${docs.length}.json`);
    fs.writeFileSync(backup, JSON.stringify({ docs, templates }, null, 2));
    console.log(`\nBacked up ${docs.length + templates.length} rows to ${backup}`);

    for (const d of plan.degrees) {
      await col.insertOne(d.doc);
      await col.deleteOne({ _id: d.from });
    }
    for (const t of plan.templates) {
      await col.updateOne({ _id: t._id },
        { $set: { degree_type: t.degree_type, major_slug: t.major_slug } });
    }
    console.log('Applied.');
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { planMigration };
