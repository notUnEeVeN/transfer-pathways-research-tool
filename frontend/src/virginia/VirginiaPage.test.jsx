import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

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
  useVaInstitutions: (level) => {
    const all = state.institutions
    if (!level || !all?.data) return all
    return { ...all, data: { institutions: all.data.institutions.filter((i) => i.level === level) } }
  },
  useVaDepartments: () => state.departments,
  useVaCourses: () => state.courses,
  useVaCourse: () => state.course,
  useVaMatrix: () => state.matrix,
}))

import VirginiaPage from './VirginiaPage'

const ok = (data) => ({ data, isLoading: false, error: null })

beforeEach(() => {
  state.summary = ok({
    imported: true, courses: 304, institutions: 57, community_colleges: 24,
    four_year: 33, equivalencies: 4668, with_notes: 970, departments: 69,
  })
  state.institutions = ok({
    institutions: [
      { _id: 'va:inst:blue-ridge', name: 'Blue Ridge Community College', level: 'community_college',
        course_count: 213, receives_count: 0, degree_status: 'full', degree_courses: 31 },
      { _id: 'va:inst:wytheville', name: 'Wytheville Community College', level: 'community_college',
        course_count: 180, receives_count: 0, degree_status: 'url_only', degree_courses: 0 },
      { _id: 'va:inst:gmu', name: 'George Mason University', level: 'four_year',
        course_count: 0, receives_count: 237, degree_status: 'full', degree_courses: 114 },
      { _id: 'va:inst:lynchburg', name: 'University of Lynchburg', level: 'four_year',
        course_count: 0, receives_count: 131, degree_status: 'url_only', degree_courses: 0 },
      { _id: 'va:inst:gwu', name: 'George Washington University', level: 'four_year',
        course_count: 0, receives_count: 1, degree_status: 'none', degree_courses: 0 },
      { _id: 'va:inst:hollins', name: 'Hollins University', level: 'four_year',
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
  const doc = (over = {}) => ({
    doc_id: 'va:as:x:cs', source: 'institution_catalog', status: 'extracted',
    verified: false, validation: 'pass', groups: 8, receivers: 60, ...over,
  })
  state.coverage = ok({
    coverage: [
      { _id: 'va:cov:cc:blue-ridge', institution: 'Blue Ridge Community College', level: 'community_college', collected: true,
        source_url: 'https://catalog.brcc.edu/x', offers_cs: true,
        documents: { as_degree: [doc({ doc_id: 'va:as:blue-ridge:cs' })], degree: [] } },
      { _id: 'va:cov:cc:wytheville', institution: 'Wytheville Community College', level: 'community_college', collected: false,
        offers_cs: true,
        documents: { as_degree: [doc({ doc_id: 'va:as:wytheville:cs', status: 'url_only', groups: 0, receivers: 0, validation: null })], degree: [] } },
      { _id: 'va:cov:uni:gmu', institution: 'George Mason University', level: 'four_year', collected: true,
        offers_cs: true,
        documents: { as_degree: [], degree: [doc({ doc_id: 'va:degree:gmu:cs', verified: true, validation: 'warn' })] } },
      { _id: 'va:cov:uni:lynchburg', institution: 'University of Lynchburg', level: 'four_year', collected: false,
        offers_cs: true,
        documents: { as_degree: [], degree: [doc({ doc_id: 'va:degree:lynchburg:cs', status: 'url_only', groups: 0, receivers: 0, validation: null })] } },
      { _id: 'va:cov:uni:hollins', institution: 'Hollins University', level: 'four_year', collected: false, offers_cs: false,
        documents: { as_degree: [], degree: [doc({ doc_id: 'va:degree:hollins:cs', status: 'no_program', groups: 0, receivers: 0, validation: null })] } },
    ],
    collected: 2,
    total: 4,
    verification: {
      documents: 4, verifiable: 2, verified: 1,
      as_verifiable: 1, as_verified: 0, bs_verifiable: 1, bs_verified: 1,
    },
  })
  state.matrix = ok({
    colleges: ['Blue Ridge Community College'],
    receivers: ['George Mason University'],
    cells: [[137]], courses: 304,
  })
})

describe('VirginiaPage', () => {
  it('renders without crashing and shows the corpus counts', () => {
    render(<VirginiaPage />)
    expect(screen.getByText('4,668')).toBeTruthy()
  })

  it('shows the four top-level tabs, and no Districts or Prerequisites', () => {
    render(<VirginiaPage />)
    for (const t of ['Overview', 'Community Colleges', 'Universities', 'Courses']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('Districts')).toBeNull()
    expect(screen.queryByText('Prerequisites')).toBeNull()
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
    expect(screen.getByText('CS108')).toBeTruthy()
    expect(screen.getAllByText('Graduation Requirements').length).toBeGreaterThan(0)
  })
})

// Every tab gets rendered at least once. A JSX identifier that is used but not
// imported is a runtime ReferenceError that the bundler does not catch, so an
// unvisited tab can ship broken — which is exactly what happened to the
// Courses tab when its search input was swapped out.
describe('every tab renders', () => {
  const tabs = ['Overview', 'Community Colleges', 'Universities', 'Courses']
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
    fireEvent.click(screen.getAllByText('Courses')[0])
    expect(screen.getByText(/shared VCCS catalog/i)).toBeTruthy()
    fireEvent.click(screen.getByText('CSC221'))
    expect(screen.getAllByText(/Introduction to Problem Solving/i).length).toBeGreaterThan(0)
  })
})


describe('verification progress', () => {
  it('states how much is left rather than listing it all on the landing view', () => {
    render(<VirginiaPage />)
    expect(screen.getByText('Verification progress')).toBeTruthy()
    // One readable A.S. record, unverified. Wytheville publishes nothing to
    // read, so it stays out of the denominator — counting it would leave the
    // job looking permanently unfinished.
    expect(screen.getByLabelText('A.S. degrees verified').getAttribute('aria-valuetext')).toBe('0 of 1')
    expect(screen.getByLabelText('B.S. degrees verified').getAttribute('aria-valuetext')).toBe('1 of 1')
  })
})

describe('the rail status filters', () => {
  const rail = () => within(screen.getByText(/Community colleges ·/).closest('div'))
  const filters = () => within(screen.getByRole('group', { name: 'Filter by verification state' }))

  it('filters the rail to the institutions still needing verification', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    // Both colleges to start; only Blue Ridge is outstanding work.
    expect(rail().getByText('Blue Ridge Community College')).toBeTruthy()
    expect(rail().getByText('Wytheville Community College')).toBeTruthy()
    fireEvent.click(filters().getByRole('button', { name: /Needs verifying/ }))
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
    const pill = filters().getByRole('button', { name: /Needs verifying/ })
    fireEvent.click(pill)
    expect(rail().queryByText('Wytheville Community College')).toBeNull()
    fireEvent.click(filters().getByRole('button', { name: /Needs verifying/ }))
    expect(rail().getByText('Wytheville Community College')).toBeTruthy()
  })
})

describe('degree editing', () => {
  it('sends a verify intent without the client stamping who or when', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Community Colleges')[0])
    fireEvent.click(screen.getByText('Blue Ridge Community College'))
    fireEvent.click(screen.getAllByText('Associate Degrees')[0])
    fireEvent.click(screen.getByText('Mark verified'))
    expect(state.saved).toHaveLength(1)
    expect(state.saved[0].verification.verified).toBe(true)
    // The server is the authority on these — the client must not send them.
    expect(state.saved[0].verification.verified_by_label).toBeUndefined()
    expect(state.saved[0].verification.verified_at).toBeUndefined()
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
    fireEvent.click(screen.getByText('Mark verified'))
    expect(state.saved[0].verification.notes).toBe('checked against catalog')
  })
})

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
    fireEvent.click(screen.getAllByText('Graduation Requirements')[0])
    expect(screen.getByText('URL only')).toBeTruthy()
    expect(screen.getByText(/no machine-readable course list/i)).toBeTruthy()
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
  const filters = () => within(screen.getByRole('group', { name: 'Filter by verification state' }))

  it('does not repeat the reach or the degree status under every name', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    const uniRail = within(screen.getByText(/Universities ·/).closest('div'))
    // The pills above state which bucket the list is showing; repeating it on
    // every row was the noise that made the rail hard to read.
    expect(uniRail.queryByText(/accepted/)).toBeNull()
    expect(uniRail.queryByText(/✓ Verified/)).toBeNull()
    expect(uniRail.queryByText(/No program/)).toBeNull()
    // The institutions themselves are of course still listed.
    expect(uniRail.getByText('George Mason University')).toBeTruthy()
  })

  it('counts each state on its filter pill', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VirginiaPage />)
    fireEvent.click(screen.getAllByText('Universities')[0])
    expect(filters().getByText('Verified 1')).toBeTruthy()
    expect(filters().getByText('URL only 1')).toBeTruthy()
    expect(filters().getByText('No program 1')).toBeTruthy()
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
