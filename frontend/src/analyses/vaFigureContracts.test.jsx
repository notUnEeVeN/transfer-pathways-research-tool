import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoverageHeatmap from './CoverageHeatmap'
import TransferCreditRate from './TransferCreditRate'
import TransferExtraUnits from './TransferExtraUnits'
import { VA_COVERAGE_ROWS } from './vaCoverageRows'
import { VA_CREDIT_RATE_ROWS } from './vaCreditRateRows'
import { getAnalysisById } from './registry'
import { useCoverage, useTransferCreditRate } from '../shared/query/hooks/useData'
import { assessComparability } from '../compare/comparability'
import { knobsFor, viewPropsFor } from '../compare/viewKnobs'

vi.mock('../shared/query/hooks/useData', () => ({
  useCoverage: vi.fn(), useTransferCreditRate: vi.fn(), usePathwayComplexity: vi.fn(),
}))

const VA = { slug: 'va-cs', state: 'va', degreeAnalysisSlots: ['local_as'], capabilities: { unitCoverage: false } }
const CA = { slug: 'cs', degreeAnalysisSlots: ['ast'], capabilities: {} }
const pane = (figure, knobs = {}, major = 'va-cs') => ({ id: major, figure, major, knobs })
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n)

beforeEach(() => {
  const liveFailure = { data: { rows: [{ wrong: 'live API uses a different model' }] }, isLoading: true, isError: true }
  useCoverage.mockReturnValue(liveFailure)
  useTransferCreditRate.mockReturnValue(liveFailure)
})

describe('Virginia gallery and Comparison source contracts', () => {
  it('uses every selected Figure 1 frozen numerator and denominator despite a failed live query', () => {
    const analysis = getAnalysisById('coverage-heatmap')
    for (const basis of ['catalog', 'scheduled']) for (const all of [false, true]) {
      const raw = VA_COVERAGE_ROWS[`${basis}${all ? '_all' : ''}`].rows
      for (const measure of ['units_ge', 'units', 'paper']) {
        const view = pane(analysis.id, { 'va-basis': basis, 'va-all-colleges': all, 'va-measure': measure })
        const query = analysis.comparable.useData(view, VA, { enabled: true })
        expect(query.isLoading).toBe(false)
        expect(query.isError).toBe(false)
        expect(useCoverage).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'college' }), { enabled: false })
        const cells = analysis.comparable.cells(query.data, view, VA)
        const [numerator, denominator] = measure === 'units_ge'
          ? ['named_requirement_courses_with_ge_articulated', 'named_requirement_courses_with_ge_total']
          : measure === 'units' ? ['va_units_no_ge_articulated', 'va_units_no_ge_total']
            : ['named_requirement_courses_articulated', 'named_requirement_courses_total']
        expect(cells).toHaveLength(raw.length)
        for (const row of raw) {
          const cell = cells.find((c) => c.rowKey === String(row.row_group_key || row.community_college_id)
            && c.colKey === `${row.school_id}|${row.major}`)
          expect(cell.value).toBeCloseTo(row[numerator] / row[denominator] * 100, 10)
        }
      }
    }
  })

  it.each(['transfer-credit-rate', 'transfer-extra-units'])('%s compares the selected frozen guide cohort', (figure) => {
    const analysis = getAnalysisById(figure)
    const view = pane(figure, { 'va-basis': 'scheduled', 'va-all-colleges': true })
    const raw = VA_CREDIT_RATE_ROWS.scheduled_all.rows
    const query = analysis.comparable.useData(view, VA, { enabled: true })
    expect(query.data.rows).toBe(raw)
    expect(query.isLoading).toBe(false)
    expect(query.isError).toBe(false)
    expect(useTransferCreditRate).toHaveBeenLastCalledWith('local_as', expect.objectContaining({ enabled: false }))
    const cells = analysis.comparable.cells(query.data, view, VA)
    expect(cells).toHaveLength(raw.length)
    for (const row of raw) {
      const cell = cells.find((c) => c.rowLabel === row.college_name && c.colLabel === row.school)
      expect(cell.value).toBe(figure === 'transfer-extra-units'
        ? row.modeled_hours_above_120 : row.paper_equivalent_as_unit_utilization_pct)
    }
  })

  it.each([
    ['coverage-heatmap', CoverageHeatmap],
    ['transfer-credit-rate', TransferCreditRate],
    ['transfer-extra-units', TransferExtraUnits],
  ])('%s restores and reports supply/cohort selections', (figure, Component) => {
    const analysis = getAnalysisById(figure)
    const view = pane(figure, { 'va-basis': 'scheduled', 'va-all-colleges': true, 'va-measure': 'units' })
    const onViewChange = vi.fn()
    const props = viewPropsFor(view, analysis, VA)
    render(<Component {...props} majorSlug='va-cs' major={VA} majorCapabilities={VA.capabilities}
      degreeAnalysisSlots={VA.degreeAnalysisSlots} onViewChange={onViewChange} />)
    expect(screen.getByRole('button', { name: 'Currently scheduled' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All 23' })).toHaveAttribute('aria-pressed', 'true')
    expect(onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ defaultVaBasis: 'scheduled', defaultVaAllColleges: true }))
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
    expect(screen.queryByText('Live endpoint')).toBeNull()
    if (figure === 'coverage-heatmap') {
      expect(screen.getByRole('button', { name: 'Units, no GE' })).toHaveAttribute('aria-pressed', 'true')
      const r = VA_COVERAGE_ROWS.scheduled_all.rows[0]
      const title = screen.getAllByLabelText(/Guide credit coverage:/)
        .find((el) => el.getAttribute('aria-label').startsWith(r.community_college + '\n' + r.school + '\n'))
      expect(title).toHaveTextContent(`${fmt(r.va_units_no_ge_articulated / r.va_units_no_ge_total * 100)}%`)
      fireEvent.click(screen.getByRole('button', { name: 'Estimated courses' }))
      expect(onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ defaultVaMeasure: 'paper' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'In the catalogue' }))
    expect(onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ defaultVaBasis: 'catalog' }))
  })

  it.each(['coverage-heatmap', 'transfer-credit-rate', 'transfer-extra-units'])('refuses misleading cross-state %s equivalence', (figure) => {
    const result = assessComparability([pane(figure), pane(figure, {}, 'cs')],
      new Map([['va-cs', VA], ['cs', CA]]), getAnalysisById)
    expect(result.join).toBe('refused')
    expect(result.warnings.some((w) => w.code === 'measure_contract_mismatch')).toBe(true)
  })

  it('declares the credit-weighted named-requirement lens separately from transfer minimums', () => {
    const analysis = getAnalysisById('coverage-heatmap')
    const contract = analysis.comparisonContract(pane(analysis.id, { basis: 'degree-no-ge', 'ma-equivalent': false }, 'cs'), CA)
    expect(contract.measure).toBe('named-requirement-unit-coverage')
    expect(contract.semantics.scope).toBe('whole degree')
    expect(knobsFor(analysis, VA).map((k) => k.key))
      .toEqual(['va-basis', 'va-all-colleges', 'va-measure', 'division', 'ld-include-ge'])
  })
})
