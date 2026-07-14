import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  STATUSES, TASK_TYPES, PORTING_STAGES, ValidationError,
  listTasks, createTask, updateTask, addTaskStageNote, completeTaskStage, reopenTaskStage,
  deleteTask, listRoster, migrateLegacyTasks, ensureTaskIndexes,
} = cjs('./tasks');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('tasks_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  await db.collection('tasks').deleteMany({});
  await db.collection('team_members').deleteMany({});
  await db.collection('api_tokens').deleteMany({});
});

describe('createTask', () => {
  it('applies workflow defaults and stamps the creator', async () => {
    const doc = await createTask(db, db, { title: '  Recreate MA Fig 3  ' }, 'user-1');

    expect(doc._id).toMatch(/^tp-[0-9a-f]{8}$/);
    expect(doc.title).toBe('Recreate MA Fig 3'); // trimmed
    expect(doc.task_type).toBe('porting');
    expect(doc.status).toBe('todo');
    expect(doc.progress).toBe(0);
    expect(doc.workflow_stages).toEqual({});
    expect(doc.workflow_log).toEqual([]);
    expect(doc.workflow_revision).toBe(0);
    expect(doc.archived).toBe(false);
    expect(doc.notes).toEqual([]);
    expect(doc.assignee_uid).toBeNull();
    expect(doc.assignee_label).toBeNull();
    expect(doc.created_by).toBe('user-1');
    expect(doc.created_at).toBeInstanceOf(Date);
    expect(doc.updated_by).toBe('user-1');
    expect(doc.updated_at).toEqual(doc.created_at);
    expect(doc.completed_by).toBeNull();
    expect(doc.completed_at).toBeNull();
    expect(doc).not.toHaveProperty('dataset_version_created');
    expect(doc).not.toHaveProperty('dataset_version_completed');
    // No stray fields from the old model.
    expect(doc).not.toHaveProperty('target');
    expect(doc).not.toHaveProperty('priority');
    expect(doc).not.toHaveProperty('tags');

    // Persisted, not just returned.
    expect(await db.collection('tasks').findOne({ _id: doc._id })).toBeTruthy();
  });

  it('increments order per status column (1000, 2000, …; columns independent)', async () => {
    const a = await createTask(db, db, { title: 'a' }, 'u');
    const b = await createTask(db, db, { title: 'b' }, 'u');
    const c = await createTask(db, db, { title: 'c', status: 'backlog' }, 'u');
    expect(a.order).toBe(1000);
    expect(b.order).toBe(2000);
    expect(c.order).toBe(1000); // backlog column was empty
  });

  it('requires a non-empty title', async () => {
    await expect(createTask(db, db, {}, 'u')).rejects.toThrow(ValidationError);
    await expect(createTask(db, db, { title: '   ' }, 'u')).rejects.toThrow(/title/);
    await expect(createTask(db, db, { title: 42 }, 'u')).rejects.toThrow(/title/);
  });

  it('rejects bad enums and caller-supplied progress', async () => {
    await expect(createTask(db, db, { title: 'x', status: 'doing' }, 'u')).rejects.toThrow(/status/);
    await expect(createTask(db, db, { title: 'x', task_type: 'analysis' }, 'u')).rejects.toThrow(/task_type/);
    await expect(createTask(db, db, { title: 'x', progress: 50 }, 'u')).rejects.toThrow(/calculated/);
    await expect(createTask(db, db, { title: 'x', status: 'done' }, 'u')).rejects.toThrow(/team approval/);
  });
});

describe('listTasks', () => {
  it('returns everything (archived included) sorted by order', async () => {
    const a = await createTask(db, db, { title: 'a' }, 'u');
    const b = await createTask(db, db, { title: 'b' }, 'u');
    await updateTask(db, db, b._id, { archived: true, order: 500 }, 'u');
    const rows = await listTasks(db);
    expect(rows.map((r) => r._id)).toEqual([b._id, a._id]); // 500 before 1000
    expect(rows[0].archived).toBe(true);
  });

  it('keeps legacy completed tasks completed under the new workflow', async () => {
    await db.collection('tasks').insertOne({
      _id: 'tp-legacy1', title: 'old task', status: 'done', order: 10,
      progress: 70, created_by: 'author', completed_by: 'reviewer',
      created_at: new Date('2025-01-01'), completed_at: new Date('2025-01-02'),
    });
    const [row] = await listTasks(db);
    expect(row.task_type).toBe('porting');
    expect(row.progress).toBe(100);
    expect(Object.keys(row.workflow_stages)).toEqual(PORTING_STAGES.map((stage) => stage.key));
    expect(row.workflow_stages.approval.migrated).toBe(true);
  });
});

