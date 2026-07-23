import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// Same mocking approach as DataApiDocs.test.jsx: replace the data hooks
// DataPage.jsx imports so AgreementsBrowser/the Community Colleges and
// Universities of California hubs render without react-query / auth wiring.
// `useColleges` carries two real region/district rows (rather than an empty
// list) so the Community Colleges hub's rail has real options to pick from —
// this doesn't change the AgreementsBrowser setup; the focused detail test
// below supplies one covered college.
// Wrapped in vi.fn() (rather than a static factory return) so the
// slots-always-render tests below can swap in a different `degrees` list per
// case, same "mock<Name>" hoisting convention MajorPicker.test.jsx uses.
const mockAsDegreeDetail = vi.fn(() => ({
  data: {
    degrees: [
      { degree_type: 'ast', courses_by_id: {}, doc: { _id: 'd-ast', degree_type: 'ast', requirement_groups: [] } },
      { degree_type: 'local_as', courses_by_id: {}, doc: { _id: 'd-local', degree_type: 'local_as', requirement_groups: [] } },
    ],
  },
  isLoading: false,
  isError: false,
}))
vi.mock('@frontend/query/hooks/useData', () => ({
  // The college pane mounts AsDegreeReview, which reads these two. Two records
  // so the section's degree-type tabs have something to switch between.
  useAsDegreeDetail: (...args) => mockAsDegreeDetail(...args),
  useSaveAsDegree: () => ({ mutateAsync: async () => ({}), isPending: false }),
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
      { id: 4, name: 'College of Marin', district: 'Marin CCD', region: 'North', counties_served: ['Marin'] },
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
      {
        school_id: 79, community_college_id: 202,
        pct_articulated: 75, fully_articulated: false,
      },
    ] : [
      {
        school_id: 79, community_college_id: 101,
        major: 'Electrical Engineering & Computer Sciences, B.S.',
        pct_articulated: 100, fully_articulated: true,
      },
      {
        school_id: 79, community_college_id: 202,
        major: 'Electrical Engineering & Computer Sciences, B.S.',
        pct_articulated: 80, fully_articulated: false,
      },
    ] },
    isLoading: false,
  }),
  useAgreementsBatch: (collegeId, campusId) => ({
    data: [{
      school_id: Number(campusId),
      agreements: Number(collegeId) === 101 && Number(campusId) === 79 ? [
        { _id: 'agreement-extra', major: 'Computer Science, B.A.' },
        { _id: 'agreement-1', major: 'Electrical Engineering & Computer Sciences, B.S.' },
      ] : [],
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
  useAsDegreeAvailability: () => ({
    data: {
      counts: {
        total_colleges: 115,
        ast: { available: 69, confirmed_none: 43, data_gap: 3 },
        local_as: { available: 10 },
        local_other: { available: 20, duplicate_candidate: 2 },
      },
      rows: [
        {
          college_id: 'cc:4', community_college_id: 4, college_name: 'College of Marin',
          types: {
            ast: { status: 'confirmed_none', record_id: null },
            local_as: { status: 'available', record_id: 'as_degree:4:local_as', degree_title_seen: 'A.S. in Computer Science', catalog_year: '2024-2025' },
            local_other: { status: 'duplicate_candidate', record_id: 'as_degree:4:local_other', degree_title_seen: 'A.S. in Computer Science', catalog_year: '2024-2025' },
          },
        },
        {
          college_id: 'cc:101', community_college_id: 101, college_name: 'Diablo Valley College',
          types: {
            ast: { status: 'available', record_id: 'as_degree:101:ast', degree_title_seen: 'Computer Science A.S.-T', catalog_year: '2025-2026' },
            local_as: { status: 'available', record_id: 'as_degree:101:local_as', degree_title_seen: 'Computer Science A.S.', catalog_year: '2025-2026' },
            local_other: { status: 'data_gap', record_id: null },
          },
        },
        {
          college_id: 'cc:202', community_college_id: 202, college_name: 'Santa Monica College',
          types: {
            ast: { status: 'confirmed_none', record_id: null },
            local_as: { status: 'confirmed_none', record_id: null },
            local_other: { status: 'confirmed_none', record_id: null },
          },
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useAsDegrees: () => ({ data: { n: 0, rows: [] }, isLoading: false, isError: false }),
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
  DataTable: () => null,
}))
vi.mock('./degrees/DegreeTemplateEditor', () => ({ default: () => null }))
// The college pane renders the real AsDegreeReview (its hooks are mocked
// above); it pulls DegreePanel from this module, so the stub must export it.
vi.mock('./asdegrees/AsDegreeSchoolView', () => ({
  default: () => null,
  DegreePanel: ({ degree }) => <div>Associate degree detail {degree?.doc?.degree_type}</div>,
}))
vi.mock('./prereqs/ConceptGraphView', () => ({ default: () => null }))

// The associate-degree section's `major` prop comes from useMajorChoice,
// which only differs from the CS fallback inside a MajorProvider. Mocking the
// underlying useMajors (same pattern as MajorPicker.test.jsx) lets
// renderCollegePane hand the pane a non-CS major without a real /api/majors
// round trip; every other test in this file never wraps DataPage in a
// provider, so it keeps seeing the CS_FALLBACK default untouched.
const mockMajors = vi.fn()
vi.mock('./shared/majors/useMajors', async (importOriginal) => ({
  ...(await importOriginal()),
  useMajors: (...a) => mockMajors(...a),
}))

import DataPage, { AgreementsBrowser } from './DataPage'
import { MajorProvider } from './shared/majors/MajorContext'
import { CS_FALLBACK } from './shared/majors/useMajors'

// Renders the Community Colleges pane, drills into one college, and opens its
// Associate degrees tab — the setup every degree-section test below shares.
// `degrees` overrides the AsDegreeReview detail fixture (e.g. to an empty
// list); `major` overrides the chosen major (default: the CS fallback), each
// wrapped as the sole onboarded major so useMajorChoice resolves to it without
// a picker interaction.
function renderCollegePane({ degrees = null, major = null, collegeName = 'Diablo Valley College' } = {}) {
  if (degrees) {
    mockAsDegreeDetail.mockReturnValue({ data: { degrees }, isLoading: false, isError: false })
  }
  const chosen = major || CS_FALLBACK[0]
  mockMajors.mockReturnValue({
    majors: [chosen],
    defaultSlug: chosen.slug,
    bySlug: new Map([[chosen.slug, chosen]]),
    isLoading: false,
  })
  render(<MajorProvider><DataPage /></MajorProvider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
  fireEvent.click(screen.getByText(collegeName).closest('[class*="cursor-pointer"]'))
  fireEvent.click(screen.getByRole('tab', { name: 'Associate degrees' }))
}

describe('AgreementsBrowser', () => {
  it('puts receiving-campus bubbles inside a college articulation tab and preserves the college on switch', async () => {
    const onRoute = vi.fn()
    render(<AgreementsBrowser onRoute={onRoute} />)

    expect(screen.queryByText('Receiving campus')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Diablo Valley College').closest('[class*="cursor-pointer"]'))

    expect(await screen.findByText('Receiving campus')).toBeInTheDocument()
    const berkeley = screen.getByRole('button', { name: 'Berkeley' })
    const sanDiego = screen.getByRole('button', { name: 'San Diego' })
    expect(berkeley).toHaveAttribute('aria-pressed', 'true')
    expect(sanDiego).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(sanDiego)
    expect(screen.getByRole('button', { name: 'All colleges' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Transfer articulation' })).toHaveAttribute('aria-selected', 'true')
    expect(sanDiego).toHaveAttribute('aria-pressed', 'true')
    expect(berkeley).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('No agreements')).toBeInTheDocument()
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith({
      path: '/api/assist/agreements?college_id=cc:101&university_id=uc:7',
    }))
  })

  it('keeps the main college list free of campus and articulation percentage controls', () => {
    render(<AgreementsBrowser />)

    expect(screen.getByPlaceholderText(/Search colleges/)).toBeInTheDocument()
    expect(screen.queryByText('Receiving campus')).not.toBeInTheDocument()
    expect(screen.queryByText('Hand-curated')).not.toBeInTheDocument()
    expect(screen.queryByText('ASSIST agreement')).not.toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.queryByText('80%')).not.toBeInTheDocument()
    expect(screen.queryByText('partial coverage')).not.toBeInTheDocument()
    expect(screen.queryByText(/colleges with agreements/)).not.toBeInTheDocument()
  })
})

describe('DataPage SubNav route chip', () => {
  it('shows the coverage route once the articulation tab is active', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))

    expect(screen.getByText('GET /api/assist/coverage')).toBeInTheDocument()
  })

  it('resets a college drill-in when the active Community Colleges tab is clicked again', () => {
    render(<DataPage />)
    const articulationTab = screen.getByRole('tab', { name: 'Community Colleges' })
    fireEvent.click(articulationTab)
    expect(screen.getByPlaceholderText(/Search colleges/)).toBeInTheDocument()

    // Drill into a college's agreement.
    const collegeName = screen.getByText('Diablo Valley College')
    fireEvent.click(collegeName.closest('[class*="cursor-pointer"]'))
    expect(screen.getByRole('button', { name: 'All colleges' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Search colleges/)).not.toBeInTheDocument()

    // Re-selecting Community Colleges (its "home" action) leaves the drill-in and
    // returns to the college list, without losing the selected campus.
    fireEvent.click(articulationTab)
    expect(screen.queryByRole('button', { name: 'All colleges' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search colleges/)).toBeInTheDocument()
  })

  it('uses one top route, a universal hero, and balanced degree coverage stats', async () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))

    const collegeName = screen.getByText('Diablo Valley College')
    fireEvent.click(collegeName.closest('[class*="cursor-pointer"]'))

    expect(await screen.findByText('School pair')).toBeInTheDocument()
    // Once, in the School pair header — the copy beside the back button was
    // removed as repeat information.
    expect(screen.getAllByText('UC Berkeley')).toHaveLength(1)
    expect(screen.getByText('Electrical Engineering & Computer Sciences, B.S.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open ASSIST' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Transfer articulation' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Receiving campus')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Associate degrees' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Associate degrees' })).not.toBeInTheDocument()
    expect(screen.queryByText('Last verified')).not.toBeInTheDocument()
    expect(screen.queryByText('ASSIST agreement')).not.toBeInTheDocument()
    expect(screen.getAllByText('API route')).toHaveLength(1)
    await waitFor(() => expect(screen.getByRole('button', {
      name: 'GET /api/audit/doc/agreement-1?system=uc',
    })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Associate degrees' }))
    expect(screen.getByRole('region', { name: 'Associate degrees' })).toBeInTheDocument()
    expect(screen.getByText('Associate degree detail ast')).toBeInTheDocument()
    expect(screen.getByText('Diablo Valley College')).toBeInTheDocument()
    expect(screen.getByText('Computer Science · Computer Science A.S.-T · 2025-2026')).toBeInTheDocument()
    expect(screen.queryByText(/complete CS A.S.-T requirement record/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Receiving campus')).not.toBeInTheDocument()
    expect(screen.queryByText('School pair')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'GET /api/curated/as-degrees?college_id=cc:101',
    })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Courses' }))
    expect(screen.getByText('No courses')).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'GET /api/assist/courses?institution_id=cc:101',
    })).toBeInTheDocument()

    const detailTabs = screen.getAllByRole('tablist')
      .find((tablist) => within(tablist).queryByRole('tab', { name: 'Transfer articulation' }))
    fireEvent.click(within(detailTabs).getByRole('tab', { name: 'Prerequisites' }))
    expect(screen.getByRole('button', {
      name: 'GET /api/curated/prerequisite-graph?college_id=cc:101',
    })).toBeInTheDocument()

    fireEvent.click(within(detailTabs).getByRole('tab', { name: 'Transfer articulation' }))
    expect(await screen.findByText('School pair')).toBeInTheDocument()
    expect(screen.queryByText('Transfer pathway')).not.toBeInTheDocument()
    expect(screen.queryByText(/Articulation and degree coverage for/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Associate degrees' })).not.toBeInTheDocument()
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
      name: 'GET /api/curated/degree-evaluation?school_id=79&community_college_id=101&majorSlug=cs',
    })).toBeInTheDocument()

    const summary = screen.getByRole('region', { name: 'Degree coverage summary' })
    expect(within(summary).getByText('14 of 30 graduation requirements')).toBeInTheDocument()
    expect(within(summary).getByText('4 remaining')).toBeInTheDocument()
    expect(within(summary).getByText('Fully transferable')).toBeInTheDocument()
    expect(within(summary).getByText('University-only requirements')).toBeInTheDocument()
  })
})

describe('UC Campuses tab', () => {
  it('opens directly on UC campuses, then shows requirements and course tabs', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'UC Campuses' }))

    expect(screen.getByText('GET /api/assist/institutions?kind=university')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Community colleges' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'UC campuses' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'UC Berkeley' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'UC San Diego' })).toBeInTheDocument()
    expect(screen.getByText('Choose a campus')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'UC Berkeley' }))
    expect(screen.getByRole('tab', { name: 'Graduation Requirements' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Transfer Minimums' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Courses' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Majors' })).not.toBeInTheDocument()
    expect(screen.getByText('GET /api/assist/courses?institution_id=uc:79')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Graduation Requirements' }))
    expect(screen.getByText('GET /api/curated/degrees')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Transfer Minimums' }))
    expect(screen.getByText('GET /api/curated/requirements?kind=transfer_minimum')).toBeInTheDocument()
  })
})

describe('Community Colleges degree integration', () => {
  it('uses only district and CS A.S.-T filters and removes the standalone degree page', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))

    expect(screen.queryByRole('tab', { name: 'Associate Degrees' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter by district' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter by CS A.S.-T status' })).toBeInTheDocument()
    expect(screen.queryByText('All regions')).not.toBeInTheDocument()
    expect(screen.queryByText('All counties')).not.toBeInTheDocument()
    expect(screen.getByText('CS A.S.-T')).toBeInTheDocument()
    expect(screen.getAllByText('No CS A.S.-T').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Filter by CS A.S.-T status' }))
    expect(screen.getByRole('option', { name: 'All CS A.S.-T statuses' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'No CS A.S.-T' })).toBeInTheDocument()
    expect(screen.getByRole('option', {
      name: 'Has CS A.S.-T — requirements missing',
    })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Has CS A.S.-T' }))
    expect(screen.getByText('Diablo Valley College')).toBeInTheDocument()
    expect(screen.queryByText('Santa Monica College')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'GET /api/exports/cs-ast-degrees',
    })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Filter by CS A.S.-T status' }))
    fireEvent.click(screen.getByRole('option', { name: 'No CS A.S.-T' }))
    expect(screen.queryByText('Diablo Valley College')).not.toBeInTheDocument()
    expect(screen.getByText('Santa Monica College')).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'GET /api/curated/as-degree-availability',
    })).toBeInTheDocument()
  })

  it('opens degree information even when a college has no ASSIST agreement', async () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    fireEvent.click(screen.getByText('Santa Monica College').closest('[class*="cursor-pointer"]'))

    expect(screen.getByRole('region', { name: 'Associate degrees' })).toBeInTheDocument()
    expect(screen.getByText('Santa Monica College')).toBeInTheDocument()
    // No record for any slot at this college — the header falls back to the
    // slot's own label rather than a "no degree" message; the tabs stay put.
    expect(screen.getByText('Computer Science · A.S.-T')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Associate degrees' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('No agreements')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', {
      name: 'GET /api/curated/as-degrees?college_id=cc:202',
    })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Transfer articulation' }))
    expect(screen.getByText('No agreements')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Associate degrees' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'GET /api/assist/agreements?college_id=cc:202&university_id=uc:79',
    })).toBeInTheDocument()
  })

  it('shows the local A.S. record for a college with no A.S.-T, without excluding any slot', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    fireEvent.click(screen.getByText('College of Marin').closest('[class*="cursor-pointer"]'))

    // Three slots always show, regardless of that college's actual coverage —
    // College of Marin has no A.S.-T (confirmed_none) and a duplicate-flagged
    // "Other" record, and neither absence removes a tab.
    expect(screen.getByRole('region', { name: 'Associate degrees' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'A.S.-T' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Local A.S.' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Other' })).toBeInTheDocument()
    expect(screen.getByText('Computer Science · A.S.-T')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Local A.S.' }))
    expect(screen.getByText('Computer Science · A.S. in Computer Science · 2024-2025')).toBeInTheDocument()
  })

  it('updates the degree header when switching between transfer and local A.S. records', () => {
    render(<DataPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    fireEvent.click(screen.getByText('Diablo Valley College').closest('[class*="cursor-pointer"]'))
    fireEvent.click(screen.getByRole('tab', { name: 'Associate degrees' }))

    expect(screen.getByText('Computer Science · Computer Science A.S.-T · 2025-2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Local A.S.' }))
    expect(screen.getByText('Computer Science · Computer Science A.S. · 2025-2026')).toBeInTheDocument()
  })

  it('shows all three slots even when the college has no records', async () => {
    renderCollegePane({ degrees: [] })
    expect(await screen.findByRole('tab', { name: 'A.S.-T' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Local A.S.' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Other' })).toBeInTheDocument()
  })

  it('shows slots for a major whose asDegrees capability is false', async () => {
    renderCollegePane({ degrees: [], major: { slug: 'bio', label: 'Biology',
      capabilities: { asDegrees: false } } })
    expect(await screen.findByRole('tab', { name: 'A.S.-T' })).toBeInTheDocument()
    expect(screen.queryByText(/No Biology associate degrees yet/)).toBeNull()
  })

  it('never labels the CS availability survey under another major', async () => {
    // The availability survey is Computer Science only. Picking Biology must
    // not borrow a CS record's title into a "Biology · …" header line.
    renderCollegePane({ degrees: [], major: { slug: 'bio', label: 'Biology',
      capabilities: { asDegrees: false } } })
    await screen.findByRole('tab', { name: 'A.S.-T' })
    expect(screen.queryByText(/Computer Science/)).toBeNull()
  })
})
