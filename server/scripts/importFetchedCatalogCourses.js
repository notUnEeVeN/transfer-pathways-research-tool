#!/usr/bin/env node
/**
 * Import catalogue courses that our degree requirements name but our catalogue
 * lacked, so those requirement blocks can be filled with real courses.
 *
 * Source: the year-pinned 2025-26 fetch in
 * `scripts/ma/../../data/fetched-catalog-courses.json` (produced by the
 * uc-missing-catalog-courses workflow), where every record was independently
 * re-checked by a second agent instructed to refute it. Only records that were
 * found, survived that check, and carry a unit value are imported.
 *
 * These rows are AI-gathered, not hand-verified: each is stamped
 * `source: 'catalog-fetch-2025-26'` and `verification.verified: false` so they
 * are never mistaken for curated data. Page-level citations travel with them.
 *
 *   node scripts/importFetchedCatalogCourses.js            # report
 *   node scripts/importFetchedCatalogCourses.js --apply
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const CAMPUS_ID = {
  'UC San Diego': 7, 'UC Riverside': 46, 'UC Berkeley': 79, 'UC Davis': 89,
  UCLA: 117, 'UC Irvine': 120, 'UC Santa Barbara': 128, 'UC Santa Cruz': 132,
  'UC Merced': 144,
};

const normalizeCode = (code) => String(code || '').toUpperCase().replace(/\s+/g, ' ').trim();

function loadCourses(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const find = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) { const hit = find(item); if (hit) return hit; }
      return null;
    }
    if (node && typeof node === 'object') {
      if (Array.isArray(node.courses) && node.courses.some((c) => c && c.code)) return node.courses;
      for (const value of Object.values(node)) { const hit = find(value); if (hit) return hit; }
    }
    return null;
  };
  return find(raw) || [];
}

async function main() {
  const apply = process.argv.includes('--apply');
  const file = path.resolve(__dirname, '../data/fetched-catalog-courses.json');
  const courses = loadCourses(file);

  const usable = courses.filter((c) => c.found && c.refuted === false && c.units != null);
  const rejected = courses.filter((c) => !(c.found && c.refuted === false && c.units != null));

  const docs = [];
  for (const c of usable) {
    const schoolId = CAMPUS_ID[c.campus];
    if (!schoolId) continue;
    const code = normalizeCode(c.code);
    docs.push({
      _id: `uc:${schoolId}:${code}`,
      course_id: `uc:${schoolId}:${code}`,
      institution_id: `uc:${schoolId}`,
      side: 'receiving',
      course_code: code,
      course_name: c.title || null,
      units: Number(c.units),
      parent_id: null,
      prerequisite_groups: [],
      prerequisite_ids: [],
      requisite_text: '',
      unresolved_prerequisites: [],
      university_id: schoolId,
      // The collection's validator admits resolved / needs_review /
      // legacy_unresolved. These rows carry no prerequisites yet, so they are
      // explicitly awaiting that pass rather than claiming to be complete.
      status: 'needs_review',
      source: c.source_url || 'campus catalogue 2025-26',
      source_format: 'catalog-fetch-2025-26',
      catalog_year: c.catalog_year || null,
      catalog_note: c.note || null,
      // AI-gathered. Verification is a human step and is never self-asserted.
      verification: { verified: false, verified_by: null, verified_at: null, notes: null },
      updated_at: new Date().toISOString(),
    });
  }

  const byCampus = {};
  for (const d of docs) { byCampus[d.institution_id] = (byCampus[d.institution_id] || 0) + 1; }
  console.log(`fetched ${courses.length} | usable ${usable.length} | importable ${docs.length}`);
  Object.entries(byCampus).sort().forEach(([k, n]) => console.log('  ', String(n).padStart(3), k));
  console.log('\nnot imported:');
  rejected.forEach((c) => console.log(`   ${String(c.campus).slice(0, 17).padEnd(18)} ${String(c.code).padEnd(11)} ${c.found === false ? 'does not exist in 2025-26' : 'failed verification'}`));

  if (!apply) { console.log('\ndry run — re-run with --apply.'); return; }

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const collection = db.collection('curated_prerequisites');
  let inserted = 0; let skipped = 0;
  for (const doc of docs) {
    const existing = await collection.findOne({ _id: doc._id });
    if (existing) { skipped += 1; continue; }
    await collection.insertOne(doc);
    inserted += 1;
  }
  console.log(`\ninserted ${inserted}, already present ${skipped}`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
