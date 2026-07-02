import { describe, it, expect } from 'vitest';
import { isAtlasUri, describeTarget } from './mongoTarget';

describe('mongoTarget', () => {
  it('classifies Atlas vs local connection strings', () => {
    expect(isAtlasUri('mongodb+srv://u:p@cluster0.abcde.mongodb.net/pmt')).toBe(true);
    expect(isAtlasUri('mongodb://host.mongodb.net/pmt')).toBe(true);
    expect(isAtlasUri('mongodb://127.0.0.1:27017/pmt')).toBe(false);
    expect(isAtlasUri('mongodb://localhost:27017/pmt')).toBe(false);
    expect(isAtlasUri('')).toBe(false);
    expect(describeTarget('mongodb+srv://x.mongodb.net')).toBe('MongoDB Atlas');
    expect(describeTarget('mongodb://localhost:27017')).toBe('local MongoDB');
  });
});
