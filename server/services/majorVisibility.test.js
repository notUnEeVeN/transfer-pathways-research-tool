import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getVisibleMajors, majorScope, scopeTag, invalidateVisibilityCache,
} from './majorVisibility';
import { systemMatch, verdictMatch, scopeKey, SYSTEM_BY_KEY } from './audit/filters';

const UC = SYSTEM_BY_KEY.get('uc');

function fakeAuditDb(visible) {
  return {
    collection: (name) => ({
      findOne: async () =>
        name === 'dataset_config' && visible ? { _id: 'partner_access', visible_majors: visible } : null,
    }),
  };
}

const reqFor = (uid, visible) => ({
  user: { uid },
  app: { locals: { db: null, auditDb: fakeAuditDb(visible) } },
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

  it('admins are unrestricted (null)', async () => {
    expect(await majorScope(reqFor('admin-1', ['CS']))).toBeNull();
  });

  it('partners get the configured subset', async () => {
    expect(await majorScope(reqFor('partner-1', ['CS B.S.', 'CS B.A.']))).toEqual(['CS B.S.', 'CS B.A.']);
  });

  it('partners are denied-by-default when no config exists', async () => {
    expect(await majorScope(reqFor('partner-1', null))).toEqual([]);
    expect(await getVisibleMajors(fakeAuditDb(null))).toEqual([]);
  });
});

describe('scopeTag', () => {
  it('is "all" for admins and order-insensitive for subsets', () => {
    expect(scopeTag(null)).toBe('all');
    expect(scopeTag(['a', 'b'])).toBe(scopeTag(['b', 'a']));
    expect(scopeTag(['a'])).not.toBe(scopeTag(['a', 'b']));
    expect(scopeTag([])).not.toBe('all');
  });
});

describe('visibility in the audit query builders', () => {
  const base = { scope: 'all', schoolIds: [], majorContains: '', groupingId: null, pairs: [] };

  it('adds a $in clause on major for scoped filters', () => {
    const m = systemMatch(UC, { ...base, visibleMajors: ['CS B.S.'] });
    expect(m.major).toEqual({ $in: ['CS B.S.'] });
    const v = verdictMatch({ ...base, visibleMajors: ['CS B.S.'] });
    expect(v.major).toEqual({ $in: ['CS B.S.'] });
  });

  it('combines with majorContains via $and', () => {
    const m = systemMatch(UC, { ...base, majorContains: 'computer', visibleMajors: ['CS B.S.'] });
    expect(m.$and).toHaveLength(2);
  });

  it('leaves admin (null) filters untouched', () => {
    const m = systemMatch(UC, { ...base, visibleMajors: null });
    expect(m).toEqual({});
  });

  it('an empty subset matches nothing (deny-by-default)', () => {
    const m = systemMatch(UC, { ...base, visibleMajors: [] });
    expect(m.major).toEqual({ $in: [] });
  });

  it('cache keys separate admin and partner scopes', () => {
    expect(scopeKey({ ...base, visibleMajors: null })).toBe('all');
    expect(scopeKey({ ...base, visibleMajors: ['CS'] })).not.toBe('all');
    expect(scopeKey({ ...base, visibleMajors: ['CS'] }))
      .not.toBe(scopeKey({ ...base, visibleMajors: ['CS', 'EE'] }));
  });
});
