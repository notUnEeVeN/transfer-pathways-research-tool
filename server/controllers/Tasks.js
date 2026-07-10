/**
 * Task board endpoints. Deliberately everyone-equal: any console user may
 * create/edit/delete any task (3-person team decision) — no canModify checks;
 * the stamps in services/tasks.js record who did what. Validation lives in
 * the service (ValidationError → 400 here).
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  listTasks, createTask, updateTask, deleteTask, listRoster, ValidationError,
} = require('../services/tasks');
const { currentDatasetVersion } = require('../services/datasetVersion');

const tasksDb = (req) => req.app.locals.auditDb || req.app.locals.db;

// asyncHandler plus the service's ValidationError → 400 { error } mapping;
// anything else still forwards to the central error handler.
const handler = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
    throw e;
  }
});

// dataset_version rides along so pmt.get('/tasks') DataFrames carry the
// snapshot identity, same as the analysis endpoints. Read on the REFERENCE
// handle — dataset_meta lives there, not on auditDb.
exports.list = handler(async (req, res) => {
  const [rows, dataset_version] = await Promise.all([
    listTasks(tasksDb(req)),
    currentDatasetVersion(req.app.locals.db),
  ]);
  res.json({ rows, dataset_version });
});

exports.create = handler(async (req, res) => {
  const doc = await createTask(tasksDb(req), req.app.locals.db, req.body || {}, req.user?.uid ?? null);
  res.status(201).json(doc);
});

exports.update = handler(async (req, res) => {
  const doc = await updateTask(tasksDb(req), req.app.locals.db, req.params.id, req.body || {}, req.user?.uid ?? null);
  if (!doc) return res.status(404).json({ error: 'no such task' });
  res.json(doc);
});

exports.remove = handler(async (req, res) => {
  const deleted = await deleteTask(tasksDb(req), req.params.id);
  if (!deleted) return res.status(404).json({ error: 'no such task' });
  res.json({ ok: true });
});

exports.roster = handler(async (req, res) => {
  res.json({ rows: await listRoster(tasksDb(req)) });
});
