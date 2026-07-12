/**
 * Tasks — the team's lightweight kanban over the research work itself.
 *
 * Tasks are typed workflows. Porting is the first type: six ordered stages,
 * weighted progress derived from completed stages, iterative stage notes, and
 * final approval by someone other than the task creator.
 * Everyone-equal by design: any console user may edit any task; immutable-ish
 * workflow log entries record who did what.
 *
 * Storage (audit handle), one doc per task:
 *   tasks: { _id: 'tp-xxxxxxxx', title, description, task_type, status, order,
 *            progress, workflow_stages{}, workflow_log[], workflow_revision,
 *            assignee_uid, assignee_label, notes[], archived,
 *            created_by, created_at, updated_by, updated_at,
 *            completed_by, completed_at }
 *
 * `order` is a per-status sort key with gaps (…1000, 2000…) so drag-reorder
 * writes one doc, not the whole column.
 */
const crypto = require('crypto');
const { adminUids } = require('./access');
const { getDisplayName, listDisplayNames } = require('./displayNames');

const COLLECTION = 'tasks';

const STATUSES = ['backlog', 'todo', 'in_progress', 'done'];
const TASK_TYPES = ['porting'];
const DEFAULT_TASK_TYPE = 'porting';

// The weights intentionally put most of the work in research and development.
// Publishing and peer approval remain explicit gates instead of disappearing
// into a vague last 5 percent.
const PORTING_STAGES = Object.freeze([
  {
    key: 'understand',
    label: 'Read & understand',
    description: 'Read the source graph and document its measure, population, encodings, and assumptions.',
    weight: 15,
  },
  {
    key: 'research',
    label: 'Research missing data',
    description: 'Identify and gather missing sources, then record coverage gaps and caveats.',
    weight: 20,
  },
  {
    key: 'data_access',
    label: 'Data & endpoints',
    description: 'Confirm the existing data access is sufficient or create the endpoint(s) the visual needs.',
    weight: 15,
  },
  {
    key: 'visualization',
    label: 'Develop visualization',
    description: 'Implement and validate the visual against the source graph and research question.',
    weight: 30,
  },
  {
    key: 'publish',
    label: 'Publish',
    description: 'Publish the finished visual and record where the team can review it.',
    weight: 10,
  },
  {
    key: 'approval',
    label: 'Team approval',
    description: 'A second teammate reviews the data and approach and approves the result.',
    weight: 10,
    requires_peer: true,
  },
]);

const WORKFLOWS = { porting: PORTING_STAGES };

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

const cleanStageNote = (value) => {
  if (typeof value !== 'string' || !value.trim()) fail('a stage note is required');
  const note = value.trim();
  if (note.length > 5000) fail('stage note must be 5000 characters or fewer');
  return note;
};

const cleanOptionalStageNote = (value) => (value == null ? null : cleanStageNote(value));

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isStageDone = (state) => Boolean(state?.completed || state?.completed_at);
const stagesFor = (taskType = DEFAULT_TASK_TYPE) => WORKFLOWS[taskType] || [];

function progressForStages(taskType, states = {}) {
  return stagesFor(taskType).reduce(
    (total, stage) => total + (isStageDone(states[stage.key]) ? stage.weight : 0),
    0
  );
}

// Completed tasks from the old free-form model stay completed. Their stage
// rows are visibly marked as migrated, rather than inventing six historical
// notes or forcing finished work back onto the board.
function legacyCompletedStages(doc) {
  const at = doc.completed_at || doc.updated_at || doc.created_at || null;
  const by = doc.completed_by || doc.updated_by || doc.created_by || null;
  return Object.fromEntries(PORTING_STAGES.map((stage) => [stage.key, {
    completed: true,
    completed_at: at,
    completed_by: by,
    completed_by_label: null,
    note: 'Completed before stage tracking was introduced.',
    migrated: true,
  }]));
}

function normalizeTask(doc) {
  if (!doc) return doc;
  const { dataset_version_created, dataset_version_completed, ...cleanDoc } = doc;
  const taskType = TASK_TYPES.includes(doc.task_type) ? doc.task_type : DEFAULT_TASK_TYPE;
  const hasWorkflow = isRecord(doc.workflow_stages);
  const workflowStages = hasWorkflow
    ? doc.workflow_stages
    : (doc.status === 'done' ? legacyCompletedStages(doc) : {});
  return {
    ...cleanDoc,
    task_type: taskType,
    workflow_stages: workflowStages,
    workflow_log: Array.isArray(doc.workflow_log) ? doc.workflow_log : [],
    workflow_revision: Number.isInteger(doc.workflow_revision) ? doc.workflow_revision : 0,
    progress: progressForStages(taskType, workflowStages),
  };
}

