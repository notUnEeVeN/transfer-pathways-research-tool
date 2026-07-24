#!/usr/bin/env node
/**
 * One-off backfill of verifier attribution for work done before the app
 * recorded who verified a document.
 *
 *   AS / A.S.-T records — every verified as_degree is attributed to Roy Martinez
 *                         (all AS verification so far was his).
 *   4-year templates    — every CS template is marked verified by Tybalt Mallet
 *                         (all nine CS graduation templates were verified by
 *                         him). This sets an explicit verdict flag + attribution;
 *                         it never fabricates verification-note prose, which is
 *                         the verifier's to author.
 *
 * Re-running is safe: it sets the same values, so a second run reports the same
 * targets and changes nothing of substance. Dry-run by default; pass --apply.
 *
 *   node server/scripts/backfillVerifiers.js            # report only
 *   node server/scripts/backfillVerifiers.js --apply    # write
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AS_VERIFIER = 'Roy Martinez';
const TEMPLATE_VERIFIER = 'Tybalt Mallet';

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGO_URI || process.env.TARGET_MONGO_URI;
  if (!uri) throw new Error('MONGO_URI or TARGET_MONGO_URI is required');
  const dbName = process.env.DB_NAME || process.env.TARGET_DB_NAME || 'pmt_research';
  const now = new Date();

  const client = await MongoClient.connect(uri);
  try {
    const requirements = client.db(dbName).collection('curated_requirements');

    // ── AS / A.S.-T records: every verified record is Roy's ──────────────────
    const asMatch = { kind: 'as_degree', 'verification.verified': true };
    const asDocs = await requirements.find(asMatch, { projection: { _id: 1 } }).toArray();
    console.log(`Verified AS records → attribute to ${AS_VERIFIER}: ${asDocs.length}`);
    for (const d of asDocs.slice(0, 8)) console.log(`  · ${d._id}`);
    if (asDocs.length > 8) console.log(`  … and ${asDocs.length - 8} more`);

    // ── CS 4-year templates: verified by Tybalt (flag, not fabricated notes) ──
    // Legacy CS templates predate the major dimension and carry no major_slug.
    const csTemplateMatch = { kind: 'degree', $or: [{ major_slug: 'cs' }, { major_slug: { $exists: false } }] };
    const csTemplates = await requirements.find(csTemplateMatch,
      { projection: { _id: 1, school: 1, program: 1 } }).toArray();
    console.log(`\nCS templates → mark verified by ${TEMPLATE_VERIFIER}: ${csTemplates.length}`);
    for (const d of csTemplates) console.log(`  · ${d.school} · ${d.program}`);

    if (!apply) {
      console.log('\nDRY RUN — no writes. Re-run with --apply to write these changes.');
      return;
    }

    const asRes = await requirements.updateMany(asMatch,
      { $set: { 'verification.verified_by_label': AS_VERIFIER } });
    // Set the verdict without disturbing any existing verification_notes.
    const tplRes = await requirements.updateMany(csTemplateMatch, {
      $set: {
        'verification.verified': true,
        'verification.verified_by_label': TEMPLATE_VERIFIER,
        'verification.verified_at': now,
      },
    });
    console.log(`\nAPPLIED — AS records updated: ${asRes.modifiedCount};`
      + ` CS templates updated: ${tplRes.modifiedCount}.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
