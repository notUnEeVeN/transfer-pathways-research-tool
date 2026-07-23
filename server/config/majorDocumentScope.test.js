import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { majorDocumentClause } = require('./majorDocumentScope');
const { defaultMajor } = require('./majors');

describe('majorDocumentClause', () => {
  const legacy = defaultMajor().slug;

  it('returns an empty clause for a blank slug (no scoping)', () => {
    expect(majorDocumentClause('')).toEqual({});
    expect(majorDocumentClause(null)).toEqual({});
    expect(majorDocumentClause(undefined)).toEqual({});
  });

  it('lets the legacy owner match unstamped rows too', () => {
    expect(majorDocumentClause(legacy)).toEqual({
      $or: [
        { major_slug: legacy },
        { major_slug: { $exists: false } },
        { major_slug: null },
      ],
    });
  });

  it('scopes every other major to its own stamped rows only', () => {
    expect(majorDocumentClause('bio')).toEqual({ major_slug: 'bio' });
    expect(majorDocumentClause('econ')).toEqual({ major_slug: 'econ' });
  });

  it('never lets a non-legacy major reach an unstamped row', () => {
    const clause = majorDocumentClause('bio');
    expect(clause.$or).toBeUndefined();
    expect(clause).toEqual({ major_slug: 'bio' });
  });

  it('trims incidental whitespace before matching', () => {
    expect(majorDocumentClause('  bio  ')).toEqual({ major_slug: 'bio' });
  });
});
