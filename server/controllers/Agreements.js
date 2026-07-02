const { createSerializedCache } = require('../services/responseCache');
const { majorScope, scopeTag, pairClause } = require('../services/majorVisibility');

// Per-college agreements payloads are identical for every student at that
// college and change only when the offline data pipeline reloads them, yet each
// build materialises a large array (≈1k UC / ≈2k CSU docs) and serializes it —
// so a burst of students opening the same school used to stack many of those
// allocations at once and OOM the box. This cache collapses concurrent identical
// requests into ONE build (in-flight dedupe), serves repeats from a pre-
// serialized Buffer, and is byte-bounded so it can't itself leak. Tune the
// budget via AGREEMENTS_CACHE_MB.
const TTL_MS = Number(process.env.AGREEMENTS_CACHE_TTL_MS) || 10 * 60 * 1000;
const MAX_BYTES = (Number(process.env.AGREEMENTS_CACHE_MB) || 64) * 1024 * 1024;
const cache = createSerializedCache({ ttlMs: TTL_MS, maxBytes: MAX_BYTES });

// Fields the eligibility/plan UI never reads, projected off every agreement to
// shrink what the browser must JSON.parse / round-trip through IndexedDB:
//   - advisement: the top-level free-text program overview (~27% of each doc).
//     The nested *_advisement fields inside requirement_groups are KEPT.
//   - parser_output_hash / raw_template_hash / template_fp: pipeline-internal.
// Kept on purpose (all read by the major-detail modal or elsewhere in the UI):
// major, major_id (React keys + chat deep links), requirement_groups, the
// receiving school name/id (uc_school feeds attachAdmissions; both render in the
// modal header), and community_college (the sending-CC name in the modal header).
const CATALOG_PROJECTION = {
  advisement: 0,
  parser_output_hash: 0,
  raw_template_hash: 0,
  template_fp: 0,
};

// Fetch a college's agreements + the schools list in two queries and group by
// school in memory.
async function batchAgreements({ db, communityCollegeId, schoolsCollection, agreementsCollection, schoolIdField, withAdmissions = false, schoolId = null, visiblePairs = null }) {
  const ccId = Number(communityCollegeId);
  const sid = schoolId != null ? Number(schoolId) : null;
  // Demand-loading: when a school is requested, narrow the read (and the
  // grouped response) to that one school — the index seek touches ~100 docs
  // instead of the whole college's ~3,200.
  const agreementFilter = { community_college_id: ccId };
  if (sid != null) agreementFilter[schoolIdField] = sid;
  if (visiblePairs != null) Object.assign(agreementFilter, pairClause(visiblePairs, schoolIdField));
  const [schools, allAgreements] = await Promise.all([
    db.collection(schoolsCollection).find().toArray(),
    db.collection(agreementsCollection).find(agreementFilter, { projection: CATALOG_PROJECTION }).toArray(),
  ]);
  if (withAdmissions) {
    await attachAdmissions(db, allAgreements);
  }
  const bySchool = new Map();
  for (const a of allAgreements) {
    const key = a[schoolIdField];
    if (!bySchool.has(key)) bySchool.set(key, []);
    bySchool.get(key).push(a);
  }
  const schoolList = sid != null ? schools.filter((s) => s.id === sid) : schools;
  return schoolList.map((s) => ({
    school_id: s.id,
    school_name: s.name,
    agreements: bySchool.get(s.id) || [],
  }));
}

// Attach UC transfer admit-rate / GPA (from the `uc_major_admissions` collection,
// keyed by (uc_school, major)) onto each agreement doc. One batched query for all
// the majors in the response; majors with no matched data get `admissions: null`.
async function attachAdmissions(db, agreements) {
  if (!agreements.length) return;
  const majors = [...new Set(agreements.map((a) => a.major))];
  const rows = await db.collection('uc_major_admissions')
    .find({ major: { $in: majors } })
    .toArray();
  const byKey = new Map(rows.map((r) => [`${r.uc_school}|${r.major}`, r]));
  for (const a of agreements) {
    const r = byKey.get(`${a.uc_school}|${a.major}`);
    // `stats` is a list of labeled entries — usually one, but more for combined
    // majors (e.g. "Mathematics/Applied Mathematics" carries both sub-majors).
    a.admissions = r ? { year: r.year, stats: r.stats || [] } : null;
  }
}

// Optional ?school_id= narrows the response to one school (demand loading).
// Normalized to a string for the cache key, or null for the whole college.
function readSchoolId(req) {
  const raw = req.query?.school_id;
  return raw != null && String(raw) !== '' ? String(raw) : null;
}

exports.getAllUCAgreementsForCommunityCollege = async (req, res) => {
  try {
    const ccId = String(req.params.community_college_id);
    const schoolId = readSchoolId(req);
    // Partner visibility (null for admins) restricts which (school, major)
    // pairs the batch returns, and is part of the cache key so scoped and
    // unscoped payloads never cross.
    const visiblePairs = await majorScope(req);
    const buf = await cache.get(`uc:${ccId}:${schoolId ?? 'all'}:v${scopeTag(visiblePairs)}`, async () => {
      const agreements = await batchAgreements({
        db: req.app.locals.db,
        communityCollegeId: ccId,
        schoolsCollection: 'uc_schools',
        agreementsCollection: 'uc_agreements',
        schoolIdField: 'uc_school_id',
        withAdmissions: true,
        schoolId,
        visiblePairs,
      });
      return Buffer.from(JSON.stringify(agreements));
    });
    res.status(200).type('application/json').send(buf);
  } catch (err) {
    console.error('Error retrieving all UC articulation agreements:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Lightweight UC school list (id/name). The research console is UC-only.
exports.getSchools = async (req, res) => {
  try {
    const db = req.app.locals.db;
    const proj = { projection: { _id: 0, id: 1, name: 1 } };
    const uc = await db.collection('uc_schools').find({}, proj).toArray();
    res.status(200).json({ uc });
  } catch (err) {
    console.error('Error retrieving schools list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Exposed for tests (reset between cases) and for any future cache-busting on a
// data reload.
exports._cache = cache;
