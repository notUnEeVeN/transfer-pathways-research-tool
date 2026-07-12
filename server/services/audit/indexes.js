// Index management for the app-written `agreement_reviews` collection.
//
// Every audit read path (stats, bootstrap, tier-lists, next, per-school)
// filters by `system` plus either `doc_id` (point lookups / template joins) or
// `result` (verdict-class tallies). Without these, each read full-scans the
// collection.

const { AUDIT_RESULTS } = require('./filters');

// Receives the AUDIT handle (auditDb) — agreement_reviews lives there, which is the
// main db unless AUDIT_MONGO_URI selects a shared cluster.
async function ensureAuditIndexes(auditDb) {
  if (!auditDb) return;
  await auditDb.collection(AUDIT_RESULTS).createIndexes([
    { key: { system: 1, doc_id: 1 }, name: 'audit_system_doc' },
    { key: { system: 1, result: 1 }, name: 'audit_system_result' },
  ]);
}

module.exports = { ensureAuditIndexes };
