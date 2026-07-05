import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  validateScriptCode, upsertScript, getScript, setScriptEnabled,
  recordRun, removeScript, listEnabledScripts, listRuns,
} from './figureScripts';

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('figure_scripts_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  await db.collection('figure_scripts').deleteMany({});
  await db.collection('figure_runs').deleteMany({});
});

describe('validateScriptCode', () => {
  it('accepts a normal script', () => {
    const { error, value } = validateScriptCode('import pmt\nprint("hi")\n');
    expect(error).toBeUndefined();
    expect(value).toContain('import pmt');
  });

  it('rejects empty or non-string code', () => {
    expect(validateScriptCode('').error).toBeTruthy();
    expect(validateScriptCode('   \n').error).toBeTruthy();
    expect(validateScriptCode(42).error).toBeTruthy();
    expect(validateScriptCode(undefined).error).toBeTruthy();
  });

  it('rejects oversized scripts', () => {
    expect(validateScriptCode('#'.repeat(300 * 1024)).error).toMatch(/200/);
  });

  it('rejects a hardcoded API token and points at the env var instead', () => {
    const code = `TOKEN = "pmtr_${'a'.repeat(32)}"\nimport pmt\n`;
    const { error } = validateScriptCode(code);
    expect(error).toMatch(/PMT_TOKEN/);
  });
});

describe('script docs', () => {
  it('creates on first upsert, keeps prior versions in history on updates', async () => {
    await upsertScript(db, 'fig-a', 'v1', { uid: 'user-1', enabled: true });
    let doc = await getScript(db, 'fig-a');
    expect(doc.code).toBe('v1');
    expect(doc.enabled).toBe(true);
    expect(doc.created_by).toBe('user-1');
    expect(doc.history).toBeUndefined(); // write-only insurance — never served

    await upsertScript(db, 'fig-a', 'v2', { uid: 'user-2', enabled: true });
    doc = await getScript(db, 'fig-a');
    expect(doc.code).toBe('v2');
    expect(doc.updated_by).toBe('user-2');
    expect(doc.created_by).toBe('user-1');
    // history assertions go to the raw doc — getScript deliberately omits it
    const raw = await db.collection('figure_scripts').findOne({ _id: 'fig-a' });
    expect(raw.history).toHaveLength(1);
    expect(raw.history[0].code).toBe('v1');
    expect(raw.history[0].updated_by).toBe('user-1');
  });

  it('caps history at 20 entries, newest first', async () => {
    for (let i = 0; i <= 25; i++) {
      await upsertScript(db, 'fig-a', `v${i}`, { uid: 'user-1', enabled: true });
    }
    const raw = await db.collection('figure_scripts').findOne({ _id: 'fig-a' });
    expect(raw.code).toBe('v25');
    expect(raw.history).toHaveLength(20);
    expect(raw.history[0].code).toBe('v24');
    expect(raw.history[19].code).toBe('v5');
  });

  it('toggles enabled and clears the failure streak on re-enable', async () => {
    await upsertScript(db, 'fig-a', 'v1', { uid: 'user-1', enabled: true });
    await recordRun(db, 'fig-a', { status: 'error', trigger: 'dataset', log: 'x' });
    expect((await getScript(db, 'fig-a')).consecutive_failures).toBe(1);

    expect(await setScriptEnabled(db, 'fig-a', false)).toBe(true);
    expect((await getScript(db, 'fig-a')).enabled).toBe(false);

    await setScriptEnabled(db, 'fig-a', true);
    const doc = await getScript(db, 'fig-a');
    expect(doc.enabled).toBe(true);
    expect(doc.consecutive_failures).toBe(0);

    expect(await setScriptEnabled(db, 'missing', true)).toBe(false);
  });

  it('removes the script and its run log together', async () => {
    await upsertScript(db, 'fig-a', 'v1', { uid: 'user-1', enabled: true });
    await recordRun(db, 'fig-a', { status: 'ok', trigger: 'publish', log: '' });
    await removeScript(db, 'fig-a');
    expect(await getScript(db, 'fig-a')).toBeNull();
    expect(await db.collection('figure_runs').countDocuments({})).toBe(0);
  });

  it('lists only enabled scripts for the scheduler, with their last-run dataset version', async () => {
    await upsertScript(db, 'fig-a', 'a', { uid: 'u', enabled: true });
    await upsertScript(db, 'fig-b', 'b', { uid: 'u', enabled: false });
    await recordRun(db, 'fig-a', { status: 'ok', trigger: 'publish', log: '', dataset_version: '2026-07-01-v1' });
    const scripts = await listEnabledScripts(db);
    expect(scripts.map((s) => s.slug)).toEqual(['fig-a']);
    expect(scripts[0].code).toBe('a');
    expect(scripts[0].runs_as).toBe('u');
    expect(scripts[0].last_dataset_version).toBe('2026-07-01-v1');
  });
});

describe('run recording', () => {
  beforeEach(async () => {
    await upsertScript(db, 'fig-a', 'v1', { uid: 'user-1', enabled: true });
  });

  it('tracks the failure streak: errors count up, success resets', async () => {
    expect(await recordRun(db, 'fig-a', { status: 'error', trigger: 'dataset', log: 'l1' })).toBe(1);
    expect(await recordRun(db, 'fig-a', { status: 'timeout', trigger: 'dataset', log: 'l2' })).toBe(2);
    expect(await recordRun(db, 'fig-a', { status: 'ok', trigger: 'manual', log: 'l3' })).toBe(0);
    const doc = await getScript(db, 'fig-a');
    expect(doc.last_run.status).toBe('ok');
    expect(doc.last_run.trigger).toBe('manual');
  });

  it('a failed run does not erase the version memory of the last successful compute', async () => {
    await recordRun(db, 'fig-a', { status: 'ok', trigger: 'dataset', log: '', dataset_version: 'v5' });
    await recordRun(db, 'fig-a', { status: 'error', trigger: 'manual', log: 'boom' });
    const [script] = await listEnabledScripts(db);
    expect(script.last_dataset_version).toBe('v5'); // still "computed at v5" — the render on display IS v5
    expect((await getScript(db, 'fig-a')).last_run.status).toBe('error');
  });

  it('appends to figure_runs, newest first via listRuns', async () => {
    await recordRun(db, 'fig-a', { status: 'error', trigger: 'dataset', log: 'first' });
    await recordRun(db, 'fig-a', { status: 'ok', trigger: 'manual', log: 'second', duration_ms: 42 });
    const runs = await listRuns(db, 'fig-a');
    expect(runs).toHaveLength(2);
    expect(runs[0].log).toBe('second');
    expect(runs[0].duration_ms).toBe(42);
    expect(runs[1].log).toBe('first');
  });

  it('truncates huge logs in the embedded last_run', async () => {
    await recordRun(db, 'fig-a', { status: 'error', trigger: 'dataset', log: 'y'.repeat(100_000) });
    const doc = await getScript(db, 'fig-a');
    expect(doc.last_run.log.length).toBeLessThanOrEqual(16_384);
  });
});