async function nextOrder(auditDb, status) {
  const [last] = await auditDb.collection(COLLECTION)
    .find({ status }, { projection: { order: 1 } })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  return (Number.isFinite(last?.order) ? last.order : 0) + 1000;
}

// ── CRUD ──

// Everything, archived included — the collection is tiny (a team's worth of
// tasks) and the client filters/columns locally.
async function listTasks(auditDb) {
  const docs = await auditDb.collection(COLLECTION).find().sort({ order: 1 }).toArray();
  return docs.map(normalizeTask);
}

async function createTask(auditDb, db, body = {}, uid) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) fail('title required');
  const status = body.status != null ? cleanEnum('status', body.status, STATUSES) : 'todo';
  if (status === 'done') fail('a task becomes done only after team approval');
  if ('progress' in body) fail('progress is calculated from workflow stages');
  const taskType = body.task_type != null
    ? cleanEnum('task_type', body.task_type, TASK_TYPES)
    : DEFAULT_TASK_TYPE;

  // Append to the bottom of the destination column, leaving reorder gaps.
  const order = await nextOrder(auditDb, status);

  const now = new Date();
  const creatorLabel = await getDisplayName(auditDb, uid);
  const doc = {
    _id: `tp-${crypto.randomBytes(4).toString('hex')}`,
    title,
    description: cleanNullableString('description', body.description),
    task_type: taskType,
    status,
    order,
    progress: 0,
    workflow_stages: {},
    workflow_log: [],
    workflow_revision: 0,
    assignee_uid: cleanNullableString('assignee_uid', body.assignee_uid),
    assignee_label: cleanNullableString('assignee_label', body.assignee_label),
    notes: body.notes != null ? cleanArray('notes', body.notes) : [],
    archived: false,
    created_by: uid ?? null,
    created_by_label: creatorLabel,
    created_at: now,
    updated_by: uid ?? null,
    updated_at: now,
    completed_by: null,
    completed_by_label: null,
    completed_at: null,
  };
  await auditDb.collection(COLLECTION).insertOne(doc);
  return doc;
}

// Patchable fields → their validators. Anything else in the patch (stamps,
// _id, completed_*) is silently dropped — those are server-owned.
const PATCHABLE = {
  title: (v) => (typeof v === 'string' && v.trim() ? v.trim() : fail('title required')),
  description: (v) => cleanNullableString('description', v),
  task_type: (v) => cleanEnum('task_type', v, TASK_TYPES),
  status: (v) => cleanEnum('status', v, STATUSES),
  order: (v) => (Number.isFinite(v) ? v : fail('order must be a finite number')),
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
  const normalized = normalizeTask(existing);
  if ('progress' in patch) fail('progress is calculated from workflow stages');

  const $set = {};
  for (const [field, clean] of Object.entries(PATCHABLE)) {
    if (field in patch) $set[field] = clean(patch[field]);
  }
  $set.updated_by = uid ?? null;
  $set.updated_at = new Date();

  if ($set.task_type && $set.task_type !== normalized.task_type && normalized.progress > 0) {
    fail('task_type cannot change after workflow work has started');
  }
  if ($set.status === 'done' && normalized.progress !== 100) {
    fail('complete every workflow stage, including team approval, before marking this task done');
  }
  if ($set.status && $set.status !== 'done' && existing.status === 'done' && normalized.progress === 100) {
    fail('reopen a workflow stage to move an approved task out of done');
  }

  // Done-transition bookkeeping: entering 'done' stamps who/when; leaving it
  // clears completion state (a reopened task has not been approved as done).
  if ($set.status === 'done' && existing.status !== 'done') {
    $set.completed_by = uid ?? null;
    $set.completed_by_label = await getDisplayName(auditDb, uid);
    $set.completed_at = new Date();
  } else if ($set.status != null && $set.status !== 'done' && existing.status === 'done') {
    $set.completed_by = null;
    $set.completed_by_label = null;
    $set.completed_at = null;
  }

  const updated = await auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: id },
    { $set },
    { returnDocument: 'after' }
  );
  return normalizeTask(updated);
}

function stageByKey(taskType, stageKey) {
  const workflow = stagesFor(taskType);
  const index = workflow.findIndex((stage) => stage.key === stageKey);
  if (index === -1) fail(`unknown ${taskType} stage: ${stageKey}`);
  return { workflow, stage: workflow[index], index };
}

const workflowRevisionFilter = (existing) => (
  Number.isInteger(existing.workflow_revision)
    ? { _id: existing._id, workflow_revision: existing.workflow_revision }
    : { _id: existing._id, $or: [{ workflow_revision: { $exists: false } }, { workflow_revision: null }] }
);

