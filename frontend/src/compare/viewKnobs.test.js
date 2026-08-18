import { describe, expect, it } from 'vitest'
import { ANALYSES, getAnalysisById } from '../analyses/registry'
import { paperEntries } from '../analyses/PathwayComplexity'
import { CONTROL_KEY_RE, fingerprintOf, knobsFor, viewPropsFor } from './viewKnobs'

/**
 * The measures.js hazard — "a stale formula is worse than none" — applied to
 * controls. A knob naming a prop the figure does not read would render the
 * figure's default under a caption claiming something else was pinned, and a
 * `comparable` adapter that re-derived its own reading would let the delta
 * overlay contradict the matrix beside it. Both are silent failures at a
 * meeting, so both fail here instead.
 */

const KNOB_TYPES = ['select', 'toggle']

const withKnobs = ANALYSES.filter((analysis) => Array.isArray(analysis.viewKnobs))
const withComparable = ANALYSES.filter((analysis) => analysis.comparable)

// The Massachusetts payload's real shape: eleven resident anchors and the
// pairs measured against them, one resident score that drifted from their own
// sheet, and one cell the printed figure types differently from the tab it was
// supposedly computed from. Those last two are exactly what a re-derived
// `cells` would get wrong, which is why the fixture carries them.
const PAPER_FIXTURE = {
  mode: 'paper',
  headline_plus_15: { over_scored_pathways: 15.94, over_all_pathways: 10.34 },
  misses: [
    {
      pathway: 'Bridgewater (resident)',
      ours: 164, theirs: 160, delta: 4,
      tab_credits: 123, their_published_hours: 120, tab_drifted: true,
    },
  ],
  figure_cell_misses: [
    { uni: 'Salem', cc: 'North Shore', printed_delta: -3, tab_delta: 12, note: 'Printed cell contradicts their tab.' },
  ],
  pathways: [
    { pathway: 'Bridgewater (resident)', uni: 'Bridgewater', cc: null, ours: 164, theirs: 160, their_hours: 120 },
    { pathway: 'Bridgewater x Cape Cod', uni: 'Bridgewater', cc: 'Cape Cod', ours: 180, theirs: 180, their_hours: 131 },
    { pathway: 'Bridgewater x Bristol', uni: 'Bridgewater', cc: 'Bristol', ours: 190, theirs: 186, their_hours: 130 },
    { pathway: 'Salem (resident)', uni: 'Salem', cc: null, ours: 140, theirs: 140, their_hours: 120 },
    { pathway: 'Salem x North Shore', uni: 'Salem', cc: 'North Shore', ours: 152, theirs: 152, their_hours: 129 },
  ],
}

const LIVE_FIXTURE = {
  rows: [
    { school: 'UC Example', college_name: 'Alpha College', complexity: 120, resident_complexity: 100, delta_vs_resident: 20 },
    { school: 'UC Example', college_name: 'Beta College', complexity: 90, resident_complexity: 100, delta_vs_resident: -10 },
  ],
}

const MA_MAJOR = { slug: 'ma-cs', state: 'ma', capabilities: { paperBaselines: true, prerequisites: false } }
const CA_MAJOR = { slug: 'cs', capabilities: { paperBaselines: true, prerequisites: true } }

describe('viewKnobs declarations', () => {
  it('declares knobs only on registered analyses', () => {
    expect(withKnobs.length).toBeGreaterThan(0)
    for (const analysis of withKnobs) {
      expect(getAnalysisById(analysis.id)).toBe(analysis)
    }
  })

  it('names only props the figure actually reads', () => {
    for (const analysis of withKnobs) {
      const viewProps = analysis.Component?.viewProps
      expect(Array.isArray(viewProps), `${analysis.id} has no Component.viewProps`).toBe(true)
      for (const knob of analysis.viewKnobs) {
        expect(viewProps, `${analysis.id}.${knob.key}`).toContain(knob.prop)
      }
    }
  })

  it('uses the published-control vocabulary the server already validates', () => {
    for (const analysis of withKnobs) {
      for (const knob of analysis.viewKnobs) {
        expect(CONTROL_KEY_RE.test(knob.key), `${analysis.id}.${knob.key}`).toBe(true)
        expect(KNOB_TYPES).toContain(knob.type)
        if (knob.type === 'select') {
          expect(knob.options.length).toBeGreaterThan(1)
          expect(knob.options.map((option) => option.value)).toContain(knob.default)
        }
      }
    }
  })

  it('declares a comparable adapter with a grain, a unit and a tolerance', () => {
    for (const analysis of withComparable) {
      expect(getAnalysisById(analysis.id)).toBe(analysis)
      expect(typeof analysis.comparable.grain).toBe('string')
      expect(typeof analysis.comparable.unit).toBe('string')
      expect(Number.isFinite(analysis.comparable.tolerance)).toBe(true)
      expect(typeof analysis.comparable.useData).toBe('function')
      expect(typeof analysis.comparable.cells).toBe('function')
    }
  })
})

