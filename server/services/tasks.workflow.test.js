import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  PORTING_STAGES, ValidationError,
  listTasks, createTask, addTaskStageNote, completeTaskStage, reopenTaskStage,
  deleteTaskLogNote, resolveTaskLogNote,
} = cjs('./tasks');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('tasks_workflow_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  await db.collection('tasks').deleteMany({});
  await db.collection('team_members').deleteMany({});
});

const completeThrough = async (taskId, stopKey, uid) => {
  let last;
  for (const stage of PORTING_STAGES) {
    last = await completeTaskStage(db, db, taskId, stage.key, { note: `did ${stage.key}` }, uid);
    if (stage.key === stopKey) break;
  }
  return last;
};

describe('seven-stage porting workflow', () => {
  it('inserts self_verify between publish and approval and keeps weights at 100', () => {
    expect(PORTING_STAGES.map((stage) => stage.key)).toEqual([
      'understand', 'research', 'data_access', 'visualization', 'publish', 'self_verify', 'approval',
    ]);
    expect(PORTING_STAGES.reduce((sum, stage) => sum + stage.weight, 0)).toBe(100);
    const selfVerify = PORTING_STAGES.find((stage) => stage.key === 'self_verify');
    expect(selfVerify).toMatchObject({ label: 'Self-verify', weight: 5 });
    expect(selfVerify.requires_peer).toBeUndefined();
    // The rebalance took visualization from 30 down to 25.
    expect(PORTING_STAGES.find((stage) => stage.key === 'visualization').weight).toBe(25);
  });

  it('derives weighted progress: publish=85, self_verify=90, approval=100', async () => {
    await db.collection('team_members').insertMany([
      { _id: 'author', access_status: 'profile_only', display_name: 'Ari' },
      { _id: 'reviewer', access_status: 'profile_only', display_name: 'Bea' },
    ]);
    const task = await createTask(db, db, { title: 'Port the graph' }, 'author');

    const published = await completeThrough(task._id, 'publish', 'author');
    expect(published.progress).toBe(85);
    expect(published.status).toBe('in_progress');

    const selfVerified = await completeTaskStage(
      db, db, task._id, 'self_verify', { note: 'Re-checked the output and the source numbers.' }, 'author'
    );
    expect(selfVerified.progress).toBe(90);
    expect(selfVerified.status).toBe('in_progress');

    await addTaskStageNote(db, task._id, 'approval', { note: 'Verified the data and approach.' }, 'reviewer');
    const approved = await completeTaskStage(db, db, task._id, 'approval', {}, 'reviewer');
    expect(approved.progress).toBe(100);
    expect(approved.status).toBe('done');
  });

  it('rejects completing approval before self_verify is done', async () => {
    const task = await createTask(db, db, { title: 'Port the graph' }, 'author');
    await completeThrough(task._id, 'publish', 'author'); // stops after publish, self_verify still open
    await addTaskStageNote(db, task._id, 'approval', { note: 'ready?' }, 'reviewer');
    await expect(completeTaskStage(db, db, task._id, 'approval', {}, 'reviewer'))
      .rejects.toThrow(/Self-verify/);
  });

  it('publishing alone does not move the task into peer verification', async () => {
    const task = await createTask(db, db, { title: 'Port the graph' }, 'author');
    const published = await completeThrough(task._id, 'publish', 'author');
    // The next incomplete stage is self_verify, not approval — the board keys
    // its derived Verification column off approval being next.
    const nextIncomplete = PORTING_STAGES.find((stage) => !published.workflow_stages[stage.key]?.completed);
    expect(nextIncomplete.key).toBe('self_verify');
  });
});

