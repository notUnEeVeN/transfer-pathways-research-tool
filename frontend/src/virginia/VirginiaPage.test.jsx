import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

// The Visuals tab reuses the California gallery primitives, which carry their
// own tests; the stubs here record which analysis and major each card was
// wired with, matching the Massachusetts page's harness.
vi.mock('../visuals/VisualsPage', () => ({
  VisualThumbnailCard: ({ item, selectedMajor, onOpen }) => (
    <button type='button' data-testid={`thumb-${item.analysis.id}`}
      data-major={selectedMajor?.slug} onClick={onOpen}>{item.analysis.title}</button>
  ),
  BuiltInAnalysisCard: ({ analysis, selectedMajor }) => (
    <div data-testid={`detail-${analysis.id}`} data-major={selectedMajor?.slug} />
  ),
  itemDetails: (item) => ({ title: item.analysis.title, source: 'test source' }),
}))

// Only `useMajors` is stubbed: the module also exports the California fallback
// that MajorContext imports, so the rest of it has to stay real.
const mockMajors = vi.fn()
vi.mock('../shared/majors/useMajors', async (importOriginal) => ({
  ...(await importOriginal()),
  useMajors: (...args) => mockMajors(...args),
}))

// The hooks are the only thing this page needs from the outside; stubbing them
// keeps the test about whether the page renders, not about the network.
const state = {}
vi.mock('./useVirginia', () => ({
  useVaDegrees: () => state.degrees,
  useVaCoverage: () => state.coverage,
  useSaveVaDegree: () => state.save,
  useVaDegreeRevisions: () => state.revisions,
  useVaSummary: () => state.summary,
  // The real endpoint filters by level; mirroring that here keeps the rails
  // from being fed institutions of the wrong kind.
  useVaInstitutions: (level, cohort = '') => {
    const all = state.institutions
    if (!level || !all?.data) return all
    return {
      ...all,
      data: {
        ...all.data,
        institutions: all.data.institutions.filter((i) => i.level === level
          && (!cohort || i.cohort === cohort)),
      },
    }
  },
  useVaDepartments: () => state.departments,
  useVaCourses: () => state.courses,
  useVaCourse: () => state.course,
  useVaMatrix: () => state.matrix,
  useVaPrerequisiteGraph: () => state.prerequisites,
}))

import VirginiaPage, { VA_VISUALS_READY } from './VirginiaPage'
import { VA_COVERAGE_ROWS } from '../analyses/vaCoverageRows'
import { VA_TRANSFER_GUIDES } from '../analyses/vaTransferGuides'

const ok = (data) => ({ data, isLoading: false, error: null })

