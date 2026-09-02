import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { auditRollbackReadiness } = require('./auditRollbackReadiness');

describe('Virginia rollback release invariant', () => {
  it('pins both complete snapshot contracts and the restore publication tombstone', async () => {
    await expect(auditRollbackReadiness()).resolves.toEqual({
      projection: {
        target_count: 4,
        exact_snapshot_valid: true,
        tampered_snapshot_rejected: true,
        mixed_generation_rejected: true,
        transactional_restore_exported: true,
      },
      prerequisites: {
        target_count: 3,
        exact_snapshot_valid: true,
        tampered_snapshot_rejected: true,
        mixed_generation_rejected: true,
        transactional_restore_exported: true,
      },
      publication_restore_tombstone_fails_closed: true,
      prerequisite_restore_tombstone_fails_closed: true,
      ready: true,
    });
  });
});
