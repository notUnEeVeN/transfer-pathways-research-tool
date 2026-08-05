import { describe, it, expect } from 'vitest';
import { parseRequirementCell, stripParentheticals, splitRequired } from './rowGrammar';

// Every case below is a real requirement cell taken from the Transfer Virginia
// corpus. The grammar is the fidelity story for this state — the guides are
// prose written by 60+ institutions — so these lock the readings that a
// research claim would rest on.

describe('what the grammar reads directly', () => {
  it('reads a single course', () => {
    const r = parseRequirementCell('ENG 111');
    expect(r.kind).toBe('course');
    expect(r.confidence).toBe('read');
    expect(r.options).toEqual([{ codes: ['ENG 111'] }]);
  });

  it('reads spelled-out alternatives as a choice', () => {
    const r = parseRequirementCell('ENG 112 or ENG 113');
    expect(r.conjunction).toBe('or');
    expect(r.options[0].codes).toEqual(['ENG 112', 'ENG 113']);
    expect(r.confidence).toBe('read');
  });

  it('ignores an inline course title', () => {
    expect(parseRequirementCell('ENG 111 College Comp I').options[0].codes).toEqual(['ENG 111']);
  });

  it('reads a semicolon as "and also complete"', () => {
    const r = parseRequirementCell('HLT 241 Global Health; HLT 110 Personal Health');
    expect(r.conjunction).toBe('and');
    expect(r.options.map((o) => o.codes)).toEqual([['HLT 241'], ['HLT 110']]);
  });

  it('reads a long comma list of alternatives', () => {
    const r = parseRequirementCell('ART 100, ART 101, CST 130, MUS 121');
    expect(r.options[0].codes).toEqual(['ART 100', 'ART 101', 'CST 130', 'MUS 121']);
    expect(r.conjunction).toBe('or');
  });
});

describe('what the grammar infers, and flags as inferred', () => {
  // These are defensible expansions of author shorthand, but they ARE
  // interpretation. Confidence must say so, because a reviewer auditing the
  // corpus should be able to look at exactly the rows that needed judgement.
  it('carries the prefix onto a bare number', () => {
    const r = parseRequirementCell('SDV 100 or 101');
    expect(r.options[0].codes).toEqual(['SDV 100', 'SDV 101']);
    expect(r.confidence).toBe('inferred');
    expect(r.rules).toContain('prefix_carry');
  });

  it('carries the prefix across an inline title', () => {
    const r = parseRequirementCell('SDV 100 College Success Skills or 101 Orientation');
    expect(r.options[0].codes).toEqual(['SDV 100', 'SDV 101']);
  });

  it('expands slash alternatives', () => {
    const r = parseRequirementCell('GOL 105/106/110');
    expect(r.options[0].codes).toEqual(['GOL 105', 'GOL 106', 'GOL 110']);
    expect(r.rules).toContain('slash_alternatives');
    expect(r.confidence).toBe('inferred');
  });

  it('handles a mixed list with a slash group', () => {
    const r = parseRequirementCell('BIO 101, CHM 111, PHY 241, GOL 105/106/110');
    expect(r.options[0].codes).toEqual(
      ['BIO 101', 'CHM 111', 'PHY 241', 'GOL 105', 'GOL 106', 'GOL 110']
    );
  });
});

describe('required pairs', () => {
  // "+" means both, not either. Reading it as a choice would let one course
  // satisfy a two-course requirement — an error in the direction that makes
  // every college look better than it is.
  it('treats + as a required pair', () => {
    const r = parseRequirementCell('MTH 161+162');
    expect(r.conjunction).toBe('and');
    expect(r.options.map((o) => o.codes)).toEqual([['MTH 161'], ['MTH 162']]);
  });

  it('handles + with both prefixes spelled out', () => {
    const r = parseRequirementCell('MTH 161 + MTH 162');
    expect(r.conjunction).toBe('and');
    expect(r.options.map((o) => o.codes)).toEqual([['MTH 161'], ['MTH 162']]);
    expect(r.confidence).toBe('read');
  });
});

describe('parenthetical advice is not a requirement', () => {
  // "(PHI 220 recommended)" names a course the guide does not require. Letting
  // it through would invent a requirement, and would also convert a category
  // row into a course row.
  it('drops a recommendation and keeps it as a note', () => {
    const r = parseRequirementCell('Any UCGS Humanities (PHI 220 recommended)');
    expect(r.kind).toBe('category');
    expect(r.options).toEqual([]);
    expect(r.parentheticals).toEqual(['PHI 220 recommended']);
  });

  it('drops an exclusion note without losing the category', () => {
    const r = parseRequirementCell('Any UCGS Social & Behavioral Sciences (not History)');
    expect(r.kind).toBe('category');
    expect(r.category).toMatch(/Social & Behavioral Sciences/);
  });
});

