import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { diffDocs } = cjs('./docDiff');

describe('diffDocs', () => {
  it('returns no changes for equivalent documents', () => {
    const doc = { a: 1, b: { c: [1, 2] } };
    expect(diffDocs(doc, { ...doc })).toEqual([]);
  });

  it('reports a changed scalar with a dotted path', () => {
    const before = { verification: { verified: false, note: 'x' } };
    const after = { verification: { verified: true, note: 'x' } };
    expect(diffDocs(before, after)).toEqual([
      { path: 'verification.verified', from: false, to: true },
    ]);
  });

  it('reports array element edits with a bracketed path', () => {
    const before = { requirement_groups: [{ units: 3 }, { units: 4 }] };
    const after = { requirement_groups: [{ units: 3 }, { units: 5 }] };
    expect(diffDocs(before, after)).toEqual([
      { path: 'requirement_groups[1].units', from: 4, to: 5 },
    ]);
  });

  it('reports added and removed array cells', () => {
    const before = { xs: [1, 2] };
    const after = { xs: [1, 2, 3] };
    expect(diffDocs(before, after)).toEqual([
      { path: 'xs[2]', from: null, to: 3 },
    ]);
  });

  it('ignores auto-stamped bookkeeping fields at any depth', () => {
    const before = {
      degree_title_seen: 'A.S. in CS',
      updated_at: '2026-01-01', curated_at: '2026-01-01', curated_by: 'u1',
      verification: { verified: true, verified_at: 't1', verified_by: 'u1' },
      covered_concepts: ['cs_1'],
      requirement_groups: [{ curated_by: 'u1', units: 3 }],
    };
    const after = {
      degree_title_seen: 'A.S. in Computer Science',
      updated_at: '2026-02-02', curated_at: '2026-02-02', curated_by: 'u2',
      verification: { verified: true, verified_at: 't2', verified_by: 'u2' },
      covered_concepts: ['cs_1', 'cs_2'],
      requirement_groups: [{ curated_by: 'u2', units: 4 }],
    };
    // Only the human-meaningful edits survive: the title and the group units.
    expect(diffDocs(before, after)).toEqual([
      { path: 'degree_title_seen', from: 'A.S. in CS', to: 'A.S. in Computer Science' },
      { path: 'requirement_groups[0].units', from: 3, to: 4 },
    ]);
  });

  it('treats a null before as a creation (every field an addition)', () => {
    const after = { degree_title_seen: 'A.S.', status: 'found' };
    expect(diffDocs(null, after)).toEqual([
      { path: 'degree_title_seen', from: null, to: 'A.S.' },
      { path: 'status', from: null, to: 'found' },
    ]);
  });
});