beforeEach(() => {
  mockMajors.mockReturnValue({
    majors: [{
      slug: 'va-cs',
      label: 'Computer Science (VA)',
      state: 'va',
      capabilities: { paperBaselines: false, asDegrees: true, degreeTemplates: true },
    }],
    isLoading: false,
    isError: false,
  })
  state.summary = ok({
    imported: true, courses: 304, institutions: 57, community_colleges: 24,
    four_year: 33, public_four_year: 15, equivalencies: 4668, with_notes: 970, departments: 69,
  })
  state.institutions = ok({
    cohorts: {
      schev_public_four_year: { institution_count: 15 },
      other_four_year: { institution_count: 18 },
    },
    institutions: [
      { _id: 'va:inst:blue-ridge', name: 'Blue Ridge Community College', level: 'community_college',
        course_count: 213, receives_count: 0, degree_status: 'full', degree_courses: 31 },
      { _id: 'va:inst:wytheville', name: 'Wytheville Community College', level: 'community_college',
        course_count: 180, receives_count: 0, degree_status: 'url_only', degree_courses: 0 },
      { _id: 'va:inst:danville-community-college', name: 'Danville Community College', level: 'community_college',
        course_count: 170, receives_count: 0, degree_status: 'no_program', degree_courses: 0 },
      { _id: 'va:inst:gmu', name: 'George Mason University', level: 'four_year',
        cohort: 'schev_public_four_year', is_primary: true,
        course_count: 0, receives_count: 237, degree_status: 'full', degree_courses: 114 },
      { _id: 'va:inst:cnu', name: 'Christopher Newport University', level: 'four_year',
        cohort: 'schev_public_four_year', is_primary: true, needs_collection: true,
        course_count: 0, receives_count: 215, degree_status: 'none', degree_courses: 0 },
      { _id: 'va:inst:uva', name: 'University of Virginia', level: 'four_year',
        cohort: 'schev_public_four_year', is_primary: true, needs_collection: true,
        course_count: 0, receives_count: 0, degree_status: 'none', degree_courses: 0 },
      { _id: 'va:inst:vmi', name: 'Virginia Military Institute', level: 'four_year',
        cohort: 'schev_public_four_year', is_primary: true, needs_collection: true,
        course_count: 0, receives_count: 0, degree_status: 'none', degree_courses: 0 },
      { _id: 'va:inst:lynchburg', name: 'University of Lynchburg', level: 'four_year',
        cohort: 'other_four_year', is_primary: false,
        course_count: 0, receives_count: 131, degree_status: 'url_only', degree_courses: 0 },
      { _id: 'va:inst:gwu', name: 'George Washington University', level: 'four_year',
        cohort: 'external', is_primary: false,
        course_count: 0, receives_count: 1, degree_status: 'none', degree_courses: 0 },
      { _id: 'va:inst:hollins', name: 'Hollins University', level: 'four_year',
        cohort: 'other_four_year', is_primary: false,
        course_count: 0, receives_count: 48, degree_status: 'no_program', degree_courses: 0 },
    ],
  })
  state.departments = ok({ departments: [{ department: 'Computer Science', courses: 17 }] })
  state.courses = ok({
    courses: [{
      code: 'CSC221', title: 'Introduction to Problem Solving and Programming',
      credits: 3, department: 'Computer Science',
      counts: { offered_by: 21, four_year: 17, with_notes: 4 },
    }],
    total: 304, skip: 0, limit: 200,
  })
  state.course = ok({
    course: {
      code: 'CSC221', title: 'Introduction to Problem Solving and Programming', credits: 3,
      department: 'Computer Science', description: 'Introduces problem solving.',
      offered_by: ['Blue Ridge Community College'],
      articulates_to: [{ institution: 'George Mason University', identifier: 'CS108', name: 'Intro to Programming', notes: null }],
      counts: { offered_by: 21, four_year: 17, with_notes: 4 },
      unrecognised_levels: [],
    },
  })
  // A real requirement tree, so the shared RequirementsLedger is exercised
  // rather than a bespoke list — the whole point of the Virginia/California
  // rendering parity.
  state.degrees = ok({
    degrees: [{
      _id: 'va:as:x:cs', kind: 'as_degree', source: 'institution_catalog',
      degree_title_seen: 'Computer Science, AS', catalog_url: 'https://catalog.example.edu/cs',
      total_units: 60, status: 'extracted', codes_seen: ['CSC221', 'CSC222'],
      collection_status: 'catalog_accepted',
      acceptance: { accepted: true, ready_for_analysis: false },
      verification: { verified: false },
      requirement_groups: [{
        is_required: true, group_conjunction: 'And', title: 'Requirements',
        tier: 'transferable', source_refs: [], note: null, course_level: null,
        cc_articulable: null, overlap_key: null, human_review: null,
        sections: [{
          section_advisement: null, unit_advisement: null, tier: 'transferable',
          source_refs: [], note: null, course_level: null, cc_articulable: null,
          overlap_key: null, human_review: null,
          receivers: [
            { receiving: { kind: 'course', parent_id: 900000001, units: null }, articulation_status: null,
              not_articulated_reason: null, options: [], options_conjunction: 'or', hash_id: null,
              tier: 'transferable', code_seen: 'CSC221' },
            { receiving: { kind: 'course', parent_id: 900000002, units: null }, articulation_status: 'articulated',
              not_articulated_reason: null,
              options: [{ course_ids: [900000003], course_conjunction: 'and', course_keys: ['va:MTH263'] }],
              options_conjunction: 'or', hash_id: null,
              tier: 'transferable', code_seen: 'CSC222' },
          ],
        }],
      }],
    }],
    university_courses_by_id: {
      900000001: { prefix: 'CSC', number: '221', title: 'Intro to Problem Solving', min_units: 3, max_units: 3 },
      900000002: { prefix: 'CSC', number: '222', title: 'Object-Oriented Programming', min_units: 4, max_units: 4 },
    },
    courses: [{ course_id: 900000003, prefix: 'MTH', number: '263', title: 'Calculus I', units: 4 }],
  })
  state.save = { mutate: (...a) => { state.saved.push(a[0]) }, isPending: false, isError: false }
  state.saved = []
  state.revisions = ok({ revisions: [] })
  // Coverage now carries each institution's documents and their verification
  // state, which is what the overview worklist is built from.
  //
  // `catalog_accepted: false` on a live document is the shape that broke the
  // page: the parser never accepted it, and the overview must count it anyway.
  const doc = (over = {}) => ({
    doc_id: 'va:as:x:cs', source: 'institution_catalog', status: 'extracted',
    verified: false, has_notes: false, catalog_accepted: false,
    validation: 'pass', groups: 8, receivers: 60, ...over,
  })
  state.coverage = ok({
    coverage: [
      { _id: 'va:cov:cc:blue-ridge', institution: 'Blue Ridge Community College', level: 'community_college', collected: true,
        source_url: 'https://catalog.brcc.edu/x', offers_cs: true,
        documents: { as_degree: [doc({ doc_id: 'va:as:blue-ridge:cs' })], degree: [] } },
      { _id: 'va:cov:cc:wytheville', institution: 'Wytheville Community College', level: 'community_college', collected: false,
        offers_cs: true,
        documents: { as_degree: [doc({ doc_id: 'va:as:wytheville:cs', status: 'url_only', groups: 0, receivers: 0, validation: null })], degree: [] } },
      { _id: 'va:cov:cc:danville-community-college', institution: 'Danville Community College', level: 'community_college', collected: true,
        catalog_year: '2026-2027', collection_status: 'no_program', offers_cs: false,
        finding_complete: true, finding_source_refs_resolved: true,
        program_finding: {
          code: 'current_cs_transfer_specialization_discontinued',
          summary: "Danville's 2026-2027 catalog does not publish the former Science - Computer Science Specialization.",
          evidence: ['The current Programs of Study index contains no Computer Science specialization.'],
          source_refs: ['current_program_index', 'prior_program'],
          alternate_path: {
            program: 'Science (AS)', catalog_year: '2026-2027',
            source_refs: ['alternate_science_program'],
            computer_science_alignment: 'not_defined_by_current_catalog',
          },
        },
        finding_sources: [
          { id: 'current_program_index', kind: 'current_program_index',
            label: 'Danville 2026-2027 Programs of Study index',
            url: 'https://catalog.danville.edu/content.php?catoid=7&navoid=222',
            sha256: '76552361a435b6936b5a37d0c09c6d99546e8fb1f5c57382fdd76de74d81f04b' },
          { id: 'prior_program', kind: 'prior_program', label: 'Archived Computer Science specialization',
            url: 'https://catalog.danville.edu/preview_program.php?catoid=4&poid=450&returnto=108',
            sha256: '219a249096914b368c24d8e830699673c709490ff395801c9f03584bb1fdbe1f' },
          { id: 'alternate_science_program', kind: 'alternate_science_program',
            label: 'Current broad Science A.S.',
            url: 'https://catalog.danville.edu/preview_program.php?catoid=7&poid=702&returnto=222',
            sha256: '5787b7838acf3c9208ffc6d3bfc6dc561c40c10458577bbd29f2886a7d55c9ee' },
        ],
        documents: { as_degree: [], degree: [] } },
      { _id: 'va:cov:uni:gmu', institution: 'George Mason University', level: 'four_year', collected: true,
        cohort: 'schev_public_four_year', is_primary: true,
        offers_cs: true,
        documents: { as_degree: [], degree: [doc({ doc_id: 'va:degree:gmu:cs', verified: true, validation: 'warn' })] } },
      { _id: 'va:cov:uni:cnu', institution: 'Christopher Newport University', level: 'four_year', collected: false,
        cohort: 'schev_public_four_year', is_primary: true, needs_collection: true,
        collection_status: 'captured_needs_review', offers_cs: true,
        documents: { as_degree: [], degree: [] } },
      { _id: 'va:cov:uni:uva', institution: 'University of Virginia', level: 'four_year', collected: false,
        cohort: 'schev_public_four_year', is_primary: true, needs_collection: true,
        collection_status: 'not_collected', offers_cs: true,
        documents: { as_degree: [], degree: [] } },
      { _id: 'va:cov:uni:vmi', institution: 'Virginia Military Institute', level: 'four_year', collected: false,
        cohort: 'schev_public_four_year', is_primary: true, needs_collection: true,
        collection_status: 'not_collected', offers_cs: true,
        documents: { as_degree: [], degree: [] } },
      { _id: 'va:cov:uni:lynchburg', institution: 'University of Lynchburg', level: 'four_year', collected: false,
        cohort: 'other_four_year', is_primary: false,
        collection_status: 'catalog_url_only', offers_cs: true,
        documents: { as_degree: [], degree: [] } },
      { _id: 'va:cov:uni:hollins', institution: 'Hollins University', level: 'four_year', collected: false, offers_cs: false,
        cohort: 'other_four_year', is_primary: false,
        collection_status: 'no_program',
        documents: { as_degree: [], degree: [] } },
    ],
    collected: 2,
    total: 4,
    // The server's own totals, in the shape it reports now: LIVE documents per
    // level and how many of them a person has signed. Nothing here is gated on
    // catalog acceptance.
    verification: {
      documents: 4, live: 2, verified: 1,
      as_live: 1, as_verified: 0, bs_live: 1, bs_verified: 1,
    },
  })
  state.matrix = ok({
    colleges: ['Blue Ridge Community College'],
    receivers: ['George Mason University'],
    cells: [[137]], courses: 304,
  })
  state.prerequisites = ok({
    concepts: [
      { slug: 'cs_1', name: 'Programming Fundamentals', discipline: 'cs', requires: [], satisfies: [] },
      { slug: 'cs_2_oop', name: 'Object-Oriented Programming', discipline: 'cs', requires: ['cs_1'], satisfies: [] },
    ],
    rules: [],
    stats: { in_scope: 2, examined: 2, mapped: 2, edges: 1 },
    courses: [
      { key: 'va:CSC221', code: 'CSC221', title: 'Introduction to Problem Solving', concept: 'cs_1',
        concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true },
      { key: 'va:CSC222', code: 'CSC222', title: 'Object-Oriented Programming', concept: 'cs_2_oop',
        concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true,
        lands_as: { identifier: 'CS112', name: 'Introduction to Programming' } },
    ],
    edges: [{ from: 'va:CSC221', to: 'va:CSC222', kind: 'prerequisite', raw: 'Prerequisite: CSC 221' }],
    missing: [],
    scope: { coverage: 'complete' },
  })
})

