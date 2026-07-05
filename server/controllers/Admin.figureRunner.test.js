import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { getFigureRunner, putFigureRunner } = cjs('./Admin');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('admin_figure_runner_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.collection('dataset_config').deleteMany({}); });

const fakeReq = (body = {}) => ({
  user: { uid: 'admin1' }, body, params: {},
  app: { locals: { db, auditDb: db } },
});
const fakeRes = () => ({
  statusCode: 200, body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(o) { this.body = o; return this; },
});
const run = (handler, req) => new Promise((resolve, reject) => {
  const res = fakeRes();
  Promise.resolve(handler(req, res, (e) => (e ? reject(e) : resolve(res)))).then(() => resolve(res), reject);
});

describe('admin figure-runner pause switch', () => {
  it('defaults to running, pauses, and resumes', async () => {
    expect((await run(getFigureRunner, fakeReq())).body).toMatchObject({ paused: false });
    expect((await run(putFigureRunner, fakeReq({ paused: true }))).body).toMatchObject({ ok: true, paused: true });
    expect((await run(getFigureRunner, fakeReq())).body).toMatchObject({ paused: true });
    await run(putFigureRunner, fakeReq({ paused: false }));
    expect((await run(getFigureRunner, fakeReq())).body).toMatchObject({ paused: false });
  });

  it('rejects a non-boolean paused', async () => {
    expect((await run(putFigureRunner, fakeReq({ paused: 'yes' }))).statusCode).toBe(400);
    expect((await run(putFigureRunner, fakeReq({}))).statusCode).toBe(400);
  });
});
