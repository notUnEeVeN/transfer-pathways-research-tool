/**
 * Tasks — the team's lightweight kanban over the research work itself.
 *
 * Deliberately simple: a task is a title, a description, an assignee, a board
 * status, a self-reported progress %, and a running list of `notes` where the
 * team leaves tips on how to tackle it. Everyone-equal by design: any console
 * user may edit any task (3-person team decision); stamps record who did what.
 * Versions matter for research work, so every task carries the dataset_version
 * it was created and completed under.
 *
 * Storage (audit handle), one doc per task:
 *   tasks: { _id: 'tp-xxxxxxxx', title, description, status, order, progress,
 *            assignee_uid, assignee_label, notes[], archived,
 *            created_by, created_at, updated_by, updated_at,
 *            dataset_version_created,
 *            completed_by, completed_at, dataset_version_completed }
 *
 * `order` is a per-status sort key with gaps (…1000, 2000…) so drag-reorder
 * writes one doc, not the whole column.
 */
const crypto = require('crypto');
const { currentDatasetVersion } = require('./datasetVersion');
const { adminUids } = require('./access');
const { listDisplayNames } = require('./displayNames');

const COLLECTION = 'tasks';
const GRANTS = 'access_grants';

const STATUSES = ['backlog', 'todo', 'in_progress', 'done'];

// Bad input is the caller's fault, not the server's — the controller maps
// this (and only this) to a 400 { error }.
class ValidationError extends Error {}

const fail = (msg) => { throw new ValidationError(msg); };

// ── field validators (each throws ValidationError or returns the clean value) ──

const cleanEnum = (name, value, allowed) =>
  allowed.includes(value) ? value : fail(`${name} must be one of ${allowed.join(', ')}`);

const cleanNullableString = (name, value) => {
  if (value == null) return null;
  if (typeof value !== 'string') fail(`${name} must be a string or null`);
  return value;
};

const cleanArray = (name, value) =>
  Array.isArray(value) ? value : fail(`${name} must be an array`);

const cleanBool = (name, value) =>
  typeof value === 'boolean' ? value : fail(`${name} must be a boolean`);

// Self-reported progress: an integer percent, clamped to 0–100.
const cleanProgress = (value) => {
  if (!Number.isFinite(value)) fail('progress must be a number 0–100');
  return Math.max(0, Math.min(100, Math.round(value)));
};

// ── CRUD ──

// Everything, archived included — the collection is tiny (a team's worth of
// tasks) and the client filters/columns locally.
async function listTasks(auditDb) {
  return auditDb.collection(COLLECTION).find().sort({ order: 1 }).toArray();
}

async function createTask(auditDb, db, body = {}, uid) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) fail('title required');
  const status = body.status != null ? cleanEnum('status', body.status, STATUSES) : 'todo';

  // Append to the bottom of the destination column, leaving reorder gaps.
  const [last] = await auditDb.collection(COLLECTION)
    .find({ status }, { projection: { order: 1 } })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  const order = (Number.isFinite(last?.order) ? last.order : 0) + 1000;

  const now = new Date();
  const doc = {
    _id: `tp-${crypto.randomBytes(4).toString('hex')}`,
    title,
    description: cleanNullableString('description', body.description),
    status,
    order,
    progress: body.progress != null ? cleanProgress(body.progress) : 0,
    assignee_uid: cleanNullableString('assignee_uid', body.assignee_uid),
    assignee_label: cleanNullableString('assignee_label', body.assignee_label),
    notes: body.notes != null ? cleanArray('notes', body.notes) : [],
    archived: false,
    created_by: uid ?? null,
    created_at: now,
    updated_by: uid ?? null,
    updated_at: now,
    dataset_version_created: await currentDatasetVersion(db), // null when no snapshot yet
    completed_by: null,
    completed_at: null,
    dataset_version_completed: null,
  };
  await auditDb.collection(COLLECTION).insertOne(doc);
  return doc;
}

// Patchable fields → their validators. Anything else in the patch (stamps,
// _id, completed_*) is silently dropped — those are server-owned.
const PATCHABLE = {
  title: (v) => (typeof v === 'string' && v.trim() ? v.trim() : fail('title required')),
  description: (v) => cleanNullableString('description', v),
  status: (v) => cleanEnum('status', v, STATUSES),
  order: (v) => (Number.isFinite(v) ? v : fail('order must be a finite number')),
  progress: (v) => cleanProgress(v),
  assignee_uid: (v) => cleanNullableString('assignee_uid', v),
  assignee_label: (v) => cleanNullableString('assignee_label', v),
  notes: (v) => cleanArray('notes', v),
  archived: (v) => cleanBool('archived', v),
};

// Partial $set merge — a deviation from curation's whole-row replaceOne,
// deliberately: task edits are field-scoped (drag = order, a posted note)
// like analysisReleases' saveIds, and a replace would race two editors'
// concurrent field edits into lost updates.
async function updateTask(auditDb, db, id, patch = {}, uid) {
  const existing = await auditDb.collection(COLLECTION).findOne({ _id: id });
  if (!existing) return null;

  const $set = {};
  for (const [field, clean] of Object.entries(PATCHABLE)) {
    if (field in patch) $set[field] = clean(patch[field]);
  }
  $set.updated_by = uid ?? null;
  $set.updated_at = new Date();

  // Done-transition bookkeeping: entering 'done' stamps who/when/under-which-
  // dataset; leaving it clears all three (a reopened task hasn't been done).
  if ($set.status === 'done' && existing.status !== 'done') {
    $set.completed_by = uid ?? null;
    $set.completed_at = new Date();
    $set.dataset_version_completed = await currentDatasetVersion(db);
  } else if ($set.status != null && $set.status !== 'done' && existing.status === 'done') {
    $set.completed_by = null;
    $set.completed_at = null;
    $set.dataset_version_completed = null;
  }

  return auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: id },
    { $set },
    { returnDocument: 'after' }
  );
}

async function deleteTask(auditDb, id) {
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: id });
  return deletedCount;
}

// ── roster ──

// Who a task can be assigned to: console users — ADMIN_UIDS (env) plus the
// access_grants collection — who have an admin-set display name. Unnamed
// accounts are left off the picker so assignees always read as real names,
// never an email/token/short-UID fallback.
async function listRoster(auditDb) {
  const grants = await auditDb.collection(GRANTS).find({}, { projection: { _id: 1 } }).toArray();
  const uids = new Set([...adminUids(), ...grants.map((g) => String(g._id))]);
  const names = await listDisplayNames(auditDb);
  const rows = [...uids]
    .filter((uid) => names.has(uid))
    .map((uid) => ({ uid, label: names.get(uid) }));
  rows.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return rows;
}

// ── indexes ──

async function ensureTaskIndexes(auditDb) {
  await auditDb.collection(COLLECTION).createIndex({ status: 1, order: 1 }); // board columns
  await auditDb.collection(COLLECTION).createIndex({ assignee_uid: 1, status: 1 }); // "my tasks"
  await auditDb.collection(COLLECTION).createIndex({ updated_at: -1 }); // recent activity
}

module.exports = {
  STATUSES,
  ValidationError,
  listTasks, createTask, updateTask, deleteTask, listRoster,
  ensureTaskIndexes,
};