describe('VirginiaPage', () => {
  it('renders without crashing and opens on the community colleges', () => {
    render(<VirginiaPage />)
    // The corpus-count tiles went with the Overview tab. The console opens on
    // the colleges instead, which is where the work is.
    expect(screen.getByRole('tab', { name: 'Community Colleges' }))
      .toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Overview' })).toBeNull()
  })

  it('shows the corpus tabs, including Virginia prerequisites but no Districts', () => {
    render(<VirginiaPage />)
    // No Overview: it reported the equivalency scrape and the verification of
    // catalog-composed documents, neither of which this state now measures.
    for (const t of ['Community Colleges', 'Universities', 'Courses', 'Prerequisites']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('Districts')).toBeNull()
  })

  // The Virginia corpus is unverified and its agreements are derived rather
  // than published, so exposing the figures is a deliberate choice held in
  // VA_VISUALS_READY. This is the guard against that changing by ACCIDENT: the
  // tab, the figures, and the major fetch must all agree with the flag, so
  // neither flipping the switch nor editing the tab list can drift alone.
  it('exposes the visuals tab exactly when VA_VISUALS_READY says to', () => {
    render(<VirginiaPage />)
    const tab = screen.queryByRole('tab', { name: 'Visuals' })
    if (VA_VISUALS_READY) {
      expect(tab).not.toBeNull()
      // Shown means shown: opening the tab reaches the VA major and renders the
      // five-figure gallery. Figure 6 (pathway complexity) is deliberately not
      // among them — Virginia's university prerequisite corpus is empty.
      fireEvent.click(tab)
      expect(mockMajors).toHaveBeenCalledWith({ state: 'va' })
      expect(screen.queryByTestId('thumb-coverage-heatmap')).not.toBeNull()
      expect(screen.queryByTestId('thumb-transfer-credit-rate')).not.toBeNull()
      expect(screen.queryByTestId('thumb-pathway-complexity')).toBeNull()
      return
    }
    expect(tab).toBeNull()
    // Withheld means withheld: no figure reaches the page, and nothing even
    // asks for the VA major.
    expect(screen.queryByTestId('thumb-coverage-heatmap')).toBeNull()
    expect(screen.queryByTestId('thumb-transfer-credit-rate')).toBeNull()
    expect(mockMajors).not.toHaveBeenCalledWith({ state: 'va' })
  })

  it('renders the not-imported state instead of crashing on an empty corpus', () => {
    state.summary = ok({ imported: false, courses: 0, institutions: 0 })
    render(<VirginiaPage />)
    expect(screen.getByText(/not in this database/i)).toBeTruthy()
  })

  it('survives a summary error without taking the page down', () => {
    state.summary = { data: undefined, isLoading: false, error: new Error('boom') }
    render(<VirginiaPage />)
    expect(screen.getByText(/could not load/i)).toBeTruthy()
  })

  it('survives the loading state', () => {
    state.summary = { data: undefined, isLoading: true, error: null }
    render(<VirginiaPage />)
  })
})