describe('assignee-gated stage completion (T22)', () => {
  it('rejects a non-assignee completing an early stage on an assigned task', async () => {
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'assignee' }, 'author');
    await expect(completeTaskStage(
      db, db, task._id, 'understand', { note: 'Confirmed the denominator.' }, 'someone-else'
    )).rejects.toThrow(/only the assignee can complete stages/);
  });

  it('lets the assignee complete an early stage on an assigned task', async () => {
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'assignee' }, 'author');
    const done = await completeTaskStage(
      db, db, task._id, 'understand', { note: 'Confirmed the denominator.' }, 'assignee'
    );
    expect(done.workflow_stages.understand.completed).toBe(true);
  });

  it('lets any member complete a stage on an unassigned task (avoids deadlock)', async () => {
    const task = await createTask(db, db, { title: 'Port the graph' }, 'author');
    const done = await completeTaskStage(
      db, db, task._id, 'understand', { note: 'Confirmed the denominator.' }, 'whoever'
    );
    expect(done.workflow_stages.understand.completed).toBe(true);
  });

  it('rejects the assignee approving their own work', async () => {
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'assignee' }, 'author');
    await completeThrough(task._id, 'self_verify', 'assignee');
    await addTaskStageNote(db, task._id, 'approval', { note: 'Ready for review.' }, 'assignee');
    await expect(completeTaskStage(db, db, task._id, 'approval', {}, 'assignee'))
      .rejects.toThrow(/approval must come from a teammate who didn't do the work/);
  });

  it('still rejects the creator approving their own task (unaffected by the assignee rule)', async () => {
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'assignee' }, 'author');
    await completeThrough(task._id, 'self_verify', 'assignee');
    await addTaskStageNote(db, task._id, 'approval', { note: 'Creator handoff note.' }, 'author');
    await expect(completeTaskStage(db, db, task._id, 'approval', {}, 'author'))
      .rejects.toThrow(/other than the task creator/);
  });

  it('lets a third teammate, neither creator nor assignee, approve with a note', async () => {
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'assignee' }, 'author');
    await completeThrough(task._id, 'self_verify', 'assignee');
    const approved = await completeTaskStage(
      db, db, task._id, 'approval', { note: 'Verified the data and approach.' }, 'reviewer'
    );
    expect(approved.status).toBe('done');
    expect(approved.progress).toBe(100);
  });

  it('still lets a non-assignee reopen a completed stage', async () => {
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'assignee' }, 'author');
    await completeTaskStage(db, db, task._id, 'understand', { note: 'Confirmed the denominator.' }, 'assignee');
    const reopened = await reopenTaskStage(
      db, task._id, 'understand', { note: 'Needs another pass.' }, 'someone-else'
    );
    expect(reopened.workflow_stages.understand).toBeUndefined();
    expect(reopened.status).toBe('in_progress');
  });

  it('self-assigned task full cycle: single actor completes stages through self_verify, then blocks on approval, but third-party approves', async () => {
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'self' }, 'self');
    // Single actor completes every stage through self_verify
    const selfVerified = await completeThrough(task._id, 'self_verify', 'self');
    expect(selfVerified.progress).toBe(90);
    expect(selfVerified.status).toBe('in_progress');
    // Self actor tries to approve their own work — should reject. When the
    // actor is both creator AND assignee, either exclusion rule may fire
    // first; the guard is that the rejection happens at all.
    await addTaskStageNote(db, task._id, 'approval', { note: 'Ready.' }, 'self');
    await expect(completeTaskStage(db, db, task._id, 'approval', {}, 'self'))
      .rejects.toThrow(/someone other than the task creator|approval must come from a teammate/);
    // Third-party with review note succeeds
    const approved = await completeTaskStage(
      db, db, task._id, 'approval', { note: 'Verified independently.' }, 'third-party'
    );
    expect(approved.status).toBe('done');
    expect(approved.progress).toBe(100);
  });
});

describe('legacy backlog coercion', () => {
  it('reads a stored backlog task as todo (never surfaces backlog)', async () => {
    await db.collection('tasks').insertOne({
      _id: 'tp-legacyback', title: 'old backlog task', status: 'backlog', order: 5,
      task_type: 'porting', workflow_stages: {}, workflow_log: [], workflow_revision: 0,
      created_by: 'author', created_at: new Date('2025-01-01'),
    });
    const [row] = await listTasks(db);
    expect(row.status).toBe('todo');
  });
});