describe('updateTask', () => {
  it('merges only the patched fields and restamps updated_*', async () => {
    const doc = await createTask(db, db, { title: 'orig', description: 'keep me' }, 'user-1');
    const after = await updateTask(db, db, doc._id, { title: 'renamed', assignee_uid: 'user-3' }, 'user-2');

    expect(after.title).toBe('renamed');
    expect(after.progress).toBe(0);
    expect(after.assignee_uid).toBe('user-3');
    expect(after.description).toBe('keep me'); // untouched by the partial $set
    expect(after.created_by).toBe('user-1'); // creation stamp survives
    expect(after.updated_by).toBe('user-2');
    expect(after.updated_at.getTime()).toBeGreaterThanOrEqual(doc.updated_at.getTime());
  });

  it('appends a note through the notes array', async () => {
    const doc = await createTask(db, db, { title: 'x' }, 'user-1');
    const note = { uid: 'user-2', label: 'Sarah', text: 'try the district pooling first', at: new Date().toISOString() };
    const after = await updateTask(db, db, doc._id, { notes: [note] }, 'user-2');
    expect(after.notes).toEqual([note]);
  });

  it('ignores non-whitelisted fields (stamps are server-owned)', async () => {
    const doc = await createTask(db, db, { title: 'x' }, 'user-1');
    const after = await updateTask(db, db, doc._id, { created_by: 'haxor', _id: 'tp-evil', completed_by: 'haxor' }, 'user-2');
    expect(after._id).toBe(doc._id);
    expect(after.created_by).toBe('user-1');
    expect(after.completed_by).toBeNull();
  });

  it('validates patched fields with the same rules as create', async () => {
    const doc = await createTask(db, db, { title: 'x' }, 'u');
    await expect(updateTask(db, db, doc._id, { status: 'doing' }, 'u')).rejects.toThrow(/status/);
    await expect(updateTask(db, db, doc._id, { title: '' }, 'u')).rejects.toThrow(/title/);
    await expect(updateTask(db, db, doc._id, { progress: 50 }, 'u')).rejects.toThrow(/calculated/);
    await expect(updateTask(db, db, doc._id, { task_type: 'analysis' }, 'u')).rejects.toThrow(/task_type/);
    await expect(updateTask(db, db, doc._id, { notes: 'nope' }, 'u')).rejects.toThrow(/notes/);
  });

  it('returns null for a missing id', async () => {
    expect(await updateTask(db, db, 'tp-deadbeef', { title: 'x' }, 'u')).toBeNull();
  });

  it('blocks a manual done transition before workflow approval', async () => {
    const doc = await createTask(db, db, { title: 'x' }, 'user-1');
    await expect(updateTask(db, db, doc._id, { status: 'done' }, 'user-2')).rejects.toThrow(/workflow stage/);
  });
});