describe('rails and drill-in', () => {
  // "Institutions" is both a tab label and a section heading, so target the
  // tab explicitly rather than the first text match.
  const clickTab = async (label) => {
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getAllByText(label)[0])
  }

  it('opens a college from the rail and lists the courses it offers', async () => {
    render(<VirginiaPage />)
    await clickTab('Community Colleges')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    expect(screen.getByText('CSC221')).toBeTruthy()
    expect(screen.getAllByText('Associate Degrees').length).toBeGreaterThan(0)
  })

  it('opens a receiving university and shows what each course lands as', async () => {
    state.courses = ok({
      courses: [{
        code: 'CSC221', title: 'Intro to Problem Solving', credits: 3, department: 'Computer Science',
        counts: { offered_by: 21, four_year: 17, with_notes: 4 },
        lands_as: { institution: 'George Mason University', identifier: 'CS108', name: 'Intro to Programming', notes: null },
      }],
      total: 237, receiver: 'George Mason University',
    })
    render(<VirginiaPage />)
    await clickTab('Universities')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText('George Mason University'))
    // A university with a parsed guide opens on it — that is the document every
    // Virginia figure is computed from. The equivalency view is one click away,
    // and the catalog composition it used to open on is now labelled superseded.
    expect(screen.getAllByText('Transfer Guide').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Catalog composition (superseded)').length).toBeGreaterThan(0)
    // The page has its own top-level Courses tab; this is the sub-tab, which
    // renders after it.
    const courseTabs = screen.getAllByRole('tab', { name: 'Courses' })
    fireEvent.click(courseTabs[courseTabs.length - 1])
    expect(screen.getByText('CS108')).toBeTruthy()
  })
})

