import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CourseTypeCoverage, {
  MA_FIGURE2_ARCHIVE_DIRECT,
  MA_FIGURE2_FINAL_PDF,
  FAITHFUL_COMPARISON_ROLES,
  buildCourseTypeModel,
  buildMaFigure2ArchiveDirectModel,
  buildMaFigure2PdfModel,
  columnsFor,
  courseTypeComparisonCells,
  courseTypeComparisonContract,
  courseTypeViewForPane,
} from './CourseTypeCoverage'
import { useCoverage } from '../shared/query/hooks/useData'
import { useMajors } from '../shared/majors/useMajors'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))
vi.mock('../shared/majors/useMajors', () => ({ useMajors: vi.fn() }))

// The rollups the server config declares. Computer Science's is the identity —
// its four typed categories are already the paper's four columns — so it has no
// extended variant and the grouping toggle must not appear for it.
const CS_MAJOR = {
  slug: 'cs',
  label: 'Computer Science',
  degreeTemplateEvidence: {
    total: 9, explicitlyVerified: 9,
    catalogYears: 'not recorded on the legacy CS templates',
    staleResearchStatus: 0,
  },
  courseTypes: {
    module: 'cs',
    excludeGeGroups: true,
    axes: {
      faithful: [
        { key: 'computing', label: 'Computing', categories: ['computing'] },
        { key: 'math', label: 'Math', categories: ['math'] },
        { key: 'science', label: 'Science', categories: ['science'] },
        { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
      ],
    },
  },
}

const MA_MAJOR = {
  ...CS_MAJOR,
  slug: 'ma-cs',
  label: 'Computer Science (MA)',
  state: 'ma',
  degreeTemplateEvidence: null,
}

const BIO_MAJOR = {
  slug: 'bio',
  label: 'Biology',
  courseTypes: {
    module: 'bio',
    axes: {
      faithful: [
        { key: 'biology', label: 'Biology', categories: ['bio_series'] },
        { key: 'math', label: 'Math', categories: ['calculus', 'statistics', 'computing'] },
        { key: 'chem_physics', label: 'Chemistry & Physics', categories: ['gen_chem', 'organic_chem', 'physics'] },
        { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
      ],
      extended: [
        { key: 'biology', label: 'Biology', categories: ['bio_series'] },
        { key: 'chemistry', label: 'Chemistry', categories: ['gen_chem', 'organic_chem'] },
        { key: 'physics', label: 'Physics', categories: ['physics'] },
        { key: 'math', label: 'Math', categories: ['calculus', 'statistics'] },
        { key: 'computing', label: 'Computing', categories: ['computing'] },
        { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
      ],
    },
  },
}

const CS_COLUMNS = columnsFor(CS_MAJOR)

const CAMPUSES = [
  { school_id: 7, school: 'UC San Diego' },
  { school_id: 89, school: 'University of California, Davis' },
  { school_id: 120, school: 'UC Irvine' },
]
const COLLEGES = [10, 20, 30, 40]

// Davis covers half its computing slots at every college; San Diego none;
// Irvine requires no science at all, so it contributes no science point.
// Six of the ten computing slots are upper-division and never covered, so the
// two scopes disagree exactly where the real figure does.
function slotsFor(schoolId, collegeId) {
  const computingCovered = schoolId === 89 ? 4 : schoolId === 120 ? 4 : 0
  return {
    computing: {
      total: 10,
      covered: computingCovered,
      lower_division_total: 4,
      lower_division_covered: computingCovered,
    },
    math: {
      total: 4,
      covered: collegeId === 40 ? 2 : 4,
      lower_division_total: 4,
      lower_division_covered: collegeId === 40 ? 2 : 4,
    },
    science: schoolId === 120
      ? { total: 0, covered: 0, lower_division_total: 0, lower_division_covered: 0 }
      : { total: 2, covered: 2, lower_division_total: 2, lower_division_covered: 2 },
    non_stem: {
      total: 5, covered: 4, lower_division_total: 4, lower_division_covered: 4,
    },
  }
}

function rows() {
  return CAMPUSES.flatMap((campus) => COLLEGES.map((collegeId) => ({
    school_id: campus.school_id,
    school: campus.school,
    community_college_id: collegeId,
    community_college: `College ${collegeId}`,
    degree_requirements_by_course_type: slotsFor(campus.school_id, collegeId),
  })))
}

describe('course type coverage', () => {
  const refetch = vi.fn()

  beforeEach(() => {
    refetch.mockReset()
    useMajors.mockReset()
    useMajors.mockReturnValue({
      bySlug: new Map([['cs', CS_MAJOR], ['bio', BIO_MAJOR]]),
    })
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: rows() },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    })
  })

  it('prefers a passed major object and opens a state corpus on the final paper', () => {
    // ma-cs is not in the California registry (bySlug misses), which used to
    // leave columnsFor(null) empty and the whole figure blank on the MA tab.
    render(<CourseTypeCoverage majorSlug='ma-cs' major={MA_MAJOR} />)
    expect(screen.getByRole('button', { name: 'Final paper' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Requirements counted')).toBeNull()
    expect(screen.queryAllByText(/Computing|Math/).length).toBeGreaterThan(0)
  })

  it('keeps the bachelor-template evidence receipt inside exports', () => {
    const { container } = render(<CourseTypeCoverage majorSlug='cs' />)
    const exportRoot = container.querySelector('[data-export-root]')
    expect(within(exportRoot).getByText(/9\/9 bachelor templates explicitly verified/i))
      .toBeInTheDocument()
    expect(within(exportRoot).getByText(/catalog years: not recorded/i))
      .toBeInTheDocument()
  })

  it('freezes the final-PDF populations, visible point values, and provenance gate', () => {
    const model = buildMaFigure2PdfModel(columnsFor(MA_MAJOR))
    const byKey = Object.fromEntries(model.columns.map((column) => [column.key, column]))

    expect(MA_FIGURE2_FINAL_PDF.source.sha256)
      .toBe('5024b34ae6dd40f0fe735f75844d8c341de27b9df668756905a78f03f35c488a')
    expect(MA_FIGURE2_FINAL_PDF.source.pdf_page).toBe(3)
    expect(model.columns.map((column) => column.points.length)).toEqual([11, 11, 11, 5])
    expect(byKey.computing.points.map((point) => point.value))
      .toEqual([5, 9, 11, 11, 18, 20, 22, 25, 29, 30, 58])
    expect(byKey.math.points.map((point) => point.value))
      .toEqual([13, 40, 47, 52, 52, 53, 63, 65, 83, 97, 98])
    expect(byKey.science.points.map((point) => point.value))
      .toEqual([53, 78, 93, 97, 100, 100, 100, 100, 100, 100, 100])
    expect(byKey.non_stem.points.map((point) => point.value))
      .toEqual([47, 67, 67, 100, 100])
    expect(model.columns.map((column) => Number(column.mean.toFixed(1))))
      .toEqual([21.6, 60.3, 92.8, 76.2])
    expect(model.columns.map((column) => column.paperProseMean)).toEqual([22, 60, 93, 76])
    expect(model.columns.every((column) => column.points.every((point) => point.anonymous)))
      .toBe(true)
  })

  it('freezes our reviewed recalculation separately from the final paper', () => {
    const model = buildMaFigure2ArchiveDirectModel(columnsFor(MA_MAJOR))
    const byKey = Object.fromEntries(model.columns.map((column) => [column.key, column]))

    expect(MA_FIGURE2_ARCHIVE_DIRECT.source.repository_commit)
      .toBe('f0be157a419b23e90d206cef72ee5cba09b8274f')
    expect(MA_FIGURE2_ARCHIVE_DIRECT.source.workbook_sha256)
      .toBe('f9d8650db1789d8a5c911656af29ddd3e31c1c1fcdb62707d6dd9aaedef998ff')
    expect(MA_FIGURE2_ARCHIVE_DIRECT.reconstruction.identity_limit)
      .toMatch(/multiset overlap.*never an observation-index or campus join/i)
    expect(byKey.computing.points.map((point) => point.value))
      .toEqual([6, 9, 11, 11, 18, 20, 22, 25, 28, 29, 58])
    expect(byKey.math.points.map((point) => point.value))
      .toEqual([13, 40, 47, 52, 52, 53, 63, 65, 83, 95, 97])
    expect(byKey.science.points.map((point) => point.value))
      .toEqual([53, 78, 93, 97, 100, 100, 100, 100, 100, 100, 100])
    expect(byKey.non_stem.points.map((point) => point.value))
      .toEqual([33, 47, 67, 100, 100])
    expect(model.columns.map((column) => Number(column.mean.toFixed(1))))
      .toEqual([21.5, 60, 92.8, 69.4])
    expect(model.columns.every((column) => column.points.every((point) => point.anonymous)))
      .toBe(true)
  })

  it('renders the final paper locally, then switches only to our recalculation', () => {
    const onViewChange = vi.fn()
    const { container } = render(
      <CourseTypeCoverage majorSlug='ma-cs' major={MA_MAJOR} onViewChange={onViewChange} />
    )

    expect(container.querySelectorAll('[data-point]')).toHaveLength(38)
    expect(screen.getByText(/Printed point counts: Computing n=11, Math n=11, Science n=11, Non-STEM n=5/i))
      .toBeInTheDocument()
    expect(screen.getByRole('img', {
      name: /Non-STEM, Printed observation 1: 47 percent of required non-stem courses have an equivalent in final PDF Figure 2/i,
    })).toBeInTheDocument()
    expect(screen.getByRole('img', {
      name: /Non-STEM average across 5 plotted observations: 76.2 percent; paper prose reports 76 percent/i,
    })).toBeInTheDocument()
    expect(screen.getByText('Frozen source artifact')).toBeInTheDocument()
    expect(onViewChange).toHaveBeenLastCalledWith({
      defaultScope: 'whole-degree', defaultVariant: 'faithful', defaultMaSource: 'pdf',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Our recalculation' }))

    expect(screen.queryByText('Requirements counted')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Refresh data' })).toBeNull()
    expect(container.querySelectorAll('[data-point]')).toHaveLength(38)
    expect(screen.getByText(/Our Figure 2 recalculation · 11 universities × 15 community colleges/i))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archived requirement reconstruction' })).toBeNull()
    expect(onViewChange).toHaveBeenLastCalledWith({
      defaultScope: 'whole-degree', defaultVariant: 'faithful', defaultMaSource: 'archive-direct',
    })
  })

  it('opens the reviewed direct rerun as a frozen, anonymous whole-degree artifact', () => {
    const onViewChange = vi.fn()
    const { container } = render(
      <CourseTypeCoverage majorSlug='ma-cs' major={MA_MAJOR}
        defaultMaSource='archive-direct' defaultScope='lower-division'
        onViewChange={onViewChange} />
    )

    expect(screen.getByRole('button', { name: 'Our recalculation' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Requirements counted')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Refresh data' })).toBeNull()
    expect(screen.getByText('Frozen source artifact')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-point]')).toHaveLength(38)
    expect(screen.getByText(/Our Figure 2 recalculation · 11 universities × 15 community colleges/i))
      .toBeInTheDocument()
    expect(screen.getByText(/cannot be paired by campus or observation index/i))
      .toBeInTheDocument()
    expect(screen.getByRole('img', {
      name: /Non-STEM, Recalculated observation 1: 33 percent.*our Figure 2 recalculation.*identity is not assigned/i,
    })).toBeInTheDocument()
    expect(onViewChange).toHaveBeenLastCalledWith({
      defaultScope: 'whole-degree',
      defaultVariant: 'faithful',
      defaultMaSource: 'archive-direct',
    })
  })

  it('does not let a live-endpoint failure block the frozen final-PDF exhibit', () => {
    useCoverage.mockReturnValue({
      data: null, isLoading: false, isError: true, isFetching: false, refetch,
    })

    const { container } = render(<CourseTypeCoverage majorSlug='ma-cs' major={MA_MAJOR} />)

    expect(container.querySelectorAll('[data-point]')).toHaveLength(38)
    expect(screen.queryByText(/Could not load degree requirement coverage/i)).toBeNull()
  })

  it('normalizes a legacy archived view to our direct whole-degree recalculation', () => {
    render(<CourseTypeCoverage majorSlug='ma-cs' major={MA_MAJOR}
      defaultMaSource='archive' defaultScope='lower-division' />)

    expect(screen.getByRole('button', { name: 'Our recalculation' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Lower-division only' })).toBeNull()
    expect(screen.getByRole('img', {
      name: /Computing, Recalculated observation 1:/i,
    })).toBeInTheDocument()
    expect(screen.getByText(/Our Figure 2 recalculation · 11 universities × 15 community colleges/i))
      .toBeInTheDocument()
  })

  it('locks the comparison contract to the PDF scope and never invents campus joins', () => {
    const pane = {
      major: 'ma-cs',
      knobs: { 'ma-source': 'pdf', scope: 'lower-division', variant: 'extended' },
    }
    const view = courseTypeViewForPane(pane, MA_MAJOR)
    const cells = courseTypeComparisonCells({ rows: rows() }, pane, MA_MAJOR)
    const contract = courseTypeComparisonContract(pane, MA_MAJOR)

    expect(view).toMatchObject({
      paperCorpus: true, maSource: 'pdf', scope: 'whole-degree', variant: 'faithful',
    })
    expect(cells).toHaveLength(38)
    expect(new Set(cells.map((cell) => cell.rowKey)).size).toBe(38)
    expect(cells.every((cell) => cell.rowLabel.startsWith('Printed observation '))).toBe(true)
    expect([...new Set(cells.map((cell) => cell.colKey))])
      .toEqual(FAITHFUL_COMPARISON_ROLES.map((role) => role.key))
    expect(contract.semantics.scope).toBe('whole-degree')
    expect(contract.semantics.general_education).toBe('excluded')
    expect(contract.distribution).toEqual({
      groupBy: 'column', label: 'course type', pooled: false,
      roles: FAITHFUL_COMPARISON_ROLES.map((role) => role.key),
    })
    expect(contract.keys.rows)
      .toBe('anonymous final-PDF category-local observation; distribution only')
    expect(contract.context).toMatchObject({
      source: 'final PDF Figure 2 (unlabeled raster transcription)',
      pointIdentity: 'anonymous printed university observations',
    })

    const caContract = courseTypeComparisonContract({
      major: 'cs', knobs: { scope: 'whole-degree', variant: 'faithful' },
    }, CS_MAJOR)
    expect(caContract.semantics).toEqual(contract.semantics)
    expect(caContract.distribution).toEqual(contract.distribution)
    expect(caContract.context).not.toEqual(contract.context)
  })

  it('keeps the direct rerun anonymous and key-incompatible with final-PDF observation indices', () => {
    const pdfPane = { major: 'ma-cs', knobs: { 'ma-source': 'pdf' } }
    const directPane = { major: 'ma-cs', knobs: { 'ma-source': 'archive-direct' } }
    const pdfCells = courseTypeComparisonCells({ rows: rows() }, pdfPane, MA_MAJOR)
    const directCells = courseTypeComparisonCells({ rows: rows() }, directPane, MA_MAJOR)
    const pdfContract = courseTypeComparisonContract(pdfPane, MA_MAJOR)
    const directContract = courseTypeComparisonContract(directPane, MA_MAJOR)

    expect(courseTypeViewForPane(directPane, MA_MAJOR)).toMatchObject({
      paperCorpus: true,
      maSource: 'archive-direct',
      scope: 'whole-degree',
      variant: 'faithful',
    })
    expect(pdfCells).toHaveLength(38)
    expect(directCells).toHaveLength(38)
    expect(pdfCells.some((pdf) => directCells.some((direct) => direct.rowKey === pdf.rowKey)))
      .toBe(false)
    expect(directContract.keys.rows)
      .toBe('anonymous recalculation category-local observation; distribution only')
    expect(directContract.keys.rows).not.toBe(pdfContract.keys.rows)
    expect(directContract.distribution).toEqual(pdfContract.distribution)
    expect(directContract.context).toMatchObject({
      source: 'our recalculation from the authors’ requirement and equivalency data',
      pointIdentity: 'anonymous recalculated university observations',
    })
  })

  it('averages each campus over its colleges and drops types it does not require', () => {
    const model = buildCourseTypeModel(rows(), 'whole-degree', CS_COLUMNS)
    const byKey = Object.fromEntries(model.columns.map((column) => [column.key, column]))

    expect(model.campusCount).toBe(3)
    expect(model.collegeCount).toBe(4)
    expect(byKey.computing.points.map((point) => [point.campus, point.value]))
      .toEqual([['San Diego', 0], ['Davis', 40], ['Irvine', 40]])
    expect(byKey.computing.mean).toBeCloseTo(26.7, 1)
    // 4 of 4 slots at three colleges, 2 of 4 at the fourth.
    expect(byKey.math.points[0].value).toBe(87.5)
    expect(byKey.science.points.map((point) => point.campus)).toEqual(['Davis', 'San Diego'])
    expect(byKey.science.mean).toBe(100)
    expect(byKey.non_stem.points).toHaveLength(3)
  })

  it('counts only lower-division slots when the scope asks for them', () => {
    const lower = buildCourseTypeModel(rows(), 'lower-division', CS_COLUMNS)
    const whole = buildCourseTypeModel(rows(), 'whole-degree', CS_COLUMNS)
    const computing = (model) => model.columns.find((column) => column.key === 'computing')

    expect(whole.scope).toBe('whole-degree')
    expect(lower.scope).toBe('lower-division')
    // Same four covered slots, but out of four rather than ten.
    expect(computing(lower).points.map((point) => point.value)).toEqual([0, 100, 100])
    expect(computing(whole).points.map((point) => point.value)).toEqual([0, 40, 40])
    // Non-STEM's one uncovered slot is upper-division, so it clears to 100%.
    expect(lower.columns.find((column) => column.key === 'non_stem').mean).toBe(100)
  })

  it('normalizes campus names and counts colleges behind each point', () => {
    const model = buildCourseTypeModel(rows(), 'whole-degree', CS_COLUMNS)
    const davis = model.columns[0].points.find((point) => point.campus === 'Davis')

    expect(davis.colleges).toBe(4)
  })

  it('normalizes faithful CS and Biology columns to the same four semantic roles', () => {
    const keys = (cells) => [...new Set(cells.map((item) => item.colKey))]
    const expected = FAITHFUL_COMPARISON_ROLES.map((role) => role.key)

    expect(keys(courseTypeComparisonCells(
      { rows: rows() }, { major: 'cs', knobs: { variant: 'faithful' } }, CS_MAJOR,
    ))).toEqual(expected)
    expect(keys(courseTypeComparisonCells(
      { rows: bioRows() }, { major: 'bio', knobs: { variant: 'faithful' } }, BIO_MAJOR,
    ))).toEqual(expected)
  })

  it('defaults to the paper-comparable whole-degree scope and renders one dot per campus per type', () => {
    const { container } = render(<CourseTypeCoverage />)

    expect(container.querySelectorAll('[data-column]')).toHaveLength(4)
    // 3 campuses in three types, 2 in science.
    expect(container.querySelectorAll('[data-point]')).toHaveLength(11)
    expect(container.querySelectorAll('[data-mean]')).toHaveLength(4)
    expect(screen.getByRole('img', { name: /Computing at Davis: 40 percent of required courses/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Science average across campuses: 100 percent/i })).toBeTruthy()
    expect(screen.getByText('Course Type')).toBeTruthy()
    expect(screen.getByText('Mean')).toBeTruthy()
    expect(screen.getByText(/Current computed corpus .* general education excluded/i))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Lower-division only' }))
    expect(screen.getByRole('img', { name: /Computing at Davis: 100 percent of required courses/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Whole degree' }))
    expect(screen.getByRole('img', { name: /Computing at Davis: 40 percent of required courses/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(useCoverage).toHaveBeenCalledWith(
      {
        majorSlug: 'cs',
        groupBy: 'college',
        requirements: 'degree',
        pin: 'settings',
      },
      expect.objectContaining({ refetchOnWindowFocus: false, refetchInterval: false })
    )
  })

  it('separates overlapping points instead of drawing them on top of each other', () => {
    const { container } = render(<CourseTypeCoverage />)
    const nonStem = container.querySelector('[data-column="non_stem"]')
    const circles = [...nonStem.querySelectorAll('circle')]
    const xs = circles.map((circle) => Number(circle.getAttribute('cx')))

    // All three campuses sit at 80%, so the swarm must spread them.
    expect(new Set(circles.map((circle) => circle.getAttribute('cy'))).size).toBe(1)
    expect(new Set(xs).size).toBe(3)
  })
})

// Biology's fine categories, as the server sends them. Chemistry is the
// largest block, which is the thing the four-column rollup necessarily hides.
function bioSlots(schoolId) {
  const full = (total, covered) => ({
    total, covered, lower_division_total: total, lower_division_covered: covered,
  })
  const none = full(0, 0)
  return {
    bio_series: full(4, 4),
    gen_chem: full(6, 6),
    organic_chem: full(4, 2),
    physics: full(4, 4),
    calculus: full(2, 2),
    statistics: schoolId === 7 ? none : full(1, 1),
    computing: schoolId === 144 ? full(2, 1) : none,
    non_stem: full(5, 4),
  }
}

function bioRows() {
  return [7, 89, 144].flatMap((schoolId) => [10, 20].map((collegeId) => ({
    school_id: schoolId,
    school: `UC ${schoolId}`,
    community_college_id: collegeId,
    degree_requirements_by_course_type: bioSlots(schoolId),
  })))
}

describe('biology rollups', () => {
  beforeEach(() => {
    useMajors.mockReset()
    useMajors.mockReturnValue({
      bySlug: new Map([['cs', CS_MAJOR], ['bio', BIO_MAJOR]]),
    })
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: bioRows() },
      isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    })
  })

  it('sums the fine categories a faithful column rolls up', () => {
    const model = buildCourseTypeModel(bioRows(), 'whole-degree', columnsFor(BIO_MAJOR))
    const byKey = Object.fromEntries(model.columns.map((column) => [column.key, column]))

    expect(model.columns.map((column) => column.label))
      .toEqual(['Biology', 'Math', 'Chemistry & Physics', 'Non-STEM'])
    // gen_chem 6/6 + organic 2/4 + physics 4/4 = 12 of 14.
    expect(byKey.chem_physics.points[0].value).toBeCloseTo(85.7, 1)
    expect(byKey.biology.points[0].value).toBe(100)
  })

  it('separates chemistry from physics only in the extended variant', () => {
    const extended = buildCourseTypeModel(
      bioRows(), 'whole-degree', columnsFor(BIO_MAJOR, 'extended')
    )
    const byKey = Object.fromEntries(extended.columns.map((column) => [column.key, column]))

    expect(extended.columns).toHaveLength(6)
    // Chemistry alone is 8 of 10 — the organic gap, which the faithful column
    // dilutes with a fully covered physics series.
    expect(byKey.chemistry.points[0].value).toBe(80)
    expect(byKey.physics.points[0].value).toBe(100)
  })

  it('drops a column at campuses that require nothing in it', () => {
    const extended = buildCourseTypeModel(
      bioRows(), 'whole-degree', columnsFor(BIO_MAJOR, 'extended')
    )
    const computing = extended.columns.find((column) => column.key === 'computing')

    // Only one of the three campuses requires any computing, exactly as the
    // source figure carries fewer points in its Non-STEM column.
    expect(computing.points).toHaveLength(1)
    expect(computing.points[0].value).toBe(50)
  })

  it('offers the grouping toggle for biology and switches the columns', () => {
    const { container } = render(<CourseTypeCoverage majorSlug='bio' majorLabel='Biology' />)

    expect(container.querySelectorAll('[data-column]')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'By discipline' }))
    expect(container.querySelectorAll('[data-column]')).toHaveLength(6)
    expect(screen.getByText('Chemistry')).toBeTruthy()
    expect(screen.getByText('Physics')).toBeTruthy()
  })

  it('requests coverage for the selected major, not Computer Science', () => {
    render(<CourseTypeCoverage majorSlug='bio' majorLabel='Biology' />)

    expect(useCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ majorSlug: 'bio' }),
      expect.anything()
    )
  })

  it('hides the grouping toggle for a major with no extended axis set', () => {
    useCoverage.mockReturnValue({
      data: { rows: rows() }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    })
    render(<CourseTypeCoverage majorSlug='cs' majorLabel='Computer Science' />)

    expect(screen.queryByRole('button', { name: 'By discipline' })).toBeNull()
  })
})
