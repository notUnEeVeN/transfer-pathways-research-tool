/**
 * In-app dataset refresh — the server-side counterpart of scripts/port.py.
 *
 * Re-ports every major currently in the research cluster from the SOURCE
 * database (where the parser writes), replacing the agreements wholesale and
 * re-deriving the referenced catalogs. Used after parser fixes: the rebuild
 * regenerates agreement _ids, so replaced docs orphan any existing audit
 * verdicts on them — correct after a parser change (those verdicts judged the
 * old parser output), and the changelog records the operation.
 *
 * Env-gated: SOURCE_MONGO_URI (+ SOURCE_DB_NAME, default pmt_data) must be
 * configured on the server. That's fine while the server runs on the admin's
 * machine; on a hosted deployment leave it unset and the feature reports
 * itself unavailable (use scripts/port.py locally instead) — the partner-
 * facing box then never holds source credentials.
 *
 * One refresh at a time; progress/result exposed for the Admin panel to poll.
 */
const { MongoClient } = require('mongodb');
const auditCache = require('./auditCache');

const AGREEMENTS = 'uc_agreements';
const FULL_COPY = ['community_colleges', 'uc_schools'];

const job = {
  running: false,
  startedAt: null,
  finishedAt: null,
  step: null,
  result: null,
  error: null,
};

function sourceConfigured(env = process.env) {
  return Boolean(env.SOURCE_MONGO_URI);
}

function jobStatus() {
  return { configured: sourceConfigured(), ...job };
}

// Mirrors scripts/port.py referenced_ids: course_ids + university parent_ids
// referenced by a set of agreements. Ids are kept RAW (no stringifying) —
// the 2026-07 parser update made course ids numeric, and a stringified $in
// silently matches nothing against numeric catalog keys.
function collectRefs(doc, courseIds, parentIds) {
  for (const group of doc.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const recv of section.receivers || []) {
        const receiving = recv.receiving || {};
        if (receiving.kind === 'course') parentIds.add(receiving.parent_id);
        else if (receiving.kind === 'series') (receiving.parent_ids || []).forEach((p) => parentIds.add(p));
        for (const opt of recv.options || []) {
          (opt.course_ids || []).forEach((id) => { if (id != null) courseIds.add(id); });
        }
      }
    }
  }
}

async function upsertById(coll, docs) {
  if (!docs.length) return 0;
  const ops = docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } }));
  for (let i = 0; i < ops.length; i += 1000) {
    await coll.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  }
  return docs.length;
}

// Mirrors port.py bump_version: YYYY-MM-DD-vN over dataset_changelog.
async function bumpVersion(db, action, detail, counts) {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = `${today}-v`;
  const seen = await db.collection('dataset_changelog').distinct('dataset_version');
  const ns = seen
    .filter((v) => typeof v === 'string' && v.startsWith(prefix))
    .map((v) => parseInt(v.slice(prefix.length), 10))
    .filter(Number.isFinite);
  const version = `${prefix}${ns.length ? Math.max(...ns) + 1 : 1}`;
  const now = new Date();
  const majors = await db.collection(AGREEMENTS).distinct('major');
  const meta = {
    dataset_version: version,
    updated_at: now,
    majors: { uc_agreements: majors.sort() },
    counts: Object.fromEntries(await Promise.all(
      [AGREEMENTS, 'courses', 'university_courses', 'uc_major_admissions'].map(
        async (c) => [c, await db.collection(c).estimatedDocumentCount()]
      )
    )),
  };
  await db.collection('dataset_meta').replaceOne({ _id: 'current' }, { _id: 'current', ...meta }, { upsert: true });
  await db.collection('dataset_changelog').insertOne({ dataset_version: version, at: now, action, detail, counts });
  return version;
}

