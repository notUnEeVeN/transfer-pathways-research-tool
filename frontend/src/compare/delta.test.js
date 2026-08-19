import { describe, expect, it } from 'vitest'
import {
  compareDistributions, distributionVerdictOf, joinCells, pinnableVerdict,
  summarizeCells, verdictOf, verdictDrift,
} from './delta'

const cell = (row, col, value) => ({
  rowKey: row, rowLabel: `${row} College`, colKey: col, colLabel: `UC ${col}`, value,
})

describe('joinCells', () => {
  it('differences matched cells and counts agreement within tolerance', () => {
    const join = joinCells(
      [cell('a', 'x', 100), cell('b', 'x', 50)],
      [cell('a', 'x', 120), cell('b', 'x', 50)],
    )

    expect(join.matched).toBe(2)
    expect(join.agreeing).toBe(1)
    expect(join.cells.find((c) => c.rowKey === 'a').delta).toBe(20)
    expect(join.cells.find((c) => c.rowKey === 'b').agrees).toBe(true)
    expect(join.meanDelta).toBe(10)
    expect(join.maxAbsDelta).toBe(20)
    expect(join.maxCell.rowLabel).toBe('a College')
  })

  it('honours a non-zero tolerance without changing the deltas', () => {
    const join = joinCells([cell('a', 'x', 10)], [cell('a', 'x', 10.4)], { tolerance: 0.5 })

    expect(join.agreeing).toBe(1)
    expect(join.cells[0].delta).toBeCloseTo(0.4, 5)
  })

  // A pair one corpus studied and the other did not is a real finding. A join
  // that silently dropped it would understate the disagreement.
  it('reports unmatched cells from either side rather than hiding them', () => {
    const join = joinCells(
      [cell('a', 'x', 1), cell('only-baseline', 'x', 5)],
      [cell('a', 'x', 1), cell('only-subject', 'x', 7)],
    )

    expect(join.matched).toBe(1)
    expect(join.dropped).toHaveLength(2)
    expect(join.dropped.map((d) => d.side).sort()).toEqual(['baseline', 'subject'])
  })

  it('drops a pair when either side is non-numeric instead of coercing it', () => {
    const join = joinCells([cell('a', 'x', null)], [cell('a', 'x', 12)])

    expect(join.matched).toBe(0)
    expect(join.dropped[0].side).toBe('value')
    expect(Number.isNaN(join.meanDelta)).toBe(true)
  })

  it('returns an empty, non-throwing join for absent input', () => {
    const join = joinCells(null, undefined)

    expect(join.matched).toBe(0)
    expect(join.cells).toEqual([])
    expect(join.rows).toEqual([])
  })

  it('collects sorted row and column axes from both sides', () => {
    const join = joinCells(
      [cell('zeta', 'x', 1)],
      [cell('alpha', 'x', 2)],
    )

    expect(join.rows.map((r) => r.key)).toEqual(['alpha', 'zeta'])
    expect(join.columns.map((c) => c.key)).toEqual(['x'])
  })
})

describe('cross-corpus distributions', () => {
  it('reports n, omitted values, axes and interpolated quartiles without coercion', () => {
    const summary = summarizeCells([
      cell('a', 'x', 0), cell('b', 'x', 10), cell('c', 'y', 20), cell('d', 'y', 30),
      cell('missing', 'y', null),
    ])
    expect(summary).toEqual({
      n: 4, omitted: 1, rows: 4, columns: 2,
      mean: 15, median: 15, q1: 7.5, q3: 22.5, min: 0, max: 30,
    })
  })

  it('compares means and medians without pairing disjoint institutions', () => {
    const result = compareDistributions(
      [cell('ma-a', 'ma-x', 10), cell('ma-b', 'ma-x', 30)],
      [cell('ca-a', 'ca-x', 30), cell('ca-b', 'ca-x', 50)],
    )
    expect(result.meanDelta).toBe(20)
    expect(result.medianDelta).toBe(20)
    expect(result.baseline.n).toBe(2)
    expect(result.subject.n).toBe(2)
  })

  it('returns an explicit empty summary for an absent numeric population', () => {
    expect(summarizeCells([cell('a', 'x', null)])).toMatchObject({
      n: 0, omitted: 1, mean: null, min: null,
    })
  })

  it('reports semantic columns separately and omits an unequal-population pooled headline', () => {
    const result = compareDistributions(
      [cell('ma-a', 'computing', 10), cell('ma-b', 'computing', 30), cell('ma-a', 'non-stem', 80)],
      [cell('ca-a', 'computing', 30), cell('ca-a', 'non-stem', 40), cell('ca-b', 'non-stem', 60)],
      { groupBy: 'column', label: 'course type', pooled: false },
    )

    expect(result).toMatchObject({
      mode: 'grouped', groupBy: 'column', groupLabel: 'course type', overall: null,
    })
    expect(result.meanDelta).toBeUndefined()
    expect(result.groups.map((group) => group.key)).toEqual(['computing', 'non-stem'])
    expect(result.groups[0]).toMatchObject({
      baseline: { n: 2, mean: 20 }, subject: { n: 1, mean: 30 }, meanDelta: 10,
    })
    expect(result.groups[1]).toMatchObject({
      baseline: { n: 1, mean: 80 }, subject: { n: 2, mean: 50 }, meanDelta: -30,
    })
  })
})

