import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('retired Virginia heuristic normalizer', () => {
  it('fails before connecting or accepting any legacy mutation flag', () => {
    const script = path.resolve(__dirname, 'normalizeVirginiaSchema.js');
    for (const args of [[], ['--apply'], ['--restore']]) {
      const result = spawnSync(process.execPath, [script, ...args], {
        encoding: 'utf8',
        env: {
          ...process.env,
          MONGO_URI: 'mongodb://127.0.0.1:1/would-fail-if-contacted',
        },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('is retired and performed no work');
      expect(result.stderr).not.toMatch(/ECONNREFUSED|Mongo/);
    }
  });
});
