#!/usr/bin/env node
/**
 * Align section tiers with their group's university-only marking.
 *
 *   node scripts/repairDegreeSectionTiers.js           # dry run
 *   node scripts/repairDegreeSectionTiers.js --apply
 *
 * Berkeley MCB's rebuild left fifteen sections stamped `tier: 'transferable'`
 * under groups marked `tier: 'nontransferable'` / `course_level:
 * 'upper_division'` / `cc_articulable: false`, and Economics one more. Readers
 * that resolved `section.tier || group.tier` let the section win, which
 * reported every one of those upper-division units as lower division. The
 * group's word is final — degreeSlots.resolveSectionTier — and this makes the
 * stored documents say the same thing, so no reader depends on knowing the
 * contradiction existed. Each applied edit is logged to `curated_revisions`
 * in the same shape the console writes.
 */
const { resolveSectionTier } = require('../services/degreeSlots');
const { diffDocs } = require('../services/docDiff');

async function repairDegreeSectionTiers(db, { apply = false } = {}) {
  const docs = await db.collection('curated_requirements')
    .find({ kind: 'degree' }).toArray();
  const changed = [];

  for (const doc of docs) {
    const before = JSON.parse(JSON.stringify(doc));
    let sections = 0;
    for (const group of doc.requirement_groups || []) {
      for (const section of group.sections || []) {
        const resolved = resolveSectionTier(group, section);
        if (section.tier != null && section.tier !== resolved) {
          section.tier = resolved;
          sections += 1;
        }
      }
    }
    if (!sections) continue;
    changed.push({ doc_id: String(doc._id), sections });
    if (!apply) continue;

    const updatedAt = new Date();
    await db.collection('curated_requirements').updateOne(
      { _id: doc._id },
      { $set: { requirement_groups: doc.requirement_groups, updated_at: updatedAt } },
    );
    await db.collection('curated_revisions').insertOne({
      doc_id: String(doc._id),
      kind: 'degree',
      at: updatedAt,
      by_uid: null,
      by_label: 'scripts/repairDegreeSectionTiers.js',
      created: false,
      verified: !!doc.verification?.verified,
      changes: diffDocs(before, { ...doc, updated_at: updatedAt }),
    });
  }
  return { examined: docs.length, changed };
}

async function main() {
  /* eslint-disable global-require */
  require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
  const { MongoClient } = require('mongodb');
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    const report = await repairDegreeSectionTiers(client.db(process.env.DB_NAME), { apply });
    console.log(`${report.examined} degree documents examined`);
    for (const row of report.changed) {
      console.log(`  ${row.doc_id}: ${row.sections} section tier(s) ${apply ? 'aligned' : 'would be aligned'}`);
    }
    if (!report.changed.length) console.log('  every section tier already agrees with its group');
    if (!apply && report.changed.length) console.log('\nRe-run with --apply to write.');
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { repairDegreeSectionTiers };
