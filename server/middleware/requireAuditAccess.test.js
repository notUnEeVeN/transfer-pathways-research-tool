import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import requireAuditAccess from './requireAuditAccess';
import { invalidateGrantsCache } from '../services/access';

function fakeApp(grantUids) {
  return {
    locals: {
      db: null,
      auditDb: {
        collection: (name) => ({
          find: () => ({
            toArray: async () => name === 'team_members'
              ? grantUids.map((uid) => ({ _id: uid }))
              : [],
          }),
        }),
      },
    },
  };
}

function makeRes() {
  return { sendStatus: vi.fn() };
}

describe('requireAuditAccess', () => {
  let prev;
  beforeEach(() => {
    prev = process.env.ADMIN_UIDS;
    process.env.ADMIN_UIDS = 'admin-uid';
    invalidateGrantsCache();
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_UIDS;
    else process.env.ADMIN_UIDS = prev;
    invalidateGrantsCache();
  });

  it('calls next() for an admin', async () => {
    const req = { user: { uid: 'admin-uid' }, app: fakeApp([]) };
    const res = makeRes();
    const next = vi.fn();

    await requireAuditAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });

  it('calls next() for a granted partner', async () => {
    const req = { user: { uid: 'partner-uid' }, app: fakeApp(['partner-uid']) };
    const res = makeRes();
    const next = vi.fn();

    await requireAuditAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });

  it('responds 403 for a stranger', async () => {
    const req = { user: { uid: 'someone-else' }, app: fakeApp(['partner-uid']) };
    const res = makeRes();
    const next = vi.fn();

    await requireAuditAccess(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when req.user is missing (defensive)', async () => {
    const req = { app: fakeApp([]) };
    const res = makeRes();
    const next = vi.fn();

    await requireAuditAccess(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