describe('legacy self_verify backfill', () => {
  const sixOldStages = (prefix) => ({
    understand: { completed: true, completed_at: new Date(`2025-01-01`), completed_by: 'author', completed_by_label: 'Ari' },
    research: { completed: true, completed_at: new Date(`2025-01-02`), completed_by: 'author', completed_by_label: 'Ari' },
    data_access: { completed: true, completed_at: new Date(`2025-01-03`), completed_by: 'author', completed_by_label: 'Ari' },
    visualization: { completed: true, completed_at: new Date(`2025-01-04`), completed_by: 'author', completed_by_label: 'Ari' },
    publish: { completed: true, completed_at: new Date(`2025-01-05`), completed_by: 'author', completed_by_label: 'Ari' },
  });

  it('backfills a migrated self_verify (stamped from approval) for a done task with no self_verify entry', async () => {
    await db.collection('tasks').insertOne({
      _id: 'tp-legacy6', title: 'old six-stage task', status: 'done', order: 10,
      task_type: 'porting',
      workflow_stages: {
        ...sixOldStages(),
        approval: {
          completed: true, completed_at: new Date('2025-01-06'),
          completed_by: 'reviewer', completed_by_label: 'Bea', note: 'Looks good.',
        },
      },
      workflow_log: [], workflow_revision: 6,
      created_by: 'author', created_at: new Date('2025-01-01'),
      // Deliberately different from the approval entry's stamps, so the
      // assertion below proves self_verify is copied from approval first,
      // not from these task-level completion stamps.
      completed_by: 'someone-else', completed_at: new Date('2025-01-07'),
    });

    const [row] = await listTasks(db);
    expect(row.progress).toBe(100);
    expect(Object.keys(row.workflow_stages).sort()).toEqual([...PORTING_STAGES.map((s) => s.key)].sort());
    expect(row.workflow_stages.self_verify).toMatchObject({
      completed: true,
      migrated: true,
      completed_at: new Date('2025-01-06'),
      completed_by: 'reviewer',
      completed_by_label: 'Bea',
    });
    // The real, non-migrated approval entry is untouched.
    expect(row.workflow_stages.approval.migrated).toBeUndefined();
  });

  it('does not backfill self_verify for an in-progress task (publish complete still derives 85)', async () => {
    await db.collection('tasks').insertOne({
      _id: 'tp-inflight1', title: 'mid workflow', status: 'in_progress', order: 20,
      task_type: 'porting',
      workflow_stages: sixOldStages(), // through publish only — approval not reached
      workflow_log: [], workflow_revision: 5,
      created_by: 'author', created_at: new Date('2025-01-01'),
    });

    const [row] = await listTasks(db);
    expect(row.status).toBe('in_progress');
    expect(row.progress).toBe(85);
    expect(row.workflow_stages.self_verify).toBeUndefined();
  });
});

describe('deleteTaskLogNote', () => {
  const seedNotedTask = async () => {
    await db.collection('team_members').insertMany([
      { _id: 'author', access_status: 'profile_only', display_name: 'Ari' },
      { _id: 'other', access_status: 'profile_only', display_name: 'Bea' },
    ]);
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: 'author' }, 'author');
    const withNote = await addTaskStageNote(db, task._id, 'understand', { note: 'A review note.' }, 'author');
    const noted = withNote.workflow_log.find((event) => event.action === 'noted');
    return { task, noted };
  };

  it('lets the author remove their own noted entry via $pull', async () => {
    const { task, noted } = await seedNotedTask();
    const after = await deleteTaskLogNote(db, task._id, noted._id, 'author');
    expect(after.workflow_log.some((event) => event._id === noted._id)).toBe(false);
    expect(after.updated_at).toBeInstanceOf(Date);
    // Persisted, not just returned.
    const stored = await db.collection('tasks').findOne({ _id: task._id });
    expect(stored.workflow_log).toHaveLength(0);
  });

  it('refuses to delete another teammate’s note', async () => {
    const { task, noted } = await seedNotedTask();
    await expect(deleteTaskLogNote(db, task._id, noted._id, 'other'))
      .rejects.toThrow(/only the author/);
  });

  it('refuses to delete a completion event (only noted entries are deletable)', async () => {
    const { task } = await seedNotedTask();
    const completed = await completeTaskStage(db, db, task._id, 'understand', {}, 'author');
    const completion = completed.workflow_log.find((event) => event.action === 'completed');
    await expect(deleteTaskLogNote(db, task._id, completion._id, 'author'))
      .rejects.toThrow(ValidationError);
  });

  it('404s an unknown task and 400s an unknown note id', async () => {
    const { task } = await seedNotedTask();
    expect(await deleteTaskLogNote(db, 'tp-deadbeef', 'tl-whatever', 'author')).toBeNull();
    await expect(deleteTaskLogNote(db, task._id, 'tl-nope', 'author')).rejects.toThrow(ValidationError);
  });
});

