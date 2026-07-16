import { describe, expect, it } from 'vitest'
import { layoutDag } from './dagLayout'

describe('layoutDag', () => {
  it('assigns longest-path depths as columns', () => {
    const nodes = [{ id: 'calc_1' }, { id: 'calc_2' }, { id: 'calc_3' }, { id: 'stats_1' }]
    const edges = [
      { from: 'calc_1', to: 'calc_2' },
      { from: 'calc_2', to: 'calc_3' },
      { from: 'calc_1', to: 'stats_1' },
    ]
    const { columns, depthOf } = layoutDag(nodes, edges)
    expect(depthOf.get('calc_1')).toBe(0)
    expect(depthOf.get('calc_2')).toBe(1)
    expect(depthOf.get('stats_1')).toBe(1)
    expect(depthOf.get('calc_3')).toBe(2)
    expect(columns[0]).toEqual(['calc_1'])
    expect(columns[2]).toEqual(['calc_3'])
  })

  it('survives edges referencing unknown nodes and cycles', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }]
    const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'ghost', to: 'a' }]
    const { depthOf } = layoutDag(nodes, edges)
    expect(depthOf.size).toBe(2)
  })
})
