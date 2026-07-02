import { describe, it, expect } from 'vitest';
import {
  receiverAlternatives, agreementMinSet, manyToOneCount,
} from './optionSolver';

const recv = (options, oc = 'or', status = 'articulated') => ({
  hash_id: 'h' + Math.abs(JSON.stringify(options).split('').reduce((a, c) => a + c.charCodeAt(0), 0)),
  receiving: { kind: 'course', parent_id: 1 },
  articulation_status: status,
  not_articulated_reason: status === 'articulated' ? null : 'NoCourseArticulated',
  options,
  options_conjunction: oc,
});

const opt = (ids, cc = 'and') => ({ course_ids: ids, course_conjunction: cc });

const agreement = (groups) => ({ requirement_groups: groups });
const group = (sections, extra = {}) => ({
  is_required: true, group_conjunction: 'And', group_advisement: null,
  group_unit_advisement: null, sections, ...extra,
});
const section = (receivers, advisement = null) => ({
  section_advisement: advisement, unit_advisement: null, receivers,
});

describe('receiverAlternatives', () => {
  it('or-of-ands: each option is one alternative', () => {
    const alts = receiverAlternatives(recv([opt(['a', 'b']), opt(['c'])]));
    expect(alts).toEqual([['a', 'b'], ['c']]);
  });

  it('or-within-option expands to singleton alternatives', () => {
    const alts = receiverAlternatives(recv([opt(['a', 'b'], 'or')]));
    expect(alts).toEqual([['a'], ['b']]);
  });

  it('and-of-options combines one alternative from each', () => {
    const alts = receiverAlternatives(recv([opt(['a']), opt(['b', 'c'], 'or')], 'and'));
    expect(alts).toContainEqual(['a', 'b']);
    expect(alts).toContainEqual(['a', 'c']);
  });

  it('not_articulated receivers have no alternatives', () => {
    expect(receiverAlternatives(recv([], 'or', 'not_articulated'))).toEqual([]);
  });
});

describe('agreementMinSet', () => {
  it('takes every required receiver, cheapest alternative each', () => {
    const a = agreement([group([section([
      recv([opt(['calc1'])]),
      recv([opt(['cs1a', 'cs1b']), opt(['cs1combined'])]), // 2-course path OR 1-course path
    ])])]);
    const out = agreementMinSet(a);
    expect(out.courses).toEqual(['calc1', 'cs1combined']);
    expect(out.receiversSatisfied).toBe(2);
    expect(out.blockedReceivers).toHaveLength(0);
  });

  it('prefers alternatives that overlap with already-chosen courses', () => {
    const a = agreement([group([section([
      recv([opt(['x', 'y'])]),                 // forces x+y
      recv([opt(['z']), opt(['x', 'y'])]),     // overlap-aware: reuse x+y, not z
    ])])]);
    const out = agreementMinSet(a);
    expect(out.courses).toEqual(['x', 'y']);
  });

  it('honors section_advisement (choose N cheapest)', () => {
    const a = agreement([group([section([
      recv([opt(['one'])]),
      recv([opt(['two', 'three'])]),
      recv([opt(['four', 'five', 'six'])]),
    ], 2)])]);
    const out = agreementMinSet(a);
    // Two cheapest receivers: 'one' (1 course) + 'two','three' (2 courses).
    expect(out.courses).toEqual(['one', 'three', 'two']);
    expect(out.receiversSatisfied).toBe(2);
  });

  it('honors group_advisement across sections', () => {
    const a = agreement([group([
      section([recv([opt(['a'])])]),
      section([recv([opt(['b', 'c'])])]),
    ], { group_advisement: 1 })]);
    const out = agreementMinSet(a);
    expect(out.courses).toEqual(['a']);
  });

  it('an Or group takes the cheapest fully-satisfiable section', () => {
    const a = agreement([group([
      section([recv([opt(['p', 'q', 'r'])])]),
      section([recv([opt(['s'])])]),
    ], { group_conjunction: 'Or' })]);
    const out = agreementMinSet(a);
    expect(out.courses).toEqual(['s']);
  });

  it('reports blocked receivers and keeps going', () => {
    const a = agreement([group([section([
      recv([], 'or', 'not_articulated'),
      recv([opt(['ok'])]),
    ])])]);
    const out = agreementMinSet(a);
    expect(out.courses).toEqual(['ok']);
    expect(out.blockedReceivers).toHaveLength(1);
  });

  it('skips recommended groups by default and curation-excluded receivers', () => {
    const excluded = recv([opt(['nope'])]);
    const a = agreement([
      group([section([recv([opt(['req'])]), excluded])]),
      group([section([recv([opt(['extra'])])])], { is_required: false }),
    ]);
    // group() helper puts extra into sections when passed as 2nd arg — build required=false directly:
    a.requirement_groups[1] = { ...group([section([recv([opt(['extra'])])])]), is_required: false };
    const out = agreementMinSet(a, { isExcluded: (r) => r === excluded });
    expect(out.courses).toEqual(['req']);
  });
});

describe('manyToOneCount', () => {
  it('counts receivers whose cheapest path is >1 CC course', () => {
    const a = agreement([group([section([
      recv([opt(['a', 'b'])]),               // 2-course only → many-to-one
      recv([opt(['c', 'd']), opt(['e'])]),   // 1-course path exists → not counted
      recv([opt(['f'])]),                    // single course → not counted
    ])])]);
    expect(manyToOneCount(a)).toBe(1);
  });
});
