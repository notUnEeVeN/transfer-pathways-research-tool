import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { buildFromArtifact, main } = require('./checkVcuPrerequisiteClosure');

describe('read-only VCU prerequisite closure check', () => {
  it('replays the exact inventory and dispositions from the candidate artifact', () => {
    expect(buildFromArtifact()).toMatchObject({
      control: { verified: true, issues: [] },
      summary: {
        verified: true,
        target_rows: 18,
        exact_official_courseblock_rows: 15,
        weak_retained_text_rows: 3,
        safe_structural_none_rows: 7,
        blocked_rows: 11,
        direct: { safe_structural_none_rows: 3, blocked_rows: 8 },
        closure: { safe_structural_none_rows: 4, blocked_rows: 3 },
      },
    });
  });

  it('rejects unknown options without mutating inputs', () => {
    expect(() => main(['--write'])).toThrow('unknown option(s): --write');
  });

  it('supports a machine-readable replay', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    expect(main(['--json'])).toMatchObject({ verified: true, target_rows: 18 });
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({
      verified: true, safe_structural_none_rows: 7, blocked_rows: 11,
    });
    write.mockRestore();
  });
});
