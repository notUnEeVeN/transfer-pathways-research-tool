import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  eligibleAssociateProgram,
  writeTransferVirginiaDocuments,
} from './importVirginiaDegrees';

describe('Transfer Virginia associate-map scope', () => {
  it('keeps transfer A.S./AA&S awards and rejects certificates and A.A.S. awards', () => {
    expect(eligibleAssociateProgram('Computer Science, A.S.')).toBe(true);
    expect(eligibleAssociateProgram('Associate of Science-Math/Computer Science')).toBe(true);
    expect(eligibleAssociateProgram('Associate of Arts & Sciences Degree in Science')).toBe(true);
    expect(eligibleAssociateProgram('Career Studies Certificate in Computer Science')).toBe(false);
    expect(eligibleAssociateProgram('Algorithms and AI, C.S.C.')).toBe(false);
    expect(eligibleAssociateProgram('Computer Science, A.A.S.')).toBe(false);
    expect(eligibleAssociateProgram('Associate of Applied Science in Computing')).toBe(false);
  });

  it('excludes the two certificate rows in the captured Computer Science map index', () => {
    const file = path.join(__dirname, '..', '.va-degrees', 'maps_Computer_Science.json');
    if (!fs.existsSync(file)) return;
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
      .filter((row) => row.map === 'populated' && /community college|Richard Bland/i.test(row.institution || ''));
    const rejected = rows.filter((row) => !eligibleAssociateProgram(row.program));
    expect(rejected.map((row) => row.program).sort()).toEqual([
      'Career Studies Certificate in Computer Science',
      'Computer Science: Algorithms and Artificial Intelligence, C.S.C.',
    ]);
  });

  it('replaces only Transfer Virginia rows and never renames va_requirements', async () => {
    const requirements = {
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      insertMany: vi.fn().mockResolvedValue({ insertedCount: 1 }),
      rename: vi.fn(),
    };
    const ids = {
      drop: vi.fn().mockRejectedValue(new Error('missing')),
      insertMany: vi.fn().mockResolvedValue({ insertedCount: 1 }),
      rename: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      collection: vi.fn((name) => (name === 'va_requirements' ? requirements : ids)),
    };
    const docs = [{ _id: 'tv-map', source: 'transferva_program_map' }];
    const idMap = [{ _id: 'va:crs:CSC221' }];

    await writeTransferVirginiaDocuments(db, docs, idMap);

    expect(requirements.deleteMany).toHaveBeenCalledWith({ source: 'transferva_program_map' });
    expect(requirements.insertMany).toHaveBeenCalledWith(docs, { ordered: false });
    expect(requirements.rename).not.toHaveBeenCalled();
    expect(ids.rename).toHaveBeenCalledWith('va_course_ids', { dropTarget: true });
  });
});
