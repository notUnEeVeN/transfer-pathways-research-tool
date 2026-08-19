import { describe, expect, it } from 'vitest'
import { ANALYSES, getAnalysisById } from '../analyses/registry'
import { paperEntries } from '../analyses/PathwayComplexity'
import { assessComparability } from './comparability'
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

// The Massachusetts payload keeps the final PDF, archived score tab and
// independent recomputation separate. These two cells exercise each kind of
// source divergence without manufacturing a hybrid delta.
const PAPER_FIXTURE = {
  mode: 'paper',
  final_pdf: { cells: {
    Bristol: { 'UMass Dartmouth': -32 },
    'Springfield Technical': { 'UMass Amherst': -28 },
    'PDF-only College': { 'UMass Amherst': 7 },
  } },
  artifact_differences: [
    {
      uni: 'UMass Dartmouth', cc: 'Bristol', final_pdf_delta: -32,
      archived_tab_delta: -32, recomputed_archive_delta: -28,
      classification: 'recomputed_archive_vs_archived_tab',
    },
    {
      uni: 'UMass Amherst', cc: 'Springfield Technical', final_pdf_delta: -28,
      archived_tab_delta: 34, recomputed_archive_delta: 34,
      classification: 'final_pdf_vs_archived_tab',
    },
  ],
  pathways: [
    { pathway: 'UMass Dartmouth (resident)', uni: 'UMass Dartmouth', cc: null, ours: 202, theirs: 202 },
    { pathway: 'UMass Dartmouth x Bristol', uni: 'UMass Dartmouth', cc: 'Bristol', ours: 174, theirs: 170 },
    { pathway: 'UMass Amherst (resident)', uni: 'UMass Amherst', cc: null, ours: 185, theirs: 185 },
    { pathway: 'UMass Amherst x Springfield Technical', uni: 'UMass Amherst', cc: 'Springfield Technical', ours: 219, theirs: 219 },
  ],
}

const LIVE_FIXTURE = {
  rows: [
    { school: 'UC Example', college_name: 'Alpha College', complexity: 120, resident_complexity: 100, delta_vs_resident: 20 },
    { school: 'UC Example', college_name: 'Beta College', complexity: 90, resident_complexity: 100, delta_vs_resident: -10 },
  ],
}

const MA_MAJOR = {
  slug: 'ma-cs', state: 'ma', degreeAnalysisSlots: ['local_as'],
  capabilities: { paperBaselines: true, prerequisites: false },
}
const CA_MAJOR = {
  slug: 'cs', degreeAnalysisSlots: ['local_as', 'ast'],
  capabilities: { paperBaselines: true, prerequisites: true },
}

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

  it('carries the final-PDF revision and archived-score divergence independently', () => {
    const published = cellsFor(PAPER_FIXTURE, 'published')
    const ours = cellsFor(PAPER_FIXTURE, 'ours')
    const at = (cells, row) => cells.find((cell) => cell.rowKey === row).value

    expect(at(published, 'Springfield Technical')).toBe(-28)
    expect(at(ours, 'Springfield Technical')).toBe(34)
    expect(at(published, 'Bristol')).toBe(-32)
    expect(at(ours, 'Bristol')).toBe(-28)
    expect(at(published, 'PDF-only College')).toBe(7)
    expect(ours.some((cell) => cell.rowKey === 'PDF-only College')).toBe(false)
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
    expect(knobsFor(analysis, CA_MAJOR).map((knob) => knob.key)).toEqual(['degree', 'verified'])
  })

  it('seeds the figure prop and elides the default from the fingerprint', () => {
    const published = { figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'published' } }
    const ours = { figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'ours' } }

    expect(viewPropsFor(ours, analysis, MA_MAJOR)).toEqual({ defaultPaperView: 'ours' })
    expect(fingerprintOf(published, analysis, MA_MAJOR)).toBe('pathway-complexity@ma-cs')
    expect(fingerprintOf(ours, analysis, MA_MAJOR)).toBe('pathway-complexity@ma-cs?source=ours')
  })

  it('persists the California degree knob and declares the exact Figure 6 contract', () => {
    const caView = {
      figure: 'pathway-complexity', major: 'cs', knobs: { degree: 'local_as', verified: false },
    }
    expect(viewPropsFor(caView, analysis, CA_MAJOR)).toEqual({
      defaultDegreeType: 'local_as',
      defaultVerifiedOnly: false,
    })
    expect(fingerprintOf(caView, analysis, CA_MAJOR))
      .toBe('pathway-complexity@cs?degree=local_as&verified=0')

    const caContract = analysis.comparisonContract(caView, CA_MAJOR)
    const maContract = analysis.comparisonContract({
      figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'published' },
    }, MA_MAJOR)
    expect(caContract).toMatchObject({
      measure: 'transfer-minus-resident-curricular-complexity',
      unit: 'structural-complexity score points',
      grain: 'community college × university campus',
      context: {
        source: 'live pathway-complexity model v3',
        degree: 'local_as',
        cohort: expect.stringMatching(/all resolvable associate-degree sources/i),
      },
    })
    expect(caContract.semantics.weighting).toMatch(/each finite college×campus pathway/i)
    expect(caContract.semantics.graph).toMatch(/unenumerated associate GE courses are absent/i)
    expect(maContract.context).toMatchObject({
      source: 'final PDF Figure 6', degree: 'local_as',
      cohort: '49 final-PDF Figure 6 pathways',
    })
    expect(maContract.semantics.graph).toMatch(/literal final-PDF deltas/i)
  })
})

