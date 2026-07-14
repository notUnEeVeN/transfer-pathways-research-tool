import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import { CampusMinimums, minimumsToLedger } from './DataReferences'
import { refTableByKey } from './references/refTablesRegistry'

vi.mock('./shared/query/hooks/useData', () => ({
  useRefTable: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
  useDeleteRefRow: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveRefRow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
}))

const rows = [
  {
    _id: 'transfer_minimum:ucsd:calc_1:a:math_20a',
    group_id: 'Calc1',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'MATH 20A',
    matched: true,
    parent_ids: [11],
    matched_courses: [{ parent_id: 11, prefix: 'MATH', number: '20A', title: 'Calculus I' }],
  },
  {
    _id: 'transfer_minimum:ucsd:discrete_math:a:cse_20',
    group_id: 'DiscreteMath',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'CSE 20',
    matched: true,
    parent_ids: [12],
    matched_courses: [{ parent_id: 12, prefix: 'CSE', number: '20', title: 'Discrete Mathematics' }],
  },
  {
    _id: 'transfer_minimum:ucsd:intro:a:cse_8b',
    group_id: 'Intro',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'CSE 8B',
    matched: true,
    parent_ids: [18],
    matched_courses: [{ parent_id: 18, prefix: 'CSE', number: '8B', title: 'Introduction to Programming' }],
  },
  {
    _id: 'transfer_minimum:ucsd:intro:b:cse_11',
    group_id: 'Intro',
    set_id: 'B',
    source_order: 1,
    receiving_code: 'CSE 11',
    matched: false,
    parent_ids: [],
    matched_courses: [],
  },
  {
    _id: 'transfer_minimum:ucsd:data_structures:a:cse_12',
    group_id: 'DataStructures',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'CSE 12',
    matched: true,
    parent_ids: [20],
    matched_courses: [{ parent_id: 20, prefix: 'CSE', number: '12', title: 'Data Structures' }],
  },
]