describe('porting workflow', () => {
  it('accepts multiple notes independently of completion, including on future stages', async () => {
    await db.collection('team_members').insertOne({
      _id: 'author', access_status: 'profile_only', display_name: 'Ari',
    });
    const task = await createTask(db, db, { title: 'Port the graph' }, 'author');

    await expect(addTaskStageNote(db, task._id, 'understand', { note: '   ' }, 'author'))
      .rejects.toThrow(/note/);
    await expect(addTaskStageNote(db, task._id, 'not-a-stage', { note: 'x' }, 'author'))
      .rejects.toThrow(/unknown/);

    const future = await addTaskStageNote(
      db, task._id, 'visualization', { note: 'Try a district choropleth.' }, 'author'
    );
    expect(future.progress).toBe(0);
    expect(future.status).toBe('todo');

    await addTaskStageNote(db, task._id, 'understand', { note: 'Confirmed the denominator.' }, 'author');
    const noted = await addTaskStageNote(
      db, task._id, 'understand', { note: 'Documented the source assumptions.' }, 'author'
    );
    expect(noted.workflow_log.filter((event) => event.stage === 'understand')).toHaveLength(2);
    expect(noted.workflow_log.at(-1)).toMatchObject({
      action: 'noted', stage: 'understand', by: 'author', by_label: 'Ari',
    });

    const complete = await completeTaskStage(db, db, task._id, 'understand', {}, 'author');
    expect(complete.progress).toBe(15);
    expect(complete.workflow_stages.understand.note).toBe('Documented the source assumptions.');
    expect(complete.workflow_log.at(-1)).toMatchObject({ action: 'completed', stage: 'understand' });
    expect(complete.workflow_log.at(-1)).not.toHaveProperty('note');
  });

  it('requires ordered stages, treats notes as optional, and derives weighted progress', async () => {
    await db.collection('team_members').insertMany([
      { _id: 'author', access_status: 'profile_only', display_name: 'Ari' },
      { _id: 'reviewer', access_status: 'profile_only', display_name: 'Bea' },
    ]);
    const task = await createTask(db, db, { title: 'Port the graph', status: 'backlog' }, 'author');

    await expect(completeTaskStage(db, db, task._id, 'research', { note: 'found source' }, 'author'))
      .rejects.toThrow(/Read & understand/);

    // A blank optional note is treated the same as omitting it.
    const understood = await completeTaskStage(
      db, db, task._id, 'understand', { note: '   ' }, 'author'
    );
    expect(understood.progress).toBe(15);
    expect(understood.status).toBe('in_progress');
    expect(understood.workflow_stages.understand.completed_by_label).toBe('Ari');
    expect(understood.workflow_stages.understand).not.toHaveProperty('note');
    expect(understood.workflow_log[0]).toMatchObject({
      stage: 'understand', action: 'completed', by: 'author', by_label: 'Ari',
    });

    const research = await completeTaskStage(db, db, task._id, 'research', {}, 'author');
    expect(research.progress).toBe(35);
    const data = await completeTaskStage(db, db, task._id, 'data_access', {}, 'author');
    expect(data.progress).toBe(50);
    const visual = await completeTaskStage(db, db, task._id, 'visualization', {}, 'author');
    expect(visual.progress).toBe(75);
    const published = await completeTaskStage(db, db, task._id, 'publish', {}, 'author');
    expect(published.progress).toBe(85);
    const selfVerified = await completeTaskStage(db, db, task._id, 'self_verify', {}, 'author');
    expect(selfVerified.progress).toBe(90);

    await expect(completeTaskStage(db, db, task._id, 'approval', {}, 'author'))
      .rejects.toThrow(/other than the task creator/);

    const approved = await completeTaskStage(db, db, task._id, 'approval', {}, 'reviewer');
    expect(approved.progress).toBe(100);
    expect(approved.status).toBe('done');
    expect(approved.completed_by).toBe('reviewer');
    expect(approved.completed_by_label).toBe('Bea');
    expect(approved.completed_at).toBeInstanceOf(Date);
    expect(approved).not.toHaveProperty('dataset_version_completed');
    expect(approved.workflow_log).toHaveLength(7);
  });

  it('reopens a stage and every downstream stage while retaining the log', async () => {
    const task = await createTask(db, db, { title: 'Port the graph' }, 'author');
    for (const stage of PORTING_STAGES.slice(0, -1)) {
      await completeTaskStage(db, db, task._id, stage.key, { note: `finished ${stage.key}` }, 'author');
    }
    await completeTaskStage(db, db, task._id, 'approval', { note: 'approved' }, 'reviewer');

    const reopened = await reopenTaskStage(
      db, task._id, 'research', { note: 'The source population changed; recheck downstream work.' }, 'reviewer'
    );
    expect(reopened.status).toBe('in_progress');
    expect(reopened.progress).toBe(15);
    expect(reopened.workflow_stages.understand).toBeTruthy();
    expect(reopened.workflow_stages.research).toBeUndefined();
    expect(reopened.workflow_stages.approval).toBeUndefined();
    expect(reopened.completed_by).toBeNull();
    expect(reopened.completed_at).toBeNull();
    expect(reopened).not.toHaveProperty('dataset_version_completed');
    expect(reopened.workflow_log.at(-1)).toMatchObject({
      stage: 'research', action: 'reopened',
      affected_stages: PORTING_STAGES.slice(1).map((stage) => stage.key),
    });

    const recompleted = await completeTaskStage(db, db, task._id, 'research', {}, 'author');
    expect(recompleted.progress).toBe(35);
    expect(recompleted.workflow_stages.research).not.toHaveProperty('note');
  });
});

