/**
 * Admin-set display names, so the console shows a real name instead of the
 * inconsistent email / short-UID / token-label fallback for each account.
 *
 * Storage (audit handle): team_members.display_name.
 * A set name wins everywhere author labels are resolved (task assignees, figure
 * authors) — see figures.resolveAuthorLabel, which checks getDisplayName first.
 */
const { setMemberDisplayName } = require('./teamMembers');

// The name for one uid, or null. Short read; callers already hit the DB.
async function getDisplayName(auditDb, uid) {
  if (!uid) return null;
  const doc = await auditDb.collection('team_members').findOne(
    { _id: String(uid) }, { projection: { display_name: 1 } }
  );
  const name = doc?.display_name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

// uid -> name for every account that has one set.
async function listDisplayNames(auditDb) {
  const docs = await auditDb.collection('team_members')
    .find({ display_name: { $type: 'string', $ne: '' } }, { projection: { display_name: 1 } }).toArray();
  return new Map(docs
    .map((doc) => [String(doc._id), doc.display_name])
    .filter(([, name]) => name));
}

// Set (or, with a blank name, clear) the display name for a uid.
async function setDisplayName(auditDb, uid, name, by) {
  return setMemberDisplayName(auditDb, uid, name, by);
}

module.exports = { getDisplayName, listDisplayNames, setDisplayName };
