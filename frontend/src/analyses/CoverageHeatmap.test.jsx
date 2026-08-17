import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoverageHeatmap, { createCoverageColorScale, makeCellColor } from './CoverageHeatmap'
import { paperRedCellColor } from './maHeatmapColors'
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

  it('defaults to live four-year graduation requirements and uses degree-specific language', () => {
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
    expect(screen.getByText('Potential graduation-unit coverage')).toBeTruthy()
    expect(screen.getByLabelText('Coverage color scale from 45% to 65%')).toBeTruthy()
    expect(screen.getByLabelText(/Potential graduation-unit coverage: 55%/)).toBeTruthy()
    expect(screen.getByLabelText(/99 of 180 modeled quarter units have a community-college equivalent/)).toBeTruthy()
    expect(screen.getByLabelText(/Secondary slot count: 16 of 40 requirements have an equivalent/)).toBeTruthy()
    // The measure panel is the single home for the definition; the figure
    // itself carries no explanatory footnote.
    expect(screen.queryByText(/Each campus is calculated in its own native quarter or semester units/)).toBeNull()
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

  it('elevates the MA-paper equivalent to its own toggle over the same degree rows', () => {
    const onMeasureChange = vi.fn()
    render(<CoverageHeatmap onMeasureChange={onMeasureChange} />)

    // The definition of the current state lives in the measure panel, which
    // the figure keeps in sync — nothing is explained in figure footnotes.
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/modeled graduation units/) })
    )

    // Not a dropdown entry: the comparison is important enough to stand alone.
    fireEvent.click(screen.getByRole('button', { name: '4-year graduation plan (by units)' }))
    expect(screen.queryByRole('option', { name: /MA-paper equivalent/ })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'ASSIST minimums' }))
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/ASSIST/) })
    )

    const toggle = screen.getByRole('button', { name: 'MA-paper equivalent' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
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

    fireEvent.click(screen.getByRole('button', { name: '4-year graduation plan (by units)' }))
    expect(screen.getByRole('option', { name: 'ASSIST minimums' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Hand-curated minimums' })).toBeNull()
  })

  it('fails closed for non-CS slugs and normalizes stale paper state to degree', () => {
    const { rerender } = render(<CoverageHeatmap majorSlug='cs' />)

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
})
