#!/usr/bin/env node
/**
 * Import the UCLA catalogue fetch into `curated_prerequisites`.
 *
 * UCLA is the one campus with essentially no catalogue rows (13, against
 * 871–15,257 everywhere else). The background fetch writes one JSON file per
 * subject group under the session scratchpad's `ucla-catalog/`; this script
 * folds every file in that directory into catalogue rows:
 *
 *   - `requisite_text` is stored VERBATIM — parsing is a separate, repeatable
 *     offline step (`scripts/parseRequisiteText.js`), so a parser improvement
 *     never requires re-fetching.
 *   - Rows are stamped `verification.verified: false` and
 *     `status: 'needs_review'`: AI-gathered, awaiting human review, exactly
 *     like the 45-course fetch before it.
 *   - Existing rows are never overwritten. Idempotent.
 *
 *   node scripts/importUclaCatalog.js --dir <path>          # report
 *   node scripts/importUclaCatalog.js --dir <path> --apply
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const SCHOOL_ID = 117;
const normalizeCode = (code) => String(code || '').toUpperCase().replace(/\s+/g, ' ').trim();

async function main() {
  const dir = arg('dir');
  const apply = process.argv.includes('--apply');
  if (!dir || !fs.existsSync(dir)) throw new Error(`--dir missing or not found: ${dir}`);

  // The directory holds both catalog editions plus raw API dumps. Selection is
  // by the payload's own stated edition — never by filename — so the alternate
  // year can sit beside the primary without any risk of mixing editions (the
  // STAT 131 lesson: one edition ahead changes real prerequisites).
  const wantYear = arg('year', '2025');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !/raw/i.test(f));
  const docs = new Map();
  let skippedNotFound = 0;
  const skippedFiles = [];
  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!String(payload.catalog_year || '').includes(wantYear)) {
      skippedFiles.push(`${file} (edition ${payload.catalog_year || 'unstated'})`);
      continue;
    }
    for (const course of payload.courses || []) {
      if (course.found === false) { skippedNotFound += 1; continue; }
      const code = normalizeCode(course.code);
      if (!code || docs.has(code)) continue;
      docs.set(code, {
        _id: `uc:${SCHOOL_ID}:${code}`,
        course_id: `uc:${SCHOOL_ID}:${code}`,
        institution_id: `uc:${SCHOOL_ID}`,
        university_id: SCHOOL_ID,
        side: 'receiving',
        course_code: code,
        course_name: course.title || null,
        units: Number.isFinite(Number(course.units)) ? Number(course.units) : null,
        parent_id: null,
        prerequisite_groups: [],
        prerequisite_ids: [],
        requisite_text: String(course.requisite_text || '').trim(),
        unresolved_prerequisites: [],
        status: 'needs_review',
        source: course.source_url || 'catalog.registrar.ucla.edu',
        source_format: `ucla-catalog-fetch (${payload.catalog_year || 'edition unstated'})`,
        catalog_year: payload.catalog_year || null,
        verification: { verified: false, verified_by: null, verified_at: null, notes: null },
        updated_at: new Date().toISOString(),
      });
    }
  }

  const withText = [...docs.values()].filter((d) => d.requisite_text).length;
  const withUnits = [...docs.values()].filter((d) => d.units != null).length;
  if (skippedFiles.length) console.log('skipped (wrong edition):', skippedFiles.join(', '));
  console.log(`files read: ${files.length - skippedFiles.length} | courses: ${docs.size} | with requisite text: ${withText} | with units: ${withUnits} | found:false skipped: ${skippedNotFound}`);

  if (!apply) { console.log('dry run — re-run with --apply.'); return; }
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const collection = client.db(process.env.DB_NAME).collection('curated_prerequisites');
  let inserted = 0; let existing = 0;
  for (const doc of docs.values()) {
    if (await collection.findOne({ _id: doc._id })) { existing += 1; continue; }
    await collection.insertOne(doc);
    inserted += 1;
  }
  console.log(`inserted ${inserted}, already present ${existing}`);
  console.log('next: node scripts/parseRequisiteText.js --apply   (parses the stored text into edges)');
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