describe('resolveTaskLogNote', () => {
  const seedNotedTask = async (author = 'author', assignee = 'author') => {
    await db.collection('team_members').insertMany([
      { _id: 'author', access_status: 'profile_only', display_name: 'Ari' },
      { _id: 'owner', access_status: 'profile_only', display_name: 'Cy' },
      { _id: 'stranger', access_status: 'profile_only', display_name: 'Dee' },
    ]);
    const task = await createTask(db, db, { title: 'Port the graph', assignee_uid: assignee }, author);
    const withNote = await addTaskStageNote(db, task._id, 'visualization', { note: 'Spotted an error.' }, author);
    const noted = withNote.workflow_log.find((event) => event.action === 'noted');
    return { task, noted };
  };

  it('lets the assignee resolve and then reopen a note, toggling the fields', async () => {
    const { task, noted } = await seedNotedTask('author', 'owner');
    const resolved = await resolveTaskLogNote(db, task._id, noted._id, { resolved: true }, 'owner');
    const entry = resolved.workflow_log.find((event) => event._id === noted._id);
    expect(entry.resolved).toBe(true);
    expect(entry.resolved_by).toBe('owner');
    expect(entry.resolved_by_label).toBe('Cy');
    expect(entry.resolved_at).toBeInstanceOf(Date);

    const reopened = await resolveTaskLogNote(db, task._id, noted._id, { resolved: false }, 'owner');
    const cleared = reopened.workflow_log.find((event) => event._id === noted._id);
    expect(cleared.resolved).toBeUndefined();
    expect(cleared.resolved_by).toBeUndefined();
    expect(cleared.resolved_by_label).toBeUndefined();
    expect(cleared.resolved_at).toBeUndefined();
  });

  it('lets the note author resolve their own note', async () => {
    const { task, noted } = await seedNotedTask('author', 'owner');
    const resolved = await resolveTaskLogNote(db, task._id, noted._id, { resolved: true }, 'author');
    expect(resolved.workflow_log.find((event) => event._id === noted._id).resolved).toBe(true);
  });

  it('refuses a teammate who is neither owner, creator, nor author', async () => {
    const { task, noted } = await seedNotedTask('author', 'owner');
    await expect(resolveTaskLogNote(db, task._id, noted._id, { resolved: true }, 'stranger'))
      .rejects.toThrow(/resolve/);
  });

  it('requires a boolean resolved flag and a noted entry', async () => {
    const { task, noted } = await seedNotedTask('author', 'owner');
    await expect(resolveTaskLogNote(db, task._id, noted._id, {}, 'owner')).rejects.toThrow(/resolved/);
    // 'owner' is the assignee here — completion is unrelated to what this test
    // checks (only 'noted' log entries, not 'completed' ones, are resolvable).
    const completed = await completeTaskStage(db, db, task._id, 'understand', { note: 'done' }, 'owner');
    const completion = completed.workflow_log.find((event) => event.action === 'completed');
    await expect(resolveTaskLogNote(db, task._id, completion._id, { resolved: true }, 'owner'))
      .rejects.toThrow(ValidationError);
  });

  it('404s an unknown task', async () => {
    expect(await resolveTaskLogNote(db, 'tp-deadbeef', 'tl-x', { resolved: true }, 'owner')).toBeNull();
  });
});
