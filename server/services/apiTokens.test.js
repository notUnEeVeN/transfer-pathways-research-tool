import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  looksLikeApiToken, uidForToken, createToken, listTokens, revokeToken, _clearTokenCache,
  createEphemeralToken, resolveApiToken, TOKEN_LITERAL_RE,
} from './apiTokens';

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('tokens_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  _clearTokenCache();
  await db.collection('api_tokens').deleteMany({});
});

describe('api tokens', () => {
  it('round-trips: create → authenticate → list (no plaintext stored)', async () => {
    const token = await createToken(db, 'user-1', 'notebook');
    expect(looksLikeApiToken(token)).toBe(true);

    expect(await uidForToken(db, token)).toBe('user-1');

    const rows = await listTokens(db, 'user-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('notebook');
    expect(JSON.stringify(rows)).not.toContain(token); // only the hash is stored/listed
  });

  it('rejects unknown and malformed tokens', async () => {
    expect(await uidForToken(db, 'pmtr_' + 'x'.repeat(32))).toBeNull();
    expect(await uidForToken(db, 'eyJhbGciOi...firebase-shaped')).toBeNull();
    expect(looksLikeApiToken('pmtr_short')).toBe(false);
  });

  it('revoke works only for the owner and kills authentication', async () => {
    const token = await createToken(db, 'user-1', null);
    const [{ id }] = await listTokens(db, 'user-1');

    expect(await revokeToken(db, 'someone-else', id)).toBe(false);
    expect(await revokeToken(db, 'user-1', id)).toBe(true);

    _clearTokenCache();
    expect(await uidForToken(db, token)).toBeNull();
  });

  it('users only see their own tokens', async () => {
    await createToken(db, 'user-1', 'a');
    await createToken(db, 'user-2', 'b');
    expect(await listTokens(db, 'user-1')).toHaveLength(1);
    expect((await listTokens(db, 'user-2'))[0].label).toBe('b');
  });
});

describe('ephemeral tokens (figure runner)', () => {
  it('authenticates until revoked; revoke() takes effect immediately despite the cache', async () => {
    const { token, revoke } = await createEphemeralToken(db, 'author-1', { ttlMs: 60_000 });
    expect(looksLikeApiToken(token)).toBe(true);
    expect(await uidForToken(db, token)).toBe('author-1'); // warms the cache

    await revoke();
    expect(await uidForToken(db, token)).toBeNull(); // no _clearTokenCache() — revoke must purge
  });

  it('does not authenticate past its expiry, even when cached', async () => {
    const { token } = await createEphemeralToken(db, 'author-1', { ttlMs: 50 });
    expect(await uidForToken(db, token)).toBe('author-1'); // cached while valid
    await new Promise((r) => setTimeout(r, 80));
    expect(await uidForToken(db, token)).toBeNull();
  });

  it('never authenticates when created already expired', async () => {
    const { token } = await createEphemeralToken(db, 'author-1', { ttlMs: -1 });
    expect(await uidForToken(db, token)).toBeNull();
  });

  it('stays out of the user-facing token list', async () => {
    await createToken(db, 'author-1', 'notebook');
    await createEphemeralToken(db, 'author-1', { ttlMs: 60_000 });
    const rows = await listTokens(db, 'author-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('notebook');
  });

  it('resolveApiToken distinguishes ephemeral run tokens from durable ones', async () => {
    const durable = await createToken(db, 'author-1', 'notebook');
    const { token: ephemeral } = await createEphemeralToken(db, 'author-1', { ttlMs: 60_000 });
    expect(await resolveApiToken(db, durable)).toEqual({ uid: 'author-1', ephemeral: false });
    expect(await resolveApiToken(db, ephemeral)).toEqual({ uid: 'author-1', ephemeral: true });
    expect(await resolveApiToken(db, 'pmtr_' + 'x'.repeat(32))).toBeNull();
  });

  it('exports the literal-detection regex that matches generated tokens inside text', async () => {
    const token = await createToken(db, 'author-1', null);
    expect(TOKEN_LITERAL_RE.test(`TOKEN = "${token}"\nimport pmt`)).toBe(true);
    expect(TOKEN_LITERAL_RE.test('TOKEN = os.environ.get("PMT_TOKEN") or "pmtr_..."')).toBe(false);
  });
});
