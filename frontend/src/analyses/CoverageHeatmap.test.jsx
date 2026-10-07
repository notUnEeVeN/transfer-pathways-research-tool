import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoverageHeatmap, {
  buildHeatmap, coverageComparisonCells, createCoverageColorScale, makeCellColor,
} from './CoverageHeatmap'
import { paperRedCellColor } from './maHeatmapColors'
import { VA_COVERAGE_ROWS } from './vaCoverageRows'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

const degreeRow = {
  school_id: 1,
  school: 'UC Test',
  major: 'Computer Science, B.S.',
  community_college_id: 10,
  community_college: 'Test College',
  community_college_ids: [10],
  row_group_kind: 'college',
  row_group_key: '10',
  row_group_label: 'Test College',
  receivers_required: 40,
  receivers_articulated: 16,
  degree_requirements_total: 40,
  degree_requirements_with_equivalent: 16,
  pct_degree_requirements: 40,
  degree_units_modeled_total: 180,
  degree_units_with_equivalent: 99,
  pct_degree_units: 55,
  degree_units_stated_minimum: 180,
  degree_unit_system: 'quarter',
  pct_articulated: 55,
  fully_articulated: false,
  named_requirement_courses_total: 24,
  named_requirement_courses_articulated: 6,
  pct_named_requirement_courses: 25,
  named_requirement_courses_with_ge_total: 32,
  named_requirement_courses_with_ge_articulated: 14,
  pct_named_requirement_courses_with_ge: 43.8,
}

