#!/usr/bin/env node
/**
 * Store the CC prerequisite-capture results (the per-college campaign files)
 * in `cc_prereq_capture` — verbatim, one row per (college, course).
 *
 * This is the CAPTURE layer only. Tybalt's rules for what becomes an edge:
 *   - ENFORCED prerequisites only. Advisories/recommended prep are stored
 *     (`advisory_text`) but never modelled as requirements.
 *   - Verbatim text, parsed downstream and repeatably — the same convention as
 *     the UC catalogue (`requisite_text` + offline parse).
 *
 * Integration into the prerequisite projection (concept assignment, as done
 * for cs/bio) is the next phase and reads FROM this collection, so a parser or
 * concept-vocabulary change never requires re-fetching a college.
 *
 *   node scripts/importCcPrereqCapture.js --dir <results-dir>          # report
 *   node scripts/importCcPrereqCapture.js --dir <results-dir> --apply
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const slugify = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalizeCode = (code) => String(code || '').toUpperCase().replace(/\s+/g, ' ').trim();

async function main() {
  const dir = arg('dir');
  const apply = process.argv.includes('--apply');
  if (!dir || !fs.existsSync(dir)) throw new Error(`--dir missing or not found: ${dir}`);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const docs = [];
  const summary = [];
  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const college = payload.college || file.replace(/\.json$/, '');
    const slug = slugify(college);
    let found = 0; let withPrereq = 0; let withAdvisory = 0;
    for (const course of payload.courses || []) {
      const code = normalizeCode(course.code);
      if (!code) continue;
      if (course.found !== false) found += 1;
      if (String(course.prereq_text || '').trim()) withPrereq += 1;
      if (String(course.advisory_text || '').trim()) withAdvisory += 1;
      docs.push({
        _id: `ccpr:${slug}:${code}`,
        college,
        college_slug: slug,
        course_code: code,
        title: course.title || null,
        units: Number.isFinite(Number(course.units)) ? Number(course.units) : null,
        // Enforced prerequisites — the only text that may ever become edges.
        prereq_text: String(course.prereq_text || '').trim(),
        // Stored, never modelled as a requirement (Tybalt's ruling).
        advisory_text: String(course.advisory_text || '').trim(),
        coreq_text: String(course.coreq_text || '').trim(),
        enrollment_limitation_text: String(course.enrollment_limitation_text || course.limitation_text || '').trim(),
        current_code: course.current_code ? normalizeCode(course.current_code) : null,
        // A CCN renumbering carries the catalog's own successor record when the
        // source states it ("formerly BIOL 308") — join on this, never on
        // inferred numbering (the honors-econ mapping SWAPS 1H/2H).
        successor: course.successor || null,
        note: course.note || null,
        found: course.found !== false,
        source_url: course.source_url || null,
        platform_notes: payload.platform_notes || null,
        captured_at: new Date().toISOString(),
        capture_wave: arg('wave', 'wave-1'),
      });
    }
    summary.push({ college, total: (payload.courses || []).length, found, withPrereq, withAdvisory });
  }

  console.log('college'.padEnd(34), 'courses', 'found', 'prereq', 'advisory');
  for (const s of summary) {
    console.log(s.college.slice(0, 33).padEnd(34), String(s.total).padStart(7),
      String(s.found).padStart(5), String(s.withPrereq).padStart(6), String(s.withAdvisory).padStart(8));
  }
  console.log(`\ntotal rows: ${docs.length}`);

  if (!apply) { console.log('dry run — re-run with --apply.'); return; }
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const collection = client.db(process.env.DB_NAME).collection('cc_prereq_capture');
  let upserted = 0;
  for (const doc of docs) {
    // capture_wave marks when a row FIRST arrived; a later re-import of the
    // shared results directory must not relabel earlier waves.
    const { capture_wave, ...rest } = doc;
    await collection.updateOne({ _id: doc._id },
      { $set: rest, $setOnInsert: { capture_wave } }, { upsert: true });
    upserted += 1;
  }
  console.log(`upserted ${upserted} rows into cc_prereq_capture`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
