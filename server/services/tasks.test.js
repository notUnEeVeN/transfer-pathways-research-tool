import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// One native require graph so module-level caches (dataset version TTL) are
// shared between the test and the service under test.
const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  STATUSES, ValidationError,
  listTasks, createTask, updateTask, deleteTask, listRoster, ensureTaskIndexes,
} = cjs('./tasks');
const { _resetDatasetVersionCache } = cjs('./datasetVersion');

let mongo;
let db; // doubles as audit handle AND reference handle (dataset_meta lives here)

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('tasks_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  _resetDatasetVersionCache(); // module-level 30s cache would leak across tests
  await db.collection('tasks').deleteMany({});
  await db.collection('access_grants').deleteMany({});
  await db.collection('api_tokens').deleteMany({});
  await db.collection('display_names').deleteMany({});
  await db.collection('dataset_meta').deleteMany({});
  // The reference-handle snapshot doc that create/done stamping reads.
  await db.collection('dataset_meta').insertOne({ _id: 'current', dataset_version: 'test-v1' });
});

describe('createTask', () => {
  it('applies defaults, stamps the creator, and stamps the dataset version', async () => {
    const doc = await createTask(db, db, { title: '  Recreate MA Fig 3  ' }, 'user-1');

    expect(doc._id).toMatch(/^tp-[0-9a-f]{8}$/);
    expect(doc.title).toBe('Recreate MA Fig 3'); // trimmed
    expect(doc.status).toBe('todo');
    expect(doc.progress).toBe(0);
    expect(doc.archived).toBe(false);
    expect(doc.notes).toEqual([]);
    expect(doc.assignee_uid).toBeNull();
    expect(doc.assignee_label).toBeNull();
    expect(doc.created_by).toBe('user-1');
    expect(doc.created_at).toBeInstanceOf(Date);
    expect(doc.updated_by).toBe('user-1');
    expect(doc.updated_at).toEqual(doc.created_at);
    expect(doc.dataset_version_created).toBe('test-v1');
    expect(doc.completed_by).toBeNull();
    expect(doc.completed_at).toBeNull();
    expect(doc.dataset_version_completed).toBeNull();
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

  it('is null-safe when no dataset snapshot exists yet', async () => {
    await db.collection('dataset_meta').deleteMany({});
    _resetDatasetVersionCache();
    const doc = await createTask(db, db, { title: 'x' }, 'u');
    expect(doc.dataset_version_created).toBeNull();
  });

  it('requires a non-empty title', async () => {
    await expect(createTask(db, db, {}, 'u')).rejects.toThrow(ValidationError);
    await expect(createTask(db, db, { title: '   ' }, 'u')).rejects.toThrow(/title/);
    await expect(createTask(db, db, { title: 42 }, 'u')).rejects.toThrow(/title/);
  });

  it('rejects a bad status and a non-numeric progress', async () => {
    await expect(createTask(db, db, { title: 'x', status: 'doing' }, 'u')).rejects.toThrow(/status/);
    await expect(createTask(db, db, { title: 'x', progress: 'half' }, 'u')).rejects.toThrow(/progress/);
  });

  it('clamps progress to 0–100 and rounds to an integer', async () => {
    expect((await createTask(db, db, { title: 'a', progress: 150 }, 'u')).progress).toBe(100);
    expect((await createTask(db, db, { title: 'b', progress: -5 }, 'u')).progress).toBe(0);
    expect((await createTask(db, db, { title: 'c', progress: 42.7 }, 'u')).progress).toBe(43);
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
});

describe('updateTask', () => {
  it('merges only the patched fields and restamps updated_*', async () => {
    const doc = await createTask(db, db, { title: 'orig', description: 'keep me' }, 'user-1');
    const after = await updateTask(db, db, doc._id, { title: 'renamed', progress: 60 }, 'user-2');

    expect(after.title).toBe('renamed');
    expect(after.progress).toBe(60);
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
    await expect(updateTask(db, db, doc._id, { progress: 'lots' }, 'u')).rejects.toThrow(/progress/);
    await expect(updateTask(db, db, doc._id, { notes: 'nope' }, 'u')).rejects.toThrow(/notes/);
  });

  it('returns null for a missing id', async () => {
    expect(await updateTask(db, db, 'tp-deadbeef', { title: 'x' }, 'u')).toBeNull();
  });

  it('stamps completed_* + dataset_version_completed on the → done transition', async () => {
    const doc = await createTask(db, db, { title: 'x' }, 'user-1');
    const done = await updateTask(db, db, doc._id, { status: 'done' }, 'user-2');
    expect(done.completed_by).toBe('user-2');
    expect(done.completed_at).toBeInstanceOf(Date);
    expect(done.dataset_version_completed).toBe('test-v1');

    // Already done → another done-patch must not restamp.
    const again = await updateTask(db, db, doc._id, { status: 'done', progress: 100 }, 'user-3');
    expect(again.completed_by).toBe('user-2');
    expect(again.completed_at).toEqual(done.completed_at);
  });

  it('clears completion stamps when a task moves back out of done', async () => {
    const doc = await createTask(db, db, { title: 'x' }, 'u');
    await updateTask(db, db, doc._id, { status: 'done' }, 'u');
    const reopened = await updateTask(db, db, doc._id, { status: 'in_progress' }, 'u');
    expect(reopened.completed_by).toBeNull();
    expect(reopened.completed_at).toBeNull();
    expect(reopened.dataset_version_completed).toBeNull();
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

  it('merges env admins with grants, preferring grant emails as labels', async () => {
    process.env.ADMIN_UIDS = 'admin-uid-1,admin-uid-2';
    await db.collection('access_grants').insertMany([
      { _id: 'partner-uid-1', email: 'zoe@example.edu' },
      { _id: 'admin-uid-1', email: 'alice@example.edu' }, // admin with a grant → email label
    ]);

    const rows = await listRoster(db);
    expect(rows).toHaveLength(3); // admin-uid-1 appears once despite being in both sources
    expect(rows.map((r) => r.label)).toEqual([
      'alice@example.edu',
      'UID admin-ui', // no grant, no token → short-uid fallback
      'zoe@example.edu',
    ]); // sorted by label
    expect(rows.find((r) => r.label === 'alice@example.edu').uid).toBe('admin-uid-1');
    expect(rows.find((r) => r.uid === 'partner-uid-1').label).toBe('zoe@example.edu');
  });

  it('an admin-set display name wins over the email/uid fallback', async () => {
    process.env.ADMIN_UIDS = 'admin-uid-1';
    await db.collection('access_grants').insertOne({ _id: 'partner-uid-1', email: 'zoe@example.edu' });
    await db.collection('display_names').insertMany([
      { _id: 'admin-uid-1', name: 'Tybalt' },
      { _id: 'partner-uid-1', name: 'Zoe M.' },
    ]);
    const rows = await listRoster(db);
    expect(rows.map((r) => r.label)).toEqual(['Tybalt', 'Zoe M.']);
  });

  it('falls back to a durable api token label before the short uid', async () => {
    process.env.ADMIN_UIDS = 'admin-uid-9';
    await db.collection('api_tokens').insertOne({
      _id: 'hash', uid: 'admin-uid-9', label: 'laptop-notebook', created_at: new Date(), last_used_at: null,
    });
    const rows = await listRoster(db);
    expect(rows).toEqual([{ uid: 'admin-uid-9', label: 'laptop-notebook' }]);
  });
});

describe('ensureTaskIndexes', () => {
  it('creates the board/assignee/recency indexes (idempotent)', async () => {
    await ensureTaskIndexes(db);
    await ensureTaskIndexes(db); // re-run must not throw
    const keys = (await db.collection('tasks').listIndexes().toArray()).map((i) => i.key);
    expect(keys).toContainEqual({ status: 1, order: 1 });
    expect(keys).toContainEqual({ assignee_uid: 1, status: 1 });
    expect(keys).toContainEqual({ updated_at: -1 });
  });
});

describe('constants', () => {
  it('exports the status whitelist the client mirrors', () => {
    expect(STATUSES).toEqual(['backlog', 'todo', 'in_progress', 'done']);
  });
});