describe('pathway-complexity', () => {
  const analysis = getAnalysisById('pathway-complexity')
  const cellsFor = (data, source) => analysis.comparable.cells(
    data,
    { figure: 'pathway-complexity', major: 'ma-cs', knobs: source ? { source } : {} },
  )

  // The parity is an identity, not a hope: `cells` calls the figure's own
  // exported reading. This test is what stops that from being quietly replaced
  // by an equivalent-looking derivation.
  it.each(['published', 'ours', 'diff'])('reads cells through the figure\'s own paperEntries (%s)', (source) => {
    const entries = paperEntries(PAPER_FIXTURE, source)
    const cells = cellsFor(PAPER_FIXTURE, source)

    expect(cells).toHaveLength(entries.length)
    cells.forEach((cell, index) => {
      expect(cell.rowKey).toBe(entries[index].row)
      expect(cell.rowLabel).toBe(entries[index].row)
      expect(cell.colKey).toBe(entries[index].column)
      expect(cell.colLabel).toBe(entries[index].column)
      expect(cell.value).toBe(entries[index].delta)
    })
  })

  // The two readings a re-derivation loses: the cell the FIGURE prints
  // differently from their tab, and the resident anchor that drifted.
  it('carries the printed-cell override and the drifted resident anchor', () => {
    const published = cellsFor(PAPER_FIXTURE, 'published')
    const ours = cellsFor(PAPER_FIXTURE, 'ours')
    const at = (cells, row) => cells.find((cell) => cell.rowKey === row).value

    expect(at(published, 'North Shore')).toBe(-3)
    expect(at(ours, 'North Shore')).toBe(12)
    expect(at(published, 'Cape Cod')).toBe(20)
    expect(at(ours, 'Cape Cod')).toBe(16)
  })

  it('falls back to the published reading when no source is pinned', () => {
    expect(cellsFor(PAPER_FIXTURE, null)).toEqual(cellsFor(PAPER_FIXTURE, 'published'))
  })

  it('maps the live corpus off the scored rows, and absent data to nothing', () => {
    expect(cellsFor(LIVE_FIXTURE, null)).toEqual([
      { rowKey: 'Alpha College', rowLabel: 'Alpha College', colKey: 'UC Example', colLabel: 'UC Example', value: 20 },
      { rowKey: 'Beta College', rowLabel: 'Beta College', colKey: 'UC Example', colLabel: 'UC Example', value: -10 },
    ])
    expect(cellsFor(undefined, null)).toEqual([])
  })

  // California scores its pathways live, so it has no published-vs-recomputed
  // distinction to pin — the figure would ignore the prop.
  it('offers the source control only where the server answers mode: paper', () => {
    expect(knobsFor(analysis, MA_MAJOR).map((knob) => knob.key)).toEqual(['source'])
    expect(knobsFor(analysis, CA_MAJOR)).toEqual([])
  })

  it('seeds the figure prop and elides the default from the fingerprint', () => {
    const published = { figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'published' } }
    const ours = { figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'ours' } }

    expect(viewPropsFor(ours, analysis, MA_MAJOR)).toEqual({ defaultPaperView: 'ours' })
    expect(fingerprintOf(published, analysis, MA_MAJOR)).toBe('pathway-complexity@ma-cs')
    expect(fingerprintOf(ours, analysis, MA_MAJOR)).toBe('pathway-complexity@ma-cs?source=ours')
  })
})
