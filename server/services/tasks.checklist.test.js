import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  ValidationError,
  createTask, updateTask, completeTaskStage, reopenTaskStage, addTaskStageNote,
  stagesForTask,
} = cjs('./tasks');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('tasks_checklist_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  await db.collection('tasks').deleteMany({});
  await db.collection('team_members').deleteMany({});
});

const CAMPUSES = ['UC Berkeley', 'UC San Diego', 'UCLA'];

const createVerification = (items = CAMPUSES, uid = 'author') =>
  createTask(db, db, {
    title: 'Verify gathered 4-year degree requirements',
    task_type: 'data_verification',
    checklist_items: items,
  }, uid);

describe('data_verification checklist tasks', () => {
  it('creates with user-authored items and slug keys', async () => {
    const task = await createVerification();
    expect(task.checklist_items).toEqual([
      { key: 'uc_berkeley', label: 'UC Berkeley' },
      { key: 'uc_san_diego', label: 'UC San Diego' },
      { key: 'ucla', label: 'UCLA' },
    ]);
    expect(stagesForTask(task).map((s) => s.key)).toEqual(['uc_berkeley', 'uc_san_diego', 'ucla']);
    expect(task.progress).toBe(0);
  });

  it('requires at least one item and rejects items on porting tasks', async () => {
    await expect(createVerification([])).rejects.toThrow(ValidationError);
    await expect(createTask(db, db, {
      title: 'Port', task_type: 'porting', checklist_items: ['x'],
    }, 'author')).rejects.toThrow(ValidationError);
  });

  it('completes items in any order and closes only on an explicit done patch', async () => {
    const task = await createVerification();
    // Out of order: last item first — no "complete X first" gate.
    const one = await completeTaskStage(db, db, task._id, 'ucla', {}, 'author');
    expect(one.progress).toBe(33);
    expect(one.status).toBe('in_progress');

    await completeTaskStage(db, db, task._id, 'uc_san_diego', {}, 'author');
    const all = await completeTaskStage(db, db, task._id, 'uc_berkeley', { note: 'H/SS split corrected' }, 'author');
    expect(all.progress).toBe(100);
    // No auto-close: the last verify surfaces the ready-to-close banner.
    expect(all.status).toBe('in_progress');
    expect(all.workflow_stages.uc_berkeley.note).toBe('H/SS split corrected');

    const closed = await updateTask(db, db, task._id, { status: 'done' }, 'author');
    expect(closed.status).toBe('done');
    expect(closed.completed_by).toBe('author');
  });

  it('reopening one item is a note-free undo and does not cascade', async () => {
    const task = await createVerification();
    await completeTaskStage(db, db, task._id, 'uc_berkeley', {}, 'author');
    await completeTaskStage(db, db, task._id, 'ucla', {}, 'author');
    const reopened = await reopenTaskStage(db, task._id, 'uc_berkeley', {}, 'author');
    expect(reopened.workflow_stages.uc_berkeley).toBeUndefined();
    expect(reopened.workflow_stages.ucla.completed).toBe(true);
    expect(reopened.progress).toBe(33);
  });

  it('supports per-item notes through the shared log', async () => {
    const task = await createVerification();
    const noted = await addTaskStageNote(db, task._id, 'uc_san_diego', { note: 'catalog moved to 2026-27' }, 'author');
    expect(noted.workflow_log.at(-1)).toMatchObject({ stage: 'uc_san_diego', action: 'noted' });
  });

  it('items are editable until checked: add/remove ok, removing a completed item fails', async () => {
    const task = await createVerification();
    await completeTaskStage(db, db, task._id, 'uc_berkeley', {}, 'author');

    // Add a campus and drop an uncompleted one — allowed. Keys are preserved.
    const patched = await updateTask(db, db, task._id, {
      checklist_items: [
        { key: 'uc_berkeley', label: 'UC Berkeley' },
        { key: 'ucla', label: 'UCLA' },
        'UC Merced',
      ],
    }, 'author');
    expect(patched.checklist_items.map((i) => i.key)).toEqual(['uc_berkeley', 'ucla', 'uc_merced']);
    expect(patched.progress).toBe(33);

    // Dropping the completed Berkeley item is rejected.
    await expect(updateTask(db, db, task._id, {
      checklist_items: [{ key: 'ucla', label: 'UCLA' }, 'UC Merced'],
    }, 'author')).rejects.toThrow(/completed checklist items cannot be removed/);
  });

  it('marking done by status patch still requires every item checked', async () => {
    const task = await createVerification();
    await completeTaskStage(db, db, task._id, 'uc_berkeley', {}, 'author');
    await expect(updateTask(db, db, task._id, { status: 'done' }, 'author'))
      .rejects.toThrow(/complete every workflow stage/);
  });

  it('deduplicates slug collisions instead of silently merging items', async () => {
    const task = await createVerification(['Same Name', 'same name']);
    expect(task.checklist_items.map((i) => i.key)).toEqual(['same_name', 'same_name_2']);
  });
});
