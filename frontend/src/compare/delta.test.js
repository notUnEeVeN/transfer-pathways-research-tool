import { describe, expect, it } from 'vitest'
import { joinCells, verdictOf, verdictDrift } from './delta'

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
