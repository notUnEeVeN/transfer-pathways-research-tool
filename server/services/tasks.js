/**
 * Tasks — the team's lightweight kanban over the research work itself.
 *
 * Tasks are typed workflows. Porting: seven ordered, code-defined stages,
 * weighted progress, iterative stage notes, and final approval by someone
 * other than the task creator. Data verification (checklist-shaped):
 * user-authored items stored on the doc, completable in any order, no peer
 * gate — same stage engine, notes, and audit log throughout.
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
const TASK_TYPES = ['porting', 'data_verification', 'audit_fix'];
const DEFAULT_TASK_TYPE = 'porting';

// Checklist-shaped types: the workflow points live on the doc as
// `checklist_items`, completable in any order, with no peer gate.
// 'data_verification' items are user-authored; 'audit_fix' items are
// machine-appended by audit verdicts (one standing task accumulates them).
const CHECKLIST_TASK_TYPES = new Set(['data_verification', 'audit_fix']);
const isChecklistType = (taskType) => CHECKLIST_TASK_TYPES.has(taskType);
const MAX_CHECKLIST_ITEMS = 100;

// The weights intentionally put most of the work in research and development.
// Publishing and peer approval remain explicit gates instead of disappearing
// into a vague last 5 percent.
const PORTING_STAGES = Object.freeze([
  {
    key: 'understand',
    label: 'Read & understand',
    description: 'Read the source graph and understand its measure, population, encodings, and assumptions.',
    weight: 15,
  },
  {
    key: 'research',
    label: 'Research missing data',
    description: 'Identify and gather missing sources, including coverage gaps and caveats.',
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
    weight: 25,
  },
  {
    key: 'publish',
    label: 'Publish',
    description: 'Publish the finished visual so the team can review it.',
    weight: 10,
  },
  {
    // A published visual is a draft the porter checks themselves — seeing how it
    // looks is not the same as vouching for the data. This gate sits between
    // publish and peer approval so a task only reaches team review once the
    // porter has re-verified their own work.
    key: 'self_verify',
    label: 'Self-verify',
    description: 'Re-check the published output and the underlying data yourself before handing it to a teammate.',
    weight: 5,
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

const cleanOptionalStageNote = (value) => (
  value == null || (typeof value === 'string' && !value.trim()) ? null : cleanStageNote(value)
);

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isStageDone = (state) => Boolean(state?.completed || state?.completed_at);
const stagesFor = (taskType = DEFAULT_TASK_TYPE) => WORKFLOWS[taskType] || [];

// ── checklist items (user-authored workflow points) ──

const slugify = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';

// Accepts strings or {key?, label} rows; keys are kept when supplied (so a
// rename doesn't orphan the item's log history) and slug-generated when new.
function cleanChecklistItems(value) {
  const rows = cleanArray('checklist_items', value);
  if (!rows.length) fail('checklist_items must have at least one item');
  if (rows.length > MAX_CHECKLIST_ITEMS) fail(`checklist_items must have ${MAX_CHECKLIST_ITEMS} or fewer items`);
  const used = new Set();
  return rows.map((row) => {
    const label = typeof row === 'string' ? row.trim() : (typeof row?.label === 'string' ? row.label.trim() : '');
    if (!label) fail('every checklist item needs a label');
    if (label.length > 200) fail('checklist item labels must be 200 characters or fewer');
    let key = typeof row?.key === 'string' && row.key.trim() ? row.key.trim() : slugify(label);
    while (used.has(key)) key = `${key}_2`;
    used.add(key);
    return { key, label };
  });
}

// The stage list for a task: code-defined for workflow types (porting),
// doc-defined for checklist types. Equal weights keep the shared
// weighted-progress rollup working unchanged.
function stagesForTask(taskLike) {
  const taskType = taskLike?.task_type || DEFAULT_TASK_TYPE;
  if (isChecklistType(taskType)) {
    const items = Array.isArray(taskLike?.checklist_items) ? taskLike.checklist_items : [];
    const weight = items.length ? 100 / items.length : 0;
    return items.map((item) => ({ key: item.key, label: item.label, weight }));
  }
  return stagesFor(taskType);
}

function progressForStages(taskLike, states = {}) {
  // Rounded: checklist weights are fractional (100/N) and float sums drift.
  return Math.round(stagesForTask(taskLike).reduce(
    (total, stage) => total + (isStageDone(states[stage.key]) ? stage.weight : 0),
    0
  ));
}

const isWorkflowComplete = (taskLike, states = {}) => {
  const stages = stagesForTask(taskLike);
  return stages.length > 0 && stages.every((stage) => isStageDone(states[stage.key]));
};

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

// Tasks completed under the six-stage workflow (before self_verify was
// inserted between publish and approval) have real, non-migrated stage
// entries for approval but no self_verify key at all — unlike the fully
// legacy case above, workflow_stages does exist here. Left alone, a done
// task like that derives 95% and the modal shows self_verify as an active,
// incomplete stage under a completed approval. Backfill it the same way:
// a migrated stage entry, stamped from the approval entry that closed out
// the old workflow (falling back to the task's own completion stamps).
// Only done tasks are touched — an in-flight task still owes a real self-verify.
function backfillSelfVerifyStage(doc, workflowStages) {
  if (doc.status !== 'done') return workflowStages;
  if (isStageDone(workflowStages.self_verify)) return workflowStages;
  const approval = workflowStages.approval;
  if (!isStageDone(approval)) return workflowStages;
  return {
    ...workflowStages,
    self_verify: {
      completed: true,
      completed_at: approval.completed_at || doc.completed_at || null,
      completed_by: approval.completed_by || doc.completed_by || null,
      completed_by_label: approval.completed_by_label || doc.completed_by_label || null,
      note: 'Completed before self-verify was introduced as a stage.',
      migrated: true,
    },
  };
}

function normalizeTask(doc) {
  if (!doc) return doc;
  const { dataset_version_created, dataset_version_completed, ...cleanDoc } = doc;
  const taskType = TASK_TYPES.includes(doc.task_type) ? doc.task_type : DEFAULT_TASK_TYPE;
  const hasWorkflow = isRecord(doc.workflow_stages);
  const baseStages = hasWorkflow
    ? doc.workflow_stages
    : (doc.status === 'done' ? legacyCompletedStages(doc) : {});
  const workflowStages = backfillSelfVerifyStage(doc, baseStages);
  const checklistItems = isChecklistType(taskType)
    ? (Array.isArray(doc.checklist_items) ? doc.checklist_items : [])
    : undefined;
  const normalized = {
    ...cleanDoc,
    // The board dropped its Backlog column; legacy docs stored 'backlog' surface
    // as 'todo' on read. 'backlog' stays in the STATUSES write allowlist for
    // back-compat, but the client no longer sends it and reads never expose it.
    status: doc.status === 'backlog' ? 'todo' : doc.status,
    task_type: taskType,
    workflow_stages: workflowStages,
    workflow_log: Array.isArray(doc.workflow_log) ? doc.workflow_log : [],
    workflow_revision: Number.isInteger(doc.workflow_revision) ? doc.workflow_revision : 0,
  };
  if (checklistItems) normalized.checklist_items = checklistItems;
  normalized.progress = progressForStages(normalized, workflowStages);
  return normalized;
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
  let checklistItems;
  if (isChecklistType(taskType)) {
    checklistItems = cleanChecklistItems(body.checklist_items ?? []);
  } else if (body.checklist_items != null) {
    fail(`${taskType} tasks have a fixed workflow — checklist_items only apply to checklist task types`);
  }

  // Append to the bottom of the destination column, leaving reorder gaps.
  const order = await nextOrder(auditDb, status);

  const now = new Date();
  const creatorLabel = await getDisplayName(auditDb, uid);
  const doc = {
    _id: `tp-${crypto.randomBytes(4).toString('hex')}`,
    title,
    description: cleanNullableString('description', body.description),
    task_type: taskType,
    ...(checklistItems ? { checklist_items: checklistItems } : {}),
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
  // Checklist items are editable until checked: an item whose key is already
  // completed must survive the patch (its log history stays meaningful).
  if ('checklist_items' in patch) {
    if (!isChecklistType($set.task_type || normalized.task_type)) {
      fail('checklist_items only apply to checklist task types');
    }
    if (normalized.status === 'done') {
      fail('reopen an item before editing the checklist of a done task');
    }
    $set.checklist_items = cleanChecklistItems(patch.checklist_items);
    const keptKeys = new Set($set.checklist_items.map((item) => item.key));
    for (const [key, state] of Object.entries(normalized.workflow_stages)) {
      if (isStageDone(state) && !keptKeys.has(key)) {
        fail('completed checklist items cannot be removed — reopen the item first');
      }
    }
  }
  const workflowComplete = isWorkflowComplete(
    { ...normalized, ...('checklist_items' in $set ? { checklist_items: $set.checklist_items } : {}) },
    normalized.workflow_stages
  );
  if ($set.status === 'done' && !workflowComplete) {
    fail('complete every workflow stage before marking this task done');
  }
  if ($set.status && $set.status !== 'done' && existing.status === 'done' && workflowComplete) {
    fail('reopen a workflow stage to move a completed task out of done');
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

function stageByKey(task, stageKey) {
  const workflow = stagesForTask(task);
  const index = workflow.findIndex((stage) => stage.key === stageKey);
  if (index === -1) fail(`unknown ${task.task_type} stage: ${stageKey}`);
  return { workflow, stage: workflow[index], index };
}

const workflowRevisionFilter = (existing) => (
  Number.isInteger(existing.workflow_revision)
    ? { _id: existing._id, workflow_revision: existing.workflow_revision }
    : { _id: existing._id, $or: [{ workflow_revision: { $exists: false } }, { workflow_revision: null }] }
);

// If optional notes were saved separately, carry only the latest one from the
// current completion cycle into the stage snapshot. A reopen starts a new cycle
// for that stage and every downstream stage it invalidates; the full log stays.
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
  stageByKey(task, stageKey);
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
  const { workflow, stage, index } = stageByKey(task, stageKey);
  const note = cleanOptionalStageNote(body.note);
  const savedNotes = currentStageNotes(task, stage.key);

  if (isStageDone(task.workflow_stages[stage.key])) fail(`${stage.label} is already complete`);
  // Checklist items are independent — only code-defined workflows are ordered.
  if (!isChecklistType(task.task_type)) {
    const missingPrior = workflow.slice(0, index).find((prior) => !isStageDone(task.workflow_stages[prior.key]));
    if (missingPrior) fail(`complete ${missingPrior.label} first`);
  }
  // Everyone-equal, narrowed: an assigned task's non-peer stages are the
  // assignee's to complete (an unassigned task has no such signal, so anyone
  // may — otherwise a task nobody claimed could never move). The peer
  // approval stage is the opposite: it must come from someone who did NOT do
  // the work, so both the creator and the assignee are excluded from it.
  if (stage.requires_peer) {
    if (uid === task.created_by) {
      fail('team approval must be completed by someone other than the task creator');
    }
    if (uid === task.assignee_uid) {
      fail("approval must come from a teammate who didn't do the work");
    }
  } else if (task.assignee_uid && uid !== task.assignee_uid) {
    fail('only the assignee can complete stages');
  }
  const now = new Date();
  const actorLabel = await getDisplayName(auditDb, uid);
  const eventId = `tl-${crypto.randomBytes(5).toString('hex')}`;
  const latestNote = note || savedNotes.at(-1)?.note;
  const stageState = {
    completed: true,
    completed_at: now,
    completed_by: uid ?? null,
    completed_by_label: actorLabel,
    event_id: eventId,
  };
  if (latestNote) stageState.note = latestNote;
  const workflowStages = {
    ...task.workflow_stages,
    [stage.key]: stageState,
  };
  // Checklist tasks never auto-close: verifying the last checkpoint surfaces a
  // "ready to close" banner and the user marks the task done explicitly (a
  // status patch, allowed once the workflow is complete). Staged workflows
  // keep flipping to done at 100% — approval IS the closing act there.
  const progress = progressForStages(task, workflowStages);
  const final = !isChecklistType(task.task_type) && isWorkflowComplete(task, workflowStages);
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
  const { workflow, stage, index } = stageByKey(task, stageKey);
  // Un-verifying a checkpoint is a one-click undo; reopening a staged
  // workflow invalidates downstream work, so it still demands a reason.
  const note = isChecklistType(task.task_type)
    ? cleanOptionalStageNote(body.note)
    : cleanStageNote(body.note);
  if (!isStageDone(task.workflow_stages[stage.key])) fail(`${stage.label} is not complete`);

  const workflowStages = { ...task.workflow_stages };
  const affectedStages = [];
  // Ordered workflows invalidate everything downstream of the reopened stage;
  // a checklist item stands alone, so only it reopens.
  const invalidated = isChecklistType(task.task_type) ? [stage] : workflow.slice(index);
  for (const affected of invalidated) {
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
  const progress = progressForStages(task, workflowStages);
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

// ── stage-note management ──
// Stage notes are the iterative { action:'noted' } workflow_log rows. They are
// almost always an error a reviewer spotted, so the note's author may retract
// their own note. Task owners resolve notes from other teammates; note authors
// may resolve their own note only on a task they do not own. Only 'noted' rows
// are touchable — completion/reopen events are the immutable audit trail. These
// are log-only mutations: they bump updated_at but not workflow_revision (no
// stage state changes, so no CAS race to guard).

function notedLogEntry(existing, logId, verb) {
  const entry = (existing.workflow_log || []).find((event) => event._id === logId);
  if (!entry) fail('no such note');
  if (entry.action !== 'noted') fail(`only stage notes can be ${verb}`);
  return entry;
}

async function deleteTaskLogNote(auditDb, id, logId, uid) {
  const existing = await auditDb.collection(COLLECTION).findOne({ _id: id });
  if (!existing) return null;
  const actor = uid ?? null;
  const entry = notedLogEntry(existing, logId, 'deleted');
  if (entry.by !== actor) fail('only the author can delete a note');

  const updated = await auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: id },
    {
      $pull: { workflow_log: { _id: logId } },
      $set: { updated_by: actor, updated_at: new Date() },
    },
    { returnDocument: 'after' }
  );
  return normalizeTask(updated);
}

async function resolveTaskLogNote(auditDb, id, logId, body = {}, uid) {
  const existing = await auditDb.collection(COLLECTION).findOne({ _id: id });
  if (!existing) return null;
  const resolved = cleanBool('resolved', body.resolved);
  const actor = uid ?? null;
  const entry = notedLogEntry(existing, logId, 'resolved');
  const isOwner = Boolean(actor)
    && (actor === existing.assignee_uid || actor === existing.created_by);
  const isAuthor = Boolean(actor) && actor === entry.by;
  const allowed = (isOwner && !isAuthor) || (!isOwner && isAuthor);
  if (!allowed) {
    fail("you can resolve another teammate's note on your task, or your own note on theirs");
  }

  const now = new Date();
  // Toggling off returns the note to its pristine noted shape ($unset all four
  // fields) rather than leaving a dangling resolved:false with stale metadata.
  const update = resolved
    ? {
        $set: {
          'workflow_log.$[note].resolved': true,
          'workflow_log.$[note].resolved_by': actor,
          'workflow_log.$[note].resolved_by_label': await getDisplayName(auditDb, uid),
          'workflow_log.$[note].resolved_at': now,
          updated_by: actor,
          updated_at: now,
        },
      }
    : {
        $unset: {
          'workflow_log.$[note].resolved': '',
          'workflow_log.$[note].resolved_by': '',
          'workflow_log.$[note].resolved_by_label': '',
          'workflow_log.$[note].resolved_at': '',
        },
        $set: { updated_by: actor, updated_at: now },
      };
  const updated = await auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: id },
    update,
    { arrayFilters: [{ 'note._id': logId }], returnDocument: 'after' }
  );
  return normalizeTask(updated);
}

// ── audit-fix aggregation ──
// Audit verdicts feed one standing 'audit_fix' task in To do: an error or
// conservative verdict appends a checklist item for that doc (deduped by a
// stable doc key, verdict notes ride along as stage notes); a later
// 'correct' re-audit auto-completes the doc's open item. Best-effort by
// contract — callers must never fail a verdict over task bookkeeping.
const AUDIT_FIX_TITLE = 'Audit fixes';

async function recordAuditVerdictFix(auditDb, { docId, result, label, note }, uid) {
  const isFix = result === 'error' || result === 'conservative';
  if (!isFix && result !== 'correct') return null;
  const itemKey = `doc_${String(docId)}`;

  let existing = await auditDb.collection(COLLECTION)
    .find({ task_type: 'audit_fix', status: { $ne: 'done' }, archived: { $ne: true } })
    .sort({ created_at: 1 }).limit(1).next();

  // A 'correct' verdict only ever resolves; it never creates the task.
  if (!existing) {
    if (!isFix) return null;
    const created = await createTask(auditDb, null, {
      title: AUDIT_FIX_TITLE,
      description: 'Parser/articulation fixes surfaced by audit verdicts. Items are appended automatically when a doc is judged error or conservative, and check themselves off when a re-audit comes back correct.',
      task_type: 'audit_fix',
      checklist_items: [{ key: itemKey, label }],
      notes: [],
    }, uid);
    if (!note) return normalizeTask(created);
    return addTaskStageNote(auditDb, created._id, itemKey, { note }, uid);
  }

  const task = normalizeTask(existing);
  const items = task.checklist_items || [];
  const known = items.some((item) => item.key === itemKey);
  const now = new Date();
  const actorLabel = await getDisplayName(auditDb, uid);
  const $set = { updated_by: uid ?? null, updated_at: now };
  const log = [...task.workflow_log];
  let workflowStages = task.workflow_stages;

  if (isFix) {
    if (!known) $set.checklist_items = [...items, { key: itemKey, label }];
    if (known && isStageDone(task.workflow_stages[itemKey])) {
      // The doc regressed after being fixed — reopen its item.
      workflowStages = { ...workflowStages };
      delete workflowStages[itemKey];
      log.push({
        _id: `tl-${crypto.randomBytes(5).toString('hex')}`,
        stage: itemKey, action: 'reopened', affected_stages: [itemKey],
        note: `Re-audited ${result}.`, by: uid ?? null, by_label: actorLabel, at: now,
      });
    }
    if (note) {
      log.push({
        _id: `tl-${crypto.randomBytes(5).toString('hex')}`,
        stage: itemKey, action: 'noted', note, by: uid ?? null, by_label: actorLabel, at: now,
      });
    }
  } else {
    // 'correct': complete the doc's item if it exists and is still open.
    if (!known || isStageDone(task.workflow_stages[itemKey])) return task;
    const eventId = `tl-${crypto.randomBytes(5).toString('hex')}`;
    workflowStages = {
      ...workflowStages,
      [itemKey]: {
        completed: true, completed_at: now, completed_by: uid ?? null,
        completed_by_label: actorLabel, note: 'Re-audited correct.', event_id: eventId,
      },
    };
    log.push({
      _id: eventId, stage: itemKey, action: 'completed',
      note: 'Re-audited correct.', by: uid ?? null, by_label: actorLabel, at: now,
    });
  }

  const nextItems = $set.checklist_items || items;
  $set.workflow_stages = workflowStages;
  $set.workflow_log = log;
  $set.workflow_revision = task.workflow_revision + 1;
  $set.progress = progressForStages({ ...task, checklist_items: nextItems }, workflowStages);
  const updated = await auditDb.collection(COLLECTION).findOneAndUpdate(
    workflowRevisionFilter(existing), { $set }, { returnDocument: 'after' }
  );
  return updated ? normalizeTask(updated) : null;
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
  normalizeTask, progressForStages, stagesForTask,
  listTasks, createTask, updateTask, addTaskStageNote, completeTaskStage, reopenTaskStage,
  deleteTaskLogNote, resolveTaskLogNote, recordAuditVerdictFix,
  deleteTask, listRoster,
  migrateLegacyTasks, ensureTaskIndexes,
};
