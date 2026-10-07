import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const { degreeAuditQuery } = createRequire(import.meta.url)('./auditDegreeStandard');

describe('UC degree audit scope', () => {
  it('does not apply California caps, GE patterns, or catalog years to MA and VA', () => {
    expect(degreeAuditQuery()).toMatchObject({
      kind: 'degree', state: { $exists: false },
      school_id: { $in: expect.arrayContaining([79, 89, 120]) },
    });
    expect(degreeAuditQuery().school_id.$in).toHaveLength(9);
    expect(degreeAuditQuery('bio').major_slug).toBe('bio');
    expect(() => degreeAuditQuery('ma-cs')).toThrow('UC modelling rules only');
    expect(() => degreeAuditQuery('va-cs')).toThrow('UC modelling rules only');
  });
});
