#!/usr/bin/env node
/**
 * Second pass over the ARTSYS corpus: sending-course units, catalog text, and
 * prerequisite prose.
 *
 * The guide page carries reliable RECEIVING units but renders the sending side
 * as a bare label, so `artsys_courses.units` is null for sending courses after
 * `importArtsys.js`. Both live one level down, on the equivalency detail modal
 * the guide already links to. Every option imported in pass one stores its
 * `artsys_equivalency_id` precisely so this pass has something to walk.
 *
 * Why this is a separate, bounded job rather than part of the import: the
 * equivalency set is far larger than the guide set (7,140 distinct ids in the
 * first 6.6% of the corpus) and it is someone else's public server. The job is
 * therefore resumable by construction — it shares the import's on-disk cache,
 * skips ids already enriched, and takes `--limit` so it can be run in slices
 * over several sittings without ever refetching a page.
 *
 * What it deliberately does NOT do: resolve prerequisite prose into course ids
 * or decide what a rule means. Extracted rows land in `artsys_prerequisites`
 * with `status: 'needs_review'` and the raw text preserved, mirroring how the
 * California corpus treats scraped prerequisite evidence. Turning "a grade of C
 * or better in CMSC 140 or consent of department" into a graph edge is curation,
 * and generating it automatically would put unreviewed guesses in the same
 * shape as hand-verified work.
 *
 * Usage:
 *   node scripts/enrichArtsys.js --limit 500          # dry run, first slice
 *   node scripts/enrichArtsys.js --limit 500 --apply  # write it
 *   node scripts/enrichArtsys.js --apply              # everything remaining
 */
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

const { ArtsysClient } = require('../services/artsys/fetch');
const { parseEquivalencyModal } = require('../services/artsys/parseEquivalency');
const { parseGuide } = require('../services/artsys/parseGuide');
const { transformGuide } = require('../services/artsys/transform');
const { courseId, normalizeCode, SOURCE, STATE } = require('../services/artsys/ids');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COLLECTIONS = Object.freeze({
  courses: 'artsys_courses',
  agreements: 'artsys_agreements',
  prerequisites: 'artsys_prerequisites',
});

function parseArgs(argv) {
  const args = new Set(argv);
  const value = (flag, fallback = null) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    apply: args.has('--apply'),
    limit: Number(value('--limit', 0)) || 0,
    concurrency: Number(value('--concurrency', 4)) || 4,
    delayMs: Number(value('--delay', 300)) || 300,
    cacheDir: value('--cache-dir', path.resolve(__dirname, '../.artsys-cache')),
    fromCache: args.has('--from-cache'),
  };
}

/**
 * The work list: every (equivalency id, sending institution) pair the corpus
 * references. Read from Mongo when the import has been applied, otherwise
 * rebuilt from the cached guide pages so this can run before any write.
 */
function workListFromCache(cacheDir) {
  const jobs = new Map();
  for (const file of fs.readdirSync(cacheDir)) {
    const html = fs.readFileSync(path.join(cacheDir, file), 'utf8');
    if (!html.includes('ptg-requirement-container')) continue;
    const parsed = parseGuide(html, { guideId: 0 });
    if (!parsed.sender || !parsed.stats.receivers) continue;
    const { agreement } = transformGuide(parsed);
    if (!agreement) continue;
    for (const group of agreement.requirement_groups) {
      for (const section of group.sections) {
        for (const receiver of section.receivers) {
          for (const option of receiver.options) {
            if (option.artsys_equivalency_id == null) continue;
            jobs.set(option.artsys_equivalency_id, {
              equivalency_id: option.artsys_equivalency_id,
              college_id: agreement.college_id,
              university_id: agreement.university_id,
            });
          }
        }
      }
    }
  }
  return [...jobs.values()];
}

