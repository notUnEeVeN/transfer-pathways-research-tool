import { describe, it, expect } from 'vitest';
import { parseCourseLeafProgram } from './courseleaf';
import { validateTree } from './validate';

/** The shape CourseLeaf emits, trimmed to the rows that carry the traps. */
const PLANGRID = `
<table class="sc_plangrid">
 <tr class="hidden noscript"><td></td></tr>
 <tr class="plangridterm"><td>1st Semester</td><td class="hourscol">Credits</td></tr>
 <tr class="even"><td class="codecol"><a class="code">CSC&nbsp;221</a></td><td class="titlecol">Introduction to Problem Solving and Programming</td><td class="hourscol">3</td></tr>
 <tr class="odd"><td class="codecol"><span class="comment">HIS Elective</span></td><td class="hourscol">3</td></tr>
 <tr class="even"><td class="codecol"><span class="comment">Select one of the following options:</span></td><td class="hourscol">5-6</td></tr>
 <tr class="odd"><td class="codecol"><div class="blockindent"><a class="code">MTH&nbsp;167</a></div></td><td class="titlecol">PreCalculus with Trigonometry</td><td class="hourscol">&nbsp;</td></tr>
 <tr class="even"><td class="codecol"><a class="code">SDV&nbsp;100</a><br><div class="blockindent">or <a class="code">SDV&nbsp;101</a></div></td><td class="titlecol">College Success Skills<br><div class="blockindent">or Orientation to:</div></td><td class="hourscol">1</td></tr>
 <tr class="plangridsum odd"><td>&nbsp;</td><td class="titlecol">Credits</td><td class="hourscol">15-16</td></tr>
 <tr class="plangridterm"><td>2nd Semester</td></tr>
 <tr class="even"><td class="codecol"><a class="code">CSC&nbsp;222</a></td><td class="titlecol">Object Oriented Programming</td><td class="hourscol">4</td></tr>
 <tr class="plangridsum odd"><td>&nbsp;</td><td class="titlecol">Credits</td><td class="hourscol">4</td></tr>
 <tr class="plangridtotal"><td>&nbsp;</td><td class="titlecol">Total Credits</td><td class="hourscol">60-63</td></tr>
</table>`;

describe('a CourseLeaf plan grid', () => {
  const tree = parseCourseLeafProgram(PLANGRID);

  it('makes each term a requirement group', () => {
    // NOVA publishes no categorical breakdown — the term grid is the
    // requirement structure, so the terms are the groups.
    expect(tree.groups.map((g) => g.title)).toEqual(['1st Semester', '2nd Semester']);
  });

  it('takes each term credit figure from its subtotal row', () => {
    expect(tree.groups[0].credits).toMatchObject({ min: 15, max: 16 });
  });

  it('reads the degree total from the total row, not the last term', () => {
    expect(tree.total_credits).toMatchObject({ min: 60, max: 63 });
    expect(tree.groups[1].credits).toMatchObject({ min: 4, max: 4 });
  });

  it('reads an alternative out of its indent block', () => {
    // Flattened, the cell reads `SDV 100or SDV 101`, where `\bor\b` finds no
    // word boundary between `0` and `o` and the choice reads as a required
    // pair. The indent block is the reliable signal.
    const rows = tree.groups[0].sections.flatMap((s) => s.rows);
    const sdv = rows.find((r) => r.codes.some((c) => c.code === 'SDV100'));
    expect(sdv.codes.map((c) => c.code)).toEqual(['SDV100', 'SDV101']);
    expect(sdv.conjunction).toBe('or');
  });

  it('opens a choice section on an instruction row', () => {
    const choice = tree.groups[0].sections.find((s) => s.choose === 1);
    expect(choice.credits).toMatchObject({ min: 5, max: 6 });
    expect(choice.rows.some((r) => r.codes.some((c) => c.code === 'MTH167'))).toBe(true);
  });

  it('keeps an unenumerated requirement instead of dropping it', () => {
    // "HIS Elective" names no course but costs 3 credits. Dropping it is the
    // difference between a 60-credit degree and a 57-credit one.
    const rows = tree.groups[0].sections.flatMap((s) => s.rows);
    const his = rows.find((r) => !r.codes.length && /HIS Elective/.test(r.text));
    expect(his.credits).toMatchObject({ min: 3 });
  });
});

describe('validation', () => {
  const tree = parseCourseLeafProgram(PLANGRID);

  it('fails a tree whose codes are not printed on the page', () => {
    const forged = JSON.parse(JSON.stringify(tree));
    forged.groups[0].sections[0].rows.push({ codes: [{ code: 'CSC999', title: 'Invented' }], conjunction: 'and', text: 'CSC 999' });
    const result = validateTree(forged, { sourceText: PLANGRID, level: 'community_college' });
    expect(result.verdict).toBe('fail');
    expect(result.checks.find((c) => c.name === 'codes_not_in_source').codes).toContain('CSC999');
  });

  it('fails when most groups state credits and they fall far short of the total', () => {
    const short = JSON.parse(JSON.stringify(tree)); // two groups, 15-16 + 4, stated 60-63
    const result = validateTree(short, { sourceText: PLANGRID, level: 'community_college' });
    expect(result.checks.find((c) => c.name === 'credits_disagree')).toBeTruthy();
    expect(result.verdict).toBe('fail');
  });

  it('only warns when too few groups state credits to reconcile against', () => {
    // One credit-bearing group out of two says nothing about whether the parse
    // is complete — plenty of catalogs print a figure on one heading only.
    // Failing that rejects a good parse for a typographic choice.
    const partial = JSON.parse(JSON.stringify(tree));
    partial.groups[1].credits = null;
    const result = validateTree(partial, { sourceText: PLANGRID, level: 'community_college' });
    expect(result.checks.find((c) => c.name === 'credits_partial')).toBeTruthy();
    expect(result.checks.find((c) => c.name === 'credits_disagree')).toBeFalsy();
  });

  it('flags a single-group parse — the failure this rewrite exists to fix', () => {
    const flat = { groups: [{ title: 'Requirements', credits: null, sections: [{ rows: [] }] }], total_credits: null };
    const result = validateTree(flat, { sourceText: PLANGRID, level: 'community_college' });
    expect(result.checks.some((c) => c.name === 'single_group')).toBe(true);
  });
});
