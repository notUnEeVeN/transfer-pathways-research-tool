/**
 * Admin-set display names, so the console shows a real name instead of the
 * inconsistent email / short-UID / token-label fallback for each account.
 *
 * Storage (audit handle): display_names { _id: uid, name, updated_by, updated_at }.
 * A set name wins everywhere author labels are resolved (task assignees, figure
 * authors) — see figures.resolveAuthorLabel, which checks getDisplayName first.
 */
const COLLECTION = 'display_names';

// The name for one uid, or null. Short read; callers already hit the DB.
async function getDisplayName(auditDb, uid) {
  if (!uid) return null;
  const doc = await auditDb.collection(COLLECTION).findOne({ _id: String(uid) }, { projection: { name: 1 } });
  const name = doc?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

// uid -> name for every account that has one set.
async function listDisplayNames(auditDb) {
  const docs = await auditDb.collection(COLLECTION).find({}, { projection: { name: 1 } }).toArray();
  return new Map(docs.filter((d) => d.name).map((d) => [String(d._id), d.name]));
}

// Set (or, with a blank name, clear) the display name for a uid.
async function setDisplayName(auditDb, uid, name, by) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!clean) {
    await auditDb.collection(COLLECTION).deleteOne({ _id: String(uid) });
    return null;
  }
  await auditDb.collection(COLLECTION).updateOne(
    { _id: String(uid) },
    { $set: { name: clean, updated_by: by ?? null, updated_at: new Date() } },
    { upsert: true }
  );
  return clean;
}

module.exports = { getDisplayName, listDisplayNames, setDisplayName };