// Notes from an earlier completion cycle should not let a reopened stage be
// completed immediately. A reopen event also invalidates notes for every
// downstream stage it reopens.
function currentStageNotes(task, stageKey) {
  let cycleStart = -1;
  for (let index = 0; index < task.workflow_log.length; index += 1) {
    const event = task.workflow_log[index];
    if (event.action === 'reopened'
      && (event.stage === stageKey || event.affected_stages?.includes(stageKey))) {
      cycleStart = index;
    }
  }
  return task.workflow_log.slice(cycleStart + 1).filter((event) => (
    event.stage === stageKey
    && (event.action === 'noted' || event.action === 'completed')
    && typeof event.note === 'string'
    && event.note.trim()
  ));
}

async function addTaskStageNote(auditDb, id, stageKey, body = {}, uid) {
  const existing = await auditDb.collection(COLLECTION).findOne({ _id: id });
  if (!existing) return null;
  const task = normalizeTask(existing);
  stageByKey(task.task_type, stageKey);
  const note = cleanStageNote(body.note);
  const now = new Date();
  const actorLabel = await getDisplayName(auditDb, uid);
  const event = {
    _id: `tl-${crypto.randomBytes(5).toString('hex')}`,
    stage: stageKey,
    action: 'noted',
    note,
    by: uid ?? null,
    by_label: actorLabel,
    at: now,
  };
  const updated = await auditDb.collection(COLLECTION).findOneAndUpdate(
    workflowRevisionFilter(existing),
    { $set: {
      task_type: task.task_type,
      workflow_stages: task.workflow_stages,
      workflow_log: [...task.workflow_log, event],
      workflow_revision: task.workflow_revision + 1,
      progress: task.progress,
      updated_by: uid ?? null,
      updated_at: now,
    } },
    { returnDocument: 'after' }
  );
  if (!updated) fail('the workflow changed while you were editing; try again');
  return normalizeTask(updated);
}

async function completeTaskStage(auditDb, db, id, stageKey, body = {}, uid) {
  const existing = await auditDb.collection(COLLECTION).findOne({ _id: id });
  if (!existing) return null;
  const task = normalizeTask(existing);
  const { workflow, stage, index } = stageByKey(task.task_type, stageKey);
  const note = cleanOptionalStageNote(body.note);
  const savedNotes = currentStageNotes(task, stage.key);

  if (isStageDone(task.workflow_stages[stage.key])) fail(`${stage.label} is already complete`);
  const missingPrior = workflow.slice(0, index).find((prior) => !isStageDone(task.workflow_stages[prior.key]));
  if (missingPrior) fail(`complete ${missingPrior.label} first`);
  if (stage.requires_peer && uid === task.created_by) {
    fail('team approval must be completed by someone other than the task creator');
  }
  if (!note && savedNotes.length === 0) {
    fail(`add a note to ${stage.label} before completing it`);
  }
  if (stage.requires_peer && !note && !savedNotes.some((event) => event.by === uid)) {
    fail('add your review note before approving this task');
  }

  const now = new Date();
  const actorLabel = await getDisplayName(auditDb, uid);
  const eventId = `tl-${crypto.randomBytes(5).toString('hex')}`;
  const latestNote = note || savedNotes.at(-1)?.note;
  const workflowStages = {
    ...task.workflow_stages,
    [stage.key]: {
      completed: true,
      completed_at: now,
      completed_by: uid ?? null,
      completed_by_label: actorLabel,
      note: latestNote,
      event_id: eventId,
    },
  };
  const progress = progressForStages(task.task_type, workflowStages);
  const final = progress === 100;
  const status = final ? 'done' : 'in_progress';
  const event = {
    _id: eventId,
    stage: stage.key,
    action: 'completed',
    by: uid ?? null,
    by_label: actorLabel,
    at: now,
  };
  if (note) event.note = note;
  const $set = {
    task_type: task.task_type,
    workflow_stages: workflowStages,
    workflow_log: [...task.workflow_log, event],
    workflow_revision: task.workflow_revision + 1,
    progress,
    status,
    updated_by: uid ?? null,
    updated_at: now,
  };
  if (status !== existing.status) $set.order = await nextOrder(auditDb, status);
  if (final) {
    $set.completed_by = uid ?? null;
    $set.completed_by_label = actorLabel;
    $set.completed_at = now;
  } else if (existing.status === 'done') {
    $set.completed_by = null;
    $set.completed_by_label = null;
    $set.completed_at = null;
  }

  const updated = await auditDb.collection(COLLECTION).findOneAndUpdate(
    workflowRevisionFilter(existing),
    { $set },
    { returnDocument: 'after' }
  );
  if (!updated) fail('the workflow changed while you were editing; try again');
  return normalizeTask(updated);
}

