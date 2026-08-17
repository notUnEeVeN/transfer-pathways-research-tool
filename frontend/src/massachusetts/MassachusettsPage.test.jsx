import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MassachusettsPage from './MassachusettsPage'

// The page's job is wiring: the shared state-tab layout (Overview, Community
// Colleges, Universities, Prerequisites, Visuals) pointed at the Massachusetts
// corpus, the six figure components on the ma-cs major with the
// paper-native lens defaulted on, and the comparison panel diffing our
// recomputation against the published values. The figures and the DataPage
// primitives have their own tests; stubs capture the props here.
vi.mock('../analyses/CoverageHeatmap', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid='fig-coverage' data-major={props.majorSlug}
      data-ma-default={String(props.defaultMaEquivalent ?? '')} />
  ),
}))
vi.mock('../analyses/CourseTypeCoverage', () => ({
  __esModule: true,
  default: (props) => <div data-testid='fig-course-types' data-major={props.majorSlug} />,
}))
vi.mock('../analyses/TransferCreditRate', () => ({
  __esModule: true,
  default: (props) => <div data-testid='fig-credit-rate' data-major={props.majorSlug} />,
}))
vi.mock('../analyses/TransferExtraUnits', () => ({
  __esModule: true,
  default: (props) => <div data-testid='fig-extra-units' data-major={props.majorSlug} />,
}))
vi.mock('../analyses/TransferExtraCost', () => ({
  __esModule: true,
  default: (props) => <div data-testid='fig-extra-cost' data-major={props.majorSlug} />,
}))

// DataPage's shared primitives are presentational and carry their own tests;
// stubs here surface just enough to prove the wiring.
vi.mock('../DataPage', () => ({
  InstitutionRail: ({ items, onSelect, title }) => (
    <div data-testid={`rail-${title}`}>
      {items.map((item) => (
        <button key={item.id} type='button' onClick={() => onSelect(item.id)}>{item.name}</button>
      ))}
    </div>
  ),
  CourseTable: ({ rows }) => (
    <div data-testid='course-table'>{rows.map((row) => <div key={row._id}>{row.code} {row.title}</div>)}</div>
  ),
  courseSearch: (rows) => rows,
  TieredDegreeLedger: ({ groups }) => (
    <div data-testid='degree-ledger' data-groups={groups.length} />
  ),
}))

// The gallery primitives come from the California Visuals page and carry
// their own tests; the stubs record which analysis, major, and extra props
// each card was wired with.
vi.mock('../visuals/VisualsPage', () => ({
  VisualThumbnailCard: ({ item, selectedMajor, componentProps, onOpen }) => (
    <button type='button' data-testid={`thumb-${item.analysis.id}`}
      data-major={selectedMajor?.slug}
      data-component-props={JSON.stringify(componentProps || null)}
      onClick={onOpen}>{item.analysis.title}</button>
  ),
  BuiltInAnalysisCard: ({ analysis, selectedMajor, componentProps }) => (
    <div data-testid={`detail-${analysis.id}`} data-major={selectedMajor?.slug}
      data-component-props={JSON.stringify(componentProps || null)} />
  ),
  itemDetails: (item) => ({ title: item.analysis.title, source: 'test source' }),
}))

vi.mock('../asdegrees/AsDegreeSchoolView', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid='as-degree-view' data-college={props.collegeId}
      data-state={props.state} data-major={props.major} data-only={props.onlyDegreeType} />
  ),
}))

const mockMajors = vi.fn()
vi.mock('../shared/majors/useMajors', () => ({
  useMajors: (...args) => mockMajors(...args),
}))

const mockBaselines = vi.fn()
const mockCoverage = vi.fn()
const mockRate = vi.fn()
const mockColleges = vi.fn()
const mockSchools = vi.fn()
const mockCcCourses = vi.fn()
const mockUniversityCourses = vi.fn()
const mockDegreeDocuments = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useMaBaselines: (...args) => mockBaselines(...args),
  useCoverage: (...args) => mockCoverage(...args),
  useTransferCreditRate: (...args) => mockRate(...args),
  useColleges: (...args) => mockColleges(...args),
  useSchools: (...args) => mockSchools(...args),
  useCcCourses: (...args) => mockCcCourses(...args),
  useUniversityCourses: (...args) => mockUniversityCourses(...args),
  useDegreeRequirementDocuments: (...args) => mockDegreeDocuments(...args),
}))

const ok = (data) => ({ data, isLoading: false, isError: false })

