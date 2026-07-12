import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  looksLikeApiToken, uidForToken, createToken, listTokens, revokeToken, _clearTokenCache,
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