async function runRefresh(db) {
  const client = new MongoClient(process.env.SOURCE_MONGO_URI);
  try {
    const source = client.db(process.env.SOURCE_DB_NAME || 'pmt_data');

    job.step = 'reading current majors';
    const currentMajors = await db.collection(AGREEMENTS).distinct('major');
    if (!currentMajors.length) throw new Error('nothing ported yet — nothing to refresh');

    job.step = 'fetching agreements from source';
    const sourceDocs = await source.collection(AGREEMENTS)
      .find({ major: { $in: currentMajors } }).toArray();
    const sourceMajors = new Set(sourceDocs.map((d) => d.major));
    const missing = currentMajors.filter((m) => !sourceMajors.has(m));

    job.step = 'replacing agreements';
    const before = await db.collection(AGREEMENTS).estimatedDocumentCount();
    await db.collection(AGREEMENTS).deleteMany({});
    if (sourceDocs.length) await db.collection(AGREEMENTS).insertMany(sourceDocs, { ordered: false });

    job.step = 'refreshing institutions';
    for (const coll of FULL_COPY) {
      await upsertById(db.collection(coll), await source.collection(coll).find().toArray());
    }
    await db.collection('uc_major_admissions').deleteMany({});
    const admissions = await source.collection('uc_major_admissions')
      .find({ major: { $in: currentMajors } }).toArray();
    if (admissions.length) await db.collection('uc_major_admissions').insertMany(admissions, { ordered: false });

    job.step = 'rebuilding referenced catalogs';
    const courseIds = new Set();
    const parentIds = new Set();
    for (const doc of sourceDocs) collectRefs(doc, courseIds, parentIds);
    parentIds.delete(null);
    if (!courseIds.size) {
      // A refresh that references zero CC courses means the option shape
      // changed under us — pruning everything would gut the catalogs, so bail.
      throw new Error('no CC course references found in the refreshed agreements — aborting before pruning catalogs');
    }
    const nCourses = await upsertById(
      db.collection('courses'),
      await source.collection('courses').find({ course_id: { $in: [...courseIds] } }).toArray()
    );
    const nUniCourses = await upsertById(
      db.collection('university_courses'),
      await source.collection('university_courses').find({ parent_id: { $in: [...parentIds] } }).toArray()
    );
    const prunedCourses = (await db.collection('courses')
      .deleteMany({ course_id: { $nin: [...courseIds] } })).deletedCount;
    const prunedUni = (await db.collection('university_courses')
      .deleteMany({ parent_id: { $nin: [...parentIds] } })).deletedCount;

    job.step = 'bumping dataset version';
    const counts = {
      agreements_before: before,
      agreements_after: sourceDocs.length,
      majors_refreshed: sourceMajors.size,
      majors_missing_in_source: missing,
      courses_upserted: nCourses,
      courses_pruned: prunedCourses,
      university_courses_upserted: nUniCourses,
      university_courses_pruned: prunedUni,
    };
    const version = await bumpVersion(db, 'refresh', 'in-app refresh from source', counts);

    // Server-side caches hold pre-refresh reads; drop them now rather than
    // waiting out their TTLs.
    auditCache.clear();
    try { require('../controllers/Agreements')._cache.clear(); } catch { /* not loaded yet */ }

    return { dataset_version: version, ...counts };
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * Kick off a refresh (returns immediately; poll jobStatus()). Throws if one
 * is already running or the source isn't configured.
 */
function startRefresh(db) {
  if (!sourceConfigured()) {
    const e = new Error('SOURCE_MONGO_URI is not configured on this server — run scripts/port.py locally instead');
    e.code = 'UNCONFIGURED';
    throw e;
  }
  if (job.running) {
    const e = new Error('a refresh is already running');
    e.code = 'BUSY';
    throw e;
  }
  job.running = true;
  job.startedAt = new Date();
  job.finishedAt = null;
  job.step = 'starting';
  job.result = null;
  job.error = null;
  runRefresh(db)
    .then((result) => { job.result = result; })
    .catch((err) => {
      console.error('porter.refresh:', err);
      job.error = err.message;
    })
    .finally(() => {
      job.running = false;
      job.finishedAt = new Date();
      job.step = null;
    });
  return jobStatus();
}

module.exports = { startRefresh, jobStatus, sourceConfigured, _runRefresh: runRefresh };
