import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  recordRequest, listPendingRequests, removeRequest,
  blockUid, unblockUid, isBlocked, listBlocked,
} from './accessRequests';

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('access_requests_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.collection('team_members').deleteMany({});
});

describe('recordRequest', () => {
  it('creates a request doc on first attempt', async () => {
    await recordRequest(db, { uid: 'u1', email: 'a@b.edu', name: 'Ada' });
    const doc = await db.collection('team_members').findOne({ _id: 'u1' });
    expect(doc.email).toBe('a@b.edu');
    expect(doc.identity_name).toBe('Ada');
    expect(doc.request_attempts).toBe(1);
    expect(doc.access_status).toBe('pending');
    expect(doc.first_seen).toBeInstanceOf(Date);
    expect(doc.last_seen).toBeInstanceOf(Date);
  });

  it('increments attempts and bumps last_seen on repeat attempts, keeping first_seen', async () => {
    await recordRequest(db, { uid: 'u1', email: 'a@b.edu', name: 'Ada' });
    const first = await db.collection('team_members').findOne({ _id: 'u1' });
    await new Promise((r) => setTimeout(r, 5));
    await recordRequest(db, { uid: 'u1', email: 'a@b.edu', name: 'Ada' });
    const doc = await db.collection('team_members').findOne({ _id: 'u1' });
    expect(doc.request_attempts).toBe(2);
    expect(doc.first_seen.getTime()).toBe(first.first_seen.getTime());
    expect(doc.last_seen.getTime()).toBeGreaterThan(first.last_seen.getTime());
  });

  it('refreshes email/name from the token on later attempts and tolerates missing fields', async () => {
    await recordRequest(db, { uid: 'u1' });
    let doc = await db.collection('team_members').findOne({ _id: 'u1' });
    expect(doc.email).toBeNull();
    expect(doc.identity_name).toBeNull();
    await recordRequest(db, { uid: 'u1', email: 'new@b.edu', name: 'Ada L.' });
    doc = await db.collection('team_members').findOne({ _id: 'u1' });
    expect(doc.email).toBe('new@b.edu');
    expect(doc.identity_name).toBe('Ada L.');
  });

  it('rejects a missing uid', async () => {
    await expect(recordRequest(db, { email: 'a@b.edu' })).rejects.toThrow(/uid/i);
  });
});

describe('listPendingRequests', () => {
  it('lists requests newest-attempt first', async () => {
    await recordRequest(db, { uid: 'old', email: 'old@b.edu' });
    await new Promise((r) => setTimeout(r, 5));
    await recordRequest(db, { uid: 'new', email: 'new@b.edu' });
    const rows = await listPendingRequests(db);
    expect(rows.map((r) => r.uid)).toEqual(['new', 'old']);
  });

  it('excludes uids that already hold a grant', async () => {
    await recordRequest(db, { uid: 'pending' });
    await recordRequest(db, { uid: 'granted-later' });
    await db.collection('team_members').updateOne(
      { _id: 'granted-later' }, { $set: { access_status: 'granted' } }
    );
    const rows = await listPendingRequests(db);
    expect(rows.map((r) => r.uid)).toEqual(['pending']);
  });

  it('excludes admin uids', async () => {
    await recordRequest(db, { uid: 'admin-1' });
    await recordRequest(db, { uid: 'pending' });
    const rows = await listPendingRequests(db, { isAdminUid: (u) => u === 'admin-1' });
    expect(rows.map((r) => r.uid)).toEqual(['pending']);
  });

  it('returns plain rows with uid instead of _id', async () => {
    await recordRequest(db, { uid: 'u1', email: 'a@b.edu', name: 'Ada' });
    const [row] = await listPendingRequests(db);
    expect(row.uid).toBe('u1');
    expect(row._id).toBeUndefined();
    expect(row).toMatchObject({ email: 'a@b.edu', name: 'Ada', attempts: 1 });
  });
});

describe('removeRequest', () => {
  it('dismisses the request and reports whether one existed', async () => {
    await recordRequest(db, { uid: 'u1' });
    expect(await removeRequest(db, 'u1')).toBe(true);
    expect(await db.collection('team_members').countDocuments({ access_status: 'pending' })).toBe(0);
    expect((await db.collection('team_members').findOne({ _id: 'u1' })).access_status).toBe('revoked');
    expect(await removeRequest(db, 'u1')).toBe(false);
  });
});

describe('blockUid / isBlocked / unblockUid / listBlocked', () => {
  it('records a block (with who/when) and clears any pending request', async () => {
    await recordRequest(db, { uid: 'u1', email: 'a@b.edu', name: 'Ada' });
    await blockUid(db, { uid: 'u1', email: 'a@b.edu', name: 'Ada', blockedBy: 'admin' });
    const block = await db.collection('team_members').findOne({ _id: 'u1' });
    expect(block).toMatchObject({
      email: 'a@b.edu', identity_name: 'Ada', blocked_by: 'admin', access_status: 'blocked',
    });
    expect(block.blocked_at).toBeInstanceOf(Date);
    expect(await db.collection('team_members').countDocuments({ _id: 'u1', access_status: 'pending' })).toBe(0);
  });

  it('rejects a missing uid', async () => {
    await expect(blockUid(db, { email: 'a@b.edu' })).rejects.toThrow(/uid/i);
  });

  it('isBlocked reflects the block state', async () => {
    expect(await isBlocked(db, 'u1')).toBe(false);
    await blockUid(db, { uid: 'u1' });
    expect(await isBlocked(db, 'u1')).toBe(true);
  });

  it('refreshes email/name on a repeat block', async () => {
    await blockUid(db, { uid: 'u1', email: null, name: null });
    await blockUid(db, { uid: 'u1', email: 'new@b.edu', name: 'Ada L.' });
    const block = await db.collection('team_members').findOne({ _id: 'u1' });
    expect(block).toMatchObject({ email: 'new@b.edu', identity_name: 'Ada L.' });
    expect(await db.collection('team_members').countDocuments({ access_status: 'blocked' })).toBe(1);
  });

  it('unblockUid deletes and reports whether one existed', async () => {
    await blockUid(db, { uid: 'u1' });
    expect(await unblockUid(db, 'u1')).toBe(true);
    expect(await isBlocked(db, 'u1')).toBe(false);
    expect(await unblockUid(db, 'u1')).toBe(false);
  });

  it('listBlocked returns plain rows (uid, not _id) newest-first', async () => {
    await blockUid(db, { uid: 'old', email: 'old@b.edu' });
    await new Promise((r) => setTimeout(r, 5));
    await blockUid(db, { uid: 'new', email: 'new@b.edu' });
    const rows = await listBlocked(db);
    expect(rows.map((r) => r.uid)).toEqual(['new', 'old']);
    expect(rows[0]._id).toBeUndefined();
    expect(rows[0]).toMatchObject({ email: 'new@b.edu' });
  });
});

describe('listPendingRequests excludes blocked uids', () => {
  it('a blocked uid never surfaces as pending, even if a request doc lingers', async () => {
    await recordRequest(db, { uid: 'pending' });
    await recordRequest(db, { uid: 'blocked' });
    // Block without going through the controller path — simulate a stale
    // request doc that outlived the block, proving the list is a safety net.
    await db.collection('team_members').updateOne(
      { _id: 'blocked' }, { $set: { access_status: 'blocked', blocked_at: new Date() } }
    );
    const rows = await listPendingRequests(db);
    expect(rows.map((r) => r.uid)).toEqual(['pending']);
  });
});