describe('verdictOf / verdictDrift', () => {
  it('summarises a join into the pinned snapshot shape', () => {
    const join = joinCells([cell('a', 'x', 100)], [cell('a', 'x', 90)])

    expect(verdictOf(join)).toEqual({
      matched: 1,
      agreeing: 0,
      dropped: 0,
      mean_delta: -10,
      max_abs_delta: 10,
      max_cell: 'a College × UC x',
    })
  })

  // The point of pinning: a note written today can be contradicted later by an
  // edit nobody connected to it, and the reader must be told.
  it('detects movement between the pinned verdict and the live one', () => {
    const pinned = verdictOf(joinCells([cell('a', 'x', 100)], [cell('a', 'x', 90)]))
    const current = verdictOf(joinCells([cell('a', 'x', 100)], [cell('a', 'x', 80)]))
    const drift = verdictDrift(pinned, current)

    expect(drift).not.toBeNull()
    expect(drift.map((d) => d.field)).toContain('mean_delta')
    expect(drift.find((d) => d.field === 'max_abs_delta')).toEqual({
      field: 'max_abs_delta', from: 10, to: 20,
    })
  })

  it('reports no drift when nothing moved', () => {
    const v = verdictOf(joinCells([cell('a', 'x', 1)], [cell('a', 'x', 2)]))

    expect(verdictDrift(v, { ...v })).toBeNull()
    expect(verdictDrift(null, v)).toBeNull()
  })
})

// The eight saved exhibits pinned nothing because six of them are cross-state
// and `verdictOf` correctly refuses to invent a join. What they CAN pin is
// each corpus's own summary, so unpinnable and unrecorded stop being the same
// thing.
describe('pinning a comparison with no honest cell join', () => {
  const maCells = [cell('bristol', 'bridgewater', 40), cell('bunker', 'salem', 60)]
  const caCells = [cell('ohlone', 'davis', 30), cell('deanza', 'irvine', 50)]

  it('pins the population contrast when the corpora share no cells', () => {
    const join = joinCells(maCells, caCells)
    expect(verdictOf(join)).toBeNull()

    const pinned = pinnableVerdict(join, compareDistributions(maCells, caCells))
    expect(pinned.distribution).toEqual({
      mode: 'pair',
      baseline: { n: 2, mean: 50, median: 50 },
      subject: { n: 2, mean: 40, median: 40 },
      mean_delta: -10,
      median_delta: -10,
    })
  })

  it('prefers the cell join whenever one exists', () => {
    const join = joinCells([cell('a', 'x', 100)], [cell('a', 'x', 90)])
    const pinned = pinnableVerdict(join, compareDistributions([cell('a', 'x', 100)], [cell('a', 'x', 90)]))

    expect(pinned.distribution).toBeUndefined()
    expect(pinned.matched).toBe(1)
  })

  it('keeps grouped categories separate rather than pooling unequal populations', () => {
    const grouped = compareDistributions(
      [cell('a', 'computing', 20), cell('b', 'computing', 30), cell('a', 'math', 60)],
      [cell('c', 'computing', 40), cell('c', 'math', 70)],
      { groupBy: 'column' },
    )
    const pinned = distributionVerdictOf(grouped)

    expect(pinned.mode).toBe('grouped')
    expect(pinned.mean_delta).toBeUndefined()
    expect(pinned.groups.map((g) => [g.key, g.baseline.n, g.subject.n, g.mean_delta]))
      .toEqual([['computing', 2, 1, 15], ['math', 1, 1, 10]])
  })

  it('reports drift in a pinned distribution', () => {
    const before = distributionVerdictOf(compareDistributions(maCells, caCells))
    const after = distributionVerdictOf(compareDistributions(maCells, [...caCells, cell('west', 'davis', 90)]))
    const drift = verdictDrift({ distribution: before }, { distribution: after })

    expect(drift.map((d) => d.field)).toContain('subject n')
    expect(drift.find((d) => d.field === 'subject n')).toEqual({ field: 'subject n', from: 2, to: 3 })
  })

  it('flags a pair that changed basis between a join and a distribution', () => {
    const drift = verdictDrift(
      { distribution: distributionVerdictOf(compareDistributions(maCells, caCells)) },
      verdictOf(joinCells([cell('a', 'x', 1)], [cell('a', 'x', 2)])),
    )

    expect(drift).toEqual([{ field: 'comparison basis', from: 'distribution', to: 'cell join' }])
  })

  it('has nothing to pin when neither side has a numeric cell', () => {
    expect(pinnableVerdict(joinCells([], []), compareDistributions([], []))).toBeNull()
  })
})
