#!/usr/bin/env node
/**
 * Add each campus's catalogue courses to `assist_courses`, so the Courses tab
 * shows what a university actually teaches rather than only what a community
 * college articulates to.
 *
 *   node scripts/importUcCatalogCourses.js --dry-run
 *   node scripts/importUcCatalogCourses.js
 *
 * ASSIST holds a course only when some college articulates to it, which is why
 * the Courses tab knew 292 Berkeley courses against the 15,252 in its catalogue —
 * and why almost nothing upper-division appeared. These are the same courses the
 * prerequisite capture already read; only the identity and units are copied here.
 * Prerequisites stay in `curated_prerequisites`, which is the tab that asks that
 * question.
 *
 * Two things keep these rows from disturbing anything that reads the mirror:
 *
 *   - They carry NO `parent_id`. Every analysis that resolves a university course
 *     matches on `parent_id` against ids drawn from agreements, so a row without
 *     one is invisible to them. It is also true: ASSIST has no id for a course it
 *     does not carry, and inventing one would let a catalogue course masquerade
 *     as articulable.
 *   - They carry `source: 'campus_catalog'`, so they can be told apart from the
 *     mirror and dropped again without touching upstream rows.
 *
 * A course already in ASSIST is left alone. The mirror's own record wins: it has
 * the id articulation depends on.
 */
const { MongoClient } = require('mongodb');

const flag = (name) => process.argv.includes(`--${name}`);

const CAMPUS = Object.freeze({
  79: 'UC Berkeley', 89: 'UC Davis', 120: 'UC Irvine', 117: 'UCLA', 144: 'UC Merced',
  46: 'UC Riverside', 7: 'UC San Diego', 128: 'UC Santa Barbara', 132: 'UC Santa Cruz',
});

/** "CSE 100", "CSE 0100" and "cse100" must compare equal. */
const normalizeCode = (code) => String(code || '')
  .toUpperCase().replace(/\s+/g, ' ').trim()
  .replace(/^(.*?)\s*(\d{1,4})([A-Z]{0,2})$/, (_, p, d, s) => `${p.replace(/\s+/g, ' ')} ${String(Number(d))}${s}`);

/** Split "CSE 100" into the prefix/number pair the mirror stores separately. */
function splitCode(code) {
  const m = /^(.*?)\s*(\d{1,4}[A-Z]{0,2})$/.exec(String(code).trim());
  return m ? { prefix: m[1].trim(), number: m[2] } : { prefix: String(code).trim(), number: '' };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const dryRun = flag('dry-run');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  let added = 0;
  let skipped = 0;
  for (const [id, name] of Object.entries(CAMPUS)) {
    const schoolId = Number(id);
    const catalogue = await db.collection('curated_prerequisites')
      .find({ institution_id: `uc:${schoolId}` })
      .project({ course_code: 1, course_name: 1, units: 1, source: 1 })
      .toArray();
    if (!catalogue.length) {
      console.log(`  ${name.padEnd(18)} no catalogue captured — skipped`);
      continue;
    }

    const existing = await db.collection('assist_courses')
      .find({ side: 'receiving', university_id: schoolId })
      .project({ prefix: 1, number: 1 })
      .toArray();
    const known = new Set(existing.map((c) => normalizeCode(`${c.prefix} ${c.number}`)));

    const ops = [];
    let campusAdded = 0;
    let campusSkipped = 0;
    for (const course of catalogue) {
      const code = normalizeCode(course.course_code);
      if (!code || known.has(code)) { campusSkipped += 1; continue; }
      const { prefix, number } = splitCode(course.course_code);
      if (!prefix || !number) { campusSkipped += 1; continue; }
      const units = course.units == null ? null : Number(course.units);
      const _id = `university:catalog:${schoolId}:${code}`;
      ops.push({
        replaceOne: {
          filter: { _id },
          replacement: {
            _id,
            // Deliberately no parent_id: ASSIST has no id for a course it does
            // not carry, and every articulation lookup keys on that field.
            parent_id: null,
            canonical_id: _id,
            // The mirror requires a source id, and for its own rows that is the
            // ASSIST id. A catalogue course has none, so it names the record it
            // came from instead — distinguishable at a glance from a numeric one.
            source_id: `catalog:${schoolId}:${code}`,
            institution_id: `uc:${schoolId}`,
            university_id: schoolId,
            university_type: 'UC',
            side: 'receiving',
            prefix,
            number,
            title: course.course_name || null,
            min_units: Number.isFinite(units) ? units : null,
            max_units: Number.isFinite(units) ? units : null,
            source: 'campus_catalog',
            source_url: course.source || null,
            updated_at: new Date().toISOString(),
          },
          upsert: true,
        },
      });
      campusAdded += 1;
    }

    if (!dryRun && ops.length) {
      for (let i = 0; i < ops.length; i += 500) {
        await db.collection('assist_courses').bulkWrite(ops.slice(i, i + 500));
      }
    }
    added += campusAdded;
    skipped += campusSkipped;
    console.log(`  ${name.padEnd(18)} catalogue ${String(catalogue.length).padStart(6)}`
      + `   already in ASSIST ${String(campusSkipped).padStart(5)}`
      + `   added ${String(campusAdded).padStart(6)}`);
  }

  console.log(`\n${dryRun ? '[dry run] ' : ''}${added} catalogue courses added, ${skipped} already present`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
