// Custom groupings CRUD.
//
// Groupings are named sets of (system, school_id, major) tuples. Once active,
// they replace the legacy scope/schoolIds/majorContains filter — see
// parseFilter. CRUD is intentionally minimal: create, list, get, rename,
// delete. To change membership, delete and recreate. These are full Express
// handlers (controllers/Audit.js re-exports them so routes stay unchanged).

const { ObjectId } = require('mongodb');
const cache = require('../auditCache');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { AUDIT_GROUPINGS, SYSTEM_BY_KEY } = require('./filters');

// Lazy index init — runs once per process. The unique name index uses a
// case-insensitive collation so "CS at UCs" and "cs at ucs" collide.
let _groupingIndexesP = null;
function _ensureGroupingIndexes(auditDb) {
  if (!_groupingIndexesP) {
    const coll = auditDb.collection(AUDIT_GROUPINGS);
    _groupingIndexesP = Promise.all([
      coll.createIndex({ name: 1 }, {
        unique: true,
        collation: { locale: 'en', strength: 2 },
      }),
      coll.createIndex({ updated_at: -1 }),
    ]).catch((err) => {
      // Reset so a later request can retry — likely a transient connection
      // issue if it happened at all.
      _groupingIndexesP = null;
      throw err;
    });
  }
  return _groupingIndexesP;
}

function _validateMembers(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'members must be a non-empty array' };
  const dedupe = new Map();
  for (const m of raw) {
    if (!m || typeof m !== 'object') return { error: 'each member must be an object' };
    const system = String(m.system || '').trim();
    if (!SYSTEM_BY_KEY.has(system)) return { error: `unknown system: ${system}` };
    const school_id = Number(m.school_id);
    if (!Number.isFinite(school_id) || school_id <= 0) return { error: 'school_id must be a positive number' };
    // ASSIST publishes some majors with significant whitespace (e.g. UC
    // Merced's "COMPUTER SCIENCE AND ENGINEERING, B.S. " carries a trailing
    // space). The major name has to be stored byte-exact so the Mongo $eq
    // filter matches. Trim ONLY to validate non-empty; preserve the
    // original string verbatim for storage.
    const major = String(m.major ?? '');
    if (!major.trim()) return { error: 'major is required' };
    const key = `${system}|${school_id}|${major}`;
    if (!dedupe.has(key)) dedupe.set(key, { system, school_id, major });
  }
  return { members: [...dedupe.values()] };
}

const listGroupings = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  await _ensureGroupingIndexes(auditDb);
  const rows = await auditDb.collection(AUDIT_GROUPINGS).find(
    {},
    { projection: { name: 1, member_count: 1, updated_at: 1, created_at: 1 } }
  ).sort({ updated_at: -1 }).toArray();
  res.json(rows.map((r) => ({
    _id: String(r._id),
    name: r.name,
    member_count: r.member_count ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at,
  })));
});

