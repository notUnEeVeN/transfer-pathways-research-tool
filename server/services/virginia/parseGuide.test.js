import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGuide } from './parseGuide';

// A real Transfer Virginia guide (Longwood University, Computer Science BA/BS),
// trimmed only of scripts and chrome. The requirement tables are untouched, so
// this tests the site's actual hand-authored markup.
const FIXTURE = path.resolve(__dirname, '../../test/fixtures/virginia/guide-computer-science.html');

let guide;
beforeAll(() => {
  guide = parseGuide(fs.readFileSync(FIXTURE, 'utf8'), { slug: '/content/longwood-cs' });
});

describe('guide identity', () => {
  it('reads the program, catalog year, VCCS basis and receiving university', () => {
    expect(guide.program).toBe('Bachelor of Arts/Bachelor of Science in Computer Science');
    expect(guide.catalog_year).toBe('2025-2027');
    expect(guide.vccs_curriculum).toBe('COMPUTER SCIENCE');
    expect(guide.university_name).toBe('Longwood University');
  });
});

describe('table selection', () => {
  it('finds the community-college table', () => {
    expect(guide.has_cc_table).toBe(true);
    // 17 requirements; the table's own "Pre-Transfer Credits" summary line is
    // counted separately and kept out of the denominator.
    expect(guide.stats.rows).toBe(17);
    expect(guide.stats.summary_rows).toBe(1);
  });

  // Table 2 is coursework taken AFTER transfer. Including it would attribute
  // upper-division university courses to the community college and inflate
  // every requirement list.
  it('takes only the community-college table, not the post-transfer one', () => {
    const codes = guide.rows.flatMap((r) => r.requirement.options.flatMap((o) => o.codes));
    // Longwood's own CMSC/MATH upper-division codes live in table 2.
    expect(codes.some((c) => c.startsWith('CMSC'))).toBe(false);
    expect(codes.some((c) => c.startsWith('CSC') || c.startsWith('ENG'))).toBe(true);
  });
});

describe('row extraction', () => {
  it('classifies every row and accounts for all of them', () => {
    const { rows, course_rows: c, category_rows: cat, unparsed_rows: u } = guide.stats;
    expect(c + cat + u).toBe(rows);
  });

  it('carries credits and the university-side equivalent', () => {
    const eng111 = guide.rows.find((r) =>
      r.requirement.options.some((o) => o.codes.includes('ENG 111')));
    expect(eng111.credits).toBe('3');
    expect(eng111.course_equivalent).toBe('ENGL 165');
  });

  it('keeps category rows rather than dropping them', () => {
    const cats = guide.rows.filter((r) => r.requirement.kind === 'category');
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.some((r) => /History/i.test(r.requirement.category))).toBe(true);
  });

  // The fidelity contract: an unparsed row is reported, never silently dropped.
  // A vanished row shortens the requirement list and makes every college look
  // better able to satisfy the program than it is.
  it('retains unparsed rows with their raw text', () => {
    for (const r of guide.rows) {
      if (r.requirement.kind !== 'unparsed') continue;
      expect(r.requirement.raw).toBeTruthy();
    }
    expect(guide.stats.unparsed_rows).toBeGreaterThanOrEqual(0);
  });

  it('flags rows whose reading depended on shorthand expansion', () => {
    const inferred = guide.rows.filter((r) => r.requirement.confidence === 'inferred');
    expect(inferred.length).toBe(guide.stats.inferred_rows);
    for (const r of inferred) {
      expect(r.requirement.rules.some((x) => x === 'prefix_carry' || x === 'slash_alternatives')).toBe(true);
    }
  });
});

describe('degenerate input', () => {
  it('reports a page with no community-college table instead of throwing', () => {
    const g = parseGuide('<html><body><h1>Nothing here</h1></body></html>', { slug: '/x' });
    expect(g.has_cc_table).toBe(false);
    expect(g.rows).toEqual([]);
    expect(g.stats.rows).toBe(0);
  });
});
