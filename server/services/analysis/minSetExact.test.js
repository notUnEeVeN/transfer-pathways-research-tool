/**
 * The engine-based agreement minimum used by creditLoss/choiceCost/complexity/
 * timeToDegree: choose-N-correct required counts + the exact minimum-course set,
 * replacing the greedy agreementMinSet + naive receiver count.
 */
import { describe, it, expect } from 'vitest';
import { _chooseNMinimum, _agreementMinSetExact } from './pathways';

const grp = (sections, f = {}) => ({ is_required: true, ...f, sections });
const sec = (receivers, f = {}) => ({ ...f, receivers });
const rcv = (hash, ids, status = 'articulated') => ({
  hash_id: hash,
  articulation_status: status,
  receiving: { kind: 'course', parent_id: hash },
  options_conjunction: 'and',
  options: ids.length ? [{ course_ids: ids, course_conjunction: 'and' }] : [],
});

describe('chooseNMinimum', () => {
  it('choose-1 of 3 counts as 1 required, satisfied when any articulates', () => {
    const groups = [grp([sec([rcv('a', [1]), rcv('b', [2]), rcv('c', [], 'not_articulated')],
      { section_advisement: 1 })])];
    expect(_chooseNMinimum(groups)).toEqual({ required: 1, satisfiable: 1, blocked: 0 });
  });

  it('choose-1 with none articulated is blocked', () => {
    const groups = [grp([sec([rcv('a', [], 'not_articulated'), rcv('b', [], 'not_articulated')],
      { section_advisement: 1 })])];
    expect(_chooseNMinimum(groups)).toEqual({ required: 1, satisfiable: 0, blocked: 1 });
  });

  it('complete-all (two single-receiver sections) requires both', () => {
    const groups = [grp([sec([rcv('a', [1])]), sec([rcv('b', [], 'not_articulated')])])];
    expect(_chooseNMinimum(groups)).toEqual({ required: 2, satisfiable: 1, blocked: 1 });
  });

  it('ignores non-required groups', () => {
    const groups = [{ is_required: false, sections: [sec([rcv('a', [], 'not_articulated')])] }];
    expect(_chooseNMinimum(groups)).toEqual({ required: 0, satisfiable: 0, blocked: 0 });
  });
});

describe('agreementMinSetExact', () => {
  it('exact minimum courses + choose-N counts (the Allan Hancock → UCB shape)', () => {
    // MATH 51 (required) + choose 1 of {MATH 54, EECS 16A(unart)}
    const doc = { requirement_groups: [grp([
      sec([rcv('h1', [1])]),
      sec([rcv('h2', [2]), rcv('h3', [], 'not_articulated')], { section_advisement: 1 }),
    ])] };
    const coursesById = new Map([
      ['1', { course_id: '1', units: 3, same_as: [] }],
      ['2', { course_id: '2', units: 3, same_as: [] }],
    ]);
    const solved = _agreementMinSetExact(doc, () => false, coursesById);
    expect(solved.receiversRequired).toBe(2);   // MATH 51 + (1 of 2), not naive 3
    expect(solved.receiversSatisfiable).toBe(2);
    expect(solved.receiversBlocked).toBe(0);
    expect(solved.courses.sort()).toEqual(['1', '2']);
    expect(solved.fullyArticulated).toBe(true);
  });
});
