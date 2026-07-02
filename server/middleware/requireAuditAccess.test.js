import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import requireAuditAccess from './requireAuditAccess';

function makeRes() {
  return { sendStatus: vi.fn() };
}

describe('requireAuditAccess', () => {
  let prev;
  beforeEach(() => {
    prev = process.env.AUDIT_ALLOWLIST_UIDS;
    process.env.AUDIT_ALLOWLIST_UIDS = 'allowed-uid,other-allowed-uid';
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.AUDIT_ALLOWLIST_UIDS;
    else process.env.AUDIT_ALLOWLIST_UIDS = prev;
  });

  it('calls next() for an allowed UID', () => {
    const req = { user: { uid: 'allowed-uid' } };
    const res = makeRes();
    const next = vi.fn();

    requireAuditAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });

  it('responds 403 and does not call next for a non-allowed UID', () => {
    const req = { user: { uid: 'someone-else' } };
    const res = makeRes();
    const next = vi.fn();

    requireAuditAccess(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when req.user is missing (defensive)', () => {
    const req = {};
    const res = makeRes();
    const next = vi.fn();

    requireAuditAccess(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies everything when the allowlist env is unset', () => {
    delete process.env.AUDIT_ALLOWLIST_UIDS;
    const req = { user: { uid: 'allowed-uid' } };
    const res = makeRes();
    const next = vi.fn();

    requireAuditAccess(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
