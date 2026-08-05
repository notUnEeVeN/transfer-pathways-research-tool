import { describe, expect, it } from 'vitest';
import { curricularComplexity } from './curricularComplexity';

/** Build the callback shape from a plain course -> prerequisites map. */
const graph = (edges) => [Object.keys(edges), (k) => edges[k] || []];

/**
 * Heileman et al. 2018, Figure 2 — the paper's own worked example. Two
 * four-course curricula over three terms:
 *   (a) "two paths to terminal courses, one contains two vertices, and the
 *       other has three"; course v1 "has the highest individual course
 *       complexity"
 *   (b) "both of the longest paths have three vertices"; v1 and v2 "both must
 *       be passed before a student can attempt course v3"
 * The paper and CurricularAnalytics.jl both publish the totals: 15 and 17.
 */
const CURRICULUM_A = { v1: [], v2: ['v1'], v3: ['v2'], v4: ['v1'] };
const CURRICULUM_B = { v1: [], v2: [], v3: ['v1', 'v2'], v4: ['v3'] };

describe('curricular analytics structural metrics', () => {
  it("reproduces the paper's curriculum (a): complexity 15", () => {
    const result = curricularComplexity(...graph(CURRICULUM_A));
    expect(result.complexity).toBe(15);
  });

  it("reproduces the paper's curriculum (b): complexity 17", () => {
    const result = curricularComplexity(...graph(CURRICULUM_B));
    expect(result.complexity).toBe(17);
  });

  it('gives v1 the highest single-course complexity in curriculum (a)', () => {
    const { perCourse } = curricularComplexity(...graph(CURRICULUM_A));
    const by = Object.fromEntries(perCourse.map((c) => [c.key, c.delay + c.blocking]));
    expect(by.v1).toBe(6);
    expect(Math.max(...Object.values(by))).toBe(by.v1);
  });

  it('measures delay along the longest path THROUGH a course, not up to it', () => {
    // v1 has no prerequisites but sits on a three-course chain. Counting only
    // ancestors would call this 1; eq. (5) calls it 3.
    const { perCourse } = curricularComplexity(...graph(CURRICULUM_A));
    const v1 = perCourse.find((c) => c.key === 'v1');
    expect(v1.delay).toBe(3);
    expect(v1.blocking).toBe(3);
  });

  it('counts every downstream course in the blocking factor, not just direct dependents', () => {
    const chain = { a: [], b: ['a'], c: ['b'], d: ['c'] };
    const { perCourse } = curricularComplexity(...graph(chain));
    const by = Object.fromEntries(perCourse.map((c) => [c.key, c.blocking]));
    expect(by).toEqual({ a: 3, b: 2, c: 1, d: 0 });
  });

  it('gives an isolated course delay 1 and blocking 0', () => {
    const result = curricularComplexity(...graph({ solo: [] }));
    expect(result.perCourse).toEqual([{ key: 'solo', delay: 1, blocking: 0 }]);
    expect(result.complexity).toBe(1);
  });

  it('ignores prerequisites that fall outside the curriculum', () => {
    // The caller restricts parents to the curriculum; an unknown key must not
    // create a phantom vertex.
    const [keys] = graph({ a: [], b: ['a'] });
    const result = curricularComplexity(keys, (k) => ({ a: ['offplan'], b: ['a'] })[k] || []);
    expect(result.perCourse.map((c) => c.key).sort()).toEqual(['a', 'b']);
  });

  it('terminates on a cycle rather than recurring forever', () => {
    const result = curricularComplexity(...graph({ x: ['y'], y: ['x'] }));
    expect(Number.isFinite(result.complexity)).toBe(true);
  });
});
