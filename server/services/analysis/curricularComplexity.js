/**
 * Curricular Analytics structural metrics — Heileman, Abdallah, Slim & Hickman
 * (2018), "Curricular Analytics: A Framework for Quantifying the Impact of
 * Curricular Reforms and Pedagogical Innovations", arXiv:1811.09676.
 *
 * These are the metrics the MA transfer paper reports in its Figure 6, computed
 * there with the authors' own tool at curricularanalytics.org. This module
 * implements the published equations directly so the same numbers can be
 * produced live; the reference implementation (CurricularAnalytics.jl, AGPL-3.0)
 * is used as the acceptance anchor, not as a source to translate.
 *
 *   delay factor    eq. (5)  d(v) = vertices on the longest path THROUGH v
 *   blocking factor eq. (7)  b(v) = courses reachable from v
 *   complexity      eq. (14) h(G) = Σ (d(v) + b(v))
 *
 * The delay factor is the one that is easy to get wrong. It is not the chain of
 * prerequisites leading up to a course — it is the longest path the course sits
 * on, dependents included. Measuring only ancestors gives an introductory course
 * a delay of 1 no matter how much of the curriculum hangs off it, which
 * understates a realistic computing graph by roughly a fifth and understates it
 * precisely at the foundational courses that matter most.
 */

/**
 * @param {string[]} keys      every course in the curriculum
 * @param {(key: string) => string[]} parentsOf  a course's prerequisites, already
 *   restricted to courses inside this curriculum
 */
function curricularComplexity(keys, parentsOf) {
  const children = new Map(keys.map((k) => [k, []]));
  for (const k of keys) for (const p of parentsOf(k)) children.get(p)?.push(k);

  // In a DAG the longest path through k splits at k, so it is (longest chain
  // ending at k) + (longest chain starting at k) - 1. Memoized this is O(V+E);
  // enumerating every path, as the reference implementation does, is
  // exponential in the worst case. The results agree.
  //
  // `seen` guards against a cycle in malformed data — the published metrics are
  // only defined on acyclic graphs, and a cycle would otherwise not terminate.
  const longest = (adjacency) => {
    const memo = new Map();
    const walk = (k, seen) => {
      if (memo.has(k)) return memo.get(k);
      if (seen.has(k)) return 1;
      seen.add(k);
      const d = 1 + Math.max(0, ...(adjacency(k) || []).map((n) => walk(n, seen)));
      seen.delete(k);
      memo.set(k, d);
      return d;
    };
    return (k) => walk(k, new Set());
  };
  const up = longest(parentsOf);
  const down = longest((k) => children.get(k) || []);

  const blocking = (k) => {
    const seen = new Set();
    const stack = [...(children.get(k) || [])];
    while (stack.length) {
      const c = stack.pop();
      if (seen.has(c)) continue;
      seen.add(c);
      stack.push(...(children.get(c) || []));
    }
    return seen.size;
  };

  const perCourse = keys.map((key) => ({
    key,
    delay: up(key) + down(key) - 1,
    blocking: blocking(key),
  }));
  return {
    perCourse,
    complexity: perCourse.reduce((sum, c) => sum + c.delay + c.blocking, 0),
    delayTotal: perCourse.reduce((sum, c) => sum + c.delay, 0),
    blockingTotal: perCourse.reduce((sum, c) => sum + c.blocking, 0),
    maxDelay: perCourse.length ? Math.max(...perCourse.map((c) => c.delay)) : 0,
  };
}

module.exports = { curricularComplexity };
