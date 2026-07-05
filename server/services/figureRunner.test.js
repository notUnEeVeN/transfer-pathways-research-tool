import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { startInMemoryMongo } from '../test/mongoHarness';
import { executeScript, runAsUser, createRunQueue } from './figureRunner';
import { looksLikeApiToken } from './apiTokens';

// The runner spawns a real python3 — these tests exercise the actual spawn
// path with stdlib-only fixture scripts (no pandas/matplotlib needed).
const PYTHON = (() => {
  try { return execSync('which python3', { encoding: 'utf8' }).trim(); } catch { return null; }
})();

const PMT_STUB = '# pmt.py stub written by the runner\n';

let workRoot;
beforeEach(async () => {
  workRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-test-'));
});

const run = (code, opts = {}) =>
  executeScript({
    code,
    pmtSource: PMT_STUB,
    pythonBin: PYTHON,
    apiBaseUrl: 'http://127.0.0.1:9999',
    token: 'pmtr_' + 'x'.repeat(32),
    workRoot,
    ...opts,
  });

describe.skipIf(!PYTHON)('executeScript', () => {
  it('runs a script to completion and returns the captured publish payload', async () => {
    const result = await run(`
import json, os
payload = {"slug": "test-fig", "title": "T", "formats": {"svg": "aGk="}}
json.dump(payload, open(os.environ["PMT_CAPTURE"], "w"))
print("done")
`);
    expect(result.status).toBe('ok');
    expect(result.captured).toEqual({ slug: 'test-fig', title: 'T', formats: { svg: 'aGk=' } });
    expect(result.log).toContain('done');
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('gives the subprocess a sanitized environment — secrets never cross', async () => {
    process.env.MONGO_URI = 'mongodb://secret';
    process.env.AUDIT_MONGO_URI = 'mongodb://secret2';
    process.env.FIREBASE_SERVICE_ACCOUNT = '{"private_key":"shh"}';
    process.env.ADMIN_UIDS = 'admin-1';
    try {
      const result = await run(`
import json, os
json.dump({"env": dict(os.environ)}, open(os.environ["PMT_CAPTURE"], "w"))
`);
      expect(result.status).toBe('ok');
      const env = result.captured.env;
      expect(env.MONGO_URI).toBeUndefined();
      expect(env.AUDIT_MONGO_URI).toBeUndefined();
      expect(env.FIREBASE_SERVICE_ACCOUNT).toBeUndefined();
      expect(env.ADMIN_UIDS).toBeUndefined();
      expect(env.PMT_TOKEN).toBe('pmtr_' + 'x'.repeat(32));
      expect(env.PMT_API_URL).toBe('http://127.0.0.1:9999');
      expect(env.MPLBACKEND).toBe('Agg');
    } finally {
      delete process.env.MONGO_URI;
      delete process.env.AUDIT_MONGO_URI;
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.ADMIN_UIDS;
    }
  });

  it('places pmt.py next to the script so `import pmt` resolves', async () => {
    const result = await run(`
import json, os
json.dump({"files": sorted(os.listdir(".")), "pmt_head": open("pmt.py").read()[:10]},
          open(os.environ["PMT_CAPTURE"], "w"))
`);
    expect(result.status).toBe('ok');
    expect(result.captured.files).toContain('pmt.py');
    expect(result.captured.files).toContain('script.py');
    expect(result.captured.pmt_head).toBe(PMT_STUB.slice(0, 10));
  });

  it('reports a raising script as error with the traceback in the log', async () => {
    const result = await run('raise ValueError("boom")');
    expect(result.status).toBe('error');
    expect(result.exitCode).not.toBe(0);
    expect(result.log).toContain('ValueError: boom');
    expect(result.captured).toBeNull();
  });

  it('kills a runaway script at the timeout', async () => {
    const started = Date.now();
    const result = await run('import time\ntime.sleep(30)', { timeoutMs: 400 });
    expect(result.status).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.log).toContain('killed');
  });

  it('caps runaway output instead of buffering it all', async () => {
    const result = await run('print("x" * 500000)', { maxOutputBytes: 10_000 });
    expect(result.log.length).toBeLessThan(11_000);
    expect(result.log).toContain('truncated');
  });

  it('interleaves stdout and stderr into one log', async () => {
    const result = await run(`
import sys
print("to stdout")
print("to stderr", file=sys.stderr)
`);
    expect(result.log).toContain('to stdout');
    expect(result.log).toContain('to stderr');
  });

  it('treats a malformed capture file as an error', async () => {
    const result = await run(`
import os
open(os.environ["PMT_CAPTURE"], "w").write("{not json")
`);
    expect(result.status).toBe('error');
    expect(result.captured).toBeNull();
    expect(result.log).toContain('capture');
  });

  it('a clean exit without a capture is ok with captured=null (caller decides)', async () => {
    const result = await run('print("no publish call")');
    expect(result.status).toBe('ok');
    expect(result.captured).toBeNull();
  });

  it('cleans its workdir up afterwards, success or timeout', async () => {
    await run('print("hi")');
    await run('import time\ntime.sleep(30)', { timeoutMs: 300 });
    expect(await fs.readdir(workRoot)).toEqual([]);
  });

  it('resolves when the script exits even if a spawned grandchild keeps stdio open', async () => {
    const started = Date.now();
    const result = await run(`
import json, os, subprocess
subprocess.Popen(["sleep", "30"])  # inherits our stdout/stderr pipes
json.dump({"slug": "t", "title": "T", "formats": {"svg": "aGk="}},
          open(os.environ["PMT_CAPTURE"], "w"))
print("parent done")
`, { timeoutMs: 20_000 });
    expect(result.status).toBe('ok');
    expect(result.captured?.slug).toBe('t');
    expect(Date.now() - started).toBeLessThan(10_000); // not held hostage by the sleeper
  });

  it('never puts the partner-writable workdir first on PATH', async () => {
    const result = await run(`
import json, os
json.dump({"path": os.environ["PATH"]}, open(os.environ["PMT_CAPTURE"], "w"))
`);
    expect(result.status).toBe('ok');
    const p = result.captured.path;
    expect(p.startsWith('.')).toBe(false);
    expect(p.split(':')).toContain('/usr/bin');
    // absolute interpreters get their own dir prepended so venv siblings resolve
    expect(p.split(':')[0]).toBe(path.dirname(PYTHON));
  });
});

describe.skipIf(!PYTHON)('runAsUser', () => {
  let mongo;
  let db;

  beforeAll(async () => {
    mongo = await startInMemoryMongo();
    db = mongo.client.db('runner_test');
  }, 60_000);
  afterAll(async () => { await mongo.stop(); });
  beforeEach(async () => { await db.collection('api_tokens').deleteMany({}); });

  const runAs = (code, opts = {}) =>
    runAsUser({
      auditDb: db,
      uid: 'author-1',
      code,
      pmtSource: PMT_STUB,
      pythonBin: PYTHON,
      apiBaseUrl: 'http://127.0.0.1:9999',
      workRoot,
      ...opts,
    });

  it('mints a real ephemeral token for the run and revokes it afterwards', async () => {
    const result = await runAs(`
import json, os
json.dump({"token": os.environ["PMT_TOKEN"]}, open(os.environ["PMT_CAPTURE"], "w"))
`);
    expect(result.status).toBe('ok');
    expect(looksLikeApiToken(result.captured.token)).toBe(true);
    expect(await db.collection('api_tokens').countDocuments({})).toBe(0);
  });

  it('revokes the token even when the script fails', async () => {
    const result = await runAs('raise RuntimeError("nope")');
    expect(result.status).toBe('error');
    expect(await db.collection('api_tokens').countDocuments({})).toBe(0);
  });
});

describe('createRunQueue', () => {
  it('runs jobs one at a time in order', async () => {
    const queue = createRunQueue({ concurrency: 1, maxPending: 10 });
    let active = 0;
    let maxActive = 0;
    const order = [];
    const job = (name) => async () => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      order.push(name); active--;
      return name;
    };
    const results = await Promise.all([queue.push(job('a')), queue.push(job('b')), queue.push(job('c'))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(maxActive).toBe(1);
  });

  it('rejects with QUEUE_FULL beyond its depth instead of piling up', async () => {
    const queue = createRunQueue({ concurrency: 1, maxPending: 1 });
    const slow = () => new Promise((r) => setTimeout(r, 100));
    const first = queue.push(slow);   // occupies the runner
    const second = queue.push(slow);  // waits
    await expect(queue.push(slow)).rejects.toMatchObject({ code: 'QUEUE_FULL' });
    await Promise.all([first, second]);
  });

  it('keeps serving after a job throws', async () => {
    const queue = createRunQueue({ concurrency: 1, maxPending: 10 });
    await expect(queue.push(() => Promise.reject(new Error('bad')))).rejects.toThrow('bad');
    await expect(queue.push(async () => 'fine')).resolves.toBe('fine');
  });

  it('maxPending 0 accepts jobs when idle and rejects only while busy', async () => {
    const queue = createRunQueue({ concurrency: 1, maxPending: 0 });
    let release;
    const first = queue.push(() => new Promise((r) => { release = r; }));
    await expect(queue.push(async () => 'never')).rejects.toMatchObject({ code: 'QUEUE_FULL' });
    release('done');
    await expect(first).resolves.toBe('done');
    await expect(queue.push(async () => 'again')).resolves.toBe('again');
  });
});