describe('CoverageHeatmap requirement basis', () => {
  beforeEach(() => {
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { n: 1, rows: [degreeRow] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
  })

  it('defaults to the paper-equivalent named-course lens', () => {
    const { container } = render(<CoverageHeatmap />)

    expect(useCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ majorSlug: 'cs', requirements: 'degree' }),
      expect.any(Object)
    )
    expect(screen.queryByRole('textbox', { name: 'Degree program filter' })).toBeNull()
    expect(container.querySelector('[data-export-root]')).toBeTruthy()
    expect(screen.getByRole('button', { name: '4-year graduation plan (by units)' })).toBeTruthy()
    expect(screen.queryByText('Mean unit coverage')).not.toBeInTheDocument()
    expect(screen.queryByText('Coverage cells')).not.toBeInTheDocument()
    expect(screen.getByText('MA-equivalent requirement articulation')).toBeTruthy()
    expect(screen.getByLabelText('Coverage color scale from 15% to 35%')).toBeTruthy()
    expect(screen.getByLabelText(/MA-equivalent articulation: 25%/)).toBeTruthy()
    expect(screen.getByLabelText(/6 of 24 required courses articulate/)).toBeTruthy()
    // The measure panel is the single home for the definition; the figure
    // itself carries no explanatory footnote.
    expect(screen.queryByText(/Each campus is calculated in its own native quarter or semester units/)).toBeNull()
  })

  it('keeps the bachelor-template evidence receipt inside exports', () => {
    const major = {
      degreeTemplateEvidence: {
        total: 9,
        explicitlyVerified: 9,
        catalogYears: '2025-26 (8 templates); 2026-27 (UC San Diego)',
        staleResearchStatus: 9,
      },
    }
    const { container } = render(<CoverageHeatmap majorSlug='bio' major={major}
      majorCapabilities={{ transferMinimums: false }} />)
    const exportRoot = container.querySelector('[data-export-root]')
    expect(within(exportRoot).getByText(/9\/9 bachelor templates explicitly verified/i))
      .toBeInTheDocument()
    expect(within(exportRoot).getByText(/2025-26.*2026-27/i)).toBeInTheDocument()
    expect(within(exportRoot).getByText(/9 stale pre-verification research-status labels/i))
      .toBeInTheDocument()
  })

  it('uses and exports the fixed shared percentage domain in Comparison', () => {
    const scale = { min: 0, mid: 50, max: 100, comparisonShared: true }
    const { container } = render(<CoverageHeatmap comparisonColorScale={scale} />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(within(exportRoot).getByText('Shared comparison color domain: 0%–100%'))
      .toBeInTheDocument()
    expect(screen.getByLabelText(/MA-equivalent articulation: 25%/))
      .toHaveStyle({ backgroundColor: paperRedCellColor(25, scale).backgroundColor })
  })

  it('locks a corpus without unit modeling into the paper lens: no basis select, no toggle-off', () => {
    const onMeasureChange = vi.fn()
    render(<CoverageHeatmap majorSlug='ma-cs'
      majorCapabilities={{ transferMinimums: false, unitCoverage: false }}
      onMeasureChange={onMeasureChange} />)

    // The California unit-BUDGET lenses compute garbage for this corpus, so
    // they are simply absent — the paper's lens is the figure here, not a
    // comparison state that could be switched off.
    expect(screen.queryByText('Requirement basis')).toBeNull()
    expect(screen.queryByRole('button', { name: 'MA-paper equivalent' })).toBeNull()
    // Weighting stays: counting the paper's own population or weighting it by
    // credit are both answerable from this corpus.
    expect(screen.getByRole('button', { name: 'Courses' })).toBeTruthy()
    // GE does NOT. No Massachusetts artifact classifies general education —
    // the "GE" block is only what Figure 1's columns did not consume, so a
    // GE-included reading grants credit for rows nothing shows to be GE. The
    // authors' own Figure 3 caps a pair at 68 transferable credits; the
    // GE-included lens read 75. The control is absent rather than qualified.
    expect(screen.queryByRole('button', { name: 'Include GE' })).toBeNull()
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ majorSlug: 'ma-cs', requirements: 'degree' }),
      expect.any(Object)
    )
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/required courses/) })
    )
  })

  it('offers Massachusetts Figure 1 only as the final paper or our recalculation', () => {
    const pdfRow = {
      ...degreeRow,
      school: 'University of Massachusetts Dartmouth',
      major: 'Computer Science, B.S.',
      community_college: 'Cape Cod Community College',
      row_group_label: 'Cape Cod Community College',
      named_requirement_courses_total: 31,
      named_requirement_courses_articulated: 11,
      pct_named_requirement_courses: 35.4839,
      published_pdf_pct_named_requirement_courses: 45,
      published_pdf_named_requirement_column_average: 37,
      published_pdf_named_requirement_prose_mean: 38.2,
    }
    useCoverage.mockReturnValue({
      data: { n: 1, rows: [pdfRow] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    const pdf = buildHeatmap([pdfRow], 'ma-courses', { maSource: 'pdf' })
    const archive = buildHeatmap([pdfRow], 'ma-courses', { maSource: 'archive' })
    expect(pdf.rows[0].values).toEqual([45])
    expect(pdf.columnMeans).toEqual([37])
    expect(pdf.paperProseMean).toBe(38.2)
    expect(archive.rows[0].values[0]).toBeCloseTo(11 / 31 * 100)

    const maMajor = { state: 'ma', capabilities: { paperBaselines: true } }
    const { container } = render(
      <CoverageHeatmap majorSlug='ma-cs' major={maMajor}
        majorCapabilities={{ paperBaselines: true, unitCoverage: false }} />
    )
    const exportRoot = container.querySelector('[data-export-root]')
    expect(within(exportRoot).getByText(/Final paper: Figure 1 as printed/i))
      .toBeInTheDocument()
    expect(within(exportRoot).getAllByText('45%').length).toBeGreaterThan(0)
    expect(within(exportRoot).getByText('37%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Final paper' }))
    fireEvent.click(screen.getByRole('option', { name: 'Our recalculation' }))
    expect(within(exportRoot).getByText(/Our recalculation: the authors’ released course-level data/i))
      .toBeInTheDocument()
    expect(within(exportRoot).getAllByText('35.5%').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Archived workbook reconstruction/i)).toBeNull()
  })

  it('keeps the exact archived numerator and denominator in the Figure 1 audit adapter', () => {
    const row = {
      ...degreeRow,
      school_id: 9008,
      school: 'UMass Dartmouth',
      major: 'Computer Science, B.S.',
      community_college_id: 201,
      community_college: 'Cape Cod Community College',
      row_group_key: '201',
      row_group_label: 'Cape Cod Community College',
      named_requirement_courses_total: 31,
      named_requirement_courses_articulated: 11,
      // The table displays one decimal, but Compare must retain 11/31 so the
      // paper's whole-percentage rounding can be audited without double
      // rounding 35.4839 to 35.5 first.
      pct_named_requirement_courses: 35.5,
      published_pdf_pct_named_requirement_courses: 45,
    }
    const major = { state: 'ma', capabilities: { paperBaselines: true, unitCoverage: false } }
    const pdf = coverageComparisonCells(
      { rows: [row] },
      { major: 'ma-cs', knobs: { rows: 'college', 'ma-source': 'pdf' } },
      major,
    )
    const archive = coverageComparisonCells(
      { rows: [row] },
      { major: 'ma-cs', knobs: { rows: 'college', 'ma-source': 'archive' } },
      major,
    )

    expect(pdf[0].value).toBe(45)
    expect(archive[0].value).toBeCloseTo((11 / 31) * 100, 10)
    expect(archive[0].value).not.toBe(35.5)
  })

  it('elevates the MA-paper equivalent to its own toggle over the same degree rows', () => {
    const onMeasureChange = vi.fn()
    render(<CoverageHeatmap onMeasureChange={onMeasureChange} />)

    // The definition of the current state lives in the measure panel, which
    // the figure keeps in sync — nothing is explained in figure footnotes.
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/required courses/) })
    )

    const toggle = screen.getByRole('button', { name: 'MA-paper equivalent' })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    // Not a dropdown entry: the comparison is important enough to stand alone.
    fireEvent.click(screen.getByRole('button', { name: '4-year graduation plan (by units)' }))
    expect(screen.queryByRole('option', { name: /MA-paper equivalent/ })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'ASSIST minimums' }))
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/ASSIST/) })
    )

    fireEvent.click(toggle)

    // The lens reads the degree response regardless of the basis selection,
    // and the basis select goes quiet while it is active.
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ requirements: 'degree' }),
      expect.any(Object)
    )
    expect(screen.getByLabelText(/MA-equivalent articulation: 25%/)).toBeTruthy()
    expect(screen.getByLabelText(/6 of 24 required courses articulate/)).toBeTruthy()
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: expect.stringMatching(/required courses/),
        watchFor: expect.stringMatching(/38\.2%/),
      })
    )

    // GE-heavy majors read artificially low with GE excluded, so MA mode
    // carries its own GE sub-toggle; the paper-faithful GE-off state is the
    // default and the GE-on state is clearly our extension.
    const geToggle = screen.getByRole('button', { name: 'Include GE' })
    expect(geToggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(geToggle)
    expect(screen.getByLabelText(/MA-equivalent articulation: 43.8%/)).toBeTruthy()
    expect(screen.getByLabelText(/14 of 32 required courses articulate/)).toBeTruthy()
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: expect.stringMatching(/general education included/),
        watchFor: expect.stringMatching(/not a figure they published/),
      })
    )
    fireEvent.click(geToggle)
    expect(screen.getByLabelText(/MA-equivalent articulation: 25%/)).toBeTruthy()

    // Toggling off returns to the basis the dropdown still holds, and the GE
    // sub-toggle leaves with its parent.
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Include GE' })).toBeNull()
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ requirements: 'assist' }),
      expect.any(Object)
    )
  })

  it('keeps both existing minimums modes selectable for CS', () => {
    render(<CoverageHeatmap />)

    fireEvent.click(screen.getByRole('button', { name: 'MA-paper equivalent' }))
    fireEvent.click(screen.getByRole('button', { name: '4-year graduation plan (by units)' }))
    expect(screen.getByRole('option', { name: 'ASSIST minimums' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Hand-curated minimums' })).toBeTruthy()

    fireEvent.click(screen.getByRole('option', { name: 'ASSIST minimums' }))
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ requirements: 'assist' }),
      expect.any(Object)
    )
  })

  it('queries Biology by its slug and omits the unsupported paper mode', () => {
    render(<CoverageHeatmap majorSlug='bio' majorCapabilities={{ transferMinimums: false }} />)

    expect(useCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ majorSlug: 'bio', requirements: 'degree' }),
      expect.any(Object)
    )

    fireEvent.click(screen.getByRole('button', { name: 'MA-paper equivalent' }))
    fireEvent.click(screen.getByRole('button', { name: '4-year graduation plan (by units)' }))
    expect(screen.getByRole('option', { name: 'ASSIST minimums' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Hand-curated minimums' })).toBeNull()
  })

  it('fails closed for non-CS slugs and normalizes stale paper state to degree', () => {
    const { rerender } = render(<CoverageHeatmap majorSlug='cs' />)

    fireEvent.click(screen.getByRole('button', { name: 'MA-paper equivalent' }))
    fireEvent.click(screen.getByRole('button', { name: '4-year graduation plan (by units)' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hand-curated minimums' }))
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ majorSlug: 'cs', requirements: 'paper' }),
      expect.any(Object)
    )

    rerender(<CoverageHeatmap majorSlug='bio' />)

    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ majorSlug: 'bio', requirements: 'degree' }),
      expect.any(Object)
    )
    expect(screen.getByRole('button', { name: '4-year graduation plan (by units)' })).toBeTruthy()
  })
})