async function workListFromDb(db) {
  const jobs = new Map();
  const cursor = db.collection(COLLECTIONS.agreements).find(
    {},
    { projection: { college_id: 1, university_id: 1, 'requirement_groups.sections.receivers.options': 1 } }
  );
  for await (const agreement of cursor) {
    for (const group of agreement.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          for (const option of receiver.options || []) {
            if (option.artsys_equivalency_id == null) continue;
            jobs.set(option.artsys_equivalency_id, {
              equivalency_id: option.artsys_equivalency_id,
              college_id: agreement.college_id,
              university_id: agreement.university_id,
            });
          }
        }
      }
    }
  }
  return [...jobs.values()];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const client = new ArtsysClient({
    cacheDir: opts.cacheDir,
    delayMs: opts.delayMs,
    concurrency: opts.concurrency,
  });
  const log = (...parts) => console.error(...parts);

  const uri = process.env.TARGET_MONGO_URI || process.env.MONGO_URI;
  const dbName = process.env.TARGET_DB_NAME || process.env.DB_NAME || 'pmt_research';
  let mongo = null;
  let db = null;
  if (opts.apply || !opts.fromCache) {
    if (uri) {
      mongo = new MongoClient(uri);
      try {
        await mongo.connect();
        db = mongo.db(dbName);
        const count = await db.collection(COLLECTIONS.agreements).estimatedDocumentCount();
        if (!count) { await mongo.close(); mongo = null; db = null; }
      } catch {
        mongo = null; db = null;
      }
    }
  }

  log('building work list…');
  let jobs = db ? await workListFromDb(db) : workListFromCache(opts.cacheDir);
  log(`  ${jobs.length} distinct equivalencies referenced (source: ${db ? 'mongo' : 'cache'})`);

  // Resumability: anything already on disk is free, so ordering puts uncached
  // work last and `--limit` slices deterministically.
  const cached = (job) => client.readCache(
    `https://artsys.usmd.edu/equivalencies/${job.equivalency_id}?modal=true`
  ) != null;
  jobs.sort((a, b) => Number(cached(b)) - Number(cached(a)) || a.equivalency_id - b.equivalency_id);
  if (opts.limit) jobs = jobs.slice(0, opts.limit);

  const courseUpdates = new Map();
  const optionUpdates = [];
  const prerequisites = new Map();
  let parsed = 0;
  let failed = 0;

  await client.mapLimit(jobs, async (job, index) => {
    if (index && index % 250 === 0) {
      log(`  …${index}/${jobs.length} (cache ${client.stats.hits}h/${client.stats.misses}m)`);
    }
    const html = await client.get(`/equivalencies/${job.equivalency_id}?modal=true`);
    if (!html) { failed += 1; return; }
    let detail;
    try { detail = parseEquivalencyModal(html); } catch { failed += 1; return; }
    parsed += 1;

    optionUpdates.push({
      equivalency_id: job.equivalency_id,
      awarded_min_units: detail.awarded_min_units,
      awarded_max_units: detail.awarded_max_units,
      effective: detail.effective,
      min_grade: detail.min_grade || null,
      restricted_to_major: detail.restricted_to_major === 'N/A' ? null : detail.restricted_to_major,
    });

    const record = (institutionKey, side, course) => {
      if (!course.code) return;
      const id = courseId({ institutionId: institutionKey, code: course.code });
      const prior = courseUpdates.get(id) || {};
      courseUpdates.set(id, {
        _id: id,
        institution_id: institutionKey,
        side,
        units: course.units ?? prior.units ?? null,
        min_units: course.units ?? prior.min_units ?? null,
        max_units: course.units ?? prior.max_units ?? null,
        title: course.title ?? prior.title ?? null,
        description: course.description ?? prior.description ?? null,
        enriched_at: new Date(),
      });
      if (course.prerequisite_text || course.corequisite_text) {
        prerequisites.set(id, {
          _id: id,
          source: SOURCE,
          state: STATE,
          course_id: id,
          institution_id: institutionKey,
          course_code: course.code,
          course_name: course.title ?? null,
          units: course.units ?? null,
          prerequisite_text: course.prerequisite_text ?? null,
          corequisite_text: course.corequisite_text ?? null,
          // Codes as written in the catalog. NOT resolved to course ids: which
          // of several same-code courses is meant, and whether "or consent of
          // department" defeats the rule, are curation decisions.
          mentioned_codes: course.mentioned_codes ?? [],
          prerequisite_ids: [],
          unresolved_prerequisites: course.mentioned_codes ?? [],
          status: 'needs_review',
          extracted_at: new Date(),
        });
      }
    };

    for (const course of detail.sending) record(job.college_id, 'sending', course);
    for (const course of detail.receiving) record(job.university_id, 'receiving', course);
  });

  const all = [...courseUpdates.values()];
  const withUnits = all.filter((c) => c.units != null).length;
  // Catalog description coverage is a property of the sending college's data,
  // not of this parser: some colleges populate ARTSYS descriptions and some
  // ship an empty <p>. Prerequisite yield tracks it exactly, so report both —
  // otherwise a low prerequisite count reads as a bug.
  const withDescription = all.filter((c) => c.description).length;
  const byInstitution = {};
  for (const c of all) {
    const bucket = byInstitution[c.institution_id] || (byInstitution[c.institution_id] = { courses: 0, described: 0 });
    bucket.courses += 1;
    if (c.description) bucket.described += 1;
  }
  const report = {
    mode: opts.apply ? 'apply' : 'dry-run',
    equivalencies_attempted: jobs.length,
    parsed,
    failed,
    courses_touched: courseUpdates.size,
    courses_with_units: withUnits,
    courses_with_description: withDescription,
    description_coverage_by_institution: byInstitution,
    option_details: optionUpdates.length,
    prerequisites_extracted: prerequisites.size,
    http: client.stats,
    sample_prerequisite: [...prerequisites.values()][0] ?? null,
  };

  if (opts.apply) {
    if (!db) throw new Error('TARGET_MONGO_URI or MONGO_URI is required, and artsys_agreements must exist');
    const courseOps = [...courseUpdates.values()].map((c) => ({
      updateOne: {
        filter: { _id: c._id },
        // Never create a course here: pass one owns the course set, and an
        // insert would mean an equivalency referenced something no guide lists.
        update: { $set: {
          units: c.units, min_units: c.min_units, max_units: c.max_units,
          title: c.title, description: c.description, enriched_at: c.enriched_at,
        } },
        upsert: false,
      },
    }));
    for (let i = 0; i < courseOps.length; i += 1000) {
      if (courseOps.length) await db.collection(COLLECTIONS.courses).bulkWrite(courseOps.slice(i, i + 1000), { ordered: false });
    }
    const preOps = [...prerequisites.values()].map((p) => ({
      replaceOne: { filter: { _id: p._id }, replacement: p, upsert: true },
    }));
    for (let i = 0; i < preOps.length; i += 1000) {
      if (preOps.length) await db.collection(COLLECTIONS.prerequisites).bulkWrite(preOps.slice(i, i + 1000), { ordered: false });
    }
    await db.collection(COLLECTIONS.prerequisites).createIndex({ institution_id: 1, status: 1 });
    report.matched_courses = courseOps.length;
    report.database = dbName;
  }

  if (mongo) await mongo.close();
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { COLLECTIONS, parseArgs, workListFromCache };
