import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cjs = createRequire(import.meta.url);
const {
  atomicWriteJson,
  checkSnapshot,
  loadCheckpoint,
  parseArgs,
  sameCheckpoint,
} = cjs('./generateMultiCampusPathwaysSnapshot');

const temporaryDirectories = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.promises.rm(directory, { recursive: true, force: true })));
});

async function tempDirectory() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pathway-generator-'));
  temporaryDirectories.push(directory);
  return directory;
}

const header = {
  type: 'header',
  checkpoint_schema_version: 1,
  snapshot_schema_version: 1,
  source_fingerprint: 'a'.repeat(64),
  semester_load: 15,
  quarter_load: 15,
  school_ids: [10, 20],
  community_college_ids: [2],
};

describe('multi-campus snapshot generator CLI helpers', () => {
  it('parses a manual load profile without inventing a source-agnostic checkpoint path', () => {
    const parsed = parseArgs([
      '--semester-load', '12.5', '--quarter-load', '18', '--output', './out.json',
    ]);
    expect(parsed).toMatchObject({ semesterLoad: 12.5, quarterLoad: 18, checkpoint: null });
    expect(parsed.output).toBe(path.resolve('./out.json'));
    expect(() => parseArgs(['--semester-load', '25'])).toThrow(/semester-load/);
  });

  it('creates and resumes a matching append-only checkpoint', async () => {
    const directory = await tempDirectory();
    const checkpoint = path.join(directory, 'state.ndjson');
    expect(await loadCheckpoint(checkpoint, header)).toEqual(new Map());
    await fs.promises.appendFile(checkpoint, `${JSON.stringify({
      type: 'combination', mask: 1, combination: { school_ids: [10] },
    })}\n`);

    expect(await loadCheckpoint(checkpoint, header)).toEqual(new Map([
      [1, { school_ids: [10] }],
    ]));
    expect(sameCheckpoint(header, { ...header, source_fingerprint: 'b'.repeat(64) })).toBe(false);
    await expect(loadCheckpoint(checkpoint, { ...header, semester_load: 12 }))
      .rejects.toThrow(/does not match/);
  });

  it('atomically replaces JSON output', async () => {
    const directory = await tempDirectory();
    const output = path.join(directory, 'snapshot.json');
    await atomicWriteJson(output, { version: 1 });
    await atomicWriteJson(output, { version: 2 });
    expect(JSON.parse(await fs.promises.readFile(output, 'utf8'))).toEqual({ version: 2 });
    expect((await fs.promises.readdir(directory)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('checks an installed artifact and reports its size', async () => {
    const directory = await tempDirectory();
    const output = path.join(directory, 'invalid.json');
    await fs.promises.writeFile(output, '{}');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(checkSnapshot(output)).rejects.toThrow(/Invalid multi-campus snapshot/);
  });
});