// Every tab gets rendered at least once. A JSX identifier that is used but not
// imported is a runtime ReferenceError that the bundler does not catch, so an
// unvisited tab can ship broken — which is exactly what happened to the
// Courses tab when its search input was swapped out.
describe('every tab renders', () => {
  const tabs = ['Community Colleges', 'Universities', 'Courses', 'Prerequisites']
  for (const label of tabs) {
    it(`renders the ${label} tab without throwing`, async () => {
      const { fireEvent } = await import('@testing-library/react')
      render(<VirginiaPage />)
      fireEvent.click(screen.getAllByText(label)[0])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  }

  it('shows the shared catalog and opens a course from it', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    // The page has its own top-level Courses tab; this is the sub-tab, which
    // renders after it.
    const courseTabs = screen.getAllByRole('tab', { name: 'Courses' })
    fireEvent.click(courseTabs[courseTabs.length - 1])
    expect(screen.getByText(/shared VCCS catalog/i)).toBeTruthy()
    fireEvent.click(screen.getByText('CSC221'))
    expect(screen.getAllByText(/Introduction to Problem Solving/i).length).toBeGreaterThan(0)
  })

  it('opens the published VCCS prerequisite view', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByRole('tab', { name: 'Prerequisites' }).at(-1))
    expect(screen.getByText(/published statewide VCCS course relationships/i)).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mapping Review' })).toBeTruthy()
  })
})