describe('CoverageHeatmap adaptive color scale', () => {
  it('clips isolated extremes and preserves a readable minimum span', () => {
    const values = [0, ...Array(98).fill(50), 100]
    expect(createCoverageColorScale(values)).toEqual({ min: 40, mid: 50, max: 60 })
    expect(createCoverageColorScale([100])).toEqual({ min: 80, mid: 90, max: 100 })
  })

  it('uses the same monochrome red ramp as Massachusetts Figures 3 and 4', () => {
    const scale = createCoverageColorScale([40, 45, 50])
    const low = makeCellColor(scale.min, scale)
    const high = makeCellColor(scale.max, scale)
    expect(low).toEqual(paperRedCellColor(scale.min, scale))
    expect(high).toEqual(paperRedCellColor(scale.max, scale))
    expect(low.backgroundColor).toBe('rgb(255 255 255)')
    expect(high.backgroundColor).toBe('rgb(103 0 13)')
  })

  it('renders Virginia from the committed guide baseline with its own lenses', () => {
    // No endpoint rows at all: the Virginia measure comes from the published
    // transfer guides, not the corpus this endpoint evaluates.
    useCoverage.mockReturnValue({ data: null, isLoading: false, isError: false })
    render(<CoverageHeatmap majorSlug='va-cs'
      major={{ slug: 'va-cs', state: 'va', label: 'Computer Science (VA)' }}
      majorCapabilities={{ unitCoverage: false }} />)

    // Supply basis, college scope, and the general-education lens. The last is
    // normally hidden when unitCoverage is false, which is why Virginia carries
    // its own control for it.
    expect(screen.getByRole('button', { name: 'In the catalogue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Currently scheduled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'With a CS degree' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All 23' })).toBeInTheDocument()
    // Every option is visible and the selected one is pressed, so the control
    // states which view is active rather than what a click would do.
    expect(screen.getByRole('button', { name: 'In the catalogue' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Currently scheduled' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Degree units' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Estimated courses' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'With a CS degree' })).toHaveAttribute('aria-pressed', 'true')
  })

  // The figure recomputes every cell as articulated ÷ total (cellCoverageValue)
  // and never reads the percentage field. Emitting a percentage its own counts
  // did not reproduce drew 44.2% where the data said 50.4%, and no amount of
  // reading the data could find it because the wrong number was never stored.
  // Units and courses are both counted things. A numerator of 56.25 credits is
  // not a quantity anyone can enrol in, and it was the visible symptom of the
  // numerator being a RATE applied to a total rather than a count.
  it('states every Virginia numerator and denominator as a whole number', () => {
    for (const [variant, bundle] of Object.entries(VA_COVERAGE_ROWS)) {
      if (variant === 'built_at' || variant === 'census') continue
      for (const row of bundle.rows) {
        for (const field of [
          'named_requirement_courses_with_ge_articulated', 'named_requirement_courses_with_ge_total',
          'named_requirement_courses_articulated', 'named_requirement_courses_total',
          'va_units_no_ge_articulated', 'va_units_no_ge_total',
        ]) {
          expect(Number.isInteger(row[field]), `${variant} ${row.community_college} ${field}=${row[field]}`).toBe(true)
        }
      }
    }
  })

  it('reproduces every Virginia percentage from its own numerator and denominator', () => {
    for (const [variant, bundle] of Object.entries(VA_COVERAGE_ROWS)) {
      if (variant === 'built_at' || variant === 'census') continue
      for (const row of bundle.rows) {
        for (const [p, a, t] of [
          ['pct_named_requirement_courses_with_ge',
            'named_requirement_courses_with_ge_articulated', 'named_requirement_courses_with_ge_total'],
          ['pct_named_requirement_courses',
            'named_requirement_courses_articulated', 'named_requirement_courses_total'],
          ['va_units_no_ge_pct', 'va_units_no_ge_articulated', 'va_units_no_ge_total'],
        ]) {
          // pct() rounds to one decimal, so half a step is the whole budget.
          expect(Math.abs((row[a] / row[t]) * 100 - row[p])).toBeLessThanOrEqual(0.051)
        }
      }
    }
  })

  it('switches Virginia to the explicitly estimated course-count lens', () => {
    useCoverage.mockReturnValue({ data: null, isLoading: false, isError: false })
    render(<CoverageHeatmap majorSlug='va-cs'
      major={{ slug: 'va-cs', state: 'va', label: 'Computer Science (VA)' }}
      majorCapabilities={{ unitCoverage: false }} />)
    const paper = screen.getByRole('button', { name: 'Estimated courses' })
    fireEvent.click(paper)
    expect(paper).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Degree units' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByLabelText(/Estimated course coverage:/).length).toBe(VA_COVERAGE_ROWS.catalog.rows.length)
    expect(screen.queryByLabelText(/the paper's binary counting/)).toBeNull()
  })

  it('moves the Virginia selection when another option is chosen', () => {
    useCoverage.mockReturnValue({ data: null, isLoading: false, isError: false })
    render(<CoverageHeatmap majorSlug='va-cs'
      major={{ slug: 'va-cs', state: 'va', label: 'Computer Science (VA)' }}
      majorCapabilities={{ unitCoverage: false }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Currently scheduled' }))
    expect(screen.getByRole('button', { name: 'Currently scheduled' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'In the catalogue' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps every Virginia cell at or below the degree structural ceiling', () => {
    // A Virginia degree is 120-127 units of which at most 60-67 transfer, so no
    // cell can exceed about 52%. This is the guard that caught the
    // general-education exclusion producing 61.9%.
    for (const key of ['catalog', 'scheduled', 'catalog_all', 'scheduled_all']) {
      for (const row of VA_COVERAGE_ROWS[key].rows) {
        expect(row.pct_named_requirement_courses_with_ge).toBeLessThanOrEqual(row.va_ceiling_pct + 1e-9)
        expect(row.va_ceiling_pct).toBeLessThanOrEqual(53)
        // The paper lens removes the same units from both sides, so it has its
        // own ceiling and must respect it too.
        expect(row.va_units_no_ge_pct).toBeLessThanOrEqual(row.va_ceiling_paper_pct + 1e-9)
        expect(row.va_ceiling_paper_pct).toBeLessThanOrEqual(53)
        // The MA-paper lens counts courses, not credit, but sits on the same
        // population, so the same structural ceiling binds it.
        expect(row.pct_named_requirement_courses).toBeLessThanOrEqual(row.va_ceiling_courses_pct + 1e-9)
        expect(row.va_ceiling_courses_pct).toBeLessThanOrEqual(53)
      }
    }
  })
})

// The cross-state lens. Figure 1's published statistic is a course COUNT;
// Virginia's guides and California's GE-excluded unit lens are written in
// credit. Weighting the SAME population by credit is what lets the three
// states' Figure 1 be read on one basis, so it is a weighting control beside
// the GE control rather than a different requirement basis.
describe('Figure 1 credit weighting', () => {
  const maUnitRow = {
    ...degreeRow,
    school_id: 9001,
    school: 'UMass Dartmouth',
    community_college_id: 9101,
    row_group_key: '9101',
    row_group_label: 'Cape Cod Community College',
    community_college: 'Cape Cod Community College',
    named_requirement_courses_total: 4,
    named_requirement_courses_articulated: 1,
    pct_named_requirement_courses: 25,
    named_requirement_courses_with_ge_total: 6,
    named_requirement_courses_with_ge_articulated: 3,
    pct_named_requirement_courses_with_ge: 50,
    // The same four courses are worth 14 credits, and the one that articulates
    // is worth 4 — so the credit reading is 28.6%, not 25%.
    named_requirement_units_total: 14,
    named_requirement_units_articulated: 4,
    pct_named_requirement_units: 28.6,
    named_requirement_units_with_ge_total: 21,
    named_requirement_units_with_ge_articulated: 11,
    pct_named_requirement_units_with_ge: 52.4,
    // The California unit budget is unmodelled here, exactly as the endpoint
    // returns it for Massachusetts.
    degree_units_modeled_total: 172,
    degree_units_with_equivalent: null,
    pct_degree_units: null,
  }

  beforeEach(() => {
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { n: 1, rows: [maUnitRow] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
  })

  it('weights the paper population by credit without the unit budget', () => {
    // The budget fields are null on this corpus. The credit reading must not
    // depend on them: it is the requirement rollup, not carried credit.
    expect(buildHeatmap([maUnitRow], 'ma-units').rows[0].values[0])
      .toBeCloseTo((4 / 14) * 100)
    expect(buildHeatmap([maUnitRow], 'ma-units-ge').rows[0].values[0])
      .toBeCloseTo((11 / 21) * 100)
    // Unchanged beside them.
    expect(buildHeatmap([maUnitRow], 'ma-courses').rows[0].values[0])
      .toBeCloseTo((1 / 4) * 100)
  })

  it('requests the degree response for both credit readings', () => {
    render(<CoverageHeatmap majorSlug='ma-cs'
      majorCapabilities={{ transferMinimums: false, unitCoverage: false }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Courses' }))
    fireEvent.click(screen.getByRole('option', { name: 'Units' }))
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ majorSlug: 'ma-cs', requirements: 'degree' }),
      expect.any(Object)
    )
  })

  it('offers the weighting control on a corpus the unit budget cannot model', () => {
    const onMeasureChange = vi.fn()
    render(<CoverageHeatmap majorSlug='ma-cs'
      majorCapabilities={{ transferMinimums: false, unitCoverage: false }}
      onMeasureChange={onMeasureChange} />)

    // Opens on the published reading: the course count, GE excluded.
    expect(screen.getByLabelText(/MA-equivalent articulation: 25%/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Courses' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Courses' }))
    fireEvent.click(screen.getByRole('option', { name: 'Units' }))
    expect(screen.getByLabelText(/MA-equivalent articulation: 28.6%/)).toBeTruthy()
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/credits/) })
    )

  })

  it('names the credits behind a weighted cell in its hover', () => {
    render(<CoverageHeatmap majorSlug='ma-cs'
      majorCapabilities={{ transferMinimums: false, unitCoverage: false }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Courses' }))
    fireEvent.click(screen.getByRole('option', { name: 'Units' }))
    expect(screen.getByLabelText(/4 of 14 required-course credits articulate/))
      .toBeTruthy()
  })

  it('resolves a pinned pane onto the weighting its knob recorded', () => {
    const major = { state: 'ma', capabilities: { paperBaselines: true, unitCoverage: false } }
    const pane = (knobs) => ({ major: 'ma-cs', knobs: { rows: 'college', ...knobs } })
    const cells = (knobs) => coverageComparisonCells({ rows: [maUnitRow] }, pane(knobs), major)

    // Without the knob a pane keeps the published course count.
    expect(cells({ 'ma-source': 'archive' })[0].value).toBeCloseTo((1 / 4) * 100)
    expect(cells({ 'ma-source': 'archive', 'ma-weight': 'units' })[0].value)
      .toBeCloseTo((4 / 14) * 100)
    // A saved exhibit from before the GE reading was withdrawn must not be able
    // to reopen it on this corpus: the knob no longer applies here, so the
    // stored value is ignored rather than honoured.
    expect(cells({ 'ma-source': 'archive', 'ma-weight': 'units', 'ma-include-ge': true })[0].value)
      .toBeCloseTo((4 / 14) * 100)
  })

  it('reports the weighting upward so a pinned comparison reopens on it', () => {
    const onViewChange = vi.fn()
    render(<CoverageHeatmap majorSlug='ma-cs'
      majorCapabilities={{ transferMinimums: false, unitCoverage: false }}
      onViewChange={onViewChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Courses' }))
    fireEvent.click(screen.getByRole('option', { name: 'Units' }))
    expect(onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultMaWeight: 'units' })
    )
  })
})

// One lower-division measure for all three states, read from one field set.
describe('Figure 1 lower-division lens', () => {
  const ldRow = {
    ...degreeRow,
    named_requirement_units_lower_total: 50,
    named_requirement_units_lower_articulated: 30,
    named_requirement_units_lower_ge_total: 90,
    named_requirement_units_lower_ge_articulated: 70,
  }

  beforeEach(() => {
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { n: 1, rows: [ldRow] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    })
  })

  it('reads lower-division credits with general education excluded and included', () => {
    expect(buildHeatmap([ldRow], 'ld-units').rows[0].values[0]).toBeCloseTo(60)
    expect(buildHeatmap([ldRow], 'ld-units-ge').rows[0].values[0]).toBeCloseTo((70 / 90) * 100)
  })

  it('switches to the lens, keeps the degree request, and reports the view upward', () => {
    const onViewChange = vi.fn()
    const onMeasureChange = vi.fn()
    render(<CoverageHeatmap onViewChange={onViewChange} onMeasureChange={onMeasureChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lower division' }))
    expect(screen.getByLabelText(/Lower-division coverage: 60%/)).toBeTruthy()
    expect(screen.getByLabelText(/30 of 50 lower-division requirement credits; GE excluded/)).toBeTruthy()
    // The Massachusetts lens controls describe a different population and step aside.
    expect(screen.queryByRole('button', { name: 'MA-paper equivalent' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Included' }))
    expect(screen.getByLabelText(/70 of 90 lower-division requirement credits; GE included/)).toBeTruthy()
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ majorSlug: 'cs', requirements: 'degree' }), expect.any(Object))
    expect(onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultDivision: 'lower', defaultLdIncludeGe: true }))
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/general education/) }))
  })

  it('resolves a pinned pane onto the lens in every state', () => {
    const knobs = { division: 'lower', 'ld-include-ge': true, 'ma-source': 'archive' }
    const ca = coverageComparisonCells({ rows: [ldRow] }, { major: 'cs', knobs }, { capabilities: {} })
    const ma = coverageComparisonCells({ rows: [ldRow] }, { major: 'ma-cs', knobs },
      { state: 'ma', capabilities: { paperBaselines: true, unitCoverage: false } })
    expect(ca[0].value).toBeCloseTo((70 / 90) * 100)
    expect(ma[0].value).toBeCloseTo((70 / 90) * 100)
    const va = coverageComparisonCells(null, { major: 'va-cs', knobs: { division: 'lower', 'va-basis': 'scheduled' } },
      { state: 'va', capabilities: { unitCoverage: false } })
    const first = VA_COVERAGE_ROWS.catalog.rows[0]
    expect(va.find((cell) => cell.rowKey === first.row_group_key
      && cell.colKey === `${first.school_id}|${first.major}`).value).toBeCloseTo(
      (first.named_requirement_units_lower_articulated / first.named_requirement_units_lower_total) * 100)
  })

  it('draws Virginia from its committed catalogue rows and sets its own controls aside', () => {
    useCoverage.mockReturnValue({ data: null, isLoading: false, isError: false })
    render(<CoverageHeatmap majorSlug='va-cs' defaultVaBasis='scheduled'
      major={{ slug: 'va-cs', state: 'va', label: 'Computer Science (VA)' }}
      majorCapabilities={{ unitCoverage: false }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lower division' }))
    expect(screen.queryByRole('button', { name: 'Degree units' })).toBeNull()
    // Catalogue supply only, as in the other two states, even from a scheduled view.
    expect(screen.queryByRole('button', { name: 'Currently scheduled' })).toBeNull()
    const first = VA_COVERAGE_ROWS.catalog.rows[0]
    const value = (first.named_requirement_units_lower_articulated / first.named_requirement_units_lower_total) * 100
    expect(screen.getAllByLabelText(new RegExp(`Lower-division coverage: ${Math.round(value * 10) / 10}%`)).length)
      .toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/Lower-division coverage:/).length)
      .toBe(VA_COVERAGE_ROWS.catalog.rows.length)
  })

  it('never covers more than it counts in any Virginia supply view', () => {
    for (const key of ['catalog', 'scheduled', 'catalog_all', 'scheduled_all']) {
      for (const row of VA_COVERAGE_ROWS[key].rows) {
        expect(row.named_requirement_units_lower_articulated)
          .toBeLessThanOrEqual(row.named_requirement_units_lower_total)
        expect(row.named_requirement_units_lower_ge_articulated)
          .toBeLessThanOrEqual(row.named_requirement_units_lower_ge_total)
      }
    }
  })
})
