#!/usr/bin/env node
/**
 * Import the Maryland ARTSYS corpus into the canonical `artsys_*` collections.
 *
 * One ARTSYS Program Transfer Guide rendered for one sending college is one
 * agreement — the same primitive as an ASSIST agreement, keyed on
 * (sending college x receiving university x program). The output documents are
 * shaped so `services/analysis/eligibility.js` runs over them unmodified.
 *
 * Isolation. The Maryland corpus lives in its own collections and its own id
 * namespace (`md:cc:`, `md:uni:`, `md:crs:`, `md:agr:`). Nothing here writes to
 * `assist_*`, so the California figures cannot be perturbed by an import, and a
 * combined export can never collide two states on the same small integer id.
 *
 * Validation is structural, not sampled. A guide's *receiving* skeleton is
 * invariant across senders — only the sending side changes — so every guide is
 * parsed 16 times and the skeletons must agree. That checks the parser against
 * the whole corpus without anyone reading a document. Guides that disagree, or
 * whose group headers match no known rule, are reported and (by default) not
 * written.
 *
 * Usage:
 *   node scripts/importArtsys.js --dry-run --limit 20
 *   node scripts/importArtsys.js --apply
 *   node scripts/importArtsys.js --apply --refresh          # new term vintage
 *   node scripts/importArtsys.js --dry-run --guides 3354,3480
 */
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

const { ArtsysClient, discoverGuideIds } = require('../services/artsys/fetch');
const { parseGuide, receivingSkeleton, parseSenders } = require('../services/artsys/parseGuide');
const { transformGuide } = require('../services/artsys/transform');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COLLECTIONS = Object.freeze({
  institutions: 'artsys_institutions',
  courses: 'artsys_courses',
  agreements: 'artsys_agreements',
  meta: 'artsys_import_meta',
});

const INDEXES = Object.freeze({
  [COLLECTIONS.institutions]: [
    [{ kind: 1, name: 1 }, {}],
    [{ artsys_id: 1, kind: 1 }, { unique: true }],
  ],
  [COLLECTIONS.courses]: [
    [{ institution_id: 1, prefix: 1, number: 1 }, {}],
    [{ side: 1 }, {}],
    [{ artsys_course_id: 1 }, { sparse: true }],
  ],
  [COLLECTIONS.agreements]: [
    [{ college_id: 1, university_id: 1, major: 1 }, { unique: true }],
    [{ guide_id: 1, college_id: 1 }, { unique: true }],
    [{ university_id: 1, major: 1 }, {}],
  ],
  [COLLECTIONS.meta]: [],
});

const VALIDATORS = Object.freeze({
  [COLLECTIONS.institutions]: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'institution_id', 'artsys_id', 'kind', 'name', 'source'],
      properties: {
        kind: { enum: ['community_college', 'university'] },
        source: { enum: ['artsys'] },
      },
    },
  },
  [COLLECTIONS.courses]: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'institution_id', 'side', 'code', 'source'],
      properties: {
        side: { enum: ['sending', 'receiving'] },
        source: { enum: ['artsys'] },
      },
    },
  },
  [COLLECTIONS.agreements]: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'college_id', 'university_id', 'major', 'requirement_groups', 'source'],
      properties: { source: { enum: ['artsys'] } },
    },
  },
});

