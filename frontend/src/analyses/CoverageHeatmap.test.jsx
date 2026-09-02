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

    // The California unit lenses compute garbage for this corpus, so they are
    // simply absent — the course lens is the figure, not a comparison state.
    // The GE sub-toggle is absent too: the paper's matrix carries no GE, and
    // the GE-included variant is a California extension, not a reproduction.
    expect(screen.queryByText('Requirement basis')).toBeNull()
    expect(screen.queryByRole('button', { name: 'MA-paper equivalent' })).toBeNull()
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
    expect(screen.getByRole('button', { name: 'MA paper' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'With a CS degree' })).toHaveAttribute('aria-pressed', 'true')
  })

  // The figure recomputes every cell as articulated ÷ total (cellCoverageValue)
  // and never reads the percentage field. Emitting a percentage its own counts
  // did not reproduce drew 44.2% where the data said 50.4%, and no amount of
  // reading the data could find it because the wrong number was never stored.
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

  it('switches Virginia to the paper\'s own course counting on the MA paper preset', () => {
    useCoverage.mockReturnValue({ data: null, isLoading: false, isError: false })
    render(<CoverageHeatmap majorSlug='va-cs'
      major={{ slug: 'va-cs', state: 'va', label: 'Computer Science (VA)' }}
      majorCapabilities={{ unitCoverage: false }} />)
    const paper = screen.getByRole('button', { name: 'MA paper' })
    fireEvent.click(paper)
    expect(paper).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Degree units' })).toHaveAttribute('aria-pressed', 'false')
    // The preset is the same guides read the paper's way, not a different
    // corpus: binary counting and the GE exclusion together move it a few
    // points, and a bigger gap than that has always meant a conversion bug.
    const rows = VA_COVERAGE_ROWS.catalog.rows
    const mean = (f) => rows.reduce((n, r) => n + r[f], 0) / rows.length
    const gap = mean('pct_named_requirement_courses_with_ge') - mean('pct_named_requirement_courses')
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThan(10)
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
