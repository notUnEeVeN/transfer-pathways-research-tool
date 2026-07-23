import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaperCourseBarriers, {
  PaperCourseBarriersPreview, buildCourseBarriersModel,
} from './PaperCourseBarriers'
import {
  CAMPUSES, buildPaperCourseBarriersModel, categoryOfGroupId,
} from './paperCourseBarriersBaseline'
import { DISTRICTS } from './paperDistrictBaseline'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

// The curated transfer minimums as stored: campus -> requirement group ids.
const GROUPS_BY_CAMPUS = {
  89: ['Calc1', 'Calc2', 'Calc3', 'Intro1', 'Intro2', 'DataStructures', 'DiscreteMath', 'Organization'],
  144: ['Calc1', 'Calc2', 'VectorCalc', 'LinearAlgebra', 'Intro', 'DataStructures'],
  7: ['Calc1', 'Calc2', 'Calc3', 'LinearAlgebra', 'Intro', 'DataStructures', 'DiscreteMath'],
  128: ['Calc1', 'Calc2', 'LinearAlgebra', 'DifferentialEquations', 'Intro', 'DataStructures', 'DiscreteMath'],
  117: ['Calc1', 'Calc2', 'Calc3', 'Calc4', 'LinearAlgebra', 'DifferentialEquations', 'Intro'],
  79: ['Calc1', 'Calc2', 'MultivariableCalc', 'LinearAlgebraAndDifferentialEqations'],
  132: ['Calc1', 'Calc2', 'Intro', 'Organization', 'DiscreteMath'],
  120: ['Calc1', 'Calc2', 'Intro', 'Programming'],
  46: ['Calc', 'Intro1', 'Intro2'],
}

// Davis (UC1*) misses intro programming in the first 18 districts and data
// structures in the first 36; nothing else is unsatisfied anywhere.
function currentRows() {
  return CAMPUSES.flatMap((campus) => DISTRICTS.map((district) => ({
    school_id: campus.schoolId,
    school: campus.campus,
    row_group_label: district.name,
    requirement_groups: GROUPS_BY_CAMPUS[campus.schoolId].map((groupId) => ({
      group_id: groupId,
      satisfied: !(campus.schoolId === 89
        && ((groupId === 'Intro1' && district.index < 18)
          || (groupId === 'DataStructures' && district.index < 36))),
    })),
  })))
}

describe('paper course barriers', () => {
  const refetch = vi.fn()

  beforeEach(() => {
    refetch.mockReset()
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: currentRows() },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    })
  })

  it('maps curated group ids onto the paper course categories', () => {
    expect(categoryOfGroupId('MultivariableCalc').key).toBe('calculus')
    expect(categoryOfGroupId('Intro2').key).toBe('intro-programming')
    expect(categoryOfGroupId('Programming').key).toBe('intro-programming')
    expect(categoryOfGroupId('DataStructures').key).toBe('data-structures')
    expect(categoryOfGroupId('LinearAlgebraAndDifferentialEqations').key).toBe('advanced-math')
    expect(categoryOfGroupId('Organization').key).toBe('computer-organization')
    expect(categoryOfGroupId('DiscreteMath').key).toBe('discrete-math')
    expect(categoryOfGroupId('Ethics')).toBeNull()
  })

  it('holds the transcribed Figure 5 baseline', () => {
    const model = buildPaperCourseBarriersModel()
    const dataStructures = model.categories.find((category) => category.key === 'data-structures')

    expect(model.districtCount).toBe(72)
    expect(dataStructures.campuses.map((campus) => campus.pct))
      .toEqual([52.8, 9.7, 40.3, 27.8, null, null, null, null, null])
    expect(dataStructures.campuses[0].missing).toBe(38)
    expect(model.categories.find((category) => category.key === 'calculus')
      .campuses.every((campus) => campus.required)).toBe(true)
  })

  it('recomputes each course panel from current district coverage', () => {
    const model = buildCourseBarriersModel(currentRows())
    const byKey = Object.fromEntries(model.categories.map((category) => [category.key, category]))

    expect(model.districtCount).toBe(72)
    expect(byKey.calculus.campuses.every((campus) => campus.required && campus.pct === 0)).toBe(true)
    expect(byKey['intro-programming'].campuses[0].pct).toBe(25)
    expect(byKey['intro-programming'].campuses[5].required).toBe(false)
    expect(byKey['data-structures'].campuses[0].pct).toBe(50)
    expect(byKey['data-structures'].campuses.slice(4).every((campus) => !campus.required)).toBe(true)
    expect(byKey['computer-organization'].campuses.map((campus) => campus.required))
      .toEqual([true, false, false, false, false, false, true, false, false])
  })

  it('renders the six paper panels with paper, current and difference states', () => {
    const { container } = render(<PaperCourseBarriers />)

    expect(container.querySelectorAll('[data-panel]')).toHaveLength(6)
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(54)
    expect(container.querySelectorAll('[data-bar-state="not-required"]')).toHaveLength(22)
    expect(screen.getByRole('img', { name: /Data Structures at UC1\*, UC Davis\. 50\.0% of districts missing/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(screen.getByRole('img', { name: /Data Structures at UC1\*, UC Davis\. 52\.8% of districts missing/i })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Show differences' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Current data' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Show differences' }))
    expect(screen.getByText('Fewer districts missing')).toBeTruthy()
    expect(container.querySelectorAll('[data-difference="decrease"]').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: /Calculus at UC1\*, UC Davis.*paper baseline 5\.6%; change −5\.6 points/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(useCoverage).toHaveBeenCalledWith(
      {
        majorSlug: 'cs',
        groupBy: 'district',
        requirements: 'paper',
        pin: 'paper',
      },
      expect.objectContaining({ refetchOnWindowFocus: false, refetchInterval: false })
    )
  })

  it('uses the publication skin only for current-data states', () => {
    const { container } = render(<PaperCourseBarriers />)
    const modern = container.querySelector('[data-modern-california-figure="articulation-gaps"]')

    expect(modern).toBeTruthy()
    expect(modern.getAttribute('viewBox')).toBe('0 0 1240 804')
    expect(modern.style.fontFamily).toContain('Hanken Grotesk')
    expect(modern.querySelector('path[fill="#E69F00"]')).toBeTruthy()
    expect(modern.querySelector('path[fill="#009E73"]')).toBeTruthy()
    expect(modern.querySelectorAll('[data-modern-panel-border]')).toHaveLength(6)
    expect(modern.querySelector('[data-modern-panel-border]')?.getAttribute('stroke-opacity')).toBe('0.45')
    expect(screen.getAllByText('% of CC districts').every((label) => label.getAttribute('x') === '42'))
      .toBe(true)
    expect(screen.getByText('quarter-system campus · unmarked = semester')).toBeTruthy()
    expect([...modern.querySelectorAll('text')].map((node) => node.textContent))
      .not.toContain('Districts missing course articulation')

    const tallBar = modern.querySelector('[data-bar="data-structures|UC1*"]')
    expect(Number(tallBar.dataset.modernValueLabelY))
      .toBeLessThan(Number(tallBar.dataset.modernBarTop))

    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(container.querySelector('[data-modern-california-figure]')).toBeNull()
    expect(container.querySelector('svg[data-export-width="1080"]')).toBeTruthy()
  })

  it('exports a figure-only current-data preview', () => {
    const { container } = render(<PaperCourseBarriersPreview />)

    expect(container.querySelector('[data-modern-california-figure="articulation-gaps"]')).toBeTruthy()
    expect(container.querySelector('[data-export-exclude]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Paper baseline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh data' })).not.toBeInTheDocument()
  })
})
