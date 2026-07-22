import { describe, expect, it } from 'vitest'
import { SOURCE_ORDER, figureRefForItem, groupGalleryBySource, sourceForItem } from './provenance'
import { ANALYSES } from '../analyses/registry'

const analysisItem = (provenance, key = 'k') => ({
  kind: 'analysis', key, analysis: { provenance },
})
const figureItem = (visual, key = 'f') => ({
  kind: 'figure', key, figure: visual ? { visual } : {},
})

describe('sourceForItem', () => {
  it('reads an analysis item’s own provenance lane', () => {
    expect(sourceForItem(analysisItem('ca'))).toBe('ca')
    expect(sourceForItem(analysisItem('ma'))).toBe('ma')
    expect(sourceForItem(analysisItem('new'))).toBe('new')
  })

  it('falls back to new for a missing or unknown lane', () => {
    expect(sourceForItem(analysisItem(undefined))).toBe('new')
    expect(sourceForItem(analysisItem('zz'))).toBe('new')
    expect(sourceForItem(null)).toBe('new')
  })

  it('is case-insensitive on the stored lane', () => {
    expect(sourceForItem(analysisItem('CA'))).toBe('ca')
  })

  it('inherits an interactive figure’s lane from the built-in it renders', () => {
    const getAnalysis = (id) => (id === 'x' ? { provenance: 'ma' } : null)
    expect(sourceForItem(figureItem({ id: 'x' }), { getAnalysis })).toBe('ma')
  })

  it('falls back to new for static figures and unknown renderers', () => {
    expect(sourceForItem(figureItem(null))).toBe('new')
    expect(sourceForItem(figureItem({ id: 'nope' }), { getAnalysis: () => null })).toBe('new')
  })

  it('resolves real published-copy renderers through the live registry', () => {
    // California-paper ports keep that lane when re-published interactively.
    expect(sourceForItem(figureItem({ id: 'paper-articulation-map' }))).toBe('ca')
    expect(sourceForItem(figureItem({ id: 'paper-articulation-histogram' }))).toBe('ca')
  })
})

describe('groupGalleryBySource', () => {
  it('buckets in CA → MA → New order and drops empty lanes', () => {
    const groups = groupGalleryBySource([
      analysisItem('new', 'a'),
      analysisItem('ca', 'b'),
      analysisItem('ca', 'c'),
    ])
    expect(groups.map((g) => g.id)).toEqual(['ca', 'new']) // ma dropped
    expect(groups[0].items.map((i) => i.key)).toEqual(['b', 'c'])
    expect(groups[0].meta.label).toBe('CA')
  })

  it('preserves the incoming order within a lane', () => {
    const groups = groupGalleryBySource([
      analysisItem('ma', 'first'),
      analysisItem('ma', 'second'),
      analysisItem('ma', 'third'),
    ])
    expect(groups[0].items.map((i) => i.key)).toEqual(['first', 'second', 'third'])
  })

  it('returns nothing for an empty or missing gallery', () => {
    expect(groupGalleryBySource([])).toEqual([])
    expect(groupGalleryBySource(undefined)).toEqual([])
  })

  it('places every real built-in analysis into exactly one known lane', () => {
    const gallery = ANALYSES.map((analysis) => ({
      kind: 'analysis', key: `analysis:${analysis.id}`, analysis,
    }))
    const groups = groupGalleryBySource(gallery)
    const total = groups.reduce((n, g) => n + g.items.length, 0)
    expect(total).toBe(ANALYSES.length)
    expect(groups.every((g) => SOURCE_ORDER.includes(g.id))).toBe(true)
  })
})

describe('figureRefForItem', () => {
  it('labels a ported analysis as "<lane> Fig. <n>"', () => {
    expect(figureRefForItem({ kind: 'analysis', analysis: { provenance: 'ma', figureNo: 1 } })).toBe('MA Fig. 1')
    expect(figureRefForItem({ kind: 'analysis', analysis: { provenance: 'ca', figureNo: 4 } })).toBe('CA Fig. 4')
  })

  it('returns null when there is no figure number', () => {
    expect(figureRefForItem({ kind: 'analysis', analysis: { provenance: 'ma' } })).toBe(null)
    expect(figureRefForItem(null)).toBe(null)
  })

  it('inherits an interactive figure’s pill from the built-in it renders', () => {
    const getAnalysis = (id) => (id === 'x' ? { provenance: 'ca', figureNo: 2 } : null)
    expect(figureRefForItem({ kind: 'figure', figure: { visual: { id: 'x' } } }, { getAnalysis })).toBe('CA Fig. 2')
  })

  it('returns null for static figures and unknown renderers', () => {
    expect(figureRefForItem({ kind: 'figure', figure: {} })).toBe(null)
    expect(figureRefForItem({ kind: 'figure', figure: { visual: { id: 'nope' } } }, { getAnalysis: () => null })).toBe(null)
  })

  it('reads a real port’s number from the live registry', () => {
    const analysis = ANALYSES.find((a) => a.id === 'paper-articulation-map')
    expect(figureRefForItem({ kind: 'analysis', analysis })).toBe('CA Fig. 4')
  })
})
