import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseUids, isAdmin, isConsoleAllowed, invalidateGrantsCache } from './access';

function fakeAuditDb(grantUids) {
  return {
    collection: (name) => ({
      find: () => ({
        toArray: async () => name === 'team_members'
          ? grantUids.map((uid) => ({ _id: uid }))
          : [],
      }),
    }),
  };
}

describe('parseUids', () => {
  it('parses a comma-separated value, trimming whitespace', () => {
    expect(parseUids(' a, b ,c ')).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns an empty set for unset/empty values', () => {
    expect(parseUids(undefined).size).toBe(0);
    expect(parseUids(' , ,').size).toBe(0);
  });
});

describe('isAdmin', () => {
  it('allows only env-listed admins', () => {
    const env = { ADMIN_UIDS: 'admin-1,admin-2' };
    expect(isAdmin('admin-1', env)).toBe(true);
    expect(isAdmin('partner-1', env)).toBe(false);
    expect(isAdmin(undefined, env)).toBe(false);
  });
});

describe('isConsoleAllowed', () => {
  beforeEach(() => invalidateGrantsCache());
  afterEach(() => invalidateGrantsCache());

  const env = { ADMIN_UIDS: 'admin-1' };

  it('allows admins without touching the grants collection', async () => {
    const db = { collection: () => { throw new Error('should not be called'); } };
    expect(await isConsoleAllowed('admin-1', db, env)).toBe(true);
  });

  it('allows granted partners', async () => {
    expect(await isConsoleAllowed('partner-1', fakeAuditDb(['partner-1']), env)).toBe(true);
  });

  it('denies ungranted, empty and missing uids', async () => {
    const db = fakeAuditDb(['partner-1']);
    expect(await isConsoleAllowed('partner-2', db, env)).toBe(false);
    invalidateGrantsCache();
    expect(await isConsoleAllowed('', db, env)).toBe(false);
    expect(await isConsoleAllowed(undefined, db, env)).toBe(false);
  });

  it('reflects a revoke after the cache is invalidated', async () => {
    expect(await isConsoleAllowed('partner-1', fakeAuditDb(['partner-1']), env)).toBe(true);
    invalidateGrantsCache();
    expect(await isConsoleAllowed('partner-1', fakeAuditDb([]), env)).toBe(false);
  });
});