function seedHooks() {
  mockBaselines.mockReturnValue(ok({
    measures: {
      pct_as: { resident: [], cells: [{ school_id: 9001, school: 'Bridgewater', community_college_id: 9103, college_name: 'Bunker Hill Community College', value: 0.508 }] },
      credit_hours: { resident: [{ school_id: 9001, school: 'Bridgewater', value: 120 }], cells: [{ school_id: 9001, school: 'Bridgewater', community_college_id: 9103, college_name: 'Bunker Hill Community College', value: 149 }] },
    },
    source: 'CurrComp Master.xlsx',
  }))
  mockCoverage.mockReturnValue(ok({
    rows: [{ school_id: 9001, community_college_id: 9103, pct_named_requirement_courses: 27.3 }],
  }))
  mockRate.mockReturnValue(ok({
    rows: [{ school_id: 9001, community_college_id: 9103, college_name: 'Bunker Hill Community College', school: 'Bridgewater', as_unit_utilization_pct: 55.7, extra_units: 29 }],
  }))
  mockColleges.mockReturnValue(ok([
    { id: 9103, source_id: 9103, name: 'Bunker Hill Community College', institution_id: 'ma:cc:9103' },
  ]))
  mockSchools.mockReturnValue(ok({
    uc: [{ id: 9001, source_id: 9001, name: 'Bridgewater State University', institution_id: 'ma:uni:9001' }],
  }))
  mockCcCourses.mockReturnValue(ok([
    { _id: 'ma:sending:9103001', prefix: 'CSC', number: '101', title: 'Programming I', units: 3 },
  ]))
  mockUniversityCourses.mockReturnValue(ok([
    { _id: 'ma:receiving:9001001', parent_id: 9001001, prefix: 'COMP', number: '101', title: 'Computer Science I' },
  ]))
  mockDegreeDocuments.mockReturnValue(ok({
    rows: [{
      _id: 'degree:9001:ma-cs', kind: 'degree', major_slug: 'ma-cs', school_id: 9001,
      school: 'Bridgewater State University', program: 'Computer Science, B.S.',
      total_units: 120, catalog_year: '2024-25',
      requirement_groups: [{ title: 'Lower', tier: 'transferable', sections: [] }],
    }],
  }))
  mockMajors.mockReturnValue({
    majors: [{ slug: 'ma-cs', label: 'Computer Science (MA)', state: 'ma', capabilities: {} }],
    defaultSlug: 'ma-cs',
    isLoading: false,
    isError: false,
  })
}

describe('MassachusettsPage', () => {
  it('lands on Overview: the shared state-tab layout, corpus stats, and the comparison panel', () => {
    seedHooks()
    render(<MassachusettsPage />)

    for (const label of ['Overview', 'Community Colleges', 'Universities', 'Prerequisites', 'Visuals']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }

    // Overview: provenance is stated, not implied, and the comparison panel
    // diffs our recomputation against a published cell.
    expect(screen.getByText(/recovered from the paper/i)).toBeInTheDocument()
    expect(screen.getByText('Studied pathways')).toBeInTheDocument()
    expect(screen.getAllByText(/Bunker Hill/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('50.8%').length).toBeGreaterThan(0)

    // Figures live under Visuals now, not on the landing pane.
    expect(screen.queryByTestId('thumb-coverage-heatmap')).toBeNull()
  })

  it('renders Visuals as the California-style gallery: five registry cards on ma-cs, paper lens defaulted', () => {
    seedHooks()
    render(<MassachusettsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Visuals' }))
    expect(mockMajors).toHaveBeenCalledWith({ state: 'ma' })

    // The same gallery chrome the California library uses.
    expect(screen.getByText('Visual library')).toBeInTheDocument()
    expect(screen.getByText('Computer Science (MA)')).toBeInTheDocument()
    expect(screen.getByText('6 visuals')).toBeInTheDocument()

    for (const id of ['coverage-heatmap', 'course-type-coverage', 'transfer-credit-rate', 'transfer-extra-units', 'transfer-extra-cost', 'pathway-complexity']) {
      expect(screen.getByTestId(`thumb-${id}`).getAttribute('data-major')).toBe('ma-cs')
    }
    // The paper's own measure is the corpus's native lens.
    expect(screen.getByTestId('thumb-coverage-heatmap').getAttribute('data-component-props'))
      .toBe(JSON.stringify({ defaultMaEquivalent: true }))

    // Opening a card mounts the same full detail card California renders.
    fireEvent.click(screen.getByTestId('thumb-coverage-heatmap'))
    const detail = screen.getByTestId('detail-coverage-heatmap')
    expect(detail.getAttribute('data-major')).toBe('ma-cs')
    expect(detail.getAttribute('data-component-props'))
      .toBe(JSON.stringify({ defaultMaEquivalent: true }))
  })

  it('lands a community college on its associate degree, with the course list one sub-tab over', () => {
    seedHooks()
    render(<MassachusettsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    expect(mockColleges).toHaveBeenCalledWith({ state: 'ma' })

    fireEvent.click(screen.getByRole('button', { name: 'Bunker Hill Community College' }))
    // Default drill-in: the same per-college degree view California renders.
    const degreeView = screen.getByTestId('as-degree-view')
    expect(degreeView.getAttribute('data-college')).toBe('9103')
    expect(degreeView.getAttribute('data-state')).toBe('ma')
    expect(degreeView.getAttribute('data-major')).toBe('ma-cs')
    expect(degreeView.getAttribute('data-only')).toBe('local_as')

    fireEvent.click(screen.getByRole('tab', { name: 'Courses' }))
    expect(mockCcCourses).toHaveBeenCalledWith(9103, { state: 'ma' })
    expect(screen.getByText(/CSC 101 Programming I/)).toBeInTheDocument()
    expect(screen.getByText(/this flat list is the AS degree/i)).toBeInTheDocument()
  })

  it('browses a university into its imported B.S. requirement ledger', () => {
    seedHooks()
    render(<MassachusettsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Universities' }))
    expect(mockSchools).toHaveBeenCalledWith({ state: 'ma' })

    fireEvent.click(screen.getByRole('button', { name: 'Bridgewater State University' }))
    expect(screen.getByText(/Computer Science, B\.S\. · 120 credits stated/)).toBeInTheDocument()
    expect(screen.getByTestId('degree-ledger').getAttribute('data-groups')).toBe('1')
  })

  it('says plainly that prerequisites are not modeled for this corpus', () => {
    seedHooks()
    render(<MassachusettsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Prerequisites' }))
    expect(screen.getByText('No prerequisite graph for Massachusetts')).toBeInTheDocument()
  })
})
