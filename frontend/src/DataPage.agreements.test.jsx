import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// Same mocking approach as DataApiDocs.test.jsx: replace the data hooks
// DataPage.jsx imports so AgreementsBrowser/the Community Colleges and
// Universities of California hubs render without react-query / auth wiring.
// `useColleges` carries two real region/district rows (rather than an empty
// list) so the Community Colleges hub's rail has real options to pick from —
// this doesn't change the AgreementsBrowser setup; the focused detail test
// below supplies one covered college.
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
// test.jsx uses for its page-level children — since the Universities hub
// tests only care that its picker + sub-tab strip render, not that those
// panes render their own content correctly (covered elsewhere).
vi.mock('./DataReferences', () => ({
  default: () => null,
  CampusMinimums: () => null,
}))
vi.mock('./degrees/DegreeTemplateEditor', () => ({ default: () => null }))

import DataPage, { AgreementsBrowser } from './DataPage'

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

  it('shows the college search without the old legend/summary row (removed as repeat info)', () => {
    render(<AgreementsBrowser />)

    expect(screen.getByPlaceholderText(/Search .* colleges/)).toBeInTheDocument()
    expect(screen.queryByText('partial coverage')).not.toBeInTheDocument()
    expect(screen.queryByText(/colleges with agreements/)).not.toBeInTheDocument()
  })
})

describe('DataPage SubNav route chip', () => {
  it('shows the coverage route once the articulation tab is active', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Articulation' }))

    expect(screen.getByText('GET /api/assist/coverage')).toBeInTheDocument()
  })

  it('resets a college drill-in when the active Articulation tab is clicked again', () => {
    render(<DataPage />)
    const articulationTab = screen.getByRole('tab', { name: 'Articulation' })
    fireEvent.click(articulationTab)
    expect(screen.getByPlaceholderText(/Search .* colleges/)).toBeInTheDocument()

    // Drill into a college's agreement.
    const collegeName = screen.getByText('Diablo Valley College')
    fireEvent.click(collegeName.closest('[class*="cursor-pointer"]'))
    expect(screen.getByRole('button', { name: 'All colleges' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Search .* colleges/)).not.toBeInTheDocument()

    // Re-selecting Articulation (its "home" action) leaves the drill-in and
    // returns to the college list, without losing the selected campus.
    fireEvent.click(articulationTab)
    expect(screen.queryByRole('button', { name: 'All colleges' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search .* colleges/)).toBeInTheDocument()
  })

  it('uses one top route, a universal hero, and balanced degree coverage stats', async () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Articulation' }))

    const collegeName = screen.getByText('Diablo Valley College')
    fireEvent.click(collegeName.closest('[class*="cursor-pointer"]'))

    expect(await screen.findByText('School pair')).toBeInTheDocument()
    // Once, in the School pair header — the copy beside the back button was
    // removed as repeat information.
    expect(screen.getAllByText('UC Berkeley')).toHaveLength(1)
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

    fireEvent.click(screen.getByRole('tab', { name: 'Curated Transfer Minimums' }))
    const comparisonRoute = screen.getByRole('button', {
      name: /GET \/api\/curated\/requirement-comparison\?school_id=79/,
    })
    expect(comparisonRoute).toHaveTextContent(
      'GET /api/curated/requirement-comparison?school_id=79&major=Electrical%20Engineering%20%26%20Computer%20Sciences%2C%20B.S.&community_college_id=101'
    )
    expect(screen.getAllByText('API route')).toHaveLength(1)

    fireEvent.click(screen.getByRole('tab', { name: 'Graduation Requirements Coverage' }))
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

describe('Institutions tab', () => {
  it('opens on the community-college side: picker, base route, empty state', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Institutions' }))

    expect(screen.getByText('GET /api/assist/institutions?kind=community_college')).toBeInTheDocument()
    expect(screen.getByText('Community colleges · 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Diablo Valley College/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Santa Monica College/ })).toBeInTheDocument()
    expect(screen.getByText('Choose a college')).toBeInTheDocument()
  })

  it('shows the Courses / AS Degrees / Prerequisites sub-tabs once a college is picked', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Institutions' }))
    fireEvent.click(screen.getByRole('button', { name: /Diablo Valley College/ }))

    // Three tablists are on screen — the top-level SubNav, the CC/UC toggle,
    // and this pane's own sub-tab strip — so scope to the last (the sub-tab
    // strip) rather than asserting by name alone (the top-level bar also has
    // a "Prerequisites" tab).
    const tablists = screen.getAllByRole('tablist')
    const subTabs = within(tablists[tablists.length - 1])
    expect(subTabs.getByRole('tab', { name: 'Courses' })).toBeInTheDocument()
    expect(subTabs.getByRole('tab', { name: 'AS Degrees' })).toBeInTheDocument()
    expect(subTabs.getByRole('tab', { name: 'Prerequisites' })).toBeInTheDocument()
  })

  it('flips to the UC side: picker, empty state, then requirements sub-tabs (no Majors)', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Institutions' }))
    fireEvent.click(screen.getByRole('tab', { name: 'UC campuses' }))

    expect(screen.getByRole('button', { name: 'UC Berkeley' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'UC San Diego' })).toBeInTheDocument()
    expect(screen.getByText('Choose a campus')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'UC Berkeley' }))
    expect(screen.getByRole('tab', { name: 'Graduation Requirements' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Transfer Minimums' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Courses' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Majors' })).not.toBeInTheDocument()
  })
})
