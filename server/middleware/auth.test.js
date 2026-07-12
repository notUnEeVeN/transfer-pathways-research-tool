import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);

// config/firebase.js (required by auth.js) demands a structurally valid
// service account at import time; a throwaway key satisfies cert() and the
// pmtr_ paths under test never call Firebase.
process.env.PRIVATE_KEY = execSync('openssl genrsa 2048 2>/dev/null', { encoding: 'utf8' });
process.env.TYPE = 'service_account';
process.env.PROJECT_ID = 'auth-test-dummy';
process.env.CLIENT_EMAIL = 'svc@auth-test-dummy.iam.gserviceaccount.com';

const { startInMemoryMongo } = cjs('../test/mongoHarness');
const authenticateToken = cjs('./auth');
const { createToken, _clearTokenCache } = cjs('../services/apiTokens');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('auth_mw_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });

const run = (token, method = 'GET') => new Promise((resolve) => {
  const req = {
    method,
    header: (h) => (h === 'Authorization' ? `Bearer ${token}` : undefined),
    app: { locals: { db, auditDb: db } },
  };
  const res = {
    statusCode: 200,
    body: undefined,
    sendStatus(c) { this.statusCode = c; resolve({ req, res: this, nexted: false }); },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; resolve({ req, res: this, nexted: false }); },
  };
  authenticateToken(req, res, () => resolve({ req, res, nexted: true }));
});

describe('authenticateToken — pmtr_ tokens', () => {
  it('personal tokens pass any method', async () => {
    _clearTokenCache();
    const token = await createToken(db, 'partner-1', 'laptop');
    const get = await run(token, 'GET');
    expect(get.nexted).toBe(true);
    expect(get.req.user).toMatchObject({ uid: 'partner-1', api_token: true });
    const post = await run(token, 'POST');
    expect(post.nexted).toBe(true);
  });
});