describe('Virginia prerequisite drill-ins', () => {
  it('adds the published baseline to a community college without claiming exact local policy', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByRole('tab', { name: 'Prerequisites' }).at(-1))
    expect(screen.getByText(/published statewide VCCS prerequisite baseline/i)).toBeTruthy()
    expect(screen.getByText(/may add local prerequisites or corequisites/i)).toBeTruthy()
  })

  it('labels a university sequence as transfer preparation, never university prerequisites', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Universities' }))
    fireEvent.click(screen.getByText('George Mason University'))
    // The sub-tab and the top-level tab share the name; the sub-tab renders last.
    fireEvent.click(screen.getAllByRole('tab', { name: 'Prerequisites' }).at(-1))
    // The tab names the content; the "not this university's own policy"
    // qualifier belongs to the view, as a banner that cannot be tabbed past.
    expect(screen.getByText(/Transfer preparation, not university prerequisites/i)).toBeTruthy()
    expect(screen.getByText('CS112')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'University Prerequisites' })).toBeNull()
  })
})


describe('university transfer guides', () => {
  it('opens a university on the guide the figures are computed from', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    fireEvent.click(screen.getByText('George Mason University'))
    // Both halves of the pathway, and the split that caps coverage near half.
    expect(screen.getAllByText(/Before transfer/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/After transfer/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Stated total').length).toBeGreaterThan(0)
  })

  it('carries the same guide the coverage figure measures', () => {
    // The university page and the heatmap column must be the same document, or
    // a reader checking one against the other is comparing two sources.
    const titles = new Set(VA_COVERAGE_ROWS.catalog.rows.map((r) => r.school))
    const guides = Object.values(VA_TRANSFER_GUIDES.universities)
    expect(guides.length).toBe(titles.size)
    for (const g of guides) expect(titles.has(g.title)).toBe(true)
  })

  it('states both halves in credits for every guide', () => {
    for (const [name, g] of Object.entries(VA_TRANSFER_GUIDES.universities)) {
      expect(g.before_transfer.length, name).toBeGreaterThan(0)
      expect(g.after_transfer.length, name).toBeGreaterThan(0)
      expect(g.source_url, name).toMatch(/^https?:/)
      expect(g.derived.stated_total_units, name).toBeGreaterThan(90)
    }
  })
})

describe('the rail status filters', () => {
  const rail = () => within(screen.getByText(/Community colleges ·/).closest('div'))
  const filters = () => within(screen.getByRole('group', { name: 'Filter by collection state' }))

  it('filters the rail to the institutions still needing collection', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    // Every settled outcome remains reachable; only Blue Ridge is outstanding work.
    expect(rail().getByText('Blue Ridge Community College')).toBeTruthy()
    expect(rail().getByText('Wytheville Community College')).toBeTruthy()
    fireEvent.click(filters().getByRole('button', { name: /Collected/ }))
    expect(rail().getByText('Blue Ridge Community College')).toBeTruthy()
    expect(rail().queryByText('Wytheville Community College')).toBeNull()
  })

  it('keeps "nothing to read" reachable but apart from the work', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    fireEvent.click(filters().getByRole('button', { name: /URL only/ }))
    expect(rail().getByText('Wytheville Community College')).toBeTruthy()
    expect(rail().queryByText('Blue Ridge Community College')).toBeNull()
  })

  it('toggles a filter off when its own pill is clicked again', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    const pill = filters().getByRole('button', { name: /Collected/ })
    fireEvent.click(pill)
    expect(rail().queryByText('Wytheville Community College')).toBeNull()
    fireEvent.click(filters().getByRole('button', { name: /Collected/ }))
    expect(rail().getByText('Wytheville Community College')).toBeTruthy()
  })
})

describe('degree editing', () => {
  // Signing off is gone from this console: no figure reads a verification
  // record, so a verdict beside the data claimed a provenance it did not have.
  it('offers no way to sign a document off', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByText('Associate Degrees')[0])
    for (const label of ['Mark verified', 'Re-verify', 'Reopen']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull()
    }
    expect(screen.queryByText('Unverified')).toBeNull()
  })

  it('sends notes exactly as typed, never pre-filled', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByText('Associate Degrees')[0])
    const box = screen.getByPlaceholderText(/your own notes/i)
    expect(box.value).toBe('')
    fireEvent.change(box, { target: { value: 'checked against catalog' } })
    fireEvent.click(screen.getByText('Save notes'))
    expect(state.saved[0].verification.notes).toBe('checked against catalog')
    // Any stored verdict is carried through untouched, never rewritten: the
    // record of who checked what is still true, it is just not a control here.
    const stored = state.degrees.data.degrees[0].verification?.verified
    expect(state.saved[0].verification.verified).toBe(stored)
  })
})

