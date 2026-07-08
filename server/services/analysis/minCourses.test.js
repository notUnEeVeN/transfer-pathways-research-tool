/**
 * Sanity tests for the vendored minimum-course optimizer (the golden oracle for
 * analysis/pmt_min_courses.py). Three hand-checked shapes confirm the module
 * boundary adaptation (CommonJS require + local toSyntheticUserCourse) didn't
 * change behavior: mandatory "complete all", choose-1-of-N, and same_as sharing.
 */
import { describe, it, expect } from 'vitest';
import { selectMissingAcrossMajorsOptimal, selectMissingAcrossMajors } from './minCourses';

// One articulated single-course receiver.
const rcv = (hash, courseIds, { conj = 'and', optConj = 'and' } = {}) => ({
  hash_id: hash,
  articulation_status: 'articulated',
  receiving: { kind: 'course', parent_id: hash },
  options_conjunction: optConj,
  options: [{ course_ids: courseIds, course_conjunction: conj }],
});

const catalog = (entries) => new Map(Object.entries(entries).map(([id, v]) => [id, { course_id: id, ...v }]));
const ctxFor = (coursesById) => ({ userCourses: [], coursesById, includeRecommended: false, crossCc: [] });

describe('minCourses oracle', () => {
  it('picks every course of a mandatory complete-all group', () => {
    const major = {
      requirement_groups: [{
        is_required: true,
        sections: [{ receivers: [rcv('h1', ['c1'])] }, { receivers: [rcv('h2', ['c2'])] }],
      }],
    };
    const cb = catalog({ c1: { units: 3, same_as: [] }, c2: { units: 3, same_as: [] } });
    expect(selectMissingAcrossMajorsOptimal([major], ctxFor(cb)).sort()).toEqual(['c1', 'c2']);
  });

  it('picks the cheapest single course for a choose-1-of-3 section', () => {
    const major = {
      requirement_groups: [{
        is_required: true,
        sections: [{ section_advisement: 1, receivers: [rcv('h1', ['c1']), rcv('h2', ['c2']), rcv('h3', ['c3'])] }],
      }],
    };
    const cb = catalog({ c1: { units: 5, same_as: [] }, c2: { units: 3, same_as: [] }, c3: { units: 4, same_as: [] } });
    expect(selectMissingAcrossMajorsOptimal([major], ctxFor(cb))).toEqual(['c2']);
    // greedy seed lands on the same single pick
    expect(selectMissingAcrossMajors([major], ctxFor(cb))).toEqual(['c2']);
  });

  it('counts a same_as-shared course once across two majors', () => {
    const majorA = { requirement_groups: [{ is_required: true, sections: [{ receivers: [rcv('ha', ['compA'])] }] }] };
    const majorB = { requirement_groups: [{ is_required: true, sections: [{ receivers: [rcv('hb', ['mathB'])] }] }] };
    const cb = catalog({
      compA: { units: 3, same_as: [{ course_id: 'mathB' }] },
      mathB: { units: 3, same_as: [{ course_id: 'compA' }] },
    });
    const picked = selectMissingAcrossMajorsOptimal([majorA, majorB], ctxFor(cb));
    expect(picked).toHaveLength(1);
    expect(['compA', 'mathB']).toContain(picked[0]);
  });
});