describe('Figures 4 and 5 comparison contracts', () => {
  const data = { rows: [{
    college_name: 'Berkshire Community College', school: 'MCLA',
    published_pdf_extra_hours: 26,
    archived_pathway_sheet_extra_hours: 24,
    modeled_hours_above_120: 20,
    published_pdf_extra_cost_usd: 13202,
    modeled_cost_above_120_usd: 10000,
    modeled_cost_above_120_standard_load_usd: 8000,
  }] }

  it('offers the MA published/recomputed source only on the paper corpus', () => {
    const units = getAnalysisById('transfer-extra-units')
    const cost = getAnalysisById('transfer-extra-cost')
    expect(knobsFor(units, MA_MAJOR).map((knob) => knob.key)).toEqual(['source'])
    expect(knobsFor(units, MA_MAJOR).find((knob) => knob.key === 'source')
      .options.map((option) => option.value)).toEqual(['pdf', 'archive-detail'])
    expect(knobsFor(units, CA_MAJOR).map((knob) => knob.key)).toEqual(['degree', 'verified'])
    expect(knobsFor(cost, MA_MAJOR).map((knob) => knob.key)).toEqual(['source'])
    expect(knobsFor(cost, CA_MAJOR).map((knob) => knob.key)).toEqual(['degree', 'verified', 'load'])
  })

  it('pins only the two-source choice for the MA paper corpus', () => {
    const cost = getAnalysisById('transfer-extra-cost')
    const view = {
      figure: 'transfer-extra-cost', major: 'ma-cs',
      knobs: { source: 'archive-detail' },
    }
    expect(viewPropsFor(view, cost, MA_MAJOR)).toEqual({
      defaultSource: 'archive-detail',
    })
    expect(fingerprintOf(view, cost, MA_MAJOR))
      .toBe('transfer-extra-cost@ma-cs?source=archive-detail')
  })

  it('adapts the exact same source fields the two heatmaps render', () => {
    const units = getAnalysisById('transfer-extra-units')
    const cost = getAnalysisById('transfer-extra-cost')
    const value = (cells) => cells[0]?.value

    expect(value(units.comparable.cells(data, {
      major: 'ma-cs', knobs: { source: 'pdf' },
    }, MA_MAJOR))).toBe(26)
    expect(value(units.comparable.cells(data, {
      major: 'ma-cs', knobs: { source: 'archive-detail' },
    }, MA_MAJOR))).toBe(24)
    expect(value(cost.comparable.cells(data, {
      major: 'ma-cs', knobs: { source: 'pdf', load: 'minimum' },
    }, MA_MAJOR))).toBe(13202)
  })

  it('permits the cross-state hours distribution but refuses an unproved cost price basis', () => {
    const units = getAnalysisById('transfer-extra-units')
    const cost = getAnalysisById('transfer-extra-cost')
    const maUnits = units.comparisonContract({
      major: 'ma-cs', knobs: { degree: 'local_as', source: 'pdf' },
    }, MA_MAJOR)
    const caUnits = units.comparisonContract({
      major: 'cs', knobs: { degree: 'ast', verified: true },
    }, CA_MAJOR)
    expect(maUnits.semantics).toEqual(caUnits.semantics)
    expect(maUnits.context).not.toEqual(caUnits.context)

    const maCost = cost.comparisonContract({
      major: 'ma-cs', knobs: { source: 'pdf', load: 'minimum' },
    }, MA_MAJOR)
    const caCost = cost.comparisonContract({
      major: 'cs', knobs: { verified: true, load: 'minimum' },
    }, CA_MAJOR)
    expect(maCost.semantics).not.toEqual(caCost.semantics)
    expect(maCost.semantics.price_basis).not.toBe(caCost.semantics.price_basis)
    expect(maCost.context.rate).not.toBe(caCost.context.rate)
    expect(cost.comparisonContract({
      major: 'cs', knobs: { verified: true, load: 'standard' },
    }, CA_MAJOR).semantics).not.toEqual(caCost.semantics)

    const majors = { 'ma-cs': MA_MAJOR, cs: CA_MAJOR }
    expect(assessComparability([
      { id: 'p1', figure: units.id, major: 'ma-cs', knobs: { source: 'pdf', degree: 'local_as' } },
      { id: 'p2', figure: units.id, major: 'cs', knobs: { verified: true, degree: 'ast' } },
    ], majors, getAnalysisById).join).toBe('disjoint')
    const costAssessment = assessComparability([
      { id: 'p1', figure: cost.id, major: 'ma-cs', knobs: { source: 'pdf', load: 'minimum' } },
      { id: 'p2', figure: cost.id, major: 'cs', knobs: { verified: true, load: 'minimum' } },
    ], majors, getAnalysisById)
    expect(costAssessment.join).toBe('refused')
    expect(costAssessment.warnings.map((warning) => warning.code))
      .toContain('distribution_semantics_mismatch')
  })
})
