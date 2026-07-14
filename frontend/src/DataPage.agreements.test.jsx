import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// Same mocking approach as DataApiDocs.test.jsx: replace the data hooks
// DataPage.jsx imports so AgreementsBrowser/CoursesBrowser render without
// react-query / auth wiring. `useColleges` carries two real region/district
// rows (rather than an empty list) so the Courses-tab geo filter has real
// options to pick from in the geo-reset test below — this doesn't change the
// AgreementsBrowser setup; the focused detail test below supplies one covered
// college while the geo tests continue to exercise two distinct locations.
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
  useCoverage: (options = {}) => ({
    data: { rows: options.requirements === 'paper' ? [
      {
        school_id: 79, community_college_id: 101,
        pct_articulated: 100, fully_articulated: true,
      },
    ] : [
      {
        school_id: 79, community_college_id: 101,
        major: 'Electrical Engineering & Computer Sciences, B.S.',
        pct_articulated: 100, fully_articulated: true,
      },
    ] },
    isLoading: false,
  }),
  useAgreementsBatch: () => ({
    data: [{
      school_id: 79,
      agreements: [{
        _id: 'agreement-1', major: 'Electrical Engineering & Computer Sciences, B.S.',
      }],
    }],
    isLoading: false,
  }),
  useRawAssist: () => ({ data: { source: 'ASSIST' }, isLoading: false, isError: false }),
  useRequirementComparison: () => ({
    data: {
      website_requirements: [], assist_extra_groups: [],
      website: { pct: 100, articulated: 4, required: 4, fully: true },
      assist: { pct: 100, articulated: 9, required: 9, fully: true },
      net_courses: 5,
    },
    isLoading: false,
    isError: false,
  }),
  useDegreeEvaluation: () => ({
    data: {
      completion: {
        pct: 47, covered: 14, total: 30,
        by_tier: {
          transferable: { covered: 10, total: 14 },
          breadth: { covered: 4, total: 4 },
          nontransferable: { covered: 0, total: 12 },
        },
      },
      requirement_groups: [], courses: [], university_courses_by_id: {},
    },
    isLoading: false,
    isError: false,
  }),
  useSchools: () => ({ data: { uc: [] }, isLoading: false }),
  useCcCourses: () => ({ data: [], isLoading: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
  useDegreeRequirements: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
  useDegreeRequirementDocuments: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
  useSaveDegreeRequirement: () => ({ mutateAsync: async () => ({}), isPending: false }),
}))

vi.mock('@frontend/query/hooks/useAudit', () => ({
  useAuditDoc: () => ({
    data: {
      doc: {
        _id: 'agreement-1', community_college: 'Diablo Valley College',
        uc_school: 'UC Berkeley', major: 'Electrical Engineering & Computer Sciences, B.S.',
        requirement_groups: [], course_names: [],
      },
      assist_url: 'https://assist.org/agreement-1',
      university_courses: [],
    },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('./pages/Audit/hooks/useCourseList', () => ({ useCourseList: () => [] }))

// CampusDegreeTemplate stamps verification notes with the signed-in user —
// stub the auth hook so the pane renders without the AuthProvider.
vi.mock('@frontend/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }))

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

    fireEvent.click(screen.getByRole('button', { name: 'Transfer requirements' }))
    expect(screen.getByText('GET /api/curated/requirements?kind=transfer_minimum')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'All colleges' }))
    fireEvent.click(screen.getByRole('button', { name: 'Graduation requirements' }))
    expect(screen.getByText('GET /api/curated/degrees')).toBeInTheDocument()

    // A stale drilled-in route must never survive a top-level tab switch —
    // Overview never reports its own, so DataPage has to reset it.
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByText('GET /api/data/summary')).toBeInTheDocument()
    expect(screen.queryByText('GET /api/curated/degrees')).not.toBeInTheDocument()
  })

  it('returns to the base agreements page when the active Agreements tab is clicked again', () => {
    render(<DataPage />)
    const agreementsTab = screen.getByRole('tab', { name: 'Agreements' })
    fireEvent.click(agreementsTab)

    fireEvent.click(screen.getByRole('button', { name: 'Transfer requirements' }))
    expect(screen.getByText('GET /api/curated/requirements?kind=transfer_minimum')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All colleges' })).toBeInTheDocument()

    fireEvent.click(agreementsTab)
    expect(screen.getByText('GET /api/assist/coverage')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All colleges' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Transfer requirements' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Graduation requirements' }))
    expect(screen.getByText('GET /api/curated/degrees')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All colleges' })).toBeInTheDocument()

    fireEvent.click(agreementsTab)
    expect(screen.getByText('GET /api/assist/coverage')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All colleges' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Graduation requirements' })).toBeInTheDocument()
  })

  it('uses one top route, a universal hero, and balanced degree coverage stats', async () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Agreements' }))

    const collegeName = screen.getByText('Diablo Valley College')
    fireEvent.click(collegeName.closest('[class*="cursor-pointer"]'))

    expect(await screen.findByText('School pair')).toBeInTheDocument()
    expect(screen.getAllByText('UC Berkeley')).toHaveLength(2)
    expect(screen.getByText('Electrical Engineering & Computer Sciences, B.S.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open ASSIST' })).toBeInTheDocument()
    expect(screen.queryByText('Last verified')).not.toBeInTheDocument()
    expect(screen.queryByText('ASSIST agreement')).not.toBeInTheDocument()
    expect(screen.getAllByText('API route')).toHaveLength(1)
    await waitFor(() => expect(screen.getByRole('button', {
      name: 'GET /api/audit/doc/agreement-1?system=uc',
    })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Raw ASSIST API' }))
    expect(screen.getByRole('button', { name: 'GET /api/data/raw-assist/agreement-1' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Min comparison' }))
    const comparisonRoute = screen.getByRole('button', {
      name: /GET \/api\/curated\/requirement-comparison\?school_id=79/,
    })
    expect(comparisonRoute).toHaveTextContent(
      'GET /api/curated/requirement-comparison?school_id=79&major=Electrical%20Engineering%20%26%20Computer%20Sciences%2C%20B.S.&community_college_id=101'
    )
    expect(screen.getAllByText('API route')).toHaveLength(1)

    fireEvent.click(screen.getByRole('tab', { name: 'Degree coverage' }))
    expect(screen.getByRole('button', {
      name: 'GET /api/curated/degree-evaluation?school_id=79&community_college_id=101',
    })).toBeInTheDocument()

    const summary = screen.getByRole('region', { name: 'Degree coverage summary' })
    expect(within(summary).getByText('14 of 30 graduation requirements')).toBeInTheDocument()
    expect(within(summary).getByText('4 remaining')).toBeInTheDocument()
    expect(within(summary).getByText('Fully transferable')).toBeInTheDocument()
    expect(within(summary).getByText('University-only requirements')).toBeInTheDocument()
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
