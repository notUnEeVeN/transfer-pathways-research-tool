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

const TABBED_REQUIREMENTS = `
<h1>Computer Science, BS</h1>
<div id="requirementstextcontainer" class="tab_content">
 <p>Total credits: 120</p>
 <h3>Computer Science Core</h3>
 <table class="sc_courselist">
  <tr><td class="codecol"><a class="code">CS 110</a></td><td>Essentials of Computer Science</td><td class="hourscol">3</td></tr>
  <tr class="listsum"><td colspan="2">Total Credits</td><td class="hourscol">32</td></tr>
 </table>
 <h3>Senior Computer Science</h3>
 <table class="sc_courselist">
  <tr><td class="codecol"><a class="code">CS 455</a></td><td>Computer Communications and Networking</td><td class="hourscol">3</td></tr>
  <tr class="listsum"><td colspan="2">Total Credits</td><td class="hourscol">12</td></tr>
 </table>
</div>
<div id="honorstextcontainer" class="tab_content">
 <h3>Honors Requirements</h3>
 <table class="sc_courselist">
  <tr><td class="codecol"><a class="code">HNRS 360</a></td><td>Honors Seminar</td><td class="hourscol">3</td></tr>
 </table>
</div>
<div id="acceleratedmasterstextcontainer" class="tab_content">
 <h3>Accelerated Option Requirements</h3>
 <table class="sc_courselist">
  <tr><td class="codecol"><a class="code">CS 540</a></td><td>Compilers</td><td class="hourscol">3</td></tr>
  <tr class="listsum"><td colspan="2">Total Credits</td><td class="hourscol">12</td></tr>
 </table>
</div>
<div id="fouryearplantextcontainer" class="tab_content">
 <table class="sc_plangrid">
  <tr class="plangridterm"><td>Fall</td></tr>
  <tr><td class="codecol"><a class="code">PLAN 401</a></td><td>Roadmap-only Course</td><td class="hourscol">3</td></tr>
  <tr class="plangridtotal"><td></td><td>Total Credits</td><td class="hourscol">120</td></tr>
 </table>
</div>`;

const CREDIT_INSTRUCTIONS = `
<div id="requirementstextcontainer">
 <h3>Natural Science</h3>
 <table class="sc_courselist">
  <tr><td colspan="2"><span class="courselistcomment">Select 6 credits from the following:</span></td><td class="hourscol"></td></tr>
  <tr><td class="codecol"><a class="code">BIOL 101</a></td><td>General Biology</td><td class="hourscol">3</td></tr>
 </table>
 <h3>Electives</h3>
 <table class="sc_courselist">
  <tr><td colspan="2"><span class="courselistcomment">Students must complete 8 elective credits</span></td><td class="hourscol">8</td></tr>
 </table>
 <h3>Programming Choice</h3>
 <table class="sc_courselist">
  <tr><td colspan="2"><span class="courselistcomment">Select one from the following:</span></td><td class="hourscol">3</td></tr>
  <tr><td class="codecol"><a class="code">CS 455</a></td><td>Computer Networks</td><td class="hourscol"></td></tr>
 </table>
</div>`;

const configuredScopeFixture = ({ id, code, includePlan = false }) => `
<h1>Computer Science, BS</h1>
<div id="requirementstextcontainer">
 <h2>Wrong generic tab</h2>
 <table class="sc_courselist">
  <tr><td class="codecol"><a class="code">BAD 999</a></td><td>Not the configured degree</td><td class="hourscol">3</td></tr>
 </table>
</div>
<div id="${id}">
 <p>Total credits: 120</p>
 <h2>Major Requirements</h2>
 <table class="sc_courselist">
  <tr><td class="codecol"><a class="code">${code}</a></td><td>Configured Course</td><td class="hourscol">3</td></tr>
  <tr class="listsum"><td colspan="2">Total Credits</td><td class="hourscol">30</td></tr>
 </table>
 ${includePlan ? `<table class="sc_plangrid">
  <tr class="plangridterm"><td>Sample Fall</td></tr>
  <tr><td class="codecol"><a class="code">PLAN 499</a></td><td>Sample-plan Course</td><td class="hourscol">3</td></tr>
 </table>` : ''}
</div>`;

const NESTED_ALTERNATIVE = `
<div id="requirementstextcontainer">
 <h2>Foundation</h2>
 <table class="sc_courselist">
  <tr><td class="codecol"><a class="code">CS 112</a></td><td>Introduction to Programming</td><td class="hourscol">4</td></tr>
  <tr class="orclass"><td class="codecol">or <a class="code">CS 108</a> &amp; <a class="code">CS 109</a></td><td>Programming Fundamentals and Lab</td><td class="hourscol">4</td></tr>
 </table>
</div>`;

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