describe('category slots', () => {
  it('keeps a category requirement that names no course', () => {
    const r = parseRequirementCell('Any UCGS History');
    expect(r.kind).toBe('category');
    expect(r.confidence).toBe('read');
    expect(r.category).toBe('Any UCGS History');
  });

  it('keeps a multi-discipline category', () => {
    expect(parseRequirementCell('Any UCGS Art, Humanities, or Literature').kind).toBe('category');
  });
});

describe('what it refuses to guess', () => {
  // The corpus contains requirements no code can express. They must surface as
  // unparsed with the raw text intact, never be dropped — a vanished row
  // shortens the requirement list and overstates what a college can satisfy.
  it('marks an unexpressible requirement unparsed and keeps the text', () => {
    const r = parseRequirementCell('CPSC course numbered 300 or higher');
    expect(r.kind).toBe('unparsed');
    expect(r.confidence).toBe('unparsed');
    expect(r.raw).toBe('CPSC course numbered 300 or higher');
  });

  it('is safe on empty input', () => {
    expect(parseRequirementCell('').kind).toBe('unparsed');
    expect(parseRequirementCell(null).options).toEqual([]);
  });
});

describe('helpers', () => {
  it('splitRequired separates on ; and +', () => {
    expect(splitRequired('A; B + C')).toEqual(['A', 'B', 'C']);
  });

  it('stripParentheticals returns both halves', () => {
    const { cleaned, parentheticals } = stripParentheticals('X (note) Y');
    expect(cleaned.replace(/\s+/g, ' ').trim()).toBe('X Y');
    expect(parentheticals).toEqual(['note']);
  });
});

// Regression: reading course codes case-insensitively is required ("Art 101"),
// but it lets ordinary English words match the prefix pattern. "SDV 100 or 101"
// produced a phantom course "OR 101" — a fabricated requirement, the worst
// class of error this corpus can contain.
describe('English words are not course prefixes', () => {
  it('does not read "or 101" as a course', () => {
    const r = parseRequirementCell('SDV 100 or 101');
    expect(r.options[0].codes).toEqual(['SDV 100', 'SDV 101']);
    expect(r.options[0].codes).not.toContain('OR 101');
  });

  it('does not invent courses from connectives', () => {
    for (const s of ['take 101', 'and 200', 'see 300', 'all 100 courses']) {
      const codes = parseRequirementCell(s).options.flatMap((o) => o.codes);
      expect(codes).toEqual([]);
    }
  });

  it('still reads a lower-case real prefix', () => {
    expect(parseRequirementCell('Art 101 or 102').options[0].codes).toEqual(['ART 101', 'ART 102']);
  });
});

describe('summary rows', () => {
  it('classifies a table total as furniture, not a requirement', () => {
    for (const s of ['Pre-Transfer Credits', 'TOTAL', 'CREDITS PRE-TRANSFER', 'Degree Total']) {
      expect(parseRequirementCell(s).kind).toBe('summary');
    }
  });

  it('does not swallow a requirement that merely mentions credits', () => {
    expect(parseRequirementCell('ENG 111').kind).toBe('course');
  });
});

// Regression: recovering parenthesised course lists ("ENG literature
// (225,245,…)") needs a bare subject token to seed the prefix. Ungated, that
// same rule reads "CPSC course numbered 300 or higher" — a level rule with no
// specific course — as a fabricated "CPSC 300".
describe('parenthetical recovery does not leak into free text', () => {
  it('recovers a parenthesised number list', () => {
    const r = parseRequirementCell('ENG literature (225,245,246)');
    expect(r.options[0].codes).toEqual(['ENG 225', 'ENG 245', 'ENG 246']);
    expect(r.rules).toContain('parenthetical_codes');
    expect(r.confidence).toBe('inferred');
  });

  it('recovers a parenthesised choice', () => {
    expect(parseRequirementCell('Humanities (PHI 220 or PHI 227)').options[0].codes)
      .toEqual(['PHI 220', 'PHI 227']);
  });

  it('still refuses a level rule with no parenthetical', () => {
    const r = parseRequirementCell('CPSC course numbered 300 or higher');
    expect(r.kind).toBe('unparsed');
    expect(r.options).toEqual([]);
  });

  it('excludes an illustrative list from a row that names its own courses', () => {
    const r = parseRequirementCell('Choose two: ART 130 Intro (e.g., ART 125 Painting)');
    expect(r.options[0].codes).toEqual(['ART 130']);
    expect(r.parentheticals[0]).toMatch(/ART 125/);
  });
});