const getGrouping = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  let oid;
  try { oid = new ObjectId(req.params.id); }
  catch { return res.status(400).json({ error: 'invalid id' }); }
  const doc = await auditDb.collection(AUDIT_GROUPINGS).findOne({ _id: oid });
  if (!doc) return res.status(404).json({ error: 'not found' });

  // Enrich every member with `doc_count` (how many agreements actually
  // match the pair) and `school_name` (denormalized for display). A pair
  // returning doc_count=0 means the stored major string doesn't appear in
  // the agreements collection — usually a subtle whitespace/casing diff
  // between what the picker showed and what got stored. Surfacing this
  // turns silent drops (e.g. trailing-space major names) into a visible
  // signal the auditor can act on.
  const members = doc.members || [];
  const countByKey = new Map();
  const nameByKey = new Map();
  const bySystem = new Map();
  for (const m of members) {
    if (!bySystem.has(m.system)) bySystem.set(m.system, []);
    bySystem.get(m.system).push(m);
  }
  for (const [sysKey, ms] of bySystem) {
    const s = SYSTEM_BY_KEY.get(sysKey);
    if (!s) continue;
    const orClause = ms.map((m) => ({ [s.idField]: m.school_id, major: m.major }));
    const rows = await db.collection(s.coll).aggregate([
      { $match: { $or: orClause } },
      { $group: {
        _id: { school_id: `$${s.idField}`, major: '$major' },
        n: { $sum: 1 },
        school_name: { $first: `$${s.nameField}` },
      } },
    ]).toArray();
    for (const r of rows) {
      const k = `${sysKey}|${r._id.school_id}|${r._id.major}`;
      countByKey.set(k, r.n);
      nameByKey.set(k, r.school_name);
    }
    // Schools that match no docs at all (e.g. typo in school_id) still
    // need a name resolution — fetch any one doc per school_id.
    const unresolved = [...new Set(ms.map((m) => m.school_id))]
      .filter((id) => !ms.some((m) => nameByKey.has(`${sysKey}|${id}|${m.major}`)));
    if (unresolved.length) {
      const sRows = await db.collection(s.coll).aggregate([
        { $match: { [s.idField]: { $in: unresolved } } },
        { $group: { _id: `$${s.idField}`, name: { $first: `$${s.nameField}` } } },
      ]).toArray();
      for (const r of sRows) {
        for (const m of ms) {
          if (m.school_id === r._id) {
            const k = `${sysKey}|${m.school_id}|${m.major}`;
            if (!nameByKey.has(k)) nameByKey.set(k, r.name);
          }
        }
      }
    }
  }

  const enrichedMembers = members.map((m) => {
    const k = `${m.system}|${m.school_id}|${m.major}`;
    return {
      system: m.system,
      school_id: m.school_id,
      school_name: nameByKey.get(k) || null,
      major: m.major,
      doc_count: countByKey.get(k) || 0,
    };
  });

  res.json({
    _id: String(doc._id),
    name: doc.name,
    members: enrichedMembers,
    member_count: doc.member_count ?? enrichedMembers.length,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  });
});

const createGrouping = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  await _ensureGroupingIndexes(auditDb);
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (name.length > 100) return res.status(400).json({ error: 'name must be ≤ 100 chars' });
  const v = _validateMembers(req.body?.members);
  if (v.error) return res.status(400).json({ error: v.error });

  const now = new Date();
  const doc = {
    name,
    members: v.members,
    member_count: v.members.length,
    created_at: now,
    updated_at: now,
  };
  try {
    const r = await auditDb.collection(AUDIT_GROUPINGS).insertOne(doc);
    cache.clear();
    res.json({
      _id: String(r.insertedId),
      name: doc.name,
      members: doc.members,
      member_count: doc.member_count,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ error: 'a grouping with this name already exists' });
    }
    throw e;
  }
});

const renameGrouping = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  let oid;
  try { oid = new ObjectId(req.params.id); }
  catch { return res.status(400).json({ error: 'invalid id' }); }
  // PATCH explicitly rejects membership edits — change-via-delete-recreate
  // is the documented workflow (see the design spec).
  if (req.body?.members !== undefined) {
    return res.status(400).json({ error: 'editing members is not supported; delete and recreate' });
  }
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (name.length > 100) return res.status(400).json({ error: 'name must be ≤ 100 chars' });
  try {
    const r = await auditDb.collection(AUDIT_GROUPINGS).findOneAndUpdate(
      { _id: oid },
      { $set: { name, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    const doc = r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    cache.clear();
    res.json({
      _id: String(doc._id),
      name: doc.name,
      members: doc.members || [],
      member_count: doc.member_count ?? (doc.members || []).length,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ error: 'a grouping with this name already exists' });
    }
    throw e;
  }
});

const deleteGrouping = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  let oid;
  try { oid = new ObjectId(req.params.id); }
  catch { return res.status(400).json({ error: 'invalid id' }); }
  const r = await auditDb.collection(AUDIT_GROUPINGS).deleteOne({ _id: oid });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'not found' });
  cache.clear();
  res.json({ ok: true });
});

module.exports = {
  listGroupings,
  getGrouping,
  createGrouping,
  renameGrouping,
  deleteGrouping,
};