describe('minimumsToLedger', () => {
  it('merges atomic requirements into subject groups while preserving local alternatives', () => {
    const ledger = minimumsToLedger(rows)
    expect(ledger.requirement_groups).toHaveLength(2)
    expect(ledger.requirement_groups[0]).toMatchObject({
      title: 'Mathematics',
      group_conjunction: 'And',
    })
    expect(ledger.requirement_groups[1]).toMatchObject({
      title: 'Computer Science',
      group_conjunction: 'And',
    })
    // Calc 1 and Discrete Math are both plain take-this-one-course
    // requirements, so they fold into one combined "Complete all of:" card.
    expect(ledger.requirement_groups[0].sections).toHaveLength(1)
    expect(ledger.requirement_groups[0].sections[0]).toMatchObject({
      title: null,
      section_advisement: 2,
    })
    expect(ledger.requirement_groups[0].sections[0].receivers).toHaveLength(2)
    // Intro carries real alternatives so it keeps its named card; the lone
    // plain Data Structures requirement has nothing to merge with.
    expect(ledger.requirement_groups[1].sections.map((section) => section.title))
      .toEqual(['Intro', 'Data Structures'])
    expect(ledger.requirement_groups[1].sections[0]).toMatchObject({
      section_advisement: 1,
      receivers: [{ receiving: { parent_id: 18 } }, { receiving: { kind: 'course' } }],
    })

    const { container } = render(
      <RequirementsLedger major={{ requirement_groups: ledger.requirement_groups }}
        universityCoursesById={ledger.universityCoursesById}
        preserveOrder showCompletion={false} />
    )
    expect(container.textContent).toContain('Mathematics')
    expect(container.textContent).toContain('Computer Science')
    expect(container.textContent).toContain('MATH 20A')
    expect(container.textContent).toContain('CSE 20')
    expect(container.textContent).toContain('Complete all of:')
    expect(container.textContent).toContain('Complete 1 of:')
    expect(container.textContent).toContain('CSE 8B')
    expect(container.textContent).toContain('CSE 11')
  })

  it('folds plain single-course requirements into one combined card per subject', () => {
    const ledger = minimumsToLedger(
      [['Calc1', 'MATH 51'], ['Calc2', 'MATH 52'], ['MultivariableCalc', 'MATH 53'], ['LinearAlgebra', 'MATH 54']]
        .map(([group, code], index) => ({
          _id: `ucb:${group}`,
          group_id: group,
          set_id: 'A',
          source_order: index,
          receiving_code: code,
        }))
    )
    const [math] = ledger.requirement_groups
    expect(math.title).toBe('Mathematics')
    expect(math.sections).toHaveLength(1)
    expect(math.sections[0].title).toBe(null)
    expect(math.sections[0].section_advisement).toBe(4)
    expect(math.sections[0].receivers).toHaveLength(4)
    expect(math.sections[0].receivers.every((r) => r.receiving.kind === 'course')).toBe(true)
  })

  it('renders a single-set multi-course group as one combined series row', () => {
    const ledger = minimumsToLedger([
      ...['31', '32', '33'].map((number, index) => ({
        _id: `uci:intro:${number}`,
        group_id: 'Intro',
        set_id: 'A',
        source_order: index,
        source_entry: [`I&C SCI ${number}`, 'A', 3],
        receiving_code: `I&C SCI ${number}`,
      })),
      ...['45C', '46'].map((number, index) => ({
        _id: `uci:programming:${number}`,
        group_id: 'Programming',
        set_id: String.fromCharCode(65 + index),
        source_order: index,
        source_entry: [`I&C SCI ${number}`, String.fromCharCode(65 + index), 1],
        receiving_code: `I&C SCI ${number}`,
      })),
    ])
    const sections = ledger.requirement_groups[0].sections

    // One set holding several courses is a series — take all of them together,
    // shown as ONE combined row, not a row per course.
    const intro = sections.find((section) => section.title === 'Intro')
    expect(intro.section_advisement).toBe(1)
    expect(intro.receivers).toHaveLength(1)
    expect(intro.receivers[0].receiving).toMatchObject({ kind: 'series', conjunction: 'and' })
    expect(intro.receivers[0].receiving.parent_ids).toHaveLength(3)

    // Several single-course sets stay separate rows — pick one alternative.
    const programming = sections.find((section) => section.title === 'Programming')
    expect(programming.section_advisement).toBe(1)
    expect(programming.receivers).toHaveLength(2)
    expect(programming.receivers.every((r) => r.receiving.kind === 'course')).toBe(true)

    const { container } = render(
      <RequirementsLedger major={{ requirement_groups: ledger.requirement_groups }}
        universityCoursesById={ledger.universityCoursesById}
        preserveOrder showCompletion={false} />
    )
    expect(container.textContent).toContain('I&C SCI 31')
    expect(container.textContent).toContain('I&C SCI 32')
    expect(container.textContent).toContain('I&C SCI 33')
  })
})

describe('CampusMinimums heading', () => {
  it('explains the narrow hand-curated transfer requirement scope', () => {
    render(<CampusMinimums schoolId={7} />)

    expect(screen.getByText('Hand-curated minimum transfer requirements')).toBeInTheDocument()
    expect(screen.getByText(/Computer science and mathematics courses only—not the full degree/)).toBeInTheDocument()
  })
})

describe('transfer-minimum editor mapping', () => {
  it('updates parent_ids when the linked UC course changes', () => {
    const config = refTableByKey('transfer_minimums')
    const saved = config.derive({
      uc_code: 'UCSD',
      receiving_code: 'CSE 11',
      matched_courses: [{ parent_id: 42, prefix: 'CSE', number: '11' }],
    })
    expect(saved.parent_ids).toEqual([42])
    expect(saved.matched).toBe(true)
  })
})
