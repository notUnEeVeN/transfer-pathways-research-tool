import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// Same mocking approach as DataApiDocs.test.jsx: replace the data hooks
// DataPage.jsx imports so AgreementsBrowser/CoursesBrowser render without
// react-query / auth wiring. `useColleges` carries two real region/district
// rows (rather than an empty list) so the Courses-tab geo filter has real
// options to pick from in the geo-reset test below — this doesn't change the
// AgreementsBrowser college table, which filters every row out regardless of
// college count (no coverage rows are ever mocked in).
vi.mock('@frontend/query/hooks/useData', () => ({
  useDataSummary: () => ({
    data: {
      schools: [
        { school_id: 79, school: 'UC Berkeley', majors: ['EECS, B.S.'] },
        { school_id: 7, school: 'UC San Diego', majors: ['Computer Science, B.S.'] },
      ],
      last_data_refresh_at: '2026-07-03T00:00:00.000Z',
    },
    isLoading: false,
    isError: false,
  }),
  useColleges: () => ({
    data: [
      { id: 101, name: 'Diablo Valley College', district: 'Contra Costa CCD', region: 'North', counties_served: ['Contra Costa'] },
      { id: 202, name: 'Santa Monica College', district: 'Santa Monica CCD', region: 'South', counties_served: ['Los Angeles'] },
    ],
    isLoading: false,
  }),
  useCoverage: () => ({ data: { rows: [] }, isLoading: false }),
  useSchools: () => ({ data: { uc: [] }, isLoading: false }),
  useCcCourses: () => ({ data: [], isLoading: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
  useDegreeRequirements: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
  useDegreeRequirementDocuments: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
}))

// The minimums/template panes pull in DataReferences' CampusMinimums and the
// degree template editor, both of which need their own (unrelated) data
// hooks. Stubbed out — same "mock the whole child module" idiom App.chrome
// test.jsx uses for its page-level children — since these two tests only
// care that DataPage's SubNav route chip follows the active pane, not that
// those panes render their own content correctly (covered elsewhere).
vi.mock('./DataReferences', () => ({
  default: () => null,
  CampusMinimums: () => null,
}))
vi.mock('./degrees/DegreeTemplateEditor', () => ({ default: () => null }))

import DataPage, { AgreementsBrowser, CoursesBrowser } from './DataPage'

describe('AgreementsBrowser', () => {
  it('renders a campus chip per campus (shortened label) and switches the active one on click', () => {
    render(<AgreementsBrowser />)

    const berkeley = screen.getByRole('button', { name: 'Berkeley' })
    const sanDiego = screen.getByRole('button', { name: 'San Diego' })
    // The first campus (alphabetically) is active by default.
    expect(berkeley.className).toContain('bg-primary')
    expect(sanDiego.className).not.toContain('bg-primary')

    fireEvent.click(sanDiego)
    expect(sanDiego.className).toContain('bg-primary')
    expect(berkeley.className).not.toContain('bg-primary')
  })

  it('shows the coverage legend and a college search matching the mockup copy', () => {
    render(<AgreementsBrowser />)

    expect(screen.getByText('complete')).toBeInTheDocument()
    expect(screen.getByText('partial coverage')).toBeInTheDocument()
    expect(screen.getByText('no agreement')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search .* colleges/)).toBeInTheDocument()
  })
})

describe('DataPage SubNav route chip', () => {
  it('shows the coverage route once the agreements tab is active', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Agreements' }))

    expect(screen.getByText('GET /api/assist/coverage')).toBeInTheDocument()
  })

  it('switches to the curated routes when the minimums/template panes open, and back on tab change', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Agreements' }))
    expect(screen.getByText('GET /api/assist/coverage')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Min requirements' }))
    expect(screen.getByText('GET /api/curated/requirements?kind=transfer_minimum')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'All colleges' }))
    fireEvent.click(screen.getByRole('button', { name: 'Degree template' }))
    expect(screen.getByText('GET /api/curated/degrees')).toBeInTheDocument()

    // A stale drilled-in route must never survive a top-level tab switch —
    // Overview never reports its own, so DataPage has to reset it.
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByText('GET /api/data/summary')).toBeInTheDocument()
    expect(screen.queryByText('GET /api/curated/degrees')).not.toBeInTheDocument()
  })
})

describe('CoursesBrowser geo filter', () => {
  it('resets the region/district/county filter when the cc/uc tab flips', () => {
    render(<CoursesBrowser />)

    // Pick a specific region in the CC-only geo filter row.
    fireEvent.click(screen.getByRole('button', { name: 'All regions' }))
    fireEvent.click(screen.getByRole('option', { name: 'North' }))
    expect(screen.getByRole('button', { name: 'North' })).toBeInTheDocument()

    // Flip to UC campuses and back. `geo` now lives in CoursesBrowser itself
    // (lifted out of CcCoursesBrowser), so without an explicit reset in the
    // tab handler it would silently carry the old region forward.
    fireEvent.click(screen.getByRole('tab', { name: 'UC campuses' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Community colleges' }))

    expect(screen.getByRole('button', { name: 'All regions' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'North' })).not.toBeInTheDocument()
  })

  it('reports the bare list route, then the selected institution route, cc/uc-prefixed', () => {
    const onRoute = vi.fn()
    render(<CoursesBrowser onRoute={onRoute} />)
    expect(onRoute).toHaveBeenLastCalledWith({ path: '/api/assist/courses' })

    fireEvent.click(screen.getByRole('button', { name: /Diablo Valley College/ }))
    expect(onRoute).toHaveBeenLastCalledWith({ path: '/api/assist/courses?institution_id=cc:101' })
  })
})
