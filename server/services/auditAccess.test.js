import { describe, it, expect } from 'vitest';
import { isAuditAllowed, parseAllowlist } from './auditAccess';

describe('parseAllowlist', () => {
  it('parses a comma-separated env value, trimming whitespace', () => {
    const uids = parseAllowlist(' uid-a, uid-b ,uid-c ');
    expect(uids).toEqual(new Set(['uid-a', 'uid-b', 'uid-c']));
  });

  it('returns an empty set for unset/empty values', () => {
    expect(parseAllowlist(undefined).size).toBe(0);
    expect(parseAllowlist('').size).toBe(0);
    expect(parseAllowlist(' , ,').size).toBe(0);
  });
});

describe('isAuditAllowed', () => {
  const uids = parseAllowlist('uid-a,uid-b');

  it('allows listed UIDs', () => {
    expect(isAuditAllowed('uid-a', uids)).toBe(true);
    expect(isAuditAllowed('uid-b', uids)).toBe(true);
  });

  it('denies any other UID', () => {
    expect(isAuditAllowed('uid-z', uids)).toBe(false);
  });

  it('denies missing/empty UIDs without throwing', () => {
    expect(isAuditAllowed(undefined, uids)).toBe(false);
    expect(isAuditAllowed(null, uids)).toBe(false);
    expect(isAuditAllowed('', uids)).toBe(false);
  });

  it('denies everything when the allowlist is empty (unset env)', () => {
    expect(isAuditAllowed('uid-a', new Set())).toBe(false);
  });
});
