import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { recordAuditVerdictFix, listTasks } = cjs('./tasks');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('tasks_auditfix_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  await db.collection('tasks').deleteMany({});
  await db.collection('team_members').deleteMany({});
});

const verdict = (docId, result, note = null) =>
  recordAuditVerdictFix(db, {
    docId,
    result,
    label: `UC Berkeley · Evergreen Valley College · CS — ${result}`,
    note,
  }, 'auditor');

describe('audit verdicts feed the standing Audit fixes task', () => {
  it('first error verdict creates the task in todo with one item', async () => {
    const task = await verdict('aaa111', 'error', 'row 3 mis-parsed');
    expect(task.task_type).toBe('audit_fix');
    expect(task.title).toBe('Audit fixes');
    expect(task.status).toBe('todo');
    expect(task.checklist_items).toEqual([
      { key: 'doc_aaa111', label: 'UC Berkeley · Evergreen Valley College · CS — error' },
    ]);
    // The verdict note rides along as a stage note.
    expect(task.workflow_log.at(-1)).toMatchObject({ stage: 'doc_aaa111', action: 'noted', note: 'row 3 mis-parsed' });
  });

  it('later verdicts append to the same task; re-verdicts on a doc dedupe', async () => {
    await verdict('aaa111', 'error');
    await verdict('bbb222', 'conservative');
    const again = await verdict('aaa111', 'error', 'still broken');
    expect(again.checklist_items.map((i) => i.key)).toEqual(['doc_aaa111', 'doc_bbb222']);
    // The repeat verdict contributed its note instead of a duplicate item.
    expect(again.workflow_log.at(-1)).toMatchObject({ stage: 'doc_aaa111', action: 'noted', note: 'still broken' });
    const all = await listTasks(db);
    expect(all.filter((t) => t.task_type === 'audit_fix')).toHaveLength(1);
  });

  it('a correct re-audit auto-completes the doc item', async () => {
    await verdict('aaa111', 'error');
    await verdict('bbb222', 'error');
    const task = await verdict('aaa111', 'correct');
    expect(task.workflow_stages.doc_aaa111).toMatchObject({ completed: true, note: 'Re-audited correct.' });
    expect(task.workflow_stages.doc_bbb222).toBeUndefined();
    expect(task.progress).toBe(50);
    // No auto-done even at 100% — the checklist contract holds.
    const done = await verdict('bbb222', 'correct');
    expect(done.progress).toBe(100);
    expect(done.status).not.toBe('done');
  });

  it('a correct verdict never creates the task, and a regression reopens a fixed item', async () => {
    expect(await verdict('zzz999', 'correct')).toBeNull();
    await verdict('aaa111', 'error');
    await verdict('aaa111', 'correct');
    const regressed = await verdict('aaa111', 'error', 'regressed after parser change');
    expect(regressed.workflow_stages.doc_aaa111).toBeUndefined();
    expect(regressed.checklist_items).toHaveLength(1);
    const reopenEvent = regressed.workflow_log.find((e) => e.action === 'reopened');
    expect(reopenEvent).toMatchObject({ stage: 'doc_aaa111', note: 'Re-audited error.' });
  });
});