function parseArgs(argv) {
  const args = new Set(argv);
  const value = (flag, fallback = null) => {
    const index = argv.indexOf(flag);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  return {
    apply: args.has('--apply'),
    refresh: args.has('--refresh'),
    strict: !args.has('--allow-mismatch'),
    limit: Number(value('--limit', 0)) || 0,
    guides: (value('--guides', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
    concurrency: Number(value('--concurrency', 4)) || 4,
    delayMs: Number(value('--delay', 350)) || 350,
    cacheDir: value('--cache-dir', path.resolve(__dirname, '../.artsys-cache')),
    report: value('--report', null),
    // Explicit target, beating every env var. scripts/.env sets
    // TARGET_MONGO_URI to Atlas, and that name takes precedence over MONGO_URI
    // below — so exporting MONGO_URI=localhost does NOT redirect this job, it
    // silently still writes to Atlas. `--uri`/`--db` are the only way to state
    // the destination unambiguously, which is what `artsys:import:local` uses.
    uri: value('--uri', null),
    dbName: value('--db', null),
  };
}

async function replaceAtomically(db, name, docs) {
  const staged = `__next_${name}`;
  await db.collection(staged).drop().catch(() => {});
  await db.createCollection(staged, VALIDATORS[name]
    ? { validator: VALIDATORS[name], validationLevel: 'strict' }
    : {});
  for (let i = 0; i < docs.length; i += 1000) {
    await db.collection(staged).insertMany(docs.slice(i, i + 1000), { ordered: false });
  }
  for (const [keys, options] of INDEXES[name] || []) {
    await db.collection(staged).createIndex(keys, options);
  }
  const inserted = await db.collection(staged).countDocuments();
  if (inserted !== docs.length) {
    throw new Error(`${name}: staged ${inserted}, expected ${docs.length}`);
  }
  await db.collection(staged).rename(name, { dropTarget: true });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const client = new ArtsysClient({
    cacheDir: opts.cacheDir,
    delayMs: opts.delayMs,
    concurrency: opts.concurrency,
    refresh: opts.refresh,
  });

  const log = (...parts) => console.error(...parts);

  log('discovering guides…');
  let guideIds;
  if (opts.guides.length) {
    guideIds = new Map(opts.guides.map((id) => [Number(id), null]));
  } else {
    guideIds = await discoverGuideIds(client);
  }
  let ids = [...guideIds.keys()];
  if (opts.limit) ids = ids.slice(0, opts.limit);
  log(`  ${ids.length} guides`);

  const agreements = new Map();
  const courses = new Map();
  const institutions = new Map();
  const problems = [];
  const skeletonMismatches = [];
  const unmatchedHeaders = [];
  const countMismatches = [];
  const emptyGuides = [];
  let rendered = 0;

  await client.mapLimit(ids, async (guideId, index) => {
    if (index && index % 25 === 0) {
      log(`  …${index}/${ids.length} guides (cache ${client.stats.hits}h/${client.stats.misses}m)`);
    }
    const root = await client.get(`/program_transfer_guides/${guideId}`);
    if (!root) { problems.push(`guide ${guideId}: root fetch failed`); return; }
    const senders = parseSenders(require('cheerio').load(root));
    if (!senders.length) { problems.push(`guide ${guideId}: no senders`); return; }

    const skeletons = new Map();
    for (const sender of senders) {
      const html = await client.get(
        `/program_transfer_guides/${guideId}?sender_university_id=${sender.artsys_id}`
      );
      if (!html) { problems.push(`guide ${guideId} sender ${sender.artsys_id}: fetch failed`); continue; }
      const parsed = parseGuide(html, { guideId });
      // parseGuide reads the selected sender off the page; if ARTSYS ignored
      // the parameter we would silently import 16 copies of one college.
      if (!parsed.sender || parsed.sender.artsys_id !== sender.artsys_id) {
        problems.push(`guide ${guideId}: requested sender ${sender.artsys_id}, page rendered ${parsed.sender?.artsys_id ?? 'none'}`);
        continue;
      }
      rendered += 1;
      if (!parsed.stats.receivers) { emptyGuides.push(`${guideId}:${sender.artsys_id}`); continue; }
      if (parsed.stats.unmatched_header) {
        unmatchedHeaders.push(`${guideId}:${sender.artsys_id} (${parsed.stats.unmatched_header})`);
      }
      for (const m of parsed.count_mismatches || []) {
        countMismatches.push({ guide_id: guideId, sender: sender.artsys_id, ...m });
      }

      const skeleton = receivingSkeleton(parsed);
      const bucket = skeletons.get(skeleton) || [];
      bucket.push(sender.artsys_id);
      skeletons.set(skeleton, bucket);

      const out = transformGuide(parsed);
      if (out.problems.length) problems.push(`guide ${guideId}:${sender.artsys_id} ${out.problems.join('; ')}`);
      if (!out.agreement) continue;
      agreements.set(out.agreement._id, out.agreement);
      for (const c of out.courses) {
        const prior = courses.get(c._id);
        courses.set(c._id, prior ? { ...prior, ...c, title: c.title ?? prior.title, units: c.units ?? prior.units } : c);
      }
      for (const i of out.institutions) institutions.set(i._id, i);
    }

    // The free validator: one guide, one receiving skeleton.
    if (skeletons.size > 1) {
      skeletonMismatches.push({
        guide_id: guideId,
        variants: [...skeletons.values()].map((senderIds) => senderIds.length),
      });
    }
  });

  const report = {
    mode: opts.apply ? 'apply' : 'dry-run',
    guides: ids.length,
    renderings_parsed: rendered,
    agreements: agreements.size,
    courses: courses.size,
    sending_courses: [...courses.values()].filter((c) => c.side === 'sending').length,
    receiving_courses: [...courses.values()].filter((c) => c.side === 'receiving').length,
    institutions: institutions.size,
    colleges: [...institutions.values()].filter((i) => i.kind === 'community_college').length,
    universities: [...institutions.values()].filter((i) => i.kind === 'university').length,
    receivers: [...agreements.values()].reduce((n, a) => n + a.requirement_groups
      .reduce((m, g) => m + g.sections.reduce((k, s) => k + s.receivers.length, 0), 0), 0),
    not_articulated: [...agreements.values()].reduce((n, a) => n + a.requirement_groups
      .reduce((m, g) => m + g.sections.reduce((k, s) => k
        + s.receivers.filter((r) => r.articulation_status === 'not_articulated').length, 0), 0), 0),
    validation: {
      skeleton_mismatches: skeletonMismatches.length,
      unmatched_headers: unmatchedHeaders.length,
      // A group whose header states a course count the branch tree cannot
      // supply. Caught the nested-branch double-count; keep it at zero.
      count_mismatches: countMismatches.length,
      empty_renderings: emptyGuides.length,
      problems: problems.length,
    },
    http: client.stats,
    samples: {
      skeleton_mismatches: skeletonMismatches.slice(0, 10),
      unmatched_headers: unmatchedHeaders.slice(0, 10),
      count_mismatches: countMismatches.slice(0, 10),
      problems: problems.slice(0, 10),
    },
  };

  if (opts.report) fs.writeFileSync(opts.report, JSON.stringify(report, null, 2));

  const blocking = opts.strict && skeletonMismatches.length > 0;
  if (blocking) {
    report.refused = 'skeleton mismatches present; rerun with --allow-mismatch to import anyway';
  }

  if (opts.apply && !blocking) {
    const uri = opts.uri || process.env.TARGET_MONGO_URI || process.env.MONGO_URI;
    const dbName = opts.dbName || process.env.TARGET_DB_NAME || process.env.DB_NAME || 'pmt_research';
    if (!uri) throw new Error('--uri, TARGET_MONGO_URI or MONGO_URI is required');
    // The destination is never implicit: an import that lands on the wrong
    // cluster is invisible until someone goes looking for the collections.
    log(`writing to ${uri.replace(/\/\/[^@]*@/, '//<redacted>@')} · db ${dbName}`);
    const mongo = new MongoClient(uri);
    try {
      await mongo.connect();
      const db = mongo.db(dbName);
      await replaceAtomically(db, COLLECTIONS.institutions, [...institutions.values()]);
      await replaceAtomically(db, COLLECTIONS.courses, [...courses.values()]);
      await replaceAtomically(db, COLLECTIONS.agreements, [...agreements.values()]);
      await db.collection(COLLECTIONS.meta).replaceOne(
        { _id: 'current' },
        { _id: 'current', imported_at: new Date(), ...report },
        { upsert: true }
      );
      report.database = dbName;
    } finally {
      await mongo.close();
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (blocking) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { COLLECTIONS, INDEXES, VALIDATORS, replaceAtomically, parseArgs };
