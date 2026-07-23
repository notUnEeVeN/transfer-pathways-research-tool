import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MultiCampusPathways, {
  MultiCampusPathwaysPreview,
  buildPortfolioFigureModel,
} from './MultiCampusPathways'

function stats(n, mean, q1, q3, min, max) {
  return { n, mean, median: mean, q1, q3, min, max }
}

const fixture = {
  schema_version: 1,
  generated_at: '2026-07-22T18:29:40.351Z',
  summary: {
    districts_total: 72,
    scenarios_total: 140,
    usable_scenarios: 133,
    exact_scenarios: 91,
    bounded_scenarios: 42,
    unavailable_scenarios: 7,
    maximum_portfolio_size: 7,
    maximum_portfolio_districts: 13,
  },
  fixed_high_access_cohort: {
    district_count: 13,
    reachable_count: 7,
    complete_balanced_portfolio_grid: true,
    common_program_codes: ['UCB', 'UCD', 'UCI', 'UCM', 'UCR', 'UCSB', 'UCSC'],
  },
  rows: Array.from({ length: 7 }, (_, index) => {
    const portfolioSize = index + 1
    const courseMean = 7 + portfolioSize * 1.5
    return {
      portfolio_size: portfolioSize,
      scenario_count: 30 - index,
      eligible_district_count: 20 - index,
      represented_district_count: 20 - index - (portfolioSize === 2 ? 1 : 0),
      usable_scenario_count: 28 - index,
      exact_scenario_count: 20 - index,
      bounded_scenario_count: 8,
      unavailable_scenario_count: 2 - Math.min(index, 2),
      exact_share_pct: 70 - index * 5,
      district_equal: {
        distinct_courses: stats(20 - index, courseMean, courseMean - 1, courseMean + 1,
          courseMean - 2, courseMean + 2),
        academic_years: stats(20 - index, 1.5 + index * 0.2, 1.4, 2.5, 1, 3),
      },
      path_weighted: {
        distinct_courses: stats(28 - index, courseMean + 0.2, courseMean - 1,
          courseMean + 1, courseMean - 2, courseMean + 2),
      },
      exact_only_district_equal: {
        distinct_courses: stats(20 - index, courseMean - 0.4, courseMean - 1,
          courseMean + 1, courseMean - 2, courseMean + 2),
      },
      fixed_high_access_cohort: {
        distinct_courses: stats(13, courseMean + 0.5, courseMean, courseMean + 1,
          courseMean - 1, courseMean + 2),
      },
      overlap_savings_courses: stats(28 - index, index * 5, 0, index * 6, 0, index * 8),
    }
  }),
}

describe('MultiCampusPathways', () => {
  it('builds a one-through-seven district-equal model with semester-equivalent terms', () => {
    const model = buildPortfolioFigureModel(fixture)

    expect(model.rows).toHaveLength(7)
    expect(model.rows[0]).toMatchObject({
      portfolioSize: 1,
      eligibleDistrictCount: 20,
      representedDistrictCount: 20,
      courses: { mean: 8.5 },
      semesterEquivalentTerms: 3,
      fixedCohortCourseMean: 9,
      pathWeightedCourseMean: 8.7,
    })
    expect(model.rows[1]).toMatchObject({
      portfolioSize: 2,
      eligibleDistrictCount: 19,
      representedDistrictCount: 18,
    })
    expect(model.last.portfolioSize).toBe(7)
    expect(model.fixedCohortDistrictCount).toBe(13)
    expect(model.pathWeightingMaxDifference).toBeCloseTo(0.2)
    expect(model.fixedCohortMaxDifference).toBeCloseTo(0.5)
  })

  it('renders a static, exportable research figure with visible denominators and quality', () => {
    const { container } = render(<MultiCampusPathways data={fixture} />)
    const figure = container.querySelector('svg[data-portfolio-figure]')

    expect(figure).toBeTruthy()
    expect(figure).toHaveAttribute('data-export-width', '1120')
    expect(within(figure).getByText('How much preparation keeps more UC CS options open?'))
      .toBeInTheDocument()
    expect(figure).toHaveTextContent('8.5 → 17.5 courses')
    expect(figure).toHaveTextContent('20 districts · 30 plans')
    expect(figure).toHaveTextContent('19 eligible districts · 29 plans')
    expect(figure).toHaveTextContent('18 represented · 65% proven')
    expect(figure).toHaveTextContent('UCB, UCD, UCI, UCM, UCR, UCSB, UCSC')
    expect(figure).toHaveTextContent('91 of 140 plans are proven minima')
    expect(container.querySelectorAll('[data-portfolio-row]')).toHaveLength(7)

    const table = screen.getByRole('table', { name: 'Modeled UC portfolio preparation data', hidden: true })
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(8)
  })

  it('renders the completed artifact instead of the obsolete exact-reach result', () => {
    const { container } = render(<MultiCampusPathways />)
    const figure = container.querySelector('svg[data-portfolio-figure]')

    expect(figure).toHaveTextContent('8.8 → 17.7 courses')
    expect(figure).toHaveTextContent('68 districts · 335 plans')
    expect(figure).toHaveTextContent('67 eligible districts · 741 plans')
    expect(figure).toHaveTextContent('66 represented · 72% proven')
    expect(figure).toHaveTextContent('13 districts · 13 plans')
    expect(figure).toHaveTextContent('31% proven')
    expect(figure).toHaveTextContent('5.4terms')
    expect(figure).toHaveTextContent('1,970 of 3,266 plans are proven minima')
    expect(figure).not.toHaveTextContent('20.2')
  })

  it('uses the completed one-through-seven result in the gallery thumbnail', () => {
    const { container } = render(<MultiCampusPathwaysPreview />)
    const preview = container.querySelector('svg')

    expect(preview).toHaveTextContent('Keeping more UC options open')
    expect(preview).toHaveTextContent('1 UC')
    expect(preview).toHaveTextContent('7 UCs')
    expect(preview).toHaveTextContent('8.8')
    expect(preview).toHaveTextContent('17.7')
    expect(preview).not.toHaveTextContent('20.2')
  })

  it('fails closed when the compact artifact is incomplete', () => {
    render(<MultiCampusPathways data={{ rows: [] }} />)
    expect(screen.getByRole('heading', { name: 'Portfolio analysis unavailable' }))
      .toBeInTheDocument()
  })
})