async function reopenTaskStage(auditDb, id, stageKey, body = {}, uid) {
  const existing = await auditDb.collection(COLLECTION).findOne({ _id: id });
  if (!existing) return null;
  const task = normalizeTask(existing);
  const { workflow, stage, index } = stageByKey(task.task_type, stageKey);
  const note = cleanStageNote(body.note);
  if (!isStageDone(task.workflow_stages[stage.key])) fail(`${stage.label} is not complete`);

  const workflowStages = { ...task.workflow_stages };
  const affectedStages = [];
  for (const affected of workflow.slice(index)) {
    if (isStageDone(workflowStages[affected.key])) affectedStages.push(affected.key);
    delete workflowStages[affected.key];
  }
  const now = new Date();
  const actorLabel = await getDisplayName(auditDb, uid);
  const event = {
    _id: `tl-${crypto.randomBytes(5).toString('hex')}`,
    stage: stage.key,
    action: 'reopened',
    affected_stages: affectedStages,
    note,
    by: uid ?? null,
    by_label: actorLabel,
    at: now,
  };
  const progress = progressForStages(task.task_type, workflowStages);
  const $set = {
    task_type: task.task_type,
    workflow_stages: workflowStages,
    workflow_log: [...task.workflow_log, event],
    workflow_revision: task.workflow_revision + 1,
    progress,
    status: 'in_progress',
    completed_by: null,
    completed_by_label: null,
    completed_at: null,
    updated_by: uid ?? null,
    updated_at: now,
  };
  if (existing.status !== 'in_progress') $set.order = await nextOrder(auditDb, 'in_progress');

  const updated = await auditDb.collection(COLLECTION).findOneAndUpdate(
    workflowRevisionFilter(existing),
    { $set },
    { returnDocument: 'after' }
  );
  if (!updated) fail('the workflow changed while you were editing; try again');
  return normalizeTask(updated);
}

async function deleteTask(auditDb, id) {
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: id });
  return deletedCount;
}

// ── roster ──

// Who a task can be assigned to: console users — ADMIN_UIDS (env) plus the
// granted team members — who have an admin-set display name. Unnamed
// accounts are left off the picker so assignees always read as real names,
// never an email/token/short-UID fallback.
async function listRoster(auditDb) {
  const grants = await auditDb.collection('team_members')
    .find({ access_status: 'granted' }, { projection: { _id: 1 } }).toArray();
  const uids = new Set([...adminUids(), ...grants.map((g) => String(g._id))]);
  const names = await listDisplayNames(auditDb);
  const rows = [...uids]
    .filter((uid) => names.has(uid))
    .map((uid) => ({ uid, label: names.get(uid) }));
  rows.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return rows;
}

// ── indexes ──

async function migrateLegacyTasks(auditDb) {
  const legacy = await auditDb.collection(COLLECTION).find({
    $or: [
      { task_type: { $exists: false } },
      { workflow_stages: { $exists: false } },
      { workflow_log: { $exists: false } },
      { workflow_revision: { $exists: false } },
      { dataset_version_created: { $exists: true } },
      { dataset_version_completed: { $exists: true } },
    ],
  }).toArray();
  if (!legacy.length) return 0;

  const operations = legacy.map((doc) => {
    const normalized = normalizeTask(doc);
    return {
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            task_type: normalized.task_type,
            workflow_stages: normalized.workflow_stages,
            workflow_log: normalized.workflow_log,
            workflow_revision: normalized.workflow_revision,
            progress: normalized.progress,
          },
          $unset: { dataset_version_created: '', dataset_version_completed: '' },
        },
      },
    };
  });
  const result = await auditDb.collection(COLLECTION).bulkWrite(operations, { ordered: false });
  return result.modifiedCount;
}

async function ensureTaskIndexes(auditDb) {
  await migrateLegacyTasks(auditDb);
  await auditDb.collection(COLLECTION).createIndex({ status: 1, order: 1 }); // board columns
  await auditDb.collection(COLLECTION).createIndex({ assignee_uid: 1, status: 1 }); // "my tasks"
  await auditDb.collection(COLLECTION).createIndex({ updated_at: -1 }); // recent activity
  await auditDb.collection(COLLECTION).createIndex({ task_type: 1, status: 1 }); // typed workflow views
}

module.exports = {
  STATUSES, TASK_TYPES, PORTING_STAGES,
  ValidationError,
  normalizeTask, progressForStages,
  listTasks, createTask, updateTask, addTaskStageNote, completeTaskStage, reopenTaskStage,
  deleteTask, listRoster,
  migrateLegacyTasks, ensureTaskIndexes,
};