describe('deleteTask', () => {
  it('returns the deleted count (1 then 0)', async () => {
    const doc = await createTask(db, db, { title: 'x' }, 'u');
    expect(await deleteTask(db, doc._id)).toBe(1);
    expect(await deleteTask(db, doc._id)).toBe(0);
    expect(await listTasks(db)).toHaveLength(0);
  });
});

describe('listRoster', () => {
  // access.js reads ADMIN_UIDS per call (cached on the raw value), so setting
  // the env inside the test is enough — no re-import dance needed.
  const savedAdminUids = process.env.ADMIN_UIDS;
  afterAll(() => {
    if (savedAdminUids === undefined) delete process.env.ADMIN_UIDS;
    else process.env.ADMIN_UIDS = savedAdminUids;
  });

  it('merges env admins with grants, but only accounts with a display name set', async () => {
    process.env.ADMIN_UIDS = 'admin-uid-1,admin-uid-2';
    await db.collection('team_members').insertMany([
      { _id: 'partner-uid-1', access_status: 'granted', email: 'zoe@example.edu' },
      { _id: 'admin-uid-1', access_status: 'granted', email: 'alice@example.edu', display_name: 'Alice' },
    ]);

    const rows = await listRoster(db);
    // admin-uid-2 (no name) and partner-uid-1 (no name) are excluded
    expect(rows).toEqual([{ uid: 'admin-uid-1', label: 'Alice' }]);
  });

  it('an admin-set display name is the only label used', async () => {
    process.env.ADMIN_UIDS = 'admin-uid-1';
    await db.collection('team_members').insertMany([
      { _id: 'admin-uid-1', access_status: 'profile_only', display_name: 'Tybalt' },
      { _id: 'partner-uid-1', access_status: 'granted', email: 'zoe@example.edu', display_name: 'Zoe M.' },
    ]);
    const rows = await listRoster(db);
    expect(rows.map((r) => r.label)).toEqual(['Tybalt', 'Zoe M.']);
  });

  it('leaves out accounts with no display name set, even with a durable api token label', async () => {
    process.env.ADMIN_UIDS = 'admin-uid-9';
    await db.collection('api_tokens').insertOne({
      _id: 'hash', uid: 'admin-uid-9', label: 'laptop-notebook', created_at: new Date(), last_used_at: null,
    });
    const rows = await listRoster(db);
    expect(rows).toEqual([]);
  });
});

describe('ensureTaskIndexes', () => {
  it('durably upgrades open and completed legacy task documents', async () => {
    await db.collection('tasks').insertMany([
      { _id: 'tp-legacy-open', title: 'open', status: 'in_progress', progress: 65, dataset_version_created: 'old-v1' },
      { _id: 'tp-legacy-done', title: 'done', status: 'done', progress: 75, completed_by: 'reviewer', dataset_version_completed: 'old-v1' },
    ]);

    expect(await migrateLegacyTasks(db)).toBe(2);
    expect(await migrateLegacyTasks(db)).toBe(0);
    const open = await db.collection('tasks').findOne({ _id: 'tp-legacy-open' });
    const done = await db.collection('tasks').findOne({ _id: 'tp-legacy-done' });
    expect(open).toMatchObject({ task_type: 'porting', progress: 0, workflow_stages: {}, workflow_log: [], workflow_revision: 0 });
    expect(done.task_type).toBe('porting');
    expect(done.progress).toBe(100);
    expect(Object.keys(done.workflow_stages)).toHaveLength(PORTING_STAGES.length);
    expect(open).not.toHaveProperty('dataset_version_created');
    expect(done).not.toHaveProperty('dataset_version_completed');
  });

  it('creates the board/assignee/recency indexes (idempotent)', async () => {
    await ensureTaskIndexes(db);
    await ensureTaskIndexes(db); // re-run must not throw
    const keys = (await db.collection('tasks').listIndexes().toArray()).map((i) => i.key);
    expect(keys).toContainEqual({ status: 1, order: 1 });
    expect(keys).toContainEqual({ assignee_uid: 1, status: 1 });
    expect(keys).toContainEqual({ updated_at: -1 });
    expect(keys).toContainEqual({ task_type: 1, status: 1 });
  });
});

describe('constants', () => {
  it('exports the status whitelist the client mirrors', () => {
    expect(STATUSES).toEqual(['backlog', 'todo', 'in_progress', 'done']);
    expect(TASK_TYPES).toEqual(['porting', 'data_verification', 'audit_fix']);
    expect(PORTING_STAGES.reduce((sum, stage) => sum + stage.weight, 0)).toBe(100);
  });
});
