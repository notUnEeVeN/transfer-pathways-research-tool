import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getVisiblePairs, majorScope, pairAllowed, pairClause, scopeTag, invalidateVisibilityCache,
  normalizePairs,
} from './majorVisibility';
import { systemMatch, verdictMatch, scopeKey, SYSTEM_BY_KEY } from './audit/filters';

const UC = SYSTEM_BY_KEY.get('uc');
const CS_AT_1 = { school_id: 1, major: 'Computer Science B.S.' };
const CS_AT_2 = { school_id: 2, major: 'Computer Science B.S.' };
const MATH_AT_1 = { school_id: 1, major: 'Mathematics B.S.' };

function fakeAuditDb(pairs) {
  return {
    collection: (name) => ({
      findOne: async () =>
        name === 'settings' && pairs ? { _id: 'app', visible_pairs: pairs } : null,
    }),
  };
}

const reqFor = (uid, pairs) => ({
  user: { uid },
  app: { locals: { db: null, auditDb: fakeAuditDb(pairs) } },
});

describe('majorScope', () => {
  let prev;
  beforeEach(() => {
    prev = process.env.ADMIN_UIDS;
    process.env.ADMIN_UIDS = 'admin-1';
    invalidateVisibilityCache();
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_UIDS;
    else process.env.ADMIN_UIDS = prev;
    invalidateVisibilityCache();
  });

  it('a saved selection scopes EVERYONE — the admin included', async () => {
    expect(await majorScope(reqFor('admin-1', [CS_AT_1]))).toEqual([CS_AT_1]);
    invalidateVisibilityCache();
    expect(await majorScope(reqFor('partner-1', [CS_AT_1]))).toEqual([CS_AT_1]);
  });

  it('pairs are normalized (string ids become numbers)', async () => {
    const scope = await majorScope(reqFor('partner-1', [{ school_id: '1', major: 'Computer Science B.S.' }]));
    expect(scope).toEqual([CS_AT_1]);
  });

  it('keeps several majors at the same campus', async () => {
    expect(normalizePairs([CS_AT_1, MATH_AT_1, CS_AT_2]))
      .toEqual([CS_AT_1, MATH_AT_1, CS_AT_2]);
    expect(await majorScope(reqFor('partner-1', [CS_AT_1, MATH_AT_1, CS_AT_2])))
      .toEqual([CS_AT_1, MATH_AT_1, CS_AT_2]);
  });

  it('drops exact duplicate pairs, preserving order', () => {
    expect(normalizePairs([CS_AT_1, MATH_AT_1, CS_AT_1]))
      .toEqual([CS_AT_1, MATH_AT_1]);
  });

  it('before any selection exists: admins unrestricted, partners denied', async () => {
    expect(await majorScope(reqFor('admin-1', null))).toBeNull();
    invalidateVisibilityCache();
    expect(await majorScope(reqFor('partner-1', null))).toEqual([]);
    invalidateVisibilityCache();
    expect(await getVisiblePairs(fakeAuditDb(null))).toEqual([]);
  });
});

describe('pairAllowed', () => {
  it('is per (school, major) — same major name at another school is NOT allowed', () => {
    expect(pairAllowed([CS_AT_1], 1, 'Computer Science B.S.')).toBe(true);
    expect(pairAllowed([CS_AT_1], 2, 'Computer Science B.S.')).toBe(false);
    expect(pairAllowed([CS_AT_1], 1, 'Mathematics B.S.')).toBe(false);
  });

  it('null scope (admin) allows everything; empty scope allows nothing', () => {
    expect(pairAllowed(null, 9, 'Anything')).toBe(true);
    expect(pairAllowed([], 1, 'Computer Science B.S.')).toBe(false);
  });
});

describe('scopeTag', () => {
  it('is "all" for admins and order-insensitive for subsets', () => {
    expect(scopeTag(null)).toBe('all');
    expect(scopeTag([CS_AT_1, CS_AT_2])).toBe(scopeTag([CS_AT_2, CS_AT_1]));
    expect(scopeTag([CS_AT_1])).not.toBe(scopeTag([CS_AT_1, CS_AT_2]));
    expect(scopeTag([])).not.toBe('all');
  });
});

describe('visibility in the audit query builders', () => {
  const base = { scope: 'all', schoolIds: [], majorContains: '', groupingId: null, pairs: [] };

  it('adds a per-pair $or clause for scoped filters', () => {
    const m = systemMatch(UC, { ...base, visiblePairs: [CS_AT_1, CS_AT_2] });
    expect(m.$or).toEqual([
      { uc_school_id: 1, major: 'Computer Science B.S.' },
      { uc_school_id: 2, major: 'Computer Science B.S.' },
    ]);
    const v = verdictMatch({ ...base, visiblePairs: [CS_AT_1] });
    expect(v.$or).toEqual([{ uc_school_id: 1, major: 'Computer Science B.S.' }]);
  });

  it('combines with majorContains via $and', () => {
    const m = systemMatch(UC, { ...base, majorContains: 'computer', visiblePairs: [CS_AT_1] });
    expect(m.$and).toHaveLength(2);
  });

  it('leaves admin (null) filters untouched', () => {
    const m = systemMatch(UC, { ...base, visiblePairs: null });
    expect(m).toEqual({});
  });

  it('an empty subset matches nothing (deny-by-default)', () => {
    const m = systemMatch(UC, { ...base, visiblePairs: [] });
    expect(m._id).toEqual({ $exists: false });
    expect(pairClause([], 'uc_school_id')).toEqual({ _id: { $exists: false } });
  });

  it('cache keys separate admin and partner scopes', () => {
    expect(scopeKey({ ...base, visiblePairs: null })).toBe('all');
    expect(scopeKey({ ...base, visiblePairs: [CS_AT_1] })).not.toBe('all');
    expect(scopeKey({ ...base, visiblePairs: [CS_AT_1] }))
      .not.toBe(scopeKey({ ...base, visiblePairs: [CS_AT_1, CS_AT_2] }));
  });
});