describe('a tabbed CourseLeaf requirements page', () => {
  const tree = parseCourseLeafProgram(TABBED_REQUIREMENTS);

  it('uses the page heading when no program title option is supplied', () => {
    expect(tree.program_title).toBe('Computer Science, BS');
  });

  it('uses the introductory degree total and keeps list sums on their owning groups', () => {
    expect(tree.total_credits).toMatchObject({ min: 120, max: 120 });
    expect(tree.groups.map((g) => ({ title: g.title, credits: g.credits }))).toEqual([
      { title: 'Computer Science Core', credits: { min: 32, max: 32, raw: '32' } },
      { title: 'Senior Computer Science', credits: { min: 12, max: 12, raw: '12' } },
    ]);
  });

  it('excludes honors, accelerated, and plan-tab tables from the base degree', () => {
    const codes = tree.groups.flatMap((g) => g.sections)
      .flatMap((s) => s.rows)
      .flatMap((row) => row.codes.map((course) => course.code));
    expect(codes).toEqual(['CS110', 'CS455']);
    expect(codes).not.toContain('CS540');
  });
});

describe('CourseLeaf instruction advisements', () => {
  const tree = parseCourseLeafProgram(CREDIT_INSTRUCTIONS);

  it('models credit-only instructions as unit asks without inventing choose-one', () => {
    const naturalScience = tree.groups.find((group) => group.title === 'Natural Science').sections[0];
    const electives = tree.groups.find((group) => group.title === 'Electives').sections[0];
    expect(naturalScience).toMatchObject({ choose: null, credits: { min: 6, max: 6 } });
    expect(electives).toMatchObject({ choose: null, credits: { min: 8, max: 8 } });
  });

  it('retains an explicit select-one course advisement', () => {
    const choice = tree.groups.find((group) => group.title === 'Programming Choice').sections[0];
    expect(choice).toMatchObject({ choose: 1, credits: { min: 3, max: 3 } });
  });
});

describe('configured CourseLeaf requirement scopes', () => {
  const cases = [
    ['VCU', 'degreerequirementstextcontainer', 'CMSC 101'],
    ['NSU', 'curriculumtextcontainer', 'CSC 170'],
    ['VT', 'programcurriculumtextcontainer', 'CS 1114'],
    ['VSU', 'summaryofrequirementstextcontainer', 'COMP 150'],
  ];

  it.each(cases)('uses the authoritative %s container without root fallback', (_, id, code) => {
    const tree = parseCourseLeafProgram(configuredScopeFixture({ id, code, includePlan: id === 'curriculumtextcontainer' }), {
      requirementsSelector: `#${id}`,
      excludePlanGridsWhenCourseLists: true,
    });
    const codes = tree.groups.flatMap((group) => group.sections)
      .flatMap((section) => section.rows)
      .flatMap((row) => row.codes.map((course) => course.code));
    expect(tree.parse_error).toBeUndefined();
    expect(tree.total_credits).toMatchObject({ min: 120, max: 120 });
    expect(codes).toEqual([code.replace(/\s/g, '')]);
    expect(codes).not.toContain('BAD999');
    expect(codes).not.toContain('PLAN499');
  });

  it('returns a detectable empty parse when its authoritative selector is missing', () => {
    const html = configuredScopeFixture({ id: 'degreerequirementstextcontainer', code: 'CMSC 101' });
    const tree = parseCourseLeafProgram(html, {
      requirementsSelector: '#programcurriculumtextcontainer',
      excludePlanGridsWhenCourseLists: true,
    });
    expect(tree.groups).toEqual([]);
    expect(tree.parse_error).toEqual({
      code: 'configured_scope_missing',
      selector: '#programcurriculumtextcontainer',
    });
    expect(validateTree(tree, { sourceText: html, level: 'four_year' }).verdict).toBe('fail');
  });
});

it('keeps a leading row alternative separate from its internal AND conjunction', () => {
  const tree = parseCourseLeafProgram(NESTED_ALTERNATIVE);
  const rows = tree.groups[0].sections[0].rows;
  expect(rows[0].codes.map((course) => course.code)).toEqual(['CS112']);
  expect(rows[1]).toMatchObject({
    conjunction: 'and',
    alternative_to_previous: true,
  });
  expect(rows[1].codes.map((course) => course.code)).toEqual(['CS108', 'CS109']);
});

it('keeps a program-of-study plan grid when no requirements container exists', () => {
  const tree = parseCourseLeafProgram(`<div id="programofstudytextcontainer">${PLANGRID}</div>`);
  expect(tree.groups.map((g) => g.title)).toEqual(['1st Semester', '2nd Semester']);
  expect(tree.total_credits).toMatchObject({ min: 60, max: 63 });
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
