/**
 * Sanity tests for the PMT-derived minimum-course optimizer. In addition to
 * product-parity shapes, these lock the research-side exact-search corrections
 * for choose-N frontiers, duplicate bundle IDs, and equivalent course aliases.
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

  it('branches over equivalent catalog identities without double-counting them', () => {
    const major = {
      requirement_groups: [{
        is_required: true,
        sections: [{ receivers: [rcv('alias', ['E'])] }],
      }],
    };
    const cb = catalog({
      D: { units: 4, same_as: [{ course_id: 'E' }] },
      E: { units: 5, same_as: [{ course_id: 'D' }] },
    });
    const telemetry = {};

    expect(selectMissingAcrossMajorsOptimal(
      [major], { ...ctxFor(cb), telemetry },
    )).toEqual(['D']);
    expect(telemetry.bestUnits).toBe(4);
    expect(telemetry.optimalityProven).toBe(true);
  });

  it('preserves sending-unit credit for an agreement-listed alias', () => {
    const alias = rcv('alias-units', ['B']);
    delete alias.receiving.units;
    const weighted = rcv('weighted', ['X']);
    weighted.receiving.units = 4;
    const major = {
      requirement_groups: [{
        is_required: true,
        sections: [{ unit_advisement: 3, receivers: [alias, weighted] }],
      }],
    };
    const cb = catalog({
      A: { units: 3, same_as: [{ course_id: 'B' }] },
      B: { units: 3, same_as: [{ course_id: 'A' }] },
      X: { units: 4, same_as: [] },
    });
    const telemetry = {};

    expect(selectMissingAcrossMajorsOptimal(
      [major], { ...ctxFor(cb), telemetry },
    )).toEqual(['B']);
    expect(telemetry.unsupportedUnitFallbacks).toBe(1);
    expect(telemetry.optimalityProven).toBe(false);
  });

  it('does not claim proof for an unmodeled sending-unit fallback shape', () => {
    const fallback = rcv('fallback', ['A', 'B'], { conj: 'or' });
    const major = {
      requirement_groups: [{
        is_required: true,
        sections: [{ unit_advisement: 3, receivers: [fallback] }],
      }],
    };
    const cb = catalog({
      A: { units: 3, same_as: [] },
      B: { units: 3, same_as: [] },
    });
    const telemetry = {};

    expect(selectMissingAcrossMajorsOptimal(
      [major], { ...ctxFor(cb), telemetry },
    )).toEqual([]);
    expect(telemetry.unsupportedUnitFallbacks).toBe(1);
    expect(telemetry.optimalityProven).toBe(false);
  });

  it('reports whether branch-and-bound proved the returned minimum', () => {
    const major = {
      requirement_groups: [{
        is_required: true,
        sections: [{ section_advisement: 1, receivers: [rcv('h1', ['c1']), rcv('h2', ['c2'])] }],
      }],
    };
    const cb = catalog({ c1: { units: 4, same_as: [] }, c2: { units: 3, same_as: [] } });
    const telemetry = {};
    expect(selectMissingAcrossMajorsOptimal([major], { ...ctxFor(cb), telemetry })).toEqual(['c2']);
    expect(telemetry).toMatchObject({
      algorithm: 'pmt-bnb-v2-group-frontier',
      greedyCourseCount: 1,
      bestCourseCount: 1,
      bestUnits: 3,
      timedOut: false,
      cartesianFallbacks: 0,
      optimalityProven: true,
    });
    expect(telemetry.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('does not call a missing catalog course a proven optimum', () => {
    const major = {
      requirement_groups: [{ is_required: true, sections: [{ receivers: [rcv('h1', ['missing'])] }] }],
    };
    const telemetry = {};
    expect(selectMissingAcrossMajorsOptimal(
      [major],
      { ...ctxFor(catalog({})), telemetry },
    )).toEqual([]);
    expect(telemetry.missingCatalogIds).toEqual(['missing']);
    expect(telemetry.optimalityProven).toBe(false);
  });

  it('exposes a time-budget fallback instead of presenting it as exact', () => {
    const major = {
      requirement_groups: [{ is_required: true, sections: [{ receivers: [rcv('h1', ['c1'])] }] }],
    };
    const telemetry = {};
    expect(selectMissingAcrossMajorsOptimal(
      [major],
      { ...ctxFor(catalog({ c1: { units: 3, same_as: [] } })), telemetry, timeBudgetMs: -1 },
    )).toEqual(['c1']);
    expect(telemetry.timedOut).toBe(true);
    expect(telemetry.optimalityProven).toBe(false);
  });

  it('does not force one receiver inside a choose-N section', () => {
    const choose = (n, ids) => ({
      requirement_groups: [{
        is_required: true,
        sections: [{
          section_advisement: n,
          receivers: ids.map((id) => rcv(`h-${n}-${id}`, [id])),
        }],
      }],
    });
    const majors = [
      choose(1, ['F', 'A']),
      choose(4, ['A', 'B', 'C', 'D', 'E']),
      choose(1, ['F', 'B']),
      choose(1, ['F', 'C']),
    ];
    const cb = catalog(Object.fromEntries(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => [id, { units: 3, same_as: [] }]),
    ));
    const telemetry = {};

    expect(selectMissingAcrossMajorsOptimal(
      majors, { ...ctxFor(cb), telemetry },
    )).toEqual(['A', 'B', 'C', 'D']);
    expect(telemetry.optimalityProven).toBe(true);
  });

  it('counts a repeated id in an AND bundle only once', () => {
    const major = {
      requirement_groups: [{
        is_required: true,
        sections: [{ receivers: [rcv('duplicate', ['A', 'A', 'B'])] }],
      }],
    };
    const cb = catalog({
      A: { units: 3, same_as: [] },
      B: { units: 4, same_as: [] },
    });
    const telemetry = {};

    expect(selectMissingAcrossMajorsOptimal(
      [major], { ...ctxFor(cb), telemetry },
    )).toEqual(['A', 'B']);
    expect(telemetry.bestCourseCount).toBe(2);
    expect(telemetry.bestUnits).toBe(7);
    expect(telemetry.optimalityProven).toBe(true);
  });

  it('keeps receiver contributions open under a parent unit ask', () => {
    const weighted = (hash, ids, units) => ({
      ...rcv(hash, ids),
      receiving: { kind: 'course', parent_id: hash, units },
    });
    const major = {
      requirement_groups: [{
        is_required: true,
        group_unit_advisement: 6,
        sections: [
          {
            section_advisement: 1,
            receivers: [
              weighted('A', ['a1', 'a2'], 3),
              weighted('B', ['b'], 3),
            ],
          },
          { receivers: [weighted('C', ['c1', 'c2', 'c3'], 3)] },
        ],
      }],
    };
    const cb = catalog(Object.fromEntries(
      ['a1', 'a2', 'b', 'c1', 'c2', 'c3']
        .map((id) => [id, { units: 3, same_as: [] }]),
    ));
    const telemetry = {};

    expect(selectMissingAcrossMajorsOptimal(
      [major], { ...ctxFor(cb), telemetry },
    )).toEqual(['a1', 'a2', 'b']);
    expect(telemetry.optimalityProven).toBe(true);
  });

  it('uses the parent minimum inside a distinct-section bucket', () => {
    const major = {
      requirement_groups: [{
        is_required: true,
        group_advisement: 1,
        group_min_distinct_sections: 2,
        group_section_min_courses: 2,
        sections: [
          { receivers: [rcv('A', ['a']), rcv('B', ['b'])] },
          {
            section_advisement: 1,
            receivers: [rcv('C', ['c']), rcv('D', ['d'])],
          },
        ],
      }],
    };
    const cb = catalog(Object.fromEntries(
      ['a', 'b', 'c', 'd'].map((id) => [id, { units: 3, same_as: [] }]),
    ));
    const telemetry = {};

    expect(selectMissingAcrossMajorsOptimal(
      [major], { ...ctxFor(cb), telemetry },
    )).toEqual(['a', 'b', 'c', 'd']);
    expect(telemetry.optimalityProven).toBe(true);
  });
});
