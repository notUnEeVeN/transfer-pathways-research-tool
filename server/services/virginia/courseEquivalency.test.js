import { describe, it, expect } from 'vitest';
import {
  parseCoursePage, parseCourseSearch, splitHeading, queryForm, crossCheck,
} from './courseEquivalency';

/** The shape of a real /course/<GUID> page, trimmed to what the parser reads. */
const page = ({ heading = 'CSC221: Introduction to Problem Solving and Programming', rows = [], credits = '3.0' } = {}) => `
<div class="course-div">
  <div class="column-left"><div class="innerDiv"><div class="participatingname">
    <p>Blue Ridge Community College</p>
  </div></div></div>
  <div class="column-right">
    <div class="bookmarked-item Courses"><div class="Courses-name bookmark-item">${heading}</div></div>
    <div class="course-descr"><div class="instdescr"><p>Introduces problem solving.</p></div></div>
  </div>
</div>
<div class="card"><div class="card-header"><div class="title-header">Credits</div></div>${credits}<a>Estimate</a></div>
<div class="card"><div class="card-header"><div class="title-header">Department</div></div>Computer Science</div>
<div id="courses-equivalencies-table"><table><tr>
  <th>Institution</th><th>Identifier</th><th>Name</th><th>Notes</th><th>Level</th></tr>
  ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
</table></div>`;

const FOUR = ['James Madison University', 'CS149', 'Introduction to Programming', '', '4-Year'];
const TWO = ['Danville Community College', 'CSC221', 'Intro to Problem Solving', '', '2-Year'];

describe('splitHeading', () => {
  it('splits code from title and normalises the code', () => {
    expect(splitHeading('CSC221: Introduction to Programming'))
      .toEqual({ code: 'CSC221', title: 'Introduction to Programming' });
    expect(splitHeading('CSC 221: Intro').code).toBe('CSC221');
    expect(splitHeading('MTH-263: Calculus').code).toBe('MTH263');
  });

  it('keeps an unsplittable heading as the title rather than inventing a code', () => {
    expect(splitHeading('Course Details')).toEqual({ code: null, title: 'Course Details' });
  });
});

describe('queryForm', () => {
  it('concatenates, because the spaced form matches fuzzily', () => {
    expect(queryForm('CSC 221')).toBe('CSC221');
  });
});

describe('parseCoursePage', () => {
  it('reads the course header, credits, department and description', () => {
    const p = parseCoursePage(page({ rows: [FOUR, TWO] }));
    expect(p.code).toBe('CSC221');
    expect(p.title).toBe('Introduction to Problem Solving and Programming');
    expect(p.institution).toBe('Blue Ridge Community College');
    expect(p.credits).toBe(3);
    expect(p.department).toBe('Computer Science');
    expect(p.description).toBe('Introduces problem solving.');
  });

  it('splits equivalencies by level and counts them', () => {
    const p = parseCoursePage(page({ rows: [FOUR, TWO] }));
    expect(p.stats).toMatchObject({ rows: 2, two_year: 1, four_year: 1, unknown_levels: [] });
    expect(p.equivalencies[0]).toMatchObject({
      institution: 'James Madison University', identifier: 'CS149', level: 'four_year', notes: null,
    });
  });

  it('keeps notes and reports how many rows carry them', () => {
    const noted = ['Radford University', 'CS109', 'Problem Solving', 'May transfer in as CS101 or CS109', '4-Year'];
    const p = parseCoursePage(page({ rows: [noted] }));
    expect(p.equivalencies[0].notes).toBe('May transfer in as CS101 or CS109');
    expect(p.stats.with_notes).toBe(1);
  });

  it('surfaces an unrecognised level instead of bucketing it', () => {
    const odd = ['Somewhere College', 'X100', 'Thing', '', 'Certificate'];
    const p = parseCoursePage(page({ rows: [odd] }));
    expect(p.equivalencies[0].level).toBeNull();
    expect(p.equivalencies[0].level_raw).toBe('Certificate');
    expect(p.stats.unknown_levels).toEqual(['Certificate']);
    expect(p.stats.two_year + p.stats.four_year).toBe(0);
  });

  it('ignores the header row and any short row', () => {
    const p = parseCoursePage(page({ rows: [['only', 'three', 'cells']] }));
    expect(p.stats.rows).toBe(0);
  });

  it('leaves credits null when the field is not numeric', () => {
    const p = parseCoursePage(page({ credits: 'Varies' }));
    expect(p.credits).toBeNull();
    expect(p.credits_raw).toBe('Varies');
  });
});

describe('parseCourseSearch', () => {
  it('collects distinct course GUIDs in page order', () => {
    const html = `
      <a href="/course/D37A6A611F9411F082AC0242AC15010A">CSC221</a>
      <a href="/institution-profile/0090E8474CB811E88E513417EBBCA8BC">Blue Ridge</a>
      <a href="/course/D710E9F11F9411F082AC0242AC15010A">CSC221</a>
      <a href="/course/D37A6A611F9411F082AC0242AC15010A">dup</a>`;
    expect(parseCourseSearch(html)).toEqual([
      'D37A6A611F9411F082AC0242AC15010A', 'D710E9F11F9411F082AC0242AC15010A',
    ]);
  });
});

describe('crossCheck', () => {
  const of = (inst, four) => ({
    code: 'CSC221', institution: inst,
    equivalencies: four.map(([i, id]) => ({ institution: i, identifier: id, level: 'four_year' })),
  });

  it('reports consistent when every rendering agrees', () => {
    const r = crossCheck([of('A', [['JMU', 'CS149']]), of('B', [['JMU', 'CS149']])]);
    expect(r).toMatchObject({ checked: 2, consistent: true, conflicts: [] });
  });

  it('flags a differing target identifier', () => {
    const r = crossCheck([of('A', [['JMU', 'CS149']]), of('B', [['JMU', 'CS101']])]);
    expect(r.consistent).toBe(false);
    expect(r.conflicts).toEqual([
      { type: 'differs', institution: 'JMU', base: 'CS149', other: 'CS101', in: 'B' },
    ]);
  });

  it('flags an institution present in only one rendering, in both directions', () => {
    const r = crossCheck([of('A', [['JMU', 'CS149']]), of('B', [['JMU', 'CS149'], ['VT', 'CS1064']])]);
    expect(r.conflicts).toEqual([
      { type: 'extra', institution: 'VT', in: 'B', identifier: 'CS1064' },
    ]);
    const back = crossCheck([of('A', [['JMU', 'CS149'], ['VT', 'CS1064']]), of('B', [['JMU', 'CS149']])]);
    expect(back.conflicts).toEqual([
      { type: 'missing', institution: 'VT', in: 'B', identifier: 'CS1064' },
    ]);
  });

  it('cannot check a single rendering, and says so rather than claiming agreement', () => {
    expect(crossCheck([of('A', [['JMU', 'CS149']])])).toMatchObject({ checked: 1, conflicts: [] });
  });
});