// The client owns no eligibility rule. A document the server served for this
// institution is one a person may sign; the parser's opinion of its own parse
// is not a permission system, and treating it as one is what stopped partners
// verifying eleven A.S. degrees that had no `acceptance` block at all.
describe('degree panes', () => {
  it('shows a catalog-sourced degree with its source link and courses', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByText('Associate Degrees')[0])
    expect(screen.getByText('institution catalog')).toBeTruthy()
    // Rendered through the shared ledger: "CSC 221", resolved via the course
    // map, not a raw code badge.
    expect(screen.getByText('CSC 221')).toBeTruthy()
    expect(screen.getByText(/Intro to Problem Solving/)).toBeTruthy()
    expect(screen.getAllByText(/Source page/i).length).toBeGreaterThan(0)
  })

  it('marks an institution that publishes no course list as URL only', async () => {
    state.degrees = ok({ degrees: [{
      _id: 'va:degree:y:cs', kind: 'degree', source: 'institution_catalog',
      program: 'Computer Science', source_url: 'https://x.edu/cs',
      status: 'url_only', codes_seen: [], requirement_groups: [],
      verification: { verified: false },
    }] })
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    fireEvent.click(screen.getByText('George Mason University'))
    fireEvent.click(screen.getAllByText('Catalog composition (superseded)')[0])
    expect(screen.getByText('URL only')).toBeTruthy()
    expect(screen.getByText(/no machine-readable course list/i)).toBeTruthy()
  })

  it('shows a completed no-program finding with its official evidence instead of an ambiguous empty state', async () => {
    state.degrees = ok({ degrees: [], university_courses_by_id: {}, courses: [] })
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    fireEvent.click(screen.getByText('Danville Community College'))
    fireEvent.click(screen.getAllByRole('tab', { name: 'Associate Degrees' }).at(-1))

    expect(screen.getByText('Official evidence resolved')).toBeTruthy()
    expect(screen.getByText('Catalog 2026-2027')).toBeTruthy()
    expect(screen.getByText(/does not publish the former Science - Computer Science Specialization/i)).toBeTruthy()
    expect(screen.getByText(/current Programs of Study index contains no Computer Science specialization/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Science \(AS\)/i }).getAttribute('href'))
      .toBe('https://catalog.danville.edu/preview_program.php?catoid=7&poid=702&returnto=222')
    expect(screen.getByRole('link', { name: /Danville 2026-2027 Programs of Study index/i })).toBeTruthy()
    expect(screen.getByText(/SHA-256 76552361a435b693/i)).toBeTruthy()
    expect(screen.queryByText(/Either it does not offer the program/i)).toBeNull()
    expect(screen.getByRole('button', {
      name: 'GET /api/va/degrees?institution=Danville%20Community%20College',
    })).toBeTruthy()
  })

  it('reports the selected university on the displayed degree API route', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Universities' }))
    fireEvent.click(screen.getByText('George Mason University'))
    fireEvent.click(screen.getAllByRole('tab', { name: 'Catalog composition (superseded)' }).at(-1))

    expect(screen.getByRole('button', {
      name: 'GET /api/va/degrees?institution=George%20Mason%20University',
    })).toBeTruthy()
  })
})

// Rendering parity is the point: a reader moving between the California Data
// page and the Virginia page must see the same ledger, not two dialects.
describe('rendering parity with California', () => {
  it('renders requirements through the shared TieredDegreeLedger, with tier headings', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByText('Associate Degrees')[0])
    // The tier section headings come from DataPage's DEGREE_TIER_SECTIONS —
    // their presence proves the shared component is doing the rendering.
    expect(screen.getByText(/Lower division · major preparation/i)).toBeTruthy()
    expect(screen.getByText(/Transferable from a community college/i)).toBeTruthy()
  })

  it('resolves parent_id through the course map exactly as California does', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByText('Associate Degrees')[0])
    expect(screen.getByText('CSC 222')).toBeTruthy()
    expect(screen.getByText(/Object-Oriented Programming/)).toBeTruthy()
    // An unresolved id would render as "#900000001"; none should appear.
    expect(screen.queryByText(/^#9000000/)).toBeNull()
  })
})


