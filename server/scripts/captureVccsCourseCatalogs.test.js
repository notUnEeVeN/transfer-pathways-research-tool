import { describe, expect, it } from 'vitest';
import { parseSubject, subjectsFrom } from './captureVccsCourseCatalogs';

// The shape courses.vccs.edu actually emits: a definition list whose <dt>
// carries the code, title and the not-currently-scheduled marker, and whose
// <dd> carries description, contact hours and credits.
const page = (body) => `<html><body><main role="main"><div id="main"><dl>${body}</dl></div></main></body></html>`;

const entry = ({ id, heading, credits = '3 credits', extra = '', attrs = '' }) => `
<dt id="${id}"${attrs}><a href="/colleges/gcc/courses/x">${heading}</a></dt>
<dd id="${id}-description">
  <div class="coursedesc">Surveys things. This is a Passport and UCGS transfer course.</div>
  <div class="endtext">Lecture 3 hours. Total 3 hours per week.</div>
  <div class="credits">${credits}</div>${extra}
</dd>`;

describe('parseSubject', () => {
  it('reads code, title and credits from a dt/dd pair', () => {
    const [course] = parseSubject(page(entry({
      id: 'ART-101', heading: 'ART 101 - History of Art: Prehistoric to Gothic',
    })));
    expect(course).toMatchObject({
      code: 'ART101', prefix: 'ART', number: '101', credits: 3, scheduled: true,
    });
    expect(course.title).toBe('History of Art: Prehistoric to Gothic');
  });

  it('joins the prefix and number into the guide join key without a space', () => {
    // Guides write "MTH 263"; catalogues write "MTH 263"; the join key both
    // sides must agree on is MTH263. A space here silently empties every join.
    const [course] = parseSubject(page(entry({ id: 'MTH-263', heading: 'MTH 263 - Calculus I' })));
    expect(course.code).toBe('MTH263');
  });

  it('flags a catalogued course that is not currently scheduled rather than dropping it', () => {
    // A pathway is planned against the catalogue. Dropping unscheduled courses
    // would make a college look unable to satisfy a requirement it publishes.
    const courses = parseSubject(page(
      entry({ id: 'ART-101', heading: 'ART 101 - History of Art' })
      + entry({
        id: 'ART-116',
        heading: 'ART 116 - Design for the Web I',
        attrs: ' class="notScheduled" title="Not currently scheduled"',
      }),
    ));
    expect(courses.map((c) => [c.code, c.scheduled]))
      .toEqual([['ART101', true], ['ART116', false]]);
  });

  it('keeps a variable-credit range as raw text and takes the low bound as the number', () => {
    const [course] = parseSubject(page(entry({
      id: 'CSC-290', heading: 'CSC 290 - Coordinated Internship', credits: '1 - 5 credits',
    })));
    expect(course.credits).toBe(1);
    expect(course.credits_raw).toBe('1 - 5 credits');
  });

  it('does not let a course with no dd borrow the next course credits', () => {
    // Reading <dt> and <dd> as one unit is what prevents this; a lone dt is
    // skipped rather than paired with the following course's body.
    const courses = parseSubject(page(
      '<dt id="ART-999"><a href="#">ART 999 - Orphaned</a></dt>'
      + entry({ id: 'ART-101', heading: 'ART 101 - History of Art', credits: '4 credits' }),
    ));
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ code: 'ART101', credits: 4 });
  });

  it('ignores a heading that is not a course line', () => {
    expect(parseSubject(page(entry({ id: 'x', heading: 'All Subjects at Germanna' })))).toEqual([]);
  });
});

describe('subjectsFrom', () => {
  const html = `
    <a href="/colleges/gcc/courses/ART-Arts">Arts</a>
    <a href="/colleges/gcc/courses/CSC-ComputerScience">Computer Science</a>
    <a href="/colleges/gcc/courses/ART101-HistoryofArtPrehistorictoGothic">ART 101</a>
    <a href="/colleges/tcc/courses/BIO-Biology">other college</a>`;

  it('collects subject links for the requested college only', () => {
    expect(subjectsFrom(html, 'gcc').map((s) => s.code)).toEqual(['ART', 'CSC']);
  });

  it('rejects course links, which share the prefix-hyphen-name shape', () => {
    // "ART101-HistoryofArt..." would otherwise be crawled as a subject and
    // return a single course page, quietly shrinking the catalogue.
    expect(subjectsFrom(html, 'gcc').map((s) => s.slug)).not.toContain(
      'ART101-HistoryofArtPrehistorictoGothic',
    );
  });
});