// The sending side resolves through a different lookup than the receiving side.
// Supplying only one leaves the other column rendering raw ids — which is what
// "the courses are just numbers" looked like.
describe('both course lookups resolve', () => {
  it('names the sending course, not its numeric id', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByText('Associate Degrees')[0])
    expect(screen.getByText('MTH 263')).toBeTruthy()
    expect(screen.getByText(/Calculus I/)).toBeTruthy()
    expect(screen.queryByText('#900000003')).toBeNull()
  })
})


// The rails must show degree status before a click, and must not flatten the
// three outcomes into one tick — "URL only" and "none" mean different things.
describe('degree status in the rails', () => {
  const filters = () => within(screen.getByRole('group', { name: 'Filter by collection state' }))

  it('does not repeat the reach or the degree status under every name', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    const uniRail = within(screen.getByText(/Public universities ·/).closest('div'))
    // The pills above state which bucket the list is showing; repeating it on
    // every row was the noise that made the rail hard to read.
    expect(uniRail.queryByText(/accepted/)).toBeNull()
    expect(uniRail.queryByText(/✓ Verified/)).toBeNull()
    expect(uniRail.queryByText(/No CS-specific degree/)).toBeNull()
    // The institutions themselves are of course still listed.
    expect(uniRail.getByText('George Mason University')).toBeTruthy()
  })

  it('counts each state on its filter pill', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    expect(filters().getByText('Collected 1')).toBeTruthy()
    expect(filters().getByText('Needs collecting 2')).toBeTruthy()
    expect(filters().getByText('Needs composing 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Other Virginia partners 18/ }))
    expect(filters().getByText('URL only 1')).toBeTruthy()
    expect(filters().getByText('No CS-specific degree 1')).toBeTruthy()
  })

  it('opens on the public cohort and keeps other Virginia partners one click away', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])

    const publicRail = within(screen.getByText(/Public universities ·/).closest('div'))
    expect(publicRail.getByText('George Mason University')).toBeTruthy()
    expect(publicRail.getByText('University of Virginia')).toBeTruthy()
    expect(publicRail.getByText('Virginia Military Institute')).toBeTruthy()
    expect(publicRail.queryByText('University of Lynchburg')).toBeNull()
    expect(screen.queryByText('George Washington University')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Other Virginia partners 18/ }))
    const otherRail = within(screen.getByText(/Other Virginia partners ·/).closest('div'))
    expect(otherRail.getByText('University of Lynchburg')).toBeTruthy()
    expect(otherRail.getByText('Hollins University')).toBeTruthy()
    expect(otherRail.queryByText('George Mason University')).toBeNull()
  })

  it('shows an honest collection gap for a public school with no degree record', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    fireEvent.click(screen.getByRole('button', { name: /Needs collecting 2/ }))
    const publicRail = within(screen.getByText(/Public universities ·/).closest('div'))
    expect(publicRail.getByText('University of Virginia')).toBeTruthy()
    expect(publicRail.getByText('Virginia Military Institute')).toBeTruthy()
  })

  it('separates captured source work from schools that have not been collected', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    fireEvent.click(screen.getByRole('button', { name: /Needs composing 1/ }))
    const publicRail = within(screen.getByText(/Public universities ·/).closest('div'))
    expect(publicRail.getByText('Christopher Newport University')).toBeTruthy()
    expect(publicRail.queryByText('University of Virginia')).toBeNull()
  })

  it('leaves the rail as bare names, marking only what stands out', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    const ccRail = within(screen.getByText(/Community colleges ·/).closest('div'))
    expect(ccRail.getByText('Blue Ridge Community College')).toBeTruthy()
    // No reach, no status, no size — the pills above carry all of it.
    expect(ccRail.queryByText(/courses/)).toBeNull()
    expect(ccRail.queryByText(/groups/)).toBeNull()
  })
})

describe('Virginia degree editing', () => {
  it('exposes the stored document as editable JSON, not just a rendering', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByRole('tab', { name: 'Associate Degrees' }).at(-1))
    // Until this existed a verifier could record that a degree was wrong but
    // had no way to correct it.
    expect(screen.getByLabelText('Degree requirements JSON')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeTruthy()
  })
})
